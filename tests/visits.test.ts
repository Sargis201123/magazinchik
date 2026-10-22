import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialPing } from '../api/_lib/social';
import { progress } from '../api/_lib/stats';
import { visits, GIFT } from '../api/_lib/visits';
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
afterEach(() => vi.unstubAllGlobals());

const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;

describe.skipIf(!Database)('друзья в гостях (сервер)', () => {
  it('друзья по приглашениям приходят; угостить кофе — раз в день; друг забирает подарок', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    for (const id of [1, 2, 3]) await progress(await post(id, { level: 2, revenue: 100 }), env);
    type L = { friends: { id: number; name: string; treated: boolean }[]; gifts: { name: string; amount: number }[] };
    const mine = await json<L>(visits(await post(1, { action: 'list' }), env));
    expect(mine.friends.map((f) => f.id)).toEqual([2]);
    expect(await json<{ ok: boolean }>(visits(await post(1, { action: 'gift', to: 3 }), env))).toEqual({ ok: false });
    expect(await json<{ ok: boolean }>(visits(await post(1, { action: 'gift', to: 2 }), env))).toEqual({ ok: true });
    expect(await json<{ ok: boolean }>(visits(await post(1, { action: 'gift', to: 2 }), env))).toEqual({ ok: false });
    expect((await json<L>(visits(await post(1, { action: 'list' }), env))).friends[0].treated).toBe(true);
    const friend = await json<L>(visits(await post(2, { action: 'list' }), env));
    expect(friend.gifts).toEqual([{ name: 'Тест', amount: GIFT }]);
    expect(await json<{ amount: number }>(visits(await post(2, { action: 'claim' }), env))).toEqual({ amount: GIFT });
    expect(await json<{ amount: number }>(visits(await post(2, { action: 'claim' }), env))).toEqual({ amount: 0 });
  });

  it('магазин друга: виден только своим, большой снимок не сохраняется', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    const shop = { level: 2, day: 40, rating: 4.2, shelves: [{ kind: 'bakery', level: 1, items: { bread: 5 } }] };
    await progress(await post(2, { level: 2, revenue: 100, shop }), env);
    await progress(await post(3, { level: 2, revenue: 100, shop }), env);
    await progress(await post(1, { level: 2, revenue: 100 }), env);
    type S = { shop: unknown; name?: string };
    expect(await json<S>(visits(await post(1, { action: 'shop', to: 2 }), env))).toEqual({ shop, name: 'Тест' });
    // Не друг — не показываем.
    expect((await json<S>(visits(await post(1, { action: 'shop', to: 3 }), env))).shop).toBeNull();
    // Слишком большой снимок не заменяет прежний (и отчёты не чаще раза в минуту не мешают снимку).
    await progress(await post(2, { level: 2, revenue: 100, shop: { junk: 'x'.repeat(20_000) } }), env);
    expect((await json<S>(visits(await post(1, { action: 'shop', to: 2 }), env))).shop).toEqual(shop);
  });

  it('друг по коду: оба уже играли, связь в обе стороны', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    for (const id of [10, 20]) await progress(await post(id, { level: 1, revenue: 50 }), env);
    type L = { code: string; friends: { id: number }[] };
    const mine = await json<L>(visits(await post(10, { action: 'list' }), env));
    expect(mine.friends).toEqual([]);
    const theirs = await json<L>(visits(await post(20, { action: 'list' }), env));
    type A = { ok: boolean; name?: string; error?: string };
    expect(await json<A>(visits(await post(10, { action: 'add', code: 'нет' }), env))).toEqual({ ok: false, error: 'bad_code' });
    expect(await json<A>(visits(await post(10, { action: 'add', code: mine.code }), env))).toEqual({ ok: false, error: 'bad_code' });
    expect((await json<A>(visits(await post(10, { action: 'add', code: 'ZZZZ' }), env))).error).toBe('not_found');
    expect(await json<A>(visits(await post(10, { action: 'add', code: theirs.code.toLowerCase() }), env))).toEqual({ ok: true, name: 'Тест' });
    expect((await json<L>(visits(await post(10, { action: 'list' }), env))).friends.map((f) => f.id)).toEqual([20]);
    expect((await json<L>(visits(await post(20, { action: 'list' }), env))).friends.map((f) => f.id)).toEqual([10]);
  });
});
