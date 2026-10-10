// Личные рекорды: лучший день по выручке и покупателям, самая длинная серия у кассы,
// больше всего денег сразу и самая долгая игра. Рекорды — игрока, а не магазина:
// переживают «Начать заново».

import type { DayStats, StoreState } from './economy';

export type RecordId = 'revenue' | 'served' | 'combo' | 'money' | 'days';

export interface Best {
  n: number;
  /** В какой день (для «лучший день»). */
  day?: number;
}

export type Records = Partial<Record<RecordId, Best>>;

export const RECORD_IDS: RecordId[] = ['revenue', 'served', 'combo', 'money', 'days'];
export const RECORD_ICONS: Record<RecordId, string> = { revenue: '💰', served: '🙂', combo: '🔥', money: '🏦', days: '📅' };

const beat = (records: Records, id: RecordId, n: number, day?: number): Best | null =>
  n > (records[id]?.n ?? 0) ? { n, day } : null;

/** О каких рекордах сказать в итогах дня: деньги и дни растут почти каждый день — о них молчим. */
const ANNOUNCE: RecordId[] = ['revenue', 'served', 'combo'];

/** Конец дня: обновить рекорды; что побито — для итогов дня (первый день не в счёт: рекордов ещё нет). */
export function updateRecords(state: StoreState, stats: DayStats, day: number): { state: StoreState; broken: RecordId[] } {
  const records: Records = { ...state.records };
  const had = Object.keys(records).length > 0;
  const broken: RecordId[] = [];
  const check = (id: RecordId, n: number, withDay = true) => {
    const best = beat(records, id, n, withDay ? day : undefined);
    if (!best) return;
    if (had && records[id] && ANNOUNCE.includes(id)) broken.push(id);
    records[id] = best;
  };
  check('revenue', stats.revenue);
  check('served', stats.served);
  check('combo', stats.bestCombo);
  check('money', state.money);
  check('days', day, false);
  return { state: { ...state, records }, broken };
}
