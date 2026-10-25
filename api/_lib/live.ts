// Календарь праздников по настоящим датам (src/game/live.ts): какие праздники, когда открытки и
// гости, какая вещь в подарок. Хранится в базе D1 (таблица settings, ключ «events»), поэтому автор
// меняет его без выпуска новой версии игры; пока своего календаря нет — встроенный DEFAULT_EVENTS.
// Как поменять — docs/EVENTS.md.
//
// GET  /api/events → { events, custom } — игра спрашивает при запуске (и держит копию у себя).
// POST /api/events-edit { events } → сохранить свой календарь (с проверкой); { reset: true } → вернуть
//      встроенный. Только для автора: секрет вебхука — в заголовке x-key (адреса запросов попадают в
//      журналы Cloudflare, заголовки — нет); ?key= в адресе тоже принимается, как у /api/stats.

import { DEFAULT_EVENTS, parseEvents, type LiveEvent } from '../../src/game/live.js';
import { ready } from './social.js';
import { json, type D1, type Env } from './telegram.js';

/** Календарь держим в памяти воркера минуту: игроки спрашивают его при каждом запуске. */
const CACHE_MS = 60_000;
let cache: { at: number; events: LiveEvent[]; custom: boolean } | null = null;
export const resetEventsCache = (): void => {
  cache = null;
};

/** Календарь из базы (свой) или встроенный. */
async function load(db: D1 | undefined): Promise<{ events: LiveEvent[]; custom: boolean }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  let found: { events: LiveEvent[]; custom: boolean } = { events: DEFAULT_EVENTS, custom: false };
  if (db) {
    await ready(db);
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'events'").first<{ value: string }>();
    if (row) {
      try {
        found = { events: parseEvents(JSON.parse(row.value)).events, custom: true };
      } catch (error) {
        // Испорченная запись — играем по встроенному календарю (и пишем в лог).
        console.error(error);
      }
    }
  }
  cache = { at: Date.now(), ...found };
  return found;
}

/** Праздники сейчас — для напоминаний бота (remind.ts). */
export const liveEventsFor = async (env: Env): Promise<LiveEvent[]> => (await load(env.DB).catch(() => ({ events: DEFAULT_EVENTS }))).events;

/** GET /api/events → { events, custom }: календарь праздников для игры. */
export async function events(_request: Request, env: Env): Promise<Response> {
  const found = await load(env.DB).catch((error) => (console.error(error), { events: DEFAULT_EVENTS, custom: false }));
  return new Response(JSON.stringify(found), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
}

/**
 * POST /api/events-edit (x-key: WEBHOOK_SECRET) { events: [...] } → { ok, events } или { error, errors }:
 * сохранить свой календарь (только целиком верный — иначе список ошибок, ничего не меняется);
 * { reset: true } — удалить свой и вернуться к встроенному.
 */
export async function eventsEdit(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const secret = env.WEBHOOK_SECRET ?? '';
  const db = env.DB;
  if (!secret || !db) return json({ error: 'not_configured' }, 503);
  const key = request.headers.get('x-key') ?? new URL(request.url).searchParams.get('key');
  if (key !== secret) return json({ error: 'forbidden' }, 403);
  const body = (await request.json().catch(() => null)) as { events?: unknown; reset?: boolean } | null;
  if (!body) return json({ error: 'bad_json' }, 400);
  await ready(db);
  if (body.reset === true) {
    await db.prepare("DELETE FROM settings WHERE key = 'events'").run();
    resetEventsCache();
    return json({ ok: true, events: DEFAULT_EVENTS, custom: false });
  }
  const parsed = parseEvents(body.events);
  if (parsed.errors.length) return json({ error: 'invalid', errors: parsed.errors }, 400);
  await db.prepare("INSERT OR REPLACE INTO settings (key, value, updated) VALUES ('events', ?, ?)").bind(JSON.stringify(parsed.events), now).run();
  resetEventsCache();
  return json({ ok: true, events: parsed.events, custom: true });
}
