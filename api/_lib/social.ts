// Приглашения друзей и напоминания от бота. Нужна база Cloudflare D1 (привязка DB): без неё
// всё выключено, игра работает как раньше.
//
// Приглашение: игрок делится ссылкой t.me/<бот>?start=ref_<его id>. Друг нажимает «Старт» —
// вебхук записывает, кто его пригласил (только если друг здесь впервые). Когда друг откроет игру,
// пригласивший может забрать награду, а друг получает подарок при первом запуске.
//
// Напоминание: раз в час cron смотрит, кто не заходил почти сутки, и бот пишет ему одно доброе
// сообщение в день (днём по Москве). Три напоминания без ответа — больше не пишем, пока игрок
// сам не вернётся. Заблокировал бота — не пишем никогда.

import { bot, json, verifyInitData, type D1, type Env } from './telegram.js';

const HOUR = 3600_000;
/** Не заходил столько — напомнить; не чаще раза в REMIND_EVERY; не больше MAX_MISSES подряд. */
export const IDLE_AFTER = 20 * HOUR;
export const REMIND_EVERY = 22 * HOUR;
export const MAX_MISSES = 3;
/** Пишем только днём по Москве (UTC+3): с 9 до 21. */
const QUIET = { from: 6, to: 18 };

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, lang TEXT, joined INTEGER, last_seen INTEGER, reminded_at INTEGER, misses INTEGER DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS referrals (invitee INTEGER PRIMARY KEY, inviter INTEGER NOT NULL, at INTEGER, claimed INTEGER DEFAULT 0, welcomed INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS referrals_inviter ON referrals (inviter)',
  // Прогресс магазина — для рейтинга и сводки (stats.ts) — и события игры для воронки.
  'CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY, name TEXT, day INTEGER, level INTEGER, rating REAL, revenue INTEGER, money INTEGER, chapter INTEGER, updated INTEGER)',
  'CREATE INDEX IF NOT EXISTS progress_revenue ON progress (revenue)',
  // Последняя выручка, которую прислала игра (от неё считается прирост, stats.ts).
  'CREATE TABLE IF NOT EXISTS reported (id INTEGER PRIMARY KEY, raw INTEGER)',
  'CREATE TABLE IF NOT EXISTS events (id INTEGER, at INTEGER, kind TEXT, day INTEGER, value INTEGER)',
  'CREATE INDEX IF NOT EXISTS events_kind ON events (kind, at)',
  // Торговая неделя с другом и гильдии района (guild.ts).
  'CREATE TABLE IF NOT EXISTS week_start (id INTEGER, week INTEGER, revenue INTEGER, PRIMARY KEY (id, week))',
  'CREATE TABLE IF NOT EXISTS duels (id INTEGER, week INTEGER, rival INTEGER, PRIMARY KEY (id, week))',
  'CREATE TABLE IF NOT EXISTS guilds (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT, owner INTEGER, created INTEGER)',
  'CREATE TABLE IF NOT EXISTS guild_members (player INTEGER PRIMARY KEY, guild INTEGER, joined INTEGER)',
  'CREATE INDEX IF NOT EXISTS guild_members_guild ON guild_members (guild)',
  'CREATE TABLE IF NOT EXISTS guild_invites (player INTEGER PRIMARY KEY, guild INTEGER, at INTEGER)',
  'CREATE TABLE IF NOT EXISTS guild_weeks (guild INTEGER, week INTEGER, target INTEGER, PRIMARY KEY (guild, week))',
  // Выполнила ли гильдия цель недели: записывается один раз, когда неделя кончилась.
  'CREATE TABLE IF NOT EXISTS guild_results (guild INTEGER, week INTEGER, reached INTEGER, PRIMARY KEY (guild, week))',
  // «Чёрная пятница района» по выходным (weekend.ts): выручка за выходные.
  'CREATE TABLE IF NOT EXISTS weekend (id INTEGER, week INTEGER, start INTEGER, last INTEGER, PRIMARY KEY (id, week))',
  'CREATE INDEX IF NOT EXISTS weekend_week ON weekend (week)',
  // Друзья в гостях: угостить кофе (visits.ts).
  // Газета района: кому какой номер уже отправлен (newspaper.ts).
  'CREATE TABLE IF NOT EXISTS newspaper (id INTEGER, week INTEGER, PRIMARY KEY (id, week))',
  'CREATE TABLE IF NOT EXISTS gifts (sender INTEGER, receiver INTEGER, day INTEGER, amount INTEGER, claimed INTEGER DEFAULT 0, PRIMARY KEY (sender, receiver, day))',
  'CREATE INDEX IF NOT EXISTS gifts_receiver ON gifts (receiver, claimed)',
].join(';\n');

/** Таблицы создаются сами при первом обращении к базе. */
const schemaReady = new WeakSet<D1>();
export async function ready(db: D1): Promise<void> {
  if (schemaReady.has(db)) return;
  for (const sql of SCHEMA.split(';\n')) await db.prepare(sql).run();
  schemaReady.add(db);
}

let botName: string | null = null;
async function username(token: string): Promise<string> {
  if (!botName) botName = (await bot<{ username: string }>(token, 'getMe', {})).username;
  return botName;
}

/** Друг нажал «Старт» по ссылке ref_<id>: записать приглашение, если он здесь впервые. */
export async function recordReferral(env: Env, invitee: number, payload: string): Promise<void> {
  const db = env.DB;
  const match = /^ref_(\d+)$/.exec(payload.trim());
  if (!db || !match) return;
  const inviter = Number(match[1]);
  if (!inviter || inviter === invitee) return;
  await ready(db);
  const known = await db.prepare('SELECT id FROM players WHERE id = ?').bind(invitee).first<{ id: number }>();
  if (known) return;
  await db.prepare('INSERT OR IGNORE INTO referrals (invitee, inviter, at, claimed) VALUES (?, ?, ?, 0)').bind(invitee, inviter, Date.now()).run();
}

/** Сколько приглашённых уже играют и сколько из них ещё не забраны. */
async function friends(db: D1, inviter: number): Promise<{ total: number; unclaimed: number }> {
  const row = await db
    .prepare(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN r.claimed = 0 THEN 1 ELSE 0 END) AS unclaimed FROM referrals r JOIN players p ON p.id = r.invitee WHERE r.inviter = ?',
    )
    .bind(inviter)
    .first<{ total: number; unclaimed: number | null }>();
  return { total: row?.total ?? 0, unclaimed: row?.unclaimed ?? 0 };
}

/**
 * POST /api/social-ping { initData, lang } → { enabled, bot, friends, unclaimed, welcome }:
 * игра открылась — игрок «на месте» (напоминания обнуляются), и что с приглашениями.
 * welcome — друга пригласили, и подарок новичку ещё не вручали (вручается один раз, даже после
 * «Начать заново»).
 */
export async function socialPing(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; lang?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const now = Date.now();
  await db
    .prepare(
      'INSERT INTO players (id, lang, joined, last_seen, misses) VALUES (?, ?, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET lang = excluded.lang, last_seen = excluded.last_seen, misses = 0',
    )
    .bind(user.id, body.lang === 'en' ? 'en' : 'ru', now, now)
    .run();
  const welcome = await db.prepare('UPDATE referrals SET welcomed = 1 WHERE invitee = ? AND welcomed = 0').bind(user.id).run();
  const mine = await friends(db, user.id);
  return json({ enabled: true, bot: await username(token), friends: mine.total, unclaimed: mine.unclaimed, welcome: (welcome.meta?.changes ?? 0) > 0 });
}

/** POST /api/social-claim { initData } → { claimed }: забрать награду за пришедших друзей. */
export async function socialClaim(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ claimed: 0 });
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const result = await db
    .prepare('UPDATE referrals SET claimed = 1 WHERE inviter = ? AND claimed = 0 AND invitee IN (SELECT id FROM players)')
    .bind(user.id)
    .run();
  return json({ claimed: result.meta?.changes ?? 0 });
}

const REMINDERS = {
  ru: [
    '👵 Бабушкин гостинец уже ждёт! Загляни в магазинчик — покупатели скучают.',
    '🛒 У дверей магазина собралась очередь. Пора открывать смену!',
    '📦 Склад ждёт хозяина: проверь, ничего ли не портится, и закупи свежего.',
  ],
  en: [
    "👵 Grandma's gift is waiting! Drop by the shop — the customers miss you.",
    "🛒 There's a queue at the shop door. Time to open up!",
    '📦 The warehouse needs its owner: check nothing is spoiling and buy fresh stock.',
  ],
};

/** Раз в час (cron): кто давно не заходил — бот пишет одно напоминание с кнопкой «Играть». */
export async function sendReminders(env: Env, now = Date.now()): Promise<number> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return 0;
  const hour = new Date(now).getUTCHours();
  if (hour < QUIET.from || hour > QUIET.to) return 0;
  await ready(db);
  const { results } = await db
    .prepare('SELECT id, lang, misses FROM players WHERE last_seen < ? AND (reminded_at IS NULL OR reminded_at < ?) AND misses < ? LIMIT 200')
    .bind(now - IDLE_AFTER, now - REMIND_EVERY, MAX_MISSES)
    .all<{ id: number; lang: string; misses: number }>();
  const app = env.APP_URL ?? '';
  let sent = 0;
  for (const p of results) {
    const lang = p.lang === 'en' ? 'en' : 'ru';
    const text = REMINDERS[lang][(Math.floor(now / (24 * HOUR)) + p.id) % REMINDERS[lang].length];
    try {
      await bot(token, 'sendMessage', {
        chat_id: p.id,
        text,
        ...(app ? { reply_markup: { inline_keyboard: [[{ text: lang === 'ru' ? '▶ Играть' : '▶ Play', web_app: { url: app } }]] } } : {}),
      });
      await db.prepare('UPDATE players SET reminded_at = ?, misses = misses + 1 WHERE id = ?').bind(now, p.id).run();
      sent++;
    } catch {
      // Бот заблокирован или чата нет — больше не пишем.
      await db.prepare('UPDATE players SET reminded_at = ?, misses = 99 WHERE id = ?').bind(now, p.id).run();
    }
  }
  return sent;
}
