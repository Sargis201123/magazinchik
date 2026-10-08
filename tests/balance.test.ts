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
    // Худший день из первых десяти, медиана по 10 прогонам: один сид слишком зависит от случая.
    const worst = Array.from({ length: 10 }, (_, i) =>
      Math.min(...simulate({ days: 10, seed: i + 1 }).days.slice(1).map((d) => d.profit)),
    ).sort((a, b) => a - b);
    expect(worst[5]).toBeLessThan(120);
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

describe('персонал', () => {
  const run = (hireStaff: boolean) => {
    const runs = 8;
    let money = 0;
    let l5 = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const r = simulate({ days: 100, seed, hireStaff });
      money += r.days[r.days.length - 1].money;
      l5 += r.levelDay[4] ?? 101;
    }
    return { money: money / runs, l5: l5 / runs };
  };
  const withStaff = run(true);
  const solo = run(false);

  it('с персоналом магазин зарабатывает намного больше', () => {
    expect(withStaff.money).toBeGreaterThan(solo.money * 2);
  });

  it('и до универмага с персоналом доходят быстрее', () => {
    expect(withStaff.l5).toBeLessThan(solo.l5);
  });
});

describe('новые механики', () => {
  // Каждая механика заметно помогает, но не ломает игру: деньги к 100-му дню растут, но не в разы.
  const money = (features: Parameters<typeof simulate>[0]['features']) => {
    const runs = 6;
    let sum = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const r = simulate({ days: 100, seed, features });
      sum += r.days[r.days.length - 1].money;
    }
    return sum / runs;
  };
  const base = money({});

  it.each([['cat'], ['candy'], ['coffee'], ['oven'], ['night']] as const)('%s — в плюс, но не больше чем вдвое', (feature) => {
    const m = money({ [feature]: true });
    expect(m).toBeGreaterThan(base);
    expect(m).toBeLessThan(base * 2);
  });

});
