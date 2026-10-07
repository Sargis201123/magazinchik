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

export interface StoreState {
  day: number;
  money: number;
  /** 0..5 звёзд, влияет на поток покупателей. */
  rating: number;
  /** Товар на полке: возраст каждой штуки в днях, самые старые — в начале. */
  stock: Record<ProductId, number[]>;
  prices: Record<ProductId, number>;
}

export interface DayStats {
  revenue: number;
  served: number;
  /** Ушли без покупки: не дождались кассы или не нашли товар. */
  lost: number;
  /** Купили, но остались недовольны: грязь, ужасный туалет. */
  complaints: number;
  spoiled: number;
}

export const newGame = (): StoreState => ({
  day: 1,
  money: 300,
  rating: 3,
  stock: { bread: [0, 0, 0, 0], milk: [0, 0, 0], apples: [0, 0, 0, 0, 0] },
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

export function setPrice(state: StoreState, id: ProductId, price: number): StoreState {
  const clamped = Math.max(PRICE_STEP, Math.min(PRODUCTS[id].basePrice * 3, price));
  return { ...state, prices: { ...state.prices, [id]: clamped } };
}

/** Покупка у поставщика. Возвращает null, если не хватает денег или места на полке. */
export function buyStock(state: StoreState, id: ProductId, qty: number, unitPrice: number): StoreState | null {
  const total = qty * unitPrice;
  if (qty <= 0 || total > state.money || stockCount(state, id) + qty > SHELF_CAPACITY) return null;
  return {
    ...state,
    money: state.money - total,
    stock: { ...state.stock, [id]: [...state.stock[id], ...Array<number>(qty).fill(0)] },
  };
}

/** Покупатель берёт самую старую штуку. Возвращает null, если товара нет. */
export function takeFromShelf(state: StoreState, id: ProductId): StoreState | null {
  if (state.stock[id].length === 0) return null;
  return { ...state, stock: { ...state.stock, [id]: state.stock[id].slice(1) } };
}

/** Возвращает товар на полку (покупатель ушёл из очереди). Возраст сбрасываем — точность тут не важна. */
export function returnToShelf(state: StoreState, items: ProductId[]): StoreState {
  const stock = { ...state.stock };
  for (const id of items) {
    if (stock[id].length < SHELF_CAPACITY) stock[id] = [...stock[id], 0];
  }
  return { ...state, stock };
}

export function checkout(state: StoreState, items: ProductId[]): { state: StoreState; total: number } {
  const total = items.reduce((sum, id) => sum + state.prices[id], 0);
  return { state: { ...state, money: state.money + total }, total };
}

/** 0..1: доля довольных посетителей. Жалоба считается за «полпокупателя». */
export function satisfaction(stats: DayStats): number {
  const visitors = stats.served + stats.lost;
  if (visitors === 0) return 0.5;
  return Math.max(0, (stats.served - stats.complaints * 0.5) / visitors);
}

/** Ночь: товар стареет и портится, рейтинг двигается от довольства покупателей. */
export function endDay(state: StoreState, stats: DayStats): { state: StoreState; spoiled: number } {
  let spoiled = 0;
  const stock = { ...state.stock };
  for (const id of PRODUCT_IDS) {
    const aged = stock[id].map((age) => age + 1);
    const fresh = aged.filter((age) => age < PRODUCTS[id].shelfLife);
    spoiled += aged.length - fresh.length;
    stock[id] = fresh;
  }
  const rating = Math.min(5, Math.max(0, state.rating + (satisfaction(stats) - 0.7) * 0.5));
  return {
    state: { ...state, day: state.day + 1, rating: Math.round(rating * 100) / 100, stock },
    spoiled,
  };
}

/** Секунд между появлениями покупателей: чем выше рейтинг, тем чаще. */
export const spawnInterval = (rating: number): number => 6 - rating * 0.8;
