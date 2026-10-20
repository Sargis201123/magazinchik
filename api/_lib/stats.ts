// Рейтинг магазинов и аналитика. Нужна база D1 (как для приглашений, social.ts); без неё — выключено.
//
// Игра в конце каждого дня шлёт прогресс магазина (день, уровень, рейтинг, выручка за всё время)
// и несколько событий (закончил день, обучение, банкротство…). Из прогресса строится рейтинг:
// весь Telegram и «свои» — кого игрок пригласил, кто пригласил его и кого пригласил тот же друг.
// Сводка для владельца — GET /api/stats?key=WEBHOOK_SECRET: сколько игроков, на каком дне бросают,
// сколько возвращаются на следующий день и через неделю.

import { ready } from './social.js';
import { json, verifyInitData, type Env } from './telegram.js';

const DAY = 24 * 3600_000;
/** Сколько событий за раз принимаем и как они называются. */
const MAX_EVENTS = 20;
const KIND_RE = /^[a-z_]{1,24}$/;
/** До какого дня считаем воронку «дошли до дня N». */
export const FUNNEL_DAYS = [1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120];

const int = (v: unknown, max = 1e12): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);

export interface BoardRow {
  name: string;
  day: number;
  level: number;
  rating: number;
  revenue: number;
  me?: boolean;
}

/**
 * POST /api/progress { initData, day, level, rating, revenue, money, chapter, events: [{ kind, day, value }] } → { ok }:
 * прогресс магазина (для рейтинга) и события игры (для воронки).
 */
export async function progress(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await verifyInitData(String(body.initData ?? ''), token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const now = Date.now();
  const name = (user.first_name ?? '').trim().slice(0, 20) || '—';
  const rating = Math.max(0, Math.min(5, Number(body.rating) || 0));
  await db
    .prepare(
      `INSERT INTO progress (id, name, day, level, rating, revenue, money, chapter, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, day = excluded.day, level = excluded.level, rating = excluded.rating,
       revenue = excluded.revenue, money = excluded.money, chapter = excluded.chapter, updated = excluded.updated`,
    )
    .bind(user.id, name, int(body.day, 100000), int(body.level, 10), rating, int(body.revenue), int(body.money), int(body.chapter, 100), now)
    .run();
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  for (const e of events as Record<string, unknown>[]) {
    const kind = String(e?.kind ?? '');
    if (!KIND_RE.test(kind)) continue;
    await db.prepare('INSERT INTO events (id, at, kind, day, value) VALUES (?, ?, ?, ?, ?)').bind(user.id, now, kind, int(e.day, 100000), int(e.value)).run();
  }
  return json({ ok: true });
}

const ROW = 'SELECT id, name, day, level, rating, revenue FROM progress';
type Row = BoardRow & { id: number };
const strip = (rows: Row[], me: number): BoardRow[] =>
  rows.map(({ id, name, day, level, rating, revenue }) => ({ name, day, level, rating: Math.round(rating * 10) / 10, revenue, ...(id === me ? { me: true } : {}) }));

/**
 * POST /api/leaderboard { initData } → { enabled, top, friends, rank, total }:
 * десять лучших по выручке за всё время, «свои» (друзья по приглашениям) и место игрока.
 */
export async function leaderboard(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const top = (await db.prepare(`${ROW} ORDER BY revenue DESC LIMIT 10`).all<Row>()).results;
  // Свои: кого я пригласил, кто пригласил меня и кого пригласил он же; и я сам.
  const friends = (
    await db
      .prepare(
        `${ROW} WHERE id = ?1
           OR id IN (SELECT invitee FROM referrals WHERE inviter = ?1)
           OR id IN (SELECT inviter FROM referrals WHERE invitee = ?1)
           OR id IN (SELECT invitee FROM referrals WHERE inviter IN (SELECT inviter FROM referrals WHERE invitee = ?1))
         ORDER BY revenue DESC LIMIT 50`,
      )
      .bind(user.id)
      .all<Row>()
  ).results;
  const mine = await db.prepare('SELECT revenue FROM progress WHERE id = ?').bind(user.id).first<{ revenue: number }>();
  const rank = mine ? ((await db.prepare('SELECT COUNT(*) AS n FROM progress WHERE revenue > ?').bind(mine.revenue).first<{ n: number }>())?.n ?? 0) + 1 : null;
  const total = (await db.prepare('SELECT COUNT(*) AS n FROM progress').first<{ n: number }>())?.n ?? 0;
  return json({ enabled: true, top: strip(top, user.id), friends: strip(friends, user.id), rank, total });
}

/**
 * GET /api/stats?key=WEBHOOK_SECRET → сводка для владельца: игроки, воронка по дням,
 * возвращаемость на 1-й и 7-й день, уровни, события за неделю.
 */
export async function stats(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const secret = env.WEBHOOK_SECRET ?? '';
  const db = env.DB;
  if (!secret || !db) return json({ error: 'not_configured' }, 503);
  if (new URL(request.url).searchParams.get('key') !== secret) return json({ error: 'forbidden' }, 403);
  await ready(db);
  const n = async (sql: string, ...values: unknown[]) => (await db.prepare(sql).bind(...values).first<{ n: number }>())?.n ?? 0;
  const players = await n('SELECT COUNT(*) AS n FROM players');
  const active = { day: await n('SELECT COUNT(*) AS n FROM players WHERE last_seen > ?', now - DAY), week: await n('SELECT COUNT(*) AS n FROM players WHERE last_seen > ?', now - 7 * DAY) };
  // Вернулся ли через день / неделю (из тех, кто пришёл достаточно давно).
  const retention = async (days: number) => {
    const base = await n('SELECT COUNT(*) AS n FROM players WHERE joined < ?', now - days * DAY);
    const back = await n('SELECT COUNT(*) AS n FROM players WHERE joined < ? AND last_seen - joined >= ?', now - days * DAY, days * DAY);
    return { base, back, share: base ? Math.round((back / base) * 100) : null };
  };
  const funnel: Record<string, number> = {};
  for (const d of FUNNEL_DAYS) funnel[`day${d}`] = await n('SELECT COUNT(*) AS n FROM progress WHERE day >= ?', d);
  const levels = (await db.prepare('SELECT level, COUNT(*) AS n FROM progress GROUP BY level ORDER BY level').all<{ level: number; n: number }>()).results;
  const events = (await db.prepare('SELECT kind, COUNT(*) AS n, COUNT(DISTINCT id) AS players FROM events WHERE at > ? GROUP BY kind ORDER BY n DESC').bind(now - 7 * DAY).all<{ kind: string; n: number; players: number }>()).results;
  return json({ players, active, retention: { d1: await retention(1), d7: await retention(7) }, funnel, levels, eventsWeek: events });
}
