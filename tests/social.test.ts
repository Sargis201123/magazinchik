import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialClaim, socialPing } from '../api/_lib/social';
import { MAX_MISSES, sendReminders } from '../api/_lib/remind';
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
const post = async (id: number) => new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), lang: 'ru' }) });

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

describe.skipIf(!Database)('друзья и напоминания (сервер)', () => {
  it('без базы всё выключено', async () => {
    const env: Env = { BOT_TOKEN: TOKEN };
    expect(await (await socialPing(await post(1), env)).json()).toEqual({ enabled: false });
    expect(await (await socialClaim(await post(1), env)).json()).toEqual({ claimed: 0 });
    expect(await sendReminders(env)).toBe(0);
  });

  it('друг по ссылке: награда другу один раз, пригласившему — когда друг начал играть', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    await recordReferral(env, 3, 'ref_1');
    await recordReferral(env, 1, 'ref_2'); // уже играет — не считается
    await recordReferral(env, 4, 'ref_4'); // сам себя — нет
    let me = (await (await socialPing(await post(1), env)).json()) as Record<string, unknown>;
    expect(me).toMatchObject({ enabled: true, bot: 'magazinchik_bot', friends: 0, unclaimed: 0, welcome: false });

    const friend = (await (await socialPing(await post(2), env)).json()) as Record<string, unknown>;
    expect(friend.welcome).toBe(true);
    expect(((await (await socialPing(await post(2), env)).json()) as Record<string, unknown>).welcome).toBe(false);

    me = (await (await socialPing(await post(1), env)).json()) as Record<string, unknown>;
    expect(me).toMatchObject({ friends: 1, unclaimed: 1 });
    expect(await (await socialClaim(await post(1), env)).json()).toEqual({ claimed: 1 });
    expect(await (await socialClaim(await post(1), env)).json()).toEqual({ claimed: 0 });
    // Второй друг пришёл позже — награда за него отдельно.
    await socialPing(await post(3), env);
    expect(await (await socialClaim(await post(1), env)).json()).toEqual({ claimed: 1 });
    // Чужая подпись не проходит.
    const fake = new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: 'user=%7B%22id%22%3A1%7D&hash=00' }) });
    expect((await socialClaim(fake, env)).status).toBe(401);
  });

  it('напоминания: днём, раз в сутки, не больше трёх подряд, заблокировавшим — никогда', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://shop/' };
    await socialPing(await post(10), env);
    await socialPing(await post(11), env);
    blocked.add(11);
    const day = 24 * 3600_000;
    // Ближайший полдень по UTC, до которого прошло больше суток простоя.
    const base = Math.ceil((Date.now() + day) / day) * day + 12 * 3600_000;
    const noon = (n: number) => base + (n - 1) * day;
    expect(await sendReminders(env, base - 10 * 3600_000)).toBe(0); // ночь
    expect(await sendReminders(env, noon(1))).toBe(1);
    expect(sent).toEqual([10]);
    expect(await sendReminders(env, noon(1) + 3600_000)).toBe(0); // уже писали сегодня
    for (let n = 2; n <= MAX_MISSES + 2; n++) await sendReminders(env, noon(n));
    expect(sent).toEqual(Array(MAX_MISSES).fill(10));
    // Вернулся в игру — напоминания снова идут.
    await socialPing(await post(10), env);
    expect(await sendReminders(env, noon(MAX_MISSES + 4))).toBe(1);
  });
});
