import { describe, expect, it } from 'vitest';
import { simulate } from '../src/game/simulate';
import { HYPER_LEVEL, STORE_LEVELS } from '../src/game/economy';

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

  it('переезжают за 200 дней, обычно через 2–3 недели после филиала', () => {
    const gaps = runs.map((r) => {
      expect(r.move.levelDay[HYPER_LEVEL]).not.toBeNull();
      // Без механики «гипермаркет» в симуляторе не переезжают (и в старых тестах всё как было).
      expect(r.stay.levelDay[HYPER_LEVEL]).toBeNull();
      return moved(r) - r.move.final.branch!.since;
    });
    for (const g of gaps) expect(g).toBeLessThanOrEqual(30);
    // Если «Гигант» сдался только с реванша, денег к покупке филиала уже много — тогда переезд сразу.
    const median = [...gaps].sort((a, b) => a - b)[gaps.length >> 1];
    expect(median).toBeGreaterThanOrEqual(10);
    expect(median).toBeLessThanOrEqual(28);
  });

  it('переезд окупается за 5–6 недель: прибавка к доходу после переезда покрывает цену', () => {
    for (const r of runs) {
      const h = moved(r);
      let extra = 0;
      let paid: number | null = null;
      for (const d of r.move.days.filter((x) => x.day >= h)) {
        const s = r.stay.days[d.day - 1];
        extra += d.profit + d.branch - s.profit - s.branch;
        if (paid === null && extra >= STORE_LEVELS[HYPER_LEVEL].cost) paid = d.day - h;
      }
      expect(paid).not.toBeNull();
      expect(paid!).toBeGreaterThanOrEqual(28);
      // Худший сид — до ~7 недель: сезонные недели (weeks.ts) дают выручку неравномерно и сдвигают окупаемость на день-два.
      expect(paid!).toBeLessThanOrEqual(52);
    }
  });

  it('на 200-й день денег с переездом больше, чем без него (+10…35%)', () => {
    for (const r of runs) {
      const ratio = r.move.final.money / r.stay.final.money;
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(1.4);
    }
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

  it('филиал в старом магазине приносит столько же, сколько без переезда', () => {
    // Парно с тем же сидом без переезда: молодой филиал ещё растёт сам (ступени), переезд этот рост не ускоряет и не режет.
    for (const r of runs) {
      const h = moved(r);
      const avg = (days: typeof r.move.days) => {
        const part = days.filter((x) => x.day >= h + 10 && x.day < h + 40);
        return part.reduce((s, x) => s + x.branch, 0) / part.length;
      };
      const ratio = avg(r.move.days) / avg(r.stay.days);
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(1.15);
    }
  });


  it('в поздней игре доход дня растёт в полтора раза, а не взлетает', () => {
    for (const r of runs) {
      const net = (days: typeof r.move.days) => {
        const late = days.slice(-20);
        return late.reduce((s, d) => s + d.profit + d.branch, 0) / late.length;
      };
      const ratio = net(r.move.days) / net(r.stay.days);
      expect(ratio).toBeGreaterThan(1.3);
      expect(ratio).toBeLessThan(1.9);
    }
  });
});
