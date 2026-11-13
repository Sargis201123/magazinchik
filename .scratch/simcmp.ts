import { averageLevelDays, simulate } from '../src/game/simulate';
import { averageLevelDays as oldAvg, simulate as oldSim } from '../src/game/simulateOld';
const features = { tenants: true, garden: true };
for (const [name, sim, avg] of [
  ['new', simulate, averageLevelDays],
  ['old', oldSim, oldAvg],
] as const) {
  for (const seed of [1, 2, 3]) {
    const { days } = sim({ days: 120, seed, features });
    const sum = (k: 'served' | 'lost' | 'revenue' | 'profit') => days.reduce((a, d) => a + d[k], 0);
    console.log(name, seed, 'served', sum('served'), 'lost', sum('lost'), 'revenue', sum('revenue'), 'profit', sum('profit'), 'money', days.at(-1)!.money, 'level', days.at(-1)!.level);
  }
  console.log(name, 'levelDays', JSON.stringify(avg(120, 12, features)));
}
