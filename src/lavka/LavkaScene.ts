// «Лавка «Своё»» — играбельный день второй игры (docs/farm/LAVKA.md). Главное — работа на ферме, касаниями:
// подоить корову (и подложить сено), собрать яйца (и подсыпать зерна), посадить, полить и собрать грядку, снять
// мёд, яблоки, помидоры, поставить сыр. Над тем, что ждёт рук, — облачко со значком. Собранное летит в лавку:
// сначала в заказы дня, остальное на склад, а лавка продаёт сама — папа за прилавком, покупатели с трассы,
// автобуса и электрички. Правила и цифры — game/lavka/day.ts; картинки и раскладка — art/lavka.py (layout.json).
// Из движка «Магазинчика» — люди и походка (persons), эффекты (pixelFx), цвет часа (ColorGrade), звук.
// Тряски камеры нет; в лёгкой графике — без прохода цвета и с редким дымом.

import Phaser from 'phaser';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { ambience } from '../platform/ambience';
import { setListener } from '../platform/mixer';
import { quality } from '../platform/quality';
import { haptic } from '../platform/telegram';
import { png } from '../platform/assets';
import { saveChoice } from '../game/farm/save';
import {
  BEDS,
  CHEESE_MILK,
  CHEESE_TIME,
  COWS,
  DAY_SECONDS,
  EGGS_MAX,
  PRICE,
  bedAction,
  buy,
  feedGrain,
  feedHay,
  isOver,
  milk,
  pickEgg,
  pickGreenhouse,
  planFor,
  shakeTree,
  startCheese,
  startDay,
  summary,
  takeHoney,
  tapBed,
  tick,
  visitors,
  type Day,
  type From,
  type Good,
  type Plan,
  type Visitor,
} from '../game/lavka/day';
import { UI_FONT } from '../ui/dom';
import { ART, CUSTOMER_SPEED, SHIRTS, VIEW_SUFFIX, customerLook, type Look } from '../scenes/common';
import { facingAlong, type Facing } from '../scenes/stride';
import { crispZoom } from '../scenes/pixels';
import { ColorGrade } from '../scenes/grade';
import * as persons from '../scenes/persons';
import * as pixelFx from '../scenes/pixelFx';
import { GOOD_ICON, LavkaHud, dowName, goodName, morningSheet, showSummary } from './lavkaUi';
import layout from './layout.json';

/** Мир в точках (рисунок 512×940 пикселей, ART = 2; над ним ещё поле, layout.top). Полосы — как в art/lavka.py:
 *  ферма 0…262, лавка 262…380 (три узкие комнаты, справа — место под расширение), площадка и дорога 380…470. */
const WORLD_W = 256;
const WORLD_H = 470;
/** Ноги человечка ниже середины его картинки (тень у makePerson — на 8,5). */
const FOOT = 8;

const DOOR_IN = { x: 131, y: 370 };
const DOOR_OUT = { x: 131, y: 388 };
const PLAZA = { x: 131, y: 398 };
const STREET_Y = 404;
/** У какой полки покупатель выбирает свой товар (ноги); сыр и яйца — сразу у прилавка. */
const SPOTS: Record<Good, { x: number; y: number }> = {
  milk: { x: 115, y: 322 },
  honey: { x: 152, y: 322 },
  eggs: { x: 152, y: 356 },
  veg: { x: 108, y: 370 },
  cheese: { x: 152, y: 356 },
};
const QUEUE = [
  { x: 152, y: 357 },
  { x: 163, y: 363 },
  { x: 143, y: 367 },
  { x: 165, y: 371 },
];
const MILK_SHELF = { x: 115, y: 314 };
const CASE = { x: 70, y: 372 };
const COUNTER = { x: 152, y: 348 };
const VAT = { x: 54, y: 350 };
/** Куда летит собранное: задняя дверь лавки. */
const BACK_DOOR = { x: 130, y: 266 };
const CHEESE_ROOM = { x: 40, y: 266, w: 48, h: 109 };
/** Место под расширение зала (справа от лавки). */
const EXPAND = { x: 223, y: 269, w: 31, h: 106 };
const BUS_STOP = { x: 44, y: 431 };
/** Ферма (точки мира): загон, выгул кур, пруд, трактор, кормушки, ульи, деревья, теплица, грядки. */
const PADDOCK = { x0: 162, x1: 236, y0: 100, y1: 162 };
const RUN = { x0: 52, x1: 114, y0: 156, y1: 202 };
const POND = { x0: 174, x1: 204, y0: 200, y1: 212 };
const TRACTOR = { x: 168, y: 260 };
const TROUGH = { x: 200, y: 166 };
const HAY = { x: 244, y: 115 };
const FEEDER = { x: 80, y: 185 };
const HIVES = [
  { x: 86, y: 119 },
  { x: 99, y: 122 },
  { x: 112, y: 119 },
];
const TREES = [
  { x: 235, y: 205 },
  { x: 150, y: 235 },
];
const GREENHOUSE = { x: 40, y: 124, w: 56, h: 36 };
const BED_X = [4, 45, 86];
const BED_Y = [6, 30, 54];
const BED_W = 38;
const BED_H = 18;
const CROPS = ['cabbage', 'carrot', 'tomato', 'strawberry', 'potato', 'pumpkin', 'dill', 'cabbage', 'strawberry'];
const EGG_SPOTS = [
  { x: 58, y: 165 },
  { x: 74, y: 161 },
  { x: 93, y: 167 },
  { x: 109, y: 162 },
  { x: 62, y: 185 },
  { x: 92, y: 192 },
  { x: 104, y: 182 },
  { x: 111, y: 199 },
];
/** Папа рассчитывает очередь сам — раз в столько мс. */
const SERVE_MS = 1300;
const MAX_INSIDE = 9;

const CARRY: Record<Good, string> = { milk: 'item_milk', eggs: 'lavka_egg', veg: 'item_apples', honey: 'lavka_ico_honey', cheese: 'lavka_wheel' };

interface Guest {
  p: Phaser.GameObjects.Container;
  v: Visitor;
  readyAt: number;
  gone: boolean;
  home: { x: number; y: number };
}

interface Npc {
  p: Phaser.GameObjects.Container;
  say?: TextKey;
  turns?: Facing[];
}

/** Облачко-значок над работой: видно, когда есть что делать. */
interface Callout {
  box: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
}

export class LavkaScene extends Phaser.Scene {
  lite = quality() === 'lite';
  speed = 1;
  people = new Set<Phaser.GameObjects.Container>();
  private hud!: LavkaHud;
  private grade?: ColorGrade;
  private phase: 'morning' | 'day' | 'evening' = 'morning';
  private dayIndex = 0;
  private plan: Plan = planFor(0);
  private day: Day = startDay(planFor(0));
  private queueList: Visitor[] = [];
  private guests = new Set<Guest>();
  private queue: Guest[] = [];
  private npcs: Npc[] = [];
  private milkItems: Phaser.GameObjects.Image[] = [];
  private caseItems: Phaser.GameObjects.Image[] = [];
  private father!: Phaser.GameObjects.Container;
  private cheesemaker!: Phaser.GameObjects.Container;
  private vatBar!: Phaser.GameObjects.Rectangle;
  private vatBack!: Phaser.GameObjects.Rectangle;
  private bus?: Phaser.GameObjects.Image;
  private cows: Phaser.GameObjects.Image[] = [];
  private cowCalls: Callout[] = [];
  private eggImgs: Phaser.GameObjects.Image[] = [];
  private bedCrop: Phaser.GameObjects.Image[] = [];
  private bedWet: Phaser.GameObjects.Image[] = [];
  private bedCalls: Callout[] = [];
  private bedShown: string[] = [];
  private hiveCalls: Callout[] = [];
  private treeCalls: Callout[] = [];
  private treeImgs: Phaser.GameObjects.Image[] = [];
  private houseCall!: Callout;
  private hayCall!: Callout;
  private grainCall!: Callout;
  private cheeseCall!: Callout;
  private hinted = new Set<string>();
  private seen = { bus: false, trains: 0 };
  private closeMorning: (() => void) | null = null;
  private drag = { down: false, y: 0, scroll: 0, moved: false };
  private nextCar = 2;
  private nextChat = 6;
  private nextPuff = 0;
  private nextServe = 0;
  private visible = 0;

  constructor() {
    super('farm');
  }

  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  /** Свои картинки (не из общего атласа, art/lavka.py) — один раз за игру. */
  preload(): void {
    for (const key of layout.keys) if (!this.textures.exists(key)) this.load.image(key, png(key));
  }

  create(): void {
    if (!this.lite) void pixelFx.loadSheets(this);
    setListener(() => {
      const v = this.cameras.main.worldView;
      return { left: v.x, width: v.width };
    });
    this.buildWorld();
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.hud = new LavkaHud();
    if (!this.lite) {
      this.grade = new ColorGrade(this, quality());
      this.grade.attach(950);
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.drag = { down: true, y: p.y, scroll: this.cameras.main.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag.down) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 8) this.drag.moved = true;
      if (this.drag.moved) this.cameras.main.scrollY = this.drag.scroll - dy / this.cameras.main.zoom;
    });
    this.input.on('pointerup', () => (this.drag.down = false));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      this.hud.destroy();
      this.closeMorning?.();
    });
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { lavka: this });
    this.morning();
  }

  // ---------- мир ----------

  private buildWorld(): void {
    this.cameras.main.setBackgroundColor('#3e8948');
    this.add.image(0, -layout.top, 'lavka_ground').setOrigin(0).setScale(1 / ART).setDepth(-100);
    for (const p of layout.props as { k: string; x: number; y: number; z?: number; tint?: number; flip?: boolean }[]) {
      const img = this.art(p.x, p.y, p.k).setOrigin(0.5, 1).setDepth(p.z ?? p.y);
      if (p.tint !== undefined) img.setTint(p.tint);
      if (p.flip) img.setFlipX(true);
      if (p.k === 'lavka_tree_apples' && p.y < 300) this.treeImgs[0] = img;
      if (p.k === 'lavka_tree_round_apples' && p.y < 300) this.treeImgs[1] = img;
    }
    this.worldText(131, 374, t('lavka.sign'), 3.8, '#fee761').setDepth(381).setStroke('#181425', 6);
    this.plaque(64, 270, t('lavka.room.cheese'));
    this.plaque(132, 270, t('lavka.room.shop'));
    this.plaque(196, 270, t('lavka.room.bakery'));
    this.plaque(EXPAND.x + EXPAND.w / 2, EXPAND.y + 18, t('lavka.expand'), 0x5a6988);
    this.zone(EXPAND.x, EXPAND.y, EXPAND.w, EXPAND.h, () => this.popup(EXPAND.x + EXPAND.w / 2, EXPAND.y + 40, t('lavka.expandSoon'), '#fee761'));
    this.art(MILK_SHELF.x, MILK_SHELF.y, 'shelf').setOrigin(0.5, 1).setDepth(MILK_SHELF.y);
    this.art(MILK_SHELF.x, MILK_SHELF.y, 'shelf_front').setOrigin(0.5, 1).setDepth(MILK_SHELF.y + 0.2);
    // Витрина с готовым сыром — в сыроварне у окна.
    this.art(CASE.x, CASE.y, 'lavka_case').setOrigin(0.5, 1).setDepth(CASE.y);
    this.vatBack = this.add.rectangle(VAT.x, VAT.y - 7, 22, 3, 0x262b44).setDepth(990).setStrokeStyle(0.5, 0x181425);
    this.vatBar = this.add.rectangle(VAT.x - 11, VAT.y - 7, 0, 3, 0xfee761).setOrigin(0, 0.5).setDepth(991);
    this.animals();
    this.farm();
    this.staff();
    this.refreshStock();
  }

  /** Надпись в мире: шрифт игры, высота size точек мира (рисуется крупно и уменьшается — без мыла). */
  private worldText(x: number, y: number, text: string, size: number, color: string): Phaser.GameObjects.Text {
    const px = 32;
    return this.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${px}px`, fontStyle: '900', color }).setOrigin(0.5).setScale(size / px);
  }

  private plaque(x: number, y: number, text: string, bg = 0x3b2a35): void {
    const label = this.worldText(x, y, text, 4, '#f6e7c8').setDepth(640);
    const w = label.displayWidth + 6;
    this.add.rectangle(x, y + 0.2, w, 7, bg).setStrokeStyle(0.8, 0x8f563b).setDepth(639);
  }

  private fitCamera(): void {
    const cam = this.cameras.main;
    const fit = this.scale.width / WORLD_W;
    cam.setZoom(crispZoom(fit, ART, fit * 0.9, fit * 1.04) || fit);
    cam.setBounds(0, -layout.top, WORLD_W, WORLD_H + layout.top);
    this.visible = this.scale.height / cam.zoom;
    // Главное — ферма: на коротком экране видна она и лавка под ней, остальное — пальцем.
    cam.centerOn(WORLD_W / 2, this.visible >= WORLD_H + layout.top ? (WORLD_H - layout.top) / 2 : -layout.top + this.visible / 2);
  }

  // ---------- ферма: что нажимается ----------

  /** Облачко со значком над точкой мира; держится и покачивается, видно — когда есть работа. */
  private callout(x: number, y: number, icon: string, onTap?: () => void): Callout {
    const back = this.add.image(0, 0, 'bubble').setScale(1.5 / ART);
    const img = this.add.image(0, -0.5, icon).setScale(1.15 / ART);
    const box = this.add.container(x, y, [back, img]).setDepth(1003).setVisible(false);
    this.tweens.add({ targets: box, y: y - 1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (onTap) {
      box.setSize(14, 14).setInteractive({ useHandCursor: true });
      box.on('pointerup', () => !this.drag.moved && onTap());
    }
    return { box, icon: img };
  }

  private zone(x: number, y: number, w: number, h: number, fn: () => void): void {
    this.add.zone(x, y, w, h).setOrigin(0).setDepth(5).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.drag.moved) return;
      fn();
    });
  }

  private farm(): void {
    // Грядки: растения поверх пустого короба, влажная земля, облачко «полить»/«посадить».
    for (let i = 0; i < BEDS; i++) {
      const x = BED_X[i % 3];
      const y = BED_Y[Math.floor(i / 3)];
      this.bedWet[i] = this.art(x, y, 'lavka_bed_wet').setOrigin(0).setDepth(y - 30).setVisible(false);
      this.bedCrop[i] = this.art(x, y - 3, `lavka_crop_${CROPS[i]}1`).setOrigin(0).setDepth(y + BED_H - 1).setVisible(false);
      this.bedCalls[i] = this.callout(x + BED_W / 2, y + 2, 'lavka_ico_drop', () => this.tapBedAt(i));
      this.zone(x, y, BED_W, BED_H, () => this.tapBedAt(i));
    }
    // Яйца в выгуле.
    this.eggImgs = EGG_SPOTS.slice(0, EGGS_MAX).map((s, i) => {
      const egg = this.art(s.x, s.y, 'lavka_egg').setOrigin(0.5, 1).setDepth(s.y).setVisible(false);
      egg.setInteractive(new Phaser.Geom.Rectangle(-5, -5, 17, 18), Phaser.Geom.Rectangle.Contains);
      egg.on('pointerup', () => !this.drag.moved && this.collectEgg(i));
      return egg;
    });
    // Кормушки, ульи, деревья, теплица, сыроварня.
    this.hayCall = this.callout(TROUGH.x, TROUGH.y - 12, 'lavka_ico_hayicon', () => this.hay());
    this.zone(HAY.x - 11, HAY.y - 17, 22, 19, () => this.hay());
    this.zone(TROUGH.x - 11, TROUGH.y - 8, 22, 9, () => this.hay());
    this.grainCall = this.callout(FEEDER.x, FEEDER.y - 10, 'lavka_ico_grain', () => this.grain());
    this.zone(FEEDER.x - 8, FEEDER.y - 7, 16, 9, () => this.grain());
    HIVES.forEach((h, i) => {
      this.hiveCalls[i] = this.callout(h.x, h.y - 16, 'lavka_ico_honey', () => this.honey(i));
      this.zone(h.x - 6, h.y - 11, 12, 12, () => this.honey(i));
    });
    TREES.forEach((tr, i) => {
      this.treeCalls[i] = this.callout(tr.x, tr.y - 30, 'lavka_ico_apple', () => this.apples(i));
      this.zone(tr.x - 13, tr.y - 28, 26, 28, () => this.apples(i));
    });
    this.houseCall = this.callout(GREENHOUSE.x, GREENHOUSE.y - GREENHOUSE.h - 2, 'lavka_ico_tomato', () => this.tomatoes());
    this.zone(GREENHOUSE.x - GREENHOUSE.w / 2, GREENHOUSE.y - GREENHOUSE.h, GREENHOUSE.w, GREENHOUSE.h, () => this.tomatoes());
    this.cheeseCall = this.callout(VAT.x, VAT.y - 20, 'lavka_wheel', () => this.cheese());
    this.zone(CHEESE_ROOM.x, CHEESE_ROOM.y, CHEESE_ROOM.w, CHEESE_ROOM.h, () => this.cheese());
  }

  /** Собрал — товар летит к задней двери лавки, над местом — «+N». */
  private gather(g: Good, n: number, from: { x: number; y: number }): void {
    haptic.tap();
    sound.pop(Math.min(3, n), from.x);
    this.popup(from.x, from.y - 10, `+${n}`, '#ffffff');
    pixelFx.burst(this, 'star', from.x, from.y - 4, { zoom: 1 });
    for (let k = 0; k < Math.min(n, 4); k++) {
      const img = this.art(from.x, from.y - 4, GOOD_ICON[g]).setDepth(1001);
      const tx = BACK_DOOR.x + Phaser.Math.Between(-4, 4);
      this.tweens.add({ targets: img, x: tx, duration: 700, delay: k * 80, ease: 'Sine.easeInOut', onComplete: () => img.destroy() });
      this.tweens.add({ targets: img, y: { from: from.y - 4, to: BACK_DOOR.y }, duration: 700, delay: k * 80, ease: (v: number) => v - 0.8 * Math.sin(v * Math.PI) });
    }
    this.time.delayedCall(720, () => this.refreshStock());
  }

  private nothing(x: number, y: number, key: TextKey = 'lavka.notReady'): void {
    this.popup(x, y, t(key), '#c0cbdc');
  }

  private milkCow(i: number): void {
    if (this.phase !== 'day') return;
    const cow = this.cows[i];
    const r = milk(this.day, i);
    if (!r.n) return this.nothing(cow.x, cow.y - 16);
    this.day = r.day;
    this.hinted.add('cow');
    this.tweens.add({ targets: cow, scaleY: { from: 0.9 / ART, to: 1 / ART }, duration: 260, ease: 'Back.easeOut' });
    this.gather('milk', r.n, { x: cow.x, y: cow.y - 6 });
  }

  private hay(): void {
    if (this.phase !== 'day') return;
    const r = feedHay(this.day);
    if (!r.n) return this.nothing(TROUGH.x, TROUGH.y - 14);
    this.day = r.day;
    this.hinted.add('hay');
    haptic.tap();
    sound.pop(2, TROUGH.x);
    this.fly('lavka_ico_hayicon', HAY, TROUGH, 3);
    this.popup(TROUGH.x, TROUGH.y - 14, '🌾', '#fee761');
  }

  private collectEgg(spot: number): void {
    if (this.phase !== 'day') return;
    const r = pickEgg(this.day, spot);
    if (!r.n) return;
    this.day = r.day;
    this.hinted.add('egg');
    this.eggImgs[spot].setVisible(false);
    this.gather('eggs', 1, EGG_SPOTS[spot]);
  }

  private grain(): void {
    if (this.phase !== 'day') return;
    const r = feedGrain(this.day);
    if (!r.n) return this.nothing(FEEDER.x, FEEDER.y - 12);
    this.day = r.day;
    this.hinted.add('grain');
    haptic.tap();
    sound.pop(1, FEEDER.x);
    this.fly('lavka_ico_grain', { x: FEEDER.x - 16, y: FEEDER.y - 20 }, FEEDER, 2);
  }

  private tapBedAt(i: number): void {
    if (this.phase !== 'day') return;
    const x = BED_X[i % 3] + BED_W / 2;
    const y = BED_Y[Math.floor(i / 3)] + BED_H / 2;
    const r = tapBed(this.day, i);
    this.day = r.day;
    this.hinted.add('bed');
    if (r.did === 'harvest') return this.gather('veg', r.n, { x, y });
    haptic.tap();
    if (r.did === 'plant') {
      sound.pop(0, x);
      this.popup(x, y - 6, '🌱', '#98c95a');
    } else if (r.did === 'water') {
      sound.pop(1, x);
      for (let k = 0; k < (this.lite ? 4 : 10); k++) {
        const d = this.art(x + Phaser.Math.Between(-16, 16), y - 12, 'raindrop').setDepth(1000);
        this.tweens.add({ targets: d, y: y + Phaser.Math.Between(-4, 6), alpha: 0.3, duration: 300, delay: k * 35, onComplete: () => d.destroy() });
      }
    } else this.nothing(x, y - 8, 'lavka.growing');
  }

  private honey(i: number): void {
    if (this.phase !== 'day') return;
    const r = takeHoney(this.day, i);
    if (!r.n) return this.nothing(HIVES[i].x, HIVES[i].y - 14);
    this.day = r.day;
    this.gather('honey', r.n, { x: HIVES[i].x, y: HIVES[i].y - 6 });
  }

  private apples(i: number): void {
    if (this.phase !== 'day') return;
    const tr = TREES[i];
    const r = shakeTree(this.day, i);
    if (!r.n) return this.nothing(tr.x, tr.y - 30);
    this.day = r.day;
    const img = this.treeImgs[i];
    if (img) this.tweens.add({ targets: img, angle: { from: -4, to: 0 }, duration: 380, ease: 'Elastic.easeOut' });
    this.gather('veg', r.n, { x: tr.x, y: tr.y - 12 });
  }

  private tomatoes(): void {
    if (this.phase !== 'day') return;
    const r = pickGreenhouse(this.day);
    if (!r.n) return this.nothing(GREENHOUSE.x, GREENHOUSE.y - GREENHOUSE.h);
    this.day = r.day;
    this.gather('veg', r.n, { x: GREENHOUSE.x, y: GREENHOUSE.y - 10 });
  }

  private cheese(): void {
    if (this.phase !== 'day') return;
    const r = startCheese(this.day);
    if (!r.n) return this.nothing(VAT.x, VAT.y - 24, this.day.cheese > 0 ? 'lavka.cheeseBusy' : 'lavka.noMilkCheese');
    this.day = r.day;
    this.hinted.add('cheese');
    haptic.tap();
    sound.good();
    this.fly('item_milk', BACK_DOOR, VAT, CHEESE_MILK);
    this.refreshStock();
  }

  /** Предмет летит дугой из from в to (по одному с задержкой). */
  private fly(key: string, from: { x: number; y: number }, to: { x: number; y: number }, n: number): void {
    for (let k = 0; k < n; k++) {
      const img = this.art(from.x, from.y, key).setDepth(1001);
      this.tweens.add({ targets: img, x: to.x + Phaser.Math.Between(-3, 3), duration: 550, delay: k * 90, ease: 'Sine.easeInOut', onComplete: () => img.destroy() });
      this.tweens.add({ targets: img, y: { from: from.y, to: to.y }, duration: 550, delay: k * 90, ease: (v: number) => v - 0.9 * Math.sin(v * Math.PI) });
    }
  }

  /** Ферма показывает своё состояние: значки над готовым, растения по стадиям, яйца, полив. */
  private showFarm(): void {
    const d = this.day;
    const day = this.phase === 'day';
    this.cows.forEach((cow, i) => {
      const c = this.cowCalls[i];
      c.box.setVisible(day && d.cows[i] >= 1);
      c.box.x = cow.x;
      c.box.setData('baseY', cow.y - 22);
      if (c.box.visible && Math.abs(c.box.y - (cow.y - 22)) > 3) c.box.y = cow.y - 22;
    });
    this.hayCall.box.setVisible(day && d.hay <= 1);
    this.grainCall.box.setVisible(day && d.grain <= 1);
    this.eggImgs.forEach((egg, i) => egg.setVisible(d.eggs.includes(i)));
    d.hives.forEach((h, i) => this.hiveCalls[i].box.setVisible(day && h >= 1));
    d.trees.forEach((h, i) => this.treeCalls[i].box.setVisible(day && h >= 1));
    this.houseCall.box.setVisible(day && d.house >= 1);
    this.cheeseCall.box.setVisible(day && d.cheese === 0 && d.stock.milk >= CHEESE_MILK + 2);
    d.beds.forEach((b, i) => {
      const action = bedAction(b);
      const stage = !b.planted ? 0 : b.grow >= 1 ? 3 : b.grow >= 0.45 ? 2 : 1;
      const key = `${stage}/${b.water > 0}/${action}`;
      const call = this.bedCalls[i];
      call.box.setVisible(day && (action === 'water' || action === 'plant'));
      if (key === this.bedShown[i]) return;
      this.bedShown[i] = key;
      call.icon.setTexture(action === 'plant' ? 'lavka_ico_seed' : 'lavka_ico_drop');
      this.bedWet[i].setVisible(b.water > 0);
      const crop = this.bedCrop[i];
      this.tweens.killTweensOf(crop);
      crop.setScale(1 / ART).setVisible(stage > 0);
      if (stage > 0) crop.setTexture(`lavka_crop_${CROPS[i]}${stage}`);
      if (stage === 3) this.tweens.add({ targets: crop, scaleY: 1.06 / ART, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 60 });
    });
  }

  // ---------- жизнь вокруг ----------

  private animals(): void {
    // Коровы пасутся по загону: жуют, бредут; полная — облачко с молоком, касание — подоить.
    const cows: [number, number, number][] = [
      [180, 118, 0],
      [216, 130, 1],
      [190, 156, 0],
      [226, 104, 1],
    ];
    cows.slice(0, COWS).forEach(([x, y, v], i) => {
      const cow = this.art(x, y, `lavka_cow${v}0`).setOrigin(0.5, 1).setDepth(y).setFlipX(Math.random() < 0.5);
      cow.setInteractive(new Phaser.Geom.Rectangle(-4, -6, 44, 38), Phaser.Geom.Rectangle.Contains);
      cow.on('pointerup', () => !this.drag.moved && this.milkCow(i));
      this.cows[i] = cow;
      this.cowCalls[i] = this.callout(x, y - 22, 'item_milk', () => this.milkCow(i));
      const chew = (): void => {
        if (!cow.active) return;
        const down = cow.texture.key.endsWith('0');
        cow.setTexture(`lavka_cow${v}${down ? 1 : 0}`);
        // Полная корова стоит и ждёт дойки; сытая бродит; без сена — тянется к пустой поилке.
        if (this.day.cows[i] < 1 && Math.random() < 0.3) {
          const toTrough = this.day.hay <= 0;
          const nx = toTrough ? TROUGH.x + Phaser.Math.Between(-8, 8) : Phaser.Math.Clamp(cow.x + Phaser.Math.Between(-14, 14), PADDOCK.x0, PADDOCK.x1);
          const ny = toTrough ? TROUGH.y - 2 : Phaser.Math.Clamp(cow.y + Phaser.Math.Between(-6, 6), PADDOCK.y0, PADDOCK.y1);
          cow.setFlipX(nx < cow.x);
          this.tweens.add({ targets: cow, x: nx, y: ny, duration: 2200, ease: 'Sine.easeInOut', onUpdate: () => cow.setDepth(cow.y) });
        }
        this.time.delayedCall(Phaser.Math.Between(900, 2600), chew);
      };
      this.time.delayedCall(Phaser.Math.Between(200, 1600), chew);
    });
    const hens: [number, number, number, number, number][] = [
      [RUN.x0, RUN.x1, RUN.y0, RUN.y1, 8],
    ];
    for (const [x0, x1, y0, y1, n] of hens) {
      for (let i = 0; i < n; i++) {
        const v = i % 3;
        const hen = this.art(Phaser.Math.Between(x0, x1), Phaser.Math.Between(y0, y1), `lavka_hen${v}0`).setOrigin(0.5, 1);
        hen.setDepth(hen.y).setFlipX(Math.random() < 0.5);
        const peck = (): void => {
          if (!hen.active) return;
          if (Math.random() < 0.5) {
            hen.setTexture(`lavka_hen${v}1`);
            this.time.delayedCall(260, () => hen.active && hen.setTexture(`lavka_hen${v}0`));
          } else {
            const nx = Phaser.Math.Clamp(hen.x + Phaser.Math.Between(-9, 9), x0, x1);
            const ny = Phaser.Math.Clamp(hen.y + Phaser.Math.Between(-4, 4), y0, y1);
            hen.setFlipX(nx < hen.x);
            this.tweens.add({ targets: hen, x: nx, y: ny, duration: 500, onUpdate: () => hen.setDepth(hen.y) });
          }
          this.time.delayedCall(Phaser.Math.Between(500, 1800), peck);
        };
        this.time.delayedCall(Phaser.Math.Between(0, 1500), peck);
      }
    }
    for (let i = 0; i < 3; i++) {
      const v = i === 1 ? 1 : 0;
      const duck = this.art(Phaser.Math.Between(POND.x0, POND.x1), Phaser.Math.Between(POND.y0, POND.y1), `lavka_duck${v}`).setOrigin(0.5, 1);
      duck.setDepth(duck.y);
      const swim = (): void => {
        if (!duck.active) return;
        const nx = Phaser.Math.Between(POND.x0, POND.x1);
        duck.setFlipX(nx < duck.x);
        this.tweens.add({ targets: duck, x: nx, y: Phaser.Math.Between(POND.y0, POND.y1), duration: Phaser.Math.Between(2600, 4200), ease: 'Sine.easeInOut', onUpdate: () => duck.setDepth(duck.y), onComplete: () => this.time.delayedCall(Phaser.Math.Between(400, 1600), swim) });
      };
      swim();
    }
    for (let i = 0; i < 7; i++) {
      const bee = this.art(Phaser.Math.Between(182, 218), Phaser.Math.Between(66, 80), 'lavka_bee').setDepth(200);
      const buzz = (): void => {
        if (!bee.active) return;
        this.tweens.add({ targets: bee, x: Phaser.Math.Between(178, 222), y: Phaser.Math.Between(62, 84), duration: Phaser.Math.Between(400, 900), ease: 'Sine.easeInOut', onComplete: buzz });
      };
      buzz();
    }
    this.tractorTrip();
  }

  /** Трактор с прицепом: стоит у задней двери, раз в полминуты едет по тропинке в поле и возвращается с урожаем. */
  private tractorTrip(): void {
    const tractor = this.art(TRACTOR.x, TRACTOR.y, 'lavka_tractor').setOrigin(0.5, 1).setDepth(TRACTOR.y);
    const cart = this.art(TRACTOR.x - 27, TRACTOR.y - 1, 'lavka_cart').setOrigin(0.5, 1).setDepth(TRACTOR.y - 1);
    // Едет по тропинке (её середина — x 130): сначала встаёт на неё, потом вверх к полю и обратно.
    const toPath = TRACTOR.x - 27 - 120;
    const rise = TRACTOR.y + 2;
    const go = (): void => {
      if (!tractor.active) return;
      const up = { y: `-=${rise}`, duration: 9000, ease: 'Sine.easeInOut' };
      const sync = (): void => {
        tractor.setDepth(tractor.y);
        cart.setDepth(cart.y);
      };
      this.tweens.add({ targets: [tractor, cart], x: `-=${toPath}`, duration: 1600, ease: 'Sine.easeInOut', onComplete: () =>
        this.tweens.add({ targets: [tractor, cart], ...up, onUpdate: sync, onComplete: () =>
          this.time.delayedCall(4000, () =>
            this.tweens.add({ targets: [tractor, cart], y: `+=${rise}`, duration: 9000, ease: 'Sine.easeInOut', onUpdate: sync, onComplete: () =>
              this.tweens.add({ targets: [tractor, cart], x: `+=${toPath}`, duration: 1600, ease: 'Sine.easeInOut', onComplete: () => this.time.delayedCall(Phaser.Math.Between(18000, 26000), go) }),
            }),
          ),
        }),
      });
    };
    this.time.delayedCall(9000, go);
  }

  /** Пар над чаном, пока зреет сыр. */
  private puffs(dt: number): void {
    this.nextPuff -= dt;
    if (this.nextPuff > 0) return;
    this.nextPuff = this.lite ? 1.4 : 0.6;
    const smoke = (x: number, y: number, rise: number, scale: number): void => {
      const puff = this.art(x, y, 'lavka_puff').setDepth(y + 40).setAlpha(0.85).setScale(scale / ART);
      this.tweens.add({ targets: puff, y: y - rise, x: x + Phaser.Math.Between(2, 6), alpha: 0, scale: (scale * 1.8) / ART, duration: 2200, onComplete: () => puff.destroy() });
    };
    if (this.phase === 'day' && this.day.cheese > 0) smoke(VAT.x + Phaser.Math.Between(-4, 4), VAT.y - 10, 10, 0.6);
  }

  /** Машины на трассе: сверху едут влево, снизу — вправо. */
  private traffic(dt: number): void {
    this.nextCar -= dt;
    if (this.nextCar > 0) return;
    this.nextCar = Phaser.Math.FloatBetween(3, 6.5);
    const right = Math.random() < 0.5;
    const key = Phaser.Utils.Array.GetRandom(['car_sedan', 'car_hatch', 'car_taxi', 'car_van', 'car_truck']) as string;
    const tint = key === 'car_taxi' ? 0xffffff : (Phaser.Utils.Array.GetRandom([0xe43b44, 0x5b6ee1, 0xffffff, 0x3e8948, 0xfee761, 0x8b9bb4]) as number);
    const y = right ? 446 : 430;
    const car = this.art(right ? -40 : WORLD_W + 40, y, key).setOrigin(0.5, 1).setDepth(y).setFlipX(!right).setTint(tint);
    this.tweens.add({ targets: car, x: right ? WORLD_W + 40 : -40, duration: Phaser.Math.Between(4200, 6000), onComplete: () => car.destroy() });
  }

  private staff(): void {
    const npc = (x: number, feet: number, look: Look, facing: Facing, say?: TextKey, turns?: Facing[]): Phaser.GameObjects.Container => {
      const p = persons.makePerson(this, x, feet - FOOT, look);
      persons.setFacing(p, facing);
      p.setDepth(feet);
      this.npcs.push({ p, say, turns });
      return p;
    };
    // Ферма: Митя у трактора, доярка в загоне.
    npc(108, 256, { shirt: 0xffffff, pants: 0x262b44, skin: 0xeec39a, hair: 0xc0cbdc, style: 'bald', outfit: 'overalls', hat: 'flatcap', hatTint: 0x5a6988, face: 'beard' }, 'down', 'lavka.say.mitya', ['down', 'left', 'right']);
    npc(222, 156, { shirt: 0xf6757a, skin: 0xf2d3ab, hair: 0xfeae34, style: 'ponytail', hat: 'headscarf', hatTint: 0xe43b44, acc: 'apron' }, 'left', undefined, ['left', 'right', 'down']);
    // Бабушка — на ферме, у теплицы: подсказывает.
    npc(74, 136, { shirt: 0xb55088, skin: 0xf2d3ab, hair: 0xffffff, style: 'bun', outfit: 'cardigan', outfitTint: 0xc4a8e8, hat: 'headscarf', hatTint: 0xfee761, glasses: true }, 'down', 'lavka.say.granny', ['down', 'left', 'right']);
    // Сыроварня.
    this.cheesemaker = npc(72, 334, { shirt: 0xffffff, pants: 0x262b44, skin: 0xf2d3ab, hair: 0x733e39, style: 'bun', acc: 'apron', hat: 'headscarf', hatTint: 0xffffff }, 'down');
    // Папа за прилавком.
    this.father = npc(COUNTER.x, 336, { shirt: 0x37946e, pants: 0x3a4466, skin: 0xf2d3ab, hair: 0x4a2c1a, style: 'short', acc: 'apron', accTint: 0xe4a672 }, 'down');
    // Пекарня.
    npc(196, 338, { shirt: 0xffffff, skin: 0xeec39a, hair: 0x181425, style: 'short', outfit: 'chefcoat', hat: 'toque', face: 'mustache' }, 'down', 'lavka.say.marat', ['down', 'left']);
    // Валя на лавочке у входа.
    npc(205, 400, { shirt: 0xa22633, skin: 0xf2d3ab, hair: 0xc0cbdc, style: 'curly' }, 'down', 'lavka.say.valya', ['down', 'left']);
  }

  /** Стоят на месте, но живые: изредка поворачиваются и говорят. */
  private idle(dt: number): void {
    for (const n of this.npcs) {
      if (n.turns && Math.random() < dt * 0.25) persons.setFacing(n.p, Phaser.Utils.Array.GetRandom(n.turns) as Facing);
    }
    this.nextChat -= dt;
    if (this.nextChat > 0) return;
    this.nextChat = Phaser.Math.FloatBetween(7, 12);
    const talkers = this.npcs.filter((n) => n.say && n.p !== this.cheesemaker && this.onScreen(n.p.y));
    const n = Phaser.Utils.Array.GetRandom(talkers) as Npc | undefined;
    if (n?.say) this.bubble(n.p, t(n.say));
  }

  private onScreen(y: number): boolean {
    const v = this.cameras.main.worldView;
    return y > v.y + 40 && y < v.bottom - 20;
  }

  /** Облачко с репликой над человеком (2,6 с). */
  private bubble(p: Phaser.GameObjects.Container, text: string): void {
    const label = this.worldText(0, 0, text, 5, '#181425');
    const w = label.displayWidth + 8;
    const box = this.add.graphics();
    box.fillStyle(0xffffff, 1).lineStyle(1, 0x181425, 1);
    box.fillRoundedRect(-w / 2, -6, w, 12, 3).strokeRoundedRect(-w / 2, -6, w, 12, 3);
    box.fillTriangle(-2.5, 5.6, 2.5, 5.6, 0, 9.5).lineBetween(-2.5, 6, 0, 9.5).lineBetween(2.5, 6, 0, 9.5);
    // Не вылезать за край экрана.
    const x = Phaser.Math.Clamp(p.x, w / 2 + 2, WORLD_W - w / 2 - 2);
    const c = this.add.container(x, p.y - 26, [box, label]).setDepth(1004).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, y: p.y - 28, duration: 180 });
    this.time.delayedCall(2600, () => this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() }));
  }

  /** Бутылки на молочной полке и головки на витрине — сколько есть на складе. */
  private refreshStock(): void {
    for (const it of this.milkItems) it.destroy();
    this.milkItems = [];
    const left = MILK_SHELF.x - 20;
    const variants = ['item_milk', 'item_milk_0', 'item_milk_1', 'item_milk_2'];
    for (let k = 0; k < Math.min(6, this.day.stock.milk); k++) {
      const x = left + (8 + k * 11 + 5.5) / ART;
      this.milkItems.push(this.art(x, MILK_SHELF.y - 32 + 15, variants[k % variants.length]).setOrigin(0.5, 1).setDepth(MILK_SHELF.y + 0.1));
    }
    for (const it of this.caseItems) it.destroy();
    this.caseItems = [];
    for (let k = 0; k < Math.min(4, this.day.stock.cheese); k++) {
      const x = CASE.x - 16 + (9 + k * 13) / ART;
      this.caseItems.push(this.art(x, CASE.y - 15 + 5.5, 'lavka_wheel').setOrigin(0.5, 1).setDepth(CASE.y + 0.1));
    }
  }

  // ---------- день ----------

  private morning(): void {
    this.phase = 'morning';
    this.plan = planFor(this.dayIndex);
    this.day = startDay(this.plan);
    this.hinted.clear();
    this.seen = { bus: false, trains: 0 };
    this.bedShown = [];
    this.refreshStock();
    this.updateVat();
    this.closeMorning = morningSheet(this.plan, () => {
      this.closeMorning = null;
      this.openDay();
    });
  }

  private openDay(): void {
    this.phase = 'day';
    this.day = startDay(this.plan);
    this.queueList = visitors(this.plan, this.dayIndex + 1);
    this.refreshStock();
    sound.bell(DOOR_OUT.x);
  }

  private closeDay(): void {
    this.phase = 'evening';
    this.hud.say(t('lavka.hint.closing'), 2500);
    for (const g of [...this.guests]) if (!g.gone) this.leave(g);
    const s = summary(this.day);
    if (s.stars >= 4) pixelFx.burst(this, 'confetti', BACK_DOOR.x, 120);
    const title = t('lavka.sum.title', { dow: dowName(this.plan) });
    const nextDow = dowName(planFor(this.dayIndex + 1));
    this.time.delayedCall(1800, () =>
      showSummary({
        title,
        s,
        nextDow,
        onNext: () => {
          this.dayIndex += 1;
          this.morning();
        },
        onAgain: () => this.morning(),
        onStore: () => {
          saveChoice('store');
          location.reload();
        },
      }),
    );
  }

  update(_time: number, deltaMs: number): void {
    const dt = (deltaMs / 1000) * this.speed;
    this.animatePeople();
    this.idle(dt);
    this.puffs(dt);
    this.traffic(dt);
    const progress = this.phase === 'morning' ? 0 : this.day.t / DAY_SECONDS;
    this.hud.update({
      dow: t(`lavka.dowShort.${this.plan.dow}` as TextKey),
      coins: this.day.coins,
      t: this.day.t,
      progress,
      stock: this.day.stock,
      orders: this.day.orders,
    });
    const p = 0.04 + 0.82 * progress;
    this.grade?.apply(p, 'clear', Math.max(0, (p - 0.6) / 0.4));
    this.grade?.update();
    ambience.update('clear', Math.max(0, (p - 0.6) / 0.4), false, 'summer');
    this.showFarm();
    if (this.phase !== 'day') return;
    const before = this.day;
    this.day = tick(this.day, dt);
    if (before.cheese > 0 && this.day.cheese === 0) {
      this.bubble(this.cheesemaker, t('lavka.say.cheesemaker'));
      sound.ding(VAT.x);
      this.refreshStock();
    }
    this.day.orders.forEach((o, i) => {
      const was = before.orders[i];
      if (o.done && !was.done) {
        this.hud.say(t('lavka.orderDone', { n: o.need * PRICE[o.good] + o.bonus }), 3000);
        sound.fanfare();
        pixelFx.burst(this, 'confetti', BACK_DOOR.x, 130);
      } else if (o.failed && !was.failed) {
        this.hud.say(t('lavka.orderFailed'), 3000);
        sound.bad();
        this.refreshStock();
      }
    });
    this.updateVat();
    this.vehicles();
    this.hints();
    while (this.queueList.length && this.queueList[0].at <= this.day.t) {
      const v = this.queueList.shift() as Visitor;
      if (this.guests.size < MAX_INSIDE || v.from !== 'road') void this.runGuest(v);
    }
    // Папа рассчитывает очередь сам.
    const head = this.queue[0];
    if (head?.readyAt && this.time.now >= this.nextServe) {
      this.nextServe = this.time.now + SERVE_MS / this.speed;
      this.serve(head);
    }
    if (isOver(this.day)) this.closeDay();
  }

  /** Подсказки первого дня: каждая — один раз, когда впервые есть такая работа. */
  private hints(): void {
    const d = this.day;
    const once = (id: string, when: boolean, key: TextKey): boolean => {
      if (!when || this.hinted.has(id)) return false;
      this.hinted.add(id);
      this.hud.say(t(key), 4500);
      return true;
    };
    once('bed', d.beds.some((b) => bedAction(b) !== 'growing'), 'lavka.hint.bed') ||
      once('cow', d.cows.some((m) => m >= 1) && d.t > 6, 'lavka.hint.cow') ||
      once('egg', d.eggs.length >= 3 && d.t > 12, 'lavka.hint.egg') ||
      once('hay', d.hay <= 1, 'lavka.hint.hay') ||
      once('grain', d.grain <= 1, 'lavka.hint.grain') ||
      once('cheese', d.stock.milk >= CHEESE_MILK + 2 && d.cheese === 0, 'lavka.hint.cheese');
  }

  private updateVat(): void {
    const making = this.phase === 'day' && this.day.cheese > 0;
    this.vatBack.setVisible(making);
    this.vatBar.setVisible(making);
    if (making) this.vatBar.width = 22 * (1 - this.day.cheese / CHEESE_TIME);
  }

  private vehicles(): void {
    const t0 = this.day.t;
    if (this.plan.bus && !this.seen.bus && t0 >= this.plan.bus.at - 3) {
      this.seen.bus = true;
      this.hud.say(t('lavka.hint.bus'), 3000);
      const bus = this.art(-50, BUS_STOP.y, 'bus').setOrigin(0.5, 1).setDepth(BUS_STOP.y).setTint(0xfee761);
      this.bus = bus;
      sound.courier('van', BUS_STOP.x);
      this.tweens.add({ targets: bus, x: BUS_STOP.x, duration: 2600, ease: 'Cubic.easeOut' });
      this.time.delayedCall(26_000 / this.speed, () => this.tweens.add({ targets: bus, x: WORLD_W + 80, duration: 5000, ease: 'Cubic.easeIn', onComplete: () => {
        bus.destroy();
        if (this.bus === bus) this.bus = undefined;
      } }));
    }
    const trains = this.plan.trains;
    if (this.seen.trains < trains.length && t0 >= trains[this.seen.trains].at - 3) {
      // Электричка — за кадром, справа: слышно гудок, и по дороге идут дачники.
      this.seen.trains += 1;
      this.hud.say(t('lavka.hint.train'), 3000);
      sound.doorbell(WORLD_W);
    }
  }

  // ---------- покупатели ----------

  private lookFor(from: From): Look {
    const base = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS) as number, 30);
    if (from === 'bus') return { ...base, hat: Math.random() < 0.6 ? 'sunhat' : base.hat, prop: Math.random() < 0.5 ? 'camera' : base.prop };
    if (from === 'train') return { ...base, prop: Math.random() < 0.6 ? (Math.random() < 0.5 ? 'basket' : 'stringbag') : base.prop, hat: Math.random() < 0.3 ? 'bucket' : base.hat };
    return base;
  }

  private async runGuest(v: Visitor): Promise<void> {
    let start: { x: number; y: number };
    let route: { x: number; y: number }[];
    if (v.from === 'bus') {
      start = { x: BUS_STOP.x + 24, y: STREET_Y + 2 };
      route = [PLAZA];
    } else {
      // С трассы — с любой стороны; дачники с электрички — справа, гурьбой.
      const left = v.from === 'train' ? false : Math.random() < 0.5;
      start = { x: left ? -12 : WORLD_W + 12, y: STREET_Y + Phaser.Math.Between(-2, 3) };
      route = [{ x: PLAZA.x + Phaser.Math.Between(-8, 8), y: STREET_Y }, PLAZA];
    }
    const p = persons.makePerson(this, start.x, start.y - FOOT, this.lookFor(v.from));
    p.setDepth(start.y);
    const g: Guest = { p, v, readyAt: 0, gone: false, home: start };
    this.guests.add(g);
    await this.path(p, [...route, DOOR_OUT, DOOR_IN]);
    if (g.gone) return;
    // К полке со своим товаром — посмотреть, есть ли.
    const spot = SPOTS[v.wants];
    const via = spot.y < 340 ? [{ x: DOOR_IN.x, y: spot.y + 4 }] : [];
    await this.path(p, [...via, spot]);
    if (g.gone) return;
    persons.setFacing(p, 'up');
    await this.pause(600);
    if (g.gone) return;
    if (this.phase !== 'day') return this.leave(g);
    if (this.day.stock[v.wants] <= 0) {
      // Нет нужного — ушёл ни с чем; на панели мигает, чего не хватило.
      this.day = buy(this.day, v.wants, v.qty).day;
      this.emote(p, 'emo_question');
      this.hud.want(v.wants);
      if (!this.hinted.has(`missed-${v.wants}`)) {
        this.hinted.add(`missed-${v.wants}`);
        this.hud.say(t('lavka.hint.missed', { good: goodName(v.wants) }), 3500);
      }
      await this.pause(700);
      return this.leave(g);
    }
    p.add(this.art(5, 2, CARRY[v.wants]));
    this.queue.push(g);
    await this.toQueue(g);
  }

  private serve(g: Guest): void {
    const paid = buy(this.day, g.v.wants, g.v.qty);
    this.day = paid.day;
    if (paid.n) {
      sound.till(COUNTER.x, paid.coins);
      this.popup(COUNTER.x, COUNTER.y - 24, `+${paid.coins} 💰`, '#fee761');
      pixelFx.burst(this, 'coinpop', COUNTER.x, COUNTER.y - 14, { zoom: 1 });
      persons.setMood(this, g.p, 'happy', 1500);
      persons.setMood(this, this.father, 'happy', 900);
    } else {
      // Пока стоял в очереди, последнее разобрали.
      this.emote(g.p, 'emo_question');
      this.hud.want(g.v.wants);
    }
    this.refreshStock();
    this.leave(g);
  }

  private async toQueue(g: Guest): Promise<void> {
    const i = this.queue.indexOf(g);
    if (i < 0 || g.gone) return;
    const spot = QUEUE[Math.min(i, QUEUE.length - 1)];
    const feet = g.p.y + FOOT;
    // От полок — вниз по середине зала, потом к прилавку.
    const via = feet < 340 ? [{ x: DOOR_IN.x, y: feet + 4 }, { x: DOOR_IN.x, y: 352 }] : [];
    await this.path(g.p, [...via, spot]);
    if (g.gone) return;
    persons.setFacing(g.p, i === 0 ? 'up' : 'left');
    if (this.queue.indexOf(g) === 0 && !g.readyAt) g.readyAt = this.time.now;
  }

  private leave(g: Guest): void {
    if (g.gone) return;
    g.gone = true;
    const qi = this.queue.indexOf(g);
    if (qi >= 0) this.queue.splice(qi, 1);
    for (const q of this.queue) void this.toQueue(q);
    const p = g.p;
    this.tweens.killTweensOf(p);
    p.setData('walking', false);
    const feet = p.y + FOOT;
    const inside = feet < 378;
    const back: { x: number; y: number }[] = [];
    if (inside) {
      if (feet < 340) back.push({ x: DOOR_IN.x, y: feet + 4 });
      back.push(DOOR_IN, DOOR_OUT);
    }
    back.push(PLAZA);
    if (g.v.from === 'bus' && this.bus) back.push(g.home);
    else back.push({ x: PLAZA.x, y: STREET_Y }, { x: g.v.from === 'train' ? WORLD_W + 14 : Math.random() < 0.5 ? -14 : WORLD_W + 14, y: STREET_Y });
    void this.path(p, back, true).then(() => {
      this.guests.delete(g);
      p.destroy();
    });
  }

  // ---------- люди ----------

  /** Идти по точкам (ноги); leaving — даже если уже ушёл: обычный путь обрывается, когда gone. */
  private async path(p: Phaser.GameObjects.Container, points: { x: number; y: number }[], leaving = false): Promise<void> {
    for (const pt of points) {
      if (!p.active) return;
      const g = [...this.guests].find((q) => q.p === p);
      if (!leaving && g?.gone) return;
      await this.walk(p, pt.x, pt.y - FOOT);
    }
  }

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
        duration: ((dist / speed) * 1000) / this.speed,
        onUpdate: () => p.setDepth(p.y + FOOT),
        onComplete: () => {
          p.setData('walking', false);
          done();
        },
        onStop: () => done(),
      });
    });
  }

  private pause(ms: number): Promise<void> {
    return new Promise((done) => this.time.delayedCall(ms / this.speed, done));
  }

  /** Шаг: кадры ног по пройденному пути (как motion.animatePeople, только самое нужное). */
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

  /** Всплывающая надпись: поднимается и тает. «💰» — монеткой из атласа. */
  private popup(x: number, y: number, text: string, color: string): void {
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
    this.tweens.add({ targets: box, y: y - 10, alpha: { from: 1, to: 0 }, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => box.destroy() });
  }
}
