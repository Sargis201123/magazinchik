import { describe, expect, it } from 'vitest';
import {
  BEDS,
  COW_FILL,
  COW_YIELD,
  DAY_SECONDS,
  EGGS_MAX,
  GRAIN_FULL,
  HAY_FULL,
  PLANS,
  SEED,
  SEEDS,
  bedAction,
  buy,
  clock,
  feedGrain,
  feedHay,
  harvest,
  milkAll,
  nextDay,
  pickEggs,
  plant,
  plantAll,
  shakeTree,
  startDay,
  summary,
  takeHoney,
  tick,
  visitors,
  type Day,
} from '../src/game/lavka/day';

const sat = PLANS[0];

/** Игрок, который всё успевает: каждую секунду делает всё, что можно сделать на ферме. */
function busyFarmer(d: Day): Day {
  let x = milkAll(d).day;
  if (x.hay <= 1) x = feedHay(x).day;
  x = pickEggs(x).day;
  if (x.grain <= 1) x = feedGrain(x).day;
  for (let b = 0; b < BEDS; b++) if (bedAction(x.beds[b]) === 'harvest') x = harvest(x, b).day;
  x = plantAll(x, 'carrot').day;
  for (let h = 0; h < x.hives.length; h++) x = takeHoney(x, h).day;
  for (let t = 0; t < x.trees.length; t++) x = shakeTree(x, t).day;
  return x;
}

/** Весь день: ферма (ловкий игрок или ленивый) и покупатели по расписанию. */
function playDay(work: (d: Day) => Day, plan = sat, seed = 1): Day {
  let d = startDay(plan);
  const vs = visitors(plan, seed);
  for (let s = 0; s < DAY_SECONDS; s++) {
    d = work(tick(d, 1));
    while (vs.length && vs[0].at <= d.t) {
      const v = vs.shift()!;
      d = buy(d, v.wants, v.qty).day;
    }
  }
  return d;
}

describe('лавка: ферма', () => {
  it('день с 8:00 до 20:00', () => {
    expect(clock(0)).toBe('8:00');
    expect(clock(DAY_SECONDS)).toBe('20:00');
  });

  it('полную корову доят одним касанием; без сена молоко не прибывает', () => {
    let d: Day = { ...startDay(sat), cows: [1] };
    const got = milkAll(d);
    expect(got.n).toBe(COW_YIELD);
    expect(milkAll(got.day).n).toBe(0);
    d = { ...got.day, hay: 0 };
    d = tick(d, COW_FILL * 2);
    expect(d.cows[0]).toBe(0);
    d = feedHay(d).day;
    expect(d.hay).toBe(HAY_FULL);
    d = tick(d, COW_FILL);
    expect(milkAll(d).n).toBe(COW_YIELD);
  });

  it('коров станет больше — все полные доятся разом', () => {
    const d: Day = { ...startDay(sat), cows: [1, 0.5, 1] };
    const got = milkAll(d);
    expect(got.n).toBe(2 * COW_YIELD);
    expect(got.cows).toEqual([0, 2]);
    expect(got.day.cows).toEqual([0, 0.5, 0]);
  });

  it('куры несутся в гнёзда, пока есть зерно и место; яйца собирают все разом', () => {
    let d: Day = { ...startDay(sat), eggs: 0, grain: 0 };
    d = tick(d, 60);
    expect(d.eggs).toBe(0);
    d = feedGrain(d).day;
    expect(d.grain).toBe(GRAIN_FULL);
    d = tick(d, 200);
    expect(d.eggs).toBe(EGGS_MAX);
    const got = pickEggs(d);
    expect(got.n).toBe(EGGS_MAX);
    expect(got.day.eggs).toBe(0);
    expect(pickEggs(got.day).n).toBe(0);
  });

  it('грядка: выбрать семена → растёт своё время → собрать', () => {
    let d = startDay(sat);
    const i = d.beds.findIndex((b) => !b.seed);
    expect(bedAction(d.beds[i])).toBe('plant');
    d = plant(d, i, 'dill').day;
    expect(plant(d, i, 'carrot').n).toBe(0);
    d = tick(d, SEED.dill.grow - 1);
    expect(bedAction(d.beds[i])).toBe('growing');
    d = tick(d, 1);
    expect(bedAction(d.beds[i])).toBe('harvest');
    const got = harvest(d, i);
    expect(got.n).toBe(SEED.dill.yield);
    expect(bedAction(got.day.beds[i])).toBe('plant');
  });

  it('долгие семена дают больше за одно касание', () => {
    for (let k = 1; k < SEEDS.length; k++) {
      expect(SEED[SEEDS[k]].grow).toBeGreaterThan(SEED[SEEDS[k - 1]].grow);
      expect(SEED[SEEDS[k]].yield).toBeGreaterThan(SEED[SEEDS[k - 1]].yield);
    }
  });

  it('засеять все пустые грядки разом', () => {
    const d = startDay(sat);
    const empty = d.beds.filter((b) => !b.seed).length;
    const got = plantAll(d, 'pumpkin');
    expect(got.n).toBe(empty);
    expect(got.day.beds.every((b) => b.seed)).toBe(true);
    expect(plantAll(got.day, 'dill').n).toBe(0);
  });

  it('дни идут подряд: ферма, склад и монеты остаются, часы и заказы — новые', () => {
    let d = startDay(sat);
    d = plant(d, 2, 'pumpkin').day;
    d = { ...tick(d, 100), coins: 300, stock: { milk: 5, eggs: 0, veg: 9, honey: 2 } };
    const n = nextDay(d, PLANS[1]);
    expect(n.t).toBe(0);
    expect(n.coins).toBe(300);
    expect(n.startCoins).toBe(300);
    expect(n.beds[2]).toEqual(d.beds[2]);
    expect(n.cows).toEqual(d.cows);
    expect(n.orders.map((o) => o.id)).toEqual(PLANS[1].orders.map((o) => o.id));
    // утренний запас уходит в заказы, остальное — на складе
    const total = (x: typeof n) => Object.values(x.stock).reduce((a, b) => a + b, 0) + x.orders.reduce((a, o) => a + (o.done || o.failed ? 0 : o.have), 0);
    expect(total(n)).toBe(total(d));
    expect(summary(n).coins).toBe(0);
  });

  it('лавка продаёт со склада; нет товара — покупатель ушёл ни с чем', () => {
    let d: Day = { ...startDay(sat), stock: { milk: 1, eggs: 0, veg: 0, honey: 0 } };
    const a = buy(d, 'milk', 2);
    expect(a.n).toBe(1);
    expect(a.coins).toBe(8);
    d = buy(a.day, 'eggs', 3).day;
    expect(d.missed.eggs).toBe(1);
  });

  it('утренний запас и собранное идут сначала в заказ; набрал к сроку — премия, не успел — собранное на склад', () => {
    const start = startDay(sat);
    const o = start.orders.find((x) => x.good === 'eggs')!;
    expect(o.have).toBeGreaterThan(0); // утренние яйца уже отложены
    let d: Day = { ...start, eggs: o.need - o.have };
    const before = d.stock.eggs;
    d = pickEggs(d).day;
    expect(d.stock.eggs).toBe(before);
    expect(d.orders.find((x) => x.id === o.id)!.done).toBe(true);
    expect(d.coins).toBe(o.need * 3 + o.bonus);
    let late: Day = { ...start, eggs: 1 };
    late = pickEggs(late).day;
    late = tick({ ...late, grain: 0 }, o.by + 1);
    expect(late.orders.find((x) => x.id === o.id)!.failed).toBe(true);
    expect(late.stock.eggs).toBe(before + o.have + 1);
  });
});

describe('лавка: работа окупается', () => {
  it('кто работает на ферме, зарабатывает намного больше того, кто сидит', () => {
    for (const plan of PLANS) {
      const lazy = summary(playDay((d) => d, plan));
      const busy = summary(playDay(busyFarmer, plan));
      expect(busy.coins).toBeGreaterThan(lazy.coins * 2);
      expect(busy.stars).toBeGreaterThan(lazy.stars);
      expect(busy.ordersDone).toBeGreaterThan(0);
      expect(lazy.tip).not.toBe('good');
    }
  });

  it('у ловкого игрока все заказы дня выполнимы', () => {
    for (const plan of PLANS) expect(summary(playDay(busyFarmer, plan)).ordersDone).toBe(plan.orders.length);
  });
});
