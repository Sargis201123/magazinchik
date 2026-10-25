import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialPing } from '../api/_lib/social';
import { leaderboard, progress } from '../api/_lib/stats';
import { ACTOR_DAY, MIN_GAP, PAIR_DAY, rival, rivalKey } from '../api/_lib/rival';
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

beforeEach(() => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } })));
});
afterEach(() => vi.unstubAllGlobals());

const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;
type Act = { ok: boolean; left?: number; error?: string };
type Inbox = { pranks: { key: string; name: string; spill: number; trash: number; lure: number }[]; thanks: string[] };

/** Пять игроков в рейтинге, у двоих есть снимок магазина. */
async function world(): Promise<Env> {
  const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
  const shop = { level: 1, day: 12, rating: 4, shelves: [{ kind: 'bakery', level: 1, items: { bread: 3 } }] };
  for (const id of [1, 2, 3, 4, 5]) await progress(await post(id, { level: 1, revenue: 100 * id, shop }), env);
  return env;
}

describe.skipIf(!Database)('заглянуть к конкуренту (сервер)', () => {
  it('ключи в рейтинге: свои — без ключа, чужие — не номер и у каждого зрителя свой', async () => {
    const env = await world();
    type B = { top: { key?: string; me?: boolean }[] };
    const a = await json<B>(leaderboard(await post(1), env));
    const b = await json<B>(leaderboard(await post(2), env));
    expect(a.top.find((r) => r.me)?.key).toBeUndefined();
    const keysA = a.top.filter((r) => !r.me).map((r) => r.key);
    expect(keysA.every((k) => /^[0-9a-f]{16}$/.test(k ?? ''))).toBe(true);
    expect(keysA).toContain(await rivalKey(1, 3, TOKEN));
    expect(b.top.map((r) => r.key)).not.toContain(await rivalKey(1, 3, TOKEN));
    // Чужой ключ (выданный другому зрителю) и выдуманный не открывают магазин.
    expect((await json<{ shop: unknown }>(rival(await post(2, { action: 'shop', key: await rivalKey(1, 3, TOKEN) }), env))).shop).toBeNull();
    expect((await json<{ shop: unknown }>(rival(await post(2, { action: 'shop', key: '../../etc' }), env))).shop).toBeNull();
    const shop = await json<{ shop: { day: number }; name: string; left: number }>(rival(await post(1, { action: 'shop', key: await rivalKey(1, 3, TOKEN) }), env));
    expect(shop.shop.day).toBe(12);
    expect(shop.left).toBe(PAIR_DAY);
    // Себя не навестить.
    expect((await json<{ shop: unknown }>(rival(await post(1, { action: 'shop', key: await rivalKey(1, 1, TOKEN) }), env))).shop).toBeNull();
  });

  it('лимиты: не чаще раза в MIN_GAP, PAIR_DAY одному и ACTOR_DAY всем за день', async () => {
    const env = await world();
    let now = Date.UTC(2026, 9, 25, 10);
    const act = async (to: number, kind = 'spill') => json<Act>(rival(await post(1, { action: 'act', key: await rivalKey(1, to, TOKEN), kind }), env, (now += MIN_GAP + 1)));
    expect(await act(2)).toEqual({ ok: true, left: 1 });
    // Сразу второе касание — слишком часто.
    expect(await json<Act>(rival(await post(1, { action: 'act', key: await rivalKey(1, 2, TOKEN), kind: 'trash' }), env, now + 10))).toEqual({ ok: false, error: 'too_often' });
    expect(await act(2, 'trash')).toEqual({ ok: true, left: 0 });
    expect((await act(2, 'lure')).error).toBe('pair');
    expect((await act(3, 'lure')).ok).toBe(true);
    expect(ACTOR_DAY).toBe(3);
    expect((await act(4)).error).toBe('limit');
    // Неизвестная проделка и чужой ключ.
    expect((await json<Act>(rival(await post(1, { action: 'act', key: await rivalKey(1, 4, TOKEN), kind: 'fire' }), env, (now += 5000)))).error).toBe('bad_kind');
    expect((await json<Act>(rival(await post(1, { action: 'act', key: 'ffffffffffffffff', kind: 'spill' }), env, (now += 5000)))).error).toBe('gone');
    // Назавтра — снова можно.
    now += 24 * 3600_000;
    expect((await act(4)).ok).toBe(true);
  });

  it('у одного хозяина — не больше VICTIM_DAY проделок в день от всех вместе', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const ids = Array.from({ length: 9 }, (_, i) => i + 1);
    // Хозяин 1 — первый в рейтинге: его видят все.
    await progress(await post(1, { level: 1, revenue: 5000 }), env);
    for (const id of ids.slice(1)) await progress(await post(id, { level: 1, revenue: 10 }), env);
    const now = Date.UTC(2026, 9, 25, 10);
    const done = [];
    for (const id of ids.slice(1)) done.push((await json<Act>(rival(await post(id, { action: 'act', key: await rivalKey(id, 1, TOKEN), kind: 'trash' }), env, now))).ok);
    expect(done.filter(Boolean).length).toBe(6);
  });

  it('хозяин видит проделки один раз, может ответить визитом и поблагодарить; спасибо доходит один раз', async () => {
    const env = await world();
    let now = Date.UTC(2026, 9, 25, 10);
    const key = await rivalKey(1, 5, TOKEN);
    await rival(await post(1, { action: 'act', key, kind: 'spill' }), env, (now += 2000));
    await rival(await post(1, { action: 'act', key, kind: 'lure' }), env, (now += 2000));
    // Поблагодарить того, кто не заходил, — нельзя.
    expect((await json<{ ok: boolean }>(rival(await post(5, { action: 'thank', key: await rivalKey(5, 2, TOKEN) }), env, now))).ok).toBe(false);
    const inbox = await json<Inbox>(rival(await post(5, { action: 'inbox' }), env, now));
    expect(inbox.pranks).toEqual([{ key: await rivalKey(5, 1, TOKEN), name: 'Тест', spill: 1, trash: 0, lure: 1 }]);
    expect((await json<Inbox>(rival(await post(5, { action: 'inbox' }), env, now))).pranks).toEqual([]);
    // Ответный визит: магазин обидчика открывается по ключу из уведомления.
    expect((await json<{ shop: unknown }>(rival(await post(5, { action: 'shop', key: inbox.pranks[0].key }), env, now))).shop).not.toBeNull();
    expect((await json<{ ok: boolean }>(rival(await post(5, { action: 'thank', key: inbox.pranks[0].key }), env, now))).ok).toBe(true);
    expect((await json<{ ok: boolean }>(rival(await post(5, { action: 'thank', key: inbox.pranks[0].key }), env, now))).ok).toBe(false);
    expect((await json<Inbox>(rival(await post(1, { action: 'inbox' }), env, now))).thanks).toEqual(['Тест']);
    expect((await json<Inbox>(rival(await post(1, { action: 'inbox' }), env, now))).thanks).toEqual([]);
  });

  it('друзья по приглашению видны, даже если не в десятке лучших; без подписи — 401', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 99, 'ref_1');
    for (let id = 10; id < 22; id++) await progress(await post(id, { level: 1, revenue: 1000 }), env);
    await progress(await post(99, { level: 1, revenue: 1, shop: { level: 0, day: 2, shelves: [] } }), env);
    await progress(await post(1, { level: 1, revenue: 1 }), env);
    expect((await json<{ shop: unknown }>(rival(await post(1, { action: 'shop', key: await rivalKey(1, 99, TOKEN) }), env))).shop).not.toBeNull();
    const bad = new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: 'user=%7B%22id%22%3A1%7D&hash=00', action: 'inbox' }) });
    expect((await rival(bad, env)).status).toBe(401);
    expect(await json(rival(await post(1, { action: 'inbox' }), { DB: env.DB }))).toEqual({ enabled: false });
  });
});
