// Куда ушли покупатели: очередь, пустые полки, дорого, к Эдуарду — и что с этим делать.
// Это то, что раньше было видно только в симуляторе: где магазин теряет деньги.

import { PRODUCTS, staffOf, type DayStats, type LostReason, type ProductId, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import type { TextKey } from '../i18n/ru';

export const LOST_REASONS: LostReason[] = ['queue', 'empty', 'expensive', 'eduard'];

export function noteLost(stats: DayStats, reason: LostReason, id?: ProductId): void {
  stats.lostWhy = { ...stats.lostWhy, [reason]: (stats.lostWhy?.[reason] ?? 0) + 1 };
  if (id && reason === 'empty') stats.missing = { ...stats.missing, [id]: (stats.missing?.[id] ?? 0) + 1 };
  if (id && reason === 'expensive') stats.pricey = { ...stats.pricey, [id]: (stats.pricey?.[id] ?? 0) + 1 };
}

/** Самые частые товары из счётчика: «🥛🥩». */
const top = (counts: Partial<Record<ProductId, number>> | undefined, n = 3): string =>
  (Object.entries(counts ?? {}) as [ProductId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => PRODUCTS[id].icon)
    .join('');

export interface LossAdvice {
  reason: LostReason;
  count: number;
  key: TextKey;
  params: Record<string, string | number>;
}

/** Причины ухода по убыванию и совет к каждой: что сделать завтра. */
export function lossAdvice(stats: DayStats, state: StoreState): LossAdvice[] {
  return LOST_REASONS.map((reason) => ({ reason, count: stats.lostWhy?.[reason] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(({ reason, count }): LossAdvice => {
      switch (reason) {
        case 'queue': {
          const key: TextKey = !staffOf(state, 'cashier')
            ? 'loss.queue.hire'
            : !hasUpgrade(state, 'register2')
              ? 'loss.queue.register'
              : !staffOf(state, 'cashier2')
                ? 'loss.queue.hire2'
                : 'loss.queue.train';
          return { reason, count, key, params: {} };
        }
        case 'empty':
          return { reason, count, key: 'loss.empty', params: { list: top(stats.missing) } };
        case 'expensive':
          return { reason, count, key: 'loss.expensive', params: { list: top(stats.pricey) } };
        case 'eduard':
          return { reason, count, key: 'loss.eduard', params: {} };
      }
    });
}
