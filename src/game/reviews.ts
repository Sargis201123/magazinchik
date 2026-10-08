// Отзывы: вечером посетители пишут пару строк — что понравилось и что бесит.
// Сразу видно, что чинить: пустые полки, очередь, грязь или цены. Отзывы висят на доске у входа.

import type { DayStats } from './economy';
import { rng } from './random';

export type ReviewTopic =
  | 'noStock'
  | 'expensive'
  | 'queue'
  | 'dirty'
  | 'toilet'
  | 'badGoods'
  | 'slip'
  | 'thief'
  | 'fast'
  | 'clean'
  | 'fresh'
  | 'coffee'
  | 'cat'
  | 'candy'
  | 'night'
  | 'quiet';

/** Сколько раз за день должно случиться, чтобы об этом написали. */
const BAD: Partial<Record<ReviewTopic, number>> = { noStock: 2, expensive: 2, queue: 1, dirty: 1, toilet: 1, badGoods: 1, slip: 1, thief: 1 };
const GOOD: Partial<Record<ReviewTopic, number>> = { fresh: 2, coffee: 2, cat: 1, candy: 3, night: 3 };

/** Серия обслуживания, после которой хвалят за быструю кассу. */
export const FAST_COMBO = 5;
/** Без жалоб и хотя бы столько покупателей — хвалят за чистоту и порядок. */
export const CLEAN_SERVED = 8;
export const REVIEW_VARIANTS = 2;
export const REVIEW_AUTHORS = 8;
export const MAX_REVIEWS = 3;

export interface Review {
  topic: ReviewTopic;
  stars: number;
  variant: number;
  author: number;
}

export const note = (stats: DayStats, topic: ReviewTopic, n = 1): void => {
  stats.notes = { ...stats.notes, [topic]: (stats.notes?.[topic] ?? 0) + n };
};

export const isGood = (topic: ReviewTopic): boolean => !(topic in BAD) && topic !== 'quiet';

/** Отзывы за день: самое заметное плохое и хорошее вперемешку, не больше трёх. */
export function reviewsFor(stats: DayStats, day: number): Review[] {
  const notes = stats.notes ?? {};
  const bad = (Object.keys(BAD) as ReviewTopic[])
    .filter((t) => (notes[t] ?? 0) >= BAD[t]!)
    .sort((a, b) => (notes[b] ?? 0) / BAD[b]! - (notes[a] ?? 0) / BAD[a]!);
  const good = (Object.keys(GOOD) as ReviewTopic[])
    .filter((t) => (notes[t] ?? 0) >= GOOD[t]!)
    .sort((a, b) => (notes[b] ?? 0) / GOOD[b]! - (notes[a] ?? 0) / GOOD[a]!);
  if (stats.bestCombo >= FAST_COMBO) good.unshift('fast');
  if (stats.complaints === 0 && stats.served >= CLEAN_SERVED) good.push('clean');
  const topics: ReviewTopic[] = [];
  while (topics.length < MAX_REVIEWS && (bad.length || good.length)) {
    const next = (topics.length % 2 === 0 ? bad.shift() : good.shift()) ?? bad.shift() ?? good.shift();
    if (next) topics.push(next);
  }
  if (!topics.length) topics.push('quiet');
  const random = rng(day * 6151 + 29);
  const authors = new Set<number>();
  return topics.map((topic) => {
    let author = Math.floor(random() * REVIEW_AUTHORS);
    while (authors.has(author)) author = (author + 1) % REVIEW_AUTHORS;
    authors.add(author);
    const stars = topic === 'quiet' ? 3 : isGood(topic) ? (random() < 0.7 ? 5 : 4) : random() < 0.6 ? 1 : 2;
    return { topic, stars, variant: Math.floor(random() * REVIEW_VARIANTS), author };
  });
}
