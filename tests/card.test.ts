import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { card, cardImage, cleanCards, CARD_MAX, CARD_TTL } from '../api/_lib/card';
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
  new Request('https://shop.example/api/card', { method: 'POST', body: JSON.stringify({ initData: await initData(id), ...extra }) });

let sent: { method: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  sent = [];
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    sent.push({ method: url.split('/').pop()!, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
});
afterEach(() => vi.unstubAllGlobals());

// Крошечный «JPEG»: серверу важно только, что это base64.
const IMAGE = btoa('\xff\xd8\xff\xe0 fake jpeg \xff\xd9');

describe.skipIf(!Database)('карточка итогов', () => {
  it('хранит картинку по ссылке и отдаёт её; не чаще раза в 20 секунд', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const now = Date.now();
    const res = (await (await card(await post(1, { image: IMAGE }), env, now)).json()) as { url: string };
    expect(res.url).toMatch(/^https:\/\/shop\.example\/api\/card\/[a-z0-9]{16}\.jpg$/);
    const id = /card\/(\w+)\.jpg/.exec(res.url)![1];
    const img = await cardImage(env, id);
    expect(img.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await img.arrayBuffer())[0]).toBe(0xff);
    expect((await card(await post(1, { image: IMAGE }), env, now + 5000)).status).toBe(429);
    expect((await cardImage(env, 'nope')).status).toBe(404);
    // Старые карточки убирает cron.
    await cleanCards(env.DB, now + CARD_TTL + 1);
    expect((await cardImage(env, id)).status).toBe(404);
  });

  it('не картинка — отказ; send — бот присылает карточку в чат', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://app/' };
    expect((await card(await post(2, { image: '<script>' }), env)).status).toBe(400);
    expect((await card(await post(2, { image: 'A'.repeat(CARD_MAX + 4) }), env)).status).toBe(400);
    const res = (await (await card(await post(2, { image: IMAGE, send: true, caption: 'Мой магазин' }), env)).json()) as { url: string; sent: boolean };
    expect(res.sent).toBe(true);
    expect(sent.find((c) => c.method === 'sendPhoto')).toMatchObject({ method: 'sendPhoto', body: { chat_id: 2, photo: res.url, caption: 'Мой магазин' } });
  });
});
