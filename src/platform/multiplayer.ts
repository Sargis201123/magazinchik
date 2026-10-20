// Торговая неделя с другом и гильдия района (api/_lib/guild.ts). Данные приходят при запуске
// игры и лежат здесь; утро и вкладка «Магазин» берут их отсюда. Без Telegram или базы — null.

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
  await Promise.all([fetchDuel(), guildAction('status')]);
  window.dispatchEvent(new Event(MP_EVENT));
}
