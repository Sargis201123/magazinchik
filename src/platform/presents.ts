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

/** Открыть подарки друзей и забрать «спасибо» за свои (один раз — сервер отмечает). */
export async function openPresentsBox(): Promise<{ presents: Present[]; thanks: string[] } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ presents?: Present[]; thanks?: string[] }>('/api/presents', { initData, action: 'open' });
  if (!res) return null;
  if (cache) cache = { ...cache, waiting: 0, thanks: 0 };
  return { presents: res.presents ?? [], thanks: res.thanks ?? [] };
}
