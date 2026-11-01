// Выходные района: в субботу и воскресенье (UTC) на улицах толпы, гостей больше, а очки турнира
// идут ×WEEKEND_BONUS (game/social.ts). Флаг ставит игра по настоящим часам каждое утро; игровая
// логика только читает его. Своего соревнования и приза у выходных больше нет — они часть турнира.

import type { StoreState } from './economy';

export const RUSH_GUESTS = 1.25;

export const isWeekendNow = (now: number): boolean => [0, 6].includes(new Date(now).getUTCDay());

/** Утро: выходные ли сейчас по настоящим часам. */
export const ensureRush = (state: StoreState, now: number): StoreState => {
  const rush = isWeekendNow(now) || undefined;
  return state.rush === rush ? state : { ...state, rush };
};

export const rushGuests = (state: StoreState): number => (state.rush ? RUSH_GUESTS : 1);
