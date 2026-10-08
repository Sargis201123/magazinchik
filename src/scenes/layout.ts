// Планировка магазина для каждого уровня помещения. Координаты — от левого верхнего
// угла здания (верх стены). Чем выше уровень, тем шире и длиннее зал.

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
  /** Склад: стеллаж из rows ярусов, внизу проход к двери. */
  warehouse: { x: number; y: number; w: number; h: number; rows: number; doorway: Point; pickup: Point };
}

/** Ширина и длина зала, сколько полок вдоль стены и где острова (колонка, ряд). */
// Ларёк тесный: две полки, касса и склад впритык. С каждым расширением зал растёт.
const SHAPES: { w: number; h: number; wall: number; islands: [number, number][] }[] = [
  { w: 136, h: 172, wall: 2, islands: [] },
  { w: 176, h: 224, wall: 3, islands: [[0, 0]] },
  { w: 180, h: 280, wall: 3, islands: [[0, 0], [1, 0], [0, 1]] },
  { w: 228, h: 320, wall: 4, islands: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { w: 228, h: 372, wall: 4, islands: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]] },
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

export function layoutFor(level: number): Layout {
  const { w, h, wall, islands } = SHAPES[Math.min(level, SHAPES.length - 1)];
  const slots: Point[] = [
    ...Array.from({ length: wall }, (_, i) => ({ x: 24 + SHELF_STEP * i, y: WALL_H + 14 })),
    ...islands.map(([c, r]) => ({ x: 24 + SHELF_STEP * c, y: 116 + 56 * r })),
  ];
  const whW = 60;
  const rows = warehouseRows(STORE_LEVELS[Math.min(level, STORE_LEVELS.length - 1)].warehouse);
  // Подпись, ярусы стеллажа по 8 и проход внизу.
  const whH = 16 + rows * 8 + 16;
  const queueX = w - 46;
  return {
    w,
    h,
    wallH: WALL_H,
    slots,
    wc: { x: w - 13, y: 20, spotY: WALL_H + 12 },
    counter: { x: w - 30, y: h - 66 },
    sellerHome: { x: w - 14, y: h - 50 },
    queue: { x: queueX, y: h - 50, step: 17, minY: WALL_H + 44 },
    door: { x: (whW + 4 + queueX - 6) / 2, y: h - 4 },
    warehouse: {
      x: 0,
      y: h - whH,
      w: whW,
      h: whH,
      rows,
      doorway: { x: whW + 8, y: h - 12 },
      pickup: { x: whW / 2, y: h - 8 },
    },
  };
}

// Каждое место под полку должно быть в планировке своего уровня.
STORE_LEVELS.forEach((l, i) => {
  if (layoutFor(i).slots.length !== l.slots) throw new Error(`layout ${i}: ${layoutFor(i).slots.length} slots, expected ${l.slots}`);
});
