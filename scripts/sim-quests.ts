// Задания дня и активные моменты против прибыли дня: npm run sim:quests [дней] [прогонов]
// Две ветки на одних и тех же сидах: игрок ловит моменты (как в игре) и не ловит вовсе.
import { simulate } from '../src/game/simulate';
import { SIM_CATCH } from '../src/game/moments';

const days = Number(process.argv[2] ?? 150);
const runs = Number(process.argv[3] ?? 12);
for (const hireStaff of [false, true]) {
  const money = { on: 0, off: 0 };
  const by = new Map<number, { profit: number; quests: number; n: number }>();
  for (let seed = 1; seed <= runs; seed++) {
    money.off += simulate({ days, seed, hireStaff, momentCatch: 0 }).final.money / runs;
    const r = simulate({ days, seed, hireStaff, momentCatch: SIM_CATCH });
    money.on += r.final.money / runs;
    for (const d of r.days) {
      const row = by.get(d.level) ?? { profit: 0, quests: 0, n: 0 };
      row.profit += d.profit;
      row.quests += d.quests;
      row.n++;
      by.set(d.level, row);
    }
  }
  const delta = ((money.on / money.off - 1) * 100).toFixed(1);
  console.log(`\n${hireStaff ? 'с персоналом' : 'один'}: деньги к ${days}-му дню ${Math.round(money.on)} (без моментов ${Math.round(money.off)}, ${delta}%)`);
  console.log('ур  дней  прибыль/день  задания/день  доля');
  for (const [level, r] of [...by].sort((a, b) => a[0] - b[0])) {
    const p = r.profit / r.n;
    const q = r.quests / r.n;
    console.log(`${String(level + 1).padStart(2)} ${String(r.n).padStart(5)} ${p.toFixed(0).padStart(13)} ${q.toFixed(0).padStart(13)} ${((100 * q) / Math.max(1, p)).toFixed(1).padStart(5)}%`);
  }
}
