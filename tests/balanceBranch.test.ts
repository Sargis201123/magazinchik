import { describe, expect, it } from 'vitest';
import { simulate } from '../src/game/simulate';
import { BRANCH_PRICE } from '../src/game/branch';

// Баланс филиала (branch.ts): «разумный игрок» жмёт «Закупить нужное», нанимает людей и после победы
// над «Гигантом» покупает здание, а потом — выгодные улучшения. Парное сравнение: тот же сид
// без филиала. Если тест упал после правки цифр — запусти `npm run sim:features`.
describe('баланс филиала', () => {
  const DAYS = 200;
  const runs = [1, 2, 3, 4].map((seed) => ({
    without: simulate({ days: DAYS, seed, buyMode: 'restock' }),
    with: simulate({ days: DAYS, seed, buyMode: 'restock', features: { branch: true } }),
  }));

  it('здание покупают вскоре после победы над «Гигантом» и улучшают', () => {
    for (const r of runs) {
      const branch = r.with.final.branch;
      expect(branch).toBeDefined();
      const wonDay = r.with.giant.find((g) => g.phase === 'won')!.day;
      expect(branch!.since - wonDay).toBeLessThanOrEqual(15);
      // Ступени окупаются за 15–40 дней — «разумный игрок» берёт все двенадцать.
      expect(Object.values(branch!.tiers ?? {}).reduce((a, b) => a + (b ?? 0), 0)).toBe(12);
    }
  });

  // Окупаемость и поздний доход — где филиалу дали хотя бы три месяца (на сиде 3 «Гигант» сдаётся лишь к 172-му дню).
  const long = runs.filter((r) => r.with.final.branch!.since <= DAYS - 90);

  it('окупается: к концу филиал принёс больше, чем в него вложили', () => {
    expect(long.length).toBeGreaterThanOrEqual(3);
    for (const r of long) {
      const branch = r.with.final.branch!;
      const spent = r.with.days.filter((d) => d.day >= branch.since - 1).reduce((s, d) => s + d.investments, 0) - (r.without.days.filter((d) => d.day >= branch.since - 1).reduce((s, d) => s + d.investments, 0));
      expect(spent).toBeGreaterThanOrEqual(BRANCH_PRICE);
      expect(branch.earned!).toBeGreaterThan(spent);
      // И денег в итоге больше, чем без филиала.
      expect(r.with.final.money).toBeGreaterThan(r.without.final.money);
    }
  });

  it('деньги не уходят в минус и в долг из-за покупок', () => {
    for (const r of runs) {
      const since = r.with.final.branch!.since;
      for (const d of r.with.days.filter((x) => x.day >= since)) {
        expect(d.money).toBeGreaterThanOrEqual(0);
        expect(d.debt).toBe(0);
      }
    }
  });

  it('доход в поздней игре вырастает примерно в полтора раза, а не вдвое', () => {
    for (const r of long) {
      const since = r.with.final.branch!.since;
      // Чистый доход в день (магазин + филиал) за 20 дней после всех улучшений — против того же сида без филиала.
      const from = Math.max(141, since + 30);
      const net = (days: typeof r.with.days) => {
        const late = days.filter((d) => d.day >= from && d.day < from + 20);
        return late.reduce((s, d) => s + d.profit + d.branch, 0) / late.length;
      };
      const ratio = net(r.with.days) / net(r.without.days);
      expect(ratio).toBeGreaterThan(1.4);
      expect(ratio).toBeLessThan(1.7);
      // И за день филиал приносит меньше, чем сам магазин зарабатывает.
      const late = r.with.days.slice(-30);
      expect(late.reduce((s, d) => s + d.branch, 0)).toBeLessThan(late.reduce((s, d) => s + d.profit, 0));
    }
  });
});
