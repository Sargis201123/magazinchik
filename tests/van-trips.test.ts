import { afterEach, describe, expect, it, vi } from 'vitest';
import { newGame, PRODUCTS, warehouseCapacity, warehouseCount, type ProductId, type Stock, type StoreState, type Unit } from '../src/game/economy';
import {
  buyVan,
  migrateVan,
  nextVanEvent,
  settleVan,
  vanCalendar,
  vanCargo,
  vanCrowd,
  vanEvents,
  vanFuel,
  vanGain,
  vanIncident,
  vanMargin,
  vanOpen,
  vanOutcome,
  vanPrice,
  vanTripOn,
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
import { pendingTip, seeTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { NEWS_IDS } from '../src/game/headlines';
import { switchDistrict } from '../src/game/zarechye';
import { simulate } from '../src/game/simulate';
import { ru } from '../src/i18n/ru';

// Выездная торговля (van.ts, 13.11): когда и куда можно выехать, итог вечером, случаи в дороге — всё от зерна
// магазина и номера дня; старые сохранения без фургона работают как раньше.
// 27.11: фургон ездит сам — в день события на самое выгодное, груз берёт у поставщика (полки и склад не трогает),
// вечером в кассу выручка за вычетом товара и бензина. Старый загруженный кузов при загрузке — на склад.

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

/** Первый день (от `from`), когда фургон сам едет на `event` и случай в дороге — `incident`. */
function tripDay(event: VanEventId, incident: VanIncident | undefined, seed = 7, from = 20): number {
  for (let day = from; day < from + 3000; day++) {
    const s = withVan({ day, seed });
    if (vanTripOn(s) === event && vanIncident(s, event) === incident) return day;
  }
  throw new Error(`нет выезда ${event}/${incident}`);
}

const count = (stock: Stock, id: ProductId): number => stock[id]?.length ?? 0;
const total = (stock: Stock): number => Object.values(stock).reduce((n, u) => n + (u?.length ?? 0), 0);

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
});

describe('фургон ездит сам (27.11)', () => {
  it('в день события едет сам, без фургона и без событий — нет', () => {
    const day = findDay('match', undefined);
    expect(vanTripOn(shop({ day }))).toBeNull();
    expect(vanTripOn(withVan({ day }))).not.toBeNull();
    let quiet = 20;
    while (vanEvents(shop({ day: quiet })).length) quiet++;
    expect(vanTripOn(withVan({ day: quiet }))).toBeNull();
  });

  it('из двух событий дня — самое выгодное', () => {
    for (let day = 20; day < 400; day++) {
      const s = withVan({ day });
      const events = vanEvents(s);
      if (events.length < 2) continue;
      const best = vanTripOn(s)!;
      for (const e of events) expect(vanGain(s, best)).toBeGreaterThanOrEqual(vanGain(s, e));
      return;
    }
    throw new Error('нет дня с двумя событиями');
  });

  it('груз — только товары магазина, самые ходовые первыми, не больше кузова; пиво и сигареты — с лицензией', () => {
    const s = withVan();
    const cargo = vanCargo(s, 'match');
    // Матч: вода, сок, мороженое — есть у магазина; выпечки своей, кваса и пива нет.
    expect(cargo.map((c) => c.id)).toEqual(['water', 'juice', 'icecream']);
    for (const { id, n } of cargo) expect(n).toBe(vanWant(s, 'match', id));
    expect(vanWant(s, 'match', 'beer')).toBe(0);
    const licensed = withVan({ license: { since: 1 }, shelves: [...shop().shelves, { kind: 'license', level: 0, items: {} }] } as Partial<StoreState>);
    expect(vanWant(licensed, 'match', 'beer')).toBeGreaterThan(0);
    const full = vanCargo(licensed, 'match');
    expect(full.map((c) => c.id)).toContain('beer');
    expect(full.reduce((n, c) => n + c.n, 0)).toBeLessThanOrEqual(VAN_CAP);
  });

  it('выручка — по цене выезда, товар — по закупке, бензин вычтен', () => {
    const day = tripDay('match', undefined);
    const s = withVan({ day });
    const out = vanOutcome(s)!;
    expect(out.event).toBe('match');
    expect(out.sold).toBeGreaterThan(0);
    expect(out.sold).toBeLessThanOrEqual(vanCargo(s, 'match').reduce((n, c) => n + c.n, 0));
    expect(vanPrice('water', 'match')).toBe(Math.round(PRODUCTS.water.basePrice * 1.2));
    expect(vanMargin('water', 'match')).toBe(vanPrice('water', 'match') - PRODUCTS.water.cost);
    expect(out.goods).toBeGreaterThan(0);
    expect(out.goods).toBeLessThan(out.revenue);
    expect(out.net).toBe(out.revenue - out.goods! - VAN_EVENTS.match.fuel);
    expect(vanOutcome(s)).toEqual(out);
    expect(vanCrowd(shop({ day, seed: 7 }))).not.toBe(vanCrowd(shop({ day, seed: 8 })));
  });

  it('полки и склад не трогает: ни утром, ни ночью; места склада фургон не держит', () => {
    const day = tripDay('match', undefined);
    const s = withVan({ day });
    const night = settleVan(s);
    expect(night.result).not.toBeNull();
    expect(night.state.warehouse).toBe(s.warehouse);
    expect(night.state.shelves).toBe(s.shelves);
    expect(warehouseCount(s)).toBe(total(s.warehouse));
  });

  it('ночь: итог в кассу, счётчики выездов и заработка', () => {
    const day = tripDay('match', undefined);
    const s = withVan({ day });
    const out = vanOutcome(s)!;
    const night = settleVan(s);
    expect(night.result).toEqual(out);
    expect(night.state.money).toBe(s.money + out.net);
    // back/spoiled/seen - на один выпуск для старого клиента (откат, кэш): его карточка выезда без них писала NaN.
    expect(night.state.van).toEqual({ since: day, last: { ...out, back: 0, spoiled: 0, seen: true }, trips: 1, earned: out.net });
    const cycle = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(cycle.van).toEqual(out);
    expect(cycle.state.van?.last?.day).toBe(day);
  });

  it('дождь на пляже — продажи почти ноль и минус в долг; колесо — ремонт; щедрый покупатель — чаевые', () => {
    const rain = vanOutcome(withVan({ day: tripDay('beach', 'rain') }))!;
    expect(rain.incident).toBe('rain');
    expect(rain.sold).toBeLessThanOrEqual(2);
    expect(rain.net).toBeLessThan(0);
    // 14.11, аудит: неудачный выезд — нехватка в долг, как у всех.
    const broke = settleVan({ ...withVan({ day: rain.day }), money: 5, debt: 100 }).state;
    expect(broke.money).toBe(Math.max(0, 5 + rain.net));
    expect(broke.debt).toBe(100 + Math.max(0, -(5 + rain.net)));
    const wheel = vanOutcome(withVan({ day: tripDay('match', 'wheel') }))!;
    expect(wheel.extra).toBe(-VAN_REPAIR);
    expect(wheel.net).toBe(wheel.revenue - wheel.goods! - VAN_REPAIR - wheel.fuel);
    const kind = vanOutcome(withVan({ day: tripDay('match', 'generous') }))!;
    expect(kind.extra).toBeGreaterThanOrEqual(VAN_TIP_MIN);
    const jam = vanOutcome(withVan({ day: tripDay('match', 'jam') }))!;
    expect(jam.incident).toBe('jam');
  });

  it('свой стадион — бензина меньше, выезд выгоднее', () => {
    const near = withVan({ day: opensOn('stadium') + 7 - ((opensOn('stadium') + 3) % 7) });
    expect(vanFuel(near, 'match')).toBe(VAN_FUEL_NEAR);
    expect(vanGain(near, 'match')).toBe(vanCargo(near, 'match').reduce((n, c) => n + c.n * vanMargin(c.id, 'match'), 0) - VAN_FUEL_NEAR);
  });

  it('в Заречье фургон ждёт: выезда нет, ночь его не трогает', () => {
    const day = tripDay('match', undefined);
    const s = { ...withVan({ day }), zar: { at: 'zar', since: 1, away: {} } as unknown as StoreState['zar'] };
    expect(vanTripOn(s)).toBeNull();
    expect(settleVan(s).state).toBe(s);
    const home = withVan({ day, zar: { at: 'home', since: 1, away: {} } as unknown as StoreState['zar'] });
    expect(switchDistrict(home, 'zar').van).toEqual(home.van);
  });

  it('календарь: один выезд в день — тот, куда фургон поедет, с обычным заработком', () => {
    const s = withVan();
    const plan = vanCalendar(s, 5, 14);
    expect(plan.length).toBeGreaterThan(0);
    expect(new Set(plan.map((p) => p.day)).size).toBe(plan.length);
    for (const p of plan) {
      expect(p.event).toBe(vanTripOn(s, p.day));
      expect(p.gain).toBe(vanGain(s, p.event, p.day));
    }
    expect(vanCalendar(shop(), 5, 14)).toEqual([]);
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

  it('старый загруженный кузов: на склад, сколько влезет, остальное — продаём по закупке; «Не едем» снят', () => {
    const base = withVan();
    const load = { water: units(10, 2), meat: units(4, 1) };
    const old = { ...base, van: { ...base.van!, trip: { day: 25, event: 'match' as const, load }, skip: 24 } };
    const room = warehouseCapacity(old) - warehouseCount(old);
    expect(room).toBeGreaterThanOrEqual(14);
    const moved = migrateVan(old);
    expect(moved.van).toEqual({ since: 25 });
    expect(count(moved.warehouse, 'water')).toBe(count(old.warehouse, 'water') + 10);
    expect(count(moved.warehouse, 'meat')).toBe(count(old.warehouse, 'meat') + 4);
    expect(moved.money).toBe(old.money);
    // Склад почти полон: два места — остальное продаём по закупке.
    const tight = { ...old, warehouse: { ...old.warehouse, potatoes: units(room - 2) } };
    const sold = migrateVan(tight);
    expect(warehouseCount(sold)).toBe(warehouseCapacity(sold));
    // Вода первой: 2 штуки на склад, 8 — по закупке; мясу места уже нет — 4 по закупке.
    expect(count(sold.warehouse, 'water')).toBe(count(tight.warehouse, 'water') + 2);
    expect(sold.money).toBe(tight.money + 8 * PRODUCTS.water.cost + 4 * PRODUCTS.meat.cost);
    // Без кузова — ничего не меняется.
    expect(migrateVan(base)).toBe(base);
    expect(migrateVan(shop())).toEqual(shop());
  });

  it('сохранение с загруженным кузовом грузится: кузов уже на складе', async () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
    vi.resetModules();
    const { loadGame } = await import('../src/game/save');
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: shop() });
    expect(loadGame()!.van).toBeUndefined();
    const base = withVan();
    const old = { ...base, van: { ...base.van!, trip: { day: 25, event: 'match', load: { water: units(12) } } } };
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const back = loadGame()!;
    expect(back.van).toEqual({ since: 25 });
    expect(count(back.warehouse, 'water')).toBe(count(base.warehouse, 'water') + 12);
  });

  it('утренней новости «Как съездил фургон» больше нет', () => {
    expect(NEWS_IDS as readonly string[]).not.toContain('van');
  });

  it('подсказка «Новое»: с минимаркета, пока фургона нет', () => {
    // Все остальные подсказки уже видели (список — из TIP_ICONS: новые подсказки на main его не ломают).
    const seen = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'van');
    expect(pendingTip(shop({ seenTips: seen }))).toBe('van');
    expect(pendingTip(shop({ seenTips: seen, level: 1 }))).toBeNull();
    expect(pendingTip(withVan({ seenTips: seen }))).toBeNull();
    expect(pendingTip(seeTip(shop({ seenTips: seen }), 'van'))).toBeNull();
    expect(ru['tip.van.title']).toBeTruthy();
  });

  it('выезд приносит чистыми в среднем ~700, как до 27.11 после цены товара (магазин со всеми отделами, год выездов)', () => {
    const ALL = ['candy', 'coffee', 'oven', 'night', 'cat', 'loyalty', 'gear', 'departments', 'radio', 'brand', 'cafe', 'kitchen', 'rush', 'tenants', 'garden', 'apprentice', 'rental', 'lottery', 'ads', 'van'];
    const shop0 = simulate({ days: 80, seed: 1, features: Object.fromEntries(ALL.map((f) => [f, true])) }).final;
    expect(shop0.van).toBeDefined();
    const nets: number[] = [];
    for (let day = shop0.day; day < shop0.day + 112; day++) {
      const out = vanOutcome({ ...shop0, day });
      if (out) nets.push(out.net);
    }
    // Выезд — примерно в каждый второй день (дни событий), чистыми за выезд — 550…900.
    expect(nets.length).toBeGreaterThan(40);
    const avg = nets.reduce((a, b) => a + b, 0) / nets.length;
    expect(avg).toBeGreaterThan(550);
    expect(avg).toBeLessThan(900);
  });

  it('симулятор с фургоном идёт: выезды есть, баланс не уезжает', () => {
    const base = simulate({ days: 60, seed: 3, features: { tenants: true, garden: true } });
    const van = simulate({ days: 60, seed: 3, features: { tenants: true, garden: true, van: true } });
    // 15.11: с ещё одной комнатой под аренду симулятор тратит на отделку раньше и покупает фургон на пару дней позже —
    // к 60-му дню на выезд меньше (6 → 5). 27.11: двор в симуляторе приносит деньги как в игре (раньше урожай каждое
    // утро бесплатно шёл на прилавок, двор был ~в 10 раз богаче) — денег к 60-му дню меньше, фургон позже (5 → 4).
    expect(van.final.van?.trips ?? 0).toBeGreaterThanOrEqual(4);
    expect(van.levelDay).toEqual(base.levelDay);
    expect(Math.abs(van.final.money - base.final.money)).toBeLessThan(base.final.money * 0.25);
  });
});
