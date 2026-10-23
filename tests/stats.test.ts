import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordReferral, recordSource, socialPing, sourceOf } from '../api/_lib/social';
import { leaderboard, progress, stats } from '../api/_lib/stats';
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
async function initData(id: number, startParam?: string): Promise<string> {
  const fields: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Тест' }) };
  if (startParam) fields.start_param = startParam;
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

describe.skipIf(!Database)('рейтинг и аналитика (сервер)', () => {
  it('без базы выключено', async () => {
    const env: Env = { BOT_TOKEN: TOKEN };
    expect(await (await progress(await post(1), env)).json()).toEqual({ enabled: false });
    expect(await (await leaderboard(await post(1), env)).json()).toEqual({ enabled: false });
  });

  it('прогресс → рейтинг: весь Telegram и свои по приглашениям', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    await recordReferral(env, 3, 'ref_1');
    for (const [id, revenue] of [[1, 5000], [2, 9000], [3, 100], [4, 20000]] as const) {
      await progress(await post(id, { day: 10, level: 2, rating: 4.36, revenue, money: 100, events: [{ kind: 'day_end', day: 10 }, { kind: 'BAD KIND!' }] }), env);
    }
    const board = (await (await leaderboard(await post(2), env)).json()) as { top: { revenue: number; me?: boolean }[]; friends: { revenue: number }[]; rank: number; total: number };
    expect(board.top.map((r) => r.revenue)).toEqual([20000, 9000, 5000, 100]);
    expect(board.top[1]).toMatchObject({ me: true, rating: 4.4 });
    // Свои для второго: пригласивший (1), он сам и «брат» по приглашению (3); чужой 4 — нет.
    expect(board.friends.map((r) => r.revenue)).toEqual([9000, 5000, 100]);
    expect(board).toMatchObject({ rank: 2, total: 4 });
  });

  it('сводка только по ключу: воронка и события', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'sekret', DB: d1() };
    await progress(await post(1, { day: 12, events: [{ kind: 'day_end', day: 12 }] }), env);
    await progress(await post(2, { day: 2 }), env);
    expect((await stats(new Request('https://x/api/stats?key=nope'), env)).status).toBe(403);
    const s = (await (await stats(new Request('https://x/api/stats?key=sekret'), env)).json()) as { funnel: Record<string, number>; eventsWeek: { kind: string; n: number }[] };
    expect(s.funnel).toMatchObject({ day1: 2, day2: 2, day3: 1, day10: 1, day15: 0 });
    expect(s.eventsWeek).toEqual([{ kind: 'day_end', n: 1, players: 1 }]);
  });

  it('плавность: у каждого игрока — последний замер FPS, по корзинам', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'sekret', DB: d1() };
    // У первого два дня в одной пачке: в счёт идёт последний (58), а не первый (20).
    await progress(await post(1, { day: 5, events: [{ kind: 'fps', day: 4, value: 20 }, { kind: 'fps', day: 5, value: 58 }] }), env);
    await progress(await post(2, { day: 3, events: [{ kind: 'fps', day: 3, value: 33 }] }), env);
    await progress(await post(3, { day: 3, events: [{ kind: 'fps', day: 3, value: 61 }] }), env);
    const s = (await (await stats(new Request('https://x/api/stats?key=sekret'), env)).json()) as { fps: { bucket: string; players: number }[] };
    expect(s.fps).toEqual([
      { bucket: '55+', players: 2 },
      { bucket: '30-44', players: 1 },
    ]);
  });

  it('два начала новичка: игроки, шаги, удержание и время до первой продажи — по вариантам', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'sekret', DB: d1() };
    // Пришли 8 дней назад, второй и третий вернулись через день, второй — и через неделю.
    const joined = Date.now() - 8 * 24 * 3600_000;
    vi.setSystemTime(joined);
    for (const id of [1, 2, 3, 4]) await socialPing(await post(id), env);
    vi.useRealTimers();
    // Прежнее начало (0): первый бросил на 3-м шаге обхода, второй прошёл его и продал за 40 с.
    await progress(await post(1, { day: 1, events: [{ kind: 'onb_ab', day: 1, value: 0 }, { kind: 'onb_play', day: 1, value: 3 }, { kind: 'tour_step', day: 1, value: 1 }, { kind: 'tour_step', day: 1, value: 2 }, { kind: 'tour_step', day: 1, value: 3 }] }), env);
    await progress(await post(2, { day: 8, events: [{ kind: 'onb_ab', day: 1, value: 0 }, { kind: 'tour_step', day: 1, value: 1 }, { kind: 'tour_done', day: 1, value: 11 }, { kind: 'onb_sale', day: 1, value: 40 }] }), env);
    // Новое (1): оба продали — за 12 с и 26 с (второй прислал первую продажу дважды: берётся первая);
    // за 20 с и быстрее — только первый.
    // Третий доиграл первый день и открыл второй (шаги с цифрой в названии).
    await progress(await post(3, { day: 3, events: [{ kind: 'onb_ab', day: 1, value: 1 }, { kind: 'onb_sale', day: 1, value: 12 }, { kind: 'onb_day1', day: 1, value: 95 }, { kind: 'onb_day2', day: 2, value: 4 }, { kind: 'onb_tab', day: 2, value: 0 }] }), env);
    await progress(await post(4, { day: 1, events: [{ kind: 'onb_ab', day: 1, value: 1 }, { kind: 'onb_sale', day: 1, value: 26 }, { kind: 'onb_sale', day: 1, value: 50 }] }), env);
    // Вернулись: второй — через неделю, третий — на следующий день.
    const seen = async (id: number, at: number) => {
      vi.setSystemTime(at);
      await socialPing(await post(id), env);
      vi.useRealTimers();
    };
    await seen(2, joined + 7.5 * 24 * 3600_000);
    await seen(3, joined + 1.5 * 24 * 3600_000);
    const s = (await (await stats(new Request('https://x/api/stats?key=sekret'), env)).json()) as {
      onboarding: Record<'tour' | 'play', { players: number; d1: { share: number | null }; d7: { share: number | null }; reached: { day2: number }; steps: Record<string, number>; firstSale: { players: number; median: number | null; fast: number }; tourSteps: Record<string, number>; tabs: Record<string, number> }>;
    };
    const { tour, play } = s.onboarding;
    expect(tour).toMatchObject({ players: 2, d1: { share: 50 }, d7: { share: 50 }, reached: { day2: 1 }, tourSteps: { 1: 2, 2: 1, 3: 1 } });
    expect(tour.steps).toMatchObject({ onb_play: 1, tour_done: 1, onb_sale: 1 });
    expect(tour.firstSale).toEqual({ players: 1, median: 40, avg: 40, fast: 0 });
    expect(play).toMatchObject({ players: 2, d1: { share: 50 }, d7: { share: 0 }, reached: { day2: 1 }, tabs: { 0: 1 } });
    expect(play.steps).toMatchObject({ onb_sale: 2, onb_day1: 1, onb_day2: 1 });
    expect(tour.steps).toMatchObject({ onb_day1: 0, onb_day2: 0 });
    expect(play.firstSale).toEqual({ players: 2, median: 19, avg: 19, fast: 1 });
  });

  it('рекламные метки: канал нового игрока, приглашения, прямые ссылки; в сводке — по каналам', async () => {
    expect(sourceOf('src_TGAds')).toBe('tgads');
    expect(sourceOf('ref_42')).toBe('ref');
    expect(sourceOf('guild_ABC')).toBeNull();
    expect(sourceOf('src_' + 'x'.repeat(30))).toBeNull();
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'sekret', DB: d1() };
    // Через бота: /start src_telega, потом открыл игру.
    await recordSource(env, 1, 'src_telega');
    await socialPing(await post(1), env);
    // Прямая ссылка в игру: ?startapp=src_tgads.
    const direct = new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(2, 'src_tgads'), lang: 'ru' }) });
    await socialPing(direct, env);
    // Уже игравший пришёл по рекламе — не новый, не считаем.
    await socialPing(await post(3), env);
    await recordSource(env, 3, 'src_telega');
    // Нажал «Старт» по рекламе, но игру не открыл — в сводку не попадает.
    await recordSource(env, 4, 'src_telega');
    await progress(await post(1, { day: 8 }), env);
    await progress(await post(2, { day: 2 }), env);
    const s = (await (await stats(new Request('https://x/api/stats?key=sekret'), env)).json()) as { sources: { source: string; players: number; day3: number | null; day7: number | null }[] };
    expect(s.sources).toEqual([
      { source: 'telega', players: 1, day3: 1, day7: 1 },
      { source: 'tgads', players: 1, day3: 0, day7: 0 },
      { source: 'organic', players: 1, day3: null, day7: null },
    ]);
  });
});
