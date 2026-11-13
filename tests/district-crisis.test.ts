import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, PRODUCTS, type ProductId, type Shelf, type StoreState, type Unit } from '../src/game/economy';
import {
  chooseCrisis,
  CRISES,
  CRISIS_DEMAND,
  CRISIS_FROM,
  CRISIS_GAP,
  CRISIS_TOLERANCE,
  crisisAsk,
  crisisDemand,
  crisisGive,
  crisisMorning,
  crisisNews,
  crisisNight,
  crisisStarts,
  crisisToday,
  crisisTolerance,
  DAY_GOODWILL,
  END_GOODWILL,
  giveUnits,
  gougePrice,
  kindsFor,
  seeCrisisEnd,
  weatherToday,
  type CrisisState,
} from '../src/game/crisis';
import { addGoodwill, fadeGoodwill, goodwillGrudge, goodwillGuests, goodwillOf, goodwillReview, goodwillTips, GOODWILL_MAX } from '../src/game/goodwill';
import { bigDayFor, setBigDaySeed } from '../src/game/bigday';
import { yearTime } from '../src/game/calendar';
import { weatherFor } from '../src/game/weather';
import { dayDemand } from '../src/game/demand';
import { guestFactor, nightCycle } from '../src/game/day';
import { recordVisit, regularState } from '../src/game/regulars';
import { reviewsFor } from '../src/game/reviews';
import { pickNews } from '../src/game/headlines';
import { pendingTip } from '../src/game/tips';
import { simulate } from '../src/game/simulate';

// Беда района (crisis.ts) и доброе имя района (goodwill.ts): когда начинается, что меняет в спросе и ценах,
// сколько стоит раздача, как район судит по ценникам и что помнит потом; старые сохранения — без изменений.

const units = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));
const SHELVES: Shelf[] = [
  { kind: 'bakery', level: 1, items: { bread: units(6) } },
  { kind: 'produce', level: 1, items: { potatoes: units(6), apples: units(4) } },
  { kind: 'dairy', level: 1, items: { milk: units(6) } },
  { kind: 'drinks', level: 1, items: { water: units(6), juice: units(4) } },
  { kind: 'icebox', level: 0, items: { icecream: units(4) } },
  { kind: 'florist', level: 0, items: {} },
];
const shop = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  tourDone: true,
  level: 2,
  money: 5000,
  debt: 0,
  seed: 4242,
  day: 60,
  shelves: SHELVES,
  warehouse: { water: units(5), bread: units(5), potatoes: units(5), milk: units(3) },
  ...over,
});
const crisis = (over: Partial<CrisisState> = {}): CrisisState => ({ kind: 'flood', from: 60, days: 3, ...over });
const inCrisis = (over: Partial<CrisisState> = {}, state: Partial<StoreState> = {}): StoreState => shop({ crisis: crisis(over), ...state });

beforeAll(() => setBigDaySeed(4242));

/** Первые дни, когда в этом магазине начинается беда (с учётом паузы после прошлой — без неё). */
const starts = (s: StoreState, from: number, to: number): number[] => {
  const out: number[] = [];
  for (let day = from; day < to; day++) if (crisisStarts({ ...s, day })) out.push(day);
  return out;
};

describe('когда приходит беда', () => {
  it('только от зерна магазина и дня: тот же магазин — те же дни; другой — другие', () => {
    const a = starts(shop(), CRISIS_FROM, 600);
    expect(a.length).toBeGreaterThan(2);
    expect(starts(shop(), CRISIS_FROM, 600)).toEqual(a);
    expect(starts(shop({ seed: 777 }), CRISIS_FROM, 600)).not.toEqual(a);
    const c = crisisStarts(shop({ day: a[0] }))!;
    expect(crisisStarts(shop({ day: a[0] }))).toEqual(c);
    expect(c.from).toBe(a[0]);
    expect([3, 4]).toContain(c.days);
  });

  it('редко: не больше одной беды на месяц игры в среднем', () => {
    const days = starts(shop(), CRISIS_FROM, CRISIS_FROM + 700);
    expect(days.length).toBeLessThan(700 / 25);
  });

  it('не в обучении, не в особые дни, не в Заречье и не сразу после прошлой', () => {
    expect(starts(shop(), 1, CRISIS_FROM)).toEqual([]);
    for (const day of starts(shop(), CRISIS_FROM, 600)) {
      const c = crisisStarts(shop({ day }))!;
      for (let d = 0; d < c.days; d++) expect(bigDayFor(day + d)).toBeNull();
      expect(kindsFor(day)).toContain(c.kind);
      expect(crisisStarts(shop({ day, zar: { at: 'zar' } as StoreState['zar'] }))).toBeNull();
      expect(crisisStarts(shop({ day, crisisEnd: { kind: 'heat', mode: 'hold', given: 0, sold: 0, delta: 0, day: day - CRISIS_GAP + 1 } }))).toBeNull();
      expect(crisisStarts(shop({ day, crisisEnd: { kind: 'heat', mode: 'hold', given: 0, sold: 0, delta: 0, day: day - CRISIS_GAP } }))).not.toBeNull();
      // Идёт другая — новая не начинается.
      expect(crisisStarts(shop({ day, crisis: crisis({ from: day - 1 }) }))).toBeNull();
    }
  });

  it('по времени года: жара — летом, буран — зимой; беда с товарами, которых нет на полках, не приходит', () => {
    const summer = Array.from({ length: 200 }, (_, i) => 30 + i).find((d) => yearTime(d) === 'summer')!;
    const winter = Array.from({ length: 200 }, (_, i) => 20 + i).find((d) => yearTime(d) === 'winter')!;
    expect(kindsFor(summer)).toContain('heat');
    expect(kindsFor(summer)).not.toContain('blizzard');
    expect(kindsFor(winter)).toContain('blizzard');
    expect(kindsFor(winter)).not.toContain('heat');
    // Ларёк: только хлеб и овощи — воды нет, значит ни жары, ни «нет воды».
    const kiosk = { ...shop(), level: 0, shelves: newGame().shelves, warehouse: {} };
    for (const day of starts(kiosk, CRISIS_FROM, 900)) expect(['blizzard', 'flood']).toContain(crisisStarts({ ...kiosk, day })!.kind);
  });
});

describe('дни беды: спрос, цены, погода', () => {
  it('товары первой нужды — втрое чаще, за них готовы платить больше; остальное — как было', () => {
    // «Нет воды» — без своей погоды: разница с обычным днём только от беды.
    const s = inCrisis({ kind: 'water' });
    const calm = shop();
    for (const id of CRISES.water.staples) {
      expect(crisisDemand(s, id)).toBe(CRISIS_DEMAND);
      expect(crisisTolerance(s, id)).toBe(CRISIS_TOLERANCE);
      expect(dayDemand(s, id) / dayDemand(calm, id)).toBeCloseTo(CRISIS_DEMAND);
    }
    expect(crisisDemand(s, 'apples')).toBe(1);
    expect(crisisTolerance(s, 'apples')).toBe(1);
    expect(dayDemand(s, 'apples')).toBeCloseTo(dayDemand(calm, 'apples'));
    expect(guestFactor(s)).toBeGreaterThan(guestFactor(calm));
  });

  it('на улице — погода беды: паводок — ливень, буран — снег; когда кончилась — снова прогноз', () => {
    expect(weatherToday(inCrisis())).toBe('rain');
    expect(weatherToday(inCrisis({ kind: 'blizzard' }))).toBe('snow');
    expect(weatherToday(inCrisis({ kind: 'heat' }))).toBe('heat');
    expect(weatherToday(inCrisis({ kind: 'water' }))).toBe(weatherFor(60));
    expect(weatherToday(inCrisis({}, { day: 63 }))).toBe(weatherFor(63));
    expect(crisisToday(inCrisis({}, { day: 63 }))).toBeNull();
    expect(crisisToday(inCrisis({}, { zar: { at: 'zar' } as StoreState['zar'] }))).toBeNull();
  });

  it('утром спрашивают один раз; «поднять цены» переписывает ценники нужного', () => {
    const s = inCrisis();
    expect(crisisAsk(s)).toBe(true);
    const gouged = chooseCrisis(s, 'gouge')!;
    expect(crisisAsk(gouged)).toBe(false);
    expect(chooseCrisis(gouged, 'hold')).toBeNull();
    for (const id of CRISES.flood.staples) {
      expect(gouged.prices[id]).toBe(gougePrice(id, s.prices[id]));
      expect(gouged.prices[id]).toBeGreaterThan(PRODUCTS[id].basePrice * 1.4);
      expect(gouged.crisis!.was![id]).toBe(s.prices[id]);
    }
    expect(gouged.prices.apples).toBe(s.prices.apples);
    const held = chooseCrisis(s, 'hold')!;
    expect(held.prices).toEqual(s.prices);
    expect(chooseCrisis(shop(), 'hold')).toBeNull();
  });
});

describe('раздать старикам', () => {
  it('к открытию — понемногу каждого нужного, сначала со склада; раз в день; деньги — себестоимостью товара', () => {
    const s = chooseCrisis(inCrisis(), 'give')!;
    const { state, given } = crisisGive(s);
    expect(given).toHaveLength(giveUnits(s.level));
    expect(new Set(given)).toEqual(new Set(CRISES.flood.staples));
    // Склад худеет, полки — нет.
    const count = (x: StoreState, id: ProductId) => (x.warehouse[id]?.length ?? 0);
    expect(given.every((id) => count(state, id) < count(s, id))).toBe(true);
    expect(state.shelves).toEqual(s.shelves);
    expect(state.money).toBe(s.money);
    expect(state.crisis!.given).toBe(given.length);
    expect(state.crisis!.givenCost).toBe(given.reduce((sum, id) => sum + PRODUCTS[id].cost, 0));
    expect(crisisGive(state).given).toEqual([]);
  });

  it('склад пуст — берут с полок; ничего нет — ничего не раздали; брак не раздают', () => {
    const empty = chooseCrisis(inCrisis({}, { warehouse: { water: [{ age: 0, bad: true, pending: true }] } }), 'give')!;
    const fromShelves = crisisGive(empty);
    expect(fromShelves.given.length).toBe(giveUnits(empty.level));
    expect(fromShelves.state.warehouse.water).toHaveLength(1);
    const bare = chooseCrisis(inCrisis({}, { warehouse: {}, shelves: SHELVES.map((sh) => ({ ...sh, items: {} })) }), 'give')!;
    expect(crisisGive(bare)).toEqual({ state: bare, given: [] });
    // Не выбрали «раздавать» — не раздают.
    expect(crisisGive(chooseCrisis(inCrisis(), 'hold')!).given).toEqual([]);
  });
});

describe('район судит по ценникам', () => {
  const stats = () => ({ ...emptyDayStats(), sold: { water: 7, bread: 5, apples: 9 } });

  it('держал цены — +1, раздавал — больше, поднял — минус; поднял руками без выбора — тоже нажился', () => {
    const held = crisisNight(chooseCrisis(inCrisis(), 'hold')!, stats());
    expect(goodwillOf(held)).toBe(DAY_GOODWILL.hold);
    expect(held.crisis!.sold).toBe(12);
    const gave = crisisNight(crisisGive(chooseCrisis(inCrisis(), 'give')!).state, stats());
    expect(goodwillOf(gave)).toBe(DAY_GOODWILL.give);
    const gouged = crisisNight(chooseCrisis(inCrisis(), 'gouge')!, stats());
    expect(goodwillOf(gouged)).toBe(DAY_GOODWILL.gouge);
    const sly = inCrisis({ mode: 'hold' });
    const raised = { ...sly, prices: { ...sly.prices, water: 40, bread: 60, potatoes: 30 } };
    expect(goodwillOf(crisisNight(raised, stats()))).toBe(DAY_GOODWILL.gouge);
    // Не день беды — ничего.
    expect(crisisNight(shop(), stats())).toEqual(shop());
  });

  it('беда кончилась: итог в новость, цены назад, постоянные помнят, пауза до следующей', () => {
    let s = chooseCrisis(inCrisis({}, { regulars: { petr: { loyalty: 3, awayUntil: 0 } } }), 'gouge')!;
    s = { ...s, prices: { ...s.prices, potatoes: 35 } };
    for (let d = 0; d < 3; d++) s = { ...crisisNight(s, stats()), day: s.day + 1 };
    const morning = crisisMorning(s);
    expect(morning.crisis).toBeUndefined();
    const end = crisisNews(morning)!;
    expect(end.mode).toBe('gouge');
    expect(end.delta).toBe(3 * DAY_GOODWILL.gouge + END_GOODWILL.gouge);
    expect(goodwillOf(morning)).toBe(3 * DAY_GOODWILL.gouge + END_GOODWILL.gouge + 1);
    // Ценники «поднять» вернулись; свою цену игрока (картошка 35) не трогаем.
    expect(morning.prices.water).toBe(shop().prices.water);
    expect(morning.prices.bread).toBe(shop().prices.bread);
    expect(morning.prices.potatoes).toBe(35);
    expect(regularState(morning, 'petr').loyalty).toBe(2);
    expect(crisisStarts({ ...morning, day: morning.day + 1 })).toBeNull();
    expect(crisisNews(seeCrisisEnd(morning))).toBeNull();
  });

  it('раздавал — доброе имя растёт, постоянные теплеют; простоял всю беду в Заречье — району нечего вспомнить', () => {
    let s = chooseCrisis(inCrisis({}, { regulars: { petr: { loyalty: 3, awayUntil: 0 } } }), 'give')!;
    for (let d = 0; d < 3; d++) {
      s = crisisGive(s).state;
      s = { ...crisisNight(s, stats()), day: s.day + 1 };
    }
    const end = crisisMorning(s);
    expect(crisisNews(end)!.mode).toBe('give');
    expect(crisisNews(end)!.given).toBe(3 * giveUnits(2));
    expect(goodwillOf(end)).toBe(3 * DAY_GOODWILL.give + END_GOODWILL.give - 1);
    expect(regularState(end, 'petr').loyalty).toBe(4);
    const away = crisisMorning(inCrisis({}, { day: 63 }));
    expect(away.crisis).toBeUndefined();
    expect(crisisNews(away)).toBeNull();
    expect(goodwillOf(away)).toBe(0);
  });
});

describe('доброе имя района', () => {
  it('от −100 до 100, понемногу забывается, ноль — поля нет', () => {
    expect(goodwillOf(newGame())).toBe(0);
    expect(goodwillOf(addGoodwill(newGame(), 500))).toBe(GOODWILL_MAX);
    expect(goodwillOf(addGoodwill(newGame(), -500))).toBe(-GOODWILL_MAX);
    const s = addGoodwill(newGame(), 2);
    expect(goodwillOf(fadeGoodwill(s))).toBe(1);
    expect('goodwill' in fadeGoodwill(fadeGoodwill(s))).toBe(false);
    expect(goodwillOf(fadeGoodwill(addGoodwill(newGame(), -3)))).toBe(-2);
    expect(fadeGoodwill(newGame())).toEqual(newGame());
  });

  it('гости, чаевые и терпение постоянных — от доброго имени', () => {
    const good = addGoodwill(shop(), 40);
    const bad = addGoodwill(shop(), -40);
    expect(goodwillGuests(good)).toBeGreaterThan(1);
    expect(goodwillGuests(bad)).toBeLessThan(1);
    expect(guestFactor(good)).toBeGreaterThan(guestFactor(shop()));
    expect(goodwillTips(good)).toBeGreaterThan(goodwillTips(bad));
    expect(goodwillTips(addGoodwill(shop(), -100))).toBe(0);
    expect([goodwillGrudge(good), goodwillGrudge(shop()), goodwillGrudge(bad)]).toEqual([1, 2, 3]);
    const base = { ...shop(), regulars: { petr: { loyalty: 3, awayUntil: 0 } } };
    expect(regularState(recordVisit(base, 'petr', false).state, 'petr').loyalty).toBe(1);
    expect(regularState(recordVisit(addGoodwill(base, 20), 'petr', false).state, 'petr').loyalty).toBe(2);
    expect(recordVisit(addGoodwill(base, -20), 'petr', false).result).toBe('left');
  });

  it('громкое имя вспоминают в отзывах; тихое — нет', () => {
    const topics = (g: number) => Array.from({ length: 40 }, (_, d) => reviewsFor(emptyDayStats(), 100 + d, g).map((r) => r.topic)).flat();
    expect(topics(0)).not.toContain('kind');
    expect(topics(0)).not.toContain('greedy');
    expect(topics(60)).toContain('kind');
    expect(topics(-60)).toContain('greedy');
    expect(topics(-60)).not.toContain('kind');
    expect(goodwillReview(10, 5)).toBeNull();
  });
});

describe('утро и новости', () => {
  it('итог беды — в очереди новостей утра раньше историй для души; первая беда — карточка «Новое!»', () => {
    const s = { ...shop(), crisisEnd: { kind: 'flood' as const, mode: 'give' as const, given: 6, sold: 30, delta: 20, day: 60 } };
    expect(pickNews(s, ['tale', 'crisis']).id).toBe('crisis');
    expect(pendingTip({ ...inCrisis(), seenTips: ['ownerTill'] })).toBe('crisis');
    expect(pendingTip({ ...shop(), seenTips: ['ownerTill'] })).not.toBe('crisis');
  });

  it('смена дня: вечером район судит, утром беда идёт дальше', () => {
    const s = chooseCrisis(inCrisis(), 'hold')!;
    const night = nightCycle(s, { ...emptyDayStats(), sold: { water: 3 } }, () => 0.5);
    expect(night.state.day).toBe(61);
    expect(night.state.crisis?.tally).toEqual({ gouge: 0, hold: 1, give: 0 });
    expect(crisisToday(night.state)).not.toBeNull();
  });
});

describe('старые сохранения', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('без беды и доброго имени грузятся как были; ночь и утро на них не падают', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 40, money: 999 } as Record<string, unknown>;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(s.crisis).toBeUndefined();
    expect(s.crisisEnd).toBeUndefined();
    expect(s.goodwill).toBeUndefined();
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.state.day).toBe(41);
    expect(goodwillOf(night.state)).toBe(0);
  });

  it('беда и доброе имя переживают сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const s = addGoodwill(chooseCrisis(inCrisis(), 'give')!, 12);
    saveGame(s);
    const back = loadGame()!;
    expect(back.crisis).toEqual(s.crisis);
    expect(back.goodwill).toBe(12);
  });
});

describe('симулятор', () => {
  it('нажиться — денег больше к концу беды; держать цены — доброе имя растёт', () => {
    const run = (mode: 'hold' | 'gouge') => {
      let first: CrisisState | undefined;
      let goodwillAfter = 0;
      const res = simulate({
        days: 92,
        seed: 2,
        features: { tenants: true, garden: true },
        crisis: mode,
        onMorning: (st) => {
          first ??= st.crisis;
          if (first && st.day === first.from + first.days) goodwillAfter = goodwillOf(st);
        },
      });
      return { res, first, goodwillAfter };
    };
    const hold = run('hold');
    const gouge = run('gouge');
    expect(hold.first).toBeDefined();
    const end = hold.first!.from + hold.first!.days;
    const money = (r: typeof hold, d: number) => r.res.days.find((x) => x.day === d)!.money;
    expect(money(gouge, end)).toBeGreaterThan(money(hold, end));
    expect(hold.goodwillAfter).toBeGreaterThan(0);
    expect(gouge.goodwillAfter).toBeLessThan(0);
  }, 60_000);
});
