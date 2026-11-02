import { describe, expect, it } from 'vitest';
import { FIRST_STORM_DAY, MAX_CLEAR_STREAK, weatherFor } from '../src/game/weather';
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

describe('поставщики', () => {
  it('хлеб продаёт только фермер, не Зинаида', () => {
    expect(SUPPLIERS.farmer.products.bread).toBeDefined();
    expect(SUPPLIERS.dairy.products.bread).toBeUndefined();
  });
});
