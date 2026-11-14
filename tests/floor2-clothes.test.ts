import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import { buyFloor, finishFloor, floorAvailable, floorLock, FLOORS, hasFloor, openFloors } from '../src/game/floors';
import {
  BATCH,
  BUY_SHARE,
  batchCost,
  batchSize,
  buyBatch,
  CLERK_WAGE,
  clothesNight,
  clothesOf,
  clothesPlan,
  collectionFor,
  COLLECTION_DEFS,
  FINISH_BOOST,
  freePlaces,
  freshStock,
  oldStock,
  RACK_PLACES,
  rackPlaces,
  SALE_OFF,
  seasonDaysLeft,
  setClerk,
  setSale,
  weatherFit,
  type ClothesState,
} from '../src/game/clothes';
import { weatherToday } from '../src/game/crisis';
import { guestsToday, nightCycle } from '../src/game/day';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { simulate } from '../src/game/simulate';

// Второй этаж — магазин одежды (floors.ts + clothes.ts, 13.11): коллекции по сезону, закупка партиями, вечерние
// продажи от гостей и погоды, распродажа остатков, продавец-консультант. Всё — от зерна и дня; старые сохранения — без изменений.

/** День 60 — лето (месяц 8 из 16): на стойках футболки и шорты. */
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: 3, money: 30000, debt: 0, rating: 4.5, seed: 7, ...over });
/** Второй этаж открыт (отделка finish), на стойках clothes. */
const upstairs = (clothes: ClothesState = {}, over: Partial<StoreState> = {}, finish = 0): StoreState =>
  shop({ floors: { second: { since: 50, finish } }, clothes, ...over });

describe('второй этаж открывается', () => {
  it('с «Супермаркета», за деньги, не в Заречье и один раз', () => {
    expect(floorLock(shop({ level: FLOORS.second.minLevel - 1 }), 'second')).toBe('level');
    expect(floorAvailable(shop(), 'second')).toBe(true);
    expect(floorLock(shop({ zar: { at: 'zar' } as StoreState['zar'] }), 'second')).toBe('zar');
    const opened = buyFloor(shop(), 'second')!;
    expect(opened.money).toBe(30000 - FLOORS.second.cost);
    expect(hasFloor(opened, 'second')).toBe(true);
    expect(openFloors(opened)).toEqual(['second']);
    expect(clothesOf(opened)).toEqual({});
    expect(buyFloor(opened, 'second')).toBeNull();
    expect(buyFloor(shop({ money: FLOORS.second.cost - 1 }), 'second')).toBeNull();
  });

  it('подвал и второй этаж — независимо', () => {
    const both = buyFloor(buyFloor(shop(), 'basement')!, 'second')!;
    expect(openFloors(both)).toEqual(['basement', 'second']);
  });
});

describe('старое сохранение', () => {
  it('без clothes и floors — наверху пусто, вечер прежний', () => {
    const old = shop();
    expect(clothesOf(old)).toBeNull();
    expect(clothesNight(old, 100)).toEqual({ state: old, day: null });
    expect(nightCycle(old, emptyDayStats(), () => 0.5).clothes).toBeNull();
    expect(buyBatch(old)).toBeNull();
  });

  it('кривые поля в сохранении не ломают этаж', () => {
    const s = upstairs({ stock: { warm: -3, rain: 'x' as unknown as number, summer: 7.8 } });
    expect(clothesOf(s)?.stock).toEqual({ summer: 7 });
  });

  describe('загрузка', () => {
    let local: Record<string, string> = {};
    beforeEach(() => {
      local = {};
      Object.assign(globalThis, {
        localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
      });
    });
    afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

    it('сохранение без поля грузится как было, а этаж с одеждой переживает сохранение', async () => {
      const { loadGame, saveGame } = await import('../src/game/save');
      local['magazinchik.save'] = JSON.stringify({ version: 11, state: shop() });
      const loaded = loadGame()!;
      expect(loaded.clothes).toBeUndefined();
      expect(hasFloor(loaded, 'second')).toBe(false);
      saveGame(upstairs({ stock: { summer: 20, rain: 4 }, sale: true, clerk: true }));
      const back = loadGame()!;
      expect(back.clothes).toEqual({ stock: { summer: 20, rain: 4 }, sale: true, clerk: true });
      expect(back.floors).toEqual({ second: { since: 50, finish: 0 } });
    });
  });
});

describe('коллекции по сезону', () => {
  it('к холодам — тёплое, весной и осенью — плащи, летом — футболки; год по кругу', () => {
    expect(collectionFor(1)).toBe('warm');
    expect(collectionFor(28)).toBe('warm');
    expect(collectionFor(29)).toBe('rain');
    expect(collectionFor(50)).toBe('summer');
    expect(collectionFor(77)).toBe('summer');
    expect(collectionFor(78)).toBe('rain');
    expect(collectionFor(113)).toBe('warm');
  });

  it('сколько дней осталось сезону', () => {
    expect(seasonDaysLeft(28)).toBe(1);
    expect(seasonDaysLeft(22)).toBe(7);
    expect(seasonDaysLeft(50)).toBe(28);
  });

  it('погода к месту: в ливень плащи, в жару футболки, а куртки в жару не берут', () => {
    expect(weatherFit('rain', 'storm')).toBeGreaterThan(weatherFit('rain', 'clear'));
    expect(weatherFit('summer', 'heat')).toBeGreaterThan(weatherFit('summer', 'rain'));
    expect(weatherFit('warm', 'snow')).toBeGreaterThan(1);
    expect(weatherFit('warm', 'heat')).toBeLessThan(0.5);
  });
});

describe('закупка партиями', () => {
  it('партия текущей коллекции: деньги сразу, вещи на стойки', () => {
    const s = buyBatch(upstairs())!;
    expect(s.money).toBe(30000 - BATCH * COLLECTION_DEFS.summer.cost);
    expect(clothesOf(s)?.stock).toEqual({ summer: BATCH });
    expect(freshStock(s)).toBe(BATCH);
  });

  it('стойки не резиновые: последняя партия — сколько влезет; после ремонта мест больше', () => {
    let s = upstairs({ stock: { rain: RACK_PLACES[0] - 4 } });
    expect(batchSize(s)).toBe(4);
    expect(batchCost(s)).toBe(4 * COLLECTION_DEFS.summer.cost);
    s = buyBatch(s)!;
    expect(freePlaces(s)).toBe(0);
    expect(buyBatch(s)).toBeNull();
    s = finishFloor(s, 'second')!;
    expect(rackPlaces(s)).toBe(RACK_PLACES[1]);
    expect(buyBatch(s)).not.toBeNull();
  });

  it('без денег — нельзя', () => {
    expect(buyBatch(upstairs({}, { money: BATCH * COLLECTION_DEFS.summer.cost - 1 }))).toBeNull();
  });
});

describe('вечер на этаже', () => {
  it('детерминирован: тот же день — то же; прогноз утра = итог вечера', () => {
    const s = upstairs({ stock: { summer: 30 } });
    expect(clothesPlan(s, 120)).toEqual(clothesPlan(s, 120));
    const plan = clothesPlan(s, 120)!;
    const night = clothesNight(s, 120);
    expect(night.day).toEqual(plan);
    expect(night.state.money).toBe(s.money + plan.income - plan.wage);
    expect(clothesOf(night.state)?.stock?.summer).toBe(30 - plan.sold);
    expect(clothesOf(night.state)?.last).toEqual({ ...plan, day: 60 });
    expect(clothesOf(night.state)?.earned).toBe(plan.income);
  });

  it('продают не больше, чем висит; больше гостей — больше покупателей', () => {
    const s = upstairs({ stock: { summer: 2 } });
    const plan = clothesPlan(s, 1000)!;
    expect(plan.buyers).toBeGreaterThan(2);
    expect(plan.sold).toBe(2);
    expect(plan.income).toBe(2 * COLLECTION_DEFS.summer.price);
    const few = clothesPlan(upstairs({ stock: { summer: 99 } }, {}, 1), 40)!;
    const many = clothesPlan(upstairs({ stock: { summer: 99 } }, {}, 1), 400)!;
    expect(many.buyers).toBeGreaterThan(few.buyers);
  });

  it('пустые стойки и без продавца — вечера нет', () => {
    expect(clothesPlan(upstairs(), 200)).toBeNull();
  });

  it('продавец: платим каждый вечер, но покупателей больше; не хватило на плату — в долг', () => {
    const base = upstairs({ stock: { summer: 99 } });
    const hired = setClerk(base, true)!;
    expect(clothesPlan(hired, 300)!.buyers).toBeGreaterThan(clothesPlan(base, 300)!.buyers);
    expect(clothesPlan(hired, 300)!.wage).toBe(CLERK_WAGE);
    const broke = clothesNight(upstairs({ clerk: true }, { money: 30 }), 300);
    expect(broke.day?.sold).toBe(0);
    expect(broke.state.money).toBe(0);
    expect(broke.state.debt).toBe(CLERK_WAGE - 30);
    expect(setClerk(hired, true)).toBeNull();
    expect(clothesOf(setClerk(hired, false)!)?.clerk).toBeUndefined();
  });

  it('остатки прошлого сезона: без распродажи пылятся, с ней уходят за полцены', () => {
    const dusty = upstairs({ stock: { warm: 15 } });
    expect(oldStock(dusty)).toBe(15);
    expect(clothesPlan(dusty, 300)).toEqual({ coll: 'summer', buyers: expect.any(Number), sold: 0, sale: 0, income: 0, wage: 0 });
    expect(clothesOf(clothesNight(dusty, 300).state)?.stock).toEqual({ warm: 15 });
    const sale = setSale(dusty, true)!;
    const plan = clothesPlan(sale, 300)!;
    expect(plan.sale).toBeGreaterThan(0);
    expect(plan.income).toBe(plan.sale * Math.round(COLLECTION_DEFS.warm.price * SALE_OFF));
    expect(clothesOf(clothesNight(sale, 300).state)?.stock?.warm).toBe(15 - plan.sale);
  });

  it('в Заречье этаж Центра закрыт — вещи ждут', () => {
    const s = upstairs({ stock: { summer: 30 } }, { zar: { at: 'zar' } as StoreState['zar'] });
    expect(clothesOf(s)).toBeNull();
    expect(clothesNight(s, 200).state).toBe(s);
  });

  it('вечер дня (nightCycle) приносит выручку этажа и пишет её в итог', () => {
    const s = upstairs({ stock: { summer: 40 } });
    const plan = clothesPlan(s, guestsToday(s))!;
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.clothes).toEqual(plan);
    expect(clothesOf(night.state)?.last?.day).toBe(60);
  });

  it('погода дня входит в прогноз', () => {
    const s = upstairs({ stock: { summer: 99 } }, {}, 1);
    const plan = clothesPlan(s, 500)!;
    // 500 гостей × доля × ремонт × погода дня, ± 25% от зерна и дня.
    const mid = 500 * BUY_SHARE * FINISH_BOOST * weatherFit('summer', weatherToday(s));
    expect(plan.buyers).toBeGreaterThanOrEqual(Math.floor(mid * 0.75));
    expect(plan.buyers).toBeLessThanOrEqual(Math.ceil(mid * 1.25));
  });
});

describe('подсказка и симулятор', () => {
  it('подсказка — как только второй этаж можно открыть; значок свой', () => {
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'clothes');
    expect(pendingTip(shop({ seenTips: others }))).toBe('clothes');
    expect(pendingTip(shop({ level: 2, seenTips: others }))).toBeNull();
    expect(Object.values(TIP_ICONS).filter((icon) => icon === TIP_ICONS.clothes)).toHaveLength(1);
  });

  it('симулятор с одеждой идёт до конца и открывает этаж', () => {
    let opened = false;
    let sold = 0;
    const run = simulate({ days: 90, seed: 3, features: { clothes: true }, onMorning: (s) => {
      opened ||= hasFloor(s, 'second');
      sold = Math.max(sold, s.clothes?.earned ?? 0);
    } });
    expect(run.days).toHaveLength(90);
    expect(opened).toBe(true);
    expect(sold).toBeGreaterThan(0);
  });
});
