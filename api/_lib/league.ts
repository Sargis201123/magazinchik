// «Недельный турнир района»: каждую неделю (с понедельника, UTC — week.ts) игрок попадает в
// лигу из LEAGUE_SIZE магазинов похожего размера и своей ступени (Бронза/Серебро/Золото). Лигу
// назначает сервер при первом отчёте недели (progress() в stats.ts); пустые места занимают соседи —
// придуманные сервером магазины, у которых счёт растёт с неделей (из зерна лиги, без базы).
//
// Очки — выручка недели по счёту сервера (stats.ts уже режет невозможный прирост за минуту), и
// каждый настоящий день — не больше потолка по помещению (src/game/social.ts → dayCap). Помещение
// для потолка — то, с которым вступил в лигу, плюс одно (переехал посреди недели). По выходным
// очки дня ×WEEKEND_BONUS (бывшая «Чёрная пятница района»).
// Итог недели считается один раз и запоминается (league_results); награду выдаёт игра.

import { bandOf, dayCap, LEAGUE_SIZE, leagueScore, nextTier, WEEKEND_BONUS, type LeagueRow } from '../../src/game/social.js';
import { daysLeft, isWeekend, weekOf } from './week.js';
import { farewell } from './farewell.js';
import { ready } from './social.js';
import { json, verifyInitData, type D1, type Env } from './telegram.js';

const DAY = 24 * 3600_000;
const today = (now: number): number => Math.floor(now / DAY);
/** Начало недели (мс): понедельник, 00:00 UTC. */
const weekStart = (week: number): number => (week * 7 - 3) * DAY;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS leagues (id INTEGER PRIMARY KEY AUTOINCREMENT, week INTEGER, tier INTEGER, band INTEGER, seed INTEGER)',
  'CREATE INDEX IF NOT EXISTS leagues_week ON leagues (week, tier, band)',
  'CREATE TABLE IF NOT EXISTS league_members (week INTEGER, id INTEGER, league INTEGER, tier INTEGER, level INTEGER, joined INTEGER, PRIMARY KEY (week, id))',
  'CREATE INDEX IF NOT EXISTS league_members_league ON league_members (league)',
  // Выручка (счёт сервера) на начало каждого дня, когда игрок играл, — для потолка по дням.
  'CREATE TABLE IF NOT EXISTS league_days (week INTEGER, id INTEGER, day INTEGER, start INTEGER, PRIMARY KEY (week, id, day))',
  'CREATE TABLE IF NOT EXISTS league_results (week INTEGER, id INTEGER, place INTEGER, size INTEGER, tier INTEGER, next INTEGER, score INTEGER, PRIMARY KEY (week, id))',
];

const schemaReady = new WeakSet<D1>();
export async function leagueReady(db: D1): Promise<void> {
  await ready(db);
  if (schemaReady.has(db)) return;
  // Таблицы уже есть (база живёт дольше воркера) — не тратить запросы: у D1 предел на один вызов.
  const known = await db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('leagues', 'league_members', 'league_days', 'league_results')")
    .first<{ n: number }>();
  if ((known?.n ?? 0) < 4) for (const sql of SCHEMA) await db.prepare(sql).run();
  schemaReady.add(db);
}

// ——— Соседи ———

/** Имена соседей (русское и английское — одно лицо для всех зрителей). */
export const NEIGHBOR_NAMES: [string, string][] = [
  ['Тётя Галя', 'Aunt Galya'], ['Дядя Миша', 'Uncle Misha'], ['Марина', 'Marina'], ['Ашот', 'Ashot'], ['Лавка Зины', "Zina's Shop"],
  ['Серёга', 'Seryoga'], ['Оксана', 'Oksana'], ['Тимофей', 'Timofey'], ['Баба Нюра', 'Granny Nyura'], ['Ринат', 'Rinat'],
  ['Света', 'Sveta'], ['Гена', 'Gena'], ['Вера Петровна', 'Vera Petrovna'], ['Ильдар', 'Ildar'], ['Катюша', 'Katyusha'],
  ['Пётр Ильич', 'Pyotr Ilyich'], ['Наиля', 'Nailya'], ['Жора', 'Zhora'], ['Людмила', 'Lyudmila'], ['Арсений', 'Arseny'],
];
/** Обычная выручка недели магазина в группе (bandOf) — от неё считаются соседи; в старших лигах соседи сильнее. */
export const BAND_WEEK = [9_000, 45_000, 240_000];
const TIER_PACE = [0.8, 1, 1.25];

/** Детерминированное «случайное» 0…1 из зерна и номера. */
export function rand(seed: number, n: number): number {
  let x = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(n + 1, 0xc2b2ae35)) | 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

/**
 * Соседи тоже торгуют по выходным с бонусом (решено автором 01.11), иначе живые игроки каждые выходные
 * их обгоняют. Неделя — с понедельника: первые 5/7 недели ×1, суббота и воскресенье — ×WEEKEND_BONUS.
 * Множитель к счёту за долю недели f: (будни + выходные × бонус) / f; к концу недели — 8/7.
 */
export function weekendBoost(f: number): number {
  const days = Math.max(0, Math.min(1, f)) * 7;
  if (days <= 5) return 1;
  return (5 + (days - 5) * WEEKEND_BONUS) / days;
}

/**
 * Соседи лиги: count мест, счёт растёт с долей недели frac (0…1). Чистая функция: у всех
 * участников лиги одни и те же соседи с одним и тем же счётом.
 */
export function neighbors(seed: number, band: number, tier: number, count: number, frac: number, en = false): LeagueRow[] {
  const used = new Set<number>();
  const out: LeagueRow[] = [];
  const f = Math.max(0, Math.min(1, frac));
  const weekend = weekendBoost(f);
  for (let i = 0; i < count; i++) {
    let n = Math.floor(rand(seed, 100 + i) * NEIGHBOR_NAMES.length);
    while (used.has(n)) n = (n + 1) % NEIGHBOR_NAMES.length;
    used.add(n);
    const target = BAND_WEEK[band] * TIER_PACE[tier] * (0.3 + 1.1 * rand(seed, i));
    // Кто-то торгует ровно, кто-то тянет до выходных.
    const pace = Math.pow(f, 0.8 + 0.5 * rand(seed, 200 + i));
    const level = Math.min(5, band * 2 + (rand(seed, 300 + i) < 0.5 ? 0 : 1));
    out.push({ name: NEIGHBOR_NAMES[n][en ? 1 : 0], score: Math.round((target * pace * weekend) / 10) * 10, level });
  }
  return out;
}

// ——— Лига ———

interface Member {
  id: number;
  league: number;
  tier: number;
  level: number;
}

/**
 * Итог последней сыгранной недели до этой (не обязательно прошлой: игрок мог неделю не заходить) —
 * от него ступень лиги и награда, которую ещё не забрали.
 */
export async function lastResult(db: D1, id: number, week: number): Promise<(LeagueResultRow & { week: number }) | null> {
  const played = await db.prepare('SELECT MAX(week) AS w FROM league_members WHERE id = ? AND week < ?').bind(id, week).first<{ w: number | null }>();
  if (!played?.w) return null;
  const result = await finalize(db, id, played.w);
  return result ? { week: played.w, ...result } : null;
}

/**
 * Записать игрока в лигу недели (если ещё не записан): лига своей ступени и группы со свободным
 * местом или новая. tier — ступень, если уже известна (иначе — по итогу последней недели).
 */
export async function joinLeague(db: D1, id: number, level: number, now: number, tier?: number): Promise<Member> {
  const week = weekOf(now);
  const known = await db.prepare('SELECT id, league, tier, level FROM league_members WHERE week = ? AND id = ?').bind(week, id).first<Member>();
  if (known) return known;
  const t = tier ?? (await lastResult(db, id, week))?.next ?? 0;
  const band = bandOf(level);
  let league = await db
    .prepare('SELECT l.id AS id FROM leagues l WHERE l.week = ?1 AND l.tier = ?2 AND l.band = ?3 AND (SELECT COUNT(*) FROM league_members m WHERE m.league = l.id) < ?4 ORDER BY l.id LIMIT 1')
    .bind(week, t, band, LEAGUE_SIZE)
    .first<{ id: number }>();
  if (!league) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    league = await db.prepare('INSERT INTO leagues (week, tier, band, seed) VALUES (?, ?, ?, ?) RETURNING id').bind(week, t, band, seed).first<{ id: number }>();
  }
  // Два запроса разом: запишется один, второй вернёт уже записанную лигу.
  const row = await db
    .prepare('INSERT INTO league_members (week, id, league, tier, level, joined) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(week, id) DO UPDATE SET joined = league_members.joined RETURNING id, league, tier, level')
    .bind(week, id, league!.id, t, level, now)
    .first<Member>();
  return row!;
}

/**
 * Отчёт игры (progress() в stats.ts): выручка на начало дня — до этого отчёта — и запись в лигу
 * при первом отчёте недели.
 */
export async function markLeague(db: D1, id: number, level: number, before: number, now: number): Promise<void> {
  await leagueReady(db);
  await db.prepare('INSERT OR IGNORE INTO league_days (week, id, day, start) VALUES (?, ?, ?, ?)').bind(weekOf(now), id, today(now), before).run();
  await joinLeague(db, id, level, now);
}

/**
 * Таблица лиги: участники (очки по дням с потолком) и соседи на свободных местах, по убыванию.
 * frac — доля недели для соседей (1 — неделя кончилась).
 */
async function standings(db: D1, league: number, viewer: number, frac: number, en: boolean): Promise<{ rows: (LeagueRow & { id?: number })[]; tier: number }> {
  const info = await db.prepare('SELECT week, tier, band, seed FROM leagues WHERE id = ?').bind(league).first<{ week: number; tier: number; band: number; seed: number }>();
  if (!info) return { rows: [], tier: 0 };
  const members = (
    await db
      .prepare(
        `SELECT m.id AS id, m.level AS joinLevel, COALESCE(p.level, m.level) AS level, COALESCE(p.name, '—') AS name,
                COALESCE((SELECT revenue FROM week_start w WHERE w.id = m.id AND w.week = ?2), p.revenue, 0) AS endRevenue
         FROM league_members m LEFT JOIN progress p ON p.id = m.id WHERE m.league = ?1 ORDER BY m.joined LIMIT ${LEAGUE_SIZE * 2}`,
      )
      .bind(league, info.week + 1)
      .all<{ id: number; joinLevel: number; level: number; name: string; endRevenue: number }>()
  ).results;
  const days = (
    await db
      .prepare('SELECT id, day, start FROM league_days WHERE week = ? AND id IN (SELECT id FROM league_members WHERE league = ?)')
      .bind(info.week, league)
      .all<{ id: number; day: number; start: number }>()
  ).results;
  const rows: (LeagueRow & { id?: number })[] = members.map((m) => {
    // Потолок — по помещению, с которым вступил, плюс одно (переехал посреди недели).
    const level = Math.min(Math.max(m.joinLevel, m.level), m.joinLevel + 1);
    const score = leagueScore(days.filter((d) => d.id === m.id), m.endRevenue, level);
    return { id: m.id, name: m.name || '—', score, level: Math.min(m.level, 5), ...(m.id === viewer ? { me: true } : {}) };
  });
  rows.push(...neighbors(info.seed, info.band, info.tier, Math.max(0, LEAGUE_SIZE - rows.length), frac, en));
  // При равенстве выше тот, кто живой.
  rows.sort((a, b) => b.score - a.score || Number(b.id !== undefined) - Number(a.id !== undefined));
  return { rows, tier: info.tier };
}

/** Место в таблице: 1 + сколько набрали строго больше. */
const placeOf = (rows: LeagueRow[], score: number): number => rows.filter((r) => r.score > score).length + 1;

type LeagueResultRow = { place: number; size: number; tier: number; next: number; score: number };

/** Итог недели игрока: считается один раз (неделя кончилась) и запоминается. */
export async function finalize(db: D1, id: number, week: number): Promise<LeagueResultRow | null> {
  const saved = await db.prepare('SELECT place, size, tier, next, score FROM league_results WHERE week = ? AND id = ?').bind(week, id).first<LeagueResultRow>();
  if (saved) return saved;
  const member = await db.prepare('SELECT league FROM league_members WHERE week = ? AND id = ?').bind(week, id).first<{ league: number }>();
  if (!member) return null;
  const { rows, tier } = await standings(db, member.league, id, 1, false);
  const me = rows.find((r) => r.me);
  if (!me) return null;
  const place = placeOf(rows, me.score);
  const result = { place, size: rows.length, tier, next: nextTier(tier, place, rows.length, me.score), score: me.score };
  await db
    .prepare('INSERT OR IGNORE INTO league_results (week, id, place, size, tier, next, score) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(week, id, result.place, result.size, result.tier, result.next, result.score)
    .run();
  return result;
}

/**
 * POST /api/league { initData } → { enabled, week, daysLeft, weekend, tier?, rows?: [{ name, score, level, me? }], place?, last?, farewell? }:
 * лига этой недели (игрок записывается, если уже играл), итог последней сыгранной — last: { week, place, size, tier, next, score },
 * идут ли выходные (бонус очков) и прощальный расчёт за дуэль, гильдию и выходные (farewell.ts).
 */
export async function league(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await leagueReady(db);
  const week = weekOf(now);
  const en = !(user.language_code ?? 'ru').startsWith('ru');
  const last = (await lastResult(db, user.id, week)) ?? undefined;
  const bye = await farewell(db, user.id, now);
  const weekend = isWeekend(now);
  // В лигу — только тот, кто уже играл (есть прогресс); иначе запишет первый отчёт.
  const progress = await db.prepare('SELECT level FROM progress WHERE id = ?').bind(user.id).first<{ level: number }>();
  if (!progress) return json({ enabled: true, week, daysLeft: daysLeft(now), weekend, last, farewell: bye });
  const member = await joinLeague(db, user.id, progress.level, now, last?.next ?? 0);
  const frac = (now - weekStart(week)) / (7 * DAY);
  const { rows, tier } = await standings(db, member.league, user.id, frac, en);
  const me = rows.find((r) => r.me);
  return json({
    enabled: true,
    week,
    daysLeft: daysLeft(now),
    weekend,
    tier,
    // Номера Telegram клиенту не отдаём.
    rows: rows.map(({ id: _id, ...r }) => r),
    place: me ? placeOf(rows, me.score) : null,
    cap: dayCap(progress.level),
    last,
    farewell: bye,
  });
}
