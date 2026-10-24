import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_TTL, help, HELPS_GIVEN, HELPS_TAKEN, SHARE_GAP, share } from '../api/_lib/share';
import { socialPing } from '../api/_lib/social';
import { card } from '../api/_lib/card';
import { WELCOME_COINS } from '../api/_lib/botProfile';
import type { D1, D1Statement, Env } from '../api/_lib/telegram';
// Исходник, а не модуль: модуль игры тянет словарь и окно браузера.
import socialSource from '../src/platform/social.ts?raw';

// Окно «Поделиться» Telegram (сообщение готовит сервер) и «Позвать на помощь»: прямые ссылки в игру,
// одна подмога от друга в день, только тому, кто звал. Telegram — понарошку (fetch подменён).

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
/** Подписанные данные запуска; start — метка ссылки t.me/<бот>?startapp=<метка>. */
async function initData(id: number, start?: string, name = 'Аня'): Promise<string> {
  const fields: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: name }) };
  if (start) fields.start_param = start;
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const req = (body: unknown) => new Request('https://shop.example/api/x', { method: 'POST', body: JSON.stringify(body) });
const call = async (handler: (r: Request, e: Env, now?: number) => Promise<Response>, env: Env, body: unknown, now?: number) =>
  (await (await handler(req(body), env, now)).json()) as Record<string, unknown>;

/** Bot API понарошку: что вызывали; savePreparedInlineMessage может «сломаться» (инлайн-режим выключен). */
let calls: { method: string; body: Record<string, unknown> }[] = [];
let prepareFails = false;
beforeEach(() => {
  calls = [];
  prepareFails = false;
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const method = url.split('/').pop()!;
    calls.push({ method, body: JSON.parse(init.body) });
    if (method === 'getMe') return new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } }));
    if (method === 'savePreparedInlineMessage')
      return new Response(JSON.stringify(prepareFails ? { ok: false, description: 'Bad Request: BOT_INLINE_DISABLED' } : { ok: true, result: { id: `prep${calls.length}`, expiration_date: 0 } }));
    return new Response(JSON.stringify({ ok: true, result: {} }));
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Игрок открыл игру (и попал в players/progress — как после первого запуска и отчёта). */
async function play(env: Env, id: number, name: string, start?: string): Promise<Record<string, unknown>> {
  const res = await call(socialPing, env, { initData: await initData(id, start, name), lang: 'ru' });
  await env.DB!.prepare('INSERT OR REPLACE INTO progress (id, name, day, updated) VALUES (?, ?, 5, ?)').bind(id, name, Date.now()).run();
  return res;
}

describe.skipIf(!Database)('поделиться и «Помоги!» (сервер)', () => {
  it('приглашение: карточка с картинкой и кнопкой-ссылкой сразу в игру, не чаще раза в несколько секунд', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    expect(await call(share, { BOT_TOKEN: TOKEN }, { initData: await initData(1), kind: 'invite' })).toEqual({ enabled: false });
    expect((await share(req({ initData: 'user=x&hash=00', kind: 'invite' }), env)).status).toBe(401);
    expect((await share(req({ initData: await initData(1), kind: 'spam' }), env)).status).toBe(400);
    const now = Date.now();
    const res = await call(share, env, { initData: await initData(1), kind: 'invite', lang: 'ru' }, now);
    expect(res.id).toMatch(/^prep/);
    const prepared = calls.find((c) => c.method === 'savePreparedInlineMessage')!.body as {
      user_id: number;
      result: { type: string; photo_url: string; caption: string; reply_markup: { inline_keyboard: { text: string; url?: string; web_app?: unknown }[][] } };
    };
    expect(prepared.user_id).toBe(1);
    expect(prepared.result.type).toBe('photo');
    expect(prepared.result.photo_url).toBe('https://shop.example/promo/invite_ru.jpg');
    expect(prepared.result.caption).toContain('Аня');
    // Обычная ссылка, а не кнопка мини-приложения: работает в группах и после пересылки.
    const button = prepared.result.reply_markup.inline_keyboard[0][0];
    expect(button.url).toBe('https://t.me/magazinchik_bot?startapp=ref_1');
    expect(button.web_app).toBeUndefined();
    // Второе касание сразу за первым: не сбой (игра не откроет вдобавок окно со ссылкой), сообщение не готовится.
    const prepares = calls.filter((c) => c.method === 'savePreparedInlineMessage').length;
    expect(await call(share, env, { initData: await initData(1), kind: 'invite' }, now + SHARE_GAP / 2)).toEqual({ error: 'too_often' });
    expect(calls.filter((c) => c.method === 'savePreparedInlineMessage').length).toBe(prepares);
    expect((await call(share, env, { initData: await initData(1), kind: 'invite', lang: 'en' }, now + SHARE_GAP + 1)).id).toBeTruthy();
    expect(String((calls.filter((c) => c.method === 'savePreparedInlineMessage').pop()!.body.result as { photo_url: string }).photo_url)).toContain('invite_en.jpg');
  });

  it('инлайн-режим у бота выключен — сообщение не готово, игра поделится ссылкой; просьба о помощи не записана', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    prepareFails = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await call(share, env, { initData: await initData(1), kind: 'help' })).toEqual({ error: 'not_prepared' });
    await play(env, 2, 'Боря');
    expect(await call(help, env, { initData: await initData(2, 'help_1'), action: 'send' })).toEqual({ ok: false, error: 'expired' });
    // Старый Telegram: поделился ссылкой — игра сама сообщает, что звала.
    expect(await call(help, env, { initData: await initData(1), action: 'ask' })).toEqual({ ok: true });
    expect((await call(help, env, { initData: await initData(2, 'help_1'), action: 'send' })).ok).toBe(true);
  });

  it('«Помоги!»: друг открыл ссылку — подмога ушла; второй раз за день — нет; хозяин забирает один раз', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await play(env, 1, 'Аня');
    await play(env, 2, 'Боря');
    const now = Date.now();
    // Не звала — помочь нельзя (метку help_<id> можно набрать руками).
    expect(await call(help, env, { initData: await initData(2, 'help_1'), action: 'send' }, now)).toEqual({ ok: false, error: 'expired' });
    const asked = await call(share, env, { initData: await initData(1), kind: 'help' }, now);
    expect(asked.id).toBeTruthy();
    const prepared = calls.filter((c) => c.method === 'savePreparedInlineMessage').pop()!.body as { result: { photo_url: string; reply_markup: { inline_keyboard: { url: string }[][] } } };
    expect(prepared.result.reply_markup.inline_keyboard[0][0].url).toBe('https://t.me/magazinchik_bot?startapp=help_1');
    expect(prepared.result.photo_url).toBe('https://shop.example/promo/help_ru.jpg');

    expect(await call(help, env, { initData: await initData(2), action: 'send' }, now)).toEqual({ ok: false, error: 'no_request' });
    expect(await call(help, env, { initData: await initData(1, 'help_1'), action: 'send' }, now)).toEqual({ ok: false, error: 'self' });
    expect(await call(help, env, { initData: await initData(2, 'help_1'), action: 'send' }, now)).toEqual({ ok: true, name: 'Аня' });
    expect(await call(help, env, { initData: await initData(2, 'help_1'), action: 'send' }, now + 1000)).toEqual({ ok: false, error: 'already' });
    // Помог — теперь друзья (заходят в гости, visits.ts).
    expect(await env.DB!.prepare('SELECT COUNT(*) AS n FROM friends WHERE (a = 1 AND b = 2) OR (a = 2 AND b = 1)').first<{ n: number }>()).toEqual({ n: 2 });

    expect((await play(env, 1, 'Аня')).helped).toBe(1);
    expect(await call(help, env, { initData: await initData(1), action: 'claim' })).toEqual({ names: ['Боря'] });
    expect(await call(help, env, { initData: await initData(1), action: 'claim' })).toEqual({ names: [] });
    expect((await play(env, 1, 'Аня')).helped).toBe(0);
  });

  it('просьба живёт сутки; один помогает не больше HELPS_GIVEN раз в день, магазин принимает не больше HELPS_TAKEN', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    const now = Date.now();
    for (let id = 1; id <= 20; id++) await play(env, id, `Игрок ${id}`);
    await call(help, env, { initData: await initData(1), action: 'ask' }, now);
    expect(await call(help, env, { initData: await initData(2, 'help_1'), action: 'send' }, now + ASK_TTL + 1)).toEqual({ ok: false, error: 'expired' });
    // Игрок 2 помогает всем подряд — после HELPS_GIVEN хватит.
    for (let id = 3; id < 3 + HELPS_GIVEN + 1; id++) await call(help, env, { initData: await initData(id), action: 'ask' }, now);
    for (let k = 0; k < HELPS_GIVEN; k++) expect((await call(help, env, { initData: await initData(2, `help_${3 + k}`), action: 'send' }, now)).ok).toBe(true);
    expect(await call(help, env, { initData: await initData(2, `help_${3 + HELPS_GIVEN}`), action: 'send' }, now)).toEqual({ ok: false, error: 'limit' });
    // Одному магазину помогают все — после HELPS_TAKEN хватит.
    for (let k = 0; k < HELPS_TAKEN; k++) expect((await call(help, env, { initData: await initData(10 + k, 'help_1'), action: 'send' }, now)).ok).toBe(true);
    expect(await call(help, env, { initData: await initData(19, 'help_1'), action: 'send' }, now)).toEqual({ ok: false, error: 'full' });
  });

  it('прямая ссылка ?startapp=ref_<id>: друг засчитан при первом запуске, подарок новичку, источник «ref»; help_<id> — тоже приглашение', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await play(env, 1, 'Аня');
    const friend = await play(env, 2, 'Боря', 'ref_1');
    expect(friend.welcome).toBe(true);
    const helper = await play(env, 3, 'Вика', 'help_1');
    expect(helper.welcome).toBe(true);
    // Уже игравший по ссылке не считается.
    expect((await play(env, 2, 'Боря', 'ref_3')).welcome).toBe(false);
    expect(await play(env, 1, 'Аня')).toMatchObject({ friends: 2, unclaimed: 2 });
    const sources = (await env.DB!.prepare('SELECT id, source FROM sources ORDER BY id').all<{ id: number; source: string }>()).results;
    expect(sources).toEqual([{ id: 2, source: 'ref' }, { id: 3, source: 'help' }]);
  });

  it('карточка итогов: окно «Поделиться» с картинкой карточки; не вышло — бот присылает её в чат', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://app/' };
    const IMAGE = btoa('\xff\xd8\xff\xe0 fake jpeg \xff\xd9');
    const now = Date.now();
    const res = await call(card, env, { initData: await initData(1), image: IMAGE, share: true, send: true, caption: 'Мой магазин' }, now);
    expect(res.prepared).toMatch(/^prep/);
    expect(calls.some((c) => c.method === 'sendPhoto')).toBe(false);
    const prepared = calls.find((c) => c.method === 'savePreparedInlineMessage')!.body as { result: { photo_url: string } };
    expect(prepared.result.photo_url).toBe(res.url);
    prepareFails = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fallback = await call(card, env, { initData: await initData(1), image: IMAGE, share: true, send: true, caption: 'Мой магазин' }, now + 60_000);
    expect(fallback.prepared).toBeUndefined();
    expect(fallback.sent).toBe(true);
    // В чате — кнопка-ссылка с приглашением: её можно переслать.
    const photo = calls.find((c) => c.method === 'sendPhoto')!.body as { reply_markup: { inline_keyboard: { url: string }[][] } };
    expect(photo.reply_markup.inline_keyboard[0][0].url).toBe('https://t.me/magazinchik_bot?startapp=ref_1');
  });
});

describe('подарок новичку в приветствии бота', () => {
  it('совпадает с WELCOME_GIFT в игре (src/platform/social.ts)', () => {
    expect(Number(/export const WELCOME_GIFT = (\d+);/.exec(socialSource)?.[1])).toBe(WELCOME_COINS);
  });
});
