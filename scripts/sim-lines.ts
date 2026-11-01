// Своя марка на полках (lines.ts): npm run sim:lines [дней] [прогонов]
// Парное сравнение, как в sim-features: прогоны с линейками и без идут с одним сидом. Игрок —
// «всё сразу» (кухня, отделы, печь с маркой «От бабушки», оборудование). Показывает прибавку к деньгам
// и к прибыли последних 4 недель, когда в среднем открыта каждая ступень и за сколько недель окупается
// каждая линейка (по её доходу: выручка с её товара минус сырьё и банки).
import { simulate, type SimOptions, type SimResult } from '../src/game/simulate';
import { LINE_IDS, LINES, type LineId } from '../src/game/lines';
import { MONTH_DAYS } from '../src/game/economy';

const days = Number(process.argv[2] ?? 200);
const runs = Number(process.argv[3] ?? 20);
const ALL: SimOptions['features'] = { candy: true, coffee: true, oven: true, cart: true, loyalty: true, gear: true, etags: true, departments: true, skills: true, radio: true, brand: true, cafe: true, delivery: true, kitchen: true, kiosks: true };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
/** Стандартная ошибка среднего. */
const se = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)) / xs.length);
const tail = (r: SimResult, n: number) => r.days.slice(-n);
const LATE = MONTH_DAYS * 4;
const lateProfit = (r: SimResult) => tail(r, LATE).reduce((s, d) => s + d.profit, 0);

const base = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, features: ALL }));
const report = (name: string, lineIds: LineId[]) => {
  const res = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, features: { ...ALL, lines: true }, lineIds }));
  const dm = res.map((r, i) => r.days[days - 1].money - base[i].days[days - 1].money);
  const dp = res.map((r, i) => lateProfit(r) - lateProfit(base[i]));
  const pct = (mean(dp) / mean(base.map(lateProfit))) * 100;
  // Окупаемость: вложено в линейки / доход своей марки в день (выручка с её товаров минус сырьё и банки)
  // с первой продажи. Чистую прибавку (за вычетом того, что взяли бы вместо своего) показывает «прибыль 4 нед.».
  const invested = lineIds.reduce((s, id) => s + LINES[id].costs.reduce((a, b) => a + b, 0), 0);
  const paybacks = res.map((r) => {
    const from = r.days.findIndex((d) => d.lines > 0);
    return from < 0 ? Infinity : invested / mean(r.days.slice(from).map((d) => d.lines)) / MONTH_DAYS;
  });
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  const opened = res.map((r) => r.days.findIndex((d) => d.lines > 0)).filter((d) => d >= 0);
  const margin = mean(res.map((r) => mean(tail(r, LATE).map((d) => d.lines))));
  console.log(
    `${name.padEnd(8)} деньги ${mean(dm) >= 0 ? '+' : ''}${Math.round(mean(dm))} ±${Math.round(se(dm))} · прибыль 4 нед. ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% ±${((se(dp) / mean(base.map(lateProfit))) * 100).toFixed(1)} · ` +
      `первая продажа ~${Math.round(mean(opened))}-й день (${opened.length}/${runs}) · доход своей марки ${Math.round(margin)}/день · ` +
      `все ступени окупаются за ~${median(paybacks).toFixed(1)} нед.`,
  );
};

console.log(`${days} дней × ${runs} прогонов, игрок «всё сразу».`);
for (const id of LINE_IDS) report(id, [id]);
report('все', LINE_IDS);
