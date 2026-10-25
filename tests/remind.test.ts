import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daytime, DEFAULT_TZ, faceUrl, localMinutes, pickReminder, reasons, resetReminderPhotos, sendReminders, type Player } from '../api/_lib/remind';
import { saveHooks, socialPing } from '../api/_lib/social';
import { events, eventsEdit, resetEventsCache } from '../api/_lib/live';
import { DEFAULT_EVENTS } from '../src/game/live';
import type { D1, D1Statement, Env } from '../api/_lib/telegram';

// Настоящая SQLite из Node (22.5+) вместо Cloudflare D1 (как в social.test.ts).
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
const ping = async (id: number, extra: Record<string, unknown> = {}) =>
  new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), lang: 'ru', ...extra }) });

/** Бот понарошку: что и кому отправили. */
let calls: { method: string; body: Record<string, unknown> }[] = [];
let failPhoto = false;
beforeEach(() => {
  calls = [];
  failPhoto = false;
  resetReminderPhotos();
  resetEventsCache();
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const method = url.split('/').pop()!;
    const body = JSON.parse(init.body) as Record<string, unknown>;
    if (method === 'getMe') return new Response(JSON.stringify({ ok: true, result: { username: 'magazinchik_bot' } }));
    calls.push({ method, body });
    if (method === 'sendPhoto' && failPhoto) return new Response(JSON.stringify({ ok: false, description: 'Bad Request: wrong file identifier/HTTP URL specified' }));
    return new Response(JSON.stringify({ ok: true, result: method === 'sendPhoto' ? { photo: [{ file_id: 'small' }, { file_id: 'big' }] } : {} }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const player = (patch: Partial<Player> = {}): Player => ({
  id: 1,
  lang: 'ru',
  tz: DEFAULT_TZ,
  sonya: 0,
  spoil: 0,
  streak: 0,
  gift: '',
  cashier: 0,
  day: 14,
  reason: null,
  helper: null,
  ...patch,
});

describe('напоминания по местному времени', () => {
  it('тихие часы считаются по часовому поясу игрока, а не по Гринвичу', () => {
    const utcNoon = Date.UTC(2026, 10, 2, 12, 0);
    expect(localMinutes(utcNoon, 180)).toBe(15 * 60);
    expect(daytime(utcNoon, 180)).toBe(true); // Москва, 15:00
    expect(daytime(utcNoon, 600)).toBe(false); // Владивосток, 22:00
    expect(daytime(utcNoon, -300)).toBe(false); // Нью-Йорк, 7:00
    expect(daytime(Date.UTC(2026, 10, 2, 7, 0), 180)).toBe(true); // Москва, 10:00 — уже можно
    expect(daytime(Date.UTC(2026, 10, 2, 18, 0), 180)).toBe(false); // Москва, 21:00 — уже нельзя
  });

  it('повод — по важности, от лица героя; второй раз подряд — другой повод', () => {
    const now = Date.UTC(2026, 10, 4, 9, 0); // среда, ноябрь — без праздника и выходных
    const p = player({ sonya: 1, spoil: 4, streak: 3, gift: '2026-11-03', cashier: 1 });
    expect(reasons(p, now, DEFAULT_EVENTS).map((r) => r.reason)).toEqual(['sonya', 'gift', 'spoil', 'cashier', 'day']);
    const first = pickReminder(p, now, DEFAULT_EVENTS);
    expect(first).toMatchObject({ reason: 'sonya', face: 'sonya' });
    expect(first.text).toContain('Соня');
    expect(pickReminder({ ...p, reason: 'sonya' }, now, DEFAULT_EVENTS)).toMatchObject({ reason: 'gift', face: 'grandma' });
    expect(pickReminder({ ...p, reason: 'sonya' }, now, DEFAULT_EVENTS).text).toContain('день 4 из 7');
    // Серия уже прервалась (гостинец не вчера) — о ней не пишем.
    expect(reasons({ ...p, gift: '2026-11-01' }, now, DEFAULT_EVENTS).some((r) => r.reason === 'gift')).toBe(false);
    // Повод один — повторяем его.
    expect(pickReminder(player({ reason: 'day' }), now, DEFAULT_EVENTS)).toMatchObject({ reason: 'day', text: expect.stringContaining('День 14') });
    expect(pickReminder(player({ spoil: 5, lang: 'en', reason: 'day' }), now, DEFAULT_EVENTS).text).toContain('5 items');
  });

  it('в декабре — гость и открытка, в выходные — распродажа района, подмога друга — с именем', () => {
    const guestDay = Date.UTC(2026, 11, 13, 9, 0); // 13 декабря, воскресенье: Дед Мороз
    const r = reasons(player({ helper: 'Аня' }), guestDay, DEFAULT_EVENTS);
    expect(r.map((x) => x.reason)).toEqual(['helped', 'guest', 'card', 'weekend', 'day']);
    expect(r[0].text).toContain('Аня');
    expect(r[1].face).toBe('moroz');
    expect(r[2]).toMatchObject({ face: 'snegurochka', text: expect.stringContaining('13 декабря') });
    expect(r[2].text).toContain('19 дней');
    const eve = reasons(player(), Date.UTC(2026, 11, 31, 9, 0), DEFAULT_EVENTS).find((x) => x.reason === 'card')!;
    expect(eve.text).toContain('последний день года');
  });

  it('cron: пишет только тем, у кого день; картинка героя — по полному адресу сайта, потом по file_id', async () => {
    if (!Database) return;
    const db = d1();
    const env: Env = { BOT_TOKEN: TOKEN, DB: db, APP_URL: 'https://shop.example/' };
    await socialPing(await ping(1, { tz: 180, hooks: { sonya: 1, day: 9 } }), env); // Москва
    await socialPing(await ping(2, { tz: 600, hooks: { sonya: 1, day: 4 } }), env); // Владивосток
    await socialPing(await ping(3, { hooks: { sonya: 1, day: 30 } }), env); // пояс неизвестен — как Москва
    calls = [];
    // Через сутки, в 12:00 по Гринвичу: в Москве 15:00, во Владивостоке 22:00.
    const now = Date.now() + 26 * 3600_000;
    const at = Math.floor(now / 86_400_000) * 86_400_000 + 12 * 3600_000 + 86_400_000;
    expect(await sendReminders(env, at)).toBe(2);
    expect(calls.map((c) => c.body.chat_id).sort()).toEqual([1, 3]);
    const [first, second] = calls;
    expect(first.method).toBe('sendPhoto');
    expect(first.body.photo).toBe(faceUrl('https://shop.example/', 'sonya'));
    expect(first.body.photo).toBe('https://shop.example/promo/remind_sonya.png');
    expect(String(first.body.caption)).toContain('Соня');
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
    // Второй раз та же картинка уходит по file_id, который вернул Telegram.
    expect(second.body.photo).toBe('big');
    // Владивосток получит своё днём по своему времени (в 02:00 по Гринвичу там полдень).
    calls = [];
    expect(await sendReminders(env, at + 14 * 3600_000)).toBe(1);
    expect(calls[0].body.chat_id).toBe(2);
    expect(calls[0].body.photo).toBe('big');
  });

  it('картинка не прошла — напоминание уходит текстом, а не считается блокировкой', async () => {
    if (!Database) return;
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1(), APP_URL: 'https://shop.example/' };
    await socialPing(await ping(5, { tz: 180 }), env);
    calls = [];
    failPhoto = true;
    const at = Math.floor((Date.now() + 2 * 86_400_000) / 86_400_000) * 86_400_000 + 12 * 3600_000;
    expect(await sendReminders(env, at)).toBe(1);
    expect(calls.map((c) => c.method)).toEqual(['sendPhoto', 'sendMessage']);
    expect(calls[1].body.text).toBe(calls[0].body.caption);
    expect(calls[1].body.reply_markup).toEqual({ inline_keyboard: [[{ text: '▶ Играть', web_app: { url: 'https://shop.example/' } }]] });
  });

  it('поводы и часовой пояс из отчёта игры: проверяются и не стирают друг друга', async () => {
    if (!Database) return;
    const db = d1();
    await socialPing(await ping(7, { tz: 99999, hooks: { sonya: 5, spoil: -3, gift: 'вчера', day: 12 } }), { BOT_TOKEN: TOKEN, DB: db });
    let row = await db.prepare('SELECT * FROM hooks WHERE id = 7').first<Record<string, unknown>>();
    expect(row).toMatchObject({ tz: 840, sonya: 1, spoil: 0, gift: '', day: 12 });
    // Только пояс (старый клиент без поводов) — поводы остаются прежними.
    await saveHooks(db, 7, { tz: 180 });
    row = await db.prepare('SELECT * FROM hooks WHERE id = 7').first<Record<string, unknown>>();
    expect(row).toMatchObject({ tz: 180, sonya: 1, day: 12 });
  });
});

describe('календарь праздников на сервере', () => {
  it('без своего — встроенный; автор сохраняет свой по ключу, ошибки — списком', async () => {
    if (!Database) return;
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'secret', DB: d1() };
    const get = async () => (await (await events(new Request('https://x/api/events'), env)).json()) as { events: unknown[]; custom: boolean };
    expect(await get()).toEqual({ events: DEFAULT_EVENTS, custom: false });
    const edit = (key: string, body: unknown) => eventsEdit(new Request(`https://x/api/events-edit?key=${key}`, { method: 'POST', body: JSON.stringify(body) }), env);
    expect((await edit('wrong', { events: [] })).status).toBe(403);
    const bad = await edit('secret', { events: [{ id: 'ny', theme: 'newyear', from: '13-01', to: '12-31' }] });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { errors: string[] }).errors[0]).toContain('ММ-ДД');
    const mine = [{ id: 'ny', theme: 'newyear', from: '12-15', to: '01-08', cards: { from: '12-15', to: '12-31' } }];
    expect((await edit('secret', { events: mine })).status).toBe(200);
    expect(await get()).toEqual({ events: mine, custom: true });
    expect((await edit('secret', { reset: true })).status).toBe(200);
    expect((await get()).custom).toBe(false);
  });
});
