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

/** Сколько штук товара останется на складе после раскладки (ждущий решения брак не считаем). */
const staysInWarehouse = (state: StoreState, pid: ProductId): number => (shelveAll(state).warehouse[pid] ?? []).filter((u) => !u.pending).length;

/**
 * Купить одну строку плана. Купленное сразу встаёт на полки, поэтому строка бывает больше свободного
 * склада: берём частями — сколько влезает на склад, раскладываем (shelveAll) и снова. Раскладываем и
 * перед первой частью, если склад тесен: там может лежать хвост прошлой строки, которому есть место на
 * полке, — иначе он занял бы склад и следующие строки не купились бы (план их считал). bad — партия
 * бракованная: она ждёт решения игрока на складе и на полки не идёт, поэтому бракованным выходит
 * только то, что и так осталось бы на складе после раскладки, — склад он не занимает сверх плана и
 * следующим строкам не мешает. Всё ушло на полки — брака в этот раз нет. mark — пометить купленные
 * штуки (автозаказ). Возвращает, сколько куплено и сколько из них брака.
 */
export function buyLine(
  state: StoreState,
  line: OrderLine & { price: number },
  bad = false,
  mark?: (unit: Unit) => Unit,
): { state: StoreState; qty: number; bad: number } {
  let next = state;
  let left = line.qty;
  while (left > 0) {
    if (warehouseCapacity(next) - warehouseCount(next) < left) next = shelveAll(next);
    const part = Math.min(left, warehouseCapacity(next) - warehouseCount(next));
    if (part <= 0) break;
    let bought = buyStock(next, line.pid, part, line.price);
    if (!bought) break;
    if (mark) {
      const units = bought.warehouse[line.pid]!;
      bought = { ...bought, warehouse: { ...bought.warehouse, [line.pid]: units.map((u, i) => (i >= units.length - part ? mark(u) : u)) } };
    }
    left -= part;
    // Последнюю часть разложит тот, кто закупал (как и раньше), остальные — в начале круга.
    next = bought;
  }
  const qty = line.qty - left;
  // Раскладка берёт самые старые штуки, на складе остаются последние купленные — они и брак.
  const badQty = bad && qty > 0 ? Math.max(0, Math.min(qty, staysInWarehouse(next, line.pid) - staysInWarehouse(state, line.pid))) : 0;
  if (badQty > 0) {
    const units = next.warehouse[line.pid]!;
    next = { ...next, warehouse: { ...next.warehouse, [line.pid]: units.map((u, i) => (i >= units.length - badQty ? { ...u, bad: true, pending: true } : u)) } };
  }
  return { state: next, qty, bad: badQty };
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
