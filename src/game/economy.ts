// Чистая игровая логика без Phaser: её легко тестировать и потом переиспользовать
// на сервере (проверка сохранений, расчёт дохода офлайн).

import type { TextKey } from '../i18n/ru';

export type ProductId = 'bread' | 'milk' | 'apples';

export interface Product {
  id: ProductId;
  nameKey: TextKey;
  /** Базовая цена закупки за штуку (у поставщика может отличаться). */
  cost: number;
  /** «Справедливая» розничная цена: при ней спрос нормальный. */
  basePrice: number;
  /** Сколько дней товар живёт на полке, потом портится. */
  shelfLife: number;
  color: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  bread: { id: 'bread', nameKey: 'product.bread', cost: 20, basePrice: 40, shelfLife: 2, color: 0xd9a066 },
  milk: { id: 'milk', nameKey: 'product.milk', cost: 30, basePrice: 60, shelfLife: 3, color: 0xeef3f7 },
  apples: { id: 'apples', nameKey: 'product.apples', cost: 10, basePrice: 30, shelfLife: 5, color: 0xd04648 },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export const SHELF_CAPACITY = 10;
export const PRICE_STEP = 5;
export const DAY_SECONDS = 90;

/** Уценённый товар продаётся за половину цены. */
export const MARKDOWN = 0.5;
/** Поставщик забирает бракованную партию и возвращает половину денег. */
export const RETURN_REFUND = 0.5;
/** Шанс, что покупатель пожалуется на бракованный товар без уценки. */
export const BAD_COMPLAINT_CHANCE = 0.5;

/** Одна штука товара на полке. */
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

export interface StoreState {
  day: number;
  money: number;
  /** 0..5 звёзд, влияет на поток покупателей. */
  rating: number;
  /** Товар на полке, самые старые штуки — в начале. */
  stock: Record<ProductId, Unit[]>;
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
  stock: { bread: fresh(4), milk: fresh(3), apples: fresh(5) },
  prices: { bread: 40, milk: 60, apples: 30 },
});

export const emptyDayStats = (): DayStats => ({ revenue: 0, served: 0, lost: 0, complaints: 0, spoiled: 0 });

export const stockCount = (state: StoreState, id: ProductId): number => state.stock[id].length;

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

/**
 * Покупка у поставщика. bad — партия оказалась бракованной: штуки помечаются
 * как ожидающие решения игрока (см. resolveBadBatch).
 * Возвращает null, если не хватает денег или места на полке.
 */
export function buyStock(
  state: StoreState,
  id: ProductId,
  qty: number,
  unitPrice: number,
  bad = false,
): StoreState | null {
  const total = qty * unitPrice;
  if (qty <= 0 || total > state.money || stockCount(state, id) + qty > SHELF_CAPACITY) return null;
  const units: Unit[] = Array.from({ length: qty }, () => (bad ? { age: 0, bad: true, pending: true } : { age: 0 }));
  return { ...state, money: state.money - total, stock: { ...state.stock, [id]: [...state.stock[id], ...units] } };
}

export type BadBatchChoice = 'shelf' | 'markdown' | 'return';

/** Решение по бракованной партии: поставить как есть, уценить или вернуть поставщику. */
export function resolveBadBatch(
  state: StoreState,
  id: ProductId,
  choice: BadBatchChoice,
  unitPrice: number,
): StoreState {
  const pending = state.stock[id].filter((u) => u.pending);
  const rest = state.stock[id].filter((u) => !u.pending);
  if (choice === 'return') {
    const refund = Math.round(pending.length * unitPrice * RETURN_REFUND);
    return { ...state, money: state.money + refund, stock: { ...state.stock, [id]: rest } };
  }
  const resolved = state.stock[id].map((u) =>
    u.pending ? { age: u.age, bad: true, ...(choice === 'markdown' ? { markdown: true } : {}) } : u,
  );
  return { ...state, stock: { ...state.stock, [id]: resolved } };
}

/** Покупатель берёт самую старую штуку. Возвращает null, если товара нет. */
export function takeFromShelf(state: StoreState, id: ProductId): { state: StoreState; unit: Unit } | null {
  const [unit, ...rest] = state.stock[id];
  if (!unit) return null;
  return { state: { ...state, stock: { ...state.stock, [id]: rest } }, unit };
}

/** Возвращает товар на полку (покупатель ушёл из очереди). */
export function returnToShelf(state: StoreState, items: CartItem[]): StoreState {
  const stock = { ...state.stock };
  for (const { id, unit } of items) {
    if (stock[id].length < SHELF_CAPACITY) stock[id] = [unit, ...stock[id]];
  }
  return { ...state, stock };
}

export function checkout(state: StoreState, items: CartItem[]): { state: StoreState; total: number } {
  const total = items.reduce((sum, { id, unit }) => sum + unitSalePrice(state, id, unit), 0);
  return { state: { ...state, money: state.money + total }, total };
}

/** В корзине есть брак без уценки — покупатель может пожаловаться. */
export const hasUnmarkedBad = (items: CartItem[]): boolean => items.some(({ unit }) => unit.bad && !unit.markdown);

/** 0..1: доля довольных посетителей. Жалоба считается за «полпокупателя». */
export function satisfaction(stats: DayStats): number {
  const visitors = stats.served + stats.lost;
  if (visitors === 0) return 0.5;
  return Math.max(0, (stats.served - stats.complaints * 0.5) / visitors);
}

/** Сколько дней проживёт штука: брак портится на день раньше. */
export const unitLife = (id: ProductId, unit: Unit): number => Math.max(1, PRODUCTS[id].shelfLife - (unit.bad ? 1 : 0));

/** Ночь: товар стареет и портится, рейтинг двигается от довольства покупателей. */
export function endDay(state: StoreState, stats: DayStats): { state: StoreState; spoiled: number } {
  let spoiled = 0;
  const stock = { ...state.stock };
  for (const id of PRODUCT_IDS) {
    const aged = stock[id].map((u) => ({ ...u, age: u.age + 1 }));
    const kept = aged.filter((u) => u.age < unitLife(id, u));
    spoiled += aged.length - kept.length;
    stock[id] = kept;
  }
  const rating = Math.min(5, Math.max(0, state.rating + (satisfaction(stats) - 0.7) * 0.6));
  return {
    state: { ...state, day: state.day + 1, rating: Math.round(rating * 100) / 100, stock },
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
