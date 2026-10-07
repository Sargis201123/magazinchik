// Чистая игровая логика без Phaser: её легко тестировать и потом переиспользовать
// на сервере (проверка сохранений, расчёт дохода офлайн).

import type { TextKey } from '../i18n/ru';

/** Тип полки определяет, какой товар на неё можно ставить: мясо не кладут к хлебу. */
export type Category = 'bakery' | 'produce' | 'dairy' | 'meat';

export type ProductId = 'bread' | 'apples' | 'potatoes' | 'milk' | 'meat';

export interface Product {
  id: ProductId;
  nameKey: TextKey;
  icon: string;
  category: Category;
  /** Базовая цена закупки за штуку (у поставщика может отличаться). */
  cost: number;
  /** «Справедливая» розничная цена: при ней спрос нормальный. */
  basePrice: number;
  /** Сколько дней товар живёт (и на складе, и на полке), потом портится. */
  shelfLife: number;
  color: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  bread: { id: 'bread', nameKey: 'product.bread', icon: '🍞', category: 'bakery', cost: 20, basePrice: 40, shelfLife: 2, color: 0xd9a066 },
  apples: { id: 'apples', nameKey: 'product.apples', icon: '🍎', category: 'produce', cost: 10, basePrice: 30, shelfLife: 5, color: 0xd04648 },
  potatoes: { id: 'potatoes', nameKey: 'product.potatoes', icon: '🥔', category: 'produce', cost: 8, basePrice: 20, shelfLife: 7, color: 0xa47a52 },
  milk: { id: 'milk', nameKey: 'product.milk', icon: '🥛', category: 'dairy', cost: 30, basePrice: 60, shelfLife: 3, color: 0xeef3f7 },
  meat: { id: 'meat', nameKey: 'product.meat', icon: '🥩', category: 'meat', cost: 80, basePrice: 150, shelfLife: 2, color: 0xb83a4b },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export interface ShelfKind {
  nameKey: TextKey;
  /** Цена покупки новой полки такого типа. */
  price: number;
}

export const SHELF_KINDS: Record<Category, ShelfKind> = {
  bakery: { nameKey: 'shelf.bakery', price: 150 },
  produce: { nameKey: 'shelf.produce', price: 150 },
  dairy: { nameKey: 'shelf.dairy', price: 250 },
  meat: { nameKey: 'shelf.meat', price: 250 },
};

export const CATEGORIES = Object.keys(SHELF_KINDS) as Category[];

/** Уровни полки: вместимость и цена улучшения до этого уровня. */
export const SHELF_LEVELS = [
  { capacity: 8, cost: 0 },
  { capacity: 12, cost: 120 },
  { capacity: 16, cost: 250 },
] as const;

/** Сколько полок помещается в ларьке (позже расширим магазин). */
export const MAX_SHELVES = 4;
export const WAREHOUSE_CAPACITY = 40;
/** Сколько штук продавец уносит со склада за один поход. */
export const CARRY = 6;

export const PRICE_STEP = 5;
export const DAY_SECONDS = 90;

/** Уценённый товар продаётся за половину цены. */
export const MARKDOWN = 0.5;
/** Поставщик забирает бракованную партию и возвращает половину денег. */
export const RETURN_REFUND = 0.5;
/** Шанс, что покупатель пожалуется на бракованный товар без уценки. */
export const BAD_COMPLAINT_CHANCE = 0.5;

/** Одна штука товара. */
export interface Unit {
  /** Сколько дней лежит. */
  age: number;
  /** Брак: портится на день раньше, покупатели могут жаловаться. */
  bad?: boolean;
  /** Уценён: продаётся дешевле, жалоб нет. */
  markdown?: boolean;
  /** Бракованная партия, по которой игрок ещё не принял решение. */
  pending?: boolean;
}

export type Stock = Partial<Record<ProductId, Unit[]>>;

export interface Shelf {
  kind: Category;
  level: number;
  /** Товар на полке, у каждого товара самые старые штуки — в начале. */
  items: Stock;
}

export interface StoreState {
  day: number;
  money: number;
  /** 0..5 звёзд, влияет на поток покупателей. */
  rating: number;
  /** Склад рядом с магазином: сюда приезжает закупка. */
  warehouse: Stock;
  shelves: Shelf[];
  prices: Record<ProductId, number>;
}

export interface DayStats {
  revenue: number;
  served: number;
  /** Ушли без покупки: не дождались кассы или не нашли товар. */
  lost: number;
  /** Купили, но остались недовольны: грязь, туалет, брак. */
  complaints: number;
  spoiled: number;
}

export interface CartItem {
  id: ProductId;
  unit: Unit;
}

const fresh = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));

export const newGame = (): StoreState => ({
  day: 1,
  money: 300,
  rating: 3,
  warehouse: { bread: fresh(4), apples: fresh(6), milk: fresh(4) },
  shelves: [
    { kind: 'bakery', level: 0, items: { bread: fresh(4) } },
    { kind: 'produce', level: 0, items: { apples: fresh(3), potatoes: fresh(3) } },
    { kind: 'dairy', level: 0, items: { milk: fresh(3) } },
  ],
  prices: { bread: 40, apples: 30, potatoes: 20, milk: 60, meat: 150 },
});

export const emptyDayStats = (): DayStats => ({ revenue: 0, served: 0, lost: 0, complaints: 0, spoiled: 0 });

// ---------- Подсчёты ----------

const countStock = (stock: Stock): number => Object.values(stock).reduce((sum, units) => sum + (units?.length ?? 0), 0);

export const warehouseCount = (state: StoreState): number => countStock(state.warehouse);
export const warehouseOf = (state: StoreState, id: ProductId): number => state.warehouse[id]?.length ?? 0;
export const shelfCapacity = (shelf: Shelf): number => SHELF_LEVELS[shelf.level].capacity;
export const shelfCount = (shelf: Shelf): number => countStock(shelf.items);
export const shelfFree = (shelf: Shelf): number => shelfCapacity(shelf) - shelfCount(shelf);
export const canPlace = (id: ProductId, shelf: Shelf): boolean => PRODUCTS[id].category === shelf.kind;

/** Сколько штук товара стоит на всех полках. */
export const onShelves = (state: StoreState, id: ProductId): number =>
  state.shelves.reduce((sum, shelf) => sum + (shelf.items[id]?.length ?? 0), 0);

/** Индекс полки, куда идти за этим товаром (первая, где он есть, иначе первая подходящая). */
export function shelfFor(state: StoreState, id: ProductId): number {
  const withStock = state.shelves.findIndex((s) => (s.items[id]?.length ?? 0) > 0);
  return withStock >= 0 ? withStock : state.shelves.findIndex((s) => canPlace(id, s));
}

/** Товары, для которых в магазине есть подходящая полка: только их и ищут покупатели. */
export const sellableProducts = (state: StoreState): ProductId[] =>
  PRODUCT_IDS.filter((id) => state.shelves.some((s) => canPlace(id, s)));

// ---------- Цены и спрос ----------

/**
 * Вероятность, что покупатель возьмёт товар при такой цене.
 * Цена = базовой → 75%, в два раза дешевле → 100%, в два раза дороже → 25%.
 */
export function buyChance(price: number, basePrice: number): number {
  const ratio = price / basePrice;
  return Math.min(1, Math.max(0.05, 1.25 - 0.5 * ratio));
}

/** Сколько реально заплатит покупатель за эту штуку. */
export const unitSalePrice = (state: StoreState, id: ProductId, unit: Unit): number =>
  unit.markdown ? Math.max(1, Math.round(state.prices[id] * MARKDOWN)) : state.prices[id];

export function setPrice(state: StoreState, id: ProductId, price: number): StoreState {
  const clamped = Math.max(PRICE_STEP, Math.min(PRODUCTS[id].basePrice * 3, price));
  return { ...state, prices: { ...state.prices, [id]: clamped } };
}

// ---------- Закупка и склад ----------

/**
 * Покупка у поставщика: товар приезжает на склад. bad — партия оказалась бракованной,
 * штуки ждут решения игрока (см. resolveBadBatch).
 * Возвращает null, если не хватает денег или места на складе.
 */
export function buyStock(state: StoreState, id: ProductId, qty: number, unitPrice: number, bad = false): StoreState | null {
  const total = qty * unitPrice;
  if (qty <= 0 || total > state.money || warehouseCount(state) + qty > WAREHOUSE_CAPACITY) return null;
  const units: Unit[] = Array.from({ length: qty }, () => (bad ? { age: 0, bad: true, pending: true } : { age: 0 }));
  return {
    ...state,
    money: state.money - total,
    warehouse: { ...state.warehouse, [id]: [...(state.warehouse[id] ?? []), ...units] },
  };
}

export type BadBatchChoice = 'shelf' | 'markdown' | 'return';

/** Решение по бракованной партии на складе: оставить как есть, уценить или вернуть поставщику. */
export function resolveBadBatch(state: StoreState, id: ProductId, choice: BadBatchChoice, unitPrice: number): StoreState {
  const units = state.warehouse[id] ?? [];
  if (choice === 'return') {
    const returned = units.filter((u) => u.pending).length;
    return {
      ...state,
      money: state.money + Math.round(returned * unitPrice * RETURN_REFUND),
      warehouse: { ...state.warehouse, [id]: units.filter((u) => !u.pending) },
    };
  }
  const resolved = units.map((u) =>
    u.pending ? { age: u.age, bad: true, ...(choice === 'markdown' ? { markdown: true } : {}) } : u,
  );
  return { ...state, warehouse: { ...state.warehouse, [id]: resolved } };
}

/**
 * Переносит товар со склада на полку: самые старые штуки, только подходящего типа,
 * не больше свободного места и не больше limit. Если товар не указан — раскладывает
 * все подходящие товары по очереди, чтобы на полке было всего понемногу.
 */
export function moveToShelf(
  state: StoreState,
  shelfIndex: number,
  id?: ProductId,
  limit = Infinity,
): { state: StoreState; moved: number } {
  const shelf = state.shelves[shelfIndex];
  if (!shelf) return { state, moved: 0 };
  const candidates = (id ? [id] : PRODUCT_IDS).filter((p) => canPlace(p, shelf));
  const warehouse: Stock = { ...state.warehouse };
  const items: Stock = { ...shelf.items };
  let room = Math.min(shelfFree(shelf), limit);
  let moved = 0;

  let progress = true;
  while (room > 0 && progress) {
    progress = false;
    for (const p of candidates) {
      const [unit, ...rest] = warehouse[p] ?? [];
      if (!unit || room === 0 || unit.pending) continue;
      warehouse[p] = rest;
      items[p] = [...(items[p] ?? []), unit];
      room--;
      moved++;
      progress = true;
    }
  }
  if (moved === 0) return { state, moved };
  const shelves = state.shelves.map((s, i) => (i === shelfIndex ? { ...s, items } : s));
  return { state: { ...state, warehouse, shelves }, moved };
}

// ---------- Полки ----------

export function upgradeCost(shelf: Shelf): number | null {
  return SHELF_LEVELS[shelf.level + 1]?.cost ?? null;
}

export function upgradeShelf(state: StoreState, shelfIndex: number): StoreState | null {
  const shelf = state.shelves[shelfIndex];
  const cost = shelf && upgradeCost(shelf);
  if (!shelf || cost === null || cost > state.money) return null;
  const shelves = state.shelves.map((s, i) => (i === shelfIndex ? { ...s, level: s.level + 1 } : s));
  return { ...state, money: state.money - cost, shelves };
}

export function buyShelf(state: StoreState, kind: Category): StoreState | null {
  const price = SHELF_KINDS[kind].price;
  if (state.shelves.length >= MAX_SHELVES || price > state.money) return null;
  return { ...state, money: state.money - price, shelves: [...state.shelves, { kind, level: 0, items: {} }] };
}

// ---------- Продажа ----------

/** Покупатель берёт с полки самую старую штуку. Возвращает null, если товара нет. */
export function takeFromShelf(
  state: StoreState,
  shelfIndex: number,
  id: ProductId,
): { state: StoreState; unit: Unit } | null {
  const shelf = state.shelves[shelfIndex];
  const [unit, ...rest] = shelf?.items[id] ?? [];
  if (!unit) return null;
  const shelves = state.shelves.map((s, i) => (i === shelfIndex ? { ...s, items: { ...s.items, [id]: rest } } : s));
  return { state: { ...state, shelves }, unit };
}

/** Покупатель ушёл из очереди: товар возвращается на свою полку, а если там нет места — на склад. */
export function returnToShelf(state: StoreState, items: CartItem[]): StoreState {
  let next = state;
  for (const { id, unit } of items) {
    const index = next.shelves.findIndex((s) => canPlace(id, s) && shelfFree(s) > 0);
    if (index >= 0) {
      next = {
        ...next,
        shelves: next.shelves.map((s, i) =>
          i === index ? { ...s, items: { ...s.items, [id]: [unit, ...(s.items[id] ?? [])] } } : s,
        ),
      };
    } else {
      next = { ...next, warehouse: { ...next.warehouse, [id]: [unit, ...(next.warehouse[id] ?? [])] } };
    }
  }
  return next;
}

export function checkout(state: StoreState, items: CartItem[]): { state: StoreState; total: number } {
  const total = items.reduce((sum, { id, unit }) => sum + unitSalePrice(state, id, unit), 0);
  return { state: { ...state, money: state.money + total }, total };
}

/** В корзине есть брак без уценки — покупатель может пожаловаться. */
export const hasUnmarkedBad = (items: CartItem[]): boolean => items.some(({ unit }) => unit.bad && !unit.markdown);

// ---------- Конец дня ----------

/** 0..1: доля довольных посетителей. Жалоба считается за «полпокупателя». */
export function satisfaction(stats: DayStats): number {
  const visitors = stats.served + stats.lost;
  if (visitors === 0) return 0.5;
  return Math.max(0, (stats.served - stats.complaints * 0.5) / visitors);
}

/** Сколько дней проживёт штука: брак портится на день раньше. */
export const unitLife = (id: ProductId, unit: Unit): number => Math.max(1, PRODUCTS[id].shelfLife - (unit.bad ? 1 : 0));

function ageStock(stock: Stock): { stock: Stock; spoiled: number } {
  let spoiled = 0;
  const next: Stock = {};
  for (const id of PRODUCT_IDS) {
    const units = stock[id];
    if (!units) continue;
    const aged = units.map((u) => ({ ...u, age: u.age + 1 }));
    const kept = aged.filter((u) => u.age < unitLife(id, u));
    spoiled += aged.length - kept.length;
    next[id] = kept;
  }
  return { stock: next, spoiled };
}

/** Ночь: товар стареет и портится (и на складе, и на полках), рейтинг двигается от довольства покупателей. */
export function endDay(state: StoreState, stats: DayStats): { state: StoreState; spoiled: number } {
  const warehouse = ageStock(state.warehouse);
  let spoiled = warehouse.spoiled;
  const shelves = state.shelves.map((shelf) => {
    const aged = ageStock(shelf.items);
    spoiled += aged.spoiled;
    return { ...shelf, items: aged.stock };
  });
  const rating = Math.min(5, Math.max(0, state.rating + (satisfaction(stats) - 0.7) * 0.6));
  return {
    state: { ...state, day: state.day + 1, rating: Math.round(rating * 100) / 100, warehouse: warehouse.stock, shelves },
    spoiled,
  };
}

/**
 * Секунд между появлениями покупателей. Рейтинг сильно влияет на поток:
 * 0★ — раз в 7.5 с, 3★ — раз в 4.2 с, 5★ — раз в 2 с.
 */
export const spawnInterval = (rating: number): number => 7.5 - rating * 1.1;

/** Примерно столько гостей придёт за день при таком рейтинге. */
export const expectedGuests = (rating: number): number => Math.round(DAY_SECONDS / spawnInterval(rating));
