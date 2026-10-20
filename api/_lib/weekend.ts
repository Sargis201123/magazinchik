// «Чёрная пятница района»: по выходным (суббота и воскресенье, UTC) все магазины торгуют
// одновременно. Выручка за выходные = выручка за всё время сейчас минус на начало выходных
// (пишет progress() в stats.ts). Общий счётчик всех игроков, место и топ-10. После выходных
// игра выдаёт призы (сервер говорит место и сколько было участников).

import { weekOf } from './guild.js';
import { ready } from './social.js';
import { json, verifyInitData, type D1, type Env } from './telegram.js';

const DAY = 24 * 3600_000;

/** Выходные сейчас (суббота или воскресенье по UTC). */
export const isWeekend = (now: number): boolean => [0, 6].includes(new Date(now).getUTCDay());

/** Прогресс в выходные: запомнить выручку на начало и обновить последнюю. */
export async function markWeekend(db: D1, id: number, revenue: number, now: number): Promise<void> {
  if (!isWeekend(now)) return;
  await db
    .prepare('INSERT INTO weekend (id, week, start, last) VALUES (?, ?, ?, ?) ON CONFLICT(id, week) DO UPDATE SET last = excluded.last')
    .bind(id, weekOf(now), revenue, revenue)
    .run();
}

interface Standing {
  revenue: number;
  rank: number | null;
}

async function standing(db: D1, id: number, week: number): Promise<Standing> {
  const me = await db.prepare('SELECT last - start AS revenue FROM weekend WHERE id = ? AND week = ?').bind(id, week).first<{ revenue: number }>();
  if (!me) return { revenue: 0, rank: null };
  const above = await db.prepare('SELECT COUNT(*) AS n FROM weekend WHERE week = ? AND last - start > ?').bind(week, me.revenue).first<{ n: number }>();
  return { revenue: me.revenue, rank: (above?.n ?? 0) + 1 };
}

async function summary(db: D1, week: number): Promise<{ total: number; players: number }> {
  const row = await db.prepare('SELECT COALESCE(SUM(last - start), 0) AS total, COUNT(*) AS players FROM weekend WHERE week = ? AND last > start').bind(week).first<{ total: number; players: number }>();
  return { total: row?.total ?? 0, players: row?.players ?? 0 };
}

/**
 * POST /api/weekend { initData } → { enabled, active, week, total, players, me, top, last? }:
 * идут ли выходные, общий счётчик, место игрока и топ-10; last — итог прошлых выходных.
 */
export async function weekend(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const active = isWeekend(now);
  // Неделя — с понедельника, выходные — её конец: прошлые выходные всегда в прошлой неделе.
  const week = weekOf(now);
  const lastWeek = week - 1;
  const top = active
    ? (
        await db
          .prepare('SELECT p.name AS name, w.last - w.start AS revenue, w.id = ? AS me FROM weekend w JOIN progress p ON p.id = w.id WHERE w.week = ? AND w.last > w.start ORDER BY revenue DESC LIMIT 10')
          .bind(user.id, week)
          .all<{ name: string; revenue: number; me: number }>()
      ).results.map((r) => ({ name: r.name, revenue: r.revenue, ...(r.me ? { me: true } : {}) }))
    : [];
  const last = { week: lastWeek, ...(await standing(db, user.id, lastWeek)), ...(await summary(db, lastWeek)) };
  return json({
    enabled: true,
    active,
    week,
    ...(active ? await summary(db, week) : { total: 0, players: 0 }),
    me: active ? await standing(db, user.id, week) : { revenue: 0, rank: null },
    top,
    endsIn: active ? Math.ceil(((new Date(now).getUTCDay() === 6 ? 2 : 1) * DAY - (now % DAY)) / 3600_000) : 0,
    last: last.rank ? last : undefined,
  });
}
