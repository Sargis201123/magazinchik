import { describe, expect, it } from 'vitest';
import {
  BEDS,
  CHEESE_MILK,
  CHEESE_TIME,
  COWS,
  COW_FILL,
  DAY_SECONDS,
  GRAIN_FULL,
  GROW,
  WATER_LAST,
  HAY_FULL,
  PLANS,
  YIELD,
  bedAction,
  buy,
  clock,
  feedGrain,
  feedHay,
  milk,
  pickEgg,
  pickGreenhouse,
  shakeTree,
  startCheese,
  startDay,
  summary,
  takeHoney,
  tapBed,
  tick,
  visitors,
  type Day,
} from '../src/game/lavka/day';

const sat = PLANS[0];

/** Игрок, который всё успевает: каждую секунду делает всё, что можно сделать на ферме. */
function busyFarmer(d: Day): Day {
  let x = d;
  for (let c = 0; c < COWS; c++) x = milk(x, c).day;
  if (x.hay <= 1) x = feedHay(x).day;
  for (const e of [...x.eggs]) x = pickEgg(x, e).day;
  if (x.grain <= 1) x = feedGrain(x).day;
  for (let b = 0; b < BEDS; b++) if (bedAction(x.beds[b]) !== 'growing') x = tapBed(x, b).day;
  for (let h = 0; h < x.hives.length; h++) x = takeHoney(x, h).day;
  for (let t = 0; t < x.trees.length; t++) x = shakeTree(x, t).day;
  x = pickGreenhouse(x).day;
  if (x.stock.milk > 6) x = startCheese(x).day;
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

  it('корову доят, когда полна; без сена молоко не прибывает', () => {
    let d = startDay(sat);
    expect(milk(d, 0).n).toBe(1);
    expect(milk(d, 2).n).toBe(0);
    d = { ...milk(d, 0).day, hay: 0 };
    d = tick(d, COW_FILL * 2);
    expect(d.cows[0]).toBe(0);
    d = feedHay(d).day;
    expect(d.hay).toBe(HAY_FULL);
    d = tick(d, COW_FILL);
    expect(milk(d, 0).n).toBe(1);
  });

  it('куры несутся, пока есть зерно; яйца собирают по одному', () => {
    let d: Day = { ...startDay(sat), eggs: [], grain: 0 };
    d = tick(d, 60);
    expect(d.eggs).toHaveLength(0);
    d = feedGrain(d).day;
    expect(d.grain).toBe(GRAIN_FULL);
    d = tick(d, 30);
    expect(d.eggs.length).toBeGreaterThan(0);
    const spot = d.eggs[0];
    const got = pickEgg(d, spot);
    expect(got.n).toBe(1);
    expect(got.day.stock.eggs).toBe(d.stock.eggs + 1);
    expect(pickEgg(got.day, spot).n).toBe(0);
  });

  it('грядка: посадить → полить → растёт → собрать', () => {
    let d = startDay(sat);
    const i = 2; // пустая
    expect(bedAction(d.beds[i])).toBe('plant');
    d = tapBed(d, i).day;
    d = { ...d, beds: d.beds.map((b, k) => (k === i ? { ...b, water: 0 } : b)) };
    expect(bedAction(d.beds[i])).toBe('water');
    d = tick(d, 10);
    expect(d.beds[i].grow).toBe(0); // сухая не растёт
    d = tapBed(d, i).day;
    d = tick(d, WATER_LAST / 2);
    expect(bedAction(d.beds[i])).toBe('growing');
    // поливать, пока не созреет: каждый полив — на WATER_LAST секунд роста
    for (let k = 0; k < Math.ceil(GROW / WATER_LAST) + 1 && bedAction(d.beds[i]) !== 'harvest'; k++) {
      if (bedAction(d.beds[i]) === 'water') d = tapBed(d, i).day;
      d = tick(d, WATER_LAST);
    }
    expect(bedAction(d.beds[i])).toBe('harvest');
    const got = tapBed(d, i);
    expect(got.n).toBe(YIELD);
    expect(bedAction(got.day.beds[i])).toBe('plant');
  });

  it('сыр: забирает молоко, через время — головка на складе', () => {
    let d: Day = { ...startDay(sat), stock: { milk: CHEESE_MILK, eggs: 0, veg: 0, honey: 0, cheese: 0 } };
    d = startCheese(d).day;
    expect(d.stock.milk).toBe(0);
    expect(startCheese(d).n).toBe(0);
    d = tick(d, CHEESE_TIME);
    expect(d.stock.cheese + d.orders.filter((o) => o.good === 'cheese').reduce((a, o) => a + o.have, 0)).toBe(1);
  });

  it('лавка продаёт со склада; нет товара — покупатель ушёл ни с чем', () => {
    let d: Day = { ...startDay(sat), stock: { milk: 1, eggs: 0, veg: 0, honey: 0, cheese: 0 } };
    const a = buy(d, 'milk', 2);
    expect(a.n).toBe(1);
    expect(a.coins).toBe(8);
    d = buy(a.day, 'eggs', 3).day;
    expect(d.missed.eggs).toBe(1);
  });

  it('собранное идёт сначала в заказ; набрал к сроку — премия, не успел — собранное на склад', () => {
    let d: Day = { ...startDay(sat), eggs: [0, 1, 2, 3, 4, 5, 6, 7] };
    const o = d.orders.find((x) => x.good === 'eggs')!;
    const before = d.stock.eggs;
    for (let e = 0; e < 8; e++) d = pickEgg(d, e).day;
    expect(d.stock.eggs).toBe(before);
    const done = d.orders.find((x) => x.id === o.id)!;
    expect(done.done).toBe(o.need <= 8);
    expect(d.coins).toBe(o.need * 3 + o.bonus);
    let late: Day = { ...startDay(sat), eggs: [0, 1, 2] };
    for (let e = 0; e < 3; e++) late = pickEgg(late, e).day;
    late = tick({ ...late, grain: 0 }, o.by + 1);
    expect(late.orders.find((x) => x.id === o.id)!.failed).toBe(true);
    expect(late.stock.eggs).toBe(before + 3);
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
