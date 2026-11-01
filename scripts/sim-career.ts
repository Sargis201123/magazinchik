// Сколько даёт карьера сотрудников (career.ts): npm run sim:career [дней] [прогонов]
// Парное сравнение с тем же зерном: игрок, который награждает лучших и соглашается на повышения,
// против того, кто карьеру не замечает. Прибыль поздней игры — за последние 30 дней.
import { simulate, type SimOptions } from '../src/game/simulate';

const days = Number(process.argv[2] ?? 250);
const runs = Number(process.argv[3] ?? 20);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const late = (r: ReturnType<typeof simulate>) => r.days.slice(-30).reduce((sum, d) => sum + d.profit, 0);

const pairs: [string, Partial<SimOptions>][] = [
  ['без филиала', { features: { gear: true, coffee: true, oven: true, kitchen: true } }],
  ['с филиалом и гипермаркетом', { features: { gear: true, coffee: true, oven: true, kitchen: true, branch: true, hyper: true } }],
];
for (const [name, base] of pairs) {
  const off = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, ...base }));
  const on = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, ...base, features: { ...base.features, career: true } }));
  const a = mean(off.map(late));
  const b = mean(on.map(late));
  const money = mean(on.map((r, i) => r.days[days - 1].money - off[i].days[days - 1].money));
  console.log(`${name}: прибыль за последние 30 дней ${Math.round(a)} → ${Math.round(b)} (${(((b - a) / Math.abs(a)) * 100).toFixed(1)}%), деньги к концу ${money >= 0 ? '+' : ''}${Math.round(money)}`);
}
