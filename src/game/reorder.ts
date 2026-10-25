// План закупки одной кнопкой («Закупить нужное», restock.ts; утренняя закупка автозаказа, autoorder.ts):
// строки «у кого, что, сколько и почём» и покупка по ним.

import { buyStock, type ProductId, type StoreState } from './economy';
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
}

/** Закупить по плану. bad — какая строка оказалась бракованной (не больше одной за раз). */
export function applyReorder(state: StoreState, plan: ReorderPlan, bad: (line: OrderLine) => boolean): { state: StoreState; badLine: (OrderLine & { price: number }) | null } {
  let next = state;
  let badLine: (OrderLine & { price: number }) | null = null;
  for (const line of plan.lines) {
    const isBad = !badLine && bad(line);
    const bought = buyStock(next, line.pid, line.qty, line.price, isBad);
    if (!bought) continue;
    if (isBad) badLine = line;
    next = bought;
  }
  return { state: next, badLine };
}

/** Запас сверх обычных продаж — на день с наплывом. */
export const AUTO_RESERVE = 1.2;
