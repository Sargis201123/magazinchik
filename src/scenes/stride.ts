// Походка: путь со скруглёнными углами, разгон и остановка без рывка, шаг по пройденному пути,
// поворот через бок и как разойтись со встречным. Чистые расчёты — без Phaser: их проверяют тесты
// (tests/stride.test.ts), а сцена только двигает по ним человечков.

import type { Point } from './layout';
import { crosses, type Rect } from './paths';

export type Facing = 'down' | 'up' | 'left' | 'right';

/** Радиус скругления угла пути (точки мира): поворот занимает пару шагов, а не происходит на месте. */
export const CORNER_RADIUS = 10;
/**
 * На сколько дуга может срезать край препятствия (точки мира). Препятствия считаются для центра человека
 * и уже с запасом от мебели, а углы обхода стоят в полточке от них — без допуска скруглять было бы нечего.
 */
const CUT = 1.5;
/** Точек на дуге поворота: на глаз гладко, а считать мало. */
const ARC_STEPS = 5;

/**
 * Ломаная from → points (без from) со скруглёнными углами: вместо излома — дуга (квадратичная кривая
 * через угол). Дуга не задевает препятствий (с допуском CUT); не помещается — радиус вдвое меньше,
 * потом прямой угол. Разворот почти назад не скругляем: там человек поворачивается на месте (turnVia).
 */
export function roundCorners(from: Point, points: Point[], obstacles: Rect[], radius = CORNER_RADIUS): Point[] {
  const pts = [from];
  for (const p of points) if (Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 0.01) pts.push(p);
  if (pts.length < 3) return pts.slice(1);
  const end = pts[pts.length - 1];
  const hit = (p: Point, r: Rect) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
  // Препятствие, в котором стоит старт или цель, не мешает (как в findPath); остальные — чуть уже.
  const rects = obstacles
    .filter((r) => !hit(from, r) && !hit(end, r))
    .map((r) => ({ x: r.x + CUT, y: r.y + CUT, w: r.w - 2 * CUT, h: r.h - 2 * CUT }))
    .filter((r) => r.w > 0 && r.h > 0);
  const clear = (line: Point[]) => line.every((p, i) => i === 0 || rects.every((r) => !crosses(line[i - 1], p, r)));
  const out: Point[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, c, b] = [pts[i - 1], pts[i], pts[i + 1]];
    const la = Math.hypot(c.x - a.x, c.y - a.y);
    const lb = Math.hypot(b.x - c.x, b.y - c.y);
    const ux = (c.x - a.x) / la;
    const uy = (c.y - a.y) / la;
    const vx = (b.x - c.x) / lb;
    const vy = (b.y - c.y) / lb;
    const cos = ux * vx + uy * vy;
    // Почти прямо — излома не видно; почти назад — дугой не обойти.
    if (cos > 0.985 || cos < -0.8) {
      out.push(c);
      continue;
    }
    let arc: Point[] | undefined;
    for (let r = Math.min(radius, la / 2, lb / 2); r >= 1.5 && !arc; r /= 2) {
      const p0 = { x: c.x - ux * r, y: c.y - uy * r };
      const p2 = { x: c.x + vx * r, y: c.y + vy * r };
      const line = [p0];
      for (let k = 1; k < ARC_STEPS; k++) {
        const t = k / ARC_STEPS;
        const [w0, w1, w2] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t];
        line.push({ x: w0 * p0.x + w1 * c.x + w2 * p2.x, y: w0 * p0.y + w1 * c.y + w2 * p2.y });
      }
      line.push(p2);
      if (clear(line)) arc = line;
    }
    out.push(...(arc ?? [c]));
  }
  out.push(end);
  return out;
}

/** Путь: точки и пройденное до каждой из них. */
export interface Route {
  pts: Point[];
  at: number[];
  length: number;
}

export function makeRoute(pts: Point[]): Route {
  const at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, at, length: at[at.length - 1] ?? 0 };
}

/** Длина ломаной from → points. */
export function polylineLength(from: Point, points: Point[]): number {
  let length = 0;
  let a = from;
  for (const b of points) {
    length += Math.hypot(b.x - a.x, b.y - a.y);
    a = b;
  }
  return length;
}

/** Точка пути на расстоянии s от начала и направление (единичное) в ней. hint — с какого отрезка искать. */
export interface RouteSample {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Отрезок, на котором точка: подсказка для следующего поиска (человек идёт только вперёд). */
  seg: number;
}

export function sampleRoute(route: Route, s: number, hint = 0): RouteSample {
  const { pts, at } = route;
  if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, dx: 0, dy: 0, seg: 0 };
  let i = Math.min(Math.max(1, hint), pts.length - 1);
  while (i < pts.length - 1 && at[i] < s) i++;
  while (i > 1 && at[i - 1] > s) i--;
  const a = pts[i - 1];
  const b = pts[i];
  const len = at[i] - at[i - 1];
  const k = len > 0 ? Math.min(1, Math.max(0, (s - at[i - 1]) / len)) : 1;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: len > 0 ? (b.x - a.x) / len : 0, dy: len > 0 ? (b.y - a.y) / len : 0, seg: i };
}

/** Разгон с места (мс): первый шаг короче, а не сразу на полной скорости. */
const RAMP_UP = 150;
/** Остановка (мс): последний шаг — притормаживая. */
const RAMP_DOWN = 110;
/**
 * До какой доли скорости притормаживает к концу пути. Не до нуля: часто следом идёт новый путь
 * (из двери — к полке), и человек не должен вставать на каждом повороте — только чуть сбавить шаг.
 */
const END_SPEED = 0.45;

/** Как идёт по пути: время целиком (мс), начальная, крейсерская и конечная скорость (точек в мс), разгон и торможение. */
export interface Pace {
  length: number;
  duration: number;
  v0: number;
  vc: number;
  ta: number;
  td: number;
}

/**
 * Скорость по пути с разгоном и торможением за то же время, что и ровным шагом: сколько шёл бы
 * без них, столько и идёт (на ход игры не влияет), только середину пути — чуть быстрее.
 * v0 — с какой скоростью уже шёл (продолжает прежний путь — без разгона с нуля).
 */
export function planPace(length: number, duration: number, v0 = 0): Pace {
  if (duration <= 0 || length <= 0) return { length, duration, v0: 0, vc: 0, ta: 0, td: 0 };
  const even = length / duration;
  // На коротком шажке (подвинуться в очереди) разгон и торможение — по трети пути.
  let ta = v0 >= even * 0.8 ? 0 : Math.min(RAMP_UP, duration / 3);
  const td = Math.min(RAMP_DOWN, duration / 3);
  let vc = (length - (v0 * ta) / 2) / (duration - ta / 2 - ((1 - END_SPEED) * td) / 2);
  // Шёл куда быстрее, чем нужно теперь, — сразу новый шаг, без плавного торможения из бега.
  if (!(vc > 0)) {
    ta = 0;
    vc = length / (duration - ((1 - END_SPEED) * td) / 2);
  }
  return { length, duration, v0: ta ? v0 : vc, vc, ta, td };
}

/** Где на пути (s) и с какой скоростью (v, точек в мс) человек через t мс после начала. */
export function paceAt(p: Pace, t: number): { s: number; v: number } {
  const { duration, v0, vc, ta, td, length } = p;
  if (duration <= 0) return { s: length, v: 0 };
  const time = Math.min(Math.max(0, t), duration);
  const s1 = ((v0 + vc) / 2) * ta;
  const cruise = duration - ta - td;
  if (time < ta) return { s: v0 * time + ((vc - v0) * time * time) / (2 * ta), v: v0 + ((vc - v0) * time) / ta };
  if (time < ta + cruise) return { s: s1 + vc * (time - ta), v: vc };
  const u = time - ta - cruise;
  const slow = td > 0 ? ((1 - END_SPEED) * vc) / td : 0;
  return { s: Math.min(length, s1 + vc * cruise + vc * u - (slow * u * u) / 2), v: vc - slow * u };
}

/**
 * Куда смотреть, идя по направлению dx, dy. Пока поворот не явный (меньше 52° от прежней стороны),
 * смотрит как смотрел: по диагонали не мигает то боком, то спиной.
 */
export function facingAlong(dx: number, dy: number, current?: Facing): Facing {
  const side: Facing = dx > 0 ? 'right' : 'left';
  const front: Facing = dy < 0 ? 'up' : 'down';
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (current === side && ax * 1.3 >= ay) return side;
  if (current === front && ay * 1.3 >= ax) return front;
  return ax > ay ? side : front;
}

/** Повернуться кругом — через промежуточную сторону: из профиля в профиль — лицом к нам, со спины на лицо — боком. */
export function turnVia(from: Facing, to: Facing, dx: number): Facing | undefined {
  if ((from === 'left' && to === 'right') || (from === 'right' && to === 'left')) return 'down';
  if ((from === 'up' && to === 'down') || (from === 'down' && to === 'up')) return dx < 0 ? 'left' : 'right';
  return undefined;
}

/** Длина одного кадра шага (точки мира) у взрослого обычным шагом: четыре кадра — два шага. */
export const FRAME_STRIDE = 3.8;

/**
 * Сколько пути на один кадр шага. Кто идёт быстрее, шагает и шире, и чаще (длина шага — как корень
 * из скорости); ребёнок и мелкий — короче; у походки свой множитель. Кадры меняются по пройденному
 * пути, а не по часам, поэтому ноги не скользят — ни при ускорении ×2, ни на разгоне.
 */
export function frameStride(pace: number, base: number, scale = 1, gait = 1): number {
  return FRAME_STRIDE * Math.sqrt(Math.max(0.1, pace / base)) * scale * gait;
}

/**
 * Встречный или стоящий на пути: где он, куда идёт (единичный вектор, если идёт) и сколько ещё
 * собирается отойти вправо по своему ходу (shift) — так другие видят, куда он уже решил уступить.
 */
export interface Passer {
  x: number;
  y: number;
  dx: number;
  dy: number;
  moving: boolean;
  shift?: number;
}

/** Насколько вбок можно отойти от своего пути (точки мира). */
export const MAX_LANE = 6;
/** Как далеко вперёд смотрит на стоящих (точки мира); на встречных — вдвое дальше: они сближаются вдвое быстрее. */
const LOOK_AHEAD = 22;
/** На каком расстоянии вбок двое встречных уже не задевают друг друга (точки мира); мимо стоящего — чуть ближе. */
const SEPARATION = 8;
const BRUSH = 6;
/** Из каких сдвигов выбирает (точки мира): по пути, чуть в сторону, до края. */
const LANES = [0, 2, -2, 4, -4, MAX_LANE, -MAX_LANE];

/**
 * На сколько отойти вбок от своего пути (плюс — вправо по ходу), чтобы не пройти сквозь тех, кто впереди.
 * Из нескольких сдвигов выбирает тот, где ни с кем не задевает плечом, а из равных — ближе к нынешнему
 * и к самому пути (не мечется). Встречного ждёт там, куда тот уже решил отойти (кто решил первым,
 * того и обходят), и при прочих равных держится правее. Попутчиков не обгоняют — идут следом.
 * me — где человек сейчас (уже со сдвигом lane), dir — куда идёт его путь, left — сколько пути
 * осталось: кто стоит дальше цели (встаёт в очередь за ним), тот не помеха — к нему не идут.
 * free — можно ли туда отойти (мебель); на самом пути (0) — всегда можно.
 */
export function sidestep(
  me: Point,
  dirX: number,
  dirY: number,
  lane: number,
  others: Passer[],
  left = Infinity,
  free: (lane: number) => boolean = () => true,
): number {
  const nx = -dirY;
  const ny = dirX;
  // Кто мешает: где он поперёк пути (0 — на самом пути) и как близко его можно обойти.
  const spots: { at: number; room: number }[] = [];
  let head = false;
  for (const o of others) {
    const rx = o.x - me.x;
    const ry = o.y - me.y;
    const ahead = rx * dirX + ry * dirY;
    const along = o.moving ? o.dx * dirX + o.dy * dirY : 0;
    // Попутчиков не обгоняют.
    if (along > 0.6) continue;
    const toward = along < -0.5;
    if (ahead < 1 || ahead > Math.min(toward ? LOOK_AHEAD * 2 : LOOK_AHEAD, left + 2)) continue;
    // Встречный отходит вправо по своему ходу — для меня это влево (минус).
    const at = lane + rx * nx + ry * ny - (toward ? (o.shift ?? 0) : 0);
    if (Math.abs(at) >= SEPARATION + MAX_LANE) continue;
    spots.push({ at, room: toward ? SEPARATION : BRUSH });
    head ||= toward;
  }
  if (!spots.length) return 0;
  let best = 0;
  let cost = Infinity;
  for (const l of LANES) {
    if (l !== 0 && !free(l)) continue;
    let c = Math.abs(l - lane) * 0.5 + Math.abs(l) * 0.25 + (head && l < 0 ? 1 : 0);
    for (const { at, room } of spots) c += Math.max(0, room - Math.abs(at - l)) * 10;
    if (c < cost) {
      cost = c;
      best = l;
    }
  }
  return best;
}
