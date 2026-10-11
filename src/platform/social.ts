// Приглашения друзей и разрешение на сообщения от бота (api/_lib/social.ts). Работает только в
// Telegram и когда у сервера есть база; иначе socialInfo() — null и кнопки «Пригласить» нет.

import { openTelegramLink, requestWriteAccess, telegramInitData, telegramUserId } from './telegram';

/** Награда за друга, который начал играть, и подарок самому другу. */
export const INVITE_REWARD = 500;
export const WELCOME_GIFT = 300;

export interface SocialInfo {
  bot: string;
  friends: number;
  unclaimed: number;
  /** Игрока пригласили, и подарок новичку ещё не вручали. */
  welcome: boolean;
}

let info: SocialInfo | null = null;

async function post<T>(path: string, body: unknown): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Игра открылась: отметиться у сервера (бот не будет напоминать) и узнать про приглашения. */
export async function socialPing(lang: string): Promise<SocialInfo | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ enabled?: boolean; bot?: string; friends?: number; unclaimed?: number; welcome?: boolean }>('/api/social-ping', { initData, lang });
  if (!res?.enabled || !res.bot) return null;
  info = { bot: res.bot, friends: res.friends ?? 0, unclaimed: res.unclaimed ?? 0, welcome: Boolean(res.welcome) };
  return info;
}

export const socialInfo = (): SocialInfo | null => info;

/** Забрать награду за пришедших друзей: сколько друзей засчитано. */
export async function claimFriends(): Promise<number> {
  const initData = telegramInitData();
  if (!initData || !info) return 0;
  const res = await post<{ claimed?: number }>('/api/social-claim', { initData });
  const claimed = res?.claimed ?? 0;
  info = { ...info, unclaimed: 0 };
  return claimed;
}

/** Открыть окно «Поделиться» Telegram со ссылкой-приглашением. */
export function inviteFriends(text: string): boolean {
  const id = telegramUserId();
  if (!info || !id) return false;
  const link = `https://t.me/${info.bot}?start=ref_${id}`;
  return openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
}

const ASKED_KEY = 'magazinchik.writeAccess';

/** Один раз спросить разрешение писать игроку (для напоминаний), если он пришёл не через бота. */
export function askWriteAccessOnce(): void {
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    return;
  }
  requestWriteAccess();
}
