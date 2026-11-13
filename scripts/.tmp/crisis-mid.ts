import { simulate } from '../../src/game/simulate';
import type { CrisisMode } from '../../src/game/crisis';

// Середина игры: беда на 87-й день (зерно 2) — сколько денег к концу беды и через месяц.
const seed = Number(process.argv[2] ?? 2);
for (const mode of ['hold', 'gouge', 'give'] as CrisisMode[]) {
  const res = simulate({ days: 140, seed, features: { tenants: true, garden: true }, crisis: mode });
  const at = (d: number) => res.days.find((x) => x.day === d)!;
  const span = (a: number, b: number) => res.days.filter((x) => x.day >= a && x.day <= b);
  const sum = (a: number, b: number, f: (x: (typeof res.days)[number]) => number) => span(a, b).reduce((s, x) => s + f(x), 0);
  console.log(
    mode.padEnd(6),
    'd86', at(86).money,
    'd91', at(91).money,
    'd120', at(120).money,
    'd140', at(140).money,
    '| rev 87-90', sum(87, 90, (x) => x.revenue),
    'guests 91-120', sum(91, 120, (x) => x.guests),
    'rev 91-120', sum(91, 120, (x) => x.revenue),
    'lvl', at(140).level,
  );
}
