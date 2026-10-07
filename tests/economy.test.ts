import { describe, expect, it } from 'vitest';
import {
  buyChance,
  buyShelf,
  buyStock,
  canPlace,
  checkout,
  emptyDayStats,
  endDay,
  expectedGuests,
  hasUnmarkedBad,
  moveToShelf,
  newGame,
  onShelves,
  resolveBadBatch,
  returnToShelf,
  satisfaction,
  sellableProducts,
  setPrice,
  SHELF_LEVELS,
  shelfCount,
  shelfFor,
  takeFromShelf,
  unitSalePrice,
  upgradeShelf,
  WAREHOUSE_CAPACITY,
  warehouseCount,
  warehouseOf,
  type StoreState,
  type Unit,
} from '../src/game/economy';
import { canHaggle, haggle, newDeal, SUPPLIERS, unitPrice } from '../src/game/suppliers';
import { detectLang } from '../src/i18n/detect';

const u = (age = 0, extra: Partial<Unit> = {}): Unit => ({ age, ...extra });
const units = (n: number, age = 0) => Array.from({ length: n }, () => u(age));

/** Пустой ларёк: три стандартные полки без товара, пустой склад. */
const empty = (): StoreState => ({
  ...newGame(),
  warehouse: {},
  shelves: newGame().shelves.map((s) => ({ ...s, items: {} })),
});

/** Пустой ларёк, но на полке index лежит этот товар. */
const withShelf = (index: number, items: StoreState['shelves'][number]['items']): StoreState => ({
  ...empty(),
  shelves: empty().shelves.map((s, i) => (i === index ? { ...s, items } : s)),
});

describe('buyChance', () => {
  it('падает с ростом цены и не выходит за границы', () => {
    expect(buyChance(20, 40)).toBe(1);
    expect(buyChance(40, 40)).toBe(0.75);
    expect(buyChance(80, 40)).toBe(0.25);
    expect(buyChance(1000, 40)).toBe(0.05);
  });
});

describe('закупка на склад', () => {
  it('товар приезжает на склад, деньги списываются', () => {
    const s = buyStock(empty(), 'bread', 5, 18)!;
    expect(warehouseOf(s, 'bread')).toBe(5);
    expect(onShelves(s, 'bread')).toBe(0);
    expect(s.money).toBe(newGame().money - 90);
  });

  it('не даёт уйти в минус и переполнить склад', () => {
    expect(buyStock({ ...empty(), money: 10 }, 'bread', 1, 18)).toBeNull();
    expect(buyStock({ ...empty(), money: 1e6 }, 'apples', WAREHOUSE_CAPACITY + 1, 1)).toBeNull();
  });
});

describe('полки по типам', () => {
  it('мясо нельзя на хлебную полку, хлеб — только на хлебную', () => {
    const [bakery, produce, dairy] = newGame().shelves;
    expect(canPlace('meat', bakery)).toBe(false);
    expect(canPlace('bread', bakery)).toBe(true);
    expect(canPlace('bread', produce)).toBe(false);
    expect(canPlace('potatoes', produce)).toBe(true);
    expect(canPlace('milk', dairy)).toBe(true);
  });

  it('раскладка берёт со склада только подходящий товар и не больше места', () => {
    const s: StoreState = { ...empty(), warehouse: { bread: units(10), meat: units(3) } };
    const { state, moved } = moveToShelf(s, 0);
    expect(moved).toBe(SHELF_LEVELS[0].capacity);
    expect(shelfCount(state.shelves[0])).toBe(8);
    expect(state.shelves[0].items.meat).toBeUndefined();
    expect(warehouseOf(state, 'bread')).toBe(2);
    expect(warehouseOf(state, 'meat')).toBe(3);
  });

  it('за один поход продавец носит не больше limit штук', () => {
    const s: StoreState = { ...empty(), warehouse: { bread: units(10) } };
    expect(moveToShelf(s, 0, undefined, 6).moved).toBe(6);
  });

  it('на смешанную полку товары кладутся поровну', () => {
    const s: StoreState = { ...empty(), warehouse: { apples: units(10), potatoes: units(10) } };
    const { state } = moveToShelf(s, 1, undefined, 4);
    expect(state.shelves[1].items.apples?.length).toBe(2);
    expect(state.shelves[1].items.potatoes?.length).toBe(2);
  });

  it('брак, по которому не решили, на полку не попадает', () => {
    const s = buyStock(empty(), 'bread', 3, 10, true)!;
    expect(moveToShelf(s, 0).moved).toBe(0);
  });

  it('улучшение добавляет мест и стоит денег', () => {
    const s = upgradeShelf(empty(), 0)!;
    expect(s.shelves[0].level).toBe(1);
    expect(s.money).toBe(empty().money - SHELF_LEVELS[1].cost);
    expect(upgradeShelf({ ...empty(), money: 0 }, 0)).toBeNull();
    const max = { ...s, money: 1e6, shelves: s.shelves.map((sh) => ({ ...sh, level: SHELF_LEVELS.length - 1 })) };
    expect(upgradeShelf(max, 0)).toBeNull();
  });

  it('мясо продаётся только после покупки мясного холодильника, полок не больше 4', () => {
    expect(sellableProducts(empty())).not.toContain('meat');
    const s = buyShelf(empty(), 'meat')!;
    expect(sellableProducts(s)).toContain('meat');
    expect(buyShelf({ ...s, money: 1e6 }, 'bakery')).toBeNull();
  });
});

describe('цены', () => {
  it('не опускаются ниже шага и не взлетают выше тройной базовой', () => {
    expect(setPrice(newGame(), 'bread', -100).prices.bread).toBe(5);
    expect(setPrice(newGame(), 'bread', 1000).prices.bread).toBe(120);
  });
});

describe('продажа', () => {
  it('покупатель берёт самый старый товар с полки, деньги приходят на кассе', () => {
    const start = withShelf(0, { bread: [u(1), u(0)] });
    const taken = takeFromShelf(start, shelfFor(start, 'bread'), 'bread')!;
    expect(taken.unit.age).toBe(1);
    expect(onShelves(taken.state, 'bread')).toBe(1);
    expect(takeFromShelf(taken.state, 2, 'milk')).toBeNull();
    const { state, total } = checkout(taken.state, [{ id: 'bread', unit: taken.unit }]);
    expect(total).toBe(start.prices.bread);
    expect(state.money).toBe(start.money + total);
  });

  it('товар возвращается на полку, а если места нет — на склад', () => {
    const back = returnToShelf(withShelf(0, { bread: units(8) }), [
      { id: 'bread', unit: u() },
      { id: 'milk', unit: u() },
    ]);
    expect(onShelves(back, 'bread')).toBe(8);
    expect(warehouseOf(back, 'bread')).toBe(1);
    expect(onShelves(back, 'milk')).toBe(1);
  });
});

describe('конец дня', () => {
  it('товар портится и на складе, и на полке: хлеб живёт 2 дня, яблоки дольше', () => {
    const s: StoreState = { ...withShelf(1, { apples: [u()] }), warehouse: { bread: [u()] } };
    let r = endDay(s, emptyDayStats());
    expect(r.spoiled).toBe(0);
    r = endDay(r.state, emptyDayStats());
    expect(r.spoiled).toBe(1);
    expect(warehouseCount(r.state)).toBe(0);
    expect(r.state.shelves[1].items.apples).toEqual([u(2)]);
    expect(r.state.day).toBe(3);
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

  it('бракованная партия ждёт решения игрока на складе', () => {
    expect((bought().warehouse.milk ?? []).every((x) => x.bad && x.pending)).toBe(true);
  });

  it('оставить как есть: полная цена, но риск жалоб и порча на день раньше', () => {
    const s = resolveBadBatch(bought(), 'milk', 'shelf', 30);
    const unit = s.warehouse.milk![0];
    expect(unit.pending).toBeUndefined();
    expect(unitSalePrice(s, 'milk', unit)).toBe(60);
    expect(hasUnmarkedBad([{ id: 'milk', unit }])).toBe(true);
    const after = endDay(endDay(s, emptyDayStats()).state, emptyDayStats());
    expect(after.spoiled).toBe(4); // молоко живёт 3 дня, брак — 2
  });

  it('уценка: половина цены и без жалоб', () => {
    const s = resolveBadBatch(bought(), 'milk', 'markdown', 30);
    const unit = s.warehouse.milk![0];
    expect(unitSalePrice(s, 'milk', unit)).toBe(30);
    expect(hasUnmarkedBad([{ id: 'milk', unit }])).toBe(false);
  });

  it('возврат: товар уходит, возвращается половина денег, старый товар не трогаем', () => {
    const b = bought();
    const withOld = { ...b, warehouse: { milk: [u(1), ...(b.warehouse.milk ?? [])] } };
    const s = resolveBadBatch(withOld, 'milk', 'return', 30);
    expect(s.warehouse.milk).toEqual([u(1)]);
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
    expect(unitPrice(SUPPLIERS.butcher, newDeal(SUPPLIERS.butcher), 'meat')).toBe(80);
  });
});

describe('рейтинг и поток гостей', () => {
  it('чем ниже рейтинг, тем меньше гостей', () => {
    expect(expectedGuests(0)).toBeLessThan(expectedGuests(3));
    expect(expectedGuests(3)).toBeLessThan(expectedGuests(5));
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
