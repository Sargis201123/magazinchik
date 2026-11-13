import { simulate } from '../../src/game/simulate';
import type { CrisisMode } from '../../src/game/crisis';

const days = Number(process.argv[2] ?? 200);
const seeds = Number(process.argv[3] ?? 1);
for (const mode of ['hold', 'gouge', 'give'] as CrisisMode[]) {
  let money = 0;
  const lines: string[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const log: string[] = [];
    let last = '';
    const res = simulate({
      days,
      seed,
      features: { tenants: true, garden: true },
      crisis: mode,
      onMorning: (s) => {
        // Разные магазины — разные зёрна (как в игре).
        const k = s.crisis ? `${s.crisis.kind}@${s.crisis.from}+${s.crisis.days}` : '';
        if (k && k !== last) log.push(k);
        last = k;
        if (s.crisisEnd && !s.crisisEnd.seen && s.day === s.crisisEnd.day)
          log.push(`end d${s.day} ${s.crisisEnd.mode} gw=${s.goodwill ?? 0} delta=${s.crisisEnd.delta} sold=${s.crisisEnd.sold} given=${s.crisisEnd.given}`);
      },
    });
    const end = res.days.at(-1)!;
    money += end.money;
    if (seed <= 2) lines.push(`  seed ${seed}: money ${end.money} lvl ${end.level} ★${end.rating.toFixed(2)} ${log.join(' | ')}`);
  }
  console.log(mode, 'avg money', Math.round(money / seeds));
  for (const l of lines) console.log(l);
}
