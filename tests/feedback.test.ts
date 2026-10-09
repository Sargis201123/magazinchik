import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { FIRST_STORM_DAY, MAX_CLEAR_STREAK, weatherFor } from '../src/game/weather';
import { answerEvent, billAmount } from '../src/game/events';
import { SUPPLIERS } from '../src/game/suppliers';

describe('погода разнообразнее', () => {
  const days = Array.from({ length: 200 }, (_, i) => i + 1);
  it(`не больше ${MAX_CLEAR_STREAK} ясных дней подряд, первая гроза — на ${FIRST_STORM_DAY}-й день`, () => {
    let streak = 0;
    for (const d of days) {
      streak = weatherFor(d) === 'clear' ? streak + 1 : 0;
      if (d > 5) expect(streak).toBeLessThanOrEqual(MAX_CLEAR_STREAK);
    }
    expect(weatherFor(FIRST_STORM_DAY)).toBe('storm');
  });

  it('за первые три недели видно и дождь, и грозу, и листопад', () => {
    const first = days.slice(0, 21).map(weatherFor);
    expect(first).toContain('rain');
    expect(first).toContain('storm');
    expect(first).toContain('leaves');
  });
});

describe('неожиданный счёт', () => {
  const withBill = (patch: Partial<StoreState>): StoreState => ({
    ...newGame(),
    day: 20,
    debt: 0,
    plan: { day: 20, decided: false, inspection: false, quests: [], event: { kind: 'bill', reason: 'flood', amount: 400 } },
    ...patch,
  });

  it('заплатить сразу — уходят деньги', () => {
    const s = answerEvent(withBill({ money: 1000 }), true)!;
    expect(s.money).toBe(600);
    expect(s.debt).toBe(0);
  });

  it('без денег сразу не заплатить, но можно занять', () => {
    expect(answerEvent(withBill({ money: 100 }), true)).toBeNull();
    const s = answerEvent(withBill({ money: 100 }), false)!;
    expect(s.debt).toBe(400);
    expect(s.money).toBe(100);
  });

  it('в большом магазине и счёт больше', () => {
    expect(billAmount(4, 0.5)).toBeGreaterThan(billAmount(0, 0.5));
  });
});

describe('поставщики', () => {
  it('хлеб продаёт только фермер, не Зинаида', () => {
    expect(SUPPLIERS.farmer.products.bread).toBeDefined();
    expect(SUPPLIERS.dairy.products.bread).toBeUndefined();
  });
});
