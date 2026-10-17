import { describe, expect, it } from 'vitest';
import { donationRating, emptyDayStats, endDay, newGame, toggleDonate, type StoreState, type Unit } from '../src/game/economy';
import { autoOrderPlan, autoTarget, AUTO_RESERVE } from '../src/game/reorder';
import type { DayReport } from '../src/game/reports';

const units = (n: number, age = 0): Unit[] => Array.from({ length: n }, () => ({ age }));
const report = (milk: number): DayReport => ({ day: 1, revenue: 0, served: 0, lost: 0, sold: { milk }, spoiled: {}, pricey: {}, missing: {} });

describe('автозаказ по продажам', () => {
  const base = (patch: Partial<StoreState> = {}): StoreState => ({
    ...newGame(),
    money: 5000,
    level: 2,
    upgrades: ['autoOrder'],
    autoOrder: { on: true, lines: [{ sid: 'dairy', pid: 'milk', qty: 5 }] },
    shelves: [{ kind: 'dairy', level: 1, items: { milk: units(4) } }],
    warehouse: {},
    ...patch,
  });
  const price = () => 30;

  it('без истории — до количества из списка, считая полки', () => {
    expect(autoOrderPlan(base(), price)!.lines[0].qty).toBe(1);
  });

  it('с историей — сколько обычно продают (с запасом) минус то, что уже есть', () => {
    const s = base({ reports: [report(10), report(10), report(10)] });
    expect(autoTarget(s, { sid: 'dairy', pid: 'milk', qty: 5 })).toBe(Math.ceil(10 * AUTO_RESERVE));
    expect(autoOrderPlan(s, price)!.lines[0].qty).toBe(Math.ceil(10 * AUTO_RESERVE) - 4);
  });
});

describe('просрочка — в приют', () => {
  it('отдали испорченное — рейтинг подрос; выбросили — нет', () => {
    const s: StoreState = { ...newGame(), rating: 3, warehouse: { bread: units(20, 5) }, shelves: [] };
    const thrown = endDay(s, emptyDayStats(), () => 0.5).state.rating;
    const given = endDay(toggleDonate(s), emptyDayStats(), () => 0.5).state.rating;
    expect(given - thrown).toBeCloseTo(donationRating(20), 5);
    expect(donationRating(20)).toBeGreaterThan(0);
    expect(donationRating(1000)).toBe(0.06);
  });
});
