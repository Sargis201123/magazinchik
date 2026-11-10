// Район (10.11, третий обход): то, что связывает игроков, у которых нет друзей в игре.
// - «Магазин дня»: каждый день один настоящий магазин выбирается для всех (кроме его хозяина — он видит следующего).
//   К нему можно зайти в гости и оставить отметку «Был тут»; хозяин утром узнаёт, сколько гостей у него было.
// - Полить теплицу другу (src/game/garden.ts): раз в день каждому другу, его урожай поспеет на час раньше.
// - Общая цель района: выручка всех магазинов за неделю (по счёту сервера, как в турнире) плюс «соседи» — придуманные
//   магазины, чей вклад растёт с неделей (как соседи лиги). Набрали — каждый, кто торговал на этой неделе, забирает
//   награду; выдаёт её игра (src/game/town.ts), как награду турнира.
// Всё одним адресом: POST /api/town { initData, action }.

import { ready } from './social.js';
import { network } from './visits.js';
import { weekOf } from './week.js';
import { json, verifyInitData, type D1, type Env } from './telegram.js';
import { GOAL_BASE, GOAL_PER_SHOP, goalNeighbours } from '../../src/game/town.js';

const DAY = 24 * 3600_000;
const today = (now: number): number => Math.floor(now / DAY);
/** Начало недели (мс): понедельник, 00:00 UTC (как в league.ts). */
const weekStart = (week: number): number => (week * 7 - 3) * DAY;
/** Магазином дня может стать тот, кто играл за столько дней и прожил хотя бы столько дней магазина. */
const ACTIVE_DAYS = 14;
const MIN_DAY = 3;
/** Больше стольких поливов за раз не засчитываем. */
const WATER_MAX = 5;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS likes (sender INTEGER, receiver INTEGER, day INTEGER, seen INTEGER DEFAULT 0, PRIMARY KEY (sender, receiver, day))',
  'CREATE INDEX IF NOT EXISTS likes_receiver ON likes (receiver, seen)',
  'CREATE TABLE IF NOT EXISTS waters (sender INTEGER, receiver INTEGER, day INTEGER, claimed INTEGER DEFAULT 0, PRIMARY KEY (sender, receiver, day))',
  'CREATE INDEX IF NOT EXISTS waters_receiver ON waters (receiver, claimed)',
];

const schemaReady = new WeakSet<D1>();
export async function townReady(db: D1): Promise<void> {
  await ready(db);
  if (schemaReady.has(db)) return;
  // Таблицы уже есть (база живёт дольше воркера) — не тратить запросы: у D1 предел на один вызов.
  const known = await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('likes', 'waters')").first<{ n: number }>();
  if ((known?.n ?? 0) < 2) for (const sql of SCHEMA) await db.prepare(sql).run();
  schemaReady.add(db);
}

export interface DayShop {
  id: number;
  name: string;
  level: number;
  day: number;
  rating: number;
  shop?: string;
}

const cut = (v: string, n: number): string => Array.from(v).slice(0, n).join('');

/** Двое первых «по жребию дня»: хозяину первого показываем второго. Ответ помним до конца дня. */
const picks = new WeakMap<D1, { day: number; rows: DayShop[] }>();
export const resetDayShops = (db: D1): void => void picks.delete(db);

export async function dayShops(db: D1, now: number): Promise<DayShop[]> {
  const day = today(now);
  const cached = picks.get(db);
  if (cached?.day === day && cached.rows.length) return cached.rows;
  // Жребий — от номера дня: порядок игроков каждый день другой, но у всех зрителей один и тот же.
  const mult = ((day * 7919) % 100003) | 1;
  const shift = (day * 31337) % 100003;
  const rows = (
    await db
      .prepare(
        `SELECT p.id AS id, p.name AS name, p.level AS level, p.day AS day, p.rating AS rating, json_extract(s.data, '$.shopName') AS shop
           FROM progress p JOIN shops s ON s.id = p.id
          WHERE p.updated > ?1 AND p.day >= ?2
          ORDER BY ((p.id % 100003) * ?3 + ?4) % 100003, p.id LIMIT 2`,
      )
      .bind(now - ACTIVE_DAYS * DAY, MIN_DAY, mult, shift)
      .all<{ id: number; name: string | null; level: number | null; day: number | null; rating: number | null; shop: unknown }>()
  ).results.map((r) => ({
    id: r.id,
    name: cut(String(r.name ?? ''), 20),
    level: Math.max(0, Math.min(10, Number(r.level) || 0)),
    day: Number(r.day) || 1,
    rating: Math.round((Number(r.rating) || 0) * 10) / 10,
    ...(typeof r.shop === 'string' && r.shop ? { shop: cut(r.shop, 32) } : {}),
  }));
  picks.set(db, { day, rows });
  return rows;
}

/** Магазин дня для игрока: первый по жребию, а его хозяину — второй. null — показывать некого. */
export const dayShopFor = async (db: D1, me: number, now: number): Promise<DayShop | null> => (await dayShops(db, now)).find((s) => s.id !== me) ?? null;

export interface GoalInfo {
  week: number;
  /** Собрано всем районом (настоящие магазины и соседи) и сколько нужно. */
  total: number;
  target: number;
  /** Сколько дней осталось до конца недели (включая сегодня); у прошлой недели — 0. */
  left: number;
  /** Игрок торговал на этой неделе — награда ему положена. */
  mine: boolean;
}

/** Общая цель недели week: выручка всех, кто торговал, плюс вклад соседей к этому часу. */
export async function goalOf(db: D1, me: number, week: number, now: number): Promise<GoalInfo> {
  // Выручка за неделю — от её начала до начала следующей (если она уже идёт) или до сейчас.
  const sum = await db
    .prepare(
      `SELECT COALESCE(SUM(MAX(0, COALESCE(n.revenue, p.revenue) - w.revenue)), 0) AS total, COUNT(*) AS shops,
              COALESCE(SUM(CASE WHEN w.id = ?2 THEN 1 ELSE 0 END), 0) AS mine
         FROM week_start w JOIN progress p ON p.id = w.id LEFT JOIN week_start n ON n.id = w.id AND n.week = w.week + 1
        WHERE w.week = ?1`,
    )
    .bind(week, me)
    .first<{ total: number; shops: number; mine: number }>();
  const frac = Math.max(0, Math.min(1, (now - weekStart(week)) / (7 * DAY)));
  const left = frac >= 1 ? 0 : 7 - Math.floor((now - weekStart(week)) / DAY);
  return {
    week,
    total: Math.round(Number(sum?.total) || 0) + goalNeighbours(frac),
    target: GOAL_BASE + GOAL_PER_SHOP * (Number(sum?.shops) || 0),
    left,
    mine: (Number(sum?.mine) || 0) > 0,
  };
}

/**
 * POST /api/town { initData, action: 'day' | 'shop' | 'like' | 'water', to?, garden? } →
 * day: { enabled, shop: DayShop | null, liked, likes, waters, goal, last? } — магазин дня, поставил ли я отметку, сколько
 *   новых отметок у меня (сервер отмечает показанными), сколько раз друзья полили (если garden — забираем), цель недели
 *   и прошлая неделя, если её цель набрали;
 * shop: { shop, name } — снимок магазина дня; like: { ok } — отметка «Был тут» (одна в день);
 * water: { ok } — полить теплицу другу to (раз в день каждому).
 */
export async function town(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; action?: string; to?: number; garden?: boolean };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await townReady(db);
  const me = user.id;
  if (body.action === 'water') {
    const to = Number(body.to);
    if (!(await network(db, me, now - ACTIVE_DAYS * DAY)).some((f) => f.id === to)) return json({ ok: false });
    const res = await db.prepare('INSERT OR IGNORE INTO waters (sender, receiver, day) VALUES (?, ?, ?)').bind(me, to, today(now)).run();
    return json({ ok: (res.meta?.changes ?? 0) > 0 });
  }
  const pick = await dayShopFor(db, me, now);
  if (body.action === 'like') {
    if (!pick) return json({ ok: false });
    const res = await db.prepare('INSERT OR IGNORE INTO likes (sender, receiver, day) VALUES (?, ?, ?)').bind(me, pick.id, today(now)).run();
    return json({ ok: (res.meta?.changes ?? 0) > 0 });
  }
  if (body.action === 'shop') {
    const row = pick ? await db.prepare('SELECT data FROM shops WHERE id = ?').bind(pick.id).first<{ data: string }>() : null;
    let shop: unknown = null;
    try {
      shop = row ? JSON.parse(row.data) : null;
    } catch {
      shop = null;
    }
    return json({ shop, name: pick?.name ?? '' });
  }
  const liked = pick ? Boolean(await db.prepare('SELECT 1 AS x FROM likes WHERE sender = ? AND receiver = ? AND day = ?').bind(me, pick.id, today(now)).first<{ x: number }>()) : false;
  // Новые отметки и поливы — одним запросом каждый: два одновременных запуска не получат их дважды.
  const likes = (await db.prepare('UPDATE likes SET seen = 1 WHERE receiver = ? AND seen = 0 RETURNING sender').bind(me).all<{ sender: number }>()).results.length;
  const waters = body.garden ? (await db.prepare('UPDATE waters SET claimed = 1 WHERE receiver = ? AND claimed = 0 RETURNING sender').bind(me).all<{ sender: number }>()).results.length : 0;
  const week = weekOf(now);
  const goal = await goalOf(db, me, week, now);
  const last = await goalOf(db, me, week - 1, now);
  return json({
    enabled: true,
    shop: pick,
    liked,
    likes: Math.min(99, likes),
    waters: Math.min(WATER_MAX, waters),
    goal,
    ...(last.mine && last.total >= last.target ? { last: { week: last.week } } : {}),
  });
}
