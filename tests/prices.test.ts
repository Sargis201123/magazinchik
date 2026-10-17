import { describe, expect, it } from 'vitest';
import { newGame, priceAppeal, sellableProducts, PRODUCTS, type StoreState } from '../src/game/economy';
import { guestsToday } from '../src/game/day';
import { reviewsFor } from '../src/game/reviews';
import { emptyDayStats } from '../src/game/economy';

// Слава о ценах: дешёвый магазин зовёт больше гостей, дорогой — меньше.
const priced = (k: number): StoreState => {
  const s = { ...newGame(), rating: 3 };
  const prices = { ...s.prices };
  for (const id of sellableProducts(s)) prices[id] = Math.round(PRODUCTS[id].basePrice * k);
  return { ...s, prices };
};

describe('цены и гости', () => {
  it('по обычным ценам — как было; дешевле — больше гостей, дороже — меньше, в пределах ±15%', () => {
    expect(priceAppeal(priced(1))).toBeCloseTo(1, 2);
    expect(priceAppeal(priced(0.8))).toBeGreaterThan(1.1);
    expect(priceAppeal(priced(1.2))).toBeLessThan(0.9);
    expect(priceAppeal(priced(0.2))).toBe(1.15);
    expect(priceAppeal(priced(3))).toBe(0.85);
    expect(guestsToday(priced(0.8))).toBeGreaterThan(guestsToday(priced(1)));
  });

  it('за низкие цены хвалят в отзывах', () => {
    const stats = { ...emptyDayStats(), served: 3, notes: { cheap: 5 } };
    expect(reviewsFor(stats, 7).map((r) => r.topic)).toContain('cheap');
  });
});
