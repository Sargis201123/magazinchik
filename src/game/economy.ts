// Чистая игровая логика без Phaser: её легко тестировать и потом переиспользовать
// на сервере (проверка сохранений, расчёт дохода офлайн).

import type { TextKey } from '../i18n/ru';

export type ProductId = 'bread' | 'milk' | 'apples';

export interface Product {
  id: ProductId;
  nameKey: TextKey;
  /** Цена закупки у поставщика за штуку. */
  cost: number;
  /** «Справедливая» розничная цена: при ней спрос нормальный. */
  basePrice: number;
  color: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  bread: { id: 'bread', nameKey: 'product.bread', cost: 2, basePrice: 4, color: 0xd9a066 },
  milk: { id: 'milk', nameKey: 'product.milk', cost: 3, basePrice: 6, color: 0xeef3f7 },
  apples: { id: 'apples', nameKey: 'product.apples', cost: 1, basePrice: 3, color: 0xd04648 },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export const SHELF_CAPACITY = 10;

export interface StoreState {
  day: number;
  money: number;
  /** 0..5 звёзд, влияет на поток покупателей. */
  rating: number;
  stock: Record<ProductId, number>;
  prices: Record<ProductId, number>;
}

export interface DayStats {
  revenue: number;
  served: number;
  lost: number;
}

export const newGame = (): StoreState => ({
  day: 1,
  money: 40,
  rating: 3,
  stock: { bread: 6, milk: 4, apples: 8 },
  prices: { bread: 4, milk: 6, apples: 3 },
});

export const emptyDayStats = (): DayStats => ({ revenue: 0, served: 0, lost: 0 });

/**
 * Вероятность, что покупатель возьмёт товар при такой цене.
 * Цена = базовой → 75%, в два раза дешевле → 100%, в два раза дороже → 25%.
 */
export function buyChance(price: number, basePrice: number): number {
  const ratio = price / basePrice;
  return Math.min(1, Math.max(0.05, 1.25 - 0.5 * ratio));
}

/** Сколько стоит дозаполнить все полки до SHELF_CAPACITY. */
export function restockCost(state: StoreState): number {
  return PRODUCT_IDS.reduce(
    (sum, id) => sum + (SHELF_CAPACITY - state.stock[id]) * PRODUCTS[id].cost,
    0,
  );
}

/** Дозаполняет полки. Возвращает null, если денег не хватает. */
export function restock(state: StoreState): StoreState | null {
  const cost = restockCost(state);
  if (cost > state.money) return null;
  const stock = { ...state.stock };
  for (const id of PRODUCT_IDS) stock[id] = SHELF_CAPACITY;
  return { ...state, money: state.money - cost, stock };
}

/** Берёт товар с полки. Возвращает null, если товара нет. */
export function takeFromShelf(state: StoreState, id: ProductId): StoreState | null {
  if (state.stock[id] <= 0) return null;
  return { ...state, stock: { ...state.stock, [id]: state.stock[id] - 1 } };
}

export function checkout(state: StoreState, items: ProductId[]): { state: StoreState; total: number } {
  const total = items.reduce((sum, id) => sum + state.prices[id], 0);
  return { state: { ...state, money: state.money + total }, total };
}

/** Итог дня двигает рейтинг: довольные покупатели поднимают, ушедшие — опускают. */
export function endDay(state: StoreState, stats: DayStats): StoreState {
  const visitors = stats.served + stats.lost;
  const satisfaction = visitors === 0 ? 0.5 : stats.served / visitors;
  const rating = Math.min(5, Math.max(0, state.rating + (satisfaction - 0.7) * 0.5));
  return { ...state, day: state.day + 1, rating: Math.round(rating * 100) / 100 };
}

/** Секунд между появлениями покупателей: чем выше рейтинг, тем чаще. */
export const spawnInterval = (rating: number): number => 6 - rating * 0.8;
