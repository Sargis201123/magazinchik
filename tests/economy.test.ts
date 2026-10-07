import { describe, expect, it } from 'vitest';
import {
  buyChance,
  buyStock,
  checkout,
  emptyDayStats,
  endDay,
  newGame,
  returnToShelf,
  satisfaction,
  setPrice,
  SHELF_CAPACITY,
  stockCount,
  takeFromShelf,
  type StoreState,
} from '../src/game/economy';
import { canHaggle, haggle, newDeal, SUPPLIERS, unitPrice } from '../src/game/suppliers';
import { detectLang } from '../src/i18n/detect';

const empty = (): StoreState => ({ ...newGame(), stock: { bread: [], milk: [], apples: [] } });

describe('buyChance', () => {
  it('падает с ростом цены и не выходит за границы', () => {
    expect(buyChance(20, 40)).toBe(1);
    expect(buyChance(40, 40)).toBe(0.75);
    expect(buyChance(80, 40)).toBe(0.25);
    expect(buyChance(1000, 40)).toBe(0.05);
  });
});

describe('закупка', () => {
  it('добавляет свежий товар и списывает деньги', () => {
    const s = buyStock(empty(), 'bread', 5, 18)!;
    expect(stockCount(s, 'bread')).toBe(5);
    expect(s.money).toBe(newGame().money - 90);
  });

  it('не даёт уйти в минус и переполнить полку', () => {
    expect(buyStock({ ...empty(), money: 10 }, 'bread', 1, 18)).toBeNull();
    expect(buyStock(empty(), 'bread', SHELF_CAPACITY + 1, 1)).toBeNull();
  });
});

describe('цены', () => {
  it('не опускаются ниже шага и не взлетают выше тройной базовой', () => {
    expect(setPrice(newGame(), 'bread', -100).prices.bread).toBe(5);
    expect(setPrice(newGame(), 'bread', 1000).prices.bread).toBe(120);
  });
});

describe('продажа', () => {
  it('покупатель берёт самый старый товар, деньги приходят на кассе', () => {
    let s: StoreState = { ...empty(), stock: { bread: [1, 0], milk: [], apples: [] } };
    s = takeFromShelf(s, 'bread')!;
    expect(s.stock.bread).toEqual([0]);
    expect(takeFromShelf(s, 'milk')).toBeNull();
    const { state, total } = checkout(s, ['bread']);
    expect(total).toBe(s.prices.bread);
    expect(state.money).toBe(s.money + total);
  });

  it('товар возвращается на полку, но не сверх вместимости', () => {
    const full = { ...empty(), stock: { bread: Array(SHELF_CAPACITY).fill(0), milk: [], apples: [] } };
    expect(stockCount(returnToShelf(full, ['bread', 'milk']), 'bread')).toBe(SHELF_CAPACITY);
    expect(stockCount(returnToShelf(full, ['bread', 'milk']), 'milk')).toBe(1);
  });
});

describe('конец дня', () => {
  it('хлеб живёт 2 дня, яблоки дольше', () => {
    let s: StoreState = { ...empty(), stock: { bread: [0], milk: [], apples: [0] } };
    let r = endDay(s, emptyDayStats());
    expect(r.spoiled).toBe(0);
    r = endDay(r.state, emptyDayStats());
    expect(r.spoiled).toBe(1);
    expect(r.state.stock.bread).toEqual([]);
    expect(r.state.stock.apples).toEqual([2]);
    s = r.state;
    expect(s.day).toBe(3);
  });

  it('рейтинг растёт от довольных и падает от ушедших и жалоб', () => {
    const s = newGame();
    const stats = (served: number, lost: number, complaints = 0) => ({ ...emptyDayStats(), served, lost, complaints });
    expect(endDay(s, stats(10, 0)).state.rating).toBeGreaterThan(s.rating);
    expect(endDay(s, stats(0, 10)).state.rating).toBeLessThan(s.rating);
    expect(satisfaction(stats(10, 0, 4))).toBeLessThan(satisfaction(stats(10, 0)));
  });
});

describe('торг', () => {
  const farmer = SUPPLIERS.farmer;

  it('удачный торг даёт скидку, больше торговаться нельзя', () => {
    const { deal, success } = haggle(farmer, newDeal(farmer), 0.1, 3, 0);
    expect(success).toBe(true);
    expect(unitPrice(farmer, deal, 'bread')).toBe(18);
    expect(canHaggle(deal)).toBe(false);
  });

  it('после всех неудач поставщик обижается и поднимает цену', () => {
    let deal = newDeal(farmer);
    for (let i = 0; i < farmer.patience; i++) deal = haggle(farmer, deal, 0.2, 3, 0.99).deal;
    expect(deal.angry).toBe(true);
    expect(unitPrice(farmer, deal, 'bread')).toBe(22);
  });

  it('поставщик не продаёт чужой товар', () => {
    expect(unitPrice(farmer, newDeal(farmer), 'milk')).toBeNull();
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
