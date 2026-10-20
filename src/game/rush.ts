// «Чёрная пятница района» по выходным (api/_lib/weekend.ts): в субботу и воскресенье (UTC)
// все магазины торгуют одновременно — на улицах толпы, гостей больше. Флаг ставит игра
// по настоящим часам каждое утро; игровая логика только читает его.

import type { StoreState } from './economy';

export const RUSH_GUESTS = 1.25;

export const isWeekendNow = (now: number): boolean => [0, 6].includes(new Date(now).getUTCDay());

/** Утро: выходные ли сейчас по настоящим часам. */
export const ensureRush = (state: StoreState, now: number): StoreState => {
  const rush = isWeekendNow(now) || undefined;
  return state.rush === rush ? state : { ...state, rush };
};

export const rushGuests = (state: StoreState): number => (state.rush ? RUSH_GUESTS : 1);

/** Приз за выходные: всем участникам; топ-10 — втрое, топ-100 — вдвое, лучшая десятая часть — в полтора раза. */
export function rushPrize(level: number, rank: number, players: number): number {
  const base = 300 + 300 * level;
  const k = rank <= 10 ? 3 : rank <= 100 ? 2 : rank <= Math.ceil(players / 10) ? 1.5 : 1;
  return Math.round((base * k) / 10) * 10;
}
