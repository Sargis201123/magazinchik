import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, socialPing } from '../api/_lib/social';

import { markWeek, weekOf } from '../api/_lib/guild';
import { markWeekend } from '../api/_lib/weekend';
import { paperFor, sendNewspapers } from '../api/_lib/newspaper';
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

/** Бот понарошку: запоминает сообщения; заблокировавшим — ошибка. */
let sent: { chat_id: number; text: string }[] = [];
let blocked = new Set<number>();
beforeEach(() => {
  sent = [];
  blocked = new Set();
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { chat_id: number; text: string };
    if (url.endsWith('/getMe')) return new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } }));
    if (blocked.has(body.chat_id)) return new Response(JSON.stringify({ ok: false, description: 'Forbidden: bot was blocked by the user' }));
    sent.push(body);
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const DAY = 24 * 3600_000;
// Понедельник, 12:00 по UTC (15:00 по Москве).
const MON = Date.UTC(2026, 10, 2, 12);

describe.skipIf(!Database)('газета района', () => {
  it('в понедельник — один номер каждому, кто торговал; с дуэлью, местом среди своих и выходными', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://app/' };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    for (const id of [2, 3]) await socialPing(await post(id), env);
    const db = env.DB!;
    const week = weekOf(MON) - 1;
    // Прошлая неделя: у 1-го +6000 (неделей раньше было +4000), у 2-го +4000, 3-й не торговал.
    await markWeek(db, 1, 0, MON - 14 * DAY);
    await markWeek(db, 1, 4000, MON - 7 * DAY);
    await markWeek(db, 1, 10000, MON);
    await markWeek(db, 2, 0, MON - 7 * DAY);
    await markWeek(db, 2, 4000, MON);
    await db.prepare("INSERT INTO progress (id, name, revenue, updated) VALUES (1, 'Аня', 10000, 0), (2, '<Петя>', 4000, 0)").run();
    await db.prepare('INSERT INTO duels (id, week, rival) VALUES (1, ?, 2)').bind(week).run();
    await markWeekend(db, 1, 5000, 9000, MON - 2 * DAY);
    expect(await sendNewspapers(env, MON - DAY)).toBe(0); // воскресенье — нет
    expect(await sendNewspapers(env, MON)).toBe(2);
    const mine = sent.find((m) => m.chat_id === 1)!.text;
    expect(mine).toContain('Вестник района</b> · 26.10–01.11');
    expect(mine).toContain('6 000 (▲ 50%)');
    expect(mine).toContain('1-е место из 2');
    expect(mine).toContain('победа над «&lt;Петя&gt; и Ко»');
    expect(mine).toContain('«Чёрная пятница»: 1-е место');
    expect(sent.some((m) => m.chat_id === 3)).toBe(false);
    // Второй раз тот же номер не приходит.
    expect(await sendNewspapers(env, MON + 3600_000)).toBe(0);
  });

  it('не торговал — газеты нет; заблокировал бота — больше не пишем', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(5), env);
    const db = env.DB!;
    expect(await paperFor(db, 5, weekOf(MON) - 1, 'ru')).toBeNull();
    await markWeek(db, 5, 0, MON - 7 * DAY);
    await markWeek(db, 5, 3000, MON);
    blocked.add(5);
    expect(await sendNewspapers(env, MON)).toBe(0);
    expect((await db.prepare('SELECT misses FROM players WHERE id = 5').first<{ misses: number }>())!.misses).toBe(99);
    expect(await paperFor(db, 5, weekOf(MON) - 1, 'en')).toContain('Weekly revenue: 3 000');
  });
});
