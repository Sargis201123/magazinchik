// Своя расстановка зала: места под полки можно двигать утром пальцем. Здесь — чистая логика:
// где место можно поставить (в зале, не друг на друге, не в проходе к двери, кассе и флигелю)
// и можно ли от входа подойти к каждой полке, к кассе и в очередь. Сохраняется в StoreState.slotPos.

import { isFixture, slotOf, type StoreState } from '../game/economy';
import { iceboxRect, iceboxSpotFor, kioskRect, kioskZones, layoutFor, registerSpot, shelfRect, type Layout, type Point, WALL_ROW_Y } from './layout';
import { reachable, type Rect } from './paths';

/** Шаг сетки, по которой встают полки. */
export const SNAP = 4;
/** Сколько свободного места нужно человеку, чтобы пройти между полками. */
export const PASS = 8;

/** Касса вместе с очередью, кассирами и всем, что при ней, сдвинута вдоль нижней стены на dx. */
export interface TillPosition {
  level: number;
  dx: number;
  /** Короткая очередь: стоят плотнее, верх зала у правой стены свободен под полки. */
  short?: boolean;
}

/** Короткая очередь занимает столько точек вверх от кассы (длинная — до самой задней стены). */
export const SHORT_QUEUE = 150;

/** Очередь можно укоротить: в этом помещении от этого освобождается место. */
export const canShortenQueue = (layout: Layout): boolean => layout.queue.y - SHORT_QUEUE > layout.queue.minY + 20;

/** Планировка со сдвинутой кассой (дверь остаётся на месте) и, если выбрано, короткой очередью. */
export function withTill(layout: Layout, till: TillPosition | undefined, level: number): Layout {
  if (!till || till.level !== level || (!till.dx && !till.short)) return layout;
  const { dx } = till;
  const minY = till.short && canShortenQueue(layout) ? layout.queue.y - SHORT_QUEUE : layout.queue.minY;
  return {
    ...layout,
    counter: { x: layout.counter.x + dx, y: layout.counter.y },
    sellerHome: { x: layout.sellerHome.x + dx, y: layout.sellerHome.y },
    queue: { ...layout.queue, x: layout.queue.x + dx, minY },
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

/** Полка вплотную к боковой стене стоит боком: лицом в зал. Её центр — в SIDE_X от стены. */
export const SIDE_X = 8;
export type SlotSide = 'left' | 'right' | null;
export const slotSide = (layout: { w: number }, p: Point): SlotSide => (p.x <= SIDE_X ? 'left' : p.x >= layout.w - SIDE_X ? 'right' : null);

/** Место полки на полу: обычная — 40×24, боком у стены — 16×44. */
export function slotRect(layout: { w: number }, p: Point): Rect {
  return slotSide(layout, p) ? { x: p.x - 8, y: p.y - 22, w: 16, h: 44 } : bodyRect(p);
}

/** Где покупатель берёт товар: у обычной полки — снизу, у боковой — сбоку, со стороны зала. */
export function standFor(layout: { w: number }, p: Point): Point {
  const side = slotSide(layout, p);
  if (side === 'left') return { x: p.x + 18, y: p.y + 4 };
  if (side === 'right') return { x: p.x - 18, y: p.y + 4 };
  return standPoint(p);
}

/** Планировка со своей расстановкой: только если она для этого помещения и мест столько же. */
export function withSlots(layout: Layout, custom: SlotPositions | undefined, level: number): Layout {
  if (!custom || custom.level !== level || custom.at.length !== layout.slots.length) return layout;
  // Старые сохранения: ряд у задней стены стоял ниже, с полоской пола между полкой и стеной.
  return { ...layout, slots: custom.at.map((p) => ({ x: p.x, y: wallSnap(layout, p) })) };
}

/** Полку, поставленную у задней стены, прижимаем к ней вплотную (боковые полки не трогаем). */
export const wallSnap = (layout: Layout, p: Point): number => (!slotSide(layout, p) && p.y < layout.wallH + 10 ? WALL_ROW_Y : p.y);

/** Сама мебель (без запаса на обход): 40 точек в ширину, как рисунок полки, — вплотную полки стоят с шагом 40. */
export const bodyRect = ({ x, y }: Point): Rect => ({ x: x - 20, y: y - 16, w: 40, h: 24 });

export const overlapsRect = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const overlaps = overlapsRect;
const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

/**
 * Касса со всем, что при ней (переезжает целиком): стол, очередь, места под остальные кассы (registers —
 * сколько их можно поставить в этом помещении, вместе с кассиром), кассы самообслуживания (kiosks — сколько
 * стоит; место под следующий проверяет kioskSpotFree перед покупкой) и цветы.
 * Первый прямоугольник — сам стол: к нему подходят вплотную, проход к нему не проверяем.
 */
export function tillZones(layout: Layout, registers = 1, kiosks = 1): Rect[] {
  const { h, counter, queue } = layout;
  return [
    { x: counter.x - 16, y: counter.y - 34, w: 32, h: 62 },
    { x: queue.x - 10, y: queue.minY - 10, w: 20, h: queue.y - queue.minY + 22 },
    ...Array.from({ length: Math.max(0, registers - 1) }, (_, k) => registerSpot(layout, k + 1)).map(({ x, y, left }) =>
      left ? { x: x - 18, y: y - 30, w: 31, h: 54 } : { x: x - 13, y: y - 30, w: 31, h: 54 },
    ),
    ...kioskZones(layout, kiosks),
    // Цветы у кассы.
    { x: counter.x + 10, y: h - 52, w: 20, h: 26 },
  ];
}

/** То, что не переезжает: вход, двери флигеля, витрины. */
function roomZones(layout: Layout): Rect[] {
  const { h, door } = layout;
  return [
    { x: door.x - 16, y: h - 34, w: 32, h: 34 },
    // Электрощиток на задней стене: когда отключат свет, продавец подходит к нему и включает.
    { x: layout.wc.x - 34, y: layout.wallH - 10, w: 20, h: 30 },
    ...[layout.warehouse, layout.bakery, layout.coffee, layout.kitchen]
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({ x: 0, y: r.doorway.y - 14, w: 26, h: 28 })),
    ...layout.showcases.map(shelfRect),
  ];
}

/**
 * Куда полку ставить нельзя (вход, двери флигеля, щиток, витрины) — их показываем в перестановке.
 * Зона, которую занимает и стандартная расстановка (дверь в ещё закрытую комнату), — не запретная.
 */
export const blockedZones = (layout: Layout, defaults: Point[] = layout.slots): Rect[] =>
  roomZones(layout).filter((z) => !defaults.some((d) => overlaps(bodyRect(d), z)));

/** Всё, чему полки не должны мешать: касса со всем, что при ней, и то, что не переезжает. */
export const fixedZones = (layout: Layout, registers = 1, kiosks = 1): Rect[] => [...tillZones(layout, registers, kiosks), ...roomZones(layout)];

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
export function slotIssues(layout: Layout, slots: Point[], defaults: Point[] = layout.slots, registers = 1, props: Rect[] = [], kiosks = 1): Set<number> {
  const bad = new Set<number>();
  const rects = slots.map((p) => slotRect(layout, p));
  // Зона, которую занимает и стандартная расстановка (дверь в ещё закрытую комнату флигеля), — не запретная.
  // Касса переезжает — её зоны запретны всегда.
  const zones = [...tillZones(layout, registers, kiosks), ...blockedZones(layout, defaults), ...props];
  rects.forEach((r, i) => {
    const stand = standFor(layout, slots[i]);
    // У задней стены полка стоит вплотную и заходит на нижнюю панель стены — так стоят и стандартные.
    if (r.x < 0 || r.x + r.w > layout.w || r.y < WALL_ROW_Y - 16 || stand.y > layout.h - 6) bad.add(i);
    if (zones.some((z) => overlaps(r, z))) bad.add(i);
    rects.forEach((o, j) => {
      if (j !== i && overlaps(r, o)) bad.add(i);
    });
  });
  // Проходы: полки и касса «толще» на полпрохода с каждой стороны — щель уже PASS непроходима.
  // Вещи (автомат, ведро, растения) — тоже препятствия: проход мимо них должен оставаться.
  const solid = [...rects, ...zones.slice(0, 1), ...layout.showcases.map(shelfRect), ...props].map((r) => grow(r, PASS / 2));
  const blockers = [...solid, ...walls(layout)];
  const entry = { x: layout.door.x, y: layout.h - 10 };
  slots.forEach((slot, i) => {
    if (bad.has(i)) return;
    if (!reachable(entry, standFor(layout, slot), blockers)) bad.add(i);
  });
  // Касса: к началу очереди тоже должен вести путь. Иначе виноваты все — подсветим ближайшие к ней.
  // Касса: к началу очереди должен вести путь. Сама касса здесь не препятствие — очередь стоит вплотную.
  // Если пути нет, виноваты те полки, без которых он появляется.
  const queue = { x: layout.queue.x, y: layout.queue.y };
  const showcases = layout.showcases.map(shelfRect).map((r) => grow(r, PASS / 2));
  const toQueue = (skip: number) => [...rects.filter((_, j) => j !== skip), ...props].map((r) => grow(r, PASS / 2)).concat(showcases, walls(layout));
  if (!reachable(entry, queue, toQueue(-1))) {
    rects.forEach((_, i) => {
      if (reachable(entry, queue, toQueue(i))) bad.add(i);
    });
  }
  return bad;
}

/**
 * Ларь всё ещё находит себе место при такой расстановке (registers — сколько касс может стоять
 * в помещении, avoid — вещи, которые он обходит).
 */
export function iceboxFits(layout: Layout, slots: Point[], registers = 1, avoid: Rect[] = [], kiosks = 1): boolean {
  const ice = iceboxRect(iceboxSpotFor({ ...layout, slots }, registers, avoid, kiosks));
  return slots.every((s) => !overlaps(ice, slotRect(layout, s)));
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

/**
 * Вещи в зале, которые тоже можно двигать: автомат с напитками, ведро, растения. Место хранится
 * по id в StoreState.propPos (для этого помещения); fp — «след» на полу относительно точки вещи.
 */
export interface Prop {
  id: string;
  x: number;
  y: number;
  fp: Rect;
}

export const propRect = (p: Prop): Rect => ({ x: p.x + p.fp.x, y: p.y + p.fp.y, w: p.fp.w, h: p.fp.h });

/** «След» вещи зала по её id: автомат (боком у стены или лицом), ведро, полки «Уценка» и «Еда», растения. */
export function propFootprint(layout: Layout, id: string, x: number): Rect {
  if (id === 'vending') return vendingFootprint(vendingSide(layout, x));
  if (id === 'bin') return { x: -8, y: -12, w: 16, h: 14 };
  if (id === 'bargain') return { x: -15, y: -8, w: 30, h: 12 };
  if (id === 'food') return { x: -15, y: -10, w: 30, h: 14 };
  return { x: -7, y: -10, w: 14, h: 14 };
}

/** Автомат у боковой стены стоит боком (лицом в зал), в зале — лицом к игроку. */
export const vendingSide = (layout: Layout, x: number): boolean => x >= layout.w - 16 || x <= 16;
export const vendingFootprint = (side: boolean): Rect => (side ? { x: -5, y: -16, w: 10, h: 30 } : { x: -12, y: -16, w: 24, h: 30 });

/**
 * Какие вещи стоят неправильно (их id): за пределами зала, на полке, на кассе с очередью,
 * у входа, в дверях флигеля или друг на друге.
 */
export function propIssues(layout: Layout, slots: Point[], props: Prop[], registers = 1, kiosks = 1): Set<string> {
  const bad = new Set<string>();
  const zones = [...tillZones(layout, registers, kiosks), ...roomZones(layout)];
  const rects = props.map(propRect);
  rects.forEach((r, i) => {
    const id = props[i].id;
    // Вещь может стоять вплотную к стенам (ведро в углу чуть заходит на нижнюю стену).
    if (r.x < -2 || r.x + r.w > layout.w + 2 || r.y < layout.wallH - 8 || r.y + r.h > layout.h + 4) bad.add(id);
    if (zones.some((z) => overlaps(r, z)) || slots.some((s) => overlaps(r, slotRect(layout, s)))) bad.add(id);
    rects.forEach((o, j) => {
      if (j !== i && overlaps(r, o)) bad.add(id);
    });
  });
  return bad;
}

/** Расстановка вещей для сохранения: только то, что сдвинуто со стандартного места. */
export function propPosFor(level: number, props: Prop[], defaults: Record<string, Point>): { level: number; at: Record<string, Point> } | undefined {
  const at: Record<string, Point> = {};
  for (const p of props) {
    const d = defaults[p.id];
    if (!d || d.x !== p.x || d.y !== p.y) at[p.id] = { x: p.x, y: p.y };
  }
  return Object.keys(at).length ? { level, at } : undefined;
}

/**
 * Место под киоск номер index свободно: на нём не стоит полка (своя расстановка, короткая очередь
 * освобождает правую стену под полки) и не стоит переставленная вещь. Занято — сначала переставить.
 */
export function kioskSpotFree(state: StoreState, index: number): boolean {
  const layout = withTill(withSlots(layoutFor(state.level), state.slotPos, state.level), state.tillPos, state.level);
  const k = kioskRect(layout, index);
  const moved = state.propPos?.level === state.level ? Object.entries(state.propPos.at) : [];
  return (
    layout.slots.every((p) => !overlaps(slotRect(layout, p), k)) &&
    moved.every(([id, p]) => !overlaps(propRect({ id, x: p.x, y: p.y, fp: propFootprint(layout, id, p.x) }), k))
  );
}
