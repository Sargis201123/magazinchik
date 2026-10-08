// Доставка на дом: днём звонит телефон у кассы — заказ на пару товаров. Нажал вовремя —
// товар собирают со склада (а не хватит — с полок), курьер на велосипеде отвозит и
// привозит деньги с наценкой за доставку. Не ответил за 12 секунд — заказ ушёл к Эдуарду.

import { onShelves, sellableProducts, warehouseOf, type ProductId, type StoreState } from './economy';

/** Через сколько секунд звонят (случайно в этих пределах) и сколько ждут ответа. */
export const ORDER_EVERY: [number, number] = [16, 30];
export const ORDER_TIMEOUT = 12;
/** Наценка за доставку и сколько секунд курьер в пути (туда и обратно). */
export const DELIVERY_FEE = 30;
export const DELIVERY_SECONDS = 9;

export interface HomeOrder {
  items: { id: ProductId; qty: number }[];
  pay: number;
}

const inStock = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Заказ из того, что есть в магазине: 1–2 товара по 1–3 штуки. */
export function makeHomeOrder(state: StoreState, random: () => number): HomeOrder | null {
  const options = sellableProducts(state).filter((id) => inStock(state, id) > 0);
  if (!options.length) return null;
  const items: HomeOrder['items'] = [];
  const kinds = Math.min(options.length, random() < 0.5 ? 1 : 2);
  while (items.length < kinds) {
    const id = options.splice(Math.floor(random() * options.length), 1)[0];
    items.push({ id, qty: 1 + Math.floor(random() * 3) });
  }
  const pay = items.reduce((sum, { id, qty }) => sum + state.prices[id] * qty, 0) + DELIVERY_FEE;
  return { items, pay };
}

export const canFulfill = (state: StoreState, order: HomeOrder): boolean => order.items.every(({ id, qty }) => inStock(state, id) >= qty);

/** Собрать заказ: сначала со склада (самое старое), потом с полок. null — не хватает товара. */
export function packHomeOrder(state: StoreState, order: HomeOrder): StoreState | null {
  if (!canFulfill(state, order)) return null;
  let warehouse = { ...state.warehouse };
  let shelves = state.shelves;
  for (const { id, qty } of order.items) {
    let need = qty;
    const fromWarehouse = Math.min(need, (warehouse[id] ?? []).filter((u) => !u.pending).length);
    warehouse = { ...warehouse, [id]: (warehouse[id] ?? []).filter((u, i, all) => u.pending || all.slice(0, i + 1).filter((x) => !x.pending).length > fromWarehouse) };
    need -= fromWarehouse;
    shelves = shelves.map((s) => {
      if (need === 0 || s.broken) return s;
      const units = s.items[id] ?? [];
      const take = Math.min(need, units.length);
      need -= take;
      return take ? { ...s, items: { ...s.items, [id]: units.slice(take) } } : s;
    });
  }
  return { ...state, warehouse, shelves };
}
