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
  /** Начало очереди у кассы, очередь растёт вверх. */
  queue: Point & { step: number };
  door: Point;
  warehouse: { x: number; y: number; w: number; h: number; doorway: Point; pickup: Point };
}

/** Ширина и длина зала, сколько полок вдоль стены и где острова (колонка, ряд). */
const SHAPES: { w: number; h: number; wall: number; islands: [number, number][] }[] = [
  { w: 140, h: 230, wall: 2, islands: [] },
  { w: 180, h: 260, wall: 3, islands: [[0, 0]] },
  { w: 180, h: 300, wall: 3, islands: [[0, 0], [1, 0], [0, 1]] },
  { w: 228, h: 330, wall: 4, islands: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { w: 228, h: 380, wall: 4, islands: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]] },
];

const WALL_H = 32;
const SHELF_STEP = 46;

export function layoutFor(level: number): Layout {
  const { w, h, wall, islands } = SHAPES[Math.min(level, SHAPES.length - 1)];
  const slots: Point[] = [
    ...Array.from({ length: wall }, (_, i) => ({ x: 24 + SHELF_STEP * i, y: WALL_H + 14 })),
    ...islands.map(([c, r]) => ({ x: 24 + SHELF_STEP * c, y: 116 + 56 * r })),
  ];
  const whW = 60;
  const whH = 76;
  const queueX = w - 46;
  return {
    w,
    h,
    wallH: WALL_H,
    slots,
    wc: { x: w - 13, y: 20, spotY: WALL_H + 12 },
    counter: { x: w - 30, y: h - 66 },
    sellerHome: { x: w - 14, y: h - 50 },
    queue: { x: queueX, y: h - 50, step: 13 },
    door: { x: (whW + 4 + queueX - 6) / 2, y: h - 4 },
    warehouse: {
      x: 0,
      y: h - whH,
      w: whW,
      h: whH,
      doorway: { x: whW + 8, y: h - 46 },
      pickup: { x: whW / 2, y: h - 36 },
    },
  };
}

// Каждое место под полку должно быть в планировке своего уровня.
STORE_LEVELS.forEach((l, i) => {
  if (layoutFor(i).slots.length !== l.slots) throw new Error(`layout ${i}: ${layoutFor(i).slots.length} slots, expected ${l.slots}`);
});
