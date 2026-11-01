import { describe, expect, it } from 'vitest';
import { simulate, type SimDay } from '../src/game/simulate';
import { ZAR_LEVEL_COST, ZAR_MAX_LEVEL, ZAR_PRICE } from '../src/game/zarechye';

// Баланс «Заречья» (zarechye.ts): игрок из sim-hyper после гипермаркета открывает лавку за рекой.
// Цифры — docs/BALANCE.md «Заречье»; если тест упал после правки цен — запусти `npm run sim:zar`.
describe('баланс Заречья', () => {
  const DAYS = 200;
  const seeds = [1, 2];
  const base = (seed: number) => ({ days: DAYS, seed, buyMode: 'restock' as const, features: { branch: true, hyper: true } });
  const op = (d: SimDay) => d.revenue - d.purchases - d.fixed;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

  it('помещения Заречья окупаются за дни, как средние помещения первого прохода (до ~6 недель)', () => {
    for (const seed of seeds) {
      const capped = Array.from({ length: ZAR_MAX_LEVEL + 1 }, (_, cap) => simulate({ ...base(seed), zar: { from: 0, every: 1, cap } }));
      const opened = capped[0].zarLevelDay[0]!;
      expect(opened).not.toBeNull();
      const window = (i: number) => avg(capped[i].days.filter((d) => d.zar && d.day >= opened + 14 && d.day < opened + 42).map(op));
      for (let l = 1; l <= ZAR_MAX_LEVEL; l++) {
        const gain = window(l) - window(l - 1);
        expect(gain).toBeGreaterThan(0);
        expect(ZAR_LEVEL_COST[l] / gain).toBeLessThan(45);
      }
    }
  });

  it('Центр без игрока приносит не меньше филиала, а вся поздняя игра с Заречьем — не больше +25%', () => {
    for (const seed of seeds) {
      const stay = simulate(base(seed));
      const go = simulate({ ...base(seed), zar: { from: 0, every: 2 } });
      const from = go.zarLevelDay[0]!;
      const zarDays = go.days.filter((d) => d.zar);
      expect(avg(zarDays.map((d) => d.home))).toBeGreaterThanOrEqual(avg(go.days.filter((d) => d.day >= from).map((d) => d.branch)));
      const late = (r: typeof go) => r.days.filter((d) => d.day >= from).reduce((s, d) => s + d.profit + d.branch + d.home, 0);
      const spent = ZAR_PRICE + ZAR_LEVEL_COST.slice(1).reduce((s, c, i) => s + (go.zarLevelDay[i + 1] ? c : 0), 0);
      const ratio = (late(go) - spent) / late(stay);
      expect(ratio).toBeLessThan(1.25);
      // Заречье — для интереса, но не разорение: проседает не больше чем на треть.
      expect(ratio).toBeGreaterThan(0.7);
      expect(go.bankruptDay).toBeNull();
    }
  });
});
