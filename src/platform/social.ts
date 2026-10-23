// Приглашения друзей, «Позвать на помощь» и разрешение на сообщения от бота (api/_lib/social.ts,
// api/_lib/share.ts). Работает только в Telegram и когда у сервера есть база; иначе socialInfo() —
// null и кнопок «Пригласить» и «Позвать на помощь» нет.
//
// Ссылки ведут сразу в игру: t.me/<бот>?startapp=ref_<id> (главное мини-приложение бота), без чата
// с ботом. Делимся через окно Telegram с карточкой от бота (shareMessage, Telegram 8.0+), а в старом
// клиенте — как раньше, окном «Поделиться ссылкой».

import { getLang } from '../i18n';
import { canShareMessage, openTelegramLink, requestWriteAccess, shareMessage, startParam, telegramInitData, telegramUserId } from './telegram';

/** Награда за друга, который начал играть, и подарок самому другу. */
export const INVITE_REWARD = 500;
export const WELCOME_GIFT = 300;

export interface SocialInfo {
  bot: string;
  friends: number;
  unclaimed: number;
  /** Игрока пригласили, и подарок новичку ещё не вручали. */
  welcome: boolean;
  /** Сколько друзей прислали подмогу на «Помоги!» — ещё не забрано. */
  helped: number;
}

let info: SocialInfo | null = null;

export async function post<T>(path: string, body: unknown): Promise<T | null> {
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
  const res = await post<{ enabled?: boolean; bot?: string; friends?: number; unclaimed?: number; welcome?: boolean; helped?: number }>('/api/social-ping', { initData, lang });
  if (!res?.enabled || !res.bot) return null;
  info = { bot: res.bot, friends: res.friends ?? 0, unclaimed: res.unclaimed ?? 0, welcome: Boolean(res.welcome), helped: res.helped ?? 0 };
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

/** Ссылка сразу в игру с меткой: ref_<id> — приглашение, help_<id> — «Помоги!». */
export const appLink = (bot: string, payload: string): string => `https://t.me/${bot}?startapp=${payload}`;

/** Своя ссылка-приглашение (для карточки итогов); пусто — вне Telegram или без сервера. */
export function inviteLink(): string {
  const id = telegramUserId();
  return info && id ? appLink(info.bot, `ref_${id}`) : '';
}

/** Чем кончилось «Поделиться»: отправил из окна Telegram, закрыл окно, открыли старое окно со ссылкой, не вышло. */
export type ShareOutcome = 'sent' | 'cancelled' | 'link' | 'failed';

/**
 * Сообщение для окна «Поделиться» готовит сервер. Нет id — окна нет или сервер не смог (поделимся
 * ссылкой); busy — делились только что (сервер готовит не чаще раза в несколько секунд).
 */
async function prepared(kind: 'invite' | 'help'): Promise<{ id?: string; busy?: boolean }> {
  const initData = telegramInitData();
  if (!initData || !canShareMessage()) return {};
  const res = await post<{ id?: string; error?: string }>('/api/share', { initData, kind, lang: getLang() });
  return { id: res?.id, busy: res?.error === 'too_often' };
}

/** Сервер готовит сообщение (до секунды на телефоне) — повторные касания не в счёт. */
let preparing = false;

/** Окно Telegram с карточкой от бота, а если его нет — «Поделиться ссылкой» с текстом. */
async function shareOr(kind: 'invite' | 'help', link: string, text: string): Promise<ShareOutcome> {
  // Второе касание, пока ждём сервер, — пропускаем: иначе сервер ответит «слишком часто», и вдобавок
  // к карточке откроется старое окно со ссылкой.
  if (preparing) return 'cancelled';
  preparing = true;
  let msg: { id?: string; busy?: boolean };
  try {
    msg = await prepared(kind);
  } finally {
    preparing = false;
  }
  // Делились только что (закрыл окно и сразу нажал снова) — тоже не в счёт, без окна со ссылкой.
  if (msg.busy) return 'cancelled';
  if (msg.id) return (await shareMessage(msg.id)) ? 'sent' : 'cancelled';
  return openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`) ? 'link' : 'failed';
}

/** Пригласить друзей: карточка с кнопкой «Играть» (работает и после пересылки) или ссылка. */
export async function inviteFriends(text: string): Promise<ShareOutcome> {
  const id = telegramUserId();
  if (!info || !id) return 'failed';
  return shareOr('invite', appLink(info.bot, `ref_${id}`), text);
}

/** «Позвать на помощь»: карточка с кнопкой «Помочь»; друг откроет игру — подмога уйдёт сама. */
export async function askForHelp(text: string): Promise<ShareOutcome> {
  const id = telegramUserId();
  if (!info || !id) return 'failed';
  const result = await shareOr('help', appLink(info.bot, `help_${id}`), text);
  // Без окна Telegram сервер не знает, что звали: записать просьбу отдельно, иначе друзьям нечем помочь.
  if (result === 'link') void post('/api/help', { initData: telegramInitData(), action: 'ask' });
  return result;
}

export interface HelpSent {
  ok: boolean;
  /** Кому помогли (имя из рейтинга, может быть пустым). */
  name?: string;
  /** Почему не вышло: expired, already, limit, full, self, offline… */
  error?: string;
}

const HELP_SENT_KEY = 'magazinchik.helpSent';

/**
 * Игру открыли по ссылке «Помоги!» друга (help_<id>): прислать подмогу. Проверяет сервер — по
 * подписанной метке запуска. null — открыли не по такой ссылке или подмогу из этого запуска уже слали.
 */
export async function sendHelp(): Promise<HelpSent | null> {
  const initData = telegramInitData();
  const param = startParam();
  if (!info || !initData || !/^help_\d+$/.test(param)) return null;
  // Страницу могли перезагрузить с теми же данными запуска — второй раз не слать.
  const launch = `${param}:${new URLSearchParams(initData).get('auth_date') ?? ''}`;
  try {
    if (sessionStorage.getItem(HELP_SENT_KEY) === launch) return null;
    sessionStorage.setItem(HELP_SENT_KEY, launch);
  } catch {
    // Без хранилища сервер всё равно не даст помочь дважды за день.
  }
  const res = await post<HelpSent>('/api/help', { initData, action: 'send' });
  return res ? { ok: Boolean(res.ok), name: res.name, error: res.error } : { ok: false, error: 'offline' };
}

/** Забрать подмогу друзей: их имена (пусто — никто не помог или сервер недоступен). */
export async function claimHelp(): Promise<string[]> {
  const initData = telegramInitData();
  if (!initData || !info?.helped) return [];
  const res = await post<{ names?: string[] }>('/api/help', { initData, action: 'claim' });
  info = { ...info, helped: 0 };
  return (res?.names ?? []).map((n) => String(n));
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
