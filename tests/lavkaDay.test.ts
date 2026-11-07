import { describe, expect, it } from 'vitest';
import {
  BUS_AT,
  CANS,
  PLANS,
  CASE_CHEESE,
  DAY_SECONDS,
  SHELF_MILK,
  available,
  carryCheese,
  cheeseReadyAt,
  clock,
  miss,
  pay,
  restockMilk,
  startDay,
  summary,
  take,
  tick,
  tired,
  visitors,
  type Day,
  type Good,
} from '../src/game/lavka/day';

/** Ловкий игрок: доливает молоко и носит сыр сразу, на кассе никто не ждёт. Сколько заработает за день. */
function perfectDay(cheeseCans: number, seed = 1, plan = PLANS[0]): Day {
  let d = startDay(cheeseCans);
  for (const v of visitors(plan, seed)) {
    d = tick(d, v.at - d.t);
    d = carryCheese(d).day;
    d = restockMilk(d).day;
    const got = take(d, v.wants, v.qty);
    if (!got.n) {
      d = miss(d, v.wants);
      continue;
    }
    d = got.day;
    const basket = [{ good: v.wants, n: got.n }];
    if (v.extra) {
      const more = take(d, v.extra, 1);
      if (more.n) {
        d = more.day;
        basket.push({ good: v.extra, n: 1 });
      }
    }
    d = pay(d, basket).day;
  }
  return tick(d, DAY_SECONDS);
}

describe('лавка: часы и сыр', () => {
  it('день с 8:00 до 20:00, час — 15 секунд', () => {
    expect(clock(0)).toBe('8:00');
    expect(clock(45)).toBe('11:00');
    expect(clock(DAY_SECONDS)).toBe('20:00');
    expect(clock(BUS_AT)).toBe('11:00');
    expect(clock(PLANS[0].trains[0].at)).toBe('15:00');
  });

  it('малая партия сыра успевает к автобусу, большая — нет', () => {
    expect(cheeseReadyAt(0)).toBe(Infinity);
    expect(cheeseReadyAt(1)).toBeLessThan(BUS_AT);
    expect(cheeseReadyAt(2)).toBeLessThan(BUS_AT);
    expect(cheeseReadyAt(3)).toBeGreaterThan(BUS_AT);
    expect(cheeseReadyAt(4)).toBeGreaterThan(cheeseReadyAt(3));
  });

  it('утром: сыр кратно трём бидонам, остальное молоко — бутылками, полка полная', () => {
    const d = startDay(7);
    expect(d.cheeseCans).toBe(6);
    expect(d.heads).toBe(2);
    expect(d.milkShelf).toBe(SHELF_MILK);
    expect(d.milkShelf + d.milkIce).toBe((CANS - 6) * 2);
    expect(startDay(99).heads).toBe(4);
    expect(startDay(-3).heads).toBe(0);
  });

  it('сыр зреет, потом его относят на витрину — не больше, чем влезает', () => {
    let d = startDay(12);
    d = tick(d, cheeseReadyAt(4) - 1);
    expect(d.cheeseReady).toBe(0);
    d = tick(d, 2);
    expect(d.cheeseReady).toBe(4);
    expect(available(d, 'cheese')).toBe(0);
    const carried = carryCheese(d);
    expect(carried.n).toBe(Math.min(4, CASE_CHEESE));
    expect(available(carried.day, 'cheese')).toBe(carried.n);
  });

  it('молоко доливается из ледника до полной полки', () => {
    let d = startDay(0);
    d = take(d, 'milk', 4).day;
    const r = restockMilk(d);
    expect(r.n).toBe(4);
    expect(r.day.milkShelf).toBe(SHELF_MILK);
    expect(restockMilk(r.day).n).toBe(0);
  });

  it('не дождался — товар вернулся на полку', () => {
    let d = startDay(0);
    d = take(d, 'milk', 2).day;
    d = tired(d, [{ good: 'milk', n: 2 }]);
    expect(d.milkShelf).toBe(SHELF_MILK);
    expect(d.tired).toBe(1);
  });
});

describe('лавка: решение утра', () => {
  it('покупатели одни и те же для одного дня; автобус — за сыром, электричка — за молоком', () => {
    expect(visitors(PLANS[0], 3)).toEqual(visitors(PLANS[0], 3));
    const vs = visitors(PLANS[0], 1);
    const want = (from: string, g: Good) => vs.filter((v) => v.from === from && v.wants === g).length;
    expect(want('bus', 'cheese')).toBeGreaterThanOrEqual(2);
    expect(want('train', 'milk')).toBeGreaterThanOrEqual(3);
  });

  it('ни крайность не лучшая: середина приносит больше, чем «всё на сыр» и «всё в молоко»', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const coins = [0, 3, 6, 9, 12].map((c) => perfectDay(c, seed).coins);
      const best = Math.max(...coins);
      expect(coins.indexOf(best)).toBeGreaterThan(0);
      expect(coins.indexOf(best)).toBeLessThan(4);
    }
  });

  it('у каждого дня свой лучший ответ: в воскресенье туристов больше — сыра выгоднее больше, в понедельник — меньше', () => {
    const best = (plan: (typeof PLANS)[number]) => {
      const sum = [0, 3, 6, 9, 12].map((c) => [1, 2, 3, 4, 5].reduce((a, seed) => a + perfectDay(c, seed, plan).coins, 0));
      return [0, 3, 6, 9, 12][sum.indexOf(Math.max(...sum))];
    };
    const [sat, sun, mon] = PLANS.map(best);
    expect(sun).toBeGreaterThan(mon);
    expect(sat).toBeGreaterThan(mon);
  });

  it('итоги: скисшее молоко, оставшийся сыр, звёзды и совет', () => {
    const all = summary(perfectDay(12, 2));
    expect(all.sour).toBe(0);
    expect(all.missedTotal).toBeGreaterThan(0);
    expect(all.tip).toBe('cheeseLate');
    const none = summary(perfectDay(0));
    expect(none.cheeseLeft).toBe(0);
    expect(['moreCheese', 'cheeseLate', 'lessMilk']).toContain(none.tip);
    const mid = summary(perfectDay(6));
    expect(mid.stars).toBeGreaterThanOrEqual(1);
    expect(mid.stars).toBeLessThanOrEqual(5);
    expect(mid.happy).toBeGreaterThan(all.happy);
    expect(pay(startDay(0), [{ good: 'cheese', n: 1 }, { good: 'milk', n: 2 }]).coins).toBe(76);
  });
});
