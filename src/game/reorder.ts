// «Как в прошлый раз»: игра помнит утренние закупки и одной кнопкой повторяет последнюю —
// по сегодняшним ценам, сколько влезет на склад и на сколько хватит денег.
// Автозаказ: каждое утро склад сам пополняется до запомненного списка.

import { buyStock, productAvailable, warehouseCapacity, warehouseCount, warehouseOf, type ProductId, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { SUPPLIERS, type SupplierId } from './suppliers';

export interface OrderLine {
  sid: SupplierId;
  pid: ProductId;
  qty: number;
}

/** Сколько последних дней закупок помнить. */
const KEEP_DAYS = 2;

/** Записать покупку в сегодняшнюю закупку (одинаковые товары у одного поставщика складываются). */
export function recordPurchase(state: StoreState, sid: SupplierId, pid: ProductId, qty: number): StoreState {
  const days = state.purchases ?? [];
  const today = days.find((d) => d.day === state.day) ?? { day: state.day, lines: [] };
  const lines = today.lines.some((l) => l.sid === sid && l.pid === pid)
    ? today.lines.map((l) => (l.sid === sid && l.pid === pid ? { ...l, qty: l.qty + qty } : l))
    : [...today.lines, { sid, pid, qty }];
  const rest = days.filter((d) => d.day !== state.day);
  return { ...state, purchases: [...rest, { day: state.day, lines }].slice(-KEEP_DAYS) };
}

/** Последняя закупка до сегодняшнего дня. */
export function previousOrder(state: StoreState): { day: number; lines: OrderLine[] } | null {
  const before = (state.purchases ?? []).filter((d) => d.day < state.day && d.lines.length);
  const last = before[before.length - 1];
  return last ? { day: last.day, lines: last.lines as OrderLine[] } : null;
}

export interface ReorderPlan {
  lines: (OrderLine & { price: number })[];
  total: number;
  /** Не всё влезло: не хватило места или денег. */
  cut: boolean;
}

/** Что купим, если повторить: по сегодняшним ценам, в пределах склада и денег; несезонное пропускаем. */
export function reorderPlan(state: StoreState, priceOf: (sid: SupplierId, pid: ProductId) => number | null): ReorderPlan | null {
  const order = previousOrder(state);
  if (!order) return null;
  let room = warehouseCapacity(state) - warehouseCount(state);
  let money = state.money;
  let cut = false;
  const lines: ReorderPlan['lines'] = [];
  for (const line of order.lines) {
    const price = SUPPLIERS[line.sid] ? priceOf(line.sid, line.pid) : null;
    if (price === null || !productAvailable(line.pid, state.day)) continue;
    const qty = Math.min(line.qty, room, Math.floor(money / price));
    if (qty < line.qty) cut = true;
    if (qty <= 0) continue;
    room -= qty;
    money -= qty * price;
    lines.push({ ...line, qty, price });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.qty * l.price, 0), cut };
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
    next = recordPurchase(bought, line.sid, line.pid, line.qty);
  }
  return { state: next, badLine };
}

/** Шаблон автозаказа: сколько штук каждого товара держать на складе и у кого брать. */
export interface AutoOrder {
  on: boolean;
  lines: OrderLine[];
}

/** Запомнить список: сегодняшняя закупка, а если сегодня ещё не закупались — прошлая. */
export function rememberAutoOrder(state: StoreState): StoreState | null {
  const today = (state.purchases ?? []).find((d) => d.day === state.day && d.lines.length);
  const lines = (today?.lines as OrderLine[] | undefined) ?? previousOrder(state)?.lines;
  if (!lines?.length) return null;
  return { ...state, autoOrder: { on: true, lines: lines.map((l) => ({ ...l })) } };
}

export function toggleAutoOrder(state: StoreState): StoreState | null {
  if (!state.autoOrder) return null;
  return { ...state, autoOrder: { ...state.autoOrder, on: !state.autoOrder.on } };
}

/**
 * Что привезёт автозаказ: по каждому товару — сколько не хватает на складе до списка, по обычной
 * цене (без торга), в пределах склада и денег. null — автозаказа нет или он выключен.
 */
export function autoOrderPlan(state: StoreState, priceOf: (sid: SupplierId, pid: ProductId) => number | null): ReorderPlan | null {
  const auto = state.autoOrder;
  if (!auto?.on || !auto.lines.length || !hasUpgrade(state, 'autoOrder')) return null;
  let room = warehouseCapacity(state) - warehouseCount(state);
  let money = state.money;
  let cut = false;
  const lines: ReorderPlan['lines'] = [];
  for (const line of auto.lines as OrderLine[]) {
    const price = SUPPLIERS[line.sid] ? priceOf(line.sid, line.pid) : null;
    if (price === null || !productAvailable(line.pid, state.day)) continue;
    const need = line.qty - warehouseOf(state, line.pid);
    if (need <= 0) continue;
    const qty = Math.min(need, room, Math.floor(money / price));
    if (qty < need) cut = true;
    if (qty <= 0) continue;
    room -= qty;
    money -= qty * price;
    lines.push({ ...line, qty, price });
  }
  return { lines, total: lines.reduce((sum, l) => sum + l.qty * l.price, 0), cut };
}
