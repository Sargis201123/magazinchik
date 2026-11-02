// Темп игры до и после упрощения закупки (ветка nx-buy, 02.11): npm run sim:buy [прогонов] [дней]
// Модель A — «Закупить нужное» одним нажатием и найм персонала, без механик; «все» — с механиками симулятора.
// Печатает дни расширений (медиана), день универмага и деньги к 30/60/100-му дню (медианы).
import { simulate, type Feature, type SimOptions } from '../src/game/simulate';

const runs = Number(process.argv[2] ?? 16);
const days = Number(process.argv[3] ?? 100);

const ALL: Feature[] = ['candy', 'coffee', 'oven', 'night', 'cat', 'cart', 'loyalty', 'gear', 'departments', 'skills', 'radio', 'brand', 'cafe', 'kitchen', 'rush', 'delivery', 'ads', 'kiosks'];
const models: [string, Partial<SimOptions>][] = [
  ['A', {}],
  ['все', { features: Object.fromEntries(ALL.map((f) => [f, true])) }],
];

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

console.log(`прогонов: ${runs}, дней: ${days}`);
console.log('модель  ур.2  ур.3  ур.4  ур.5(универмаг)  деньги д.30  д.60  д.100  порча/день  банкрот');
for (const [name, extra] of models) {
  const out = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, buyMode: 'restock', hireStaff: true, ...extra }));
  const lvl = (l: number) => {
    const ds = out.map((r) => r.levelDay[l]).filter((x): x is number => x !== null && x !== undefined);
    return ds.length ? `${median(ds)}${ds.length < runs ? `(${ds.length})` : ''}` : '—';
  };
  const money = (d: number) => median(out.map((r) => r.days[d - 1]?.money ?? 0));
  const spoil = out.reduce((a, r) => a + r.days.reduce((s, d) => s + d.spoiled, 0) / r.days.length, 0) / runs;
  console.log(
    [
      name.padEnd(6),
      lvl(1).padStart(5),
      lvl(2).padStart(5),
      lvl(3).padStart(5),
      lvl(4).padStart(15),
      String(money(30)).padStart(12),
      String(money(60)).padStart(6),
      String(money(100)).padStart(7),
      spoil.toFixed(1).padStart(11),
      String(out.filter((r) => r.bankruptDay !== null).length).padStart(8),
    ].join(' '),
  );
}
