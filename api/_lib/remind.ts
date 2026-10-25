// Напоминания от бота: раз в час cron (wrangler.jsonc) смотрит, кто не заходил почти сутки, и бот
// пишет ему одно сообщение в день — от лица героя, с его портретом и по делу: Соня хочет что-то
// сказать, друг прислал подмогу, сегодня заходит Дед Мороз, ждёт праздничная открытка, бабушкина
// серия гостинцев вот-вот прервётся, товар доживает последний день, выходная распродажа района,
// кассир торгует без хозяина. Поводы игра присылает сама (src/game/comeback.ts → social.ts, saveHooks).
//
// Пишем только днём по местному времени игрока (QUIET; пояс присылает игра, неизвестен — Москва).
// Три напоминания без ответа — больше не пишем, пока игрок сам не вернётся. Заблокировал бота —
// не пишем никогда. Картинки — public/promo/remind_<герой>.png, адрес — от APP_URL (у cron нет запроса).

import { activeEvent, addDays, cardOf, dateAt, daysBetween, guestOn, type GuestId, type LiveEvent } from '../../src/game/live.js';
import { liveEventsFor } from './live.js';
import { ready } from './social.js';
import { bot, type Env } from './telegram.js';

const HOUR = 3600_000;
/** Не заходил столько — напомнить; не чаще раза в REMIND_EVERY; не больше MAX_MISSES подряд. */
export const IDLE_AFTER = 20 * HOUR;
export const REMIND_EVERY = 22 * HOUR;
export const MAX_MISSES = 3;
/** Пишем только днём по местному времени игрока: с 10:00 до 21:00. */
export const QUIET = { from: 10, to: 21 };
/** Пояс игрока, если игра его ещё не присылала: Москва (UTC+3), как было до местного времени. */
export const DEFAULT_TZ = 180;
/** За один запуск cron — не больше стольких сообщений. */
const BATCH = 200;

/** Минуты дня по местному времени игрока. */
export const localMinutes = (now: number, tz: number): number => (((Math.floor(now / 60_000) + tz) % 1440) + 1440) % 1440;
/** Сейчас у игрока день (можно писать). */
export const daytime = (now: number, tz: number): boolean => {
  const m = localMinutes(now, tz);
  return m >= QUIET.from * 60 && m < QUIET.to * 60;
};

/** Выходные «Чёрной пятницы района» (как в weekend.ts: суббота и воскресенье по UTC). */
const weekend = (now: number): boolean => [0, 6].includes(new Date(now).getUTCDay());

export type Reason = 'sonya' | 'helped' | 'guest' | 'card' | 'gift' | 'spoil' | 'weekend' | 'cashier' | 'day';
export type Face = 'sonya' | 'grandma' | 'valya' | 'anchor' | GuestId;

/** Что известно об игроке для напоминания: поводы из игры (hooks) и что знает сервер. */
export interface Player {
  id: number;
  lang: 'ru' | 'en';
  tz: number;
  sonya: number;
  spoil: number;
  streak: number;
  gift: string;
  cashier: number;
  day: number;
  /** О чём писали в прошлый раз — второй раз подряд о том же не пишем, если есть другой повод. */
  reason: string | null;
  /** Имя друга, чья подмога ещё не забрана (share.ts). */
  helper: string | null;
}

export interface Reminder {
  reason: Reason;
  face: Face;
  text: string;
}

const GIFT_DAYS = 7;
const DAY_NAMES = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const dayName = (date: string, lang: 'ru' | 'en'): string =>
  lang === 'ru' ? `${Number(date.slice(8))} ${DAY_NAMES.ru[Number(date.slice(5, 7)) - 1]}` : `${DAY_NAMES.en[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8))}`;

/** Тексты от лица героев. В {…} — подстановки. */
const TEXTS: Record<'ru' | 'en', Record<string, string>> = {
  ru: {
    sonya: '👧 Соня: «Пап, ты сегодня зайдёшь в магазин? Я хотела тебе кое-что сказать…»',
    helped: '👵 Бабушка: «Внучек, {name} прислал тебе подмогу! Заходи — сегодня касса будет пробивать быстрее»',
    'guest.moroz': '🎅 Дед Мороз: «Хо-хо! Сегодня загляну в твой магазинчик с подарком — открывайся, не проспи!»',
    'guest.snegurochka': '❄️ Снегурочка: «Сегодня я загляну к тебе в магазин с подарком. Жди меня!»',
    'card.newyear': '🎄 Снегурочка: «Открытка на {date} уже ждёт тебя в магазинчике. До Нового года — {left}!»',
    'card.newyear.eve': '🎆 Снегурочка: «Сегодня последний день года! Открытка уже ждёт тебя в магазинчике. С наступающим!»',
    'card.newyear.jan': '🎄 Снегурочка: «С Новым годом! Открытка на {date} ждёт тебя в магазинчике»',
    'card.feb23': '🎖 Бабушка: «Внучек, с праздником! В магазине тебя ждёт открытка к 23 Февраля»',
    'card.march8': '🌷 Валентина: «С праздником весны! В магазинчике тебя ждёт открытка — и мимоза»',
    gift: '👵 Бабушка: «Внучек, гостинец уже собран — день {n} из 7! Загляни сегодня, а то серия начнётся сначала»',
    'gift.big': '👵 Бабушка: «Внучек, шесть дней подряд заходил — сегодня самый большой гостинец! Не пропусти»',
    spoil: '🧓 Валентина: «Слышала, у тебя на складе {n} шт. доживают последний день. Продай со скидкой, пока не пропали!»',
    weekend: '📺 Новости района: «Выходная распродажа! Все магазины района соревнуются, кто наторгует больше. Успей занять место»',
    cashier: '👵 Бабушка: «Кассир торгует без тебя, но полки пустеют. Заглянул бы, закупил товара»',
    day: '👵 Бабушка: «День {day}: у дверей уже собрались покупатели. Открываем?»',
    'day.0': '👵 Бабушкин гостинец уже ждёт! Загляни в магазинчик — покупатели скучают.',
    play: '▶ Играть',
  },
  en: {
    sonya: '👧 Sonya: "Dad, will you come by the shop today? I wanted to tell you something…"',
    helped: '👵 Grandma: "Dear, {name} sent you help! Drop by — the till will ring faster today"',
    'guest.moroz': '🎅 Grandfather Frost: "Ho-ho! I\'ll drop by your shop today with a present — be open!"',
    'guest.snegurochka': '❄️ Snow Maiden: "I\'ll visit your shop today with a present. Wait for me!"',
    'card.newyear': '🎄 Snow Maiden: "Your card for {date} is waiting in the shop. {left} to New Year!"',
    'card.newyear.eve': '🎆 Snow Maiden: "It\'s the last day of the year! Your card is waiting in the shop. Happy New Year!"',
    'card.newyear.jan': '🎄 Snow Maiden: "Happy New Year! Your card for {date} is waiting in the shop"',
    'card.feb23': '🎖 Grandma: "Dear, happy holiday! A February 23rd card is waiting for you in the shop"',
    'card.march8': '🌷 Valentina: "Happy spring holiday! A card is waiting for you in the shop — with mimosa"',
    gift: '👵 Grandma: "Dear, your gift is ready — day {n} of 7! Come today, or the streak starts over"',
    'gift.big': '👵 Grandma: "Dear, six days in a row — today is the biggest gift! Don\'t miss it"',
    spoil: '🧓 Valentina: "I heard {n} items in your stockroom are on their last day. Sell them at a discount before they spoil!"',
    weekend: '📺 District news: "Weekend sale! All the shops in the district compete for the best takings. Grab your spot"',
    cashier: '👵 Grandma: "Your cashier is trading without you, but the shelves are emptying. Come restock"',
    day: '👵 Grandma: "Day {day}: customers are already at the door. Shall we open?"',
    'day.0': "👵 Grandma's gift is waiting! Drop by the shop — the customers miss you.",
    play: '▶ Play',
  },
};

const fill = (text: string, params: Record<string, string | number>): string => text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));

/** Сколько дней до Нового года — словами (дата — в декабре). */
function daysLeft(date: string, lang: 'ru' | 'en'): string {
  const n = daysBetween(date, `${Number(date.slice(0, 4)) + 1}-01-01`);
  if (lang === 'en') return `${n} day${n === 1 ? '' : 's'}`;
  const tail = n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней';
  return `${n} ${tail}`;
}

/**
 * Все поводы написать игроку — по важности: Соня, подмога друга, праздничный гость, открытка,
 * серия гостинцев, порча, выходные, кассир; последний — просто «день N».
 */
export function reasons(p: Player, now: number, events: LiveEvent[]): Reminder[] {
  const lang = p.lang;
  const t = TEXTS[lang];
  const out: Reminder[] = [];
  const date = dateAt(now, p.tz);
  if (p.sonya) out.push({ reason: 'sonya', face: 'sonya', text: t.sonya });
  if (p.helper) out.push({ reason: 'helped', face: 'grandma', text: fill(t.helped, { name: p.helper }) });
  const e = activeEvent(events, date);
  const guest = guestOn(e, date);
  if (guest) out.push({ reason: 'guest', face: guest, text: t[`guest.${guest}`] });
  const card = e ? cardOf(e, date) : null;
  if (e && card) {
    const face: Face = e.theme === 'newyear' ? 'snegurochka' : e.theme === 'march8' ? 'valya' : 'grandma';
    // Новогодняя открытка: в декабре — сколько осталось до праздника, 31-го — канун, в январе — поздравление.
    const month = date.slice(5, 7);
    const key = e.theme !== 'newyear' ? `card.${e.theme}` : date.slice(5) === '12-31' ? 'card.newyear.eve' : month === '12' ? 'card.newyear' : 'card.newyear.jan';
    out.push({ reason: 'card', face, text: fill(t[key], { date: dayName(date, lang), left: month === '12' ? daysLeft(date, lang) : '' }) });
  }
  // Серия гостинцев продолжится, только если зайти сегодня: последний был вчера.
  if (p.gift && p.gift === addDays(date, -1) && p.streak >= 1 && p.streak < GIFT_DAYS) {
    out.push({ reason: 'gift', face: 'grandma', text: p.streak === GIFT_DAYS - 1 ? t['gift.big'] : fill(t.gift, { n: p.streak + 1 }) });
  }
  if (p.spoil > 0) out.push({ reason: 'spoil', face: 'valya', text: fill(t.spoil, { n: p.spoil }) });
  if (weekend(now)) out.push({ reason: 'weekend', face: 'anchor', text: t.weekend });
  if (p.cashier) out.push({ reason: 'cashier', face: 'grandma', text: t.cashier });
  out.push({ reason: 'day', face: 'grandma', text: p.day > 1 ? fill(t.day, { day: p.day }) : t['day.0'] });
  return out;
}

/** Повод для напоминания: самый важный, но не тот же, что в прошлый раз (если есть другой). */
export function pickReminder(p: Player, now: number, events: LiveEvent[]): Reminder {
  const all = reasons(p, now, events);
  return all.find((r) => r.reason !== p.reason) ?? all[0];
}

/** Картинки уже загружены в Telegram: дальше шлём по file_id — быстро и без лишних скачиваний. */
const photoIds = new Map<string, string>();
export const resetReminderPhotos = (): void => photoIds.clear();

/** Адрес картинки героя на сайте игры (абсолютный: Telegram скачивает её сам). */
export const faceUrl = (app: string, face: Face): string => new URL(`promo/remind_${face}.png`, app).href;

/** Отправить напоминание: картинка с подписью и кнопкой «Играть»; картинка не прошла — просто текстом. */
async function deliver(token: string, app: string, chat: number, r: Reminder, lang: 'ru' | 'en'): Promise<void> {
  const reply_markup = app ? { inline_keyboard: [[{ text: TEXTS[lang].play, web_app: { url: app } }]] } : undefined;
  if (app) {
    const url = faceUrl(app, r.face);
    try {
      const sent = await bot<{ photo?: { file_id: string }[] }>(token, 'sendPhoto', { chat_id: chat, photo: photoIds.get(url) ?? url, caption: r.text, reply_markup });
      const id = sent?.photo?.[sent.photo.length - 1]?.file_id;
      if (id) photoIds.set(url, id);
      return;
    } catch (error) {
      // Бот заблокирован — дальше не пробуем; иначе (картинка не скачалась) — текстом.
      if (/blocked|deactivated|chat not found|Forbidden/i.test(String(error))) throw error;
      photoIds.delete(url);
    }
  }
  await bot(token, 'sendMessage', { chat_id: chat, text: r.text, ...(reply_markup ? { reply_markup } : {}) });
}

/** Раз в час (cron): кто давно не заходил и у кого сейчас день — бот пишет одно напоминание. */
export async function sendReminders(env: Env, now = Date.now()): Promise<number> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return 0;
  await ready(db);
  // Местное время — прямо в запросе: в пачку попадают только те, у кого сейчас день.
  const minute = (Math.floor(now / 60_000) % 1440) + 1440;
  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.lang AS lang, p.misses AS misses, h.tz AS tz, h.sonya AS sonya, h.spoil AS spoil, h.streak AS streak, h.gift AS gift,
         h.cashier AS cashier, COALESCE(h.day, pr.day) AS day, h.reason AS reason,
         (SELECT g.name FROM helps hp JOIN progress g ON g.id = hp.helper WHERE hp.receiver = p.id AND hp.claimed = 0 LIMIT 1) AS helper
       FROM players p LEFT JOIN hooks h ON h.id = p.id LEFT JOIN progress pr ON pr.id = p.id
       WHERE p.last_seen < ?1 AND (p.reminded_at IS NULL OR p.reminded_at < ?2) AND p.misses < ?3
         AND (?4 + COALESCE(h.tz, ?5)) % 1440 >= ?6 AND (?4 + COALESCE(h.tz, ?5)) % 1440 < ?7
       LIMIT ?8`,
    )
    .bind(now - IDLE_AFTER, now - REMIND_EVERY, MAX_MISSES, minute, DEFAULT_TZ, QUIET.from * 60, QUIET.to * 60, BATCH)
    .all<{ id: number; lang: string; misses: number; tz: number | null; sonya: number | null; spoil: number | null; streak: number | null; gift: string | null; cashier: number | null; day: number | null; reason: string | null; helper: string | null }>();
  if (!results.length) return 0;
  const app = env.APP_URL ?? '';
  const events = await liveEventsFor(env);
  let sent = 0;
  for (const row of results) {
    const lang = row.lang === 'en' ? 'en' : 'ru';
    const player: Player = {
      id: row.id,
      lang,
      tz: row.tz ?? DEFAULT_TZ,
      sonya: row.sonya ?? 0,
      spoil: row.spoil ?? 0,
      streak: row.streak ?? 0,
      gift: row.gift ?? '',
      cashier: row.cashier ?? 0,
      day: row.day ?? 0,
      reason: row.reason,
      helper: row.helper && row.helper !== '—' ? row.helper : null,
    };
    const reminder = pickReminder(player, now, events);
    try {
      await deliver(token, app, row.id, reminder, lang);
      await db.prepare('UPDATE players SET reminded_at = ?, misses = misses + 1 WHERE id = ?').bind(now, row.id).run();
      await db.prepare('INSERT INTO hooks (id, reason, updated) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET reason = excluded.reason').bind(row.id, reminder.reason, now).run();
      sent++;
    } catch {
      // Бот заблокирован или чата нет — больше не пишем.
      await db.prepare('UPDATE players SET reminded_at = ?, misses = 99 WHERE id = ?').bind(now, row.id).run();
    }
  }
  return sent;
}
