import { describe, expect, it } from 'vitest';
import { averageLevelDays, simulate } from '../src/game/simulate';

// Баланс экономики: «разумный игрок» из симулятора должен расти не слишком быстро
// и не слишком медленно. Если тест упал после правки цифр — запусти `npm run sim`.
describe('баланс экономики', () => {
  const days = averageLevelDays(120, 12);

  it('первое расширение — примерно через 8–15 дней', () => {
    expect(days[1]).toBeGreaterThanOrEqual(8);
    expect(days[1]).toBeLessThanOrEqual(15);
  });

  it('каждое следующее расширение даётся дольше', () => {
    for (let i = 2; i < days.length; i++) {
      expect(days[i]).not.toBeNull();
      expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(days[1]! - 1);
    }
  });

  it('универмаг — не раньше 40-го дня', () => {
    expect(days[days.length - 1]).toBeGreaterThanOrEqual(40);
  });

  it('первые дни — тяжёлые: бывают дни почти без прибыли', () => {
    const early = simulate({ days: 10, seed: 3 }).days.slice(1);
    expect(Math.min(...early.map((d) => d.profit))).toBeLessThan(120);
  });
});

describe('цены', () => {
  const run = (priceMult: number) => {
    const runs = 10;
    let day = 0;
    for (let seed = 1; seed <= runs; seed++) day += simulate({ days: 90, seed, priceMult }).levelDay[3] ?? 99;
    return day / runs;
  };

  it('задирать цены невыгодно: супермаркет откроется позже, чем при честных ценах', () => {
    expect(run(1.3)).toBeGreaterThan(run(1));
  });

  it('демпинг тоже невыгоден', () => {
    expect(run(0.8)).toBeGreaterThan(run(1));
  });
});
