// Отзывы: вечером посетители пишут пару строк — что понравилось и что бесит.
// Сразу видно, что чинить: пустые полки, очередь, грязь или цены. Отзывы висят на доске у входа.

import type { DayStats } from './economy';
import { rng } from './random';
import { goodwillReview } from './goodwill';

export type ReviewTopic =
  | 'noStock'
  | 'expensive'
  | 'queue'
  | 'dirty'
  | 'smell'
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
  | 'quiet'
  | 'cheap'
  // Проигравшие в лотерею ворчат (lottery.ts): отзыв на три звезды — обида, а не жалоба на магазин.
  | 'lottery'
  // Доброе имя района (goodwill.ts): помнят, как магазин вёл себя в беду.
  | 'kind'
  | 'greedy'
  // Серая схема (grey.ts): магазин попался и опечатан — об этом напишут.
  | 'grey';

/** Сколько раз за день должно случиться, чтобы об этом написали. */
const BAD: Partial<Record<ReviewTopic, number>> = { noStock: 2, expensive: 2, queue: 1, dirty: 1, smell: 1, toilet: 1, badGoods: 1, slip: 1, thief: 1, greedy: 1, grey: 1 };
const GOOD: Partial<Record<ReviewTopic, number>> = { fresh: 2, coffee: 2, cat: 1, candy: 3, night: 3, cheap: 4, kind: 1 };

/**
 * Ворчание про лотерею — не жалоба (13.11, автор: отзывы редкие и мягкие): пишут, только если за день
 * заворчали хотя бы трое, настоящих жалоб нет (место на доске — тому, что можно починить), на доске есть
 * свободное место и выпал редкий бросок дня. Выходит примерно раз в пару недель, а не через вечер.
 */
export const LOTTERY_GRUMBLES = 3;
export const LOTTERY_REVIEW_CHANCE = 0.3;

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

/** Ни похвала, ни жалоба: «тихий день» и обида на лотерею — карточка без цвета, три звезды. */
export const isNeutral = (topic: ReviewTopic): boolean => topic === 'quiet' || topic === 'lottery';
export const isGood = (topic: ReviewTopic): boolean => !(topic in BAD) && !isNeutral(topic);

/**
 * Отзывы за день: самое заметное плохое и хорошее вперемешку, не больше трёх. goodwill — доброе имя района:
 * громкое (по модулю) — и о нём напишут первым (как помог в беду или как нажился). scandal — магазин сегодня
 * опечатан после серой схемы (grey.ts): разгромный отзыв первым, громче любой другой жалобы.
 */
export function reviewsFor(stats: DayStats, day: number, goodwill = 0, scandal = false): Review[] {
  const remembered = goodwillReview(goodwill, day);
  const base = remembered ? { ...stats.notes, [remembered]: 9 } : (stats.notes ?? {});
  const notes = scandal ? { ...base, grey: 99 } : base;
  const bad = (Object.keys(BAD) as ReviewTopic[])
    .filter((t) => (notes[t] ?? 0) >= BAD[t]!)
    .sort((a, b) => (notes[b] ?? 0) / BAD[b]! - (notes[a] ?? 0) / BAD[a]!);
  const good = (Object.keys(GOOD) as ReviewTopic[])
    .filter((t) => (notes[t] ?? 0) >= GOOD[t]!)
    .sort((a, b) => (notes[b] ?? 0) / GOOD[b]! - (notes[a] ?? 0) / GOOD[a]!);
  if (stats.bestCombo >= FAST_COMBO) good.unshift('fast');
  if (stats.complaints === 0 && stats.served >= CLEAN_SERVED) good.push('clean');
  const grumble = !bad.length && (notes.lottery ?? 0) >= LOTTERY_GRUMBLES && rng(day * 7577 + 41)() < LOTTERY_REVIEW_CHANCE;
  const topics: ReviewTopic[] = [];
  while (topics.length < MAX_REVIEWS && (bad.length || good.length)) {
    const next = (topics.length % 2 === 0 ? bad.shift() : good.shift()) ?? bad.shift() ?? good.shift();
    if (next) topics.push(next);
  }
  // Похвалу не вытесняет: только в свободное место.
  if (grumble && topics.length < MAX_REVIEWS) topics.push('lottery');
  if (!topics.length) topics.push('quiet');
  const random = rng(day * 6151 + 29);
  const authors = new Set<number>();
  return topics.map((topic) => {
    let author = Math.floor(random() * REVIEW_AUTHORS);
    while (authors.has(author)) author = (author + 1) % REVIEW_AUTHORS;
    authors.add(author);
    const stars = isNeutral(topic) ? 3 : isGood(topic) ? (random() < 0.7 ? 5 : 4) : random() < 0.6 ? 1 : 2;
    return { topic, stars, variant: Math.floor(random() * REVIEW_VARIANTS), author };
  });
}
