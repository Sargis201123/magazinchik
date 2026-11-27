// Расстановка низа зала гипермаркета (scenes/hyperHall.ts): где встают уголок аттракционов, сезонная фотозона и
// скамья, и что от этого проходы не закрываются. Без Phaser - расчёты проверяют тесты (tests/hyperHall.test.ts).

import { overlapsRect } from './placement';
import type { Layout, Point } from './layout';
import type { Rect } from './paths';

/** Что стоит внизу зала: уголок аттракционов, сезонная фотозона, скамья у касс. */
export type HyperPieceId = 'kids' | 'season' | 'bench';

export interface HyperPiece {
  id: HyperPieceId;
  /** Середина низа (точки мира): коврика - его середина, остального - низ подиума или скамьи. */
  x: number;
  y: number;
  /** Препятствие для обхода (в координатах человека, как scene.obstacles). */
  block: Rect;
  /** Сколько занимает на полу на вид - с ним не должно пересекаться ничто из игры. */
  body: Rect;
}

/**
 * Размеры на полу (точки мира). Человек стоит ногами на 8.5 точки ниже своей точки (persons.makePerson): препятствие
 * в его координатах - от «за предметом» (ноги на заднем крае) до «перед ним» (ноги на переднем).
 */
export const FEET = 8.5;
/** Коврик уголка: 64×34. Автоматы с игрушками и капсулами - сзади слева, машинка-качалка - справа спереди. */
const MAT = { w: 64, h: 34 };
/** Подиум фотозоны: 38 в ширину, на полу - 16 в глубину (картинка выше: ёлка, зонт). */
const PODIUM = { w: 38, d: 16 };
/** Скамья с кадкой: 34 в ширину, на полу - 14 в глубину (деревце выше). */
const BENCH = { w: 34, d: 14 };
/** Зазор до чужого: до мебели и мест игры, чтобы не стоять впритык. */
const PAD = 3;

/**
 * Места-кандидаты по порядку: первое свободное. Всё - в полосе между местами покупателей у нижнего ряда островов и
 * входом (там стоят ещё менеджер и охранник, тележки и корзинки). Уголок - слева от прохода к двери, фотозона - справа
 * от него, ближе к двери; скамья - выше фотозоны, у касс (вплотную к кассиру не встаёт). Нет места у касс (витрина 18+,
 * касса сдвинута) - скамья слева от прохода к двери (где уголок, если он не встал: там полка своей марки) или у левой
 * стены, между дверями пекарни и склада.
 */
function candidates(layout: Layout, id: HyperPieceId): Point[] {
  const { door, h, w } = layout;
  const grid = (xs: number[], ys: number[]): Point[] => ys.flatMap((y) => xs.map((x) => ({ x, y })));
  if (id === 'kids') return grid([70, 74, 66, 78, 62, 86, 94], [h - 58, h - 56, h - 54, h - 60]);
  if (id === 'season') return grid([door.x + 42, door.x + 46, door.x + 50, door.x + 54], [h - 34, h - 38, h - 32, h - 42]);
  return [...grid([w - 102, w - 104, w - 100, w - 106], [h - 64, h - 66, h - 62]), ...grid([92, 88, 96], [h - 60, h - 58]), ...grid([24, 28], [h - 38, h - 42])];
}

/** Как вещь лежит на полу и как её обходят, если поставить её в at. */
export function pieceAt(id: HyperPieceId, at: Point): HyperPiece {
  if (id === 'kids') {
    const body = { x: at.x - MAT.w / 2, y: at.y - MAT.h / 2, w: MAT.w, h: MAT.h };
    // По коврику не ходят: ноги не заходят ни на одну его клетку.
    return { id, ...at, body, block: { x: body.x - 2, y: body.y - FEET - 1, w: body.w + 4, h: body.h + 2 } };
  }
  const size = id === 'season' ? PODIUM : BENCH;
  const body = { x: at.x - size.w / 2, y: at.y - size.d, w: size.w, h: size.d };
  return { id, ...at, body, block: { x: body.x - 2, y: body.y - FEET - 1, w: body.w + 4, h: body.h + 2 } };
}

/** Шаг сетки проверки проходов и запас вокруг препятствий (человек не протискивается вплотную). */
const CELL = 2;
const GROW = 3;
/** Насколько близко к цели достаточно подойти (клеток сетки). */
const NEAR = 3;

/**
 * Куда можно дойти от входа: заливка по сетке зала (клетки внутри препятствий, расширенных на GROW, закрыты).
 * Возвращает, для каких целей путь есть. Сетка грубее точного обхода (paths.ts) и строже его - ей можно верить.
 */
export function reachableTargets(layout: Layout, blockers: Rect[], from: Point, targets: Point[]): boolean[] {
  const { w, h, wallH } = layout;
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil((h - wallH) / CELL);
  const shut = new Uint8Array(cols * rows);
  for (const r of blockers) {
    const x0 = Math.max(0, Math.floor((r.x - GROW) / CELL));
    const x1 = Math.min(cols - 1, Math.ceil((r.x + r.w + GROW) / CELL) - 1);
    const y0 = Math.max(0, Math.floor((r.y - GROW - wallH) / CELL));
    const y1 = Math.min(rows - 1, Math.ceil((r.y + r.h + GROW - wallH) / CELL) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) shut[y * cols + x] = 1;
  }
  const seen = new Uint8Array(cols * rows);
  const sx = Math.floor(from.x / CELL);
  const sy = Math.floor((from.y - wallH) / CELL);
  const start = sx >= 0 && sx < cols && sy >= 0 && sy < rows ? sy * cols + sx : -1;
  if (start < 0 || shut[start]) return targets.map(() => false);
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % cols;
    const near = [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols];
    for (const j of near) {
      if (j < 0 || j >= seen.length || seen[j] || shut[j]) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  // Цель у самой мебели (начало очереди у стола кассы, место у полки) может попасть в закрытую клетку: дойти до неё -
  // значит дойти до любой открытой клетки рядом (в пределах NEAR клеток).
  return targets.map((p) => {
    const cx = Math.floor(p.x / CELL);
    const cy = Math.floor((p.y - wallH) / CELL);
    for (let dy = -NEAR; dy <= NEAR; dy++) {
      for (let dx = -NEAR; dx <= NEAR; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < cols && y >= 0 && y < rows && seen[y * cols + x]) return true;
      }
    }
    return false;
  });
}

/**
 * Расстановка низа зала: для каждой вещи - первое место из кандидатов, где она не задевает занятое (taken: всё, что
 * поставила игра, с местами людей) и не отрезает от входа ни одну цель, до которой путь был (blockers - препятствия
 * сцены). Нет такого места - вещи сегодня нет.
 */
export function planHyperHall(layout: Layout, taken: Rect[], blockers: Rect[], targets: Point[]): HyperPiece[] {
  const entry = { x: layout.door.x, y: layout.h - 8 };
  const before = reachableTargets(layout, blockers, entry, targets);
  const placed: HyperPiece[] = [];
  const inside = (r: Rect) => r.x >= 2 && r.x + r.w <= layout.w - 2 && r.y >= layout.wallH + 40 && r.y + r.h <= layout.h - 6;
  for (const id of ['kids', 'season', 'bench'] as HyperPieceId[]) {
    const fits = candidates(layout, id).map((at) => pieceAt(id, at)).find((piece) => {
      const area = { x: piece.body.x - PAD, y: piece.block.y - PAD, w: piece.body.w + 2 * PAD, h: piece.body.y + piece.body.h - piece.block.y + 2 * PAD };
      if (!inside(piece.body)) return false;
      if ([...taken, ...placed.map((p) => p.body)].some((r) => overlapsRect(area, r))) return false;
      const after = reachableTargets(layout, [...blockers, ...placed.map((p) => p.block), piece.block], entry, targets);
      return before.every((ok, i) => !ok || after[i]);
    });
    if (fits) placed.push(fits);
  }
  return placed;
}
