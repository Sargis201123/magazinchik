import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialPing } from '../api/_lib/social';
import { progress } from '../api/_lib/stats';
import { visits, STREET_SIZE } from '../api/_lib/visits';
import { presents } from '../api/_lib/presents';
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
  it('друзья по приглашениям приходят; угостить кофе — раз в день, это подарок-пирог; друг открывает его с подарками', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    for (const id of [1, 2, 3]) await progress(await post(id, { level: 2, revenue: 100 }), env);
    type L = { friends: { id: number; name: string; treated: boolean }[] };
    const mine = await json<L>(visits(await post(1, { action: 'list' }), env));
    expect(mine.friends.map((f) => f.id)).toEqual([2]);
    expect(await json<{ ok: boolean }>(visits(await post(1, { action: 'gift', to: 3 }), env))).toEqual({ ok: false });
    expect(await json<{ ok: boolean }>(visits(await post(1, { action: 'gift', to: 2 }), env))).toEqual({ ok: true });
    expect(await json<{ ok: boolean }>(visits(await post(1, { action: 'gift', to: 2 }), env))).toEqual({ ok: false });
    expect((await json<L>(visits(await post(1, { action: 'list' }), env))).friends[0].treated).toBe(true);
    // Угощение — обычный подарок: в списке подарков «уже подарено», у друга — подарок ждёт.
    expect((await json<{ given: number[] }>(presents(await post(1, { action: 'list' }), env))).given).toEqual([2]);
    expect((await json<{ waiting: number }>(presents(await post(2, { action: 'list' }), env))).waiting).toBe(1);
    const opened = await json<{ presents: { name: string; kind: string }[]; coins: number }>(presents(await post(2, { action: 'open' }), env));
    expect(opened.presents).toMatchObject([{ name: 'Тест', kind: 'pie' }]);
    expect(opened.coins).toBe(0);
    // Подарок другу сегодня уже был — угостить кофе второй раз нельзя (и наоборот).
    expect(await json<{ ok: boolean; error?: string }>(presents(await post(1, { action: 'give', to: 2, kind: 'card', phrase: 1 }), env))).toEqual({ ok: false, error: 'already' });
  });

  it('старые угощения кофе (до 01.11) не теряются: монеты открываются с подарками, старая игра забирает их по-старому', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    for (const id of [1, 2]) await progress(await post(id, { level: 2, revenue: 100 }), env);
    const db = env.DB!;
    await db.prepare('INSERT INTO gifts (sender, receiver, day, amount) VALUES (1, 2, 1, 300), (1, 2, 2, 300)').run();
    expect((await json<{ waiting: number }>(presents(await post(2, { action: 'list' }), env))).waiting).toBe(2);
    const opened = await json<{ coins: number; from: string[] }>(presents(await post(2, { action: 'open' }), env));
    expect(opened).toMatchObject({ coins: 600, from: ['Тест'] });
    expect((await json<{ coins: number }>(presents(await post(2, { action: 'open' }), env))).coins).toBe(0);
    // Старая игра: «забрать» по-старому — то, что ещё не открыто.
    await db.prepare('INSERT INTO gifts (sender, receiver, day, amount) VALUES (1, 2, 3, 300)').run();
    expect(await json<{ amount: number }>(visits(await post(2, { action: 'claim' }), env))).toEqual({ amount: 300 });
    expect((await json<{ coins: number }>(presents(await post(2, { action: 'open' }), env))).coins).toBe(0);
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

  it('улица друзей: только сеть друзей, сначала недавние, не больше STREET_SIZE; название и вывеска из снимка', async () => {
    const db = d1();
    const env: Env = { BOT_TOKEN: TOKEN, DB: db };
    await socialPing(await post(1), env);
    // Восемь приглашённых друзей и один чужой.
    for (let id = 2; id <= 9; id++) await recordReferral(env, id, 'ref_1');
    const shop = { level: 3, day: 77, rating: 4.4, shopName: 'Ромашка', decor: { owned: ['sign_gold'], active: { sign: 'sign_gold' } }, shelves: [] };
    for (let id = 1; id <= 10; id++) await progress(await post(id, { level: 3, day: 77, rating: 4.4, revenue: 100, ...(id === 2 ? { shop } : {}) }), env);
    // Кто когда заходил: 2 — сегодня, 3…9 — по дню раньше каждый; 9 — 10 дней назад (за неделей — не на улице).
    const DAY = 24 * 3600_000;
    const now = Date.now();
    for (let id = 2; id <= 9; id++) await db.prepare('UPDATE progress SET updated = ? WHERE id = ?').bind(now - (id === 9 ? 10 : id - 2) * DAY, id).run();
    await db.prepare('UPDATE progress SET updated = ? WHERE id = 10').bind(now).run();
    type St = { enabled: boolean; friends: { id: number; name: string; level: number; day: number; rating: number; ago: number; shop?: string; sign?: string }[] };
    const res = await json<St>(visits(await post(1, { action: 'street' }), env, now));
    expect(res.enabled).toBe(true);
    expect(res.friends).toHaveLength(STREET_SIZE);
    expect(res.friends.map((f) => f.id)).toEqual([2, 3, 4, 5, 6]);
    expect(res.friends.map((f) => f.ago)).toEqual([0, 1, 2, 3, 4]);
    expect(res.friends[0]).toEqual({ id: 2, name: 'Тест', level: 3, day: 77, rating: 4.4, ago: 0, shop: 'Ромашка', sign: 'sign_gold' });
    // Ни денег, ни выручки, ни точного времени — только то, что видно в гостях, и дни.
    expect(Object.keys(res.friends[1]).sort()).toEqual(['ago', 'day', 'id', 'level', 'name', 'rating']);
    // Чужой (10) не на улице, хоть и играл сегодня.
    expect(res.friends.some((f) => f.id === 10)).toBe(false);
  });

  it('улица друзей: без друзей — пусто; ответ помнится, но новый друг по коду виден сразу; без базы — выключена', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    for (const id of [10, 20]) await progress(await post(id, { level: 1, revenue: 50 }), env);
    type St = { enabled: boolean; friends: { id: number }[] };
    expect(await json<St>(visits(await post(10, { action: 'street' }), env))).toEqual({ enabled: true, friends: [] });
    const theirs = await json<{ code: string }>(visits(await post(20, { action: 'list' }), env));
    await visits(await post(10, { action: 'add', code: theirs.code }), env);
    expect((await json<St>(visits(await post(10, { action: 'street' }), env))).friends.map((f) => f.id)).toEqual([20]);
    expect((await json<St>(visits(await post(20, { action: 'street' }), env))).friends.map((f) => f.id)).toEqual([10]);
    expect(await json<{ enabled: boolean }>(visits(await post(10, { action: 'street' }), { BOT_TOKEN: TOKEN }))).toEqual({ enabled: false });
  });
});
