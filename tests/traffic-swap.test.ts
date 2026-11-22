// «Трафик v2» (22.11): гость «на бегу» при пустой полке берёт похожее из того же отдела (traffic.ts substitute).
import { describe, expect, it } from 'vitest';
import { newGame, type ProductId, type StoreState } from '../src/game/economy';
import { quickPick, substitute } from '../src/game/traffic';

/** Полка напитков: воды n штук, сока нет. */
function drinks(water: number): StoreState {
  const s = newGame();
  const shelf = { kind: 'drinks', level: 1, items: { water: Array.from({ length: water }, () => ({ age: 0 })) } };
  return { ...s, shelves: [shelf as StoreState['shelves'][number]], prices: { ...s.prices, water: 25, juice: 50 } };
}

describe('замена товара у гостя на бегу', () => {
  it('нет сока — предлагает воду с той же полки отдела', () => {
    expect(substitute(drinks(5), 'juice', new Set<ProductId>(['juice']))).toBe('water');
  });

  it('похожего нет или он уже в корзине — замены нет', () => {
    expect(substitute(drinks(0), 'juice', new Set<ProductId>(['juice']))).toBeNull();
    expect(substitute(drinks(5), 'juice', new Set<ProductId>(['juice', 'water']))).toBeNull();
  });

  it('согласился на замену — уходит с водой, а не ни с чем', () => {
    const pick = quickPick(drinks(5), ['juice'], () => 0);
    expect(pick.cart.map((c) => c.id)).toEqual(['water']);
    expect(pick.why).toBeUndefined();
  });

  it('не согласился — уходит, как раньше: пустая полка', () => {
    const pick = quickPick(drinks(5), ['juice'], () => 0.99);
    expect(pick.cart).toEqual([]);
    expect(pick.why).toBe('empty');
  });
});
