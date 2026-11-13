import { afterEach, describe, expect, it, vi } from 'vitest';
import { newGame, PRODUCTS, type ProductId, type Stock, type StoreState, type Unit } from '../src/game/economy';
import {
  autoLoad,
  buyVan,
  cancelTrip,
  inStore,
  loadVan,
  nextVanEvent,
  planTrip,
  settleVan,
  tripToday,
  unloadVan,
  vanAging,
  vanCrowd,
  vanEvents,
  vanFuel,
  vanGoes,
  vanIncident,
  vanLoaded,
  vanOpen,
  vanOutcome,
  vanPrice,
  vanWant,
  weekendDay,
  VAN_CAP,
  VAN_EVENTS,
  VAN_FUEL_NEAR,
  VAN_PRICE,
  VAN_REPAIR,
  VAN_TIP_MIN,
  type VanEventId,
  type VanIncident,
} from '../src/game/van';
import { opensOn } from '../src/game/district';
import { yearTime } from '../src/game/calendar';
import { weatherFor } from '../src/game/weather';
import { nightCycle } from '../src/game/day';
import { emptyDayStats } from '../src/game/economy';
import { pendingTip, seeTip } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import { ru } from '../src/i18n/ru';

// Выездная торговля (van.ts, 13.11): когда и куда можно выехать, погрузка из магазина, итог вечером,
// случаи в дороге — всё от зерна магазина и номера дня; старые сохранения без фургона работают как раньше.

const units = (n: number, age = 0): Unit[] => Array.from({ length: n }, () => ({ age }));

/** Минимаркет с отделами напитков, мороженого и мяса и запасом на складе. */
const shop = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 25,
  level: 2,
  money: 10_000,
  debt: 0,
  rating: 4,
  seed: 7,
  shelves: [
    { kind: 'drinks', level: 0, items: { water: units(4), juice: units(2) } },
    { kind: 'icebox', level: 0, items: { icecream: units(3) } },
    { kind: 'meat', level: 0, items: { meat: units(2) } },
    { kind: 'bakery', level: 0, items: { bread: units(3) } },
  ],
  warehouse: { water: units(10, 1), juice: units(6), icecream: units(6), meat: units(4) },
  ...over,
});

/** С фургоном, на день `day`. */
const withVan = (over: Partial<StoreState> = {}): StoreState => buyVan(shop(over))!;

/** Первый день (от `from`), когда сегодня есть событие `event`, а у зерна `seed` случай в дороге `incident`. */
function findDay(event: VanEventId, incident: VanIncident | undefined, seed = 7, from = 20): number {
  for (let day = from; day < from + 3000; day++) {
    const s = shop({ day, seed });
    if (vanEvents(s).includes(event) && vanIncident(s, event) === incident) return day;
  }
  throw new Error(`нет дня для ${event}/${incident}`);
}

const count = (stock: Stock, id: ProductId): number => stock[id]?.length ?? 0;

describe('фургон: когда и куда', () => {
  it('матч — раз в неделю, в тот же день, что и на своём стадионе; свой стадион — бензина меньше', () => {
    for (let day = 20; day < 60; day++) expect(vanEvents(shop({ day })).includes('match')).toBe(day % 7 === 4);
    const far = shop({ day: 25 });
    const near = shop({ day: opensOn('stadium') + 7 - ((opensOn('stadium') + 3) % 7) });
    expect(near.day % 7).toBe(4);
    expect(vanFuel(far, 'match')).toBe(VAN_EVENTS.match.fuel);
    expect(vanFuel(near, 'match')).toBe(VAN_FUEL_NEAR);
  });

  it('дачи — в выходные игровой недели и не зимой; пляж — только в жару', () => {
    for (let day = 1; day < 400; day++) {
      const events = vanEvents(shop({ day }));
      expect(events.includes('dacha')).toBe(weekendDay(day) && yearTime(day) !== 'winter');
      expect(events.includes('beach')).toBe(weatherFor(day) === 'heat');
    }
    expect([6, 7, 13, 14].every(weekendDay)).toBe(true);
    expect([1, 5, 8, 12].some(weekendDay)).toBe(false);
  });

  it('свадьба — по зерну магазина: у разных магазинов в разные дни, примерно раз в неделю', () => {
    const days = (seed: number) => Array.from({ length: 700 }, (_, i) => i + 1).filter((day) => vanEvents(shop({ day, seed })).includes('wedding'));
    expect(days(7)).toEqual(days(7));
    expect(days(7)).not.toEqual(days(8));
    expect(days(7).length).toBeGreaterThan(70);
    expect(days(7).length).toBeLessThan(170);
  });

  it('ближайший выезд — не сегодня и не дальше двух недель', () => {
    const next = nextVanEvent(shop({ day: 25 }))!;
    expect(next.days).toBeGreaterThan(0);
    expect(vanEvents(shop({ day: 25 + next.days }))).toContain(next.id);
  });
});

describe('фургон: покупка', () => {
  it('с минимаркета, за монеты, один раз; в Заречье — нет', () => {
    expect(vanOpen(shop({ level: 1 }))).toBe(false);
    expect(buyVan(shop({ level: 1 }))).toBeNull();
    expect(buyVan(shop({ money: VAN_PRICE - 1 }))).toBeNull();
    const bought = withVan();
    expect(bought.money).toBe(10_000 - VAN_PRICE);
    expect(bought.van).toEqual({ since: 25 });
    expect(buyVan(bought)).toBeNull();
    expect(vanOpen(shop({ zar: { at: 'zar' } as StoreState['zar'] }))).toBe(false);
  });

  it('куда ехать — только из событий дня', () => {
    const s = withVan({ day: 25 });
    expect(planTrip(shop(), 'match')).toBeNull();
    expect(planTrip(s, 'beach')).toBeNull();
    expect(tripToday(planTrip(s, 'match')!)).toEqual({ day: 25, event: 'match', load: {} });
  });
});

describe('фургон: погрузка', () => {
  it('сначала склад (старое — первым), потом полки; не больше места в кузове', () => {
    const s = planTrip(withVan(), 'match')!;
    const a = loadVan(s, 'water', 12)!;
    expect(count(a.warehouse, 'water')).toBe(0);
    expect(a.shelves[0].items.water).toHaveLength(2);
    expect(vanLoaded(a)).toBe(12);
    expect(inStore(a, 'water')).toBe(inStore(s, 'water') - 12);
    expect(tripToday(a)!.load.water![0].age).toBe(1);
    // 12 воды + 8 сока = 20: мороженого влезет только 4 из 9, мясо — уже никак.
    const full = loadVan(loadVan(a, 'juice', 8)!, 'icecream', 9)!;
    expect(vanLoaded(full)).toBe(VAN_CAP);
    expect(tripToday(full)!.load.icecream).toHaveLength(VAN_CAP - 20);
    expect(loadVan(full, 'meat', 1)).toBeNull();
  });

  it('брак, по которому не решили, со склада не грузят; нечего грузить — null', () => {
    const s = planTrip(withVan({ warehouse: { water: [{ age: 0, bad: true, pending: true }] }, shelves: [] }), 'match')!;
    expect(loadVan(s, 'water', 5)).toBeNull();
    expect(loadVan(withVan(), 'water', 5)).toBeNull();
  });

  it('выгрузить — на склад; «Не едем» — всё назад и выезда нет', () => {
    const s = loadVan(planTrip(withVan(), 'match')!, 'water', 12)!;
    const one = unloadVan(s, 'water', 3);
    expect(vanLoaded(one)).toBe(9);
    expect(count(one.warehouse, 'water')).toBe(3);
    const none = cancelTrip(s);
    expect(none.van?.trip).toBeUndefined();
    expect(inStore(none, 'water')).toBe(inStore(withVan(), 'water'));
  });

  it('«Загрузить под событие» — каждого товара сколько обычно разбирают, из того, что есть', () => {
    const s = autoLoad(planTrip(withVan(), 'match')!);
    const load = tripToday(s)!.load;
    expect(count(load, 'water')).toBe(Math.min(vanWant(s, 'match', 'water'), 14));
    expect(count(load, 'juice')).toBe(vanWant(s, 'match', 'juice'));
    expect(count(load, 'pies')).toBe(0);
    expect(vanGoes(s)).toBe(true);
  });
});

describe('фургон: вечер', () => {
  const loaded = (day: number, seed = 7, event: VanEventId = 'match') => autoLoad(planTrip(withVan({ day, seed }), event)!);

  it('итог детерминирован: тот же магазин и день — тот же итог; зерно — другой день', () => {
    const day = findDay('match', undefined);
    expect(vanOutcome(loaded(day))).toEqual(vanOutcome(loaded(day)));
    expect(vanCrowd(shop({ day, seed: 7 }))).not.toBe(vanCrowd(shop({ day, seed: 8 })));
  });

  it('выручка — по цене выезда, бензин вычтен, остаток — на склад, выезд закрыт', () => {
    const day = findDay('match', undefined);
    const s = loaded(day);
    const out = vanOutcome(s)!;
    expect(out.sold).toBeGreaterThan(0);
    expect(out.sold + out.back + out.spoiled).toBe(vanLoaded(s));
    expect(vanPrice('water', 'match')).toBe(Math.round(PRODUCTS.water.basePrice * 1.2));
    expect(out.net).toBe(out.revenue - VAN_EVENTS.match.fuel);
    const night = settleVan(s);
    const { home: _home, ...result } = out;
    expect(night.result).toEqual(result);
    expect(night.state.money).toBe(s.money + out.net);
    expect(night.state.van).toEqual({ since: day, last: night.result, trips: 1, earned: out.net });
    expect(inStore(night.state, 'water') + inStore(night.state, 'juice') + inStore(night.state, 'icecream') + inStore(night.state, 'meat')).toBe(
      inStore(s, 'water') + inStore(s, 'juice') + inStore(s, 'icecream') + inStore(s, 'meat') + out.back,
    );
  });

  it('без холодильника весь день: мясо стареет на два дня, хлеб — на день, вода — никак', () => {
    expect(vanAging('meat')).toBe(2);
    expect(vanAging('icecream')).toBe(2);
    expect(vanAging('bread')).toBe(1);
    expect(vanAging('water')).toBe(0);
    expect(vanAging('jam')).toBe(0);
  });

  it('дождь на пляже — продажи почти ноль; колесо — ремонт; щедрый покупатель — чаевые', () => {
    const rainy = loaded(findDay('beach', 'rain'), 7, 'beach');
    const rain = vanOutcome(rainy)!;
    expect(rain.incident).toBe('rain');
    expect(rain.sold).toBeLessThanOrEqual(1);
    expect(rain.net).toBeLessThan(0);
    const wheel = vanOutcome(loaded(findDay('match', 'wheel')))!;
    expect(wheel.extra).toBe(-VAN_REPAIR);
    expect(wheel.net).toBe(wheel.revenue - VAN_REPAIR - wheel.fuel);
    const kind = vanOutcome(loaded(findDay('match', 'generous')))!;
    expect(kind.extra).toBeGreaterThanOrEqual(VAN_TIP_MIN);
    const jam = vanOutcome(loaded(findDay('match', 'jam')))!;
    expect(jam.incident).toBe('jam');
  });

  it('пустой кузов — не едем: ни бензина, ни итога', () => {
    const s = planTrip(withVan(), 'match')!;
    const night = settleVan(s);
    expect(night.result).toBeNull();
    expect(night.state.money).toBe(s.money);
    expect(night.state.van?.trip).toBeUndefined();
  });

  it('не разобранный вчерашний выезд — товар просто возвращается, без продаж и бензина', () => {
    const s = loadVan(planTrip(withVan(), 'match')!, 'water', 10)!;
    const tomorrow = { ...s, day: s.day + 1 };
    const night = settleVan(tomorrow);
    expect(night.result).toBeNull();
    expect(night.state.money).toBe(s.money);
    expect(inStore(night.state, 'water')).toBe(inStore(withVan(), 'water'));
    expect(night.state.van?.trip).toBeUndefined();
  });

  it('ночь (nightCycle): итог выезда в сводке, деньги — в кассе, товар назад — на складе', () => {
    const day = findDay('match', undefined);
    const s = loaded(day);
    const out = vanOutcome(s)!;
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.van).toMatchObject({ day, sold: out.sold, net: out.net });
    expect(night.state.van?.trip).toBeUndefined();
    expect(night.state.van?.last?.day).toBe(day);
  });
});

describe('фургон: продукты, которые портятся', () => {
  it('мясо, которое не продали, весь день без холодильника — назад не доезжает, вода возвращается', () => {
    // На матче мясо не берут: всё, что увезли, — испорчено; воду везут назад целой.
    const day = findDay('match', undefined);
    const s = loadVan(planTrip(withVan({ day }), 'match')!, 'meat', 6)!;
    const out = vanOutcome(s)!;
    expect(out.sold).toBe(0);
    expect(out.spoiled).toBe(6);
    expect(out.back).toBe(0);
  });
});

describe('старые сохранения и подсказка', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('без фургона ночь идёт как раньше: итога выезда нет, поле не появляется', () => {
    const s = shop({ day: 25 });
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.van).toBeNull();
    expect(night.state.van).toBeUndefined();
    expect(settleVan(s).state).toBe(s);
  });

  it('сохранение: старое без фургона и новое с загруженным кузовом загружаются как были', async () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
    vi.resetModules();
    const { loadGame } = await import('../src/game/save');
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: shop() });
    expect(loadGame()!.van).toBeUndefined();
    const loaded = autoLoad(planTrip(withVan(), 'match')!);
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: loaded });
    const back = loadGame()!;
    expect(back.van).toEqual(loaded.van);
    expect(vanLoaded(back)).toBe(vanLoaded(loaded));
  });

  it('подсказка «Новое»: с минимаркета, пока фургона нет', () => {
    const seen = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift'];
    expect(pendingTip(shop({ seenTips: seen }))).toBe('van');
    expect(pendingTip(shop({ seenTips: seen, level: 1 }))).toBeNull();
    expect(pendingTip(withVan({ seenTips: seen }))).toBeNull();
    expect(pendingTip(seeTip(shop({ seenTips: seen }), 'van'))).toBeNull();
    expect(ru['tip.van.title']).toBeTruthy();
  });

  it('симулятор с фургоном идёт: выезды есть, баланс не уезжает', () => {
    const base = simulate({ days: 60, seed: 3, features: { tenants: true, garden: true } });
    const van = simulate({ days: 60, seed: 3, features: { tenants: true, garden: true, van: true } });
    expect(van.final.van?.trips ?? 0).toBeGreaterThan(5);
    expect(van.levelDay).toEqual(base.levelDay);
    expect(Math.abs(van.final.money - base.final.money)).toBeLessThan(base.final.money * 0.25);
  });
});
