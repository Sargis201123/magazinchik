// Соседство отделов: что покупают вместе. Полки-пары рядом — покупатель, взяв товар с одной,
// часто прихватывает и с соседней; бытовая химия рядом с едой — покупателям неприятно, берут реже.

import type { Category } from './economy';

/** Отделы, товары которых берут вместе: хлеб с молоком, мясо с картошкой, напитки с заморозкой… */
export const PAIRS: [Category, Category][] = [
  ['bakery', 'dairy'],
  ['meat', 'produce'],
  ['drinks', 'frozen'],
  ['bakery', 'drinks'],
  ['dairy', 'frozen'],
  ['meat', 'drinks'],
];

/** Химия рядом с едой: запах порошка у хлеба и мяса покупателям не нравится. */
export const CLASHES: [Category, Category][] = [
  ['household', 'bakery'],
  ['household', 'meat'],
  ['household', 'produce'],
  ['household', 'dairy'],
];

/** С такой вероятностью покупатель, взяв товар, прихватит ещё и с соседней полки-пары. */
export const PAIR_CHANCE = 0.25;
/** Химия рядом с едой: покупатели берут еду с такой полки во столько раз неохотнее. */
export const CLASH_FACTOR = 0.9;

const has = (list: [Category, Category][], a: Category, b: Category): boolean => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export const isPair = (a: Category, b: Category): boolean => a !== b && has(PAIRS, a, b);
export const isClash = (a: Category, b: Category): boolean => a !== b && has(CLASHES, a, b);

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Полки стоят рядом: между ними не больше gap точек (вплотную или через узкую щель). */
export const nextTo = (a: Box, b: Box, gap = 8): boolean =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

export interface Link {
  a: number;
  b: number;
  kind: 'pair' | 'clash';
}

/** Связи между соседними полками: пары (зелёные) и неудачное соседство (красные). */
export function shelfLinks(boxes: Box[], kinds: (Category | undefined)[]): Link[] {
  const links: Link[] = [];
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const ka = kinds[a];
      const kb = kinds[b];
      if (!ka || !kb || !nextTo(boxes[a], boxes[b])) continue;
      if (isPair(ka, kb)) links.push({ a, b, kind: 'pair' });
      else if (isClash(ka, kb)) links.push({ a, b, kind: 'clash' });
    }
  }
  return links;
}
