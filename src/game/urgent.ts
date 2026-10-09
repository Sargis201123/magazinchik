// Срочный подвоз днём: товар кончился — звонишь поставщику, через несколько секунд приезжает
// фургон. Дороже утренней закупки (наценка и плата за выезд), зато магазин не стоит пустым.
// Менеджер зала заказывает сам, когда видит, что товар закончился и на полке, и на складе.

import { onShelves, productAvailable, sellableProducts, warehouseCapacity, warehouseCount, warehouseOf, type ProductId, type StoreState } from './economy';
import { newDeal, SUPPLIER_IDS, SUPPLIERS, unitPrice } from './suppliers';

/** Наценка за срочность к обычной цене поставщика и плата за выезд. */
export const URGENT_MARKUP = 1.4;
export const URGENT_FEE = 40;
/** Сколько секунд дня едет фургон. */
export const URGENT_SECONDS = 8;
/** Сколько штук можно заказать за раз. */
export const URGENT_QTYS = [6, 12] as const;

/** Цена штуки при срочном заказе: самый дешёвый поставщик × наценка. null — никто не продаёт. */
export function urgentUnitPrice(state: StoreState, id: ProductId): number | null {
  if (!productAvailable(id, state.day)) return null;
  const prices = SUPPLIER_IDS.map((sid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), id)).filter((p): p is number => p !== null);
  if (!prices.length) return null;
  return Math.round(Math.min(...prices) * URGENT_MARKUP);
}

export const urgentCost = (state: StoreState, id: ProductId, qty: number): number | null => {
  const unit = urgentUnitPrice(state, id);
  return unit === null ? null : unit * qty + URGENT_FEE;
};

/** Сколько ещё влезет на склад с учётом того, что уже едет. */
export const urgentRoom = (state: StoreState, onTheWay: number): number => warehouseCapacity(state) - warehouseCount(state) - onTheWay;

/** Оплатить срочный заказ (товар приедет позже, см. receiveUrgent). null — нет денег, места или товара. */
export function orderUrgent(state: StoreState, id: ProductId, qty: number, onTheWay = 0): StoreState | null {
  const cost = urgentCost(state, id, qty);
  if (cost === null || cost > state.money || qty > urgentRoom(state, onTheWay)) return null;
  return { ...state, money: state.money - cost };
}

/** Фургон приехал: товар на склад (уже оплачен). Места нет — сколько влезло. */
export function receiveUrgent(state: StoreState, id: ProductId, qty: number): StoreState {
  const n = Math.max(0, Math.min(qty, warehouseCapacity(state) - warehouseCount(state)));
  if (!n) return state;
  return { ...state, warehouse: { ...state.warehouse, [id]: [...(state.warehouse[id] ?? []), ...Array.from({ length: n }, () => ({ age: 0 }))] } };
}

/** Что менеджер закажет сам: товар, которого нет ни на полках, ни на складе (первый по списку). */
export function managerPick(state: StoreState): ProductId | null {
  return sellableProducts(state).find((id) => onShelves(state, id) === 0 && warehouseOf(state, id) === 0 && urgentUnitPrice(state, id) !== null) ?? null;
}
