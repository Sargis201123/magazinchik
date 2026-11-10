import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { socialPing, recordReferral } from '../api/_lib/social';
import { progress } from '../api/_lib/stats';
import { dayShopFor, goalOf, resetDayShops, town } from '../api/_lib/town';
import { weekOf as serverWeek } from '../api/_lib/week';
import type { D1, D1Statement, Env } from '../api/_lib/telegram';
import { newGame, type StoreState } from '../src/game/economy';
import { claimGoal, GOAL_BASE, GOAL_NEIGHBOURS, GOAL_PER_SHOP, goalNeighbours, goalReward, LIKES_MAX, likeTip, takeLikes, townFlags, weekOf } from '../src/game/town';
import { friendState, GUEST_GARDEN, shopSnapshot } from '../src/game/friendShop';
import { bedsOf, gardenRipe } from '../src/game/garden';
import { tenantsOf, tenantTier } from '../src/game/tenants';
import { comebackHooks } from '../src/game/comeback';
import { pickReminder, TEXTS, type Player } from '../api/_lib/remind';
import { DEFAULT_EVENTS } from '../src/game/live';

// Район (town.ts): общая цель недели, «Магазин дня» с отметкой, полив теплицы другу, напоминание про урожай.

const DAY = 24 * 3600_000;

describe('район: правила игры', () => {
  const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, level: 2, money: 1000, ...over });

  it('неделя считается как на сервере', () => {
    for (const now of [Date.UTC(2026, 10, 9), Date.UTC(2026, 10, 15, 23, 59), Date.UTC(2026, 10, 16)]) expect(weekOf(now)).toBe(serverWeek(now));
  });

  it('соседи к концу недели приносят свою долю базы и не больше', () => {
    expect(goalNeighbours(0)).toBe(0);
    expect(goalNeighbours(1)).toBe(GOAL_BASE * GOAL_NEIGHBOURS);
    expect(goalNeighbours(5)).toBe(GOAL_BASE * GOAL_NEIGHBOURS);
    expect(goalNeighbours(0.5)).toBeGreaterThan(goalNeighbours(0.25));
  });

  it('награда за цель — один раз за неделю, после неё над улицей флажки до конца следующей недели', () => {
    const now = Date.UTC(2026, 10, 10);
    const week = weekOf(now);
    const won = claimGoal(shop(), week)!;
    expect(won.money).toBe(goalReward(2));
    expect(won.state.money).toBe(1000 + goalReward(2));
    expect(claimGoal(won.state, week)).toBeNull();
    expect(claimGoal(won.state, week - 1)).toBeNull();
    expect(townFlags(shop(), now)).toBe(false);
    expect(townFlags(won.state, now)).toBe(true);
    expect(townFlags(won.state, now + 7 * DAY)).toBe(true);
    expect(townFlags(won.state, now + 14 * DAY)).toBe(false);
  });

  it('чаевые от гостей: за каждого, но не больше десяти за раз', () => {
    expect(takeLikes(shop(), 0)).toBeNull();
    expect(takeLikes(shop(), 3)!.money).toBe(3 * likeTip(2));
    expect(takeLikes(shop(), 500)!.money).toBe(LIKES_MAX * likeTip(2));
  });

  it('в снимке магазина — арендаторы и грядки; у гостя грядки всегда в росте', () => {
    const state = shop({ level: 5, tenants: ['toys', 'barber'], tenantUp: { toys: 1 }, garden: { since: 1, harvests: 4, more: [{ crop: 'apples', since: 1 }] } });
    const snap = shopSnapshot(state);
    expect(snap.tenants).toEqual(['toys+', 'barber']);
    expect(snap.beds).toEqual(['mix', 'apples']);
    const guest = friendState(JSON.parse(JSON.stringify(snap)), shop())!;
    expect(tenantsOf(guest)).toEqual(['toys', 'barber']);
    expect(tenantTier(guest, 'toys')).toBe(2);
    expect(tenantTier(guest, 'barber')).toBe(1);
    expect(bedsOf(guest)).toEqual([{ crop: 'mix', since: GUEST_GARDEN }, { crop: 'apples', since: GUEST_GARDEN }]);
    expect(gardenRipe(guest, Date.now())).toBe(false);
    // Чужой мусор в снимке не проходит.
    const junk = friendState({ ...snap, tenants: ['casino', 'atm+', 7], beds: ['weed', 'quick'] }, shop())!;
    expect(tenantsOf(junk)).toEqual(['atm']);
    expect(bedsOf(junk)).toEqual([{ crop: 'quick', since: GUEST_GARDEN }]);
  });
});

describe('район: бот напоминает про урожай', () => {
  const now = Date.UTC(2026, 10, 10, 9, 0, 0);
  const player = (over: Partial<Player> = {}): Player => ({ id: 1, lang: 'ru', tz: 180, sonya: 0, spoil: 0, streak: 0, gift: '', cashier: 0, day: 12, reason: null, helper: null, ...over });

  it('игра сообщает, когда поспеет ближайшая грядка', () => {
    const state = { ...newGame(), day: 5, garden: { since: now, harvests: 0, more: [{ crop: 'quick' as const, since: now }] } };
    expect(comebackHooks(state).ripe).toBe(Math.round((now + 2 * 3600_000) / 1000));
    expect(comebackHooks(newGame()).ripe).toBe(0);
  });

  it('урожай созрел — бабушка зовёт собрать; ещё растёт или двора нет — молчит', () => {
    const ripe = pickReminder(player({ ripe: Math.round(now / 1000) - 60 }), now, DEFAULT_EVENTS);
    expect(ripe.reason).toBe('garden');
    expect(ripe.text).toBe(TEXTS.ru.garden);
    expect(pickReminder(player({ ripe: Math.round(now / 1000) + 3600 }), now, DEFAULT_EVENTS).reason).not.toBe('garden');
    expect(pickReminder(player({ ripe: 0 }), now, DEFAULT_EVENTS).reason).not.toBe('garden');
    // В прошлый раз писали про урожай — теперь о другом, а урожай — припиской «Ещё ждут».
    const again = pickReminder(player({ ripe: Math.round(now / 1000) - 60, reason: 'garden' }), now, DEFAULT_EVENTS);
    expect(again.reason).not.toBe('garden');
    expect(again.text).toContain(TEXTS.ru['also.garden']);
    for (const lang of Object.keys(TEXTS) as (keyof typeof TEXTS)[]) {
      expect(TEXTS[lang].garden, lang).toBeTruthy();
      expect(TEXTS[lang]['also.garden'], lang).toBeTruthy();
    }
  });
});

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
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: `Игрок${id}` }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const post = async (id: number, extra: Record<string, unknown> = {}) =>
  new Request('https://x/api', { method: 'POST', body: JSON.stringify({ initData: await initData(id), lang: 'ru', ...extra }) });
const json = async <T>(r: Response | Promise<Response>) => (await (await r).json()) as T;

beforeEach(() => {
  vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify({ ok: true, result: url.endsWith('/getMe') ? { username: 'magazinchik_bot' } : {} })));
});
afterEach(() => vi.unstubAllGlobals());

type Day = { enabled: boolean; shop: { id: number; name: string; shop?: string } | null; liked: boolean; likes: number; waters: number; goal: { week: number; total: number; target: number; left: number; mine: boolean }; last?: { week: number } };

describe.skipIf(!Database)('район (сервер)', () => {
  const play = async (env: Env, id: number, extra: Record<string, unknown> = {}) =>
    progress(await post(id, { level: 2, day: 20, revenue: 100, shop: { day: 20, level: 2, rating: 4.5, shopName: `Лавка ${id}`, shelves: [] }, ...extra }), env);

  it('магазин дня — один на всех, хозяину показывают другого; отметка — раз в день, хозяин узнаёт о ней один раз', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    for (const id of [1, 2, 3]) await play(env, id);
    resetDayShops(env.DB!);
    const now = Date.now();
    const first = (await dayShopFor(env.DB!, 0, now))!;
    const others = [1, 2, 3].filter((id) => id !== first.id);
    const seen = await json<Day>(town(await post(others[0], { action: 'day' }), env));
    expect(seen.enabled).toBe(true);
    expect(seen.shop?.id).toBe(first.id);
    expect(seen.shop?.shop).toBe(`Лавка ${first.id}`);
    expect((await json<Day>(town(await post(others[1], { action: 'day' }), env))).shop?.id).toBe(first.id);
    // Хозяину магазина дня показывают следующего по жребию — не его самого.
    const own = await json<Day>(town(await post(first.id, { action: 'day' }), env));
    expect(own.shop?.id).not.toBe(first.id);
    expect(own.shop).not.toBeNull();
    // Снимок — того же магазина.
    const snap = await json<{ shop: { shopName: string } | null; name: string }>(town(await post(others[0], { action: 'shop' }), env));
    expect(snap.shop?.shopName).toBe(`Лавка ${first.id}`);
    // Отметка: одна в день от игрока.
    expect(await json<{ ok: boolean }>(town(await post(others[0], { action: 'like' }), env))).toEqual({ ok: true });
    expect(await json<{ ok: boolean }>(town(await post(others[0], { action: 'like' }), env))).toEqual({ ok: false });
    expect(await json<{ ok: boolean }>(town(await post(others[1], { action: 'like' }), env))).toEqual({ ok: true });
    expect((await json<Day>(town(await post(others[0], { action: 'day' }), env))).liked).toBe(true);
    expect((await json<Day>(town(await post(first.id, { action: 'day' }), env))).likes).toBe(2);
    expect((await json<Day>(town(await post(first.id, { action: 'day' }), env))).likes).toBe(0);
  });

  it('некого показывать — магазина дня нет, остальное работает', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await play(env, 1);
    resetDayShops(env.DB!);
    const alone = await json<Day>(town(await post(1, { action: 'day' }), env));
    expect(alone.shop).toBeNull();
    expect(alone.goal.target).toBe(GOAL_BASE + GOAL_PER_SHOP);
    expect(await json<{ ok: boolean }>(town(await post(1, { action: 'like' }), env))).toEqual({ ok: false });
    expect(await json<{ enabled: boolean }>(town(await post(1, { action: 'day' }), {}))).toEqual({ enabled: false });
  });

  it('полить теплицу можно только другу и раз в день; поливы отдаются тому, у кого теплица, один раз', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    await socialPing(await post(1), env);
    await recordReferral(env, 2, 'ref_1');
    for (const id of [1, 2, 3]) await play(env, id);
    expect(await json<{ ok: boolean }>(town(await post(1, { action: 'water', to: 3 }), env))).toEqual({ ok: false });
    expect(await json<{ ok: boolean }>(town(await post(1, { action: 'water', to: 2 }), env))).toEqual({ ok: true });
    expect(await json<{ ok: boolean }>(town(await post(1, { action: 'water', to: 2 }), env))).toEqual({ ok: false });
    // Без теплицы полив ждёт; с теплицей — приходит и списывается.
    expect((await json<Day>(town(await post(2, { action: 'day' }), env))).waters).toBe(0);
    expect((await json<Day>(town(await post(2, { action: 'day', garden: true }), env))).waters).toBe(1);
    expect((await json<Day>(town(await post(2, { action: 'day', garden: true }), env))).waters).toBe(0);
  });

  it('цель недели: выручка всех магазинов плюс соседи; цель растёт с числом магазинов', async () => {
    const env: Env = { BOT_TOKEN: TOKEN, DB: d1() };
    for (const id of [1, 2]) await play(env, id);
    const now = Date.now();
    const week = serverWeek(now);
    const goal = await goalOf(env.DB!, 1, week, now);
    expect(goal.target).toBe(GOAL_BASE + 2 * GOAL_PER_SHOP);
    expect(goal.mine).toBe(true);
    expect((await goalOf(env.DB!, 9, week, now)).mine).toBe(false);
    expect(goal.total).toBeGreaterThanOrEqual(goalNeighbours((now - (week * 7 - 3) * DAY) / (7 * DAY)));
    expect(goal.left).toBeGreaterThanOrEqual(1);
    expect(goal.left).toBeLessThanOrEqual(7);
    // Прошлая неделя закончилась: соседи внесли всё своё, дней не осталось.
    const last = await goalOf(env.DB!, 1, week - 1, now);
    expect(last.left).toBe(0);
    expect(last.total).toBe(goalNeighbours(1));
    expect(last.mine).toBe(false);
  });
});
