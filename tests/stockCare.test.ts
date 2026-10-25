import { describe, expect, it } from 'vitest';
import { donationRating, emptyDayStats, endDay, newGame, toggleDonate, type StoreState, type Unit } from '../src/game/economy';

const units = (n: number, age = 0): Unit[] => Array.from({ length: n }, () => ({ age }));

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
