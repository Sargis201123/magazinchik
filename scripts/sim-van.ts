// Выездная торговля (game/van.ts): тот же игрок с фургоном и без — деньги, помещения и сколько дал фургон.
// npm run sim:van [дней] [прогонов]
import { simulate } from '../src/game/simulate';

const days = Number(process.argv[2] ?? 100);
const runs = Number(process.argv[3] ?? 6);
const base = { tenants: true, garden: true };

let money = [0, 0];
const levels: number[][] = [[], []];
let trips = 0;
let earned = 0;
for (let seed = 1; seed <= runs; seed++) {
  [false, true].forEach((van, i) => {
    const run = simulate({ days, seed, features: { ...base, van } });
    money[i] += run.final.money;
    levels[i].push(...run.levelDay.map((d) => d ?? days + 1));
    if (van) {
      trips += run.final.van?.trips ?? 0;
      earned += run.final.van?.earned ?? 0;
    }
  });
}
money = money.map((m) => Math.round(m / runs));
const avgLevel = (list: number[], level: number) => Math.round(list.filter((_, k) => k % 6 === level).reduce((a, b) => a + b, 0) / runs);
console.log(`Деньги к ${days}-му дню: без фургона ${money[0]}, с фургоном ${money[1]}`);
for (let level = 1; level < 6; level++) console.log(`  помещение ${level + 1}: день ${avgLevel(levels[0], level)} → ${avgLevel(levels[1], level)}`);
console.log(`Фургон: в среднем ${Math.round(trips / runs)} выездов, ${Math.round(earned / runs)} 💰 чистыми (${Math.round(earned / Math.max(1, trips))} за выезд)`);
