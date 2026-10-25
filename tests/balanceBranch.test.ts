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
      expect(Object.values(branch!.tiers ?? {}).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThanOrEqual(4);
    }
  });

  it('окупается: к концу филиал принёс больше, чем в него вложили', () => {
    for (const r of runs) {
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

  it('доход в поздней игре вырастает, но не больше чем вдвое', () => {
    for (const r of runs) {
      const since = r.with.final.branch!.since;
      // Сколько денег прибавилось с покупки до конца — с филиалом и без (те же случайности).
      const gain = (days: typeof r.with.days) => days.at(-1)!.money - days[since - 1].money;
      const ratio = gain(r.with.days) / gain(r.without.days);
      expect(ratio).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThanOrEqual(2);
      // И за день филиал приносит меньше, чем сам магазин выручает.
      const late = r.with.days.slice(-30);
      const branch = late.reduce((s, d) => s + d.branch, 0);
      const revenue = late.reduce((s, d) => s + d.revenue, 0);
      expect(branch).toBeLessThan(revenue);
    }
  });
});
