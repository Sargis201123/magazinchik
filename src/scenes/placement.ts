// Своя расстановка зала: места под полки можно двигать утром пальцем. Здесь — чистая логика:
// где место можно поставить (в зале, не друг на друге, не в проходе к двери, кассе и флигелю)
// и можно ли от входа подойти к каждой полке, к кассе и в очередь. Сохраняется в StoreState.slotPos.

import { isFixture, slotOf, type StoreState } from '../game/economy';
import { iceboxRect, iceboxSpotFor, layoutFor, registerSpot, shelfRect, type Layout, type Point } from './layout';
import { reachable, type Rect } from './paths';

/** Шаг сетки, по которой встают полки. */
export const SNAP = 4;
/** Сколько свободного места нужно человеку, чтобы пройти между полками. */
export const PASS = 8;

/** Касса вместе с очередью, кассирами и всем, что при ней, сдвинута вдоль нижней стены на dx. */
export interface TillPosition {
  level: number;
  dx: number;
}

/** Планировка со сдвинутой кассой (дверь остаётся на месте). */
export function withTill(layout: Layout, till: TillPosition | undefined, level: number): Layout {
  if (!till || till.level !== level || !till.dx) return layout;
  const { dx } = till;
  return {
    ...layout,
    counter: { x: layout.counter.x + dx, y: layout.counter.y },
    sellerHome: { x: layout.sellerHome.x + dx, y: layout.sellerHome.y },
    queue: { ...layout.queue, x: layout.queue.x + dx },
  };
}

/** Насколько кассу можно сдвинуть влево: весь блок (с левыми кассами и кассиром) — правее входа. */
export function tillMinDx(layout: Layout, registers: number): number {
  const left = registers > 1 ? layout.counter.x - 34 - 22 : layout.queue.x - 12;
  return Math.min(0, layout.door.x + 22 - left);
}

/** Сдвиг кассы на сетке и в пределах: от входа до правой стены. */
export const clampTill = (layout: Layout, registers: number, dx: number): number =>
  Math.max(tillMinDx(layout, registers), Math.min(0, snap(dx)));

export interface SlotPositions {
  level: number;
  at: Point[];
}

/** Где покупатель стоит, когда берёт товар с полки (как standOf в сцене). */
export const standPoint = (slot: Point): Point => ({ x: slot.x, y: slot.y + 22 });

/** Планировка со своей расстановкой: только если она для этого помещения и мест столько же. */
export function withSlots(layout: Layout, custom: SlotPositions | undefined, level: number): Layout {
  if (!custom || custom.level !== level || custom.at.length !== layout.slots.length) return layout;
  return { ...layout, slots: custom.at.map((p) => ({ x: p.x, y: p.y })) };
}

/** Сама мебель (без запаса на обход): 44 точки в ширину — стандартные места стоят с шагом 46. */
export const bodyRect = ({ x, y }: Point): Rect => ({ x: x - 22, y: y - 16, w: 44, h: 24 });

export const overlapsRect = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const overlaps = overlapsRect;
const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

/**
 * Касса со всем, что при ней (переезжает целиком): стол, очередь, места под остальные кассы (registers —
 * сколько их можно поставить в этом помещении, вместе с кассиром), касса самообслуживания, цветы и ведро.
 * Первый прямоугольник — сам стол: к нему подходят вплотную, проход к нему не проверяем.
 */
export function tillZones(layout: Layout, registers = 1): Rect[] {
  const { h, wallH, counter, queue } = layout;
  return [
    { x: counter.x - 16, y: counter.y - 34, w: 32, h: 62 },
    { x: queue.x - 10, y: queue.minY - 10, w: 20, h: queue.y - queue.minY + 22 },
    ...Array.from({ length: Math.max(0, registers - 1) }, (_, k) => registerSpot(layout, k + 1)).map(({ x, y, left }) =>
      left ? { x: x - 18, y: y - 30, w: 31, h: 54 } : { x: x - 13, y: y - 30, w: 31, h: 54 },
    ),
    { x: counter.x + 14, y: wallH + 72, w: 16, h: 20 },
    { x: counter.x + 10, y: h - 52, w: 20, h: 52 },
  ];
}

/** То, что не переезжает: вход, автомат, двери флигеля, витрины. */
function roomZones(layout: Layout): Rect[] {
  const { w, h, wallH, door } = layout;
  return [
    { x: door.x - 16, y: h - 34, w: 32, h: 34 },
    { x: w - 18, y: wallH + 40, w: 18, h: 30 },
    ...[layout.warehouse, layout.bakery, layout.coffee, layout.kitchen]
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({ x: 0, y: r.doorway.y - 14, w: 26, h: 28 })),
    ...layout.showcases.map(shelfRect),
  ];
}

/** Всё, чему полки не должны мешать: касса со всем, что при ней, и то, что не переезжает. */
export const fixedZones = (layout: Layout, registers = 1): Rect[] => [...tillZones(layout, registers), ...roomZones(layout)];

/** Стены зала как препятствия: путь не может обойти полку снаружи здания. */
const walls = (layout: Layout): Rect[] => [
  { x: -1000, y: -1000, w: 1000, h: 3000 },
  { x: layout.w, y: -1000, w: 1000, h: 3000 },
  { x: -1000, y: -1000, w: 3000, h: 1000 + layout.wallH },
  { x: -1000, y: layout.h, w: 3000, h: 1000 },
];

/**
 * Какие места поставлены неправильно (их номера): за пределами зала, друг на друге, в запретной зоне
 * или так, что к полке не подойти. Если неправильных нет — расстановку можно сохранять.
 */
export function slotIssues(layout: Layout, slots: Point[], defaults: Point[] = layout.slots, registers = 1): Set<number> {
  const bad = new Set<number>();
  const rects = slots.map(bodyRect);
  // Зона, которую занимает и стандартная расстановка (дверь в ещё закрытую комнату флигеля), — не запретная.
  // Касса переезжает — её зоны запретны всегда.
  const zones = [...tillZones(layout, registers), ...roomZones(layout).filter((z) => !defaults.some((d) => overlaps(bodyRect(d), z)))];
  rects.forEach((r, i) => {
    const stand = standPoint(slots[i]);
    // У задней стены полка краем заходит на стену — так стоят и стандартные.
    if (r.x < 0 || r.x + r.w > layout.w || r.y < layout.wallH - 4 || stand.y > layout.h - 6) bad.add(i);
    if (zones.some((z) => overlaps(r, z))) bad.add(i);
    rects.forEach((o, j) => {
      if (j !== i && overlaps(r, o)) bad.add(i);
    });
  });
  // Проходы: полки и касса «толще» на полпрохода с каждой стороны — щель уже PASS непроходима.
  const solid = [...rects, ...zones.slice(0, 1), ...layout.showcases.map(shelfRect)].map((r) => grow(r, PASS / 2));
  const blockers = [...solid, ...walls(layout)];
  const entry = { x: layout.door.x, y: layout.h - 10 };
  slots.forEach((slot, i) => {
    if (bad.has(i)) return;
    if (!reachable(entry, standPoint(slot), blockers)) bad.add(i);
  });
  // Касса: к началу очереди тоже должен вести путь. Иначе виноваты все — подсветим ближайшие к ней.
  // Касса: к началу очереди должен вести путь. Сама касса здесь не препятствие — очередь стоит вплотную.
  // Если пути нет, виноваты те полки, без которых он появляется.
  const queue = { x: layout.queue.x, y: layout.queue.y };
  const showcases = layout.showcases.map(shelfRect).map((r) => grow(r, PASS / 2));
  const toQueue = (skip: number) => [...rects.filter((_, j) => j !== skip).map((r) => grow(r, PASS / 2)), ...showcases, ...walls(layout)];
  if (!reachable(entry, queue, toQueue(-1))) {
    rects.forEach((_, i) => {
      if (reachable(entry, queue, toQueue(i))) bad.add(i);
    });
  }
  return bad;
}

/** Ларь всё ещё находит себе место при такой расстановке. */
export function iceboxFits(layout: Layout, slots: Point[]): boolean {
  const ice = iceboxRect(iceboxSpotFor({ ...layout, slots }));
  return slots.every((s) => !overlaps(ice, bodyRect(s)));
}

export const snap = (v: number): number => Math.round(v / SNAP) * SNAP;

/** Расстановка для сохранения: совпадает со стандартной — не храним. */
export function slotPosFor(level: number, at: Point[]): SlotPositions | undefined {
  const defaults = layoutFor(level).slots;
  const same = at.length === defaults.length && at.every((p, i) => p.x === defaults[i].x && p.y === defaults[i].y);
  return same ? undefined : { level, at: at.map((p) => ({ x: p.x, y: p.y })) };
}

/**
 * Полку before.shelves[index] убрали (продали или в запас): полки занимают места по порядку, поэтому
 * без поправки следующие съехали бы на соседние места. Оставляем их где стояли, а освободившееся
 * место — первое свободное: туда встанет следующая полка (из запаса или новая).
 */
export function keepPlaces(before: StoreState, after: StoreState | null, index: number): StoreState | null {
  const slot = slotOf(before, index);
  if (!after || slot < 0) return after;
  const at = withSlots(layoutFor(before.level), before.slotPos, before.level).slots.map((p) => ({ ...p }));
  const [freed] = at.splice(slot, 1);
  at.splice(before.shelves.filter((sh) => !isFixture(sh)).length - 1, 0, freed);
  return { ...after, slotPos: slotPosFor(before.level, at) };
}
