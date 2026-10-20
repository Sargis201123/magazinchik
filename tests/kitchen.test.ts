import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { canCook, cook, DISHES, PORTIONS_MAX, portionsTotal, sellDish, spoilDishes } from '../src/game/kitchen';
import { layoutFor, KITCHEN_FROM } from '../src/scenes/layout';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const at = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  shelves: newGame().shelves.map((sh) => ({ ...sh, items: {} })),
  level: 3,
  upgrades: ['kitchen'],
  warehouse: { potatoes: units(10), meat: units(3), bread: units(5), milk: units(4), apples: units(1) },
  ...patch,
});

describe('кухня', () => {
  it('комната есть только в больших помещениях и стоит над кофейней', () => {
    expect(layoutFor(KITCHEN_FROM - 1).kitchen).toBeUndefined();
    for (const level of [KITCHEN_FROM, KITCHEN_FROM + 1]) {
      const l = layoutFor(level);
      expect(l.kitchen!.y + l.kitchen!.h).toBeLessThan(l.coffee.y);
      expect(l.kitchen!.y).toBeGreaterThanOrEqual(0);
      expect(l.wing.y).toBe(l.kitchen!.y);
    }
  });

  it('готовка тратит продукты со склада и даёт порции', () => {
    expect(canCook({ ...at(), upgrades: [] }, 'olivier')).toBe(false);
    const s = cook(at(), 'olivier')!;
    expect(s.warehouse.potatoes).toHaveLength(8);
    expect(s.warehouse.meat).toHaveLength(2);
    expect(portionsTotal(s)).toBe(DISHES.olivier.portions);
    // Не хватает яблок на вторые блины (на складе одно, на полках яблок нет).
    const p = cook(s, 'pancakes')!;
    expect(cook(p, 'pancakes')).toBeNull();
  });

  it('витрина не больше PORTIONS_MAX; продажа и списание ночью', () => {
    let s: StoreState = { ...at(), kitchen: { olivier: PORTIONS_MAX - 2 } };
    expect(canCook(s, 'borscht')).toBe(false);
    s = { ...at(), kitchen: { borscht: 1 } };
    expect(sellDish(s, () => 0.99)).toBeNull();
    const sold = sellDish(s, () => 0)!;
    expect(sold.dish).toBe('borscht');
    expect(sellDish(sold.state, () => 0)).toBeNull();
    expect(spoilDishes({ ...at(), kitchen: { olivier: 3 } })).toMatchObject({ spoiled: 3, state: { kitchen: {} } });
  });
});
