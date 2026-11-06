// «Бабушкина ферма» — прототип второй игры (docs/FARM.md): шесть грядок, маленькая лавка у дороги
// (касса и три полки), один игровой день — утро (что посадить), день (растёт, лавка открыта), вечер (итоги).
// Правила и деньги — в game/farm/*, окна — farmUi.ts; здесь только мир: как это выглядит и двигается.
// Из движка «Магазинчика» — люди (persons.makePerson, походка по кадрам ног), облачко бабушки (SayBubble),
// пиксельные эффекты (pixelFx), цветокоррекция часа и погоды (ColorGrade), звук и атмосфера, окна (ui/dom).
// Тряски камеры нет; в лёгкой графике — без прохода цвета, эффектов pixelfx и с редким дождём.

import Phaser from 'phaser';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { ambience } from '../platform/ambience';
import { setListener } from '../platform/mixer';
import { quality } from '../platform/quality';
import { flushSoon, track } from '../platform/analytics';
import { haptic } from '../platform/telegram';
import { weatherFor, type Weather } from '../game/weather';
import { yearTime } from '../game/calendar';
import { CROPS, cropIndex, stageOf, type CropId } from '../game/farm/crops';
import {
  FARM_DAY_SECONDS,
  grow,
  harvest,
  hinted,
  isWetDay,
  markHint,
  missed,
  newFarm,
  nextDay,
  onShelves,
  pay,
  plant,
  stockShelves,
  stuck,
  takeFromShelves,
  thirsty,
  water,
  wish,
  type FarmHint,
  type FarmState,
} from '../game/farm/farm';
import { loadFarm, saveChoice, saveFarm } from '../game/farm/save';
import { SayBubble } from '../ui/onboarding';
import { UI_FONT } from '../ui/dom';
import { ART, CUSTOMER_SPEED, GRANDMA, SHIRTS, VIEW_SUFFIX, customerLook } from '../scenes/common';
import { facingAlong, type Facing } from '../scenes/stride';
import { crispZoom } from '../scenes/pixels';
import { ColorGrade } from '../scenes/grade';
import * as persons from '../scenes/persons';
import * as pixelFx from '../scenes/pixelFx';
import { cropName, FarmHud, pickCrop, showSummary } from './farmUi';
import { FARM_TEXTURES } from './textures';
import { png } from '../platform/assets';

/** Мир фермы в точках (как у магазина: спрайт вдвое меньше своих пикселей, ART). */
const VIEW_W = 150;
const VIEW_H = 250;
const CENTER = { x: 75, y: 158 };
/** Грядки: три в ряд, два ряда (центры). */
const BED_COLS = [30, 75, 120];
const BED_ROWS = [112, 140];
/** Лавка, полки и касса. */
const STALL = { x: 62, y: 206 };
const SHELF_XS = [40, 62, 84];
const SHELF_Y = 218;
const TILL = { x: 118, y: 219 };
/** Где стоят у полки и у кассы; дорога, по которой идут. */
const SHOP_Y = 230;
const ROAD_Y = 254;
const GRANNY = { x: 100, y: 97 };
/** Сколько покупатель ждёт у кассы (мс игры) и сколько людей разом. */
const PATIENCE_MS = 16_000;
const MAX_GUESTS = 4;
/** Раз в столько секунд дня — сохранение (рост идёт непрерывно). */
const SAVE_EVERY = 2;

interface BedView {
  x: number;
  y: number;
  soil: Phaser.GameObjects.Image;
  plants: Phaser.GameObjects.Image[];
  drop: Phaser.GameObjects.Image;
  shown: string;
}

interface ShelfView {
  x: number;
  img: Phaser.GameObjects.Image;
  items: Phaser.GameObjects.Image[];
  label: Phaser.GameObjects.Text;
}

interface Guest {
  p: Phaser.GameObjects.Container;
  crop: CropId;
  n: number;
  /** Встал у кассы (время сцены); 0 — ещё идёт. */
  readyAt: number;
  gone: boolean;
}

export class FarmScene extends Phaser.Scene {
  state: FarmState = newFarm();
  /** Лёгкая графика (platform/quality.ts) и скорость дня — их же ждут pixelFx и люди. */
  lite = quality() === 'lite';
  speed = 1;
  people = new Set<Phaser.GameObjects.Container>();
  weather: Weather = 'clear';
  phase: 'morning' | 'day' | 'evening' = 'morning';
  timeLeft = FARM_DAY_SECONDS;
  private hud!: FarmHud;
  private say = new SayBubble();
  private grade?: ColorGrade;
  private beds: BedView[] = [];
  private shelves: ShelfView[] = [];
  private granny!: Phaser.GameObjects.Container;
  private guests = new Set<Guest>();
  private queue: Guest[] = [];
  private spawnIn = 4;
  private saveIn = SAVE_EVERY;
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private picking: (() => void) | null = null;

  constructor() {
    super('farm');
  }

  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  /** Свои картинки (не из общего атласа, farm/textures.ts) — один раз за игру. */
  preload(): void {
    for (const key of FARM_TEXTURES) if (!this.textures.exists(key)) this.load.image(key, png(key));
  }

  create(): void {
    this.state = loadFarm() ?? newFarm();
    this.weather = weatherFor(this.state.day);
    track('farm_open', this.state.day);
    if (!this.lite) void pixelFx.loadSheets(this);
    setListener(() => {
      const v = this.cameras.main.worldView;
      return { left: v.x, width: v.width };
    });
    this.buildWorld();
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.hud = new FarmHud();
    if (!this.lite) {
      this.grade = new ColorGrade(this, quality());
      this.grade.attach(950);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      this.hud.destroy();
      this.say.hide();
    });
    // Отладка (?debug): сцену фермы видно из консоли — для съёмки (scripts/promo/farm.cjs).
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { farm: this });
    this.morning();
  }

  // ---------- мир ----------

  private buildWorld(): void {
    // Трава до горизонта, дорога внизу, тропинка между огородом и лавкой.
    this.add.tileSprite(CENTER.x, CENTER.y, 900, 1400, 'grass').setTileScale(1 / ART).setDepth(-20);
    this.add.tileSprite(CENTER.x, 162, 900, 10, 'paving').setTileScale(1 / ART).setDepth(-15);
    this.add.tileSprite(CENTER.x, ROAD_Y, 900, 24, 'asphalt').setTileScale(1 / ART).setDepth(-15);
    // Бабушкин домик, дерево, кусты и штакетник за грядками.
    this.art(34, 78, 'farm_house').setOrigin(0.5, 1).setDepth(76);
    this.art(126, 80, 'tree').setOrigin(0.5, 1).setDepth(78);
    this.art(98, 82, 'bush').setOrigin(0.5, 1).setDepth(80);
    for (let x = -40; x < 230; x += 16) this.art(x, 92, 'farm_fence').setOrigin(0, 1).setDepth(92);
    for (const [x, y] of [[8, 278], [140, 284], [10, 180], [142, 186]] as const) this.art(x, y, 'bush').setOrigin(0.5, 1).setDepth(y);
    // Грядки.
    this.beds = [];
    BED_ROWS.forEach((y) =>
      BED_COLS.forEach((x) => {
        const i = this.beds.length;
        const soil = this.art(x, y, 'farm_bed').setDepth(y - 8);
        const drop = this.art(x, y - 16, 'farm_drop').setDepth(1000).setVisible(false);
        this.tweens.add({ targets: drop, y: y - 18, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const zone = this.add.zone(x, y - 3, 30, 26).setInteractive({ useHandCursor: true });
        zone.on('pointerup', () => this.tapBed(i));
        this.beds.push({ x, y, soil, plants: [], drop, shown: '' });
      }),
    );
    // Лавка: навес, вывеска, полки, касса.
    this.art(STALL.x, STALL.y, 'farm_stall').setOrigin(0.5, 1).setDepth(STALL.y - 30);
    this.worldText(STALL.x, STALL.y - 32.5, t('farm.sign'), 3.6, '#5c3a2a').setDepth(STALL.y - 29);
    this.shelves = SHELF_XS.map((x) => {
      const img = this.art(x, SHELF_Y, 'farm_shelf').setOrigin(0.5, 1).setDepth(SHELF_Y);
      const label = this.worldText(x + 8, SHELF_Y - 1.5, '', 3, '#fbf6ea').setDepth(SHELF_Y + 2);
      return { x, img, items: [], label };
    });
    const till = this.art(TILL.x, TILL.y, 'farm_till').setOrigin(0.5, 1).setDepth(TILL.y);
    till.setInteractive({ useHandCursor: true }).on('pointerup', () => this.serve());
    this.add.zone(TILL.x + 12, SHOP_Y + 4, 44, 22).setInteractive().on('pointerup', () => this.serve());
    // Бабушка — у тропинки, между огородом и лавкой.
    this.granny = persons.makePerson(this, GRANNY.x, GRANNY.y, GRANDMA);
    persons.setFacing(this.granny, 'down');
    this.applyWeather();
    this.refreshBeds();
    this.refreshShelves();
  }

  /** Надпись в мире: шрифт игры, высота size точек мира (рисуется крупно и уменьшается — без мыла). */
  private worldText(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    const px = 32;
    return this.add
      .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${px}px`, fontStyle: '800', color })
      .setOrigin(0.5)
      .setScale(size / px);
  }

  private fitCamera(): void {
    const cam = this.cameras.main;
    const fit = Math.min(this.scale.width / VIEW_W, this.scale.height / VIEW_H);
    // Ровный масштаб (пиксель рисунка — целое число пикселей), если он рядом; нет — впритык, дробный.
    cam.setZoom(crispZoom(fit, ART, fit * 0.92, fit * 1.04) || fit);
    cam.centerOn(CENTER.x, CENTER.y);
  }

  private applyWeather(): void {
    this.rain?.destroy();
    this.rain = undefined;
    if (!isWetDay(this.weather)) return;
    const storm = this.weather === 'storm';
    this.rain = this.add
      .particles(0, 0, 'raindrop', {
        x: { min: -120, max: 300 },
        y: -40,
        speedY: { min: 240, max: 300 },
        speedX: storm ? -60 : -30,
        scale: 1 / ART,
        lifespan: 1700,
        quantity: this.lite ? 1 : storm ? 4 : 3,
        frequency: this.lite ? 40 : 25,
      })
      .setDepth(940);
  }

  /** Грядки: земля сухая или политая, что растёт и на какой стадии, капля над той, что хочет пить. */
  private refreshBeds(): void {
    this.state.beds.forEach((b, i) => {
      const v = this.beds[i];
      const wet = b.water > 0 || isWetDay(this.weather);
      const stage = b.crop ? stageOf(b.grow) : -1;
      const key = `${b.crop}/${stage}/${wet}`;
      v.drop.setVisible(this.phase === 'day' && thirsty(b, this.weather));
      if (key === v.shown) return;
      v.shown = key;
      v.soil.setTexture(wet ? 'farm_bed_wet' : 'farm_bed');
      for (const p of v.plants) p.destroy();
      v.plants = [];
      if (!b.crop) return;
      const tex = stage === 0 ? 'farm_seed' : `farm_${b.crop}_${stage}`;
      // Морковь и клубника — по два куста на грядке, тыква — одна, но большая.
      const xs = b.crop === 'pumpkin' || stage === 0 ? [0] : [-6, 6];
      for (const dx of xs) {
        const img = this.art(v.x + dx, v.y + 5, tex).setOrigin(0.5, 1).setDepth(v.y + 1);
        v.plants.push(img);
        // Подрос — чуть подпрыгнул; созрело — покачивается, зовёт собрать.
        img.setScale(0.6 / ART);
        this.tweens.add({ targets: img, scale: 1 / ART, duration: 260, ease: 'Back.easeOut' });
        if (stage === 3) this.tweens.add({ targets: img, scaleY: 1.08 / ART, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 280 + dx * 20 });
      }
    });
  }

  /** Полки: сколько чего лежит (картинками, до двух рядов) и число, если больше. */
  private refreshShelves(): void {
    this.state.shelves.forEach((s, i) => {
      const v = this.shelves[i];
      for (const it of v.items) it.destroy();
      v.items = [];
      v.label.setText(s.crop && s.count > 0 ? `${s.count}` : '');
      if (!s.crop || !s.count) return;
      const perRow = s.crop === 'pumpkin' ? 2 : 3;
      const step = s.crop === 'pumpkin' ? 8 : 6;
      const shown = Math.min(s.count, perRow * 2);
      for (let k = 0; k < shown; k++) {
        const row = k < perRow ? 0 : 1;
        const col = k % perRow;
        const x = v.x - ((perRow - 1) * step) / 2 + col * step - 2;
        const y = SHELF_Y - 7 + row * 3;
        v.items.push(this.art(x, y, `farm_item_${s.crop}`).setOrigin(0.5, 1).setDepth(SHELF_Y + 1 + row * 0.1));
      }
    });
  }

  // ---------- день ----------

  private morning(): void {
    this.phase = 'morning';
    this.timeLeft = FARM_DAY_SECONDS;
    this.weather = weatherFor(this.state.day);
    this.applyWeather();
    // Деньги кончились и ничего не растёт — бабушка подкидывает на семена (прототип без банкротства).
    if (stuck(this.state)) {
      this.state = { ...this.state, money: this.state.money + 10 };
      this.hud.say(t('farm.gift', { n: 10 }), 4000);
    }
    saveFarm(this.state);
    this.refreshBeds();
    this.refreshShelves();
    this.hud.action(t('farm.open'), () => this.openDay());
    if (isWetDay(this.weather)) this.hud.say(t('farm.rain'), 4000);
    else if (this.weather === 'heat') this.hud.say(t('farm.heat'), 4000);
    else if (hinted(this.state, 'plant')) this.hud.say(t('farm.morning'), 3000);
  }

  private openDay(): void {
    this.phase = 'day';
    this.hud.action(null);
    this.spawnIn = 3;
    sound.bell(STALL.x);
  }

  private closeDay(): void {
    this.phase = 'evening';
    this.hud.say(t('farm.closing'), 2500);
    // Кто уже стоит у кассы — бабушка рассчитает сама; кто ещё у полок — уходит.
    for (const g of [...this.queue]) if (g.readyAt) this.payGuest(g);
    for (const g of this.guests) if (!g.readyAt) this.leave(g, false);
    track('farm_day', this.state.day, this.state.stats.revenue);
    flushSoon();
    const growing = this.state.beds.filter((b) => b.crop && b.grow < 1).length;
    const day = this.state.day;
    const stats = this.state.stats;
    if (stats.revenue > stats.seeds) pixelFx.burst(this, 'confetti', STALL.x, STALL.y - 30);
    this.time.delayedCall(1600, () =>
      showSummary({
        day,
        stats,
        growing,
        onNext: () => {
          this.state = nextDay(this.state);
          saveFarm(this.state);
          this.morning();
        },
        onStore: () => {
          saveFarm(this.state);
          saveChoice('store');
          location.reload();
        },
      }),
    );
  }

  update(_time: number, deltaMs: number): void {
    const dt = (deltaMs / 1000) * this.speed;
    this.animatePeople();
    const progress = this.phase === 'morning' ? 0 : this.phase === 'evening' ? 1 : 1 - this.timeLeft / FARM_DAY_SECONDS;
    this.hud.update(this.state.day, this.state.money, progress);
    // Час дня: утро — персиковое, к закрытию — золотой час.
    const p = this.phase === 'morning' ? 0.04 : 0.04 + 0.82 * progress;
    this.grade?.apply(p, this.weather, Math.max(0, (p - 0.6) / 0.4));
    this.grade?.update();
    ambience.update(this.weather, Math.max(0, (p - 0.6) / 0.4), false, yearTime(this.state.day));
    this.placeSay();
    if (this.phase !== 'day') {
      this.hints();
      return;
    }
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.state = grow(this.state, dt, this.weather);
    this.refreshBeds();
    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = SAVE_EVERY;
      saveFarm(this.state);
    }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnIn = Phaser.Math.FloatBetween(4.5, 7.5);
      // Покупатели идут, когда в лавке есть что купить.
      if (this.guests.size < MAX_GUESTS && Object.keys(onShelves(this.state)).length) void this.runGuest();
    }
    // Не дождался у кассы — уходит недовольный, товар возвращается на полку.
    for (const g of this.queue) {
      if (g.readyAt && this.time.now - g.readyAt > PATIENCE_MS) {
        this.state = stockShelves({ ...missed(this.state), crate: { ...this.state.crate, [g.crop]: (this.state.crate[g.crop] ?? 0) + g.n } });
        this.refreshShelves();
        this.emote(g.p, 'emo_angry');
        sound.bad();
        this.leave(g, true);
        break;
      }
    }
    this.hints();
    if (this.timeLeft <= 0) this.closeDay();
  }

  // ---------- касания ----------

  private tapBed(i: number): void {
    if (this.phase === 'evening' || this.picking) return;
    const b = this.state.beds[i];
    const v = this.beds[i];
    haptic.tap();
    if (!b.crop) {
      this.picking = pickCrop(this.state.money, (id) => {
        const next = plant(this.state, i, id);
        if (next === this.state) return;
        this.state = markHint(next, 'plant');
        saveFarm(this.state);
        track('farm_plant', this.state.day, cropIndex(id));
        sound.pop(0, v.x);
        this.popup(v.x, v.y - 10, `−${CROPS[id].seed} 💰`, '#fee761');
        this.refreshBeds();
      });
      // Окно закрыли (выбрали или «Не сейчас») — снова можно нажимать грядки.
      const watch = this.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          if (document.querySelector('.ui-modal')) return;
          this.picking = null;
          watch.remove();
        },
      });
      return;
    }
    if (b.grow >= 1) {
      const got = harvest(this.state, i);
      if (!got.crop) return;
      this.state = markHint(got.state, 'harvest');
      saveFarm(this.state);
      track('farm_harvest', this.state.day, cropIndex(got.crop));
      sound.good();
      this.popup(v.x, v.y - 12, `+${got.n} ${cropName(got.crop)}`, '#ffffff');
      if (got.crop === 'pumpkin') pixelFx.burst(this, 'sunburst', v.x, v.y - 6, { zoom: 1 });
      this.flyToShelves(v.x, v.y - 4, got.crop, got.n);
      this.refreshBeds();
      return;
    }
    // Растёт: сухо — полить; полито — сколько ещё ждать.
    if (thirsty(b, this.weather) || (b.water < 8 && !isWetDay(this.weather))) {
      this.state = markHint(water(this.state, i, this.weather), 'water');
      this.splash(v.x, v.y);
      this.refreshBeds();
      return;
    }
    const left = Math.ceil(((1 - b.grow) * CROPS[b.crop].grow) / (b.water > 0 || isWetDay(this.weather) ? 1 : 0.3));
    this.popup(v.x, v.y - 12, t('farm.wait', { n: left }), '#c0cbdc');
  }

  /** Полив: лейка наклоняется над грядкой, капли падают на землю. */
  private splash(x: number, y: number): void {
    sound.pop(1, x);
    const can = this.art(x + 8, y - 12, 'farm_can').setDepth(1000);
    this.tweens.add({ targets: can, angle: -35, duration: 160, yoyo: true, hold: 360, onComplete: () => can.destroy() });
    for (let k = 0; k < (this.lite ? 3 : 7); k++) {
      const d = this.art(x + Phaser.Math.Between(-9, 7), y - 10, 'raindrop').setDepth(999);
      this.tweens.add({ targets: d, y: y + Phaser.Math.Between(-3, 3), alpha: 0.3, duration: 260, delay: 120 + k * 40, onComplete: () => d.destroy() });
    }
  }

  /** Урожай летит с грядки на полки лавки. */
  private flyToShelves(x: number, y: number, crop: CropId, n: number): void {
    const target = this.shelves[Math.max(0, this.state.shelves.findIndex((s) => s.crop === crop))];
    for (let k = 0; k < Math.min(n, 4); k++) {
      const img = this.art(x, y, `farm_item_${crop}`).setDepth(1001);
      const tx = (target?.x ?? STALL.x) + Phaser.Math.Between(-6, 6);
      this.tweens.add({
        targets: img,
        x: tx,
        duration: 650,
        delay: k * 90,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          img.destroy();
          if (k === 0) {
            this.refreshShelves();
            sound.pop(2, tx);
          }
        },
      });
      this.tweens.add({ targets: img, y: { from: y, to: SHELF_Y - 8 }, duration: 650, delay: k * 90, ease: (v: number) => v * v - 0.9 * Math.sin(v * Math.PI) });
    }
    if (!target) this.refreshShelves();
  }

  /** Касса: рассчитать первого, кто стоит у неё. */
  private serve(): void {
    const g = this.queue.find((q) => q.readyAt && !q.gone);
    if (!g) return;
    haptic.tap();
    this.state = markHint(this.state, 'till');
    this.payGuest(g);
  }

  private payGuest(g: Guest): void {
    const paid = pay(this.state, g.crop, g.n);
    this.state = paid.state;
    saveFarm(this.state);
    sound.till(TILL.x, paid.coins);
    this.popup(TILL.x, TILL.y - 16, `+${paid.coins} 💰`, '#fee761');
    pixelFx.burst(this, 'coinpop', TILL.x, TILL.y - 8, { zoom: 1 });
    persons.setMood(this, g.p, 'happy', 1500);
    this.leave(g, true);
  }

  // ---------- покупатели ----------

  private async runGuest(): Promise<void> {
    const left = Math.random() < 0.5;
    const startX = left ? -14 : VIEW_W + 14;
    const p = persons.makePerson(this, startX, ROAD_Y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
    // Хочет то, что лежит в лавке (чаще всего), или то, чего нет, — так видно, чего не хватает.
    const have = onShelves(this.state);
    let w = wish(Math.random);
    for (let k = 0; k < 4 && !have[w.crop] && Math.random() < 0.8; k++) w = wish(Math.random);
    const g: Guest = { p, crop: w.crop, n: 0, readyAt: 0, gone: false };
    this.guests.add(g);
    const shelfIndex = this.state.shelves.findIndex((s) => s.crop === w.crop);
    const sx = shelfIndex >= 0 ? SHELF_XS[shelfIndex] : Phaser.Utils.Array.GetRandom(SHELF_XS);
    await this.walk(p, sx + Phaser.Math.Between(-3, 3), ROAD_Y);
    if (g.gone) return;
    await this.walk(p, p.x, SHOP_Y);
    if (g.gone) return;
    persons.setFacing(p, 'up');
    await this.pause(700);
    if (g.gone || this.phase !== 'day') return this.leave(g, false);
    const took = takeFromShelves(this.state, w.crop, w.qty);
    if (!took.n) {
      // Нужного нет: озадачился и ушёл.
      this.state = missed(this.state);
      this.emote(p, 'emo_question');
      await this.pause(900);
      return this.leave(g, false);
    }
    this.state = took.state;
    g.n = took.n;
    this.refreshShelves();
    sound.pop(0, sx);
    const bag = this.art(5, 2, `farm_item_${w.crop}`);
    p.add(bag);
    this.queue.push(g);
    await this.toQueue(g);
  }

  private queueSpot(i: number): { x: number; y: number } {
    return { x: TILL.x + i * 10, y: SHOP_Y + 1 + i * 3 };
  }

  private async toQueue(g: Guest): Promise<void> {
    const i = this.queue.indexOf(g);
    if (i < 0 || g.gone) return;
    const spot = this.queueSpot(i);
    await this.walk(g.p, spot.x, spot.y);
    if (g.gone) return;
    persons.setFacing(g.p, i === 0 ? 'up' : 'left');
    if (this.queue.indexOf(g) === 0 && !g.readyAt) g.readyAt = this.time.now;
  }

  private leave(g: Guest, fromQueue: boolean): void {
    if (g.gone) return;
    g.gone = true;
    const qi = this.queue.indexOf(g);
    if (qi >= 0) this.queue.splice(qi, 1);
    // Очередь подвигается.
    if (fromQueue) for (const q of this.queue) void this.toQueue(q);
    const p = g.p;
    this.tweens.killTweensOf(p);
    p.setData('walking', false);
    const exitX = p.x < CENTER.x ? -16 : VIEW_W + 16;
    void this.walk(p, p.x, ROAD_Y)
      .then(() => this.walk(p, exitX, ROAD_Y + Phaser.Math.Between(-2, 3)))
      .then(() => {
        this.guests.delete(g);
        p.destroy();
      });
  }

  // ---------- люди ----------

  private walk(p: Phaser.GameObjects.Container, x: number, y: number, speed = CUSTOMER_SPEED * 0.9): Promise<void> {
    return new Promise((done) => {
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist < 0.5 || !p.active) return done();
      persons.setFacing(p, facingAlong(x - p.x, y - p.y, p.getData('facing') as Facing));
      p.setData('walking', true);
      this.tweens.add({
        targets: p,
        x,
        y,
        duration: (dist / speed) * 1000,
        onUpdate: () => p.setDepth(p.y),
        onComplete: () => {
          p.setData('walking', false);
          done();
        },
        onStop: () => done(),
      });
    });
  }

  private pause(ms: number): Promise<void> {
    return new Promise((done) => this.time.delayedCall(ms, done));
  }

  /** Шаг: кадры ног и рук по пройденному пути (как motion.animatePeople, только самое нужное). */
  private animatePeople(): void {
    for (const p of this.people) {
      if (!p.active) continue;
      const last = (p.getData('last') as { x: number; y: number } | undefined) ?? { x: p.x, y: p.y };
      const moved = Math.hypot(p.x - last.x, p.y - last.y);
      p.setData('last', { x: p.x, y: p.y });
      const legs = p.getData('legs') as Phaser.GameObjects.Image | undefined;
      if (!legs) continue;
      const facing = (p.getData('facing') as Facing | undefined) ?? 'down';
      const suffix = VIEW_SUFFIX[facing];
      let key = `p_legs0${suffix}`;
      let flip = facing === 'left';
      if (p.getData('walking')) {
        const phase = (((p.getData('stepPhase') as number | undefined) ?? 0) + moved / 3.8) % 4;
        p.setData('stepPhase', phase);
        const frame = Math.floor(phase);
        if (frame === 1) key = `p_legs1${suffix}`;
        if (frame === 3) {
          if (suffix === '_s') key = 'p_legs2_s';
          else {
            key = `p_legs1${suffix}`;
            flip = !flip;
          }
        }
        legs.y = frame % 2 === 0 ? -0.5 : 0;
      } else legs.y = 0;
      legs.setTexture(key).setFlipX(flip);
    }
  }

  private emote(p: Phaser.GameObjects.Container, key: 'emo_question' | 'emo_angry'): void {
    const icon = this.art(p.x, p.y - 20, key).setDepth(1002);
    this.tweens.add({ targets: icon, y: p.y - 24, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(1200, () => icon.destroy());
  }

  /** Всплывающая надпись над точкой мира: поднимается и тает. «💰» — монеткой из атласа, а не эмодзи шрифта. */
  popup(x: number, y: number, text: string, color: string): void {
    const coin = text.includes('💰');
    const label = this.worldText(0, 0, text.replace(/\s*💰/u, ''), 6, color);
    label.setStroke('#181425', 7);
    const parts: Phaser.GameObjects.GameObject[] = [label];
    if (coin) {
      const w = label.displayWidth;
      label.setX(-3);
      parts.push(this.art(w / 2, 0, 'coin'));
    }
    const box = this.add.container(x, y, parts).setDepth(1005);
    this.tweens.add({ targets: box, y: y - 10, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => box.destroy() });
  }

  // ---------- бабушка ----------

  /** Подсказки бабушки первых минут: посадить → полить → собрать → касса (каждая — один раз). */
  private hints(): void {
    const s = this.state;
    const want = (h: FarmHint): boolean => !hinted(s, h);
    let line: FarmHint | null = null;
    if (want('plant') && s.beds.every((b) => !b.crop) && this.phase === 'morning') line = 'plant';
    else if (this.phase === 'day' && want('till') && this.queue.some((g) => g.readyAt)) line = 'till';
    else if (this.phase === 'day' && want('harvest') && s.beds.some((b) => b.crop && b.grow >= 1)) line = 'harvest';
    else if (this.phase === 'day' && want('water') && s.beds.some((b) => thirsty(b, this.weather))) line = 'water';
    if (!line) {
      if (this.say.visible && this.say.line?.startsWith('farm.')) this.say.hide();
      return;
    }
    const id = `farm.${line}`;
    if (this.say.line === id) return;
    this.say.show({ id, text: t(`farm.hint.${line}`), mood: line === 'harvest' ? 'happy' : undefined, hold: 0 });
  }

  private placeSay(): void {
    if (!this.say.visible) return;
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const k = rect.width / this.scale.width;
    const x = rect.left + (this.granny.x - cam.worldView.x) * cam.zoom * k;
    const y = rect.top + (this.granny.y - 22 - cam.worldView.y) * cam.zoom * k;
    this.say.place(x, y);
  }
}
