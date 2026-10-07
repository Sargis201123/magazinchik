import { describe, expect, it } from 'vitest';
import {
  buyChance,
  buyStock,
  checkout,
  emptyDayStats,
  endDay,
  expectedGuests,
  hasUnmarkedBad,
  newGame,
  resolveBadBatch,
  returnToShelf,
  satisfaction,
  setPrice,
  SHELF_CAPACITY,
  stockCount,
  takeFromShelf,
  unitSalePrice,
  type StoreState,
  type Unit,
} from '../src/game/economy';
import { canHaggle, haggle, newDeal, SUPPLIERS, unitPrice } from '../src/game/suppliers';
import { detectLang } from '../src/i18n/detect';

const empty = (): StoreState => ({ ...newGame(), stock: { bread: [], milk: [], apples: [] } });
const u = (age = 0, extra: Partial<Unit> = {}): Unit => ({ age, ...extra });

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
    const start: StoreState = { ...empty(), stock: { bread: [u(1), u(0)], milk: [], apples: [] } };
    const taken = takeFromShelf(start, 'bread')!;
    expect(taken.unit.age).toBe(1);
    const s = taken.state;
    expect(s.stock.bread).toEqual([u(0)]);
    expect(takeFromShelf(s, 'milk')).toBeNull();
    const { state, total } = checkout(s, [{ id: 'bread', unit: taken.unit }]);
    expect(total).toBe(s.prices.bread);
    expect(state.money).toBe(s.money + total);
  });

  it('товар возвращается на полку, но не сверх вместимости', () => {
    const full = { ...empty(), stock: { bread: Array.from({ length: SHELF_CAPACITY }, () => u()), milk: [], apples: [] } };
    const items = [
      { id: 'bread' as const, unit: u() },
      { id: 'milk' as const, unit: u() },
    ];
    expect(stockCount(returnToShelf(full, items), 'bread')).toBe(SHELF_CAPACITY);
    expect(stockCount(returnToShelf(full, items), 'milk')).toBe(1);
  });
});

describe('конец дня', () => {
  it('хлеб живёт 2 дня, яблоки дольше', () => {
    let s: StoreState = { ...empty(), stock: { bread: [u()], milk: [], apples: [u()] } };
    let r = endDay(s, emptyDayStats());
    expect(r.spoiled).toBe(0);
    r = endDay(r.state, emptyDayStats());
    expect(r.spoiled).toBe(1);
    expect(r.state.stock.bread).toEqual([]);
    expect(r.state.stock.apples).toEqual([u(2)]);
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

describe('брак', () => {
  const bought = () => buyStock(empty(), 'milk', 4, 30, true)!;

  it('бракованная партия ждёт решения игрока', () => {
    expect(bought().stock.milk.every((x) => x.bad && x.pending)).toBe(true);
  });

  it('поставить как есть: полная цена, но риск жалоб и порча на день раньше', () => {
    const s = resolveBadBatch(bought(), 'milk', 'shelf', 30);
    const unit = s.stock.milk[0];
    expect(unit.pending).toBeUndefined();
    expect(unitSalePrice(s, 'milk', unit)).toBe(60);
    expect(hasUnmarkedBad([{ id: 'milk', unit }])).toBe(true);
    const after = endDay(endDay(s, emptyDayStats()).state, emptyDayStats());
    expect(after.spoiled).toBe(4); // молоко живёт 3 дня, брак — 2
  });

  it('уценка: половина цены и без жалоб', () => {
    const s = resolveBadBatch(bought(), 'milk', 'markdown', 30);
    const unit = s.stock.milk[0];
    expect(unitSalePrice(s, 'milk', unit)).toBe(30);
    expect(hasUnmarkedBad([{ id: 'milk', unit }])).toBe(false);
  });

  it('возврат: товар уходит, возвращается половина денег, старый товар не трогаем', () => {
    const withOld = { ...bought(), stock: { ...bought().stock, milk: [u(1), ...bought().stock.milk] } };
    const s = resolveBadBatch(withOld, 'milk', 'return', 30);
    expect(s.stock.milk).toEqual([u(1)]);
    expect(s.money).toBe(withOld.money + 60);
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

describe('рейтинг и поток гостей', () => {
  it('чем ниже рейтинг, тем меньше гостей', () => {
    expect(expectedGuests(0)).toBeLessThan(expectedGuests(3));
    expect(expectedGuests(3)).toBeLessThan(expectedGuests(5));
    expect(expectedGuests(0)).toBe(12);
    expect(expectedGuests(5)).toBe(45);
  });
});
