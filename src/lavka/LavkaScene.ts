// «Лавка «Своё»» — играбельный день второй игры (docs/farm/mockup): мир по макету — ферма, лавка с сыроварней
// и пекарней, трасса, дачный посёлок со станцией. Утром — решение: сколько молока на сыр (lavkaUi.morningSheet),
// днём — касса, молочная полка и сыроварня, вечером — итоги. Правила и цифры — game/lavka/day.ts; картинки и
// раскладка — art/lavka.py (layout.json); здесь только мир: как он выглядит и двигается.
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
  DAY_SECONDS,
  carryCheese,
  cheeseReadyAt,
  clock,
  isOver,
  miss,
  pay,
  planFor,
  restockMilk,
  startDay,
  summary,
  take,
  tick,
  tired,
  visitors,
  type Basket,
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
import { LavkaHud, dowName, morningSheet, showSummary } from './lavkaUi';
import layout from './layout.json';

/** Мир в точках (рисунок 640×1300 пикселей, ART = 2). Полосы — те же, что в art/lavka.py. */
const WORLD_W = 320;
const WORLD_H = 650;
/** Ноги человечка ниже середины его картинки (тень у makePerson — на 8,5). */
const FOOT = 8;

const DOOR_IN = { x: 160, y: 292 };
const DOOR_OUT = { x: 160, y: 318 };
const PLAZA = { x: 160, y: 346 };
const STREET_Y = 362;
const AISLE_X = 178;
/** Где встают у товара (ноги) и куда смотрят. */
const SPOTS: Record<Good, { x: number; y: number }> = {
  milk: { x: 111, y: 214 },
  jam: { x: 152, y: 214 },
  bread: { x: 193, y: 214 },
  veg: { x: 125, y: 259 },
  cheese: { x: 112, y: 297 },
};
const QUEUE = [
  { x: 205, y: 287 },
  { x: 217, y: 294 },
  { x: 227, y: 300 },
  { x: 193, y: 300 },
];
const MILK_SHELF = { x: 111, y: 203 };
const CASE = { x: 112, y: 288 };
const COUNTER = { x: 206, y: 274 };
const ICEBOX = { x: 62, y: 286 };
const VAT = { x: 46, y: 248 };
/** Сыроварня — вся левая комната: нажатие по ней относит готовый сыр. */
const CHEESE_ROOM = { x: 9, y: 154, w: 75, h: 149 };
const BUS_STOP = { x: 46, y: 393 };
const TRAIN_STOP = { x: 235, y: 650 };
const PLATFORM_Y = 617;
const LANE_X = 160;
/** Терпение у кассы (мс игры) и сколько людей разом в лавке. */
const PATIENCE_MS = 18_000;
const MAX_INSIDE = 9;

const CARRY: Record<Good, string> = { milk: 'item_milk', cheese: 'lavka_wheel', veg: 'item_apples', bread: 'item_bread', jam: 'item_jam' };

interface Guest {
  p: Phaser.GameObjects.Container;
  v: Visitor;
  basket: Basket[];
  /** Встал первым у кассы (время сцены); 0 — ещё нет. */
  readyAt: number;
  gone: boolean;
  /** Откуда пришёл — туда и уйдёт; у электрички — своя точка на платформе. */
  home: { x: number; y: number };
}

interface Npc {
  p: Phaser.GameObjects.Container;
  say?: TextKey;
  /** Куда может повернуться, пока стоит. */
  turns?: Facing[];
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
  private lastChoice = 6;
  private day: Day = startDay(6);
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
  private train?: Phaser.GameObjects.Image;
  private hinted = new Set<string>();
  private seen = { bus: false, trains: 0, cheese: false };
  private closeMorning: (() => void) | null = null;
  private drag = { down: false, y: 0, scroll: 0, moved: false };
  private nextCar = 2;
  private nextChat = 6;
  private nextPuff = 0;
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
    this.add.image(0, 0, 'lavka_ground').setOrigin(0).setScale(1 / ART).setDepth(-100);
    for (const p of layout.props as { k: string; x: number; y: number; z?: number; tint?: number; flip?: boolean }[]) {
      const img = this.art(p.x, p.y, p.k).setOrigin(0.5, 1).setDepth(p.z ?? p.y);
      if (p.tint !== undefined) img.setTint(p.tint);
      if (p.flip) img.setFlipX(true);
    }
    // Вывеска и таблички комнат — шрифтом игры.
    this.worldText(160.5, 302, t('lavka.sign'), 4.2, '#fee761').setDepth(309).setStroke('#181425', 6);
    this.plaque(46, 158, t('lavka.room.cheese'));
    this.plaque(160, 158, t('lavka.room.shop'));
    this.plaque(274, 158, t('lavka.room.bakery'));
    this.plaque(75, 606, t('lavka.station'), 0x124e89);
    // Молочная полка (товар меняется) и витрина сыров.
    this.art(MILK_SHELF.x, MILK_SHELF.y, 'shelf').setOrigin(0.5, 1).setDepth(MILK_SHELF.y);
    this.art(MILK_SHELF.x, MILK_SHELF.y, 'shelf_front').setOrigin(0.5, 1).setDepth(MILK_SHELF.y + 0.2);
    this.art(CASE.x, CASE.y, 'lavka_case').setOrigin(0.5, 1).setDepth(CASE.y);
    // Прогресс сыра над чаном.
    this.vatBack = this.add.rectangle(VAT.x, VAT.y - 7, 22, 3, 0x262b44).setDepth(990).setStrokeStyle(0.5, 0x181425);
    this.vatBar = this.add.rectangle(VAT.x - 11, VAT.y - 7, 0, 3, 0xfee761).setOrigin(0, 0.5).setDepth(991);
    this.animals();
    this.staff();
    this.tapZones();
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
    cam.setBounds(0, -40, WORLD_W, WORLD_H + 60);
    this.visible = this.scale.height / cam.zoom;
    // Весь мир влез — посередине; не влез — лавка и улица перед ней, остальное — пальцем.
    cam.centerOn(WORLD_W / 2, this.visible >= WORLD_H ? WORLD_H / 2 : 262);
  }

  // ---------- жизнь вокруг ----------

  private animals(): void {
    const cows: [number, number, number, boolean][] = [
      [274, 101, 0, true],
      [302, 114, 1, false],
      [260, 116, 0, true],
    ];
    for (const [x, y, v, flip] of cows) {
      const cow = this.art(x, y, `lavka_cow${v}0`).setOrigin(0.5, 1).setDepth(y).setFlipX(flip);
      // Жуёт: голова то вверх, то к траве; иногда переступает.
      const chew = (): void => {
        if (!cow.active) return;
        const down = cow.texture.key.endsWith('0');
        cow.setTexture(`lavka_cow${v}${down ? 1 : 0}`);
        if (Math.random() < 0.25) {
          const nx = Phaser.Math.Clamp(cow.x + Phaser.Math.Between(-6, 6), 250, 312);
          cow.setFlipX(nx < cow.x);
          this.tweens.add({ targets: cow, x: nx, duration: 900, ease: 'Sine.easeInOut' });
        }
        this.time.delayedCall(Phaser.Math.Between(900, 2600), chew);
      };
      this.time.delayedCall(Phaser.Math.Between(200, 1600), chew);
    }
    const hens: [number, number, number, number][] = [
      [14, 84, 134, 148],
      [76, 124, 540, 552],
    ];
    for (const [x0, x1, y0, y1] of hens) {
      for (let i = 0; i < (x0 < 50 ? 7 : 4); i++) {
        const v = i % 3;
        const hen = this.art(Phaser.Math.Between(x0, x1), Phaser.Math.Between(y0, y1), `lavka_hen${v}0`).setOrigin(0.5, 1);
        hen.setDepth(hen.y).setFlipX(Math.random() < 0.5);
        const peck = (): void => {
          if (!hen.active) return;
          if (Math.random() < 0.5) {
            hen.setTexture(`lavka_hen${v}1`);
            this.time.delayedCall(260, () => hen.active && hen.setTexture(`lavka_hen${v}0`));
          } else {
            const nx = Phaser.Math.Clamp(hen.x + Phaser.Math.Between(-7, 7), x0, x1);
            const ny = Phaser.Math.Clamp(hen.y + Phaser.Math.Between(-3, 3), y0, y1);
            hen.setFlipX(nx < hen.x);
            this.tweens.add({ targets: hen, x: nx, y: ny, duration: 500, onUpdate: () => hen.setDepth(hen.y) });
          }
          this.time.delayedCall(Phaser.Math.Between(500, 1800), peck);
        };
        this.time.delayedCall(Phaser.Math.Between(0, 1500), peck);
      }
    }
    // Пчёлы у ульев.
    for (let i = 0; i < 6; i++) {
      const bee = this.art(Phaser.Math.Between(196, 226), Phaser.Math.Between(48, 62), 'lavka_bee').setDepth(120);
      const buzz = (): void => {
        if (!bee.active) return;
        this.tweens.add({ targets: bee, x: Phaser.Math.Between(192, 230), y: Phaser.Math.Between(44, 64), duration: Phaser.Math.Between(400, 900), ease: 'Sine.easeInOut', onComplete: buzz });
      };
      buzz();
    }
  }

  /** Дым из трубы бани и пар над чаном, пока зреет сыр. */
  private puffs(dt: number): void {
    this.nextPuff -= dt;
    if (this.nextPuff > 0) return;
    this.nextPuff = this.lite ? 1.4 : 0.6;
    const smoke = (x: number, y: number, rise: number, scale: number): void => {
      const puff = this.art(x, y, 'lavka_puff').setDepth(y + 40).setAlpha(0.85).setScale(scale / ART);
      this.tweens.add({ targets: puff, y: y - rise, x: x + Phaser.Math.Between(2, 6), alpha: 0, scale: (scale * 1.8) / ART, duration: 2200, onComplete: () => puff.destroy() });
    };
    smoke(35, 556, 22, 1);
    if (this.phase === 'day' && this.day.cheeseMaking > 0) smoke(VAT.x + Phaser.Math.Between(-4, 4), VAT.y - 10, 10, 0.6);
  }

  /** Машины на трассе: сверху едут влево, снизу — вправо. */
  private traffic(dt: number): void {
    this.nextCar -= dt;
    if (this.nextCar > 0) return;
    this.nextCar = Phaser.Math.FloatBetween(3, 6.5);
    const right = Math.random() < 0.5;
    const key = Phaser.Utils.Array.GetRandom(['car_sedan', 'car_hatch', 'car_taxi', 'car_van', 'car_truck']) as string;
    const tint = key === 'car_taxi' ? 0xffffff : (Phaser.Utils.Array.GetRandom([0xe43b44, 0x5b6ee1, 0xffffff, 0x3e8948, 0xfee761, 0x8b9bb4]) as number);
    const y = right ? 434 : 415;
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
    // Ферма.
    npc(110, 80, { shirt: 0x5b6ee1, skin: 0xd9a066, hair: 0x733e39, style: 'short', outfit: 'overalls', hat: 'straw', prop: 'basket' }, 'down', undefined, ['down', 'left', 'right']);
    npc(43, 56, { shirt: 0xd95763, skin: 0xf2d3ab, hair: 0xfeae34, style: 'ponytail', hat: 'bandana', hatTint: 0xe43b44 }, 'up', undefined, ['up', 'left', 'right']);
    npc(210, 108, { shirt: 0xffffff, pants: 0x262b44, skin: 0xeec39a, hair: 0xc0cbdc, style: 'bald', outfit: 'overalls', hat: 'flatcap', hatTint: 0x5a6988, face: 'beard' }, 'down', 'lavka.say.mitya', ['down', 'left']);
    npc(287, 111, { shirt: 0xf6757a, skin: 0xf2d3ab, hair: 0xfeae34, style: 'ponytail', hat: 'headscarf', hatTint: 0xe43b44, acc: 'apron' }, 'left');
    npc(75, 127, { shirt: 0xfbf236, skin: 0xd9a066, hair: 0x181425, style: 'curly', prop: 'basket' }, 'down', undefined, ['down', 'left', 'right']);
    // Сыроварня.
    this.cheesemaker = npc(68, 236, { shirt: 0xffffff, pants: 0x262b44, skin: 0xf2d3ab, hair: 0x733e39, style: 'bun', acc: 'apron', hat: 'headscarf', hatTint: 0xffffff }, 'down', 'lavka.say.cheesemaker');
    npc(22, 262, { shirt: 0xffffff, skin: 0xd9a066, hair: 0x181425, style: 'long', acc: 'apron' }, 'right', undefined, ['right', 'up']);
    // Папа за прилавком.
    this.father = npc(COUNTER.x, 262, { shirt: 0x37946e, pants: 0x3a4466, skin: 0xf2d3ab, hair: 0x4a2c1a, style: 'short', acc: 'apron', accTint: 0xe4a672 }, 'down');
    // Пекарня.
    npc(274, 226, { shirt: 0xffffff, skin: 0xeec39a, hair: 0x181425, style: 'short', outfit: 'chefcoat', hat: 'toque', face: 'mustache' }, 'down', 'lavka.say.marat', ['down', 'left']);
    npc(260, 236, { shirt: 0xffffff, skin: 0xf2d3ab, hair: 0xfeae34, style: 'ponytail', acc: 'apron' }, 'up', undefined, ['up', 'left']);
    // Валя на лавочке у входа.
    npc(290, 333, { shirt: 0xa22633, skin: 0xf2d3ab, hair: 0xc0cbdc, style: 'curly' }, 'down', 'lavka.say.valya', ['down', 'left']);
    // Посёлок: бабушка у грядок, соседи за самоваром.
    npc(235, 512, { shirt: 0xb55088, skin: 0xf2d3ab, hair: 0xffffff, style: 'bun', outfit: 'cardigan', outfitTint: 0xc4a8e8, hat: 'headscarf', hatTint: 0xfee761, glasses: true }, 'down', 'lavka.say.granny', ['down', 'left', 'right']);
    npc(250, 560, { shirt: 0x5b6ee1, skin: 0xf2d3ab, hair: 0x4a2c1a, style: 'long' }, 'right');
    npc(274, 558, { shirt: 0xfbf236, skin: 0xeec39a, hair: 0xfeae34, style: 'curly' }, 'left');
    npc(123, 532, { shirt: 0xffffff, pants: 0x262b44, skin: 0xf2d3ab, hair: 0xc0cbdc, style: 'bald', face: 'beard', hat: 'straw', outfit: 'overalls', prop: 'cane' }, 'left', undefined, ['left', 'down']);
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

  // ---------- касания ----------

  private tapZones(): void {
    const zone = (x: number, y: number, w: number, h: number, fn: () => void): void => {
      this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.drag.moved) return;
        fn();
      });
    };
    zone(COUNTER.x - 34, COUNTER.y - 30, 68, 34, () => this.serve());
    zone(186, 280, 46, 24, () => this.serve());
    zone(MILK_SHELF.x - 22, MILK_SHELF.y - 34, 44, 40, () => this.refillMilk());
    zone(CHEESE_ROOM.x, CHEESE_ROOM.y, CHEESE_ROOM.w, CHEESE_ROOM.h, () => this.carry());
  }

  private serve(): void {
    if (this.phase !== 'day') return;
    const g = this.queue[0];
    if (!g || !g.readyAt || g.gone) return;
    haptic.tap();
    this.hinted.add('serve');
    this.payGuest(g);
  }

  private payGuest(g: Guest): void {
    const paid = pay(this.day, g.basket);
    this.day = paid.day;
    sound.till(COUNTER.x, paid.coins);
    this.popup(COUNTER.x, COUNTER.y - 24, `+${paid.coins} 💰`, '#fee761');
    pixelFx.burst(this, 'coinpop', COUNTER.x, COUNTER.y - 14, { zoom: 1 });
    persons.setMood(this, g.p, 'happy', 1500);
    persons.setMood(this, this.father, 'happy', 900);
    this.leave(g);
  }

  private refillMilk(): void {
    if (this.phase !== 'day') return;
    const r = restockMilk(this.day);
    if (!r.n) {
      this.popup(MILK_SHELF.x, MILK_SHELF.y - 36, t(this.day.milkIce ? 'lavka.shelfFull' : 'lavka.iceEmpty'), '#c0cbdc');
      return;
    }
    haptic.tap();
    this.hinted.add('milk');
    this.day = r.day;
    this.fly('item_milk', ICEBOX, { x: MILK_SHELF.x, y: MILK_SHELF.y - 18 }, Math.min(r.n, 4), () => this.refreshStock());
    sound.pop(1, MILK_SHELF.x);
  }

  private carry(): void {
    if (this.phase !== 'day') return;
    const r = carryCheese(this.day);
    if (!r.n) {
      const text = this.day.cheeseMaking ? t('lavka.wait', { time: clock(cheeseReadyAt(this.day.heads)) }) : !this.day.heads ? t('lavka.noCheeseToday') : t('lavka.shelfFull');
      this.popup(VAT.x, VAT.y - 26, text, '#c0cbdc');
      return;
    }
    haptic.tap();
    this.hinted.add('cheese');
    this.day = r.day;
    sound.good();
    this.fly('lavka_wheel', VAT, { x: CASE.x, y: CASE.y - 10 }, r.n, () => {
      this.refreshStock();
      pixelFx.burst(this, 'star', CASE.x, CASE.y - 12, { zoom: 1 });
    });
  }

  /** Товар летит дугой из from в to (по одному с задержкой), потом done. */
  private fly(key: string, from: { x: number; y: number }, to: { x: number; y: number }, n: number, done: () => void): void {
    for (let k = 0; k < n; k++) {
      const img = this.art(from.x, from.y, key).setDepth(1001);
      this.tweens.add({ targets: img, x: to.x + Phaser.Math.Between(-4, 4), duration: 600, delay: k * 90, ease: 'Sine.easeInOut', onComplete: () => {
        img.destroy();
        if (k === n - 1) done();
      } });
      this.tweens.add({ targets: img, y: { from: from.y, to: to.y }, duration: 600, delay: k * 90, ease: (v: number) => v - 0.9 * Math.sin(v * Math.PI) });
    }
  }

  /** Бутылки на молочной полке и головки на витрине — сколько есть. */
  private refreshStock(): void {
    for (const it of this.milkItems) it.destroy();
    this.milkItems = [];
    const left = MILK_SHELF.x - 20;
    const variants = ['item_milk', 'item_milk_0', 'item_milk_1', 'item_milk_2'];
    for (let k = 0; k < this.day.milkShelf; k++) {
      const x = left + (8 + k * 11 + 5.5) / ART;
      this.milkItems.push(this.art(x, MILK_SHELF.y - 32 + 15, variants[k % variants.length]).setOrigin(0.5, 1).setDepth(MILK_SHELF.y + 0.1));
    }
    for (const it of this.caseItems) it.destroy();
    this.caseItems = [];
    for (let k = 0; k < this.day.cheeseCase; k++) {
      const x = CASE.x - 16 + (9 + k * 13) / ART;
      this.caseItems.push(this.art(x, CASE.y - 15 + 5.5, 'lavka_wheel').setOrigin(0.5, 1).setDepth(CASE.y + 0.1));
    }
  }

  // ---------- день ----------

  private morning(): void {
    this.phase = 'morning';
    this.plan = planFor(this.dayIndex);
    this.day = startDay(this.lastChoice);
    this.day = { ...this.day, t: 0 };
    this.hinted.clear();
    this.seen = { bus: false, trains: 0, cheese: false };
    this.refreshStock();
    this.updateVat();
    this.closeMorning = morningSheet(this.plan, this.lastChoice, (cans) => {
      this.closeMorning = null;
      this.lastChoice = cans;
      this.openDay(cans);
    });
  }

  private openDay(cheeseCans: number): void {
    this.phase = 'day';
    this.day = startDay(cheeseCans);
    this.queueList = visitors(this.plan, this.dayIndex + 1);
    this.refreshStock();
    sound.bell(DOOR_OUT.x);
    if (this.day.heads) this.bubble(this.cheesemaker, t('lavka.heads', { n: this.day.heads, time: clock(cheeseReadyAt(this.day.heads)) }));
  }

  private closeDay(): void {
    this.phase = 'evening';
    this.hud.say(t('lavka.hint.closing'), 2500);
    // Кто стоит у кассы — папа рассчитает; кто ещё ходит — уходит.
    for (const g of [...this.queue]) if (g.readyAt) this.payGuest(g);
    for (const g of [...this.guests]) if (!g.gone) this.leave(g);
    const s = summary(this.day);
    if (s.stars >= 4) pixelFx.burst(this, 'confetti', DOOR_OUT.x, 280);
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
      milkShelf: this.day.milkShelf,
      milkIce: this.day.milkIce,
      cheeseMaking: this.day.cheeseMaking,
      cheeseReady: this.day.cheeseReady,
      cheeseCase: this.day.cheeseCase,
      readyAt: cheeseReadyAt(this.day.heads),
      open: this.phase === 'day',
    });
    const p = 0.04 + 0.82 * progress;
    this.grade?.apply(p, 'clear', Math.max(0, (p - 0.6) / 0.4));
    this.grade?.update();
    ambience.update('clear', Math.max(0, (p - 0.6) / 0.4), false, 'summer');
    if (this.phase !== 'day') return;
    const before = this.day;
    this.day = tick(this.day, dt);
    if (this.day.cheeseReady > before.cheeseReady) {
      this.bubble(this.cheesemaker, t('lavka.say.cheesemaker'));
      this.hint('cheese', t('lavka.hint.cheese'));
      sound.ding(VAT.x);
    }
    this.updateVat();
    this.vehicles();
    // Покупатели по расписанию дня.
    while (this.queueList.length && this.queueList[0].at <= this.day.t) {
      const v = this.queueList.shift() as Visitor;
      if (this.guests.size < MAX_INSIDE || v.from !== 'road') void this.runGuest(v);
    }
    // Не дождался у кассы — уходит недовольный, товар возвращается на полку.
    const head = this.queue[0];
    if (head?.readyAt && this.time.now - head.readyAt > PATIENCE_MS / this.speed) {
      this.day = tired(this.day, head.basket);
      this.refreshStock();
      this.emote(head.p, 'emo_angry');
      sound.bad();
      this.leave(head);
    }
    if (head?.readyAt && !this.hinted.has('serve')) this.hint('serve', t('lavka.hint.serve'));
    if (this.day.milkShelf <= 1 && this.day.milkIce > 0) this.hint('milk', t('lavka.hint.milk'));
    if (isOver(this.day)) this.closeDay();
  }

  private hint(id: string, text: string): void {
    if (this.hinted.has(id)) return;
    this.hinted.add(id);
    this.hud.say(text, 4200);
  }

  private updateVat(): void {
    const making = this.phase === 'day' && this.day.cheeseMaking > 0;
    const ready = cheeseReadyAt(this.day.heads);
    this.vatBack.setVisible(making);
    this.vatBar.setVisible(making);
    if (making) this.vatBar.width = 22 * Math.min(1, this.day.t / ready);
  }

  // ---------- автобус и электричка ----------

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
      this.seen.trains += 1;
      this.hud.say(t('lavka.hint.train'), 3000);
      this.train?.destroy();
      const train = this.art(WORLD_W + 100, TRAIN_STOP.y, 'lavka_train').setOrigin(0.5, 1).setDepth(TRAIN_STOP.y);
      this.train = train;
      sound.doorbell(TRAIN_STOP.x);
      this.tweens.add({ targets: train, x: TRAIN_STOP.x, duration: 3000, ease: 'Cubic.easeOut' });
      this.time.delayedCall(30_000 / this.speed, () => this.tweens.add({ targets: train, x: -120, duration: 5000, ease: 'Cubic.easeIn', onComplete: () => train.destroy() }));
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
      start = { x: BUS_STOP.x + 36, y: BUS_STOP.y - 6 };
      route = [{ x: 110, y: STREET_Y }, PLAZA];
    } else if (v.from === 'train') {
      start = { x: Phaser.Math.Between(200, 268), y: PLATFORM_Y };
      route = [{ x: LANE_X, y: 612 }, { x: LANE_X, y: 446 }, { x: LANE_X, y: 400 }, { x: LANE_X, y: STREET_Y }, PLAZA];
    } else {
      const left = Math.random() < 0.5;
      start = { x: left ? -12 : WORLD_W + 12, y: STREET_Y + Phaser.Math.Between(-2, 3) };
      route = [{ x: LANE_X + Phaser.Math.Between(-6, 6), y: STREET_Y }, PLAZA];
    }
    const p = persons.makePerson(this, start.x, start.y - FOOT, this.lookFor(v.from));
    p.setDepth(start.y);
    const g: Guest = { p, v, basket: [], readyAt: 0, gone: false, home: start };
    this.guests.add(g);
    if (v.from !== 'road' && Math.random() < 0.35) this.time.delayedCall(800, () => p.active && this.bubble(p, t(v.from === 'bus' ? 'lavka.say.tourist' : 'lavka.say.dacha')));
    await this.path(p, [...route, DOOR_OUT, DOOR_IN]);
    if (g.gone) return;
    // За главным товаром, потом — за довеском (если взял молоко).
    const wants: { good: Good; qty: number; main: boolean }[] = [{ good: v.wants, qty: v.qty, main: true }];
    if (v.extra) wants.push({ good: v.extra, qty: 1, main: false });
    for (const w of wants) {
      const spot = SPOTS[w.good];
      const via = spot.y < 240 ? [{ x: LANE_X, y: Math.max(spot.y, p.y + FOOT - 2) }, { x: LANE_X, y: spot.y }] : spot.y < 270 ? [{ x: LANE_X, y: spot.y }] : [];
      await this.path(p, [...via, spot]);
      if (g.gone) return;
      persons.setFacing(p, 'up');
      await this.pause(650);
      if (g.gone) return;
      if (this.phase !== 'day') return this.leave(g);
      const got = take(this.day, w.good, w.qty);
      if (!got.n) {
        if (!w.main) continue;
        this.day = miss(this.day, w.good);
        this.emote(p, 'emo_question');
        await this.pause(800);
        return this.leave(g);
      }
      this.day = got.day;
      g.basket.push({ good: w.good, n: got.n });
      this.refreshStock();
      sound.pop(0, spot.x);
      if (g.basket.length === 1) p.add(this.art(5, 2, CARRY[w.good]));
    }
    this.queue.push(g);
    await this.toQueue(g);
  }

  private async toQueue(g: Guest): Promise<void> {
    const i = this.queue.indexOf(g);
    if (i < 0 || g.gone) return;
    const spot = QUEUE[Math.min(i, QUEUE.length - 1)];
    const feet = g.p.y + FOOT;
    const via = feet < 282 ? [{ x: AISLE_X, y: feet }, { x: AISLE_X, y: 282 }] : [];
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
    const inside = feet < 304;
    const back: { x: number; y: number }[] = [];
    if (inside) {
      if (feet < 282) back.push({ x: AISLE_X, y: feet }, { x: AISLE_X, y: 290 });
      back.push(DOOR_IN, DOOR_OUT);
    }
    back.push(PLAZA);
    if (g.v.from === 'train') back.push({ x: LANE_X, y: STREET_Y }, { x: LANE_X, y: 400 }, { x: LANE_X, y: 446 }, { x: LANE_X, y: 612 }, g.home);
    else if (g.v.from === 'bus' && this.bus) back.push({ x: 110, y: STREET_Y }, g.home);
    else back.push({ x: LANE_X, y: STREET_Y }, { x: Math.random() < 0.5 ? -14 : WORLD_W + 14, y: STREET_Y });
    void this.path(p, back, true).then(() => {
      this.guests.delete(g);
      p.destroy();
    });
  }

  // ---------- люди ----------

  /** Идти по точкам (ноги); leaving — даже если уже «ушёл» (обычный путь обрывается, когда gone). */
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
