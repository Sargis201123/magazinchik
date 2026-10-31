// Приглашения друзей и напоминания от бота. Нужна база Cloudflare D1 (привязка DB): без неё
// всё выключено, игра работает как раньше.
//
// Приглашение: игрок делится ссылкой t.me/<бот>?startapp=ref_<его id> — она открывает игру сразу,
// без чата с ботом; при запуске сервер видит метку в подписанных данных (start_param) и записывает,
// кто пригласил (только если друг здесь впервые). Старые ссылки t.me/<бот>?start=ref_<id> работают
// как раньше: метку записывает вебхук, когда друг нажмёт «Старт». Когда друг откроет игру,
// пригласивший может забрать награду, а друг получает подарок при первом запуске.
//
// Напоминания от бота (раз в день, днём по местному времени игрока, от лица героев) — в remind.ts.
// Сюда игра присылает часовой пояс и поводы для напоминания (hooks, src/game/comeback.ts).

import { bot, json, verifyInitData, type D1, type Env } from './telegram.js';

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
  // Откуда пришёл новый игрок: рекламная ссылка src_<канал> или приглашение друга (только первый раз).
  'CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY, source TEXT, at INTEGER)',
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
  // Карточки итогов для сторис: картинка в base64, живёт пару дней (card.ts).
  'CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, owner INTEGER, at INTEGER, data TEXT)',
  'CREATE INDEX IF NOT EXISTS cards_owner ON cards (owner, at)',
  'CREATE TABLE IF NOT EXISTS gifts (sender INTEGER, receiver INTEGER, day INTEGER, amount INTEGER, claimed INTEGER DEFAULT 0, PRIMARY KEY (sender, receiver, day))',
  'CREATE INDEX IF NOT EXISTS gifts_receiver ON gifts (receiver, claimed)',
  // Как выглядит магазин (для «в гости к другу», visits.ts): снимок от игры, JSON.
  'CREATE TABLE IF NOT EXISTS shops (id INTEGER PRIMARY KEY, data TEXT, updated INTEGER)',
  // Друзья, добавленные по коду (visits.ts): в обе стороны, даже если оба уже играли.
  'CREATE TABLE IF NOT EXISTS friends (a INTEGER, b INTEGER, at INTEGER, PRIMARY KEY (a, b))',
  // «Позвать на помощь» (share.ts): кто звал и когда; кто помог кому (один раз в день каждому).
  'CREATE TABLE IF NOT EXISTS help_asks (id INTEGER PRIMARY KEY, at INTEGER)',
  'CREATE TABLE IF NOT EXISTS helps (helper INTEGER, receiver INTEGER, day INTEGER, at INTEGER, claimed INTEGER DEFAULT 0, PRIMARY KEY (helper, receiver, day))',
  'CREATE INDEX IF NOT EXISTS helps_receiver ON helps (receiver, claimed)',
  // Когда игрок последний раз готовил сообщение для окна «Поделиться» (share.ts): не чаще раза в несколько секунд.
  'CREATE TABLE IF NOT EXISTS shares (id INTEGER PRIMARY KEY, at INTEGER)',
  // Для напоминаний (remind.ts): часовой пояс игрока (минуты к востоку от Гринвича), поводы от игры
  // (ждёт ли Соня, что портится, серия гостинцев, кассир, день магазина) и о чём писали в прошлый раз.
  'CREATE TABLE IF NOT EXISTS hooks (id INTEGER PRIMARY KEY, tz INTEGER, sonya INTEGER, spoil INTEGER, streak INTEGER, gift TEXT, cashier INTEGER, day INTEGER, reason TEXT, updated INTEGER)',
  // Настройки, которые автор меняет без выпуска игры: календарь праздников (live.ts, docs/EVENTS.md).
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated INTEGER)',
  // Поддержали автора звёздами (supporters.ts): самая щедрая ступень — для золотой таблички в рейтинге.
  'CREATE TABLE IF NOT EXISTS supporters (id INTEGER PRIMARY KEY, stars INTEGER, updated INTEGER)',
].join(';\n');

/** Таблицы создаются сами при первом обращении к базе. */
const schemaReady = new WeakSet<D1>();
export async function ready(db: D1): Promise<void> {
  if (schemaReady.has(db)) return;
  for (const sql of SCHEMA.split(';\n')) await db.prepare(sql).run();
  schemaReady.add(db);
}

let botName: string | null = null;
/** Имя бота (@…) — для ссылок t.me/<бот>?startapp=… (getMe, один раз на воркер). */
export async function username(token: string): Promise<string> {
  if (!botName) botName = (await bot<{ username: string }>(token, 'getMe', {})).username;
  return botName;
}

/**
 * Друг пришёл по ссылке ref_<id> (или откликнулся на «Помоги!» — help_<id>): записать приглашение,
 * если он здесь впервые. Метка приходит из вебхука (/start) или из start_param при запуске игры.
 */
export async function recordReferral(env: Env, invitee: number, payload: string): Promise<void> {
  const db = env.DB;
  const match = /^(?:ref|help)_(\d+)$/.exec(payload.trim());
  if (!db || !match) return;
  const inviter = Number(match[1]);
  if (!inviter || inviter === invitee) return;
  await ready(db);
  const known = await db.prepare('SELECT id FROM players WHERE id = ?').bind(invitee).first<{ id: number }>();
  if (known) return;
  await db.prepare('INSERT OR IGNORE INTO referrals (invitee, inviter, at, claimed) VALUES (?, ?, ?, 0)').bind(invitee, inviter, Date.now()).run();
}

/**
 * Рекламная метка ссылки: t.me/<бот>?start=src_<канал> (через бота) или
 * t.me/<бот>?startapp=src_<канал> (сразу в игру). Приглашение друга — «ref», просьба о помощи — «help».
 */
export function sourceOf(payload: string): string | null {
  const text = payload.trim();
  const src = /^src_([a-z0-9_]{1,24})$/i.exec(text);
  if (src) return src[1].toLowerCase();
  if (/^help_\d+$/.test(text)) return 'help';
  return /^ref_\d+$/.test(text) ? 'ref' : null;
}

/** Запомнить, откуда пришёл игрок, — только если он новый и источник ещё не записан. */
export async function recordSource(env: Env, id: number, payload: string, now = Date.now()): Promise<void> {
  const db = env.DB;
  const source = sourceOf(payload);
  if (!db || !source) return;
  await ready(db);
  const known = await db.prepare('SELECT id FROM players WHERE id = ?').bind(id).first<{ id: number }>();
  if (known) return;
  await db.prepare('INSERT OR IGNORE INTO sources (id, source, at) VALUES (?, ?, ?)').bind(id, source, now).run();
}

const num = (v: unknown, min: number, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : 0);

/**
 * Часовой пояс и поводы для напоминаний — из отчёта игры (/api/social-ping и /api/progress).
 * Пояс — минуты к востоку от Гринвича (−12…+14 часов); нет его — останется прежний (или Москва).
 */
export async function saveHooks(db: D1, id: number, body: { tz?: unknown; hooks?: unknown }, now = Date.now()): Promise<void> {
  const tz = typeof body.tz === 'number' && Number.isFinite(body.tz) ? num(body.tz, -720, 840) : null;
  const h = body.hooks && typeof body.hooks === 'object' ? (body.hooks as Record<string, unknown>) : null;
  if (tz === null && !h) return;
  const gift = typeof h?.gift === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.gift) ? h.gift : '';
  await db
    .prepare(
      `INSERT INTO hooks (id, tz, sonya, spoil, streak, gift, cashier, day, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(id) DO UPDATE SET tz = COALESCE(excluded.tz, hooks.tz),
         sonya = CASE WHEN ?10 THEN excluded.sonya ELSE hooks.sonya END, spoil = CASE WHEN ?10 THEN excluded.spoil ELSE hooks.spoil END,
         streak = CASE WHEN ?10 THEN excluded.streak ELSE hooks.streak END, gift = CASE WHEN ?10 THEN excluded.gift ELSE hooks.gift END,
         cashier = CASE WHEN ?10 THEN excluded.cashier ELSE hooks.cashier END, day = CASE WHEN ?10 THEN excluded.day ELSE hooks.day END,
         updated = excluded.updated`,
    )
    .bind(id, tz, num(h?.sonya, 0, 1), num(h?.spoil, 0, 9999), num(h?.streak, 0, 7), gift, num(h?.cashier, 0, 1), num(h?.day, 0, 100000), now, h ? 1 : 0)
    .run();
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
 * POST /api/social-ping { initData, lang } → { enabled, bot, friends, unclaimed, welcome, helped }:
 * игра открылась — игрок «на месте» (напоминания обнуляются), и что с приглашениями.
 * welcome — друга пригласили, и подарок новичку ещё не вручали (вручается один раз, даже после
 * «Начать заново»); helped — сколько друзей прислали подмогу и она ещё не забрана (share.ts).
 */
export async function socialPing(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; lang?: string; tz?: unknown; hooks?: unknown };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const now = Date.now();
  await saveHooks(db, user.id, body, now);
  // Открыли игру прямой ссылкой ?startapp=src_<канал> или ref_<id> — запомнить источник и того, кто
  // пригласил, до первой записи игрока (потом он уже не новичок).
  const startParam = new URLSearchParams(body.initData ?? '').get('start_param');
  if (startParam) {
    await recordReferral(env, user.id, startParam).catch((e) => console.error(e));
    await recordSource(env, user.id, startParam, now).catch((e) => console.error(e));
  }
  await db
    .prepare(
      'INSERT INTO players (id, lang, joined, last_seen, misses) VALUES (?, ?, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET lang = excluded.lang, last_seen = excluded.last_seen, misses = 0',
    )
    .bind(user.id, body.lang === 'en' ? 'en' : 'ru', now, now)
    .run();
  const welcome = await db.prepare('UPDATE referrals SET welcomed = 1 WHERE invitee = ? AND welcomed = 0').bind(user.id).run();
  const mine = await friends(db, user.id);
  const helped = await db.prepare('SELECT COUNT(*) AS n FROM helps WHERE receiver = ? AND claimed = 0').bind(user.id).first<{ n: number }>();
  return json({
    enabled: true,
    bot: await username(token),
    friends: mine.total,
    unclaimed: mine.unclaimed,
    welcome: (welcome.meta?.changes ?? 0) > 0,
    helped: helped?.n ?? 0,
  });
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
