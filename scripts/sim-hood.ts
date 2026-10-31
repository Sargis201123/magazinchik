// Благоустройство района (hood.ts): когда игрок покупает улучшения и сколько успевает к 100/150/200/250-му
// дню. Два игрока: обычный («Закупить нужное», персонал, без новых механик) и игрок со всеми механиками,
// филиалом и переездом в гипермаркет. Парно с тем же сидом без района: во что обходятся траты.
// npm run sim:hood [дней] [прогонов] (по умолчанию 250 × 12).
import { simulate, type SimOptions } from '../src/game/simulate';
import { HOOD, HOOD_IDS } from '../src/game/hood';

const days = Number(process.argv[2] ?? 250);
const runs = Number(process.argv[3] ?? 12);
const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : NaN);
const ALL: SimOptions['features'] = {
  cat: true, candy: true, coffee: true, oven: true, night: true, cart: true, loyalty: true, gear: true, etags: true, departments: true,
  skills: true, radio: true, brand: true, cafe: true, delivery: true, kitchen: true, kiosks: true, branch: true, hyper: true,
};
const players: [string, Partial<SimOptions>][] = [
  ['обычный игрок', { buyMode: 'restock' }],
  ['все механики + филиал + гипермаркет', { buyMode: 'restock', features: ALL, war: 'match' }],
];
const checkpoints = [100, 150, 200, 250].filter((d) => d <= days);
for (const [name, options] of players) {
  const bought: Record<string, number[]> = Object.fromEntries(HOOD_IDS.map((id) => [id, []]));
  const counts = checkpoints.map(() => [] as number[]);
  const ratios: number[] = [];
  const spentAt: number[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    const r = simulate({ days, seed, ...options, features: { ...options.features, hood: true } });
    const base = simulate({ days, seed, ...options });
    const hood = r.final.hood ?? {};
    for (const id of HOOD_IDS) if (hood[id] !== undefined) bought[id].push(hood[id]!);
    checkpoints.forEach((c, i) => counts[i].push(HOOD_IDS.filter((id) => (hood[id] ?? Infinity) <= c).length));
    ratios.push(r.final.money / Math.max(1, base.final.money));
    spentAt.push(HOOD_IDS.reduce((s, id) => s + (hood[id] !== undefined ? HOOD[id].price : 0), 0));
  }
  console.log(`\n${name} (${days} дней × ${runs} прогонов):`);
  for (const id of HOOD_IDS) {
    const d = bought[id];
    console.log(`  ${HOOD[id].icon} ${id.padEnd(10)} ${String(HOOD[id].price).padStart(6)}: купили ${d.length}/${runs}${d.length ? `, медиана — ${med(d)}-й день` : ''}`);
  }
  console.log(`  куплено к дню: ${checkpoints.map((c, i) => `${c} — ${med(counts[i])}`).join(', ')} (медианы)`);
  console.log(`  потрачено на район: медиана ${med(spentAt)}; деньги в конце ×${med(ratios).toFixed(2)} к тому же игроку без района`);
}
