import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPlace, newGame, onShelves, PRODUCT_IDS, PRODUCTS, restricted, sellableProducts, SHELF_KINDS, STORE_LEVELS, type StoreState } from '../src/game/economy';
import {
  answerTeen,
  buyLicense,
  COUNTER_LEVEL,
  eveningPull,
  hasLicense,
  inspectionToday,
  LICENSE_FINE,
  LICENSE_GUESTS,
  LICENSE_LEVEL,
  LICENSE_PRICE,
  licenseGuests,
  licenseLock,
  licenseNight,
  licenseNotice,
  licenseRate,
  seeLicenseNotice,
  TEEN_CANS,
  TEEN_CHANCE,
  teenToday,
} from '../src/game/license';
import { answerSpecial, makeSpecial, makeTeen } from '../src/game/special';
import { canStock, restockPlan } from '../src/game/restock';
import { priceFor, SUPPLIERS, unitPrice } from '../src/game/suppliers';
import { guestFactor, nightCycle } from '../src/game/day';
import { emptyDayStats } from '../src/game/economy';
import { questsFor } from '../src/game/endless';
import { weeklyFor } from '../src/game/weekly';
import { dealsToday } from '../src/game/deals';
import { makeCafeOffer } from '../src/game/cafe';
import { SHOP_KEYS } from '../src/game/zarechye';
import { simulate } from '../src/game/simulate';
// Сохранение для e2e — как его видит сборка (без node:fs).
import SAVE_RAW from '../e2e/save.json?raw';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));

/** «Супермаркет» с деньгами на лицензию. */
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 40,
  seed: 7,
  level: LICENSE_LEVEL,
  debt: 0,
  money: LICENSE_PRICE + 5000,
  tourDone: true,
  ...patch,
});

/** С лицензией (куплена вчера) и полной витриной. */
const licensed = (patch: Partial<StoreState> = {}): StoreState => {
  const s = buyLicense(shop(patch))!;
  return {
    ...s,
    day: s.day + 1,
    shelves: s.shelves.map((sh) => (sh.kind === 'license' ? { ...sh, items: { beer: units(6), cigarettes: units(6) } } : sh)),
  };
};

/** Первый день начиная с from, когда f(день) — правда. */
const firstDay = (base: StoreState, f: (s: StoreState) => boolean, from = base.day): StoreState => {
  for (let day = from; day < from + 400; day++) {
    const s = { ...base, day };
    if (f(s)) return s;
  }
  throw new Error('нет такого дня');
};

describe('лицензия: покупка', () => {
  it('без лицензии пива и сигарет нет нигде: ни в продаже, ни в закупке', () => {
    const s = shop();
    expect(hasLicense(s)).toBe(false);
    expect(sellableProducts(s).some(restricted)).toBe(false);
    expect(canStock(s, 'beer')).toBe(false);
    expect(restockPlan(s, priceFor(s), 100).lines.some((l) => restricted(l.pid))).toBe(false);
    expect(s.shelves.some((sh) => sh.kind === 'license')).toBe(false);
  });

  it('товар с высокой наценкой, витрина 18+ — место у кассы, только с «Супермаркета»', () => {
    for (const id of ['beer', 'cigarettes'] as const) {
      expect(restricted(id)).toBe(true);
      expect(PRODUCTS[id].basePrice / PRODUCTS[id].cost).toBeGreaterThanOrEqual(2);
      expect(unitPrice(SUPPLIERS.wholesale, id)).toBe(PRODUCTS[id].cost);
    }
    expect(PRODUCT_IDS.filter(restricted)).toEqual(['beer', 'cigarettes']);
    expect(SHELF_KINDS.license.fixture).toBe(true);
    expect(SHELF_KINDS.license.minLevel).toBe(LICENSE_LEVEL);
    expect(STORE_LEVELS[LICENSE_LEVEL].nameKey).toBe('store.l4');
  });

  it('купить: деньги сразу, встаёт витрина, товар появляется у оптовика', () => {
    const before = shop();
    const s = buyLicense(before)!;
    expect(s.money).toBe(before.money - LICENSE_PRICE);
    expect(hasLicense(s)).toBe(true);
    expect(s.license).toMatchObject({ since: before.day, strikes: 0, fined: 0 });
    const counter = s.shelves.filter((sh) => sh.kind === 'license');
    expect(counter).toHaveLength(1);
    expect(counter[0].level).toBe(COUNTER_LEVEL);
    expect(sellableProducts(s)).toEqual(expect.arrayContaining(['beer', 'cigarettes']));
    expect(canStock(s, 'cigarettes')).toBe(true);
    expect(canPlace('beer', counter[0])).toBe(true);
    // Второй раз ту же не купить.
    expect(buyLicense(s)).toBeNull();
  });

  it('нельзя: мало денег, маленькое помещение, Заречье', () => {
    expect(buyLicense(shop({ money: LICENSE_PRICE - 1 }))).toBeNull();
    expect(licenseLock(shop({ level: LICENSE_LEVEL - 1 }))).toBe('level');
    expect(buyLicense(shop({ level: LICENSE_LEVEL - 1 }))).toBeNull();
    const zar = shop({ zar: { at: 'zar' } as StoreState['zar'] });
    expect(licenseLock(zar)).toBe('zar');
    expect(buyLicense(zar)).toBeNull();
    // Лицензия — у магазина в Центре: при переезде в Заречье она уходит вместе с его полками.
    expect(SHOP_KEYS).toContain('license');
  });
});

describe('лицензия: подросток у кассы', () => {
  it('заходит от зерна и дня: тот же день — тот же ответ, примерно в TEEN_CHANCE дней', () => {
    const base = licensed();
    let teens = 0;
    for (let d = 0; d < 400; d++) {
      const s = { ...base, day: base.day + d };
      expect(teenToday(s)).toBe(teenToday({ ...s }));
      if (teenToday(s)) teens++;
    }
    expect(teens / 400).toBeGreaterThan(TEEN_CHANCE - 0.08);
    expect(teens / 400).toBeLessThan(TEEN_CHANCE + 0.08);
    // Другое зерно — другие дни.
    const other = Array.from({ length: 60 }, (_, d) => teenToday({ ...base, seed: 99, day: base.day + d }));
    const mine = Array.from({ length: 60 }, (_, d) => teenToday({ ...base, day: base.day + d }));
    expect(other).not.toEqual(mine);
  });

  it('не приходит без лицензии, в день покупки и когда банок на витрине нет', () => {
    const base = licensed();
    const day = firstDay(base, teenToday);
    expect(teenToday({ ...day, license: undefined })).toBe(false);
    expect(teenToday({ ...day, license: { ...day.license!, since: day.day } })).toBe(false);
    const empty = { ...day, shelves: day.shelves.map((sh) => (sh.kind === 'license' ? { ...sh, items: {} } : sh)) };
    expect(teenToday(empty)).toBe(false);
    // Пиво на складе не в счёт: просит то, что видит на витрине.
    expect(teenToday({ ...empty, warehouse: { beer: units(10) } })).toBe(false);
  });

  it('вместо обычного особого гостя; бизнесмен пиво и сигареты оптом не берёт', () => {
    const day = firstDay(licensed(), teenToday);
    const visit = makeTeen(day)!;
    expect(visit).toMatchObject({ kind: 'teen', product: 'beer', qty: TEEN_CANS, pay: day.prices.beer * TEEN_CANS });
    const rich = { ...day, warehouse: { beer: units(30), cigarettes: units(30) } };
    for (let r = 0; r < 1; r += 0.05) {
      const v = makeSpecial(rich, () => r * 0.5);
      if (v) expect(restricted(v.product)).toBe(false);
    }
  });

  it('продать — деньги сразу, банки с витрины, нарушение в счёт; отказать — всё как было', () => {
    const s = firstDay(licensed(), teenToday);
    const sold = answerTeen(s, true);
    expect(sold.money).toBe(s.prices.beer * TEEN_CANS);
    expect(sold.state.money).toBe(s.money + sold.money);
    expect(onShelves(sold.state, 'beer')).toBe(onShelves(s, 'beer') - TEEN_CANS);
    expect(sold.state.license!.strikes).toBe(1);
    const refused = answerTeen(s, false);
    expect(refused.state).toBe(s);
    expect(refused.money).toBe(0);
    // Через особого гостя — то же самое, рейтинг не трогаем.
    const res = answerSpecial(s, makeTeen(s)!, true);
    expect(res.state.license!.strikes).toBe(1);
    expect(res.rating).toBe(0);
    expect(answerSpecial(s, makeTeen(s)!, false).state).toBe(s);
  });
});

describe('лицензия: проверка', () => {
  it('приходит иногда, не в первые дни после покупки; день — от зерна', () => {
    const base = licensed();
    expect(inspectionToday({ ...base, day: base.license!.since! + 1 })).toBe(false);
    const days = Array.from({ length: 300 }, (_, d) => inspectionToday({ ...base, day: base.day + 5 + d }));
    const share = days.filter(Boolean).length / days.length;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.2);
    expect(Array.from({ length: 300 }, (_, d) => inspectionToday({ ...base, day: base.day + 5 + d }))).toEqual(days);
  });

  it('нарушений нет — всё чисто: денег не берут, карточки утром нет', () => {
    const s = firstDay(licensed(), inspectionToday, licensed().day + 5);
    const after = licenseNight(s);
    expect(after.money).toBe(s.money);
    expect(after.license!.last).toMatchObject({ day: s.day, found: 0, fine: 0 });
    expect(licenseNotice(after)).toBeNull();
  });

  it('не проверка — нарушения ждут', () => {
    const s = firstDay({ ...licensed(), license: { ...licensed().license!, strikes: 2 } }, (x) => !inspectionToday(x), licensed().day + 5);
    expect(licenseNight(s)).toBe(s);
  });

  it('первый раз — штраф за каждое нарушение, второй — ещё и лицензию отбирают, товар изымают', () => {
    const base = licensed({ money: LICENSE_PRICE + 20000, warehouse: { beer: units(5), cigarettes: units(4), bread: units(3) }, bargain: { beer: units(1) } });
    const first = firstDay({ ...base, license: { ...base.license!, strikes: 2 } }, inspectionToday, base.day + 5);
    const fined = licenseNight(first);
    expect(fined.money).toBe(first.money - 2 * LICENSE_FINE);
    expect(fined.license).toMatchObject({ strikes: 0, fined: 1, last: { day: first.day, found: 2, fine: 2 * LICENSE_FINE } });
    expect(hasLicense(fined)).toBe(true);
    expect(licenseNotice(fined)).toMatchObject({ fine: 2 * LICENSE_FINE });
    expect(licenseNotice(seeLicenseNotice(fined))).toBeNull();

    const again = firstDay({ ...seeLicenseNotice(fined), license: { ...fined.license!, strikes: 1 } }, inspectionToday, first.day + 1);
    const lost = licenseNight(again);
    expect(lost.money).toBe(again.money - LICENSE_FINE);
    expect(hasLicense(lost)).toBe(false);
    expect(lost.license!.last).toMatchObject({ revoked: true, found: 1 });
    expect(licenseNotice(lost)).toMatchObject({ revoked: true });
    expect(lost.shelves.some((sh) => sh.kind === 'license')).toBe(false);
    expect(lost.warehouse.beer).toBeUndefined();
    expect(lost.warehouse.cigarettes).toBeUndefined();
    expect(lost.warehouse.bread).toHaveLength(3);
    expect(lost.bargain?.beer).toBeUndefined();
    expect(sellableProducts(lost).some(restricted)).toBe(false);
    // Купить заново можно — с чистого листа.
    const rebought = buyLicense({ ...lost, money: LICENSE_PRICE })!;
    expect(rebought.license).toMatchObject({ strikes: 0, fined: 0, since: lost.day });
    expect(licenseNotice(rebought)).toBeNull();
  });

  it('штраф больше, чем в кассе, — остаток в долг', () => {
    const base = licensed();
    const s = firstDay({ ...base, money: 500, license: { ...base.license!, strikes: 1 } }, inspectionToday, base.day + 5);
    const after = licenseNight(s);
    expect(after.money).toBe(0);
    expect(after.debt).toBe(s.debt + LICENSE_FINE - 500);
  });

  it('проверка — в ночном цикле дня (до счетов): штраф попадает в итог ночи', () => {
    const base = licensed();
    const s = firstDay({ ...base, license: { ...base.license!, strikes: 1 } }, inspectionToday, base.day + 5);
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.state.license!.last).toMatchObject({ day: s.day, found: 1, fine: LICENSE_FINE });
  });
});

describe('лицензия: вечерние гости и спрос', () => {
  it('гостей больше на LICENSE_GUESTS — только с лицензией и витриной', () => {
    const s = licensed();
    expect(licenseGuests(shop())).toBe(1);
    expect(licenseGuests(s)).toBeCloseTo(1 + LICENSE_GUESTS);
    expect(guestFactor(s) / guestFactor({ ...s, license: undefined })).toBeCloseTo(1 + LICENSE_GUESTS);
  });

  it('в зале лишние гости — вечером: днём реже, вечером гуще, в среднем за день — как посчитано', () => {
    const s = licensed();
    expect(licenseRate(s, 0.2)).toBeLessThan(1);
    expect(licenseRate(s, 0.9)).toBeGreaterThan(1);
    const steps = 1000;
    let sum = 0;
    for (let i = 0; i < steps; i++) sum += licenseRate(s, (i + 0.5) / steps);
    expect(sum / steps).toBeCloseTo(1, 2);
    expect(licenseRate(shop(), 0.9)).toBe(1);
  });

  it('пиво и сигареты к вечеру берут чаще, остальное — как всегда; в среднем за день — как в симуляторе', () => {
    expect(eveningPull('beer', 0)).toBeLessThan(eveningPull('beer', 1));
    expect(eveningPull('bread', 0.9)).toBe(1);
    let sum = 0;
    for (let i = 0; i < 100; i++) sum += eveningPull('cigarettes', (i + 0.5) / 100);
    expect(sum / 100).toBeCloseTo(1, 5);
  });

  it('в задания, испытания, скидки дня и заказы кафе пиво и сигареты не попадают', () => {
    const base = licensed({ warehouse: { beer: units(20), cigarettes: units(20) } });
    for (let d = 0; d < 60; d++) {
      const s = { ...base, day: base.day + d };
      for (const q of questsFor(s, 120)) expect(q.product && restricted(q.product)).toBeFalsy();
      for (const c of weeklyFor(s, 120).challenges) expect(c.product && restricted(c.product)).toBeFalsy();
      for (const id of Object.keys(dealsToday(s))) expect(restricted(id as never)).toBe(false);
      let k = d;
      const offer = makeCafeOffer(s, () => ((k = (k * 9301 + 49297) % 233280) / 233280));
      for (const id of Object.keys(offer?.items ?? {})) expect(restricted(id as never)).toBe(false);
    }
  });
});

describe('лицензия: сохранения и симулятор', () => {
  const KEY = 'magazinchik.save';
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение загружается как было: без лицензии, без витрины, полки те же', async () => {
    vi.resetModules();
    const raw = SAVE_RAW;
    const local: Record<string, string> = { [KEY]: raw };
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
    const { loadGame } = await import('../src/game/save');
    const old = JSON.parse(raw).state as StoreState;
    const s = loadGame()!;
    expect(s.license).toBeUndefined();
    // Витрины нет; обычные полки — те же (старые сохранения получают ещё ларь и вёдра — normalizeShelves).
    expect(s.shelves.some((sh) => sh.kind === 'license')).toBe(false);
    expect(s.shelves.slice(0, old.shelves.length).map((sh) => sh.kind)).toEqual(old.shelves.map((sh) => sh.kind));
    expect(sellableProducts(s).some(restricted)).toBe(false);
    // Цены новых товаров — по умолчанию, остальные не тронуты.
    expect(s.prices.beer).toBe(PRODUCTS.beer.basePrice);
    expect(s.prices.bread).toBe(old.prices.bread);
  });

  it('симулятор с лицензией: покупает, продаёт пиво и сигареты, проверки проходят чисто', () => {
    let since: number | undefined;
    const run = simulate({ days: 70, seed: 3, features: { tenants: true, garden: true, license: true }, onMorning: (s) => (since ??= s.license?.since) });
    expect(since).toBeDefined();
    expect(run.final.license).toMatchObject({ strikes: 0, fined: 0 });
    const sold = (run.final.reports ?? []).reduce((sum, r) => sum + (r.sold.beer ?? 0) + (r.sold.cigarettes ?? 0), 0);
    expect(sold).toBeGreaterThan(0);
    // Без лицензии — как раньше: ни одной банки.
    const plain = simulate({ days: 70, seed: 3, features: { tenants: true, garden: true } });
    expect(plain.final.license).toBeUndefined();
    expect((plain.final.reports ?? []).every((r) => !r.sold.beer && !r.sold.cigarettes)).toBe(true);
  });
});
