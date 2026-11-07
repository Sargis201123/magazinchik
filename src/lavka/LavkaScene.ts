// «Лавка «Своё»» — играбельный день второй игры (docs/farm/LAVKA.md). Главное — работа на ферме, касаниями, и
// касаний немного: на пустую грядку — выбрать семена, поспело — собрать; корова —
// одним касанием доятся все полные; яйца — касание по гнездовому ящику собирает все; мёд и яблоки — с ульев и
// яблонь; сено в сенник привозит трактор. Пока растёт — над местом крутится таймер, готово — выпрыгивает золотой значок. Собранное летит в лавку:
// сначала в заказы дня, остальное на склад, а лавка продаёт сама — папа за прилавком, покупатели с трассы,
// автобуса и электрички. Дни идут подряд, без окон: вечером — итог дня строкой, ночь, утро. Правила и цифры — game/lavka/day.ts; картинки и раскладка — art/lavka.py (layout.json).
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
  COWS,
  DAY_SECONDS,
  EGGS_MAX,
  HAY_FULL,
  HENS,
  PRICE,
  bedAction,
  buy,
  feedGrain,
  feedHay,
  harvest,
  isOver,
  milkAll,
  nextDay,
  pickEggs,
  plant,
  planFor,
  shakeTree,
  startDay,
  summary,
  takeHoney,
  tick,
  visitors,
  type Day,
  type From,
  type Good,
  type Plan,
  type Seed,
  type Visitor,
} from '../game/lavka/day';
import { UI_FONT } from '../ui/dom';
import { ART, CUSTOMER_SPEED, SHIRTS, VIEW_SUFFIX, customerLook, type Look } from '../scenes/common';
import { facingAlong, type Facing } from '../scenes/stride';
import { crispZoom } from '../scenes/pixels';
import { ColorGrade } from '../scenes/grade';
import * as persons from '../scenes/persons';
import * as pixelFx from '../scenes/pixelFx';
import { GOOD_ICON, LavkaHud, dayToast, dowName, goodName, seedPicker } from './lavkaUi';
import layout from './layout.json';
import fxSheets from './fx.json';

/** Мир в точках (рисунок 512×900 пикселей, ART = 2; над ним ещё полоска травы под панелью, layout.top). Полосы —
 *  как в art/lavka.py: огород и амбар 0…87, сад и загон 87…163, курятник и сенник 163…234, дорожка 237…256,
 *  лавка 259…369 (один зал, справа — площадка под стройку), площадка и дорога 369…450. */
const WORLD_W = 256;
const WORLD_H = 450;
/** Ноги человечка ниже середины его картинки (тень у makePerson — на 8,5). */
const FOOT = 8;

const DOOR_IN = { x: 128, y: 360 };
const DOOR_OUT = { x: 128, y: 377 };
const PLAZA = { x: 128, y: 388 };
const STREET_Y = 393;
/** Полки у задней стены зала (низ по середине): молоко в холодильнике, яйца, мёд, ящики с овощами. */
const MILK_SHELF = { x: 68, y: 305 };
const EGG_SHELF = { x: 108, y: 305 };
const HONEY_SHELF = { x: 148, y: 305 };
const VEG_STAND = { x: 188, y: 305 };
/** У какой полки покупатель выбирает свой товар (ноги). */
const SPOTS: Record<Good, { x: number; y: number }> = {
  milk: { x: 68, y: 314 },
  eggs: { x: 108, y: 314 },
  honey: { x: 148, y: 314 },
  veg: { x: 188, y: 314 },
};
const QUEUE = [
  { x: 198, y: 344 },
  { x: 186, y: 350 },
  { x: 174, y: 354 },
  { x: 210, y: 352 },
];
/** Выше этой линии — полки у задней стены: туда и оттуда идут через середину зала. */
const SHELF_ROW = 330;
const COUNTER = { x: 198, y: 332 };
/** Куда летит собранное: задняя дверь лавки (на средней тропинке фермы). */
const BACK_DOOR = { x: 110, y: 261 };
/** Площадка под стройку (справа от лавки). */
const EXPAND = { x: 224, y: 267, w: 29, h: 101 };
const BUS_STOP = { x: 30, y: 399 };
/** Огород: 3×2 грядки; растения выше борта на CROP_TOP. */
const BED_X = [9, 56, 103];
const BED_Y = [12, 46];
const BED_W = 42;
const BED_H = 22;
const CROP_TOP = 7;
/** Сад и пасека вразбивку: яблоня, улей, улей, яблоня (низ по середине). */
const TREES = [
  { x: 26, y: 134 },
  { x: 76, y: 160 },
];
const HIVES = [
  { x: 76, y: 116 },
  { x: 26, y: 158 },
];
/** Курятник с гнездовым ящиком сбоку (яйца — в ячейках), выгул, кормушка. */
const COOP = { x0: 4, y0: 170, x1: 70, y1: 223 };
const NEST = { x: 58.5, y: 205 };
const EGG_SLOTS = [52.2, 58.7, 65.2].flatMap((x) => [x - 1.4, x + 1.4]).map((x, i) => ({ x, y: 204.5 - (i % 2) * 0.5 }));
const RUN = { x0: 76, x1: 96, y0: 178, y1: 230 };
const FEEDER = { x: 88, y: 228 };
/** Загон под амбаром: корова, поилка, пруд с утками. */
const PADDOCK = { x0: 126, x1: 248, y0: 100, y1: 168 };
const TROUGH = { x: 148, y: 164 };
const POND = { x0: 210, x1: 242, y0: 146, y1: 158 };
/** Сенник: тюки (их столько, сколько сена) и куда трактор привозит новые. */
const SHED = { x0: 151, y0: 182, x1: 229, y1: 232 };
const BALES = [
  { x: 159, y: 229 },
  { x: 176, y: 229 },
  { x: 193, y: 229 },
  { x: 210, y: 229 },
  { x: 167.5, y: 218 },
  { x: 184.5, y: 218 },
  { x: 201.5, y: 218 },
  { x: 184.5, y: 207 },
];
/** Дорожка: трактор въезжает справа, встаёт у сенника, разгружается и уезжает влево — всегда носом вперёд. */
const LANE_Y = 252;
const TRACTOR_STOP = 200;
/** Папа рассчитывает очередь сам — раз в столько мс. */
const SERVE_MS = 1300;
const MAX_INSIDE = 9;

const CARRY: Record<Good, string> = { milk: 'item_milk', eggs: 'lavka_egg', veg: 'item_apples', honey: 'lavka_ico_honey' };

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
  back: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
}

/** Кружочек ожидания: растёт/копится — крутится таймер; готово — таймер лопается, выскакивает значок. */
interface Slot {
  call: Callout;
  timer: Phaser.GameObjects.Image;
  mode: 'off' | 'wait' | 'call';
}

/** Шагов у таймера (кадров на один больше: последний — полный). Рисунок — art/lavka_ui.py. */
const TIMER_STEPS = 20;
const TIMER_PX = 17;

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
  private father!: Phaser.GameObjects.Container;
  private bus?: Phaser.GameObjects.Image;
  private cows: Phaser.GameObjects.Image[] = [];
  private eggImgs: Phaser.GameObjects.Image[] = [];
  private bedCrop: Phaser.GameObjects.Image[] = [];
  private bedSlots: Slot[] = [];
  private bedStage: number[] = [];
  private bedShown: string[] = [];
  private cowSlots: Slot[] = [];
  private hiveSlots: Slot[] = [];
  private treeSlots: Slot[] = [];
  private treeImgs: Phaser.GameObjects.Image[] = [];
  private nestSlot!: Slot;
  private eggShelf: Phaser.GameObjects.Image[] = [];
  private honeyShelf: Phaser.GameObjects.Image[] = [];
  private closeSeeds: (() => void) | null = null;
  private hayCall!: Callout;
  private grainCall!: Callout;
  private hiveImgs: Phaser.GameObjects.Image[] = [];
  private bales: Phaser.GameObjects.Image[] = [];
  private hayRun = false;
  private hinted = new Set<string>();
  private seen = { bus: false, trains: 0 };
  private closeMorning: (() => void) | null = null;
  private drag = { down: false, y: 0, scroll: 0, moved: false };
  private nextCar = 2;
  private nextChat = 6;
  private nextServe = 0;
  private visible = 0;
  private props = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super('farm');
  }

  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  /** Свои картинки (не из общего атласа, art/lavka.py) — один раз за игру. */
  preload(): void {
    for (const key of layout.keys) if (!this.textures.exists(key)) this.load.image(key, png(key));
    // Эффекты фермы (scripts/fx-bake.mjs --lavka): полосой кадров на эффект.
    for (const k of Object.keys(fxSheets)) {
      const key = `lavka_fx_${k}`;
      if (!this.textures.exists(key)) this.load.image(key, png(key));
    }
  }

  create(): void {
    if (!this.lite) void pixelFx.loadSheets(this);
    const tt = this.textures.get('lavka_timer');
    for (let n = 0; n <= TIMER_STEPS; n++) if (!tt.has(String(n))) tt.add(String(n), 0, n * TIMER_PX, 0, TIMER_PX, TIMER_PX);
    for (const [k, f] of Object.entries(fxSheets)) {
      const key = `lavka_fx_${k}`;
      // полоса кадров слева направо: режем сами (в облегчённом Phaser нет загрузчика spritesheet)
      const tex = this.textures.get(key);
      for (let n = 0; n < f.frames; n++) if (!tex.has(String(n))) tex.add(String(n), 0, n * f.w, 0, f.w, f.h);
      if (!this.anims.exists(key)) this.anims.create({ key, frames: Array.from({ length: f.frames }, (_, n) => ({ key, frame: String(n) })), frameRate: f.fps, repeat: f.loop ? -1 : 0 });
    }
    setListener(() => {
      const v = this.cameras.main.worldView;
      return { left: v.x, width: v.width };
    });
    this.buildWorld();
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.hud = new LavkaHud();
    this.hud.onHome = () => {
      saveChoice('store');
      location.reload();
    };
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
      this.closeSeeds?.();
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
      if (!this.props.has(p.k)) this.props.set(p.k, img);
    }
    this.zone(EXPAND.x, EXPAND.y, EXPAND.w, EXPAND.h, () => this.popup(EXPAND.x + EXPAND.w / 2, EXPAND.y + 34, t('lavka.expandSoon'), '#fee761'));
    // Полки у задней стены зала: товар на них — сколько есть на складе (refreshStock).
    this.art(MILK_SHELF.x, MILK_SHELF.y, 'fridge').setOrigin(0.5, 1).setDepth(MILK_SHELF.y);
    this.art(MILK_SHELF.x, MILK_SHELF.y, 'fridge_front').setOrigin(0.5, 1).setDepth(MILK_SHELF.y + 0.2);
    for (const sh of [EGG_SHELF, HONEY_SHELF]) {
      this.art(sh.x, sh.y, 'shelf').setOrigin(0.5, 1).setDepth(sh.y);
      this.art(sh.x, sh.y, 'shelf_front').setOrigin(0.5, 1).setDepth(sh.y + 0.2);
    }
    this.art(VEG_STAND.x, VEG_STAND.y, 'lavka_stand_veg').setOrigin(0.5, 1).setDepth(VEG_STAND.y);
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

  /** Мир — между панелями: сверху монеты и часы, снизу склад и заказы. Влезает весь — посередине между ними;
   *  не влезает — огород сразу под верхней панелью, остальное — пальцем. */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const fit = this.scale.width / WORLD_W;
    cam.setZoom(crispZoom(fit, ART, fit * 0.9, fit * 1.04) || fit);
    this.visible = this.scale.height / cam.zoom;
    const topPad = 62 / cam.zoom;
    const bottomPad = 96 / cam.zoom;
    const worldTop = -layout.top;
    const worldH = WORLD_H + layout.top;
    const room = this.visible - topPad - bottomPad;
    // где на экране (в точках мира от верха экрана) окажется верх мира
    const at = room >= worldH ? topPad + (room - worldH) / 2 : Math.max(0, topPad - layout.top);
    const viewTop = worldTop - at;
    cam.setBounds(0, viewTop, WORLD_W, Math.max(worldH + at + bottomPad, this.visible));
    cam.centerOn(WORLD_W / 2, viewTop + this.visible / 2);
  }

  // ---------- ферма: что нажимается ----------

  /** Облачко со значком над точкой мира: кремовое — «нужна забота», золотое — «готово, собирай». */
  private callout(x: number, y: number, icon: string, onTap?: () => void, ready = false): Callout {
    const back = this.add.image(0, 0, ready ? 'lavka_badge_gold' : 'lavka_badge').setOrigin(0.5, 9.5 / 22).setScale(1 / ART);
    const img = this.add.image(0, 0, icon).setScale(1 / ART);
    const box = this.add.container(x, y, [back, img]).setDepth(1003).setVisible(false);
    this.tweens.add({ targets: box, y: y - 1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Появилось — выпрыгивает с пружинкой (а не просто загорается).
    box.on('show', () => {
      if (this.lite) return;
      box.setScale(0.2).setAngle(0);
      this.tweens.add({ targets: box, scale: 1, duration: 340, ease: 'Back.easeOut' });
    });
    if (onTap) {
      box.setSize(16, 16).setInteractive({ useHandCursor: true });
      box.on('pointerup', () => !this.drag.moved && onTap());
    }
    return { box, back, icon: img };
  }

  /** Сменить значок и цвет облачка; если уже видно и что-то поменялось — снова выпрыгивает. */
  private dress(c: Callout, icon: string, ready: boolean): void {
    const back = ready ? 'lavka_badge_gold' : 'lavka_badge';
    if (c.icon.texture.key === icon && c.back.texture.key === back) return;
    c.icon.setTexture(icon);
    c.back.setTexture(back);
    if (c.box.visible) c.box.emit('show');
  }

  private slot(x: number, y: number, icon: string, onTap: () => void, ready = true): Slot {
    const call = this.callout(x, y, icon, onTap, ready);
    const timer = this.add.image(x, y, 'lavka_timer', '0').setScale(1 / ART).setDepth(1002).setVisible(false);
    return { call, timer, mode: 'off' };
  }

  /** Перевести слот: off — ничего; wait — таймер с долей p; call — значок. Из wait в call — таймер лопается. */
  private setSlot(s: Slot, mode: Slot['mode'], p = 0): void {
    const { timer, call } = s;
    if (mode === 'wait') timer.setFrame(String(Math.min(TIMER_STEPS - 1, Math.floor(Math.max(0, p) * TIMER_STEPS))));
    if (mode === s.mode) return;
    const was = s.mode;
    s.mode = mode;
    this.tweens.killTweensOf(timer);
    if (mode === 'wait') {
      this.show(call, false);
      timer.setVisible(true).setAlpha(1);
      if (this.lite) timer.setScale(1 / ART);
      else this.tweens.add({ targets: timer, scale: { from: 0.2 / ART, to: 1 / ART }, duration: 260, ease: 'Back.easeOut' });
      return;
    }
    if (mode === 'call' && was === 'wait' && !this.lite && this.phase === 'day') {
      // готово: таймер наливается, вспыхивает и лопается — на его месте выпрыгивает значок
      timer.setFrame(String(TIMER_STEPS)).setTintFill(0xffffff);
      this.time.delayedCall(60, () => timer.clearTint());
      this.tweens.add({ targets: timer, scale: 1.7 / ART, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => timer.setVisible(false).setScale(1 / ART) });
      pixelFx.burst(this, 'star', timer.x, timer.y, { zoom: 1, fade: 250 });
      sound.pop(1, timer.x);
      this.time.delayedCall(120, () => s.mode === 'call' && this.show(call, true));
      return;
    }
    timer.setVisible(false).setScale(1 / ART);
    this.show(call, mode === 'call');
  }

  /** Готовое время от времени подпрыгивает «та-да», чтобы глаз цеплялся. */
  private tada(): void {
    const ready = [...this.cowSlots, ...this.bedSlots, ...this.hiveSlots, ...this.treeSlots, this.nestSlot]
      .filter((s) => s.mode === 'call' && s.call.box.visible && s.call.back.texture.key === 'lavka_badge_gold');
    ready.forEach((s, k) => {
      const box = s.call.box;
      this.tweens.add({ targets: box, angle: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 2, delay: k * 90, onComplete: () => box.setAngle(0) });
    });
  }

  /** Облачко включается — с пружинкой, гаснет — сразу. */
  private show(c: Callout, on: boolean): void {
    if (on && !c.box.visible) c.box.emit('show');
    c.box.setVisible(on);
  }

  private zone(x: number, y: number, w: number, h: number, fn: () => void): void {
    this.add.zone(x, y, w, h).setOrigin(0).setDepth(5).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.drag.moved) return;
      fn();
    });
  }

  private farm(): void {
    // Грядки: растения поверх короба (выше борта), над грядкой — таймер или значок.
    for (let i = 0; i < BEDS; i++) {
      const x = BED_X[i % 3];
      const y = BED_Y[Math.floor(i / 3)];
      this.bedCrop[i] = this.art(x, y - CROP_TOP, 'lavka_crop_carrot1').setOrigin(0).setDepth(y + BED_H - 1).setVisible(false);
      this.bedSlots[i] = this.slot(x + BED_W / 2, y + 2, 'lavka_ico_seed', () => this.tapBedAt(i), false);
      this.zone(x, y, BED_W, BED_H, () => this.tapBedAt(i));
    }
    // Яйца — в ячейках гнездового ящика; касание по ящику собирает все.
    this.eggImgs = EGG_SLOTS.slice(0, EGGS_MAX).map((s, i) =>
      this.art(s.x, s.y, i % 3 === 1 ? 'lavka_egg_brown' : 'lavka_egg').setOrigin(0.5, 1).setDepth(COOP.y1 + 1).setVisible(false),
    );
    this.nestSlot = this.slot(NEST.x, NEST.y - 26, 'lavka_egg', () => this.collectEggs());
    this.zone(COOP.x0, COOP.y0, COOP.x1 - COOP.x0, COOP.y1 - COOP.y0, () => this.collectEggs());
    // Сенник: тюки — сколько сена; кончилось — значок, касание — трактор привезёт.
    this.bales = BALES.map((b, i) => this.art(b.x, b.y, 'lavka_hay').setOrigin(0.5, 1).setDepth(SHED.y1 + 1 + i * 0.01));
    this.hayCall = this.callout((SHED.x0 + SHED.x1) / 2, SHED.y0 + 4, 'lavka_ico_hayicon', () => this.hay());
    this.zone(SHED.x0, SHED.y0, SHED.x1 - SHED.x0, SHED.y1 - SHED.y0, () => this.hay());
    this.zone(TROUGH.x - 11, TROUGH.y - 8, 22, 9, () => this.hay());
    this.grainCall = this.callout(FEEDER.x, FEEDER.y - 10, 'lavka_ico_grain', () => this.grain());
    this.zone(FEEDER.x - 8, FEEDER.y - 7, 16, 9, () => this.grain());
    // Пасека и сад.
    HIVES.forEach((h, i) => {
      this.hiveImgs[i] = this.art(h.x, h.y, 'lavka_hive').setOrigin(0.5, 1).setDepth(h.y);
      this.hiveSlots[i] = this.slot(h.x, h.y - 30, 'lavka_ico_honey', () => this.honey(i));
      this.zone(h.x - 11, h.y - 24, 22, 24, () => this.honey(i));
    });
    TREES.forEach((tr, i) => {
      this.treeImgs[i] = this.art(tr.x, tr.y, 'lavka_tree_bare').setOrigin(0.5, 1).setDepth(tr.y);
      this.treeSlots[i] = this.slot(tr.x, tr.y - 49, 'lavka_ico_apple', () => this.apples(i));
      this.zone(tr.x - 18, tr.y - 44, 36, 44, () => this.apples(i));
    });
    if (!this.lite) this.time.addEvent({ delay: 2600, loop: true, callback: () => this.tada() });
  }

  // ---------- сочность: у каждого касания есть тело (как в магазине: motion.ts, pixelFx) ----------

  /** Эффект фермы (pixelfx, запечён в нашей палитре): проигрывается один раз (бабочка — петлёй). */
  private fx(key: keyof typeof fxSheets, x: number, y: number, scale = 1, depth = 1002): Phaser.GameObjects.Sprite | null {
    if (this.lite) return null;
    const f = fxSheets[key];
    const spr = this.add.sprite(x, y, `lavka_fx_${key}`, '0').setOrigin(f.ox, f.oy).setScale(scale / ART).setDepth(depth);
    spr.play(`lavka_fx_${key}`);
    if (!f.loop) spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.destroy());
    return spr;
  }

  /** Пружинка: предмет приседает и вытягивается обратно, низ стоит на месте. */
  private squash(img: Phaser.GameObjects.Image | undefined, sx = 1.1, sy = 0.86, ms = 90): void {
    if (this.lite || !img?.active || img.getData('sq')) return;
    const bx = img.scaleX;
    const by = img.scaleY;
    img.setData('sq', true);
    this.tweens.add({ targets: img, scaleX: bx * sx, scaleY: by * sy, duration: ms, yoyo: true, ease: 'Quad.easeOut', onComplete: () => {
      img.setScale(bx, by);
      img.setData('sq', false);
    } });
  }

  /** Белый кадр в миг касания — удар не вялый. */
  private flash(img: Phaser.GameObjects.Image | undefined, ms = 60): void {
    if (this.lite || !img?.active || img.isTinted) return;
    img.setTintFill(0xffffff);
    this.time.delayedCall(ms, () => img.active && img.clearTint());
  }

  /** Круг под пальцем: нажатие засчитано. */
  private ripple(x: number, y: number): void {
    const ring = this.add.circle(x, y, 3).setStrokeStyle(1, 0xffffff, 0.95).setDepth(1010);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  /** Собрал — товар выскакивает белой вспышкой, зависает и, кувыркаясь, летит к задней двери; там — «шлёп». */
  private gather(g: Good, n: number, from: { x: number; y: number }): void {
    haptic.tap();
    sound.pop(Math.min(3, n), from.x);
    this.popGood(from.x, from.y - 12, g, n);
    const count = Math.min(n, 4);
    for (let k = 0; k < count; k++) {
      const sx = from.x + (k - (count - 1) / 2) * 4;
      const img = this.art(sx, from.y - 4, GOOD_ICON[g]).setDepth(1001).setScale(0.4 / ART);
      if (!this.lite) img.setTintFill(0xffffff);
      // выпрыгнул
      this.tweens.add({ targets: img, y: from.y - 12 - k * 2, scale: 1.4 / ART, duration: 180, delay: k * 60, ease: 'Back.easeOut', onComplete: () => {
        img.clearTint();
        const tx = BACK_DOOR.x + Phaser.Math.Between(-4, 4);
        const sy = img.y;
        this.tweens.add({ targets: img, x: tx, angle: Phaser.Math.Between(-200, 200), scale: 0.9 / ART, duration: 620, delay: 120, ease: 'Sine.easeInOut', onComplete: () => {
          img.destroy();
          if (k === count - 1) this.landAtDoor();
        } });
        this.tweens.add({ targets: img, y: { from: sy, to: BACK_DOOR.y }, duration: 620, delay: 120, ease: (v: number) => v - 0.7 * Math.sin(v * Math.PI) });
      } });
    }
    this.time.delayedCall(950, () => this.refreshStock());
  }

  /** «+N» со значком товара: выпрыгивает пружиной, повисит и тает. */
  private popGood(x: number, y: number, g: Good, n: number): void {
    const label = this.worldText(-2, 0, `+${n}`, 6, '#ffffff').setStroke('#181425', 7).setOrigin(1, 0.5);
    const icon = this.art(1, 0, GOOD_ICON[g]).setOrigin(0, 0.5).setScale(1.2 / ART);
    const box = this.add.container(x, y, [label, icon]).setDepth(1006).setScale(0.3);
    this.tweens.add({ targets: box, scale: 1, y: y - 4, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: box, y: y - 12, alpha: 0, delay: 700, duration: 500, ease: 'Quad.easeIn', onComplete: () => box.destroy() });
  }

  /** Товар долетел до лавки: пыль у двери и стук. */
  private landAtDoor(): void {
    sound.pop(2, BACK_DOOR.x);
    if (this.lite) return;
    for (const dx of [-5, 5]) {
      const puff = this.art(BACK_DOOR.x + dx, BACK_DOOR.y + 1, 'lavka_puff').setDepth(BACK_DOOR.y + 5).setAlpha(0.9).setScale(0.6 / ART);
      this.tweens.add({ targets: puff, x: puff.x + dx, y: puff.y - 3, alpha: 0, scale: 1.1 / ART, duration: 420, onComplete: () => puff.destroy() });
    }
  }

  private propImg(key: string): Phaser.GameObjects.Image | undefined {
    return this.props.get(key);
  }

  private nothing(x: number, y: number, key: TextKey = 'lavka.notReady'): void {
    this.popup(x, y, t(key), '#c0cbdc');
  }

  /** Касание по корове: доятся все полные коровы в загоне разом. */
  private milkCow(i: number): void {
    if (this.phase !== 'day') return;
    const tapped = this.cows[i];
    const r = milkAll(this.day);
    if (!r.n) return this.nothing(tapped.x, tapped.y - 16);
    this.day = r.day;
    this.hinted.add('cow');
    r.cows.forEach((k, n) => {
      const cow = this.cows[k];
      this.time.delayedCall(n * 140, () => {
        this.ripple(cow.x, cow.y - 10);
        this.squash(cow, 1.08, 0.9, 100);
        this.flash(cow);
        this.fx('milk', cow.x + (cow.flipX ? -6 : 6), cow.y - 3, 1.3);
        pixelFx.burst(this, 'hearts', cow.x, cow.y - 26, { zoom: 1 });
      });
    });
    this.gather('milk', r.n, { x: tapped.x, y: tapped.y - 8 });
  }

  /** Сено кончается — касание по сеннику: трактор привозит тюки по дорожке. */
  private hay(): void {
    if (this.phase !== 'day') return;
    if (this.hayRun) return this.nothing(this.hayCall.box.x, this.hayCall.box.y - 6, 'lavka.hayComing');
    if (this.day.hay >= HAY_FULL) return this.nothing(this.hayCall.box.x, this.hayCall.box.y, 'lavka.hayFull');
    this.hinted.add('hay');
    haptic.tap();
    sound.pop(2, SHED.x1);
    this.ripple((SHED.x0 + SHED.x1) / 2, SHED.y0 + 20);
    this.squash(this.propImg('lavka_shed'), 1.03, 0.96);
    this.hayRun = true;
    this.show(this.hayCall, false);
    this.tractorRun(true);
  }

  /** Касание по гнездовому ящику: все яйца из гнёзд — в лавку. */
  private collectEggs(): void {
    if (this.phase !== 'day') return;
    const r = pickEggs(this.day);
    if (!r.n) return this.nothing(NEST.x, NEST.y - 24);
    this.day = r.day;
    this.hinted.add('egg');
    this.ripple(NEST.x, NEST.y - 10);
    this.squash(this.propImg('lavka_coop'), 1.04, 0.95);
    this.fx('feathers', NEST.x, NEST.y - 8, 1.1);
    this.eggImgs.forEach((e) => e.setVisible(false));
    this.gather('eggs', r.n, { x: NEST.x, y: NEST.y - 8 });
  }

  private grain(): void {
    if (this.phase !== 'day') return;
    const r = feedGrain(this.day);
    if (!r.n) return this.nothing(FEEDER.x, FEEDER.y - 12);
    this.day = r.day;
    this.hinted.add('grain');
    haptic.tap();
    sound.pop(1, FEEDER.x);
    this.ripple(FEEDER.x, FEEDER.y - 4);
    this.squash(this.propImg('lavka_feeder'), 1.15, 0.8);
    this.fly('lavka_ico_grain', { x: FEEDER.x - 16, y: FEEDER.y - 20 }, FEEDER, 2);
  }

  private bedCenter(i: number): { x: number; y: number } {
    return { x: BED_X[i % 3] + BED_W / 2, y: BED_Y[Math.floor(i / 3)] + BED_H / 2 };
  }

  /** Касание грядки: пустая — выбрать семена, поспела — собрать, растёт — «растёт…». */
  private tapBedAt(i: number): void {
    if (this.phase !== 'day') return;
    const { x, y } = this.bedCenter(i);
    const action = bedAction(this.day.beds[i]);
    this.hinted.add('bed');
    this.ripple(x, y);
    const crop = this.bedCrop[i];
    if (action === 'plant') {
      haptic.tap();
      sound.pop(0, x);
      this.closeSeeds?.();
      this.closeSeeds = seedPicker(
        (seed) => {
          this.closeSeeds = null;
          this.sow(i, seed);
        },
        () => (this.closeSeeds = null),
      );
      return;
    }
    if (action === 'harvest') {
      const r = harvest(this.day, i);
      this.day = r.day;
      // растение выдёргивается из грядки и тает — грядка пустеет не мгновенно
      if (!this.lite && crop?.visible) {
        const ghost = this.art(crop.x, crop.y, crop.texture.key).setOrigin(0).setDepth(crop.depth + 1);
        ghost.setTintFill(0xffffff);
        this.time.delayedCall(50, () => ghost.active && ghost.clearTint());
        this.tweens.add({ targets: ghost, y: crop.y - 8, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ghost.destroy() });
      }
      this.fx('leaves', x, y + 2, 1.2);
      return this.gather('veg', r.n, { x, y });
    }
    this.squash(crop, 1.04, 0.94);
    this.nothing(x, y - 8, 'lavka.growing');
  }

  /** Посадить выбранное на эту грядку: ростки проклёвываются. */
  private sow(i: number, seed: Seed): void {
    if (this.phase !== 'day') return;
    const r = plant(this.day, i, seed);
    if (!r.n) return;
    this.day = r.day;
    const { x, y } = this.bedCenter(i);
    haptic.tap();
    sound.pop(0, x);
    for (const dx of [-12, 0, 12]) this.fx('sprout', x + dx, y + 5, 0.7);
  }

  private honey(i: number): void {
    if (this.phase !== 'day') return;
    const r = takeHoney(this.day, i);
    if (!r.n) return this.nothing(HIVES[i].x, HIVES[i].y - 28);
    this.day = r.day;
    this.ripple(HIVES[i].x, HIVES[i].y - 12);
    this.squash(this.hiveImgs[i], 1.1, 0.88);
    this.flash(this.hiveImgs[i]);
    pixelFx.burst(this, 'coinpop', HIVES[i].x, HIVES[i].y - 14, { zoom: 1 });
    this.gather('honey', r.n, { x: HIVES[i].x, y: HIVES[i].y - 14 });
  }

  private apples(i: number): void {
    if (this.phase !== 'day') return;
    const tr = TREES[i];
    const r = shakeTree(this.day, i);
    if (!r.n) return this.nothing(tr.x, tr.y - 40);
    this.day = r.day;
    const img = this.treeImgs[i];
    this.ripple(tr.x, tr.y - 24);
    img.setTexture('lavka_tree_bare');
    this.tweens.add({ targets: img, angle: { from: -5, to: 0 }, duration: 560, ease: 'Elastic.easeOut' });
    // яблоки срываются с кроны, стукаются о землю — и уже оттуда летят в лавку
    for (let k = 0; k < 4; k++) {
      const a = this.art(tr.x + (k - 1.5) * 7, tr.y - 32 + (k % 2) * 6, 'lavka_ico_apple').setDepth(tr.y + 2);
      this.tweens.add({ targets: a, y: tr.y - 1 + (k % 2), duration: 320, delay: k * 70, ease: 'Bounce.easeOut', onComplete: () => this.tweens.add({ targets: a, alpha: 0, delay: 200, duration: 150, onComplete: () => a.destroy() }) });
    }
    this.time.delayedCall(440, () => this.gather('veg', r.n, { x: tr.x, y: tr.y - 3 }));
  }

  /** Предмет летит дугой из from в to (по одному с задержкой). */
  private fly(key: string, from: { x: number; y: number }, to: { x: number; y: number }, n: number): void {
    for (let k = 0; k < n; k++) {
      const img = this.art(from.x, from.y, key).setDepth(1001);
      this.tweens.add({ targets: img, x: to.x + Phaser.Math.Between(-3, 3), duration: 550, delay: k * 90, ease: 'Sine.easeInOut', onComplete: () => img.destroy() });
      this.tweens.add({ targets: img, y: { from: from.y, to: to.y }, duration: 550, delay: k * 90, ease: (v: number) => v - 0.9 * Math.sin(v * Math.PI) });
    }
  }

  /** Ферма показывает своё состояние: таймеры и значки, растения по стадиям, яйца в гнёздах, яблоки на ветках. */
  private showFarm(): void {
    const d = this.day;
    const day = this.phase === 'day';
    this.cows.forEach((cow, i) => {
      const sl = this.cowSlots[i];
      this.setSlot(sl, !day ? 'off' : d.cows[i] >= 1 ? 'call' : 'wait', d.cows[i]);
      const c = sl.call;
      c.box.x = cow.x;
      sl.timer.setPosition(cow.x, cow.y - 30);
      if (c.box.visible && Math.abs(c.box.y - (cow.y - 30)) > 3) c.box.y = cow.y - 30;
    });
    this.show(this.hayCall, day && d.hay <= 1 && !this.hayRun);
    this.show(this.grainCall, day && d.grain <= 1);
    this.eggImgs.forEach((egg, i) => {
      const on = i < d.eggs;
      if (on && !egg.visible && day && !this.lite) {
        // снеслась — яйцо выпрыгивает в гнезде
        egg.setScale(0.3 / ART);
        this.tweens.add({ targets: egg, scale: 1 / ART, duration: 300, ease: 'Back.easeOut' });
      }
      egg.setVisible(on);
    });
    this.setSlot(this.nestSlot, !day ? 'off' : d.eggs > 0 ? 'call' : d.grain > 0 ? 'wait' : 'off', 1 - d.layIn / 10);
    d.hives.forEach((h, i) => this.setSlot(this.hiveSlots[i], !day ? 'off' : h >= 1 ? 'call' : 'wait', h));
    d.trees.forEach((h, i) => {
      this.setSlot(this.treeSlots[i], !day ? 'off' : h >= 1 ? 'call' : 'wait', h);
      const key = h >= 1 || !day ? 'lavka_tree_apples' : 'lavka_tree_bare';
      if (this.treeImgs[i].texture.key !== key) this.treeImgs[i].setTexture(key);
    });
    this.bales.forEach((b, i) => b.setVisible(i < Math.ceil(d.hay)));
    d.beds.forEach((b, i) => {
      const action = bedAction(b);
      const stage = !b.seed ? 0 : b.grow >= 1 ? 3 : b.grow >= 0.45 ? 2 : 1;
      const sl = this.bedSlots[i];
      // пустая — семечко (кремовое), растёт — таймер, поспела — золотой значок с самой культурой
      if (action === 'plant') this.dress(sl.call, 'lavka_ico_seed', false);
      else if (action === 'harvest' && b.seed) this.dress(sl.call, `lavka_ico_${b.seed}`, true);
      this.setSlot(sl, !day ? 'off' : action === 'growing' ? 'wait' : 'call', b.grow);
      const key = `${b.seed}/${stage}`;
      if (key === this.bedShown[i]) return;
      this.bedShown[i] = key;
      const crop = this.bedCrop[i];
      const grew = stage > (this.bedStage[i] ?? 0) && (this.bedStage[i] ?? 0) > 0;
      this.bedStage[i] = stage;
      this.tweens.killTweensOf(crop);
      crop.setScale(1 / ART).setVisible(stage > 0);
      if (stage > 0 && b.seed) crop.setTexture(`lavka_crop_${b.seed}${stage}`);
      // подросло — растения «выстреливают» вверх пружинкой, разлетаются листики
      if (grew && !this.lite) {
        crop.setScale(1 / ART, 0.6 / ART);
        crop.y = BED_Y[Math.floor(i / 3)] - CROP_TOP + (BED_H + CROP_TOP) * 0.4;
        this.tweens.add({ targets: crop, scaleY: 1 / ART, y: BED_Y[Math.floor(i / 3)] - CROP_TOP, duration: 420, ease: 'Back.easeOut' });
        this.fx('leaves', crop.x + BED_W / 2, BED_Y[Math.floor(i / 3)] + BED_H / 2, 0.8);
      }
    });
  }

  // ---------- жизнь вокруг ----------

  private animals(): void {
    // Корова (пока одна, загон на вырост): жуёт, бредёт; полная — значок с молоком, касание — подоить всех полных.
    const spots: [number, number][] = [
      [172, 150],
      [196, 128],
      [150, 138],
      [224, 126],
    ];
    spots.slice(0, COWS).forEach(([x, y], i) => {
      const cow = this.art(x, y, 'lavka_cow00').setOrigin(0.5, 1).setDepth(y).setFlipX(i % 2 === 1);
      // мягкая тень под коровой — ходит вместе с ней
      const shade = this.add.ellipse(x, y - 1, 34, 7, 0x1e3a1a, 0.28).setDepth(y - 1);
      cow.on('destroy', () => shade.destroy());
      cow.setInteractive(new Phaser.Geom.Rectangle(-4, -6, 74, 60), Phaser.Geom.Rectangle.Contains);
      cow.on('pointerup', () => !this.drag.moved && this.milkCow(i));
      this.cows[i] = cow;
      this.cowSlots[i] = this.slot(x, y - 30, 'item_milk', () => this.milkCow(i));
      const chew = (): void => {
        if (!cow.active) return;
        // жуёт: голова вверх-вниз; иногда — взмах хвостом
        const head = cow.getData('head') ? 0 : 1;
        cow.setData('head', head);
        cow.setTexture(`lavka_cow${head}0`);
        if (!this.lite && Math.random() < 0.35) {
          this.time.delayedCall(180, () => cow.active && cow.setTexture(`lavka_cow${head}1`));
          this.time.delayedCall(420, () => cow.active && cow.setTexture(`lavka_cow${head}0`));
        }
        // Полная — стоит и ждёт; сытая бродит по загону; без сена — тянется к пустой поилке.
        if (this.day.cows[i] < 1 && Math.random() < 0.3) {
          const toTrough = this.day.hay <= 0;
          const nx = toTrough ? TROUGH.x + 18 : Phaser.Math.Clamp(cow.x + Phaser.Math.Between(-16, 16), PADDOCK.x0 + 16, PADDOCK.x1 - 16);
          const ny = toTrough ? TROUGH.y + 8 : Phaser.Math.Clamp(cow.y + Phaser.Math.Between(-6, 6), PADDOCK.y0 + 8, PADDOCK.y1);
          cow.setFlipX(nx < cow.x);
          this.tweens.add({ targets: cow, x: nx, y: ny, duration: 2400, ease: 'Sine.easeInOut', onUpdate: () => {
            cow.setDepth(cow.y);
            shade.setPosition(cow.x, cow.y - 1).setDepth(cow.y - 1);
          } });
        }
        this.time.delayedCall(Phaser.Math.Between(900, 2600), chew);
      };
      this.time.delayedCall(Phaser.Math.Between(200, 1600), chew);
    });
    // Куры в выгуле: клюют, перебегают; за двумя — цыплята.
    for (let i = 0; i < HENS; i++) {
      const v = i % 3;
      const hen = this.art(Phaser.Math.Between(RUN.x0, RUN.x1), Phaser.Math.Between(RUN.y0, RUN.y1), `lavka_hen${v}0`).setOrigin(0.5, 1);
      hen.setDepth(hen.y).setFlipX(Math.random() < 0.5);
      const peck = (): void => {
        if (!hen.active) return;
        if (Math.random() < 0.5) {
          hen.setTexture(`lavka_hen${v}1`);
          this.time.delayedCall(260, () => hen.active && hen.setTexture(`lavka_hen${v}0`));
        } else {
          const nx = Phaser.Math.Clamp(hen.x + Phaser.Math.Between(-12, 12), RUN.x0, RUN.x1);
          const ny = Phaser.Math.Clamp(hen.y + Phaser.Math.Between(-5, 5), RUN.y0, RUN.y1);
          hen.setFlipX(nx < hen.x);
          this.tweens.add({ targets: hen, x: nx, y: ny, duration: 520, onUpdate: () => hen.setDepth(hen.y) });
        }
        this.time.delayedCall(Phaser.Math.Between(500, 1800), peck);
      };
      this.time.delayedCall(Phaser.Math.Between(0, 1500), peck);
      if (!this.lite && i < 2) {
        for (let c = 0; c < 2; c++) {
          const chick = this.art(hen.x + 5 + c * 5, hen.y + 1, 'lavka_chick0').setOrigin(0.5, 1).setDepth(hen.y + 1);
          const follow = (): void => {
            if (!chick.active) return;
            const tx = hen.x + (hen.flipX ? 8 : -8) + c * 5;
            const ty = hen.y + 1 + c;
            chick.setFlipX(tx < chick.x).setTexture('lavka_chick1');
            this.tweens.add({ targets: chick, x: tx, y: ty, duration: 260, onUpdate: () => chick.setDepth(chick.y), onComplete: () => chick.active && chick.setTexture('lavka_chick0') });
            this.time.delayedCall(Phaser.Math.Between(350, 900), follow);
          };
          this.time.delayedCall(Phaser.Math.Between(0, 600), follow);
        }
      }
    }
    // Утки на пруду.
    for (let i = 0; i < 2; i++) {
      const duck = this.art(Phaser.Math.Between(POND.x0, POND.x1), Phaser.Math.Between(POND.y0, POND.y1), `lavka_duck${i}`).setOrigin(0.5, 1);
      duck.setDepth(duck.y);
      const swim = (): void => {
        if (!duck.active) return;
        const nx = Phaser.Math.Between(POND.x0, POND.x1);
        duck.setFlipX(nx < duck.x);
        this.tweens.add({ targets: duck, x: nx, y: Phaser.Math.Between(POND.y0, POND.y1), duration: Phaser.Math.Between(2600, 4200), ease: 'Sine.easeInOut', onUpdate: () => duck.setDepth(duck.y), onComplete: () => this.time.delayedCall(Phaser.Math.Between(400, 1600), swim) });
      };
      swim();
    }
    // Пчёлы вьются у ульев.
    for (let i = 0; i < (this.lite ? 3 : 8); i++) {
      const h = HIVES[i % HIVES.length];
      const bee = this.art(h.x, h.y - 20, 'lavka_bee').setDepth(500);
      const buzz = (): void => {
        if (!bee.active) return;
        this.tweens.add({ targets: bee, x: h.x + Phaser.Math.Between(-14, 14), y: h.y - Phaser.Math.Between(12, 34), duration: Phaser.Math.Between(400, 900), ease: 'Sine.easeInOut', onComplete: buzz });
      };
      buzz();
    }
    this.ambient();
    // Трактор время от времени проезжает по дорожке с урожаем на рынок (справа налево, не останавливаясь).
    const pass = (): void => {
      if (!this.hayRun && this.phase === 'day') this.tractorRun(false);
      this.time.delayedCall(Phaser.Math.Between(30000, 45000), pass);
    };
    this.time.delayedCall(14000, pass);
  }

  /** Бабочки над огородом и цветами, тени облаков плывут по ферме, спелое поблёскивает. */
  private ambient(): void {
    if (this.lite) return;
    for (let i = 0; i < 3; i++) {
      const b = this.fx('butterfly', Phaser.Math.Between(20, 230), Phaser.Math.Between(10, 150), 0.6, 600);
      if (!b) continue;
      const drift = (): void => {
        if (!b.active) return;
        const nx = Phaser.Math.Between(10, 240);
        b.setFlipX(nx < b.x);
        this.tweens.add({ targets: b, x: nx, y: Phaser.Math.Between(0, 200), duration: Phaser.Math.Between(5000, 9000), ease: 'Sine.easeInOut', onComplete: drift });
      };
      drift();
    }
    for (let i = 0; i < 2; i++) {
      const cloud = this.add.ellipse(-80 + i * 180, 40 + i * 110, 110, 46, 0x1a2a3a, 0.1).setDepth(900);
      const sail = (): void => {
        if (!cloud.active) return;
        cloud.x = -70;
        cloud.y = Phaser.Math.Between(-30, 220);
        this.tweens.add({ targets: cloud, x: WORLD_W + 70, duration: Phaser.Math.Between(38000, 52000), onComplete: sail });
      };
      this.tweens.add({ targets: cloud, x: WORLD_W + 70, duration: 30000 + i * 12000, onComplete: sail });
    }
    this.time.addEvent({ delay: 900, loop: true, callback: () => {
      if (this.phase !== 'day') return;
      const ripe = this.day.beds.map((b, i) => (b.seed && b.grow >= 1 ? i : -1)).filter((i) => i >= 0);
      if (!ripe.length) return;
      const i = Phaser.Utils.Array.GetRandom(ripe);
      const x = BED_X[i % 3] + BED_W / 2 + Phaser.Math.Between(-28, 28);
      const y = BED_Y[Math.floor(i / 3)] + Phaser.Math.Between(4, 26);
      pixelFx.burst(this, 'star', x, y, { zoom: 1, fade: 300 });
    } });
  }

  /** Трактор с прицепом едет по дорожке справа налево — носом вперёд, не разворачиваясь. С сеном (hay) встаёт у
   *  сенника и разгружается: тюки по одному перелетают в сенник; без сена — просто проезжает с урожаем на рынок. */
  private tractorRun(hay: boolean): void {
    const tractor = this.art(WORLD_W + 34, LANE_Y, 'lavka_tractor').setOrigin(0.5, 1).setDepth(LANE_Y).setFlipX(true);
    const cart = this.art(WORLD_W + 61, LANE_Y - 1, 'lavka_cart').setOrigin(0.5, 1).setDepth(LANE_Y - 1).setFlipX(true);
    const follow = (): void => {
      cart.x = tractor.x + 27;
    };
    let moving = true;
    const smoke = this.time.addEvent({ delay: 380, loop: true, callback: () => {
      if (this.lite || !moving || !tractor.active) return;
      const p = this.art(tractor.x - 9, LANE_Y - 27, 'lavka_puff').setDepth(LANE_Y + 1).setAlpha(0.7).setScale(0.4 / ART);
      this.tweens.add({ targets: p, y: p.y - 8, x: p.x + 4, alpha: 0, scale: 0.9 / ART, duration: 900, onComplete: () => p.destroy() });
    } });
    const away = (): void => {
      moving = true;
      this.tweens.add({ targets: tractor, x: -70, duration: ((TRACTOR_STOP + 70) / 36) * 1000, ease: 'Sine.easeIn', onUpdate: follow, onComplete: () => {
        smoke.remove();
        tractor.destroy();
        cart.destroy();
      } });
    };
    if (!hay) {
      this.tweens.add({ targets: tractor, x: -70, duration: ((WORLD_W + 104) / 34) * 1000, onUpdate: follow, onComplete: () => {
        smoke.remove();
        tractor.destroy();
        cart.destroy();
      } });
      return;
    }
    this.tweens.add({ targets: tractor, x: TRACTOR_STOP, duration: ((WORLD_W + 34 - TRACTOR_STOP) / 36) * 1000, ease: 'Sine.easeOut', onUpdate: follow, onComplete: () => {
      moving = false;
      if (this.phase === 'day') this.day = feedHay(this.day).day;
      // тюки перелетают из прицепа в сенник по одному (их показывает showFarm, тут — летящие)
      const n = BALES.length;
      for (let k = 0; k < n; k++) {
        const to = BALES[k];
        const b = this.art(cart.x, LANE_Y - 10, 'lavka_hay').setDepth(1001).setScale(0.8 / ART);
        this.bales[k]?.setAlpha(0);
        this.tweens.add({ targets: b, x: to.x, duration: 360, delay: k * 120, ease: 'Sine.easeInOut', onComplete: () => {
          b.destroy();
          this.bales[k]?.setAlpha(1);
          this.squash(this.bales[k], 1.15, 0.8, 70);
          sound.pop(1, to.x);
        } });
        this.tweens.add({ targets: b, y: { from: LANE_Y - 10, to: to.y }, scale: 1 / ART, duration: 360, delay: k * 120, ease: (v: number) => v - 0.8 * Math.sin(v * Math.PI) });
      }
      this.time.delayedCall(n * 120 + 700, () => {
        this.hayRun = false;
        away();
      });
    } });
  }

  /** Машины на трассе: сверху едут влево, снизу — вправо. */
  private traffic(dt: number): void {
    this.nextCar -= dt;
    if (this.nextCar > 0) return;
    this.nextCar = Phaser.Math.FloatBetween(3, 6.5);
    const right = Math.random() < 0.5;
    const key = Phaser.Utils.Array.GetRandom(['car_sedan', 'car_hatch', 'car_taxi', 'car_van', 'car_truck']) as string;
    const tint = key === 'car_taxi' ? 0xffffff : (Phaser.Utils.Array.GetRandom([0xe43b44, 0x5b6ee1, 0xffffff, 0x3e8948, 0xfee761, 0x8b9bb4]) as number);
    const y = right ? 433 : 417;
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
    // На ферме людей пока нет — там работает игрок (сотрудники появятся позже). В лавке — папа за прилавком.
    this.father = npc(COUNTER.x, 322, { shirt: 0x37946e, pants: 0x3a4466, skin: 0xf2d3ab, hair: 0x4a2c1a, style: 'short', acc: 'apron', accTint: 0xe4a672 }, 'down');
    // Валя на лавочке у дороги.
    npc(204, 389, { shirt: 0xa22633, skin: 0xf2d3ab, hair: 0xc0cbdc, style: 'curly' }, 'down', 'lavka.say.valya', ['down', 'left']);
  }

  /** Стоят на месте, но живые: изредка поворачиваются и говорят. */
  private idle(dt: number): void {
    for (const n of this.npcs) {
      if (n.turns && Math.random() < dt * 0.25) persons.setFacing(n.p, Phaser.Utils.Array.GetRandom(n.turns) as Facing);
    }
    this.nextChat -= dt;
    if (this.nextChat > 0) return;
    this.nextChat = Phaser.Math.FloatBetween(7, 12);
    const talkers = this.npcs.filter((n) => n.say && this.onScreen(n.p.y));
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

  /** Товар на полках — сколько есть на складе: бутылки в холодильнике, яйца и мёд на полках. */
  private refreshStock(): void {
    const fill = (list: Phaser.GameObjects.Image[], shelf: { x: number; y: number }, keys: string[], n: number, rows: [number, number]): Phaser.GameObjects.Image[] => {
      for (const it of list) it.destroy();
      const out: Phaser.GameObjects.Image[] = [];
      const left = shelf.x - 20;
      for (let k = 0; k < Math.min(12, n); k++) {
        const row = Math.floor(k / 6);
        const x = left + (8 + (k % 6) * 11 + 5.5) / ART;
        out.push(this.art(x, shelf.y - 32 + rows[row] / ART, keys[k % keys.length]).setOrigin(0.5, 1).setDepth(shelf.y + 0.1));
      }
      return out;
    };
    const st = this.day.stock;
    this.milkItems = fill(this.milkItems, MILK_SHELF, ['item_milk', 'item_milk_0', 'item_milk_1', 'item_milk_2'], st.milk, [30, 52]);
    this.eggShelf = fill(this.eggShelf, EGG_SHELF, ['lavka_egg', 'lavka_egg_brown'], st.eggs, [30, 52]);
    this.honeyShelf = fill(this.honeyShelf, HONEY_SHELF, ['lavka_ico_honey'], st.honey, [30, 52]);
  }

  // ---------- день ----------

  /** Первый день — сразу, без окна: заказы видны карточками внизу. */
  private morning(): void {
    this.plan = planFor(this.dayIndex);
    this.day = startDay(this.plan);
    this.beginDay();
  }

  private beginDay(): void {
    this.phase = 'day';
    this.queueList = visitors(this.plan, this.dayIndex + 1);
    this.seen = { bus: false, trains: 0 };
    this.refreshStock();
    sound.bell(DOOR_OUT.x);
    this.hud.say(t('lavka.dayStart', { dow: dowName(this.plan) }), 3500);
  }

  /** Вечер: лавка закрывается, итог дня — строкой сверху; короткая ночь — и утро следующего дня, ферма как была. */
  private closeDay(): void {
    this.phase = 'evening';
    this.closeSeeds?.();
    this.closeSeeds = null;
    this.hud.say(t('lavka.hint.closing'), 2500);
    for (const g of [...this.guests]) if (!g.gone) this.leave(g);
    const s = summary(this.day);
    if (s.stars >= 4) pixelFx.burst(this, 'confetti', BACK_DOOR.x, 120);
    dayToast(t('lavka.sum.title', { dow: dowName(this.plan) }), s);
    this.time.delayedCall(6000 / this.speed, () => {
      if (!this.scene.isActive()) return;
      this.dayIndex += 1;
      this.plan = planFor(this.dayIndex);
      this.day = nextDay(this.day, this.plan);
      this.beginDay();
    });
  }

  update(_time: number, deltaMs: number): void {
    const dt = (deltaMs / 1000) * this.speed;
    this.animatePeople();
    this.idle(dt);
    this.traffic(dt);
    const progress = this.phase === 'evening' ? 1 : this.day.t / DAY_SECONDS;
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
      once('egg', d.eggs >= 3 && d.t > 12, 'lavka.hint.egg') ||
      once('hay', d.hay <= 1, 'lavka.hint.hay') ||
      once('grain', d.grain <= 1, 'lavka.hint.grain');
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
    const via = spot.y < SHELF_ROW ? [{ x: DOOR_IN.x, y: spot.y + 4 }] : [];
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
    const via = feet < SHELF_ROW ? [{ x: DOOR_IN.x, y: feet + 4 }, { x: DOOR_IN.x, y: 348 }] : [];
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
    const inside = feet < 368;
    const back: { x: number; y: number }[] = [];
    if (inside) {
      if (feet < SHELF_ROW) back.push({ x: DOOR_IN.x, y: feet + 4 });
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
