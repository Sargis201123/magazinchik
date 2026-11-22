import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { checkout, DAY_SECONDS, emptyDayStats, monthOf, newGame, onShelves, sellableProducts, shelfFor, STORE_LEVELS, type ProductId, type StoreState } from '../src/game/economy';
import {
  autoCapacity,
  CREDIT_DEBT,
  CREDIT_MAX,
  flowArrive,
  flowJoin,
  flowNext,
  flowTick,
  flowUsed,
  newFlow,
  QUICK_PATIENCE,
  quickPick,
  serveCapacity,
  type Flow,
} from '../src/game/traffic';
import { nightCycle, otherIncome, type NightSummary } from '../src/game/day';
import { rentRoom, tenantIncome, tenantRent, tenantsNight } from '../src/game/tenants';
import { adGuests, adYesterday, grantAd, passedYesterday } from '../src/game/ads';
import { hallQueueLost, lossAdvice, noteLost, queueAdviceKey } from '../src/game/losses';
import { progressWeekly } from '../src/game/weekly';
import { rushOutcome } from '../src/game/rushHour';
import { addReport } from '../src/game/reports';
import { simulate } from '../src/game/simulate';
import { rng } from '../src/game/random';

// Поток гостей сверх зала (traffic.ts, 21.11): зал полон — гость берёт своё «на бегу» у касс без хозяина; пробивают
// не больше, чем кассы успевают; аренда и прочие доходы видны каждый день; реклама показывает, сколько привела.

const features = { tenants: true, garden: true, apprentice: true, rental: true };
/** Настоящий магазин из симулятора: «Минимаркет» с кассирами, полки разложены. */
let shop: StoreState;
beforeAll(() => {
  shop = simulate({ days: 25, seed: 1, features }).final;
});

const flow = (rate: number): Flow => ({ rate, carts: [], credit: 0, came: 0, served: 0, lost: 0, queue: 0, revenue: 0 });
/** Корзина в одну штуку — для проверки очереди (товар тут не важен). */
const cart = () => [{ id: 'bread' as ProductId, unit: { age: 0 } as never }];
/** Гость пришёл и набрал корзину. */
const come = (f: Flow) => flowArrive(f) && flowJoin(f, { state: shop, cart: cart() });

describe('кассы: сколько успевают', () => {
  it('без кассиров и киосков потока сверх зала нет — гостей пробивает сам хозяин касаниями', () => {
    const solo = { ...newGame(), level: 0 };
    expect(serveCapacity(solo).owner).toBe(serveCapacity(solo).total);
    expect(autoCapacity(solo)).toBe(0);
    expect(newFlow(solo).rate).toBe(0);
    expect(flowArrive(newFlow(solo))).toBe(false);
  });

  it('с кассирами — поток есть, и он не больше того, что кассы пробивают за день', () => {
    const cap = serveCapacity(shop);
    expect(cap.owner).toBe(0);
    expect(autoCapacity(shop)).toBeGreaterThan(0);
    expect(newFlow(shop).rate * DAY_SECONDS).toBeCloseTo(autoCapacity(shop), 5);
  });

  it('предел зала вырос на одного на каждом помещении до гипермаркета, у гипермаркета — как был', () => {
    expect(STORE_LEVELS.map((l) => l.maxCustomers)).toEqual([6, 8, 10, 12, 14, 20]);
  });
});

describe('поток сверх зала', () => {
  it('за день пробивают не больше, чем кассы успевают: лишние уходят из очереди, оставив корзины', () => {
    const f = flow(1);
    let served = 0;
    let returned = 0;
    // Приходят по трое в секунду, кассы — по одному: 90 секунд.
    for (let s = 0; s < 90 * 10; s++) {
      if (s % 10 === 0) for (let k = 0; k < 3; k++) come(f);
      returned += flowTick(f, 0.1).length;
      while (flowNext(f)) served++;
    }
    expect(f.came).toBe(270);
    expect(served).toBeLessThanOrEqual(90 + CREDIT_MAX);
    expect(served).toBeGreaterThanOrEqual(85);
    expect(f.queue).toBe(returned);
    expect(f.lost).toBe(returned);
    expect(f.carts.length).toBeLessThanOrEqual(Math.ceil(QUICK_PATIENCE));
    expect(f.came).toBe(served + f.lost + f.carts.length);
  });

  it('ничего не набрал — в очередь не встаёт; ушёл с причиной — считается ушедшим', () => {
    const f = flow(1);
    flowArrive(f);
    flowJoin(f, { state: shop, cart: [] });
    expect(f.carts).toHaveLength(0);
    expect(f.lost).toBe(0);
    flowArrive(f);
    flowJoin(f, { state: shop, cart: [], why: 'empty', id: 'milk' });
    expect(f.lost).toBe(1);
    expect(f.queue).toBe(0);
  });

  it('гости зала у автоматических касс занимают их время: потоку остаётся только свободное', () => {
    const f = flow(1);
    flowTick(f, 1);
    flowUsed(f);
    come(f);
    expect(flowNext(f)).toBeNull();
    // В долг больше CREDIT_DEBT не уходит, впрок больше CREDIT_MAX не копит.
    for (let i = 0; i < 10; i++) flowUsed(f);
    expect(f.credit).toBe(-CREDIT_DEBT);
    flowTick(f, 100);
    expect(f.credit).toBe(CREDIT_MAX);
  });

  it('пустой поток ничего не делает', () => {
    const f = flow(0);
    expect(flowTick(f, 10)).toEqual([]);
    flowUsed(f);
    expect(f.credit).toBe(0);
  });
});

describe('покупка «на бегу»', () => {
  it('товар уходит с полки сразу, деньги — у кассы; одинаковый случай — одинаковый итог', () => {
    const id = sellableProducts(shop).find((p) => onShelves(shop, p) > 0)!;
    const a = quickPick(shop, [id], () => 0);
    const b = quickPick(shop, [id], () => 0);
    expect(a.cart).toHaveLength(1);
    expect(a.why).toBeUndefined();
    expect(a.state.money).toBe(shop.money);
    expect(onShelves(a.state, id)).toBe(onShelves(shop, id) - 1);
    expect(b).toEqual(a);
    const paid = checkout(a.state, a.cart);
    expect(paid.total).toBeGreaterThan(0);
    expect(paid.state.money).toBe(shop.money + paid.total);
  });

  it('пустая полка — ушёл ни с чем, причина «не нашли товар»', () => {
    const id = sellableProducts(shop).find((p) => shelfFor(shop, p) >= 0)!;
    const index = shelfFor(shop, id);
    const shelves = shop.shelves.map((sh, i) => (i === index ? { ...sh, items: { ...sh.items, [id]: [] } } : sh));
    const empty = { ...shop, shelves };
    const r = quickPick(empty, [id], () => 0);
    expect(r.cart).toHaveLength(0);
    expect(r.why).toBe('empty');
    expect(r.id).toBe(id);
    expect(r.state).toEqual(empty);
  });

  it('слишком дорого — уходит, ничего не взяв', () => {
    const id = sellableProducts(shop).find((p) => onShelves(shop, p) > 0)! as ProductId;
    const dear = { ...shop, prices: { ...shop.prices, [id]: shop.prices[id] * 20 } };
    const r = quickPick(dear, [id], () => 0.999);
    expect(r.cart).toHaveLength(0);
    expect(r.why).toBe('expensive');
  });

  it('много гостей подряд — полки пустеют по-настоящему, и тогда начинают уходить ни с чем', () => {
    let s = shop;
    const random = rng(7);
    let served = 0;
    let empty = 0;
    const ids = sellableProducts(shop);
    for (let g = 0; g < 2000; g++) {
      const r = quickPick(s, [ids[g % ids.length]], random);
      s = r.state;
      if (r.cart.length) served++;
      if (r.why === 'empty') empty++;
    }
    expect(served).toBeGreaterThan(0);
    expect(empty).toBeGreaterThan(0);
    expect(ids.reduce((sum, p) => sum + onShelves(s, p), 0)).toBeLessThan(ids.reduce((sum, p) => sum + onShelves(shop, p), 0));
  });
});

describe('аренда и прочие доходы — каждый день', () => {
  it('арендаторы платят каждый вечер: «вчера» и «всего» копятся', () => {
    const s0 = rentRoom({ ...newGame(), level: 2, day: 30, money: 50_000 }, 'pickup')!;
    const n1 = tenantsNight(s0);
    expect(n1.income).toBe(tenantRent(s0));
    expect(tenantIncome({ ...n1.state, day: 31 })).toEqual({ last: n1.income, total: n1.income });
    const n2 = tenantsNight({ ...n1.state, day: 31 });
    expect(tenantIncome({ ...n2.state, day: 32 })).toEqual({ last: n2.income, total: n1.income + n2.income });
    // Позавчерашняя запись — не «вчера».
    expect(tenantIncome({ ...n2.state, day: 40 })).toBeNull();
  });

  it('старое сохранение без журнала аренды: «вчера» нет, первая аренда начинает счёт', () => {
    const old = rentRoom({ ...newGame(), level: 2, day: 30, money: 50_000 }, 'atm')!;
    expect(old.tenantLog).toBeUndefined();
    expect(tenantIncome(old)).toBeNull();
    expect(tenantsNight(old).state.tenantLog).toEqual({ day: 30, last: tenantRent(old), total: tenantRent(old) });
  });

  it('итоги дня показывают аренду строкой «Прочие доходы» — каждый вечер, а не под «Подробнее»', () => {
    const s0 = rentRoom({ ...shop, money: Math.max(shop.money, 50_000) }, 'pharmacy') ?? shop;
    const night = nightCycle(s0, emptyDayStats(), rng(1));
    const rows = otherIncome(night);
    expect(rows.find((r) => r.id === 'rent')?.n).toBe(night.rent);
    expect(night.rent).toBeGreaterThan(0);
    expect(rows.every((r) => r.n !== 0)).toBe(true);
  });

  it('облава в подвале и плата продавцу этажа — с минусом, пустые строки не показываются', () => {
    const base = { rent: 0, estate: 0, branch: 0, home: 0, cart: 0, van: null, rental: null, food: null } as unknown as NightSummary;
    expect(otherIncome(base)).toEqual([]);
    const raid = { ...base, slots: { players: 3, income: 0, share: 0, raid: { fine: 500, n: 1 } }, clothes: { income: 100, wage: 150 } } as unknown as NightSummary;
    expect(otherIncome(raid)).toEqual([
      { id: 'slots', n: -500 },
      { id: 'clothes', n: -50 },
    ]);
  });
});

describe('реклама: обещание и правда', () => {
  it('приведённых считают от всех, кто зашёл, и запоминают в отчёте дня — утром карточка показывает «вчера»', () => {
    const s0 = grantAd({ ...shop, day: shop.day }, 'blogger');
    const stats = { ...emptyDayStats(), served: 80, lost: 10, came: 140 };
    stats.adGuests = adGuests(s0, stats.came);
    expect(stats.adGuests).toBe(Math.round(140 * (1 - 1 / 1.4)));
    const reported = addReport(s0, s0.day, stats, {});
    expect(reported.reports!.at(-1)).toMatchObject({ came: 140, ads: stats.adGuests });
    expect(adYesterday({ ...reported, day: s0.day + 1 })).toBe(stats.adGuests);
    expect(adYesterday({ ...reported, day: s0.day + 2 })).toBeNull();
  });

  it('без рекламы — ничего не выдумываем', () => {
    const stats = { ...emptyDayStats(), served: 50, came: 70 };
    const reported = addReport(shop, shop.day, stats, {});
    expect(reported.reports!.at(-1)!.ads).toBeUndefined();
    expect(adYesterday({ ...reported, day: shop.day + 1 })).toBeNull();
  });
});

describe('разбор 21.11: очередь «на бегу» и тесный зал', () => {
  it('ушедшие из очереди «на бегу» — в итогах и рейтинге, но не в часе пик и не в испытании «без очереди»', () => {
    const stats = { ...emptyDayStats(), served: 40, lost: 3 };
    for (let i = 0; i < 3; i++) {
      noteLost(stats, 'queue');
      stats.quickQueue = (stats.quickQueue ?? 0) + 1;
    }
    expect(stats.lostWhy?.queue).toBe(3);
    expect(hallQueueLost(stats)).toBe(0);
    expect(rushOutcome(10, hallQueueLost(stats), 3).kind).toBe('clean');
    // Совет в итогах остаётся: кассы не успевают — кассир или киоск.
    expect(lossAdvice(stats, shop)[0]).toMatchObject({ reason: 'queue', count: 3, key: queueAdviceKey(shop) });
    const weekly = { month: monthOf(shop.day), challenges: [{ kind: 'noQueue' as const, target: 3, progress: 0, reward: 50 }] };
    const s = { ...shop, weekly } as StoreState;
    expect((progressWeekly(s, stats).state.weekly!.challenges[0] as { progress: number }).progress).toBe(1);
    // А ушедший из очереди зала — по-прежнему портит и то и другое.
    noteLost(stats, 'queue');
    expect(hallQueueLost(stats)).toBe(1);
    expect((progressWeekly(s, stats).state.weekly!.challenges[0] as { progress: number }).progress).toBe(0);
  });

  it('прошедшие мимо (зал полон, хозяин один) — реклама честно не приписывает их себе', () => {
    const s0 = grantAd({ ...shop, day: shop.day }, 'blogger');
    // Без прошедших — как было.
    expect(adGuests(s0, 30)).toBe(Math.round(30 * (1 - 1 / 1.4)));
    expect(adGuests(s0, 30, 0)).toBe(adGuests(s0, 30));
    // Зал пропустил 30, ещё 30 прошли мимо: без рекламы шло бы ~43 — 30 и так поместились бы, реклама не прибавила.
    expect(adGuests(s0, 30, 30)).toBe(0);
    // Немного прошли мимо — реклама прибавила, но меньше, чем «доля от зашедших».
    expect(adGuests(s0, 30, 5)).toBeLessThan(adGuests(s0, 30));
    expect(adGuests(s0, 30, 5)).toBeGreaterThan(0);
    const stats = { ...emptyDayStats(), served: 20, came: 30, passed: 30 };
    const reported = addReport(s0, s0.day, stats, {});
    expect(reported.reports!.at(-1)!.passed).toBe(30);
    expect(passedYesterday({ ...reported, day: s0.day + 1 })).toBe(30);
    expect(passedYesterday({ ...reported, day: s0.day + 2 })).toBe(0);
    expect(passedYesterday(addReport(s0, s0.day, { ...emptyDayStats(), served: 5 }, {}))).toBe(0);
  });
});

describe('сохранения', () => {
  let local: Record<string, string> = {};
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение без новых полей грузится как было', async () => {
    local = {};
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
    const { loadGame } = await import('../src/game/save');
    const old = { ...shop } as Record<string, unknown>;
    delete old.tenantLog;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(s.day).toBe(shop.day);
    expect(s.money).toBe(shop.money);
    expect(s.tenantLog).toBeUndefined();
    expect(newFlow(s).rate).toBeCloseTo(newFlow(shop).rate, 5);
  });
});

describe('21.11: гости «на бегу», не дождавшиеся кассы, роняют рейтинг слабо', async () => {
  const { satisfaction, QUICK_FORGIVE } = await import('../src/game/economy');
  it('ушедшие из невидимой очереди весят четверть от ушедших из зала', () => {
    const hall = { ...emptyDayStats(), served: 200, lost: 400, lostWhy: { queue: 400 } } as ReturnType<typeof emptyDayStats>;
    const quick = { ...hall, quickQueue: 400 } as ReturnType<typeof emptyDayStats>;
    expect(satisfaction(quick)).toBeGreaterThan(satisfaction(hall));
    expect(satisfaction(quick)).toBeCloseTo(200 / (200 + 400 * QUICK_FORGIVE), 5);
  });
  it('без quickQueue — как раньше', () => {
    const s = { ...emptyDayStats(), served: 50, lost: 10 } as ReturnType<typeof emptyDayStats>;
    expect(satisfaction(s)).toBeCloseTo(50 / 60, 5);
  });
});
