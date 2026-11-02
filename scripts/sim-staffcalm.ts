// Темп после упрощения персонала и наказаний (02.11): npm run sim:calm [прогонов] [дней]
// Модель A (как в тестах): «Закупить нужное» одним нажатием, нанимает персонал, без механик.
// Печатает дни расширений, день «универмага» и деньги на 30/60/100-й день — до и после правки
// сравниваются по этому выводу (docs/BALANCE.md, «Спокойный персонал»).
import { simulate } from '../src/game/simulate';
import { STORE_LEVELS } from '../src/game/economy';

const runs = Number(process.argv[2] ?? 16);
const days = Number(process.argv[3] ?? 100);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

const results = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1 }));
console.log(`${runs} прогонов × ${days} дней, модель A (кнопка + персонал, без механик)`);
STORE_LEVELS.forEach((_, level) => {
  if (level === 0) return;
  const reached = results.map((r) => r.levelDay[level]).filter((d): d is number => d !== null);
  if (reached.length) console.log(`  ур.${level + 1}: ${reached.length}/${runs}, в среднем на ${mean(reached).toFixed(1)}-й день`);
});
for (const d of [30, 60, 100]) {
  if (d > days) continue;
  const money = results.map((r) => r.days[d - 1].money);
  console.log(`  деньги д.${d}: медиана ${Math.round(median(money))}, среднее ${Math.round(mean(money))}`);
}
const bankrupt = results.filter((r) => r.bankruptDay !== null).length;
console.log(`  банкротств: ${bankrupt}/${runs}`);
