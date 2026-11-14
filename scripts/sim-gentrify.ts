// Район дорожает (src/game/gentrify.ts, 13.11): что даёт каждый ответ на «для кого магазин» против прогона без механики.
// Игрок с благоустройством района (оно и поднимает престиж) — 150 дней, 8 прогонов на вариант.
//   npm run sim:gentrify

import { simulate, type SimOptions } from '../src/game/simulate';
import { prestigeOf } from '../src/game/gentrify';
import { hoodSpent } from '../src/game/hood';

const DAYS = 150;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const base: Omit<SimOptions, 'seed'> = { days: DAYS, features: { hood: true, departments: true, gear: true } };

function run(label: string, opts: Partial<SimOptions>): void {
  let money = 0;
  let profit = 0;
  let p = 0;
  let gone = 0;
  let asked = 0;
  let total = 0;
  let hood = 0;
  for (const seed of SEEDS) {
    const r = simulate({ ...base, ...opts, features: { ...base.features, ...opts.features }, seed });
    money += r.final.money;
    profit += r.days.slice(-30).reduce((s, d) => s + d.profit, 0) / 30;
    p += prestigeOf(r.final);
    gone += r.final.gentrify?.left?.length ?? 0;
    asked += r.final.gentrify?.day ?? 0;
    total += r.days.reduce((s, d) => s + d.profit, 0);
    hood += hoodSpent(r.final);
  }
  const n = SEEDS.length;
  console.log(`${label.padEnd(14)} деньги ${Math.round(money / n)}  прибыль за всё ${Math.round(total / n)}  район ${Math.round(hood / n)}  прибыль/день (посл. 30) ${Math.round(profit / n)}  престиж ${Math.round(p / n)}  уехали ${(gone / n).toFixed(1)}  выбор на день ${Math.round(asked / n)}`);
}

run('без механики', {});
run('для новых', { features: { gentrify: true }, gentrify: 'rich' });
run('для своих', { features: { gentrify: true }, gentrify: 'own' });
