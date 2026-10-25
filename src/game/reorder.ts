// План закупки одной кнопкой («Закупить нужное», restock.ts; утренняя закупка автозаказа, autoorder.ts):
// строки «у кого, что, сколько и почём» и покупка по ним.

import { buyStock, shelveAll, warehouseCapacity, warehouseCount, type ProductId, type StoreState, type Unit } from './economy';
import type { SupplierId } from './suppliers';

export interface OrderLine {
  sid: SupplierId;
  pid: ProductId;
  qty: number;
}

export interface ReorderPlan {
  lines: (OrderLine & { price: number })[];
  total: number;
  /** Не всё влезло: не хватило места или денег. */
  cut: boolean;
  /** Чего не хватило первым: места на полках и складе или денег. */
  short?: 'room' | 'money';
}

/**
 * Купить одну строку плана. Купленное сразу встаёт на полки, поэтому строка бывает больше свободного
 * склада: берём частями — сколько влезает на склад, раскладываем (shelveAll) и снова. bad — партия
 * бракованная: она ждёт решения игрока на складе, на полки не идёт, поэтому бракованной бывает только
 * последняя часть, которая целиком влезла на склад. mark — пометить купленные штуки (автозаказ).
 * Возвращает, сколько куплено и сколько из них брака.
 */
export function buyLine(
  state: StoreState,
  line: OrderLine & { price: number },
  bad = false,
  mark?: (unit: Unit) => Unit,
): { state: StoreState; qty: number; bad: number } {
  let next = state;
  let left = line.qty;
  let badQty = 0;
  while (left > 0) {
    const part = Math.min(left, warehouseCapacity(next) - warehouseCount(next));
    if (part <= 0) break;
    const asBad = bad && part === left;
    let bought = buyStock(next, line.pid, part, line.price, asBad);
    if (!bought) break;
    if (mark) {
      const units = bought.warehouse[line.pid]!;
      bought = { ...bought, warehouse: { ...bought.warehouse, [line.pid]: units.map((u, i) => (i >= units.length - part ? mark(u) : u)) } };
    }
    left -= part;
    if (asBad) badQty = part;
    // Раскладываем только между частями: последнюю разложит тот, кто закупал (как и раньше).
    next = left > 0 ? shelveAll(bought) : bought;
  }
  return { state: next, qty: line.qty - left, bad: badQty };
}

/** Закупить по плану. bad — какая строка оказалась бракованной (не больше одной за раз); в badLine — сколько штук брака. */
export function applyReorder(state: StoreState, plan: ReorderPlan, bad: (line: OrderLine) => boolean): { state: StoreState; badLine: (OrderLine & { price: number }) | null } {
  let next = state;
  let badLine: (OrderLine & { price: number }) | null = null;
  for (const line of plan.lines) {
    const got = buyLine(next, line, !badLine && bad(line));
    next = got.state;
    if (got.bad) badLine = { ...line, qty: got.bad };
  }
  return { state: next, badLine };
}

/** Запас сверх обычных продаж — на день с наплывом. */
export const AUTO_RESERVE = 1.2;
