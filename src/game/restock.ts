// «Закупить нужное»: по каждому товару — сколько разберут за день (по продажам прошлых дней, а без
// истории — поровну от числа гостей) с запасом, минус то, что уже есть на полках и складе.
// Берём у того поставщика, у кого сегодня дешевле. Сначала — то, чего меньше всего.

import { buyChance, canPlace, CARRY, OWN_PRODUCTS, PRODUCTS, shelfCapacity, productAvailable, seasonalDemand, sellableProducts, warehouseCapacity, warehouseCount, type ProductId, type StoreState } from './economy';
import { perceivedBase, seasonFor } from './endless';
import { dayDemand } from './demand';
import { bigDayDemand } from './bigday';
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

/**
 * Сколько штук держать к открытию — по той же модели спроса, по которой покупатели выбирают товар:
 * сезон, погода, акции, ценовая война, своя марка, здания района, и насколько им нравится цена.
 * Особый день не учитываем: о нём узнают только при открытии. Продажи прошлых дней занижают спрос
 * (чего не было на полке, того и не продали), поэтому из модели и истории берём большее.
 */
export function restockTarget(state: StoreState, pid: ProductId, guests: number): number {
  const weight = (id: ProductId) =>
    (seasonFor(state.day)?.demand[id] ?? 1) * seasonalDemand(id, state.day) * (dayDemand(state, id) / bigDayDemand(state.day, id));
  // Свою выпечку специально не ищут — она не делит спрос с остальным.
  const pool = sellableProducts(state).filter((id) => !OWN_PRODUCTS.includes(id));
  const total = pool.reduce((sum, id) => sum + weight(id), 0) || 1;
  const modelled = guests * ITEMS_PER_GUEST * (weight(pid) / total) * buyChance(state.prices[pid], perceivedBase(state, pid));
  const usual = usualSales(state, pid) ?? 0;
  // Больше, чем встанет на полки (плюс пара походов со склада), не берём: лишнее лежит и портится,
  // а деньги нужны на расширение.
  const category = PRODUCTS[pid].category;
  const room = state.shelves.filter((sh) => sh.kind === category).reduce((sum, sh) => sum + shelfCapacity(sh), 0);
  const neighbours = Math.max(1, pool.filter((id) => PRODUCTS[id].category === category).length);
  return Math.ceil(Math.min(Math.max(usual, modelled) * AUTO_RESERVE, room / neighbours + CARRY * 2));
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
      // Сверху — то, что сегодня заберут по заказу и по договору с кафе: иначе полки опустеют к открытию.
      // Повар продукты не трогает — у кухни своя кладовая, она закупает сама (kitchen.ts).
      const reserved = (state.plan?.order?.product === pid ? state.plan.order.qty : 0) + (state.cafe?.deal?.items[pid] ?? 0);
      const target = restockTarget(state, pid, guests) + reserved;
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
