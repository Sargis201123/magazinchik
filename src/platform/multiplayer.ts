// Друзья в игре (api/_lib/visits.ts): кто заходит в гости, улица друзей, угощение. Данные приходят
// при запуске игры и лежат здесь; утро и профиль берут их отсюда. Без Telegram или базы — null.
// Дуэль, гильдию и «Чёрную пятницу» убрали (решено автором 01.11): соревнуемся в турнире (league.ts).

import { telegramInitData } from './telegram';
import { post } from './social';
import { fetchPresents, markGiven } from './presents';
import { fetchLeague } from './league';
import { streetFriends, type StreetFriend } from '../game/street';

/** Событие окна: данные друзей, подарков и турнира пришли (утро перерисовывается). */
export const MP_EVENT = 'magazinchik:multiplayer';

/** При запуске: друзья, подарки, турнир и улица друзей; когда пришло — событие MP_EVENT. */
export async function loadMultiplayer(): Promise<void> {
  await Promise.all([fetchVisits(), fetchPresents(), fetchLeague(), fetchStreet()]);
  window.dispatchEvent(new Event(MP_EVENT));
}

export interface VisitFriend {
  id: number;
  name: string;
  level: number;
  treated: boolean;
}

let visitsCache: { code: string; friends: VisitFriend[] } | null = null;
/** Друзья, которые заходят в гости, и свой код для друзей. */
export const visitsInfo = () => visitsCache;

export async function fetchVisits(): Promise<void> {
  const initData = telegramInitData();
  if (!initData) return;
  // Старые угощения (gifts) сервер ещё присылает — их монеты открываются с подарками (presents.ts).
  const res = await post<{ enabled?: boolean; code?: string; friends?: VisitFriend[] }>('/api/visits', { initData, action: 'list' });
  visitsCache = res?.enabled ? { code: res.code ?? '', friends: res.friends ?? [] } : null;
}

/**
 * Угостить друга кофе: с 01.11 это подарок-пирог (сервер сам делает его подарком, presents.ts) —
 * друг откроет его утром вместе с остальными. Сегодня этому другу подарок уже ушёл — false.
 */
export async function treatFriend(id: number): Promise<boolean> {
  const initData = telegramInitData();
  if (!initData) return false;
  const res = await post<{ ok?: boolean }>('/api/visits', { initData, action: 'gift', to: id });
  const ok = Boolean(res?.ok);
  if (ok && visitsCache) visitsCache = { ...visitsCache, friends: visitsCache.friends.map((f) => (f.id === id ? { ...f, treated: true } : f)) };
  if (ok) markGiven(id);
  return ok;
}

/** Недельная доля друга, который работает у нас (nightShift.ts): монеты — он откроет их с подарками. */
export async function payFriend(id: number): Promise<boolean> {
  const initData = telegramInitData();
  if (!initData) return false;
  const res = await post<{ ok?: boolean }>('/api/visits', { initData, action: 'pay', to: id });
  return Boolean(res?.ok);
}

/** Магазин друга (снимок с сервера, ещё не проверенный) и его имя. null — недоступно. */
export async function fetchFriendShop(id: number): Promise<{ shop: unknown; name: string } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ shop?: unknown; name?: string }>('/api/visits', { initData, action: 'shop', to: id });
  return res?.shop ? { shop: res.shop, name: String(res.name ?? '') } : null;
}

/** Добавить друга по его коду: ok и имя, либо причина (bad_code, not_found, too_many, offline). */
export async function addFriend(code: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const initData = telegramInitData();
  if (!initData) return { ok: false, error: 'offline' };
  const res = await post<{ ok?: boolean; name?: string; error?: string }>('/api/visits', { initData, action: 'add', code });
  if (!res) return { ok: false, error: 'offline' };
  if (res.ok) await Promise.all([fetchVisits(), fetchStreet(true)]);
  return { ok: Boolean(res.ok), name: res.name, error: res.error };
}

/** «Улица друзей» (game/street.ts): домики друзей за дорогой. null — улица выключена (нет Telegram или базы). */
let streetCache: StreetFriend[] | null = null;
let streetAt = 0;
/** Чаще не спрашиваем: сервер тоже помнит ответ несколько минут. */
const STREET_FRESH = 10 * 60_000;
export const streetInfo = (): StreetFriend[] | null => streetCache;

/** Улица с сервера одним запросом; ответ проверен (имена обрезаны, уровни в пределах). Без связи — прежний список. */
export async function fetchStreet(force = false): Promise<StreetFriend[] | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  if (!force && streetAt && Date.now() - streetAt < STREET_FRESH) return streetCache;
  const res = await post<{ enabled?: boolean; friends?: unknown }>('/api/visits', { initData, action: 'street' });
  if (!res) return streetCache;
  streetAt = Date.now();
  streetCache = res.enabled ? streetFriends(res.friends) : null;
  return streetCache;
}
