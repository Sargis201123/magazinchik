import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialPing } from '../api/_lib/social';
import { progress } from '../api/_lib/stats';
import { GET_DAY, GIVE_DAY, presents } from '../api/_lib/presents';
import { league, neighbors } from '../api/_lib/league';
import { markWeek, weekOf } from '../api/_lib/week';
import { FAREWELL_UNTIL, gone } from '../api/_lib/farewell';
import worker from '../worker/index';
import { dayCap, LEAGUE_SIZE } from '../src/game/social';
import type { D1, D1Statement, Env } from '../api/_lib/telegram';

// Подарки друзьям и турнир района на сервере: настоящая SQLite из Node (22.5+) вместо D1.
type Sqlite = { prepare(sql: string): { run(...v: unknown[]): { changes: number }; get(...v: unknown[]): unknown; all(...v: unknown[]): unknown[] } };
let Database: (new (path: string) => Sqlite) | null = null;
try {
  Database = ((await import(/* @vite-ignore */ ['node', 'sqlite'].join(':'))) as { DatabaseSync: new (path: string) => Sqlite }).DatabaseSync;
} catch {
  Database = null;
}

function d1(): D1 {
  const db = new Database!(':memory:');
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...next) => statement(sql, next),
    run: async () => ({ meta: { changes: db.prepare(sql).run(...values).changes } }),
    first: async <T>() => (db.prepare(sql).get(...values) as T) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...values) as T[] }),
  });
  return { prepare: (sql) => statement(sql), exec: async () => undefined };
}

const TOKEN = '123456:TEST-token';
const enc = new TextEncoder();
const hmac = async (key: BufferSource, data: string) =>
  crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
async function initData(id: number, name = `Игрок${id}`): Promise<string> {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: name }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const post = async (id: number, extra: Record<string, unknown> = {}) =>
  new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), lang: 'ru', ...extra }) });
const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;

const DAY = 24 * 3600_000;
/** Среда, 12:00 UTC (днём по Москве — бот может писать). */
const WED = Date.UTC(2026, 10, 4, 12);

let sent: { chat_id: number; text: string }[] = [];
beforeEach(() => {
  sent = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WED);
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } }));
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Give = { ok: boolean; error?: string };
type List = { enabled: boolean; given: number[]; waiting: number; thanks: number };
type Open = { presents: { name: string; kind: string; phrase: number; stars: number }[]; thanks: string[] };

describe.skipIf(!Database)('подарки друзьям (сервер)', () => {
  it('один подарок в день другу; друг открывает утром; дарителю — «спасибо»; бот пишет раз в день', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://shop.example/' };
    await socialPing(await post(1), env);
    await recordReferral(env, 3, 'ref_1');
    await recordReferral(env, 2, 'ref_1');
    await socialPing(await post(2), env);
    for (const id of [1, 2, 3]) await progress(await post(id, { level: 1, revenue: 10 }), env);
    expect(await json<Give>(presents(await post(1, { action: 'give', to: 2, kind: 'pie', phrase: 3, stars: 5 }), env))).toEqual({ ok: true });
    expect(await json<Give>(presents(await post(1, { action: 'give', to: 2, kind: 'card', phrase: 0 }), env))).toEqual({ ok: false, error: 'already' });
    // Не друг — нельзя; неизвестный подарок или фраза — 400.
    expect(await json<Give>(presents(await post(1, { action: 'give', to: 99, kind: 'pie', phrase: 0 }), env))).toEqual({ ok: false, error: 'friend' });
    expect((await presents(await post(1, { action: 'give', to: 3, kind: 'gold', phrase: 0 }), env)).status).toBe(400);
    expect((await presents(await post(1, { action: 'give', to: 3, kind: 'pie', phrase: 8 }), env)).status).toBe(400);
    expect((await presents(await post(1, { action: 'give', to: 3, kind: 'pie', phrase: 0, stars: 6 }), env)).status).toBe(400);
    // Бот написал другу один раз; игроку 3 (не открывал игру — языка нет) не пишем.
    expect(await json<Give>(presents(await post(3, { action: 'give', to: 1, kind: 'flowers', phrase: 1 }), env))).toEqual({ ok: true });
    expect(sent.map((m) => m.chat_id)).toEqual([2, 1]);
    expect(sent[0].text).toContain('Игрок1');
    expect(JSON.stringify(sent)).not.toContain(TOKEN);
    expect((await json<List>(presents(await post(1, { action: 'list' }), env))).given).toEqual([2]);
    expect(await json<List>(presents(await post(2, { action: 'list' }), env))).toMatchObject({ waiting: 1, thanks: 0 });
    expect(await json<Open>(presents(await post(2, { action: 'open' }), env))).toEqual({ presents: [{ name: 'Игрок1', kind: 'pie', phrase: 3, stars: 5 }], thanks: [], coins: 0, from: [] });
    expect((await json<Open>(presents(await post(2, { action: 'open' }), env))).presents).toEqual([]);
    expect(await json<List>(presents(await post(1, { action: 'list' }), env))).toMatchObject({ waiting: 1, thanks: 1 });
    expect(await json<Open>(presents(await post(1, { action: 'open' }), env))).toEqual({ presents: [{ name: 'Игрок3', kind: 'flowers', phrase: 1, stars: 0 }], thanks: ['Игрок2'], coins: 0, from: [] });
    // Назавтра — снова можно.
    vi.setSystemTime(WED + DAY);
    expect(await json<Give>(presents(await post(1, { action: 'give', to: 2, kind: 'card', phrase: 0 }), env))).toEqual({ ok: true });
  });

  it('лимиты в день: дарителю и получателю; чужая подпись — 401; без базы — выключено', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const many = GET_DAY + 5;
    for (let id = 1; id <= many; id++) {
      if (id > 1) await recordReferral(env, id, 'ref_1');
      await progress(await post(id, { level: 1, revenue: 10 }), env);
    }
    const results: Give[] = [];
    for (let to = 2; to <= GIVE_DAY + 2; to++) results.push(await json<Give>(presents(await post(1, { action: 'give', to, kind: 'pie', phrase: 0 }), env)));
    expect(results.filter((r) => r.ok)).toHaveLength(GIVE_DAY);
    expect(results.at(-1)).toEqual({ ok: false, error: 'limit' });
    // Все приглашённые дарят первому (друзья через пригласившего): больше GET_DAY — «full».
    const got: Give[] = [];
    for (let from = 2; from <= many; from++) got.push(await json<Give>(presents(await post(from, { action: 'give', to: 1, kind: 'pie', phrase: 0 }), env)));
    expect(got.filter((r) => r.ok)).toHaveLength(GET_DAY);
    expect(got.at(-1)).toEqual({ ok: false, error: 'full' });
    expect((await presents(new Request('https://x', { method: 'POST', body: JSON.stringify({ initData: 'user=%7B%22id%22%3A1%7D&hash=00' }) }), env)).status).toBe(401);
    expect(await json(presents(await post(1), { BOT_TOKEN: TOKEN }))).toEqual({ enabled: false });
  });
});

type League = { enabled: boolean; week: number; tier?: number; rows?: { name: string; score: number; level: number; me?: boolean }[]; place?: number; last?: { week: number; place: number; size: number; tier: number; next: number; score: number } };

describe.skipIf(!Database)('турнир района (сервер)', () => {
  it('лига назначается при первом отчёте недели; пустые места — соседи; очки — выручка недели', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    vi.setSystemTime(WED - 2 * DAY); // понедельник
    expect((await json<League>(league(await post(1), env))).rows).toBeUndefined();
    await progress(await post(1, { level: 1, revenue: 0 }), env);
    await progress(await post(2, { level: 0, revenue: 0 }), env);
    await progress(await post(3, { level: 4, revenue: 0 }), env);
    vi.setSystemTime(WED - 2 * DAY + 60_000);
    await progress(await post(1, { level: 1, revenue: 3000 }), env);
    const res = await json<League>(league(await post(1), env));
    expect(res.tier).toBe(0);
    expect(res.rows).toHaveLength(LEAGUE_SIZE);
    // Игрок 2 — того же размера (ларёк и минимаркет) — в той же лиге, игрок 3 (универмаг) — нет.
    expect(res.rows!.filter((r) => !r.name.startsWith('Игрок')).length).toBe(LEAGUE_SIZE - 2);
    expect(res.rows!.find((r) => r.me)).toMatchObject({ name: 'Игрок1', score: 3000 });
    expect(res.place).toBe(res.rows!.filter((r) => r.score > 3000).length + 1);
    // Номера Telegram не уходят клиенту.
    expect(JSON.stringify(res)).not.toMatch(/"id"/);
  });

  it('скачок выручки за день режется потолком; итог недели — один раз, повышение лиги', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const mon = WED - 2 * DAY;
    vi.setSystemTime(mon);
    await progress(await post(1, { level: 0, revenue: 0 }), env);
    // Сервер уже режет прирост за минуту; за сутки игры набирается больше потолка дня.
    for (let i = 1; i <= 30; i++) {
      vi.setSystemTime(mon + i * 60_000 * 10);
      await progress(await post(1, { level: 0, revenue: i * 100_000 }), env);
    }
    const now = await json<League>(league(await post(1), env));
    expect(now.rows!.find((r) => r.me)!.score).toBe(dayCap(0));
    // Следующий день — ещё потолок.
    vi.setSystemTime(mon + DAY + 3600_000);
    await progress(await post(1, { level: 0, revenue: 4_000_000 }), env);
    vi.setSystemTime(mon + DAY + 7200_000);
    await progress(await post(1, { level: 0, revenue: 5_000_000 }), env);
    expect((await json<League>(league(await post(1), env))).rows!.find((r) => r.me)!.score).toBe(2 * dayCap(0));
    // Новая неделя: итог прошлой — первое место (соседи ларьков столько не набирают), повышение.
    vi.setSystemTime(mon + 7 * DAY + 3600_000);
    const next = await json<League>(league(await post(1), env));
    expect(next.last).toMatchObject({ week: weekOf(mon), place: 1, size: LEAGUE_SIZE, tier: 0, next: 1, score: 2 * dayCap(0) });
    expect(next.tier).toBe(1);
    // Повторный запрос — тот же итог (записан).
    expect((await json<League>(league(await post(1), env))).last).toEqual(next.last);
  });

  it('пропустил неделю — лига и награда не теряются', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const mon = WED - 2 * DAY;
    vi.setSystemTime(mon);
    await progress(await post(1, { level: 0, revenue: 0 }), env);
    vi.setSystemTime(mon + 3600_000);
    await progress(await post(1, { level: 0, revenue: 100_000 }), env);
    // Через неделю не заходил; вернулся ещё через одну.
    vi.setSystemTime(mon + 14 * DAY + 3600_000);
    const back = await json<League>(league(await post(1), env));
    expect(back.last).toMatchObject({ week: weekOf(mon), place: 1, next: 1 });
    expect(back.tier).toBe(1);
  });

  it('соседи одинаковы для всех зрителей и растут с неделей', () => {
    const a = neighbors(42, 1, 0, 5, 0.5);
    expect(neighbors(42, 1, 0, 5, 0.5)).toEqual(a);
    expect(new Set(a.map((r) => r.name)).size).toBe(5);
    const later = neighbors(42, 1, 0, 5, 1);
    later.forEach((r, i) => expect(r.score).toBeGreaterThanOrEqual(a[i].score));
    expect(neighbors(42, 1, 0, 5, 1, true)[0].name).toMatch(/^[A-Za-z' ]+$/);
  });
});

describe.skipIf(!Database)('дуэль, гильдия и «Чёрная пятница» закрыты (сервер)', () => {
  it('старые адреса отвечают спокойным «выключено», а не 500', async () => {
    expect(await json(gone())).toEqual({ enabled: false });
    const env = { BOT_TOKEN: TOKEN, DB: d1(), ASSETS: { fetch: async () => new Response('asset') } };
    for (const path of ['/api/duel', '/api/guild', '/api/weekend']) {
      const res = await worker.fetch(new Request(`https://x${path}`, { method: 'POST', body: JSON.stringify({ initData: await initData(1), action: 'create', name: 'X' }) }), env);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ enabled: false });
    }
  });

  it('прощальный расчёт за прошлую неделю приходит с турниром; выходные — флаг бонуса; после срока — ничего', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    for (const id of [1, 2]) await socialPing(await post(id), env);
    const db = env.DB!;
    const week = weekOf(WED) - 1;
    const mon = (week * 7 - 3) * DAY;
    // Прошлая неделя: 1-й заработал 6000, его соперник по дуэли 2-й — 4000; гильдия выполнила цель; выходные — 3-е место из 30.
    await markWeek(db, 1, 0, mon + 3600_000);
    await markWeek(db, 1, 6000, mon + 7 * DAY + 60_000);
    await markWeek(db, 2, 0, mon + 3600_000);
    await markWeek(db, 2, 4000, mon + 7 * DAY + 60_000);
    await progress(await post(1, { level: 1, revenue: 100 }), env);
    await db.prepare('INSERT INTO duels (id, week, rival) VALUES (1, ?, 2)').bind(week).run();
    await db.prepare("INSERT INTO guilds (id, code, name, owner, created) VALUES (7, 'ABC234', 'Соседи', 1, 0)").run();
    await db.prepare('INSERT INTO guild_members (player, guild, joined) VALUES (1, 7, 0)').run();
    await db.prepare('INSERT INTO guild_results (guild, week, reached) VALUES (7, ?, 1)').bind(week).run();
    for (let i = 0; i < 30; i++) await db.prepare('INSERT INTO weekend (id, week, start, last) VALUES (?, ?, 0, ?)').bind(100 + i, week, i < 2 ? 9000 : 100).run();
    await db.prepare('INSERT INTO weekend (id, week, start, last) VALUES (1, ?, 0, 5000)').bind(week).run();
    type L = { weekend: boolean; farewell?: { duel?: { week: number; won: boolean }; guild?: { week: number; name: string }; rush?: { week: number; rank: number; players: number } } };
    const res = await json<L>(league(await post(1), env));
    expect(res.weekend).toBe(false);
    expect(res.farewell).toEqual({ duel: { week, won: true }, guild: { week, name: 'Соседи' }, rush: { week, rank: 3, players: 31 } });
    // Ничего не было — поля нет; в субботу — бонус выходных.
    vi.setSystemTime(WED + 3 * DAY);
    const other = await json<L>(league(await post(2), env));
    expect(other.weekend).toBe(true);
    expect(other.farewell).toBeUndefined();
    // Срок прошёл — старые таблицы больше не читаем.
    vi.setSystemTime(FAREWELL_UNTIL + DAY);
    expect((await json<L>(league(await post(1), env))).farewell).toBeUndefined();
  });
});

describe('соседи лиги и бонус выходных (решено автором 01.11)', () => {
  it('в будни счёт соседей без бонуса, к концу недели — ×8/7 (суббота и воскресенье ×1,5)', async () => {
    const { weekendBoost } = await import('../api/_lib/league');
    expect(weekendBoost(0.3)).toBe(1);
    expect(weekendBoost(5 / 7)).toBe(1);
    expect(weekendBoost(1)).toBeCloseTo(8 / 7, 6);
    expect(weekendBoost(6 / 7)).toBeCloseTo(6.5 / 6, 6);
  });
  it('выходные поднимают соседей ровно на множитель, а будни не трогают', () => {
    const plain = neighbors(42, 1, 1, 5, 4 / 7);
    const friday = neighbors(42, 1, 1, 5, 5 / 7);
    const sunday = neighbors(42, 1, 1, 5, 1);
    for (let i = 0; i < 5; i++) {
      expect(sunday[i].score).toBeGreaterThan(friday[i].score);
      expect(friday[i].score).toBeGreaterThanOrEqual(plain[i].score);
    }
  });
});
