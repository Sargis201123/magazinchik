// Недельный турнир района (api/_lib/league.ts): лига этой недели и итог прошлой. Данные приходят
// при запуске игры (loadMultiplayer) и лежат здесь; утро и рейтинг берут их отсюда.

import { telegramInitData } from './telegram';
import { post } from './social';
import type { LeagueResult, LeagueRow } from '../game/social';

export interface LeagueInfo {
  week: number;
  daysLeft: number;
  /** Ступень лиги этой недели (0 — Бронза, 1 — Серебро, 2 — Золото); нет — ещё не записан. */
  tier?: number;
  rows?: LeagueRow[];
  place?: number | null;
  last?: LeagueResult;
}

let cache: LeagueInfo | null = null;
export const leagueInfo = (): LeagueInfo | null => cache;
/** Когда последний раз спрашивали сервер (0 — ни разу): утро не просит таблицу второй раз сразу после запуска. */
let askedAt = 0;
export const leagueAskedAt = (): number => askedAt;

export async function fetchLeague(): Promise<LeagueInfo | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  askedAt = Date.now();
  const res = await post<LeagueInfo & { enabled?: boolean }>('/api/league', { initData });
  cache = res?.enabled ? res : null;
  return cache;
}
