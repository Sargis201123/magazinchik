// Подарки друзьям в гостях (api/_lib/presents.ts): кому уже дарил сегодня, сколько подарков ждёт.
// Данные приходят при запуске игры (loadMultiplayer) и лежат здесь. Без Telegram или базы — null.

import { telegramInitData } from './telegram';
import { post } from './social';
import type { Present, PresentKind } from '../game/social';

export interface PresentsInfo {
  /** Кому из друзей уже подарил сегодня (номера — из списка друзей visits). */
  given: number[];
  /** Сколько подарков от друзей ждёт и сколько «спасибо» за мои. */
  waiting: number;
  thanks: number;
}

let cache: PresentsInfo | null = null;
export const presentsInfo = (): PresentsInfo | null => cache;

export async function fetchPresents(): Promise<PresentsInfo | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<PresentsInfo & { enabled?: boolean }>('/api/presents', { initData, action: 'list' });
  cache = res?.enabled ? { given: res.given ?? [], waiting: res.waiting ?? 0, thanks: res.thanks ?? 0 } : null;
  return cache;
}

/** Оставить подарок другу: ok или причина (already, limit, full, friend, offline). */
export async function givePresent(to: number, kind: PresentKind, phrase: number, stars: number): Promise<{ ok: boolean; error?: string }> {
  const initData = telegramInitData();
  if (!initData) return { ok: false, error: 'offline' };
  const res = await post<{ ok?: boolean; error?: string }>('/api/presents', { initData, action: 'give', to, kind, phrase, ...(stars ? { stars } : {}) });
  if (!res) return { ok: false, error: 'offline' };
  if (res.ok && cache) cache = { ...cache, given: [...cache.given, to] };
  return { ok: Boolean(res.ok), error: res.error };
}

/** Угощение кофе ушло (multiplayer.ts → treatFriend) — сегодня этому другу уже подарено. */
export function markGiven(to: number): void {
  if (cache && !cache.given.includes(to)) cache = { ...cache, given: [...cache.given, to] };
}

/**
 * Открыть подарки друзей и забрать «спасибо» за свои (один раз — сервер отмечает); coins — монеты
 * старых угощений кофе (до 01.11), from — от кого они.
 */
export async function openPresentsBox(): Promise<{ presents: Present[]; thanks: string[]; coins: number; from: string[] } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ presents?: Present[]; thanks?: string[]; coins?: number; from?: string[] }>('/api/presents', { initData, action: 'open' });
  if (!res) return null;
  if (cache) cache = { ...cache, waiting: 0, thanks: 0 };
  const coins = Math.max(0, Math.min(100_000, Math.round(Number(res.coins) || 0)));
  return { presents: res.presents ?? [], thanks: res.thanks ?? [], coins, from: (res.from ?? []).map((n) => String(n).slice(0, 20)) };
}
