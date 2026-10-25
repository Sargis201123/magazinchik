// Планировка магазина для каждого уровня помещения. Координаты — от левого верхнего
// угла здания (верх стены). Чем выше уровень, тем шире и длиннее зал.
//
// Зал заставлен полками: вдоль задней стены и рядами-островами, между рядами — проходы.
// Слева к зданию пристроен флигель из трёх комнат, у каждой своя дверь в зал через левую стену:
// внизу склад (ворота на улицу для подвоза), над ним пекарня, выше кофейня, в больших помещениях
// над кофейней ещё кухня.

import { STORE_LEVELS } from '../game/economy';

export interface Point {
  x: number;
  y: number;
}

export interface Layout {
  w: number;
  h: number;
  /** Высота задней стены. */
  wallH: number;
  /** Места под полки в порядке заполнения: сначала вдоль стены, потом острова в зале. */
  slots: Point[];
  wc: Point & { spotY: number };
  counter: Point;
  sellerHome: Point;
  /** Начало очереди у кассы, очередь растёт вверх, но не выше minY (тогда сжимается). */
  queue: Point & { step: number; minY: number };
  door: Point;
  /**
   * Островные стеллажи-витрины в пустом центре зала: стоят там, где на следующем уровне будут полки
   * (на последнем — в свободных местах). Покупатели обходят их, как и полки.
   */
  showcases: Point[];
  /** Склад во флигеле: стеллаж из rows ярусов, внизу проход; doorway — у двери со стороны зала. */
  warehouse: Room & { rows: number; pickup: Point };
  /** Пекарня и кофейня во флигеле над складом. */
  bakery: Room;
  coffee: Room;
  /** Кухня над кофейней — только в больших помещениях (KITCHEN_FROM), где она помещается по высоте. */
  kitchen?: Room;
  /** Флигель целиком (внутренняя часть комнат, без наружных стен). */
  wing: { x: number; y: number; w: number; h: number };
}

/** Комната флигеля: прямоугольник внутри стен и дверь в левой стене зала. */
export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Точка у двери со стороны зала и со стороны комнаты. */
  doorway: Point;
  inside: Point;
}

/** Ширина и длина зала, сколько полок вдоль стены и где острова (колонка, ряд). */
// Ларёк тесный: две полки, касса и склад впритык. С каждым расширением зал растёт.
// Вдоль левой стены — свободный проход к дверям флигеля: острова начинаются правее.
const SHAPES: { w: number; h: number; wall: number; cols: number; rows: number }[] = [
  { w: 136, h: 172, wall: 2, cols: 1, rows: 1 },
  { w: 176, h: 224, wall: 3, cols: 2, rows: 2 },
  { w: 200, h: 280, wall: 3, cols: 2, rows: 3 },
  { w: 260, h: 320, wall: 5, cols: 3, rows: 3 },
  { w: 260, h: 372, wall: 5, cols: 3, rows: 4 },
];

/** Склад: 6 мест на ярусе; одна коробка изображает не меньше 3 штук, всего не больше 36 коробок. */
export const WAREHOUSE_COLS = 6;
export const UNITS_PER_BOX = 3;
export const MAX_BOXES = 36;
export const unitsPerBox = (capacity: number): number => Math.max(UNITS_PER_BOX, Math.ceil(capacity / 30));
const warehouseRows = (capacity: number): number =>
  Math.ceil(Math.min(MAX_BOXES, Math.ceil(capacity / unitsPerBox(capacity))) / WAREHOUSE_COLS);

const WALL_H = 32;
const SHELF_STEP = 46;
/** Шаг полок у задней стены: вплотную, по ширине полки. */
const WALL_STEP = 40;
/** Ряд у задней стены: полка стоит к ней вплотную — задний край на плинтусе, верх заходит на стену. */
export const WALL_ROW_Y = WALL_H - 6;
/** Ряды островов: первый ряд и шаг между рядами (полка 24 + проход 32); левый край — после прохода у стены. */
const ISLAND_X = 50;
const ISLAND_Y = 116;
const ROW_STEP = 56;
/** Стена между залом и флигелем и стены флигеля (как WALL в сцене). */
export const WING_WALL = 6;
/** Ширина комнат флигеля внутри стен и высота пекарни и кофейни. */
export const WING_W = 60;
const BAKERY_H = 52;
const COFFEE_H = 60;
const KITCHEN_H = 52;
/** С какого помещения во флигеле есть кухня (улучшение «Кухня» — с того же уровня). */
export const KITCHEN_FROM = 3;
/** Сколько занимает флигель слева от зала вместе со стенами. */
export const WING_OUTER = WING_W + 2 * WING_WALL;

/** Здание по ширине (точки мира): от наружной стены флигеля до наружного края правой стены зала. */
export const buildingSpan = (layout: { w: number }): { left: number; right: number } => ({ left: -WING_OUTER, right: layout.w + WING_WALL });

/** Препятствие полки (как в сцене): люди обходят его. */
export const shelfRect = ({ x, y }: Point): { x: number; y: number; w: number; h: number } => ({ x: x - 25, y: y - 16, w: 50, h: 24 });

/**
 * Где прорезать дверь в левой стене для комнаты: проход шириной 14 у стены, не задевая полок.
 * Ищем от середины комнаты к краям; null — места нет.
 */
export function doorY(room: { y: number; h: number }, slots: Point[], prefer?: number): number | null {
  const lo = Math.max(room.y + 9, WALL_H + 12);
  const hi = room.y + room.h - 7;
  const free = (y: number) => slots.map(shelfRect).every((r) => 14 <= r.x || y + 7 <= r.y || y - 7 >= r.y + r.h);
  const start = prefer ?? Math.round(room.y + room.h / 2);
  for (let d = 0; d <= room.h; d += 2) {
    for (const y of [start - d, start + d]) if (y >= lo && y <= hi && free(y)) return y;
  }
  return null;
}

export function layoutFor(level: number): Layout {
  const { w, h, wall, cols, rows: islandRows } = SHAPES[Math.min(level, SHAPES.length - 1)];
  const slots: Point[] = [
    // У задней стены полки стоят вплотную друг к другу (шаг — ширина полки), без щелей.
    ...Array.from({ length: wall }, (_, i) => ({ x: 20 + WALL_STEP * i, y: WALL_ROW_Y })),
    ...Array.from({ length: islandRows * cols }, (_, i) => ({ x: ISLAND_X + SHELF_STEP * (i % cols), y: ISLAND_Y + ROW_STEP * Math.floor(i / cols) })),
  ];
  const whW = WING_W;
  const rows = warehouseRows(STORE_LEVELS[Math.min(level, STORE_LEVELS.length - 1)].warehouse);
  // Подпись, ярусы стеллажа по 8 и проход внизу.
  const whH = 16 + rows * 8 + 16;
  const queueX = w - 46;
  const whY = h - whH;
  const roomX = -WING_WALL - whW;
  // Комнаты флигеля снизу вверх: склад, пекарня, кофейня; между ними — стены.
  const room = (y: number, rh: number, prefer?: number): Room => {
    const dy = doorY({ y, h: rh }, slots, prefer) ?? Math.round(y + rh / 2);
    return { x: roomX, y, w: whW, h: rh, doorway: { x: 8, y: dy }, inside: { x: -WING_WALL - 8, y: dy } };
  };
  const store = room(whY, whH, h - 12);
  const bakeryY = whY - WING_WALL - BAKERY_H;
  // Двери пекарни и кухни — у нижнего края комнаты, кофейни — у верхнего: между дверями остаётся
  // кусок стены, куда встаёт полка боком.
  const bakery = room(bakeryY, BAKERY_H, bakeryY + BAKERY_H - 7);
  const coffeeY = bakeryY - WING_WALL - COFFEE_H;
  const coffee = room(coffeeY, COFFEE_H, coffeeY + 9);
  const kitchenY = coffeeY - WING_WALL - KITCHEN_H;
  const kitchen = level >= KITCHEN_FROM ? room(kitchenY, KITCHEN_H, kitchenY + KITCHEN_H - 7) : undefined;
  const showcases: Point[] = [];
  return {
    w,
    h,
    wallH: WALL_H,
    slots,
    wc: { x: w - 13, y: 20, spotY: WALL_H + 12 },
    counter: { x: w - 30, y: h - 66 },
    sellerHome: { x: w - 14, y: h - 50 },
    queue: { x: queueX, y: h - 50, step: 17, minY: WALL_H + 44 },
    door: { x: Math.round((8 + queueX - 6) / 2), y: h - 4 },
    showcases,
    warehouse: { ...store, rows, pickup: { x: roomX + whW / 2, y: h - 8 } },
    bakery,
    coffee,
    kitchen,
    wing: { x: roomX, y: kitchen ? kitchenY : coffeeY, w: whW, h: h - (kitchen ? kitchenY : coffeeY) },
  };
}

// Каждое место под полку должно быть в планировке своего уровня.
STORE_LEVELS.forEach((l, i) => {
  if (layoutFor(i).slots.length !== l.slots) throw new Error(`layout ${i}: ${layoutFor(i).slots.length} slots, expected ${l.slots}`);
});

/** Шаг между рядами касс (каждая следующая пара — выше по залу). */
export const REGISTER_ROW = 60;

/**
 * Где стоит касса номер index (с 0): нечётные — зеркально слева от очереди, чётные — справа;
 * каждая следующая пара — выше по залу.
 */
export function registerSpot(layout: Layout, index: number): Point & { left: boolean } {
  const left = index % 2 === 1;
  const row = Math.floor(index / 2);
  return { x: left ? layout.counter.x - 34 : layout.counter.x, y: layout.counter.y - REGISTER_ROW * row, left };
}

/** Ларь с мороженым на месте (x, y): рамка вместе с крышкой, витриной и местом покупателя над ним. */
export const iceboxRect = ({ x, y }: Point): { x: number; y: number; w: number; h: number } => ({ x: x - 15, y: y - 24, w: 30, h: 30 });

/**
 * Куда поставить ларь с мороженым. Как в настоящих магазинах — у кассы: вплотную к правой стене
 * рядом с очередью (кто стоит в очереди, видит мороженое), между автоматом с напитками и кассами.
 * Если там тесно (маленький зал, на месте ларя полка) — у нижней стены поближе к кассе, потом — вдоль
 * левой стены. Место не задевает ни одно место под полку (даже пустое — полку могут купить завтра),
 * островные витрины, кассы (сколько их может стоять в этом помещении — registers) с очередью,
 * кассу самообслуживания, автомат на своём месте, стойку со сладостями, цветы, ведро, вход, двери
 * флигеля и то, что ещё велено обойти (avoid — вещи, переставленные игроком).
 */
export function iceboxSpotFor(layout: Layout, registers = 1, avoid: { x: number; y: number; w: number; h: number }[] = []): Point {
  const { w, h, door, counter, queue, wallH } = layout;
  const pad = 2;
  const blocked = [
    ...layout.slots.map(shelfRect),
    ...layout.showcases.map(shelfRect),
    { x: counter.x - 16, y: counter.y - 34, w: 32, h: 62 },
    // Остальные кассы — с кассиром и покупателем у каждой (как tillZones в placement.ts).
    ...Array.from({ length: Math.max(0, registers - 1) }, (_, k) => registerSpot(layout, k + 1)).map(({ x, y, left }) =>
      left ? { x: x - 18, y: y - 30, w: 31, h: 54 } : { x: x - 13, y: y - 30, w: 31, h: 54 },
    ),
    // Касса самообслуживания у правой стены, над ней — автомат с напитками и радио на нём.
    { x: counter.x + 14, y: wallH + 72, w: 16, h: 20 },
    { x: w - 16, y: wallH + 36, w: 16, h: 38 },
    // Стойка со сладостями под кассой, вёдра с цветами (или растение) в углу у кассы, ведро для мусора.
    { x: counter.x - 12, y: counter.y + 28, w: 24, h: 18 },
    { x: counter.x + 10, y: h - 52, w: 20, h: 26 },
    { x: w - 18, y: h - 24, w: 16, h: 14 },
    // Проход к двери: полоса шириной в два шага над входом.
    { x: door.x - 14, y: h - 40, w: 28, h: 40 },
    // Очередь к кассе: от начала вверх до самого высокого места.
    { x: queue.x - 12, y: queue.minY - 12, w: 24, h: queue.y - queue.minY + 26 },
    // Двери во флигель у левой стены (склад, пекарня, кофейня, кухня) — к ним тоже ходят.
    ...[layout.warehouse, layout.bakery, layout.coffee, layout.kitchen].filter((r): r is Room => Boolean(r)).map((r) => ({ x: -2, y: r.doorway.y - 16, w: 34, h: 32 })),
    // Вещи, которые игрок переставил сам (автомат, ведро, растения), — ларь их обходит.
    ...avoid,
  ];
  const free = (p: Point) => {
    const r = iceboxRect(p);
    if (r.x < 2 || r.x + r.w > w - 2 || r.y < wallH + 6 || r.y + r.h > h + 4) return false;
    return blocked.every((b) => r.x + r.w + pad <= b.x || b.x + b.w + pad <= r.x || r.y + r.h + pad <= b.y || b.y + b.h + pad <= r.y);
  };
  const candidates: Point[] = [];
  // У правой стены рядом с очередью: от касс вверх — чем ближе к кассе, тем лучше.
  for (let y = h - 20; y >= wallH + 40; y -= 2) candidates.push({ x: w - 17, y });
  // У нижней стены (ларь стоит к ней вплотную) — как можно ближе к кассе.
  const bottom: Point[] = [];
  for (let x = 18; x <= w - 18; x += 2) bottom.push({ x, y: h - 12 });
  bottom.sort((a, b) => Math.abs(a.x - (queue.x - 12)) - Math.abs(b.x - (queue.x - 12)));
  candidates.push(...bottom);
  for (let cy = h - 38; cy >= wallH + 40; cy -= 2) candidates.push({ x: 18, y: cy });
  return candidates.find(free) ?? (door.x - 44 >= 36 ? { x: door.x - 44, y: h - 12 } : { x: 24, y: h - 38 });
}
