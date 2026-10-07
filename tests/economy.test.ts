import { describe, expect, it } from 'vitest';
import {
  buyChance,
  checkout,
  endDay,
  newGame,
  restock,
  restockCost,
  SHELF_CAPACITY,
  takeFromShelf,
} from '../src/game/economy';
import { detectLang } from '../src/i18n/detect';

describe('buyChance', () => {
  it('падает с ростом цены и не выходит за границы', () => {
    expect(buyChance(2, 4)).toBe(1);
    expect(buyChance(4, 4)).toBe(0.75);
    expect(buyChance(8, 4)).toBe(0.25);
    expect(buyChance(100, 4)).toBe(0.05);
  });
});

describe('restock', () => {
  it('дозаполняет полки и списывает деньги', () => {
    const s = newGame();
    const cost = restockCost(s);
    const next = restock(s)!;
    expect(next.money).toBe(s.money - cost);
    expect(Object.values(next.stock).every((n) => n === SHELF_CAPACITY)).toBe(true);
  });

  it('не даёт уйти в минус', () => {
    expect(restock({ ...newGame(), money: 0 })).toBeNull();
  });
});

describe('продажа', () => {
  it('товар убывает с полки, деньги приходят на кассе', () => {
    let s = { ...newGame(), stock: { bread: 1, milk: 0, apples: 0 } };
    s = takeFromShelf(s, 'bread')!;
    expect(s.stock.bread).toBe(0);
    expect(takeFromShelf(s, 'bread')).toBeNull();
    const { state, total } = checkout(s, ['bread']);
    expect(total).toBe(s.prices.bread);
    expect(state.money).toBe(s.money + total);
  });
});

describe('endDay', () => {
  it('рейтинг растёт от довольных покупателей и падает от ушедших', () => {
    const s = newGame();
    expect(endDay(s, { revenue: 0, served: 10, lost: 0 }).rating).toBeGreaterThan(s.rating);
    expect(endDay(s, { revenue: 0, served: 0, lost: 10 }).rating).toBeLessThan(s.rating);
    expect(endDay(s, { revenue: 0, served: 0, lost: 0 }).day).toBe(2);
  });
});

describe('detectLang', () => {
  it('берёт первый известный язык', () => {
    expect(detectLang(null, 'en-US')).toBe('en');
    expect(detectLang(undefined, 'uk')).toBe('ru');
    expect(detectLang('de')).toBe('en');
    expect(detectLang()).toBe('ru');
  });
});
