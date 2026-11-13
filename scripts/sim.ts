// Печатает баланс экономики: npm run sim [дней] [прогонов]
import { STORE_LEVELS } from '../src/game/economy';
import { averageLevelDays, simulate } from '../src/game/simulate';

const days = Number(process.argv[2] ?? 120);
const runs = Number(process.argv[3] ?? 20);

// Игрок сдаёт комнаты флигеля и ведёт бабушкин двор (simulate.ts, features tenants и garden) — как в игре с 11.11;
// с 13.11 ещё и учит учеников (apprentice): за 150 дней — три лавки-друга, денег к концу ≈ +5%.
const features = { tenants: true, garden: true, apprentice: true };
const { days: log } = simulate({ days, seed: 1, features });
console.log('день ур  деньги   долг  ★    гости обсл ушли выручка закупка расходы прибыль вложения порча');
for (const d of log.filter((x) => x.day <= 12 || x.day % 5 === 0)) {
  console.log(
    [
      String(d.day).padStart(4),
      String(d.level + 1).padStart(3),
      String(d.money).padStart(7),
      String(d.debt).padStart(6),
      d.rating.toFixed(1).padStart(4),
      String(d.guests).padStart(6),
      String(d.served).padStart(5),
      String(d.lost).padStart(5),
      String(d.revenue).padStart(7),
      String(d.purchases).padStart(8),
      String(d.expenses).padStart(8),
      String(d.profit).padStart(8),
      String(d.investments).padStart(8),
      String(d.spoiled).padStart(6),
    ].join(' '),
  );
}

console.log(`\nСредний день достижения уровня (${runs} прогонов, ${days} дней):`);
averageLevelDays(days, runs, features).forEach((day, level) =>
  console.log(`  ${level + 1}. ${STORE_LEVELS[level].nameKey}: ${day === null ? 'не достигнут' : `день ${day}`}`),
);
