import { describe, expect, it } from 'vitest';
import { simulate } from '../src/game/simulate';
import { HYPER_LEVEL } from '../src/game/economy';

// Баланс переезда в гипермаркет (economy.ts HYPER_LEVEL): «разумный игрок» жмёт «Закупить нужное»,
// нанимает людей, после победы над «Гигантом» покупает филиал, улучшает его и копит на переезд.
// Парное сравнение: тот же сид с филиалом, но без переезда. Цифры — docs/BALANCE.md «Гипермаркет»;
// если тест упал после правки цен — запусти `npm run sim:hyper`.
describe('баланс гипермаркета', () => {
  const DAYS = 200;
  const runs = [1, 2, 3, 4].map((seed) => ({
    stay: simulate({ days: DAYS, seed, buyMode: 'restock', features: { branch: true } }),
    move: simulate({ days: DAYS, seed, buyMode: 'restock', features: { branch: true, hyper: true } }),
  }));
  const moved = (r: (typeof runs)[number]) => r.move.levelDay[HYPER_LEVEL]!;

  it('переезжают за 200 дней, обычно через 3–5 недель после филиала', () => {
    const gaps = runs.map((r) => {
      expect(r.move.levelDay[HYPER_LEVEL]).not.toBeNull();
      // Без механики «гипермаркет» в симуляторе не переезжают (и в старых тестах всё как было).
      expect(r.stay.levelDay[HYPER_LEVEL]).toBeNull();
      return moved(r) - r.move.final.branch!.since;
    });
    for (const g of gaps) expect(g).toBeLessThanOrEqual(40);
    // Если «Гигант» сдался только с реванша, денег к покупке филиала уже много — тогда переезд сразу.
    const median = [...gaps].sort((a, b) => a - b)[gaps.length >> 1];
    expect(median).toBeGreaterThanOrEqual(21);
    expect(median).toBeLessThanOrEqual(35);
  });

  it('пауза перед гипермаркетом длиннее, чем перед универмагом', () => {
    for (const r of runs) {
      const d = r.move.levelDay;
      expect(moved(r) - d[HYPER_LEVEL - 1]!).toBeGreaterThan(d[HYPER_LEVEL - 1]! - d[HYPER_LEVEL - 2]!);
    }
  });

  it('после переезда — без банкротства, долгов и минуса', () => {
    for (const r of runs) {
      expect(r.move.bankruptDay).toBeNull();
      for (const d of r.move.days.filter((x) => x.day >= moved(r))) {
        expect(d.money).toBeGreaterThanOrEqual(0);
        expect(d.debt).toBe(0);
      }
    }
  });

  it('филиал в старом магазине приносит столько же, сколько до переезда', () => {
    for (const r of runs) {
      const h = moved(r);
      if (h - r.move.final.branch!.since < 14) continue;
      const avg = (a: number, b: number) => {
        const days = r.move.days.filter((x) => x.day >= a && x.day < b);
        return days.reduce((s, x) => s + x.branch, 0) / days.length;
      };
      const ratio = avg(h + 10, h + 40) / avg(h - 10, h);
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(1.15);
    }
  });

  it('в поздней игре доход дня растёт на 10–40%, а не взлетает', () => {
    for (const r of runs) {
      const net = (days: typeof r.move.days) => {
        const late = days.slice(-20);
        return late.reduce((s, d) => s + d.profit + d.branch, 0) / late.length;
      };
      const ratio = net(r.move.days) / net(r.stay.days);
      expect(ratio).toBeGreaterThan(1.1);
      expect(ratio).toBeLessThan(1.4);
    }
  });
});
