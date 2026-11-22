// Предел зала (hall.ts): как меняется игра, если гостей не больше, чем пропускает зал.
// npm run sim:hall [дней] [прогонов]
import { STORE_LEVELS } from '../src/game/economy';
import { simulate, type SimOptions } from '../src/game/simulate';

const days = Number(process.argv[2] ?? 150);
const runs = Number(process.argv[3] ?? 10);
const features = { tenants: true, garden: true, apprentice: true, rental: true };

function measure(opts: Partial<SimOptions>) {
  const per = STORE_LEVELS.map(() => ({ n: 0, wanted: 0, guests: 0, served: 0, lost: 0, revenue: 0, profit: 0, spoiled: 0 }));
  const reach: (number | null)[][] = STORE_LEVELS.map(() => []);
  const money: number[] = [];
  for (let r = 0; r < runs; r++) {
    const res = simulate({ days, seed: r + 1, features, ...opts });
    for (const d of res.days) {
      const p = per[d.level];
      p.n++; p.wanted += d.wanted; p.guests += d.guests; p.served += d.served; p.lost += d.lost;
      p.revenue += d.revenue; p.profit += d.profit; p.spoiled += d.spoiled;
    }
    res.levelDay.forEach((day, l) => reach[l].push(day));
    money.push(res.days[res.days.length - 1].money);
  }
  return { per, reach, money: Math.round(money.reduce((a, b) => a + b, 0) / runs) };
}

const show = (title: string, m: ReturnType<typeof measure>) => {
  console.log(`\n${title}: денег к дню ${days} в среднем ${m.money}`);
  console.log('ур  дошли(из)  ср.день  звали  зашло  обсл  ушли  выручка  прибыль  порча');
  m.per.forEach((p, l) => {
    const got = m.reach[l].filter((x): x is number => x !== null);
    const avg = (v: number) => String(p.n ? Math.round(v / p.n) : '-');
    console.log(
      [
        String(l + 1).padStart(2),
        `${got.length}/${runs}`.padStart(10),
        (got.length ? String(Math.round(got.reduce((a, b) => a + b, 0) / got.length)) : '-').padStart(8),
        avg(p.wanted).padStart(6), avg(p.guests).padStart(6), avg(p.served).padStart(5), avg(p.lost).padStart(5),
        avg(p.revenue).padStart(8), avg(p.profit).padStart(8), avg(p.spoiled).padStart(6),
      ].join(' '),
    );
  });
};

show('Как сейчас (без предела зала)', measure({}));
show('С пределом зала', measure({ hall: true }));

const ALL = Object.fromEntries(
  ['candy', 'coffee', 'oven', 'night', 'cat', 'loyalty', 'gear', 'departments', 'radio', 'brand', 'cafe', 'kitchen', 'rush', 'tenants', 'garden', 'apprentice', 'rental', 'lottery', 'ads'].map((f) => [f, true]),
);
show('Опытный (все механики), без предела', measure({ features: ALL }));
show('Опытный (все механики), с пределом зала', measure({ features: ALL, hall: true }));
