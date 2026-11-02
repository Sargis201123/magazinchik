// Срочный подвоз днём: товар кончился и на полке, и на складе — менеджер зала звонит поставщику, через
// несколько секунд приезжает фургон. Чуть дороже утренней закупки, зато магазин не стоит пустым.
// Сам игрок срочно не заказывает (02.11: одна кнопка закупки) — днём подвозят менеджер и автозакупка
// (autoorder.ts), тем же фургоном.

import { onShelves, productAvailable, sellableProducts, warehouseCapacity, warehouseCount, warehouseOf, type ProductId, type StoreState } from './economy';
import { listPrice } from './suppliers';

/** Наценка менеджера за срочность к самой низкой цене поставщиков (выезд бесплатный). */
export const MANAGER_MARKUP = 1.1;
/** Сколько секунд дня едет фургон. */
export const URGENT_SECONDS = 8;
/** Сколько штук менеджер заказывает за раз. */
export const MANAGER_QTY = 6;

/** Цена штуки при срочном заказе менеджера: самый дешёвый поставщик × наценка. null — никто не продаёт. */
export function urgentUnitPrice(state: StoreState, id: ProductId): number | null {
  if (!productAvailable(id, state.day)) return null;
  const price = listPrice(id);
  return price === null ? null : Math.round(price * MANAGER_MARKUP);
}

export const urgentCost = (state: StoreState, id: ProductId, qty: number): number | null => {
  const unit = urgentUnitPrice(state, id);
  return unit === null ? null : unit * qty;
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
