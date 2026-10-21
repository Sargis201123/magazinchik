// Торговая неделя с другом и гильдия района (api/_lib/guild.ts). Данные приходят при запуске
// игры и лежат здесь; утро и профиль берут их отсюда. Без Telegram или базы — null.

import { openTelegramLink, telegramInitData } from './telegram';
import { post, socialInfo } from './social';

export interface DuelInfo {
  week: number;
  daysLeft: number;
  rival?: { name: string; mine: number; theirs: number };
  last?: { week: number; won: boolean; mine: number; theirs: number; name: string };
}

export interface GuildInfo {
  name: string;
  code: string;
  owner: boolean;
  members: { name: string; week: number; me?: boolean }[];
  target: number;
  total: number;
  daysLeft: number;
  week: number;
  last?: { week: number; reached: boolean };
}

/** Событие окна: данные торговой недели и гильдии пришли (утро перерисовывается). */
export const MP_EVENT = 'magazinchik:multiplayer';

export interface WeekendInfo {
  active: boolean;
  week: number;
  total: number;
  players: number;
  me: { revenue: number; rank: number | null };
  top: { name: string; revenue: number; me?: boolean }[];
  endsIn: number;
  last?: { week: number; revenue: number; rank: number; total: number; players: number };
}

let weekendCache: WeekendInfo | null = null;
export const weekendInfo = (): WeekendInfo | null => weekendCache;

export async function fetchWeekend(): Promise<WeekendInfo | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<WeekendInfo & { enabled?: boolean }>('/api/weekend', { initData });
  weekendCache = res?.enabled ? res : null;
  return weekendCache;
}

let duelCache: DuelInfo | null = null;
let guildCache: GuildInfo | null = null;
let guildEnabled = false;

export const duelInfo = (): DuelInfo | null => duelCache;
export const guildInfo = (): GuildInfo | null => guildCache;
/** Гильдии работают (игра в Telegram и у сервера есть база). */
export const guildsEnabled = (): boolean => guildEnabled;

export async function fetchDuel(): Promise<DuelInfo | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<DuelInfo & { enabled?: boolean }>('/api/duel', { initData });
  duelCache = res?.enabled ? res : null;
  return duelCache;
}

/** Действие с гильдией; ответ — гильдия игрока (или null) и ошибка, если была. */
export async function guildAction(action: 'status' | 'create' | 'join' | 'leave', extra: { name?: string; code?: string } = {}): Promise<{ guild: GuildInfo | null; error?: string }> {
  const initData = telegramInitData();
  if (!initData) return { guild: null };
  const res = await post<{ enabled?: boolean; guild?: GuildInfo; error?: string }>('/api/guild', { initData, action, ...extra });
  guildEnabled = Boolean(res?.enabled);
  guildCache = res?.guild ?? null;
  return { guild: guildCache, error: res?.error };
}

/** Позвать в гильдию: «Поделиться» Telegram со ссылкой на бота. */
export function inviteToGuild(code: string, text: string): boolean {
  const bot = socialInfo()?.bot;
  if (!bot) return false;
  const link = `https://t.me/${bot}?start=guild_${code}`;
  return openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
}

/** Награды недели: победа в торговой неделе и выполненная цель гильдии. */
export const duelReward = (level: number, won: boolean): number => (won ? 400 + 400 * level : 100 + 100 * level);
export const guildReward = (level: number): number => 500 + 500 * level;

/** При запуске: торговая неделя и гильдия; когда пришло — событие MP_EVENT. */
export async function loadMultiplayer(): Promise<void> {
  await Promise.all([fetchDuel(), guildAction('status'), fetchWeekend(), fetchVisits()]);
  window.dispatchEvent(new Event(MP_EVENT));
}

export interface VisitFriend {
  id: number;
  name: string;
  level: number;
  treated: boolean;
}

let visitsCache: { friends: VisitFriend[]; gifts: { name: string; amount: number }[] } | null = null;
/** Друзья, которые заходят в гости, и подарки от них, ещё не забранные. */
export const visitsInfo = () => visitsCache;

export async function fetchVisits(): Promise<void> {
  const initData = telegramInitData();
  if (!initData) return;
  const res = await post<{ enabled?: boolean; friends?: VisitFriend[]; gifts?: { name: string; amount: number }[] }>('/api/visits', { initData, action: 'list' });
  visitsCache = res?.enabled ? { friends: res.friends ?? [], gifts: res.gifts ?? [] } : null;
}

/** Угостить друга кофе: он получит монеты при следующем запуске. */
export async function treatFriend(id: number): Promise<boolean> {
  const initData = telegramInitData();
  if (!initData) return false;
  const res = await post<{ ok?: boolean }>('/api/visits', { initData, action: 'gift', to: id });
  const ok = Boolean(res?.ok);
  if (ok && visitsCache) visitsCache = { ...visitsCache, friends: visitsCache.friends.map((f) => (f.id === id ? { ...f, treated: true } : f)) };
  return ok;
}

/** Забрать подарки друзей: сколько монет. */
export async function claimGifts(): Promise<number> {
  const initData = telegramInitData();
  if (!initData) return 0;
  const res = await post<{ amount?: number }>('/api/visits', { initData, action: 'claim' });
  if (visitsCache) visitsCache = { ...visitsCache, gifts: [] };
  return res?.amount ?? 0;
}

/** Магазин друга (снимок с сервера, ещё не проверенный) и его имя. null — недоступно. */
export async function fetchFriendShop(id: number): Promise<{ shop: unknown; name: string } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ shop?: unknown; name?: string }>('/api/visits', { initData, action: 'shop', to: id });
  return res?.shop ? { shop: res.shop, name: String(res.name ?? '') } : null;
}
