import { describe, expect, it } from 'vitest';
import { newGame, type StaffMember, type StoreState, type Unit } from '../src/game/economy';
import { bakerShouldBake, needsBaking, sellWholesale, setBakeMode, wholesaleToBake, WHOLESALE_BATCHES } from '../src/game/bakery';
import { ovenBatch } from '../src/game/gear';
import type { DayReport } from '../src/game/reports';

// Пекарня: печь по спросу (не в порчу), по максимуму или не печь хлеб; противни для соседей.
const baker: StaffMember = { role: 'baker', name: 0, skill: 1, wage: 400, months: 1 };
const report = (sold: number): DayReport => ({ day: 1, revenue: 0, served: 0, lost: 0, sold: { bread: sold }, spoiled: {}, pricey: {}, missing: {} });
const units = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));
const bakery = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  money: 5000,
  level: 2,
  upgrades: ['oven'],
  staff: [baker],
  shelves: [{ kind: 'bakery', level: 3, items: {} }, { kind: 'bakery', level: 3, items: {} }],
  warehouse: {},
  reports: [report(10), report(10), report(10)],
  ...patch,
});

describe('сколько хлеба печь', () => {
  it('по спросу: печёт, пока хлеба меньше, чем обычно разбирают; к вечеру — меньше', () => {
    expect(bakerShouldBake(bakery())).toBe(true);
    const plenty = bakery({ warehouse: { bread: units(20) } });
    expect(bakerShouldBake(plenty)).toBe(false);
    // Утром 12 буханок мало (разберут 10 + запас), вечером — хватит.
    const some = bakery({ warehouse: { bread: units(12) } });
    expect(needsBaking(some, 'bread', ovenBatch(some), 1)).toBe(true);
    expect(needsBaking(some, 'bread', ovenBatch(some), 0.2)).toBe(false);
  });

  it('«сколько влезет» — пока есть место; «не печь хлеб» — никогда', () => {
    const plenty = bakery({ warehouse: { bread: units(20) } });
    expect(bakerShouldBake(setBakeMode(plenty, 'full'))).toBe(true);
    expect(bakerShouldBake(setBakeMode(bakery(), 'off'))).toBe(false);
  });

  it('без истории продаж печёт как раньше', () => {
    expect(bakerShouldBake(bakery({ reports: [] }))).toBe(true);
  });
});

describe('хлеб соседям', () => {
  it('только с договором и пекарем, не больше противней в день; деньги — за буханки', () => {
    expect(wholesaleToBake(bakery(), 0)).toBe(false);
    const deal = bakery({ upgrades: ['oven', 'wholesale'] });
    expect(wholesaleToBake(deal, 0)).toBe(true);
    expect(wholesaleToBake(deal, WHOLESALE_BATCHES)).toBe(false);
    expect(wholesaleToBake({ ...deal, staff: [] }, 0)).toBe(false);
    const sold = sellWholesale(deal);
    expect(sold.state.money - deal.money).toBe(sold.pay);
    expect(sold.pay).toBeGreaterThan(0);
  });
});
