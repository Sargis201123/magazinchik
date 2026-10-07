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
  PRODUCTS,
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
  warehouseCapacity,
  warehouseCount,
  billTotal,
  daysUntilBill,
  DEBT_PAYMENT,
  LATE_PENALTY,
  monthlyBill,
  MONTH_DAYS,
  STAFF_ROLES,
  expandStore,
  FRIDGE_POWER,
  payDebt,
  sellShelf,
  shelfResale,
  STORE_LEVELS,
  freeSlots,
  warehouseOf,
  type StoreState,
  type Unit,
} from '../src/game/economy';
import { canHaggle, haggle, newDeal, SUPPLIERS, unitPrice } from '../src/game/suppliers';
import { detectLang } from '../src/i18n/detect';

const u = (age = 0, extra: Partial<Unit> = {}): Unit => ({ age, ...extra });
const units = (n: number, age = 0) => Array.from({ length: n }, () => u(age));

/** Пустой магазинчик (2-й уровень, без долга): хлебная, овощная и молочная полки без товара, пустой склад. */
const empty = (): StoreState => ({
  ...newGame(),
  money: 300,
  level: 1,
  debt: 0,
  warehouse: {},
  shelves: [
    { kind: 'bakery', level: 0, items: {} },
    { kind: 'produce', level: 0, items: {} },
    { kind: 'dairy', level: 0, items: {} },
  ],
});

/** Пустой ларёк, но на полке index лежит этот товар. */
const withShelf = (index: number, items: StoreState['shelves'][number]['items']): StoreState => ({
  ...empty(),
  shelves: empty().shelves.map((s, i) => (i === index ? { ...s, items } : s)),
});

describe('buyChance', () => {
  it('дешевле базовой — охотнее, дороже — спрос падает круто', () => {
    expect(buyChance(20, 40)).toBe(1);
    expect(buyChance(40, 40)).toBe(0.75);
    expect(buyChance(48, 40)).toBeCloseTo(0.55);
    expect(buyChance(60, 40)).toBeCloseTo(0.25);
    expect(buyChance(80, 40)).toBe(0.02);
  });

  it('выгоднее всего цена чуть выше базовой, а не задранная', () => {
    // Прибыль с одного желающего купить хлеб: шанс покупки × наценка.
    const perWant = (price: number) => buyChance(price, 40) * (price - 25);
    expect(perWant(45)).toBeGreaterThan(perWant(40));
    expect(perWant(45)).toBeGreaterThan(perWant(60));
    expect(perWant(70)).toBeLessThan(perWant(40));
  });
});

describe('закупка на склад', () => {
  it('товар приезжает на склад, деньги списываются', () => {
    const s = buyStock(empty(), 'bread', 5, 18)!;
    expect(warehouseOf(s, 'bread')).toBe(5);
    expect(onShelves(s, 'bread')).toBe(0);
    expect(s.money).toBe(empty().money - 90);
  });

  it('не даёт уйти в минус и переполнить склад', () => {
    expect(buyStock({ ...empty(), money: 10 }, 'bread', 1, 18)).toBeNull();
    expect(buyStock({ ...empty(), money: 1e6 }, 'apples', warehouseCapacity(empty()) + 1, 1)).toBeNull();
  });
});

describe('полки по типам', () => {
  it('мясо нельзя на хлебную полку, хлеб — только на хлебную', () => {
    const [bakery, produce, dairy] = empty().shelves;
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

  it('мясо продаётся только после покупки мясного холодильника, полок не больше, чем мест', () => {
    expect(sellableProducts(empty())).not.toContain('meat');
    const s = buyShelf({ ...empty(), money: 1000 }, 'meat')!;
    expect(sellableProducts(s)).toContain('meat');
    expect(freeSlots(s)).toBe(0);
    expect(buyShelf({ ...s, money: 1e6 }, 'bakery')).toBeNull();
  });

  it('полку можно продать за половину цены, товар с неё уходит на склад', () => {
    const s = { ...empty(), shelves: [{ kind: 'dairy' as const, level: 1, items: { milk: units(3) } }] };
    const sold = sellShelf(s, 0)!;
    expect(shelfResale(s.shelves[0])).toBe((300 + SHELF_LEVELS[1].cost) / 2);
    expect(sold.money).toBe(s.money + 210);
    expect(sold.shelves).toEqual([]);
    expect(warehouseOf(sold, 'milk')).toBe(3);
  });
});

describe('помещение, долг и расходы', () => {
  it('в начале ларёк на 2 полки, с долгом', () => {
    const s = newGame();
    expect(STORE_LEVELS[s.level].slots).toBe(2);
    expect(s.shelves).toHaveLength(2);
    expect(freeSlots(s)).toBe(0);
    expect(s.debt).toBeGreaterThan(0);
  });

  it('расширяться нельзя, пока есть долг', () => {
    const rich = { ...newGame(), money: 1e6 };
    expect(expandStore(rich)).toBeNull();
    const paid = payDebt(rich, rich.debt)!;
    expect(paid.debt).toBe(0);
    const bigger = expandStore(paid)!;
    expect(bigger.level).toBe(1);
    expect(freeSlots(bigger)).toBe(2);
    expect(bigger.money).toBe(paid.money - STORE_LEVELS[1].cost);
  });

  it('с каждым уровнем больше мест, склад и аренда, и дороже расширение', () => {
    for (let i = 1; i < STORE_LEVELS.length; i++) {
      const [a, b] = [STORE_LEVELS[i - 1], STORE_LEVELS[i]];
      expect(b.slots).toBeGreaterThan(a.slots);
      expect(b.warehouse).toBeGreaterThan(a.warehouse);
      expect(b.rent).toBeGreaterThan(a.rent);
      expect(b.cost).toBeGreaterThan(a.cost);
    }
  });

  it('счета приходят раз в месяц, в остальные дни расходов нет', () => {
    expect(daysUntilBill(1)).toBe(MONTH_DAYS - 1);
    expect(daysUntilBill(MONTH_DAYS)).toBe(0);
    const s = { ...empty(), day: 3 };
    const night = endDay(s, emptyDayStats());
    expect(night.bill).toBeNull();
    expect(night.state.money).toBe(s.money);
  });

  it('счета: аренда, коммуналка, свет с холодильниками, зарплаты и кредит', () => {
    const s: StoreState = {
      ...empty(),
      money: 5000,
      day: MONTH_DAYS,
      debt: 600,
      staff: [{ role: 'cashier', name: 0, skill: 2, wage: STAFF_ROLES.cashier.wage, months: 0 }],
    };
    const level = STORE_LEVELS[1];
    const bill = monthlyBill(s);
    expect(bill).toEqual({
      rent: level.rent,
      utilities: level.utilities,
      power: level.power + FRIDGE_POWER, // в empty() один молочный холодильник
      salaries: STAFF_ROLES.cashier.wage,
      debt: DEBT_PAYMENT,
    });
    const night = endDay(s, emptyDayStats());
    expect(night.bill).toEqual(bill);
    expect(night.state.money).toBe(5000 - billTotal(bill));
    expect(night.state.debt).toBe(600 - DEBT_PAYMENT);
  });

  it('не хватило на счета — недостача уходит в долг с пени', () => {
    const s = { ...empty(), day: MONTH_DAYS, money: 100, debt: 0 };
    const total = billTotal(monthlyBill(s));
    const night = endDay(s, emptyDayStats());
    expect(night.shortfall).toBe(total - 100);
    expect(night.state.money).toBe(0);
    expect(night.state.debt).toBe(total - 100 + Math.round((total - 100) * LATE_PENALTY));
  });

  it('гасить долг больше, чем есть денег, нельзя', () => {
    expect(payDebt({ ...newGame(), money: 0 }, 100)).toBeNull();
    expect(payDebt({ ...newGame(), money: 1e6 }, 1e6)!.debt).toBe(0);
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
    expect(unitPrice(farmer, deal, 'bread')).toBe(Math.round(PRODUCTS.bread.cost * 0.9));
    expect(canHaggle(deal)).toBe(false);
  });

  it('после всех неудач поставщик обижается и поднимает цену', () => {
    let deal = newDeal(farmer);
    for (let i = 0; i < farmer.patience; i++) deal = haggle(farmer, deal, 0.2, 3, 0.99).deal;
    expect(deal.angry).toBe(true);
    expect(unitPrice(farmer, deal, 'bread')).toBe(Math.round(PRODUCTS.bread.cost * 1.1));
  });

  it('поставщик не продаёт чужой товар', () => {
    expect(unitPrice(farmer, newDeal(farmer), 'milk')).toBeNull();
    expect(unitPrice(SUPPLIERS.butcher, newDeal(SUPPLIERS.butcher), 'meat')).toBe(PRODUCTS.meat.cost);
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
