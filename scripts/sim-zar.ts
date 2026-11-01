// Баланс «Заречья» (src/game/zarechye.ts): тот же «разумный игрок», что и в sim-hyper (филиал и переезд),
// но после гипермаркета открывает лавку за рекой. Парное сравнение на тех же сидах — без Заречья.
//  · окупаемость помещений Заречья против средних помещений первого прохода (одинаковой меркой:
//    цена ÷ прибавка к дневной прибыли магазина — выручка − закупка − аренда, вода, свет, зарплаты за день);
//  · доход Центра без игрока против дохода филиала;
//  · прибыль поздней игры с Заречьем против без него (цель — не больше +25%).
// Цифры — docs/BALANCE.md «Заречье».
//
//   npm run sim:zar            (DAYS=320 SEEDS=4 — по умолчанию)
import { simulate, type SimDay, type SimResult } from '../src/game/simulate';
import { HYPER_LEVEL, STORE_LEVELS } from '../src/game/economy';
import { ZAR_LEVEL_COST, ZAR_MAX_LEVEL, ZAR_PRICE } from '../src/game/zarechye';

const DAYS = Number(process.env.DAYS ?? 320);
const SEEDS = Array.from({ length: Number(process.env.SEEDS ?? 4) }, (_, i) => i + 1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const op = (d: SimDay) => d.revenue - d.purchases - d.fixed;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const late = (r: SimResult, from: number) => r.days.filter((d) => d.day >= from).reduce((s, d) => s + d.profit + d.branch + d.home, 0);

const first: number[][] = [[], [], [], [], []];
const zarPay: number[][] = Array.from({ length: ZAR_MAX_LEVEL + 1 }, () => []);
const homeAvg: number[] = [];
const branchAvg: number[] = [];
const gain: Record<number, number[]> = { 1: [], 2: [], 3: [] };

for (const seed of SEEDS) {
  const base = { days: DAYS, seed, buyMode: 'restock' as const, features: { branch: true, hyper: true } };
  const stay = simulate(base);
  // Первый проход: окупаемость помещений 2…4 (минимаркет → универсам) — та же мерка.
  for (let l = 1; l <= 4; l++) {
    const at = (lv: number) => stay.days.filter((d) => d.level === lv && d.day > (stay.levelDay[lv] ?? 0) + 3).map(op);
    const delta = avg(at(l)) - avg(at(l - 1));
    first[l].push(delta > 0 ? STORE_LEVELS[l].cost / delta : Infinity);
  }
  // Заречье: прогоны с потолком помещения 0…3 (каждый день там), прибыль дня на 2–6-й неделе после открытия.
  const capped = Array.from({ length: ZAR_MAX_LEVEL + 1 }, (_, cap) => simulate({ ...base, zar: { from: 0, every: 1, cap } }));
  const opened = capped[0].zarLevelDay[0]!;
  const window = (r: SimResult) => avg(r.days.filter((d) => d.zar && d.day >= opened + 14 && d.day < opened + 42).map(op));
  for (let l = 1; l <= ZAR_MAX_LEVEL; l++) {
    const delta = window(capped[l]) - window(capped[l - 1]);
    zarPay[l].push(delta > 0 ? ZAR_LEVEL_COST[l] / delta : Infinity);
  }
  console.log(`сид ${seed}: гипермаркет — день ${stay.levelDay[HYPER_LEVEL]}, Заречье — день ${opened}; прибыль дня в Заречье по помещениям: ${capped.map((r) => Math.round(window(r))).join(' / ')}`);
  for (const every of [1, 2, 3]) {
    const go = every === 1 ? capped[ZAR_MAX_LEVEL] : simulate({ ...base, zar: { from: 0, every } });
    const from = go.zarLevelDay[0]!;
    const spent = ZAR_PRICE + ZAR_LEVEL_COST.slice(1).reduce((s, c, i) => s + (go.zarLevelDay[i + 1] ? c : 0), 0);
    const ratio = (late(go, from) - spent) / late(stay, from) - 1;
    gain[every].push(ratio);
    if (every === 2) {
      homeAvg.push(avg(go.days.filter((d) => d.zar).map((d) => d.home)));
      branchAvg.push(avg(go.days.filter((d) => d.day >= from).map((d) => d.branch)));
    }
  }
}
const fmt = (xs: number[]) => xs.map((x) => (Number.isFinite(x) ? Math.round(x) : '∞')).join(', ');
console.log('\nОкупаемость, дней (цена ÷ прибавка к дневной прибыли):');
for (let l = 2; l <= 4; l++) console.log(`  первый проход, ${STORE_LEVELS[l].cost} → помещение ${l + 1}: ${fmt(first[l])} (медиана ${Math.round(median(first[l]))})`);
for (let l = 1; l <= ZAR_MAX_LEVEL; l++) console.log(`  Заречье, ${ZAR_LEVEL_COST[l]} → помещение ${l + 1}: ${fmt(zarPay[l])} (медиана ${Math.round(median(zarPay[l]))}) — в днях работы там`);
console.log(`\nЦентр без игрока: ${Math.round(avg(homeAvg))} 💰/день; филиал №2: ${Math.round(avg(branchAvg))} 💰/день`);
for (const every of [1, 2, 3]) console.log(`Прибыль поздней игры (с вложениями в Заречье), в Заречье ${every === 1 ? 'каждый день' : `каждый ${every}-й день`}: ${gain[every].map((x) => `${(x * 100).toFixed(1)}%`).join(', ')}`);
