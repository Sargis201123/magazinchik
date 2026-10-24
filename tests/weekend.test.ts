import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { socialPing } from '../api/_lib/social';
import { progress } from '../api/_lib/stats';
import { markWeekend, weekend, isWeekend } from '../api/_lib/weekend';
import type { D1, D1Statement, Env } from '../api/_lib/telegram';

// Настоящая SQLite из Node (22.5+) вместо Cloudflare D1: те же запросы, та же логика.
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
async function initData(id: number): Promise<string> {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Тест' }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const post = async (id: number, extra: Record<string, unknown> = {}) =>
  new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), lang: 'ru', ...extra }) });

/** Бот Telegram понарошку: запоминает, кому писали; заблокировавшим — ошибка. */
let sent: number[] = [];
let blocked = new Set<number>();
beforeEach(() => {
  sent = [];
  blocked = new Set();
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { chat_id?: number };
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } }));
    if (body.chat_id && blocked.has(body.chat_id)) return new Response(JSON.stringify({ ok: false, description: 'Forbidden: bot was blocked by the user' }));
    sent.push(body.chat_id ?? 0);
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const DAY = 24 * 3600_000;
const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;
// Суббота 24 октября 2026, полдень UTC, и следующий понедельник.
const SAT = Date.UTC(2026, 9, 24, 12);
const MON = SAT + 2 * DAY;

describe.skipIf(!Database)('«Чёрная пятница района» (сервер)', () => {
  it('выходные — суббота и воскресенье', () => {
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(SAT + DAY)).toBe(true);
    expect(isWeekend(MON)).toBe(false);
  });

  it('выручка за выходные, общий счётчик, место и итог в понедельник', async () => {
    // Сервер сам отмечает выходные по текущим часам: в настоящую субботу первая отметка с выручкой 0
    // сбила бы подсчёт. Часы теста — на среде перед этими выходными.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(SAT - 3 * DAY);
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    for (const id of [1, 2, 3]) await socialPing(await post(id), env);
    const db = env.DB!;
    await progress(await post(1, { revenue: 0 }), env);
    await progress(await post(2, { revenue: 0 }), env);
    await progress(await post(3, { revenue: 0 }), env);
    await markWeekend(db, 1, 10000, 10000, SAT);
    await markWeekend(db, 2, 5000, 5000, SAT);
    await markWeekend(db, 1, 18000, 18000, SAT + DAY);
    await markWeekend(db, 2, 11000, 11000, SAT + DAY);
    await markWeekend(db, 1, 99999, 99999, MON); // в будни не считается
    type W = { active: boolean; total: number; players: number; me: { revenue: number; rank: number }; top: { revenue: number; me?: boolean }[]; last?: { rank: number; revenue: number; players: number } };
    const live = await json<W>(weekend(await post(2), env, SAT + DAY));
    expect(live).toMatchObject({ active: true, total: 14000, players: 2, me: { revenue: 6000, rank: 2 } });
    expect(live.top.map((r) => r.revenue)).toEqual([8000, 6000]);
    expect(live.top[1].me).toBe(true);
    const after = await json<W>(weekend(await post(1), env, MON));
    expect(after.active).toBe(false);
    expect(after.last).toMatchObject({ rank: 1, revenue: 8000, players: 2 });
    expect((await json<W>(weekend(await post(3), env, MON))).last).toBeUndefined();
  });
});

describe('выходные в игре', async () => {
  const { ensureRush, rushGuests, rushPrize } = await import('../src/game/rush');
  const { newGame } = await import('../src/game/economy');
  const { guestFactor } = await import('../src/game/day');
  it('в выходные гостей на четверть больше; приз по месту', () => {
    const sat = ensureRush(newGame(), SAT);
    const mon = ensureRush(sat, MON);
    expect(rushGuests(sat)).toBe(1.25);
    expect(guestFactor(sat) / guestFactor(mon)).toBeCloseTo(1.25);
    expect(rushPrize(2, 5, 1000)).toBe(2700);
    expect(rushPrize(2, 50, 1000)).toBe(1800);
    expect(rushPrize(2, 90, 1000)).toBe(1800);
    expect(rushPrize(2, 500, 1000)).toBe(900);
  });
});
