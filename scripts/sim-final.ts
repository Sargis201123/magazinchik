// Финальная проверка баланса: много прогонов на полгода игры для разных стилей игрока.
// npm run sim:final [дней] [прогонов]
import { STORE_LEVELS } from '../src/game/economy';
import { CHAPTERS } from '../src/game/story';
import { simulate, type Feature, type SimOptions, type SimResult } from '../src/game/simulate';

const DAYS = Number(process.argv[2] ?? 180);
const RUNS = Number(process.argv[3] ?? 40);
const ALL: Partial<Record<Feature, boolean>> = Object.fromEntries(
  (['candy', 'coffee', 'oven', 'night', 'cat', 'cart', 'loyalty', 'gear', 'etags', 'departments', 'skills', 'radio', 'brand', 'cafe', 'kitchen', 'rush'] as Feature[]).map((f) => [f, true]),
);

const PROFILES: { name: string; opts: Omit<SimOptions, 'days' | 'seed'> }[] = [
  { name: 'Опытный (все механики)', opts: { features: ALL } },
  { name: 'Обычный (без доп. механик)', opts: {} },
  { name: 'Новичок (медленный, цены +10%)', opts: { queueLoss: 0.12, priceMult: 1.1 } },
  { name: 'Одиночка (без персонала)', opts: { hireStaff: false } },
];

const q = (xs: number[], p: number): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const fmt = (x: number | null) => (x === null ? '—' : String(Math.round(x)));
const trio = (xs: number[], of = RUNS) => `${fmt(q(xs, 0.5))} [${fmt(q(xs, 0.1))}…${fmt(q(xs, 0.9))}]${xs.length < of ? ` (${xs.length}/${of})` : ''}`;
const pct = (n: number) => `${Math.round((100 * n) / RUNS)}%`;

for (const profile of PROFILES) {
  const runs: SimResult[] = Array.from({ length: RUNS }, (_, i) => simulate({ days: DAYS, seed: i + 1, ...profile.opts }));
  console.log(`\n=== ${profile.name}: ${RUNS} прогонов × ${DAYS} дней ===`);
  console.log('Уровни магазина (медиана [10%…90%]):');
  STORE_LEVELS.forEach((_, lvl) => {
    if (lvl === 0) return;
    console.log(`  ур.${lvl + 1}: день ${trio(runs.map((r) => r.levelDay[lvl]).filter((d): d is number => d !== null))}`);
  });
  console.log(`Сюжет пройден (свободная игра): день ${trio(runs.map((r) => r.chapterDay[CHAPTERS.length]).filter((d): d is number => d !== null))}`);
  console.log(`Бабушка выручила: ${pct(runs.filter((r) => r.rescueDay !== null).length)} · банкротство: ${pct(runs.filter((r) => r.bankruptDay !== null).length)}`);
  for (const d of [30, 60, 90, 120, 180].filter((d) => d <= DAYS)) {
    const money = runs.map((r) => r.days[d - 1]?.money ?? 0);
    const profit = runs.map((r) => r.days.slice(Math.max(0, d - 7), d).reduce((s, x) => s + x.profit, 0) / 7);
    console.log(`  день ${String(d).padStart(3)}: деньги ${trio(money)}, прибыль в день ${trio(profit)}`);
  }
  const battle = runs.filter((r) => r.giant.some((g) => g.phase === 'battle'));
  const won = runs.map((r) => r.giant.find((g) => g.phase === 'won')?.day).filter((d): d is number => d !== undefined);
  console.log(`«Гигант»: дошли до битвы ${pct(battle.length)}, победили ${pct(won.length)} (день ${trio(won)}); проиграли хоть раз: ${pct(runs.filter((r) => r.giant.some((g) => g.phase === 'lost')).length)}`);
  const firstWin = runs.map((r) => r.contests.find((c) => c.won)?.day).filter((d): d is number => d !== undefined);
  const tries = runs.flatMap((r) => r.contests);
  console.log(
    `Конкурсы: первая победа у ${pct(firstWin.length)} (день ${trio(firstWin)}); попыток ${tries.length}, побед ${tries.filter((c) => c.won).length}; макс. звание: ${Math.max(0, ...runs.map((r) => r.final.contest?.wins ?? 0))}`,
  );
  const thefts = runs.flatMap((r) => r.burglaries);
  const stolen = thefts.filter((b) => b.outcome === 'stolen');
  console.log(
    `Ночные воры: ${(thefts.length / RUNS).toFixed(1)} за прогон; украли ${pct(runs.filter((r) => r.burglaries.some((b) => b.outcome === 'stolen')).length)} прогонов, потеря за кражу ${trio(stolen.map((b) => b.loss), stolen.length)}; Бобик прогнал ${thefts.filter((b) => b.outcome === 'dog').length}`,
  );
  console.log(`Рейтинг в конце: ${trio(runs.map((r) => r.final.rating * 10)).replace(/(\d+)/g, (m) => (Number(m) / 10).toFixed(1))}`);
}
