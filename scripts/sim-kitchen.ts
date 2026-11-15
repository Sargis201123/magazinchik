// Кухня в симуляторе (15.11): сколько порций продали, скольким не хватило, сколько списали и сколько ушло на продукты.
// npm run sim:kitchen [дней] [прогонов]
import { simulate } from '../src/game/simulate';
import type { StoreState } from '../src/game/economy';

const days = Number(process.argv[2] ?? 90);
const runs = Number(process.argv[3] ?? 6);
const features = { tenants: true, garden: true, apprentice: true, rental: true, kitchen: true, coffee: true, oven: true, gear: true };
const sum = { sold: 0, wanted: 0, spoiled: 0, spent: 0, days: 0, chef: 0 };
let money = 0;
for (let seed = 1; seed <= runs; seed++) {
  const r = simulate({
    days,
    seed,
    features,
    onMorning: (s: StoreState) => {
      const k = s.reports?.[s.reports.length - 1]?.kitchen;
      if (!k) return;
      sum.days++;
      sum.sold += k.sold;
      sum.wanted += k.wanted;
      sum.spoiled += k.spoiled;
      sum.spent += k.spent ?? 0;
      if (s.staff.some((m) => m.role === 'cook')) sum.chef++;
    },
  });
  money += r.final.money;
}
const per = (n: number) => (n / Math.max(1, sum.days)).toFixed(1);
console.log(`дней с кухней: ${sum.days} (с поваром ${sum.chef})`);
console.log(`в день: продано ${per(sum.sold)}, хотели ${per(sum.wanted)}, не хватило ${per(sum.wanted - sum.sold)}, списано ${per(sum.spoiled)}, продукты ${per(sum.spent)}`);
console.log(`деньги к концу (среднее): ${Math.round(money / runs)}`);
