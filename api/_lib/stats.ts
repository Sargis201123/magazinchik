// Рейтинг магазинов и аналитика. Нужна база D1 (как для приглашений, social.ts); без неё — выключено.
//
// Игра в конце каждого дня шлёт прогресс магазина (день, уровень, рейтинг, выручка за всё время)
// и несколько событий (закончил день, обучение, банкротство…). Из прогресса строится рейтинг:
// весь Telegram и «свои» — кого игрок пригласил, кто пригласил его и кого пригласил тот же друг.
// Сводка для владельца — GET /api/stats?key=WEBHOOK_SECRET: сколько игроков, на каком дне бросают,
// сколько возвращаются на следующий день и через неделю, откуда пришли (рекламные метки src_<канал>)
// и как новички прошли первые минуты в двух вариантах начала (onboarding, docs/ONBOARDING.md).

import { markWeek } from './guild.js';
import { markWeekend } from './weekend.js';
import { markLeague } from './league.js';
import { ready, saveHooks } from './social.js';
import { rivalKey } from './rival.js';
import { GOLD_SUPPORT, json, verifyInitData, type D1, type Env } from './telegram.js';

const DAY = 24 * 3600_000;
/** Сколько событий за раз принимаем и как они называются (с цифрами — onb_day1, onb_day2). */
const MAX_EVENTS = 20;
const KIND_RE = /^[a-z0-9_]{1,24}$/;
/** До какого дня считаем воронку «дошли до дня N». */
export const FUNNEL_DAYS = [1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120];

/**
 * Выручку считает сервер, а не игра: из отчёта берём только прирост с прошлого раза (после
 * «Начать заново» отчёт меньше — прирост ноль, а счёт не падает) и не больше, чем можно
 * заработать за прошедшее время (лучший магазин — около 20 000 за полторы минуты дня).
 */
export const REVENUE_PER_MINUTE = 30000;
/** События из отчётов чаще раза в столько миллисекунд не пишем (защита базы от потока запросов). */
export const MIN_REPORT_GAP = 3000;

const int = (v: unknown, max = 1e12): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);

export interface BoardRow {
  name: string;
  day: number;
  level: number;
  rating: number;
  revenue: number;
  me?: boolean;
  /** Ключ для «Заглянуть к конкуренту» (rival.ts): у своей строки нет. */
  key?: string;
  /** Золотая табличка: поддержал автора (supporters.ts, ступень GOLD_SUPPORT). */
  gold?: true;
}

/** Самый большой снимок магазина (символов), который сохраняем. */
export const SHOP_MAX = 16_000;

/**
 * POST /api/progress { initData, day, level, rating, revenue, money, chapter, tz, hooks, events: [{ kind, day, value }] } → { ok }:
 * прогресс магазина (для рейтинга), события игры (для воронки), часовой пояс и поводы для напоминаний.
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
  // Часовой пояс и поводы для напоминаний бота (remind.ts).
  await saveHooks(db, user.id, body, now);
  const name = (user.first_name ?? '').trim().slice(0, 20) || '—';
  const rating = Math.max(0, Math.min(5, Number(body.rating) || 0));
  const prev = await db
    .prepare('SELECT p.revenue AS revenue, p.updated AS updated, r.raw AS raw FROM progress p LEFT JOIN reported r ON r.id = p.id WHERE p.id = ?')
    .bind(user.id)
    .first<{ revenue: number; updated: number; raw: number | null }>();
  // Слишком частые отчёты: прогресс обновим, а события пусть игра пришлёт в следующий раз.
  const throttled = !!prev && now - prev.updated < MIN_REPORT_GAP;
  const reported = int(body.revenue);
  const before = prev?.revenue ?? 0;
  const minutes = prev ? Math.max(1, (now - prev.updated) / 60000) : 1;
  const gain = Math.max(0, Math.min(reported - (prev ? (prev.raw ?? prev.revenue) : 0), Math.round(REVENUE_PER_MINUTE * minutes)));
  const revenue = before + gain;
  await db
    .prepare(
      `INSERT INTO progress (id, name, day, level, rating, revenue, money, chapter, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, day = excluded.day, level = excluded.level, rating = excluded.rating,
       revenue = excluded.revenue, money = excluded.money, chapter = excluded.chapter, updated = excluded.updated`,
    )
    .bind(user.id, name, int(body.day, 100000), int(body.level, 10), rating, revenue, int(body.money), int(body.chapter, 100), now)
    .run();
  await db.prepare('INSERT OR REPLACE INTO reported (id, raw) VALUES (?, ?)').bind(user.id, reported).run();
  // Снимок магазина для друзей в гостях: только объект и не больше SHOP_MAX символов.
  if (body.shop && typeof body.shop === 'object') {
    const data = JSON.stringify(body.shop);
    if (data.length <= SHOP_MAX) await db.prepare('INSERT OR REPLACE INTO shops (id, data, updated) VALUES (?, ?, ?)').bind(user.id, data, now).run();
  }
  // Начало недели и выходных — по счёту сервера до этого отчёта.
  await markWeek(db, user.id, before, now);
  await markWeekend(db, user.id, before, revenue, now);
  // Турнир района (league.ts): выручка на начало дня и лига недели. Сбой турнира отчёту не мешает.
  await markLeague(db, user.id, int(body.level, 10), before, now).catch((e) => console.error(e));
  if (throttled) return json({ ok: false, error: 'too_often' });
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
  for (const e of events as Record<string, unknown>[]) {
    const kind = String(e?.kind ?? '');
    if (!KIND_RE.test(kind)) continue;
    await db.prepare('INSERT INTO events (id, at, kind, day, value) VALUES (?, ?, ?, ?, ?)').bind(user.id, now, kind, int(e.day, 100000), int(e.value)).run();
  }
  return json({ ok: true });
}

/** Шаги первых минут, которые считаем по каждому варианту начала (события игры). */
export const ONB_STEPS = ['onb_play', 'onb_open', 'onb_hello', 'onb_cust', 'onb_sale', 'onb_bye', 'onb_day1', 'onb_day2', 'tour_done', 'tour_skip', 'tour_replay'];
/** Варианты начала: значение события onb_ab (src/game/onboarding.ts). */
const COHORTS = ['tour', 'play'] as const;
/** Первая продажа «быстрая» — не позже стольких секунд от «Играть» (цель нового начала). */
export const FAST_SALE = 20;

interface CohortStats {
  players: number;
  d1: { base: number; back: number; share: number | null };
  d7: { base: number; back: number; share: number | null };
  reached: { day2: number; day3: number; day7: number };
  steps: Record<string, number>;
  firstSale: { players: number; median: number | null; avg: number | null; fast: number };
  tourSteps: Record<string, number>;
  tabs: Record<string, number>;
}

/**
 * Первые минуты новичков по двум вариантам начала (A/B). Игрок в варианте — по событию onb_ab,
 * которое игра шлёт при новой игре; дальше всё считается только по этим игрокам. Четыре запроса
 * на всю сводку: у D1 есть предел запросов на один вызов.
 */
async function onboardingStats(db: D1, now: number): Promise<Record<(typeof COHORTS)[number], CohortStats>> {
  const cohorts = "WITH c AS (SELECT id, MAX(value) AS cohort FROM events WHERE kind = 'onb_ab' GROUP BY id)";
  const empty = (): CohortStats => ({
    players: 0,
    d1: { base: 0, back: 0, share: null },
    d7: { base: 0, back: 0, share: null },
    reached: { day2: 0, day3: 0, day7: 0 },
    steps: Object.fromEntries(ONB_STEPS.map((k) => [k, 0])),
    firstSale: { players: 0, median: null, avg: null, fast: 0 },
    tourSteps: {},
    tabs: {},
  });
  const out = { tour: empty(), play: empty() };
  // Значение onb_ab — номер варианта; незнакомое (испорченное событие) — мимо сводки.
  const sink = empty();
  const of = (cohort: number) => (COHORTS[cohort] ? out[COHORTS[cohort]] : sink);
  const share = (back: number, base: number) => (base ? Math.round((back / base) * 100) : null);
  type Base = { cohort: number; players: number; d1base: number | null; d1back: number | null; d7base: number | null; d7back: number | null; day2: number | null; day3: number | null; day7: number | null };
  const base = (
    await db
      .prepare(
        `${cohorts} SELECT c.cohort AS cohort, COUNT(*) AS players,
           SUM(CASE WHEN pl.joined < ?1 THEN 1 ELSE 0 END) AS d1base,
           SUM(CASE WHEN pl.joined < ?1 AND pl.last_seen - pl.joined >= ?2 THEN 1 ELSE 0 END) AS d1back,
           SUM(CASE WHEN pl.joined < ?3 THEN 1 ELSE 0 END) AS d7base,
           SUM(CASE WHEN pl.joined < ?3 AND pl.last_seen - pl.joined >= ?4 THEN 1 ELSE 0 END) AS d7back,
           SUM(CASE WHEN p.day >= 2 THEN 1 ELSE 0 END) AS day2, SUM(CASE WHEN p.day >= 3 THEN 1 ELSE 0 END) AS day3,
           SUM(CASE WHEN p.day >= 7 THEN 1 ELSE 0 END) AS day7
         FROM c LEFT JOIN players pl ON pl.id = c.id LEFT JOIN progress p ON p.id = c.id GROUP BY c.cohort`,
      )
      .bind(now - DAY, DAY, now - 7 * DAY, 7 * DAY)
      .all<Base>()
  ).results;
  for (const r of base) {
    const o = of(r.cohort);
    o.players = r.players;
    o.d1 = { base: r.d1base ?? 0, back: r.d1back ?? 0, share: share(r.d1back ?? 0, r.d1base ?? 0) };
    o.d7 = { base: r.d7base ?? 0, back: r.d7back ?? 0, share: share(r.d7back ?? 0, r.d7base ?? 0) };
    o.reached = { day2: r.day2 ?? 0, day3: r.day3 ?? 0, day7: r.day7 ?? 0 };
  }
  // Сколько игроков дошли до каждого шага (каждый считается один раз).
  const list = ONB_STEPS.map((k) => `'${k}'`).join(', ');
  const steps = (
    await db
      .prepare(`${cohorts} SELECT c.cohort AS cohort, e.kind AS kind, COUNT(DISTINCT e.id) AS n FROM events e JOIN c ON c.id = e.id WHERE e.kind IN (${list}) GROUP BY c.cohort, e.kind`)
      .all<{ cohort: number; kind: string; n: number }>()
  ).results;
  for (const r of steps) of(r.cohort).steps[r.kind] = r.n;
  // Шаги обхода вкладок (1…11) и открытые вкладки утра (0 — «Закупка», 1 — «Зал», 2 — «Персонал», 3 — «Развитие», 4 — «Уголки»).
  const numbered = (
    await db
      .prepare(`${cohorts} SELECT c.cohort AS cohort, e.kind AS kind, e.value AS value, COUNT(DISTINCT e.id) AS n FROM events e JOIN c ON c.id = e.id WHERE e.kind IN ('tour_step', 'onb_tab') GROUP BY c.cohort, e.kind, e.value`)
      .all<{ cohort: number; kind: string; value: number; n: number }>()
  ).results;
  for (const r of numbered) (r.kind === 'tour_step' ? of(r.cohort).tourSteps : of(r.cohort).tabs)[String(r.value)] = r.n;
  // Секунды от «Играть» до первой продажи: у каждого игрока — самая первая.
  const sales = (
    await db
      .prepare(`${cohorts} SELECT c.cohort AS cohort, MIN(e.value) AS v FROM events e JOIN c ON c.id = e.id WHERE e.kind = 'onb_sale' GROUP BY e.id`)
      .all<{ cohort: number; v: number }>()
  ).results;
  for (const [i] of COHORTS.entries()) {
    const times = sales.filter((r) => r.cohort === i).map((r) => r.v).sort((a, b) => a - b);
    if (!times.length) continue;
    const mid = times.length >> 1;
    of(i).firstSale = {
      players: times.length,
      median: times.length % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2),
      avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      fast: times.filter((v) => v <= FAST_SALE).length,
    };
  }
  return out;
}

const ROW = `SELECT id, name, day, level, rating, revenue, EXISTS (SELECT 1 FROM supporters s WHERE s.id = progress.id AND s.stars >= ${GOLD_SUPPORT}) AS gold FROM progress`;
type Row = Omit<BoardRow, 'gold'> & { id: number; gold?: number | boolean };
const strip = (rows: Row[], me: number): BoardRow[] =>
  rows.map(({ id, name, day, level, rating, revenue, gold }) => ({ name, day, level, rating: Math.round(rating * 10) / 10, revenue, ...(id === me ? { me: true } : {}), ...(gold ? { gold: true as const } : {}) }));

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
  // Ключи для «Заглянуть к конкуренту»: номера Telegram клиенту не отдаём.
  const keyed = async (rows: Row[]): Promise<BoardRow[]> => {
    const out = strip(rows, user.id);
    for (const [i, r] of rows.entries()) if (r.id !== user.id) out[i].key = await rivalKey(user.id, r.id, token);
    return out;
  };
  return json({ enabled: true, top: await keyed(top), friends: await keyed(friends), rank, total });
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
  // Рекламные каналы: сколько пришло и сколько из них дошли до 3-го и 7-го дня; без метки — «organic».
  const tagged = (
    await db
      .prepare(
        'SELECT s.source AS source, COUNT(*) AS players, SUM(CASE WHEN p.day >= 3 THEN 1 ELSE 0 END) AS day3, SUM(CASE WHEN p.day >= 7 THEN 1 ELSE 0 END) AS day7 FROM sources s JOIN players pl ON pl.id = s.id LEFT JOIN progress p ON p.id = s.id GROUP BY s.source ORDER BY players DESC, source',
      )
      .all<{ source: string; players: number; day3: number | null; day7: number | null }>()
  ).results.map((r) => ({ ...r, day3: r.day3 ?? 0, day7: r.day7 ?? 0 }));
  const organic = players - tagged.reduce((sum, r) => sum + r.players, 0);
  const sources = [...tagged, { source: 'organic', players: Math.max(0, organic), day3: null, day7: null }];
  // Плавность у игроков за неделю: последний замер FPS каждого (медиана его дня) — по корзинам.
  const fps = (
    await db
      .prepare(
        `SELECT CASE WHEN value >= 55 THEN '55+' WHEN value >= 45 THEN '45-54' WHEN value >= 30 THEN '30-44' ELSE '<30' END AS bucket, COUNT(*) AS players
         FROM (SELECT id, value FROM events e WHERE kind = 'fps' AND at > ? AND rowid = (SELECT MAX(rowid) FROM events WHERE id = e.id AND kind = 'fps'))
         GROUP BY bucket ORDER BY MIN(value) DESC`,
      )
      .bind(now - 7 * DAY)
      .all<{ bucket: string; players: number }>()
  ).results;
  // Два варианта начала новичка (A/B): как их читать — docs/ONBOARDING.md.
  const onboarding = await onboardingStats(db, now);
  return json({ players, active, retention: { d1: await retention(1), d7: await retention(7) }, funnel, levels, sources, fps, eventsWeek: events, onboarding });
}
