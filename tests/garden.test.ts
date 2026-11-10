import { describe, expect, it } from 'vitest';
import { canPlace, newGame, onShelves, shelfCapacity, SHELF_LEVELS, warehouseCount, type StoreState } from '../src/game/economy';
import { addBed, BED_COSTS, bedsOf, CROPS, gardenRipeAt, growMs, OWN_JAM_DAYS, ownJam, plant, water, WATER_MS, buildGarden, cropQty, GARDEN_CROPS, GARDEN_FROM_DAY, GARDEN_PRICE, gardenLeft, gardenLook, gardenProgress, gardenRipe, gardenStage, gardenVisible, GROW_MS, harvest, shelfRoomFor } from '../src/game/garden';

// «Бабушкина теплица» (garden.ts): растёт по настоящему времени, урожай — бесплатно прямо на овощной прилавок.

const NOW = Date.UTC(2026, 10, 10, 9, 0, 0);
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 5, money: 1000, ...over });
const planted = (over: Partial<StoreState> = {}): StoreState => buildGarden(shop(over), NOW)!;
/** Пустые полки побольше: урожаю есть куда встать. */
const emptyShelves = (state: StoreState): StoreState => ({ ...state, shelves: state.shelves.map((s) => ({ ...s, level: SHELF_LEVELS.length - 1, items: {} })) });

describe('теплица: поставить', () => {
  it('с третьего дня, за деньги, один раз', () => {
    expect(gardenVisible(shop({ day: GARDEN_FROM_DAY - 1 }))).toBe(false);
    expect(buildGarden(shop({ day: GARDEN_FROM_DAY - 1 }), NOW)).toBeNull();
    expect(buildGarden(shop({ money: GARDEN_PRICE - 1 }), NOW)).toBeNull();
    const state = planted();
    expect(state.money).toBe(1000 - GARDEN_PRICE);
    expect(state.garden).toEqual({ since: NOW, harvests: 0 });
    expect(buildGarden(state, NOW)).toBeNull();
  });
});

describe('теплица: рост по настоящему времени', () => {
  it('стадии 0 → 3 за время роста, перевод часов назад рост в минус не уводит', () => {
    const state = planted();
    expect(gardenStage(state, NOW)).toBe(0);
    expect(gardenStage(state, NOW + GROW_MS * 0.4)).toBe(1);
    expect(gardenStage(state, NOW + GROW_MS * 0.8)).toBe(2);
    expect(gardenStage(state, NOW + GROW_MS)).toBe(3);
    expect(gardenRipe(state, NOW + GROW_MS - 1)).toBe(false);
    expect(gardenProgress(state, NOW - 5 * 3600_000)).toBe(0);
    expect(gardenLeft(state, NOW + GROW_MS / 2)).toBe(GROW_MS / 2);
    expect(gardenLeft(state, NOW + GROW_MS * 3)).toBe(0);
    expect(gardenLook(state, NOW)).not.toBe(gardenLook(state, NOW + GROW_MS));
    expect(gardenLook(shop(), NOW)).toBe('');
  });
});

describe('теплица: урожай', () => {
  it('не созрел — собирать нечего', () => {
    expect(harvest(planted(), NOW + GROW_MS - 1)).toBeNull();
    expect(harvest(shop(), NOW)).toBeNull();
  });

  it('созрел — яблоки и картофель бесплатно прямо на прилавок, склад не трогает, рассада посажена заново', () => {
    const state = emptyShelves(planted({ warehouse: {} }));
    const later = NOW + GROW_MS + 1000;
    const done = harvest(state, later)!;
    expect(done.got.map((g) => g.id)).toEqual(GARDEN_CROPS);
    for (const { id, qty } of done.got) {
      expect(qty).toBe(cropQty(state));
      expect(onShelves(done.state, id)).toBe(qty);
    }
    expect(warehouseCount(done.state)).toBe(0);
    expect(done.state.money).toBe(state.money);
    expect(done.state.garden).toEqual({ since: later, harvests: 1, own: state.day + OWN_JAM_DAYS - 1 });
    expect(gardenRipe(done.state, later)).toBe(false);
  });

  it('в большом магазине урожай больше', () => {
    expect(cropQty(shop({ level: 4 }))).toBeGreaterThan(cropQty(shop({ level: 0 })));
  });

  it('прилавок полон — урожай ждёт на грядке, а не пропадает и не идёт на склад', () => {
    const state = planted({ warehouse: {} });
    const stuffed = { ...state, shelves: state.shelves.map((s) => (canPlace('apples', s) ? { ...s, items: { apples: Array.from({ length: shelfCapacity(s) }, () => ({ age: 0 })) } } : s)) };
    expect(shelfRoomFor(stuffed, 'apples')).toBe(0);
    const later = NOW + GROW_MS;
    expect(harvest(stuffed, later)).toBeNull();
    expect(gardenRipe(stuffed, later)).toBe(true);
    expect(warehouseCount(stuffed)).toBe(0);
  });

  it('места на прилавке меньше урожая — встаёт сколько влезло', () => {
    const state = emptyShelves(planted({ warehouse: {}, level: 4 }));
    const room = shelfRoomFor(state, 'apples');
    const tight = { ...state, shelves: state.shelves.map((s) => (canPlace('apples', s) ? { ...s, items: { apples: Array.from({ length: shelfCapacity(s) - 1 }, () => ({ age: 0 })) } } : s)) };
    const free = shelfRoomFor(tight, 'apples');
    expect(free).toBeGreaterThan(0);
    expect(free).toBeLessThan(room);
    const done = harvest(tight, NOW + GROW_MS)!;
    expect(done.got.reduce((n, g) => n + g.qty, 0)).toBe(free);
    expect(shelfRoomFor(done.state, 'apples')).toBe(0);
  });
});

describe('двор: грядки и культуры', () => {
  it('культуру можно сменить — рассада сажается заново, свои часы и свой урожай', () => {
    const state = emptyShelves(planted({ warehouse: {} }));
    expect(plant(state, 0, 'mix', NOW)).toBeNull();
    expect(plant(state, 1, 'quick', NOW)).toBeNull();
    const quick = plant(state, 0, 'quick', NOW + 1000)!;
    expect(bedsOf(quick)).toEqual([{ crop: 'quick', since: NOW + 1000 }]);
    expect(gardenRipe(quick, NOW + 1000 + growMs('quick') - 1)).toBe(false);
    const done = harvest(quick, NOW + 1000 + growMs('quick'))!;
    expect(done.got).toEqual([{ id: 'potatoes', qty: cropQty(quick, 'quick') }]);
    // Картошка — не яблоки: варенье «из своих яблок» не объявляем.
    expect(done.state.garden?.own).toBeUndefined();
    expect(bedsOf(done.state)[0].crop).toBe('quick');
  });

  it('длинная культура даёт за заход больше, за час — не больше короткой', () => {
    const state = shop({ level: 2 });
    const perHour = (crop: 'quick' | 'mix' | 'apples') => (cropQty(state, crop) * CROPS[crop].gives.length) / CROPS[crop].hours;
    expect(cropQty(state, 'apples')).toBeGreaterThan(cropQty(state, 'mix') * 2 - 1);
    expect(perHour('apples')).toBeLessThanOrEqual(perHour('mix'));
    expect(perHour('quick')).toBeLessThanOrEqual(perHour('mix'));
  });

  it('вторая и третья грядки — за деньги, собираются вместе со спелыми', () => {
    let state = emptyShelves(planted({ money: 5000, warehouse: {}, level: 3 }));
    state = addBed(state, NOW)!;
    expect(state.money).toBe(5000 - GARDEN_PRICE - BED_COSTS[0]);
    state = addBed(state, NOW)!;
    expect(addBed(state, NOW)).toBeNull();
    expect(bedsOf(state).map((b) => b.crop)).toEqual(['mix', 'quick', 'quick']);
    expect(gardenRipeAt(state)).toBe(NOW + growMs('quick'));
    // Через два часа спела только картошка: первая грядка растёт дальше со своего времени.
    const early = harvest(state, NOW + growMs('quick'))!;
    expect(early.got).toEqual([{ id: 'potatoes', qty: cropQty(state, 'quick') * 2 }]);
    expect(bedsOf(early.state)[0].since).toBe(NOW);
    expect(bedsOf(early.state)[1].since).toBe(NOW + growMs('quick'));
    expect(gardenLook(early.state, NOW + growMs('quick'))).not.toBe(gardenLook(state, NOW + growMs('quick')));
  });

  it('мусор в сохранении грядки не ломает', () => {
    const state = { ...planted(), garden: { since: NOW, harvests: 0, crop: 'cactus', more: [{ crop: 'apples', since: NOW }, { crop: 'x', since: 1 }, null] } } as unknown as StoreState;
    expect(bedsOf(state)).toEqual([{ crop: 'mix', since: NOW }, { crop: 'apples', since: NOW }]);
  });
});

describe('двор: полив друга и своё варенье', () => {
  it('полив приближает урожай на час, спелое не трогает', () => {
    const state = planted();
    const wet = water(state, NOW + 1000)!;
    expect(gardenLeft(wet, NOW + 1000)).toBe(gardenLeft(state, NOW + 1000) - WATER_MS);
    expect(wet.garden?.watered).toBe(1);
    expect(water(state, NOW + GROW_MS)).toBeNull();
    expect(water(shop(), NOW)).toBeNull();
  });

  it('после сбора яблок варенье пару дней — из своих (если линейка открыта)', () => {
    const done = harvest(emptyShelves(planted({ warehouse: {}, lines: { jam: 1 } })), NOW + GROW_MS)!;
    expect(ownJam(done.state)).toBe(true);
    expect(ownJam({ ...done.state, day: done.state.day + OWN_JAM_DAYS })).toBe(false);
    expect(ownJam({ ...done.state, lines: {} })).toBe(false);
  });
});
