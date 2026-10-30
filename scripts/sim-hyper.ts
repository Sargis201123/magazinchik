// Переезд в гипермаркет: когда покупают филиал и когда переезжают, за сколько дней переезд окупается,
// сколько потом приносят магазин и филиал. Парно с тем же сидом: филиал без переезда.
// npm run sim:hyper [дней] [прогонов] (по умолчанию 200 × 24; «Закупить нужное», персонал, филиал и переезд).
import { simulate } from '../src/game/simulate';
import { HYPER_LEVEL, STORE_LEVELS } from '../src/game/economy';

const days = Number(process.argv[2] ?? 200);
const runs = Number(process.argv[3] ?? 24);
const cost = STORE_LEVELS[HYPER_LEVEL].cost;
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : NaN);
const gaps: number[] = [];
const paybacks: number[] = [];
const ratios: number[] = [];
const rows: string[] = [];
let bankrupt = 0;
for (let seed = 1; seed <= runs; seed++) {
  const r = simulate({ days, seed, buyMode: 'restock', features: { branch: true, hyper: true } });
  const stay = simulate({ days, seed, buyMode: 'restock', features: { branch: true } });
  const branch = r.final.branch?.since ?? null;
  const hyper = r.levelDay[HYPER_LEVEL];
  if (r.bankruptDay) bankrupt++;
  if (branch && hyper) gaps.push(hyper - branch);
  // Окупаемость: прибавка к доходу дня (магазин + филиал) против того же сида без переезда покрыла цену.
  let extra = 0;
  let payback: number | null = null;
  for (const d of hyper ? r.days.filter((x) => x.day >= hyper) : []) {
    const s = stay.days[d.day - 1];
    extra += d.profit + d.branch - s.profit - s.branch;
    if (payback === null && extra >= cost) payback = d.day - hyper;
  }
  if (payback !== null) paybacks.push(payback);
  ratios.push(r.final.money / stay.final.money);
  const late = r.days.slice(-20);
  const net = late.reduce((s, d) => s + d.profit + d.branch, 0) / late.length;
  const br = late.reduce((s, d) => s + d.branch, 0) / late.length;
  rows.push(
    `сид ${seed}: ур.5 д.${r.levelDay[HYPER_LEVEL - 1]} · филиал д.${branch} · гипермаркет д.${hyper} · окупился за ${payback ?? '—'} дн. · деньги ${Math.round(r.final.money / 1000)}k (без переезда ${Math.round(stay.final.money / 1000)}k) · в день ${Math.round(net)} (филиал ${Math.round(br)})`,
  );
}
console.log(rows.join('\n'));
console.log(`\nГипермаркет ${cost}: переехали ${gaps.length}/${runs}, через ${Math.min(...gaps)}–${Math.max(...gaps)} дней после филиала, медиана ${med(gaps)}; банкротств ${bankrupt}`);
console.log(`Окупился у ${paybacks.length}/${gaps.length}: за ${Math.min(...paybacks)}–${Math.max(...paybacks)} дней, медиана ${med(paybacks)}; деньги в конце ×${med(ratios).toFixed(2)} к прогону без переезда`);
