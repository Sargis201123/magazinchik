// Сколько дают новые механики: npm run sim:features [дней] [прогонов]
// Парное сравнение: каждый прогон «с механикой» идёт с тем же сидом, что и прогон без неё,
// а случайности механик берутся из отдельного генератора — так разница видна сквозь шум.
import { simulate, type SimOptions } from '../src/game/simulate';
import { STORE_LEVELS } from '../src/game/economy';

const days = Number(process.argv[2] ?? 100);
const runs = Number(process.argv[3] ?? 40);

const scenarios: [string, Partial<SimOptions>][] = [
  ['кот', { features: { cat: true } }],
  ['тележка', { features: { cart: true } }],
  ['карта лояльности', { features: { loyalty: true } }],
  ['электронные ценники', { features: { etags: true } }],
  ['новые отделы', { features: { departments: true } }],
  ['сладости у кассы', { features: { candy: true } }],
  ['кофе', { features: { coffee: true } }],
  ['печь', { features: { oven: true } }],
  ['ночная смена', { features: { night: true } }],
  ['всё оборудование', { features: { gear: true } }],
  ['кофе + печь', { features: { coffee: true, oven: true } }],
  ['кофе + печь + оборудование', { features: { coffee: true, oven: true, gear: true } }],
  ['война: сравнять цену', { war: 'match' }],
  ['война: реклама', { war: 'ad' }],
  ['всё сразу', { features: { cat: true, candy: true, coffee: true, oven: true, night: true, cart: true, loyalty: true, gear: true, etags: true, departments: true }, war: 'match' }],
];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const base = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1 }));
const money = base.map((r) => r.days[r.days.length - 1].money);
const sorted = [...money].sort((a, b) => a - b);
console.log(`${days} дней × ${runs} прогонов. Без новых механик (на войну — переждать):`);
console.log(`  деньги: хуже 10% — ${sorted[Math.floor(runs * 0.1)]}, медиана — ${sorted[runs >> 1]}, лучше 10% — ${sorted[Math.floor(runs * 0.9)]}`);
STORE_LEVELS.forEach((_, level) => {
  if (level === 0) return;
  const reached = base.map((r) => r.levelDay[level]).filter((d): d is number => d !== null);
  console.log(`  уровень ${level + 1}: ${reached.length}/${runs} прогонов, в среднем на ${Math.round(mean(reached))}-й день`);
});
console.log('\nМеханика                 деньги к концу (± ошибка)   лучше, чем без неё');
for (const [name, options] of scenarios) {
  const diff = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, ...options }).days[days - 1].money - money[i]);
  const m = mean(diff);
  const se = Math.sqrt(mean(diff.map((d) => (d - m) ** 2)) / runs);
  const pct = Math.round((m / mean(money)) * 100);
  console.log(`${name.padEnd(24)} ${(m >= 0 ? '+' : '') + Math.round(m)} ±${Math.round(se)} (${pct >= 0 ? '+' : ''}${pct}%)`.padEnd(52) + `${diff.filter((d) => d > 0).length}/${runs}`);
}
