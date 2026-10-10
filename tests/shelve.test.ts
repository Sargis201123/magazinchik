import { describe, expect, it } from 'vitest';
import { buyStock, newGame, onShelves, shelfFree, shelveAll, warehouseOf, type StoreState } from '../src/game/economy';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 5000, ...patch });

describe('купленное сразу на полки, лишнее — на склад', () => {
  it('закупка раскладывается до заполнения полки, остаток остаётся на складе', () => {
    const s = shop();
    const free = s.shelves.filter((sh) => sh.kind === 'bakery').reduce((n, sh) => n + shelfFree(sh), 0);
    const bought = shelveAll(buyStock(s, 'bread', free + 5, 10)!);
    expect(onShelves(bought, 'bread')).toBe(onShelves(s, 'bread') + free);
    expect(warehouseOf(bought, 'bread')).toBe(warehouseOf(s, 'bread') + 5);
  });

  it('на полку идёт самое старое, брак ждёт решения на складе', () => {
    const s = shop({
      shelves: newGame().shelves.map((sh) => ({ ...sh, items: {} })),
      warehouse: { bread: [{ age: 1 }, { age: 0 }], apples: [{ age: 0, bad: true, pending: true }] },
    });
    const next = shelveAll(s);
    const shelf = next.shelves.find((sh) => sh.kind === 'bakery')!;
    expect(shelf.items.bread?.[0].age).toBe(1);
    expect(warehouseOf(next, 'apples')).toBe(1);
    expect(onShelves(next, 'apples')).toBe(0);
  });
});
