import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTesterIds, isTester, tester } from '../api/_lib/tester';
import { leaderboard, progress, stats } from '../api/_lib/stats';
import { league } from '../api/_lib/league';
import { socialPing } from '../api/_lib/social';
import worker from '../worker/index';
import type { D1, D1Statement, Env } from '../api/_lib/telegram';
import { newGame } from '../src/game/economy';
import { restartGame } from '../src/game/restart';
import { grantTester, markTester, moneyLabel, TESTER_GRANTS, TESTER_MONEY_CAP } from '../src/game/tester';

// Режим тестировщика (16.11): сервер говорит «свой» только по настоящей подписи и номеру из TESTER_IDS,
// тестер не попадает в рейтинг и турнир, а кнопки монет не ломают сохранение и счёт.

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
async function initData(id: number, token = TOKEN): Promise<string> {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: `Игрок${id}` }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), token);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const req = (body: unknown, path = '/api/tester') => new Request(`https://x${path}`, { method: 'POST', body: JSON.stringify(body) });
const ask = async (env: Env, body: unknown) => ((await (await tester(req(body), env)).json()) as { tester: boolean }).tester;

beforeEach(() => vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true, result: {} }))));
afterEach(() => vi.unstubAllGlobals());

describe('TESTER_IDS: разбор списка', () => {
  it('через запятую, пробел, точку с запятой и перенос; мусор и не-числа — мимо', () => {
    expect([...parseTesterIds('111, 222 333;444\n555')]).toEqual([111, 222, 333, 444, 555]);
    expect([...parseTesterIds(' 7 ,, abc, -5, 1.5, 0, 12e3, 99999999999999999 ')]).toEqual([7]);
    expect(parseTesterIds(undefined).size).toBe(0);
    expect(parseTesterIds('').size).toBe(0);
  });

  it('isTester — только номер из списка', () => {
    const env: Env = { TESTER_IDS: '42,43' };
    expect(isTester(env, 42)).toBe(true);
    expect(isTester(env, 44)).toBe(false);
    expect(isTester({}, 42)).toBe(false);
  });
});

describe('POST /api/tester', () => {
  it('true — только при настоящей подписи и номере из списка', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, TESTER_IDS: '42' };
    expect(await ask(env, { initData: await initData(42) })).toBe(true);
    // Чужой номер, подпись другим токеном, испорченная подпись, пусто и мусор — нет.
    expect(await ask(env, { initData: await initData(7) })).toBe(false);
    expect(await ask(env, { initData: await initData(42, '999:other') })).toBe(false);
    expect(await ask(env, { initData: (await initData(42)).replace(/hash=(.)/, (_, c: string) => `hash=${c === '0' ? '1' : '0'}`) })).toBe(false);
    expect(await ask(env, {})).toBe(false);
    expect(await ask(env, { initData: 42 })).toBe(false);
    expect((await tester(new Request('https://x/api/tester', { method: 'POST', body: '{oops' }), env)).status).toBe(200);
  });

  it('нет TESTER_IDS или токена — всегда false', async () => {
    expect(await ask({ BOT_TOKEN: TOKEN }, { initData: await initData(42) })).toBe(false);
    expect(await ask({ TESTER_IDS: '42' }, { initData: await initData(42) })).toBe(false);
  });

  it('маршрут воркера: POST отвечает, GET — 405', async () => {
    const env = { BOT_TOKEN: TOKEN, TESTER_IDS: '42', ASSETS: { fetch: async () => new Response('asset') } };
    const res = await worker.fetch(req({ initData: await initData(42) }), env);
    expect(await res.json()).toEqual({ tester: true });
    expect((await worker.fetch(new Request('https://x/api/tester'), env)).status).toBe(405);
  });
});

describe.skipIf(!Database)('тестер вне рейтингов и турнира', () => {
  const report = async (env: Env, id: number, extra: Record<string, unknown> = {}) =>
    (await (await progress(req({ initData: await initData(id), day: 20, level: 3, rating: 4, revenue: 50_000, money: 10_000_000, events: [{ kind: 'day_end', day: 20 }], ...extra }, '/api/progress'), env)).json()) as { ok?: boolean; tester?: boolean };
  const board = async (env: Env, id: number) =>
    (await (await leaderboard(req({ initData: await initData(id) }, '/api/leaderboard'), env)).json()) as { top: { name: string }[]; total: number; rank: number | null };

  it('номер в TESTER_IDS: отчёт принят (ok), но в рейтинге, турнире и воронке его нет', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: 'sekret', DB: d1(), TESTER_IDS: '42' };
    await socialPing(req({ initData: await initData(1) }), env);
    expect(await report(env, 1)).toEqual({ ok: true });
    expect(await report(env, 42)).toEqual({ ok: true, tester: true });
    const b = await board(env, 1);
    expect(b.top.map((r) => r.name)).toEqual(['Игрок1']);
    expect(b.total).toBe(1);
    expect((await board(env, 42)).rank).toBeNull();
    // Турнир: честного игрока записали, тестера — нет (ответ как у новичка, без таблицы).
    const honest = (await (await league(req({ initData: await initData(1) }, '/api/league'), env)).json()) as { rows?: { name: string }[] };
    expect(honest.rows?.some((r) => r.name === 'Игрок1')).toBe(true);
    expect(honest.rows?.some((r) => r.name === 'Игрок42')).toBe(false);
    const mine = (await (await league(req({ initData: await initData(42) }, '/api/league'), env)).json()) as { enabled: boolean; rows?: unknown };
    expect(mine.enabled).toBe(true);
    expect(mine.rows).toBeUndefined();
    // Сводка автора: события тестера не пишутся.
    const s = (await (await stats(new Request('https://x/api/stats?key=sekret'), env)).json()) as { eventsWeek: { kind: string; players: number }[] };
    expect(s.eventsWeek).toEqual([{ kind: 'day_end', n: 1, players: 1 }]);
  });

  it('помеченное сохранение (tester в отчёте) убирает уже записанный магазин из рейтинга', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await report(env, 5);
    expect((await board(env, 1)).top.map((r) => r.name)).toEqual(['Игрок5']);
    expect(await report(env, 5, { tester: true })).toEqual({ ok: true, tester: true });
    expect((await board(env, 1)).total).toBe(0);
    // Строка «tester»: "yes" — не пометка (только true).
    expect(await report(env, 6, { tester: 'yes' })).toEqual({ ok: true });
  });
});

describe('кнопки монет (game/tester.ts)', () => {
  it('+10 млн и +1 млн: деньги прибавляются, долг гаснет, сохранение помечено', () => {
    const s = { ...newGame(), money: 350, debt: 1200 };
    const a = grantTester(s, TESTER_GRANTS[0]);
    expect(a).toMatchObject({ money: 10_000_350, debt: 0, tester: true });
    const b = grantTester(grantTester(a, TESTER_GRANTS[1]), TESTER_GRANTS[0]);
    expect(b.money).toBe(21_000_350);
    // Исходное состояние не тронуто, кредит банка — тоже.
    expect(s).toMatchObject({ money: 350, debt: 1200 });
    expect(s.tester).toBeUndefined();
    const loan = { left: 5000, payment: 500 };
    expect(grantTester({ ...s, loan }, TESTER_GRANTS[0]).loan).toEqual(loan);
  });

  it('потолок, мусор на входе и NaN: деньги остаются целым конечным числом', () => {
    const s = newGame();
    expect(grantTester({ ...s, money: TESTER_MONEY_CAP - 5 }, 10_000_000).money).toBe(TESTER_MONEY_CAP);
    // Уже больше потолка — не отнимаем.
    expect(grantTester({ ...s, money: TESTER_MONEY_CAP + 7 }, 1).money).toBe(TESTER_MONEY_CAP + 7);
    expect(grantTester(s, NaN).money).toBe(s.money);
    expect(grantTester(s, -500).money).toBe(s.money);
    expect(grantTester(s, Infinity).money).toBe(s.money);
    expect(grantTester({ ...s, money: NaN }, 1_000_000).money).toBe(1_000_000);
    expect(grantTester(s, 1.7).money).toBe(s.money + 1);
    // Сотни нажатий — всё равно целое и не больше потолка.
    let many = s;
    for (let i = 0; i < 200; i++) many = grantTester(many, TESTER_GRANTS[0]);
    expect(Number.isSafeInteger(many.money)).toBe(true);
    expect(many.money).toBe(TESTER_MONEY_CAP);
  });

  it('пометка одна и навсегда: markTester не плодит копий, «Начать заново» её сохраняет', () => {
    const s = markTester(newGame());
    expect(s.tester).toBe(true);
    expect(markTester(s)).toBe(s);
    expect(restartGame(s).tester).toBe(true);
    expect(restartGame(newGame()).tester).toBeUndefined();
    expect('tester' in restartGame(newGame())).toBe(false);
  });

  it('счётчик сверху: до миллиона — как раньше, дальше — разряды узким пробелом', () => {
    expect(moneyLabel(0)).toBe('0');
    expect(moneyLabel(999_999)).toBe('999999');
    expect(moneyLabel(1_000_000)).toBe('1 000 000');
    expect(moneyLabel(10_000_350)).toBe('10 000 350');
    expect(moneyLabel(TESTER_MONEY_CAP)).toBe('1 000 000 000');
    expect(moneyLabel(-2_500_000)).toBe('-2 500 000');
    expect(moneyLabel(12.6)).toBe('13');
  });
});

describe('сохранение', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => void (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение без пометки грузится как было; 10 млн и пометка переживают сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 40, money: 1234 };
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const before = loadGame()!;
    expect(before.money).toBe(1234);
    expect(before.tester).toBeUndefined();
    const plainSize = JSON.stringify(before).length;
    const rich = grantTester(before, TESTER_GRANTS[0]);
    saveGame(rich);
    const after = loadGame()!;
    expect(after).toMatchObject({ money: 10_001_234, debt: 0, tester: true, day: 40 });
    // Сохранение почти не растёт: пометка и пара цифр.
    expect(JSON.stringify(after).length - plainSize).toBeLessThan(40);
  });
});
