import { describe, expect, it } from 'vitest';
import { averageLevelDays, simulate } from '../src/game/simulate';

// Баланс экономики: «разумный игрок» из симулятора должен расти не слишком быстро
// и не слишком медленно. Если тест упал после правки цифр — запусти `npm run sim`.
describe('баланс экономики', () => {
  // 24 прогона: на 12 интервалы плясали на день от шума погоды.
  const days = averageLevelDays(120, 24);

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

  // Шесть прогонов — шумно (точнее: npm run sim:features), поэтому проверяем только «не ломает».
  it.each([['cat'], ['candy'], ['coffee'], ['oven'], ['night'], ['kitchen']] as const)('%s — не в минус и не вдвое', (feature) => {
    const m = money({ [feature]: true });
    expect(m).toBeGreaterThan(base * 0.9);
    expect(m).toBeLessThan(base * 2);
  });

});

describe('кухня с поваром', () => {
  // Опытный игрок со всеми механиками: кухня (повар, продукты, списание) окупается, но главной статьёй не становится.
  const ALL = { candy: true, coffee: true, oven: true, night: true, cat: true, cart: true, loyalty: true, gear: true, etags: true, departments: true, skills: true, radio: true, brand: true, cafe: true, rush: true };
  const lateProfit = (kitchen: boolean) => {
    let sum = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const r = simulate({ days: 100, seed, features: { ...ALL, kitchen } });
      sum += r.days.slice(-14).reduce((s, d) => s + d.profit, 0) / 14;
    }
    return sum / 4;
  };

  it('прибыль в день к концу — не меньше, чем без кухни, и не больше чем на четверть', () => {
    const without = lateProfit(false);
    const withKitchen = lateProfit(true);
    expect(withKitchen).toBeGreaterThan(without * 0.98);
    expect(withKitchen).toBeLessThan(without * 1.25);
  });
});

describe('кнопка «Закупить нужное»', () => {
  // Игрок, который каждое утро жмёт одну кнопку, должен торговать не хуже новичка, берущего всего
  // поровну. Деньги на конкретный день шумят (их съедают расширения) — сравниваем выручку за 45 дней.
  const revenue = (buyMode: 'restock' | 'naive') => {
    let sum = 0;
    for (let seed = 1; seed <= 8; seed++) sum += simulate({ days: 45, seed, buyMode, hireStaff: true }).final.totalRevenue;
    return sum / 8;
  };

  it('с ней выручка за 45 дней больше, чем у новичка', () => {
    expect(revenue('restock')).toBeGreaterThan(revenue('naive'));
  });
});
