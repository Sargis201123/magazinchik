// «Закупить нужное»: по каждому товару — сколько разберут за день (по продажам прошлых дней, а без
// истории — поровну от числа гостей) с запасом, минус то, что уже есть на полках и складе.
// Берём у того поставщика, у кого сегодня дешевле. Сначала — то, чего меньше всего.

import { buyChance, canPlace, CARRY, OWN_PRODUCTS, PRODUCT_IDS, PRODUCTS, shelfCapacity, shelfFree, shelveAll, productAvailable, seasonalDemand, sellableProducts, warehouseCapacity, warehouseCount, type Category, type ProductId, type StoreState } from './economy';
import { perceivedBase, seasonFor } from './endless';
import { dayDemand } from './demand';
import { bigDayDemand } from './bigday';
import { bakeModeOf, bakeryWorking, stockOf, usualSales } from './bakery';
import { ovenBatch } from './gear';
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

/** Сколько закладок своей печи за день считаем, закупая хлеб: пекарь успевает больше, но утром полки пустые. */
export const OVEN_DAY_BATCHES = 3;

/**
 * Сколько хлеба сегодня испечёт своя пекарня (пекарь на смене и печь не выключена): столько у
 * поставщика не берём — иначе пекарю некуда класть свой, а купленный лежит и черствеет.
 */
export const ownBreadToday = (state: StoreState): number =>
  bakeryWorking(state) && bakeModeOf(state) !== 'off' ? ovenBatch(state) * OVEN_DAY_BATCHES : 0;

/** Товар можно закупить сегодня: сезон, есть полка, кто-то продаёт. */
export const canStock = (state: StoreState, pid: ProductId): boolean =>
  productAvailable(pid, state.day) && state.shelves.some((sh) => canPlace(pid, sh));

/**
 * Сколько ещё встанет на полки отдела: свободные места на рабочих полках минус то, что уже ждёт на
 * складе (его разложат первым). Бракованная партия ждёт решения и на полки не идёт.
 */
export function shelfRoom(state: StoreState, category: Category): number {
  const free = state.shelves.filter((sh) => !sh.broken && sh.kind === category).reduce((sum, sh) => sum + Math.max(0, shelfFree(sh)), 0);
  const waiting = PRODUCT_IDS.filter((id) => PRODUCTS[id].category === category).reduce(
    (sum, id) => sum + (state.warehouse[id] ?? []).filter((u) => !u.pending).length,
    0,
  );
  return Math.max(0, free - waiting);
}

/**
 * План «Закупить нужное»: чего не хватит до цели, у самого дешёвого поставщика, в пределах места и
 * денег. Купленное сразу встаёт на полки (shelveAll), поэтому место — свободные полки своего отдела
 * плюс склад: одно нажатие заполняет и то и другое. Сначала товары, которых меньше всего относительно цели.
 */
export function restockPlan(
  state: StoreState,
  priceOf: (sid: SupplierId, pid: ProductId) => number | null,
  guests: number,
  /** Что не брать (автозаказ: строки, которые игрок вернул). */
  skip: ProductId[] = [],
  /** Сколько хлеба ещё испечёт своя печь сегодня (симулятор печёт до закупки и передаёт остаток). */
  ownBread = ownBreadToday(state),
): ReorderPlan {
  const wants = sellableProducts(state)
    .filter((pid) => canStock(state, pid) && !skip.includes(pid))
    .map((pid) => {
      // Сверху — то, что сегодня заберут по заказу и по договору с кафе: иначе полки опустеют к открытию.
      // Повар продукты не трогает — у кухни своя кладовая, она закупает сама (kitchen.ts).
      const reserved = (state.plan?.order?.product === pid ? state.plan.order.qty : 0) + (state.cafe?.deal?.items[pid] ?? 0);
      const target = Math.max(0, restockTarget(state, pid, guests) - (pid === 'bread' ? ownBread : 0)) + reserved;
      const have = stockOf(state, pid);
      return { pid, need: target - have, fill: have / Math.max(1, target), offer: bestOffer(state, pid, priceOf) };
    })
    .filter((w) => w.need > 0 && w.offer)
    .sort((a, b) => a.fill - b.fill);
  // Место считаем как после раскладки: ждущее на складе, чему есть полка, уйдёт туда первым.
  const shelved = shelveAll(state);
  let room = Math.max(0, warehouseCapacity(shelved) - warehouseCount(shelved));
  // Свободные места на полках — по отделам: молоко не встанет на хлебную полку.
  const shelves = new Map<Category, number>();
  let money = state.money;
  let short: ReorderPlan['short'];
  const lines: ReorderPlan['lines'] = [];
  for (const w of wants) {
    const { sid, price } = w.offer!;
    const category = PRODUCTS[w.pid].category;
    // Покупка идёт через склад: забит он тем, что на полки не встанет, — до полок товару не дойти.
    const onShelf = room > 0 ? (shelves.get(category) ?? shelfRoom(shelved, category)) : 0;
    const afford = Math.floor(money / price);
    const qty = Math.max(0, Math.min(w.need, onShelf + room, afford));
    // Почему не всё: сначала кончилось место или деньги (первая причина и решает, что подсказать).
    if (qty < w.need) short ??= afford < Math.min(w.need, onShelf + room) ? 'money' : 'room';
    if (qty <= 0) continue;
    const toShelf = Math.min(qty, onShelf);
    shelves.set(category, onShelf - toShelf);
    room -= qty - toShelf;
    money -= qty * price;
    lines.push({ sid, pid: w.pid, qty, price });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.qty * l.price, 0), cut: Boolean(short), ...(short ? { short } : {}) };
}
