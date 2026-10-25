// «Заглянуть к конкуренту» (api/_lib/rival.ts): чужой магазин по ключу из рейтинга, проделки в нём,
// что натворили у нас и «спасибо за визит». Без Telegram или сервера — null / false, игра как прежде.

import type { PrankKind, PrankIn } from '../game/rival';
import { post } from './social';
import { telegramInitData } from './telegram';

/** Снимок чужого магазина, имя хозяина и сколько проделок у нас осталось для него сегодня. */
export async function fetchRivalShop(key: string): Promise<{ shop: unknown; name: string; left: number } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ shop?: unknown; name?: string; left?: number }>('/api/rival', { initData, action: 'shop', key });
  return res?.shop ? { shop: res.shop, name: String(res.name ?? ''), left: Math.max(0, Number(res.left) || 0) } : null;
}

/** Проделка: ok и сколько осталось, либо причина (limit, pair, victim, too_often, gone, offline). */
export async function rivalAct(key: string, kind: PrankKind): Promise<{ ok: boolean; left: number; error?: string }> {
  const initData = telegramInitData();
  if (!initData) return { ok: false, left: 0, error: 'offline' };
  const res = await post<{ ok?: boolean; left?: number; error?: string }>('/api/rival', { initData, action: 'act', key, kind });
  if (!res) return { ok: false, left: 0, error: 'offline' };
  return { ok: Boolean(res.ok), left: Math.max(0, Number(res.left) || 0), error: res.error };
}

/** Что натворили у нас с прошлого раза и кто поблагодарил за наш визит (сервер отдаёт один раз). */
export async function rivalInbox(): Promise<{ pranks: PrankIn[]; thanks: string[] } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ pranks?: PrankIn[]; thanks?: string[] }>('/api/rival', { initData, action: 'inbox' });
  if (!res) return null;
  const n = (v: unknown) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
  const pranks = (Array.isArray(res.pranks) ? res.pranks : []).slice(0, 20).map((p) => ({ key: String(p.key ?? ''), name: String(p.name ?? '—').slice(0, 32), spill: n(p.spill), trash: n(p.trash), lure: n(p.lure) }));
  return { pranks, thanks: (Array.isArray(res.thanks) ? res.thanks : []).slice(0, 20).map((s) => String(s).slice(0, 32)) };
}

/** «Спасибо за визит» тому, кто к нам заходил: он получит кофе при следующем запуске. already — уже благодарили сегодня. */
export async function thankRival(key: string): Promise<'ok' | 'already' | 'offline'> {
  const initData = telegramInitData();
  if (!initData) return 'offline';
  const res = await post<{ ok?: boolean; error?: string }>('/api/rival', { initData, action: 'thank', key });
  return res?.ok ? 'ok' : res?.error === 'already' ? 'already' : 'offline';
}
