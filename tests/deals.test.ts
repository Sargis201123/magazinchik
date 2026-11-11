import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { DEAL_CUTS, dealPrice, dealsToday } from '../src/game/deals';

// «Предложение дня» (deals.ts): скидки на 2–3 товара, только при закупке руками.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 12, seed: 5, ...over });

describe('предложение дня', () => {
  it('два-три товара со скидками 20/15/10%, в тот же день — те же', () => {
    const deals = dealsToday(shop());
    const cuts = Object.values(deals).sort();
    expect(cuts.length).toBeGreaterThanOrEqual(1);
    expect(cuts.length).toBeLessThanOrEqual(DEAL_CUTS.length);
    for (const c of cuts) expect(DEAL_CUTS).toContain(c);
    expect(dealsToday(shop())).toEqual(deals);
  });

  it('в другие дни — другие товары', () => {
    const days = Array.from({ length: 10 }, (_, i) => JSON.stringify(dealsToday(shop({ day: 12 + i }))));
    expect(new Set(days).size).toBeGreaterThan(3);
  });

  it('цена со скидкой ниже, без скидки — та же', () => {
    const s = shop();
    const deals = dealsToday(s);
    const [pid, cut] = Object.entries(deals)[0] as [keyof typeof deals, number];
    expect(dealPrice(s, pid, 100)).toBe(Math.round(100 * (1 - cut)));
    const other = (['bread', 'milk', 'apples', 'potatoes', 'meat'] as const).find((p) => !deals[p]);
    if (other) expect(dealPrice(s, other, 100)).toBe(100);
  });
});
