// Общая основа видов этажей (14.11): что сцена этажа (scenes/floorView.ts) даёт модулю этажа — FloorKit — и
// помощники, из которых этажи собираются одинаково: коробка зала (стены, пол, боковины, плинтус), предметы с
// глубиной по низу, круги света в духе основного зала (lighting.ts: тёплое пятно под лампой, в обычной графике чуть
// дышит), подписи и всплывашки, и маленькая система людей: поднялся по лестнице → прошёл по проходам к точкам →
// постоял, сделал своё → ушёл и растаял. Глубина — по низу (y), как в зале; в лёгкой графике — меньше людей и
// ничего не дышит. Модули этажей: floors/basementFloor.ts, floors/secondFloor.ts, floors/thirdFloor.ts.
//
// Всё здесь грузится вместе с видом этажа (по требованию), в первый файл игры не входит.

import Phaser from 'phaser';
import type { StoreScene } from '../StoreScene';
import type { Look } from '../common';
import { ART } from '../common';
import * as persons from '../persons';

export type Point = { x: number; y: number };
export type Facing = 'up' | 'down' | 'left' | 'right';
type Person = Phaser.GameObjects.Container;

/** Что сцена этажа даёт модулю этажа: свою сцену, магазин (состояние дня), размеры зала и рисовалки. */
export interface FloorKit {
  scene: Phaser.Scene;
  store: StoreScene;
  /** Размер зала этажа в точках мира и высота задней стены. */
  W: number;
  H: number;
  WALL: number;
  /** Лёгкая графика: меньше людей, без дыхания света и мигания. */
  lite: boolean;
  art(x: number, y: number, key: string): Phaser.GameObjects.Image;
  text(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text;
  /** Всплывающая строка над точкой (по касанию): цвет, глубина и сколько держится — у каждого этажа свои. */
  popup(x: number, y: number, s: string, style?: PopupStyle): void;
  person(x: number, y: number, look: Look): Person;
  /** Этаж уходит (переход на другой этаж или в зал): новые люди не появляются. */
  leaving(): boolean;
}

export interface PopupStyle {
  color?: string;
  depth?: number;
  /** Сколько мс строка висит, прежде чем всплыть и растаять. */
  hold?: number;
}

/** Модуль этажа: рисует свой зал в сцене этажа. */
export type FloorBuild = (kit: FloorKit) => void;

// ---------------------------------------------------------------- зал

/** Плитка текстуры (стена, пол) в точках мира: картинка рисунка — вдвое мельче (ART). */
export function tile(kit: FloorKit, x: number, y: number, w: number, h: number, key: string, depth = -10): Phaser.GameObjects.TileSprite {
  return kit.scene.add.tileSprite(x, y, w, h, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
}

export interface ShellOpts {
  wall: string;
  floor: string;
  /** Боковые стены: цвет и толщина. */
  side: number;
  sideW: number;
  /** Полосы поперёк зала (плинтус, тень у стены): y, высота, цвет, прозрачность. */
  strips?: [y: number, h: number, color: number, alpha?: number][];
}

/** Коробка зала: задняя стена, пол, полосы у стены и тёмные боковины поверх. */
export function shell(kit: FloorKit, o: ShellOpts): void {
  const { scene, W, H, WALL } = kit;
  tile(kit, 0, 0, W, WALL, o.wall);
  tile(kit, 0, WALL, W, H - WALL, o.floor);
  for (const [y, h, color, alpha] of o.strips ?? []) scene.add.rectangle(0, y, W, h, color, alpha).setOrigin(0).setDepth(-9);
  scene.add.rectangle(0, 0, o.sideW, H, o.side).setOrigin(0).setDepth(-8);
  scene.add.rectangle(W - o.sideW, 0, o.sideW, H, o.side).setOrigin(0).setDepth(-8);
}

/**
 * Предмет зала (окно, лестница, стойка, стол): по умолчанию стоит низом-серединой в (x, y) и глубина — по низу,
 * как в зале магазина: кто ниже на экране, тот ближе.
 */
export function prop(kit: FloorKit, x: number, y: number, key: string, o: { ox?: number; oy?: number; depth?: number; scale?: number } = {}): Phaser.GameObjects.Image {
  const img = kit.art(x, y, key).setOrigin(o.ox ?? 0.5, o.oy ?? 1).setDepth(o.depth ?? y);
  if (o.scale !== undefined) img.setScale(o.scale / ART);
  return img;
}

/** Меловой контур на полу — пустое место под будущую вещь (автомат, точку еды). */
export function chalkSpot(kit: FloorKit, x: number, y: number, w: number, h: number, color: number, alpha: number): Phaser.GameObjects.Rectangle {
  return kit.scene.add.rectangle(x, y, w, h).setStrokeStyle(0.5, color, alpha).setDepth(-7);
}

/** Табличка-заголовок этажа у задней стены. */
export function title(kit: FloorKit, x: number, y: number, s: string, color: string, bg?: string): Phaser.GameObjects.Text {
  const head = kit.text(x, y, s, 7, color).setDepth(1);
  if (bg) head.setBackgroundColor(bg).setPadding(3, 1, 3, 1);
  return head;
}

// ---------------------------------------------------------------- свет

export interface PoolOpts {
  w: number;
  h: number;
  tint: number;
  alpha: number;
  depth: number;
  /** Дыхание света в обычной графике (в лёгкой — горит ровно): до какой прозрачности (или '-=0.06') и за сколько мс. */
  breathe?: { alpha: number | string; ms: number };
}

/** Пятно света (ADD, как lighting.ts в зале): под лампой, у вывески, от экрана автомата. */
export function lightPool(kit: FloorKit, x: number, y: number, o: PoolOpts): Phaser.GameObjects.Image {
  const pool = kit.art(x, y, 'glow').setDisplaySize(o.w, o.h).setTint(o.tint).setAlpha(o.alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(o.depth);
  if (o.breathe && !kit.lite) kit.scene.tweens.add({ targets: pool, alpha: o.breathe.alpha, duration: o.breathe.ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return pool;
}

/**
 * Лампочка под потолком: на шнуре (у стены) или голая (дальше по залу), вокруг — тёплый круг на полу и ореол.
 * В обычной графике свет чуть дышит, в лёгкой — горит ровно.
 */
export function bulb(kit: FloorKit, x: number, y: number, cord: boolean, o: { tint?: number; pool?: number } = {}): void {
  const { scene } = kit;
  if (cord) scene.add.rectangle(x, 0, 0.6, y - 1, 0x181425).setOrigin(0.5, 0).setDepth(20);
  scene.add.circle(x, y, 1.6, 0xfee761).setDepth(20);
  const pool = kit.art(x, cord ? y + 38 : y + 4, 'glow').setDisplaySize(88, 70).setTint(o.tint ?? 0xfeae34).setAlpha(o.pool ?? 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
  const halo = kit.art(x, y, 'glow').setDisplaySize(18, 18).setTint(0xfee761).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(21);
  if (!kit.lite) scene.tweens.add({ targets: [pool, halo], alpha: '-=0.06', duration: 900 + x * 3, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

// ---------------------------------------------------------------- люди

/** Пауза на таймере сцены этажа (идёт со временем сцены, гаснет вместе с ней). */
export const pause = (kit: FloorKit, ms: number): Promise<void> => new Promise((done) => kit.scene.time.delayedCall(ms, done));

/** Твин как обещание: дождаться, пока человек дошёл, растаял или появился. */
export function tweenTo(kit: FloorKit, target: object, props: Record<string, unknown>): Promise<void> {
  return new Promise((done) => kit.scene.tweens.add({ ...props, targets: target, onComplete: () => done() }));
}

/** Куда смотреть, идя из (dx, dy): по большей составляющей. */
export const facingOf = (dx: number, dy: number): Facing => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');

export interface Grid {
  /** Проходы по высоте: люди ходят вдоль них, а не сквозь мебель. */
  aisles: number[];
  /** Коридоры по ширине: по ним переходят с прохода на проход. */
  corridors: number[];
  /** Скорость шага (точек мира в секунду). */
  speed: number;
}

export interface Walker {
  route(from: Point, to: Point): Point[];
  /** Идёт по точкам маршрута ровным шагом, лицом туда, куда идёт; глубина — по высоте. */
  walk(man: Person, to: Point): Promise<void>;
}

/** Ходьба по сетке проходов: от точки до ближайшего прохода, по нему к коридору, вдоль коридора — к цели. */
export function walker(kit: FloorKit, grid: Grid): Walker {
  const route = (from: Point, to: Point): Point[] => {
    const aisle = (p: Point) => grid.aisles.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
    const a = aisle(from);
    const b = aisle(to);
    if (a === b) return [{ x: from.x, y: a }, { x: to.x, y: a }, to];
    const via = grid.corridors.reduce((p, q) => (Math.abs(q - from.x) + Math.abs(q - to.x) < Math.abs(p - from.x) + Math.abs(p - to.x) ? q : p));
    return [{ x: from.x, y: a }, { x: via, y: a }, { x: via, y: b }, { x: to.x, y: b }, to];
  };
  const walk = (man: Person, to: Point): Promise<void> =>
    route({ x: man.x, y: man.y }, to).reduce<Promise<void>>(
      (prev, p) =>
        prev.then(
          () =>
            new Promise<void>((done) => {
              const dx = p.x - man.x;
              const dy = p.y - man.y;
              const d = Math.hypot(dx, dy);
              if (!man.active || d < 0.5) return done();
              persons.setFacing(man, facingOf(dx, dy));
              kit.scene.tweens.add({ targets: man, x: p.x, y: p.y, duration: (d / grid.speed) * 1000, onUpdate: () => man.setDepth(man.y), onComplete: () => done() });
            }),
        ),
      Promise.resolve(),
    );
  return { route, walk };
}

/** Остановка гостя этажа: куда подойти, куда смотреть, сколько стоять и что сделать (взять вещь, заплатить). */
export interface Stop {
  at: Point;
  face?: Facing;
  ms?: number;
  act?: (man: Person) => void | Promise<void>;
}

export interface VisitOpts {
  look: Look;
  /** Откуда появляется (проём лестницы, двери лифта) и где уже стоит на полу. */
  from: Point;
  enter: Point;
  stops: Stop[];
  walk: Walker['walk'];
  /** Как долго поднимается/спускается в проёме (мс). */
  stairMs?: number;
}

/**
 * Гость этажа целиком: появляется в проёме лестницы, проходит по остановкам (подошёл → повернулся → постоял →
 * сделал своё), возвращается к лестнице и тает. Сцену закрыли посреди пути (человек уничтожен) — просто выходит.
 */
export async function visit(kit: FloorKit, o: VisitOpts): Promise<void> {
  const ms = o.stairMs ?? 900;
  const man = kit.person(o.from.x, o.from.y, o.look).setAlpha(0).setDepth(o.from.y);
  persons.setFacing(man, facingOf(o.enter.x - o.from.x, o.enter.y - o.from.y));
  await tweenTo(kit, man, { x: o.enter.x, y: o.enter.y, alpha: 1, duration: ms, onUpdate: () => man.setDepth(man.y) });
  for (const stop of o.stops) {
    if (!man.active) return;
    await o.walk(man, stop.at);
    if (!man.active) return;
    if (stop.face) persons.setFacing(man, stop.face);
    if (stop.act) await stop.act(man);
    if (stop.ms) await pause(kit, stop.ms);
  }
  if (!man.active) return;
  await o.walk(man, o.enter);
  if (!man.active) return;
  persons.setFacing(man, facingOf(o.from.x - o.enter.x, o.from.y - o.enter.y));
  await tweenTo(kit, man, { x: o.from.x, y: o.from.y, alpha: 0, duration: ms });
  man.destroy();
}

export interface CrowdOpts {
  /** Как часто пробуем выпустить следующего (мс). */
  every: number;
  /** Сколько человек одновременно на этаже: в обычной графике и в лёгкой. */
  max: number;
  liteMax: number;
  /** Номер следующего гостя или null — на сегодня всё (таймер останавливается). */
  next: () => number | null;
  run: (n: number) => Promise<void>;
}

/** Поток гостей: не больше max одновременно, пока next() даёт номера; этаж уходит — новых нет. */
export function crowd(kit: FloorKit, o: CrowdOpts): Phaser.Time.TimerEvent {
  let people = 0;
  const max = kit.lite ? o.liteMax : o.max;
  const timer = kit.scene.time.addEvent({
    delay: o.every,
    loop: true,
    callback: () => {
      if (kit.leaving() || people >= max) return;
      const n = o.next();
      if (n === null) return timer.remove();
      people++;
      void o.run(n).finally(() => people--);
    },
  });
  return timer;
}
