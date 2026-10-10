// Планировка магазина для каждого уровня помещения. Координаты — от левого верхнего
// угла здания (верх стены). Чем выше уровень, тем шире и длиннее зал.
//
// Зал заставлен полками: вдоль задней стены и рядами-островами, между рядами — проходы.
// Слева к зданию пристроен флигель из трёх комнат, у каждой своя дверь в зал через левую стену:
// внизу склад (ворота на улицу для подвоза), над ним пекарня, выше кофейня.

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
/** Сколько занимает флигель слева от зала вместе со стенами. */
export const WING_OUTER = WING_W + 2 * WING_WALL;

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
    ...Array.from({ length: wall }, (_, i) => ({ x: 24 + SHELF_STEP * i, y: WALL_H + 14 })),
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
  const bakery = room(bakeryY, BAKERY_H);
  const coffeeY = bakeryY - WING_WALL - COFFEE_H;
  const coffee = room(coffeeY, COFFEE_H);
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
    wing: { x: roomX, y: coffeeY, w: whW, h: h - coffeeY },
  };
}

// Каждое место под полку должно быть в планировке своего уровня.
STORE_LEVELS.forEach((l, i) => {
  if (layoutFor(i).slots.length !== l.slots) throw new Error(`layout ${i}: ${layoutFor(i).slots.length} slots, expected ${l.slots}`);
});
