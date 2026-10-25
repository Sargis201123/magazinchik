// Сравнение способов утренней закупки: «разумный игрок» (знает спрос дня), кнопка «Закупить нужное»,
// автозаказ (сам закупает утром в лимите и подвозит днём) и новичок, который держит всего поровну.
// Запуск: npm run sim:restock
import { simulate } from '../src/game/simulate';

const SEEDS = 20;
const DAYS = 60;
const modes = ['smart', 'restock', 'auto', 'naive'] as const;

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(`прогонов: ${SEEDS}, дней: ${DAYS}\n`);
console.log('режим     деньги д.30  деньги д.60  1-е расшир.  2-е расшир.  3-е расшир.  выручка/день  порча/день  ушли/день  банкрот');
for (const buyMode of modes) {
  const runs = Array.from({ length: SEEDS }, (_, i) => simulate({ days: DAYS, seed: i + 1, buyMode, hireStaff: true }));
  const money = (d: number) => median(runs.map((r) => r.days[d - 1]?.money ?? 0));
  const lvl = (l: number) => {
    const ds = runs.map((r) => r.levelDay[l]).filter((x): x is number => x !== null && x !== undefined);
    return ds.length ? `${avg(ds).toFixed(1)} (${ds.length}/${SEEDS})` : '—';
  };
  const perDay = (f: (d: (typeof runs)[0]['days'][0]) => number) => avg(runs.map((r) => avg(r.days.map(f))));
  console.log(
    [
      buyMode.padEnd(9),
      String(money(30)).padStart(11),
      String(money(60)).padStart(12),
      lvl(1).padStart(12),
      lvl(2).padStart(12),
      lvl(3).padStart(12),
      perDay((d) => d.revenue).toFixed(0).padStart(13),
      perDay((d) => d.spoiled).toFixed(1).padStart(11),
      perDay((d) => d.lost).toFixed(1).padStart(10),
      String(runs.filter((r) => r.bankruptDay !== null).length).padStart(8),
    ].join(' '),
  );
}
