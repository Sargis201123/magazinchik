import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialPing } from '../api/_lib/social';
import { progress } from '../api/_lib/stats';
import { duel, guild, markWeek, recordGuildInvite, weekOf, GUILD_MIN } from '../api/_lib/guild';
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

const DAY = 24 * 3600_000;
const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;

describe.skipIf(!Database)('торговая неделя и гильдии (сервер)', () => {
  it('соперник — друг по приглашениям; кто больше заработал за неделю', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const now = Date.now();
    const week = weekOf(now);
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    // Начало прошлой недели и этой: у 1-го за прошлую неделю +5000, у 2-го +3000.
    await progress(await post(1, { revenue: 10000 }), env);
    await progress(await post(2, { revenue: 9000 }), env);
    const db = env.DB!;
    await db.prepare('DELETE FROM week_start').run();
    await markWeek(db, 1, 10000, now - 7 * DAY);
    await markWeek(db, 2, 9000, now - 7 * DAY);
    await markWeek(db, 1, 15000, now);
    await markWeek(db, 2, 12000, now);
    await db.prepare('INSERT INTO duels (id, week, rival) VALUES (1, ?, 2)').bind(week - 1).run();
    await progress(await post(1, { revenue: 16000 }), env);
    const d = await json<{ rival: { name: string; mine: number; theirs: number }; last: { won: boolean; mine: number; theirs: number } }>(duel(await post(1), env, now));
    expect(d.rival).toMatchObject({ mine: 1000, theirs: 0 });
    expect(d.last).toMatchObject({ won: true, mine: 5000, theirs: 3000 });
    // Без друзей — соперника нет.
    const lonely = await json<{ rival?: unknown }>(duel(await post(9), env, now));
    expect(lonely.rival).toBeUndefined();
  });

  it('гильдия: создать, вступить по коду и по ссылке, общая цель недели', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    type G = { guild?: { code: string; name: string; owner: boolean; members: { name: string; me?: boolean }[]; target: number; total: number }; error?: string };
    const made = await json<G>(guild(await post(1, { action: 'create', name: 'Торговцы' }), env));
    expect(made.guild).toMatchObject({ name: 'Торговцы', owner: true, target: GUILD_MIN });
    const code = made.guild!.code;
    expect(await json<G>(guild(await post(2, { action: 'join', code: 'NOPE00' }), env))).toMatchObject({ error: 'code' });
    const joined = await json<G>(guild(await post(2, { action: 'join', code: code.toLowerCase() }), env));
    expect(joined.guild!.members).toHaveLength(2);
    await recordGuildInvite(env, 3, `guild_${code}`);
    const byLink = await json<G>(guild(await post(3, { action: 'status' }), env));
    expect(byLink.guild!.members).toHaveLength(3);
    // Цель недели зафиксирована при первом запросе — не растёт от новых участников.
    expect(byLink.guild!.target).toBe(GUILD_MIN);
    const left = await json<G>(guild(await post(3, { action: 'leave' }), env));
    expect(left.guild).toBeUndefined();
  });
});
