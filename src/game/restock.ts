// «Закупить нужное»: по каждому товару — сколько разберут за день (по продажам прошлых дней, а без
// истории — поровну от числа гостей) с запасом, минус то, что уже есть на полках и складе.
// Берём у того поставщика, у кого сегодня дешевле. Сначала — то, чего меньше всего.

import { canPlace, productAvailable, sellableProducts, warehouseCapacity, warehouseCount, type ProductId, type StoreState } from './economy';
import { stockOf, usualSales } from './bakery';
import { AUTO_RESERVE, type ReorderPlan } from './reorder';
import { SUPPLIER_IDS, SUPPLIERS, supplierOpen, type SupplierId } from './suppliers';

/** Сколько покупок в среднем делает гость (на все товары вместе). */
const ITEMS_PER_GUEST = 1.5;

/** Самая низкая цена товара сегодня и у кого. null — никто не продаёт (или нет полки отдела). */
export function bestOffer(
  state: StoreState,
  pid: ProductId,
  priceOf: (sid: SupplierId, pid: ProductId) => number | null,
): { sid: SupplierId; price: number } | null {
  let best: { sid: SupplierId; price: number } | null = null;
  for (const sid of SUPPLIER_IDS) {
    if (!supplierOpen(SUPPLIERS[sid], state.shelves)) continue;
    const price = priceOf(sid, pid);
    if (price !== null && (!best || price < best.price)) best = { sid, price };
  }
  return best;
}

/** Сколько штук держать к открытию: обычные продажи с запасом; без истории — доля от гостей дня. */
export function restockTarget(state: StoreState, pid: ProductId, guests: number): number {
  const usual = usualSales(state, pid);
  if (usual !== null) return Math.ceil(usual * AUTO_RESERVE);
  const kinds = Math.max(1, sellableProducts(state).length);
  return Math.ceil(((guests * ITEMS_PER_GUEST) / kinds) * AUTO_RESERVE);
}

/** Товар можно закупить сегодня: сезон, есть полка, кто-то продаёт. */
export const canStock = (state: StoreState, pid: ProductId): boolean =>
  productAvailable(pid, state.day) && state.shelves.some((sh) => canPlace(pid, sh));

/**
 * План «Закупить нужное»: чего не хватит до цели, у самого дешёвого поставщика, в пределах склада и
 * денег. Сначала товары, которых меньше всего относительно цели.
 */
export function restockPlan(state: StoreState, priceOf: (sid: SupplierId, pid: ProductId) => number | null, guests: number): ReorderPlan {
  const wants = sellableProducts(state)
    .filter((pid) => canStock(state, pid))
    .map((pid) => {
      const target = restockTarget(state, pid, guests);
      const have = stockOf(state, pid);
      return { pid, need: target - have, fill: have / Math.max(1, target), offer: bestOffer(state, pid, priceOf) };
    })
    .filter((w) => w.need > 0 && w.offer)
    .sort((a, b) => a.fill - b.fill);
  let room = warehouseCapacity(state) - warehouseCount(state);
  let money = state.money;
  let cut = false;
  const lines: ReorderPlan['lines'] = [];
  for (const w of wants) {
    const { sid, price } = w.offer!;
    const qty = Math.max(0, Math.min(w.need, room, Math.floor(money / price)));
    if (qty < w.need) cut = true;
    if (qty <= 0) continue;
    room -= qty;
    money -= qty * price;
    lines.push({ sid, pid: w.pid, qty, price });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.qty * l.price, 0), cut };
}
