// Переезд в гипермаркет: когда покупают филиал и когда переезжают, сколько потом приносят магазин и филиал.
// npm run sim:hyper [дней] [прогонов] (по умолчанию 200 × 24; «Закупить нужное», персонал, филиал и переезд).
import { simulate } from '../src/game/simulate';
import { HYPER_LEVEL, STORE_LEVELS } from '../src/game/economy';

const days = Number(process.argv[2] ?? 200);
const runs = Number(process.argv[3] ?? 24);
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : NaN);
const gaps: number[] = [];
const rows: string[] = [];
let bankrupt = 0;
for (let seed = 1; seed <= runs; seed++) {
  const r = simulate({ days, seed, buyMode: 'restock', features: { branch: true, hyper: true } });
  const branch = r.final.branch?.since ?? null;
  const hyper = r.levelDay[HYPER_LEVEL];
  if (r.bankruptDay) bankrupt++;
  if (branch && hyper) gaps.push(hyper - branch);
  const late = r.days.slice(-20);
  const net = late.reduce((s, d) => s + d.profit + d.branch, 0) / late.length;
  const br = late.reduce((s, d) => s + d.branch, 0) / late.length;
  rows.push(`сид ${seed}: ур.5 д.${r.levelDay[HYPER_LEVEL - 1]} · филиал д.${branch} · гипермаркет д.${hyper} · деньги ${Math.round(r.final.money / 1000)}k · в день ${Math.round(net)} (филиал ${Math.round(br)})`);
}
console.log(rows.join('\n'));
console.log(`\nГипермаркет ${STORE_LEVELS[HYPER_LEVEL].cost}: переехали ${gaps.length}/${runs}, через ${Math.min(...gaps)}–${Math.max(...gaps)} дней после филиала, медиана ${med(gaps)}; банкротств ${bankrupt}`);
