// Внимание игрока за день: сколько раз за 90 секунд игра просит отвлечься от кассы и что-то нажать —
// поймать момент, ответить на мини-событие, решить с особым гостем, принять звонок доставки.
// Раньше всё это планировалось само по себе, и в середине игры выходила просьба каждые десять секунд.
// Теперь у дня маленький общий бюджет: утром он делится по очереди (гость, звонок, момент, мини-событие,
// снова звонок…), лишнее просто не случается сегодня. Сюжет и беды (пожар, ограбление) — вне бюджета.

/** Сколько просьб о внимании за день, не считая сюжета и бед. */
export const ATTENTION_CAP = 5;
/** Звонков доставки за день — не больше стольких (их место в бюджете держится, даже если не позвонят). */
export const CALLS_MAX = 2;

export type AttentionKind = 'special' | 'call' | 'moment' | 'live';

/** Что дню хотелось бы: сколько моментов, мини-событий, будет ли особый гость, есть ли доставка. */
export interface AttentionWant {
  moments: number;
  live: number;
  special: boolean;
  /** Сколько звонков может быть (0 — доставки нет). */
  calls: number;
}

/** Сколько чего можно сегодня. */
export interface AttentionPlan {
  moments: number;
  live: number;
  special: boolean;
  calls: number;
}

/**
 * Очередь дележа: по одному каждого вида по кругу — так в обычный день есть и звонок, и момент,
 * и мини-событие, а не пять моментов подряд. Особый гость первым: он редкий и с выбором.
 */
const ROUND: AttentionKind[] = ['special', 'call', 'moment', 'live', 'call', 'moment', 'live', 'moment'];

/** Разделить бюджет дня между желающими. */
export function planAttention(want: AttentionWant, cap = ATTENTION_CAP): AttentionPlan {
  const plan: AttentionPlan = { moments: 0, live: 0, special: false, calls: 0 };
  let left = Math.max(0, cap);
  for (const kind of ROUND) {
    if (left <= 0) break;
    if (kind === 'special' && want.special && !plan.special) {
      plan.special = true;
      left--;
    } else if (kind === 'call' && plan.calls < Math.min(CALLS_MAX, want.calls)) {
      plan.calls++;
      left--;
    } else if (kind === 'moment' && plan.moments < want.moments) {
      plan.moments++;
      left--;
    } else if (kind === 'live' && plan.live < want.live) {
      plan.live++;
      left--;
    }
  }
  return plan;
}

/** Сколько просьб всего в плане (звонки — сколько места держится под них). */
export const attentionTotal = (plan: AttentionPlan): number => plan.moments + plan.live + plan.calls + (plan.special ? 1 : 0);

/** Оставить n из списка, равномерно по дню (первый, последний и между ними), порядок прежний. */
export function thin<T>(list: readonly T[], n: number): T[] {
  if (n >= list.length) return [...list];
  if (n <= 0) return [];
  if (n === 1) return [list[Math.floor((list.length - 1) / 2)]];
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}
