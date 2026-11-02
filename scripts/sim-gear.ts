// Замер упрощения оборудования (02.11): npm run sim:gear [дней] [прогонов]
// Модель A (по умолчанию в simulate: «Закупить нужное» + найм) без механик, с оборудованием и «всё сразу»:
// дни расширений, день «универмага» (5-е помещение), деньги к 60-му и 100-му дню (медианы).
import { simulate, type SimOptions } from '../src/game/simulate';
import { STORE_LEVELS } from '../src/game/economy';

const days = Number(process.argv[2] ?? 100);
const runs = Number(process.argv[3] ?? 16);

const scenarios: [string, Partial<SimOptions>][] = [
  ['A (без механик)', {}],
  ['A + оборудование', { features: { gear: true } }],
  ['A + кофе + печь', { features: { coffee: true, oven: true } }],
  ['A + оборуд. + кофе + печь', { features: { gear: true, coffee: true, oven: true } }],
  ['A + печь + марка', { features: { oven: true, brand: true } }],
  ['всё сразу', { features: { cat: true, candy: true, coffee: true, oven: true, night: true, loyalty: true, gear: true, etags: true, departments: true, skills: true, radio: true, brand: true, cafe: true, delivery: true, kitchen: true, kiosks: true }, war: 'match' }],
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};
for (const [name, options] of scenarios) {
  const res = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, ...options }));
  const levels = STORE_LEVELS.slice(1, 5).map((_, k) => {
    const got = res.map((r) => r.levelDay[k + 1]).filter((d): d is number => d !== null);
    return `ур.${k + 2}: ${got.length ? median(got) : '—'} (${got.length}/${runs})`;
  });
  const at = (d: number) => median(res.map((r) => r.days[Math.min(d, r.days.length) - 1].money));
  console.log(`${name.padEnd(28)} ${levels.join(' · ')} · деньги д60 ${at(60)} · д100 ${at(100)}`);
}
