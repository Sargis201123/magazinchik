// Доска «Заказы» (02.11): всё, что у магазина берут оптом, — одним блоком утра, коротким списком «кто,
// что, сколько» с ответом «отдать / принять / отказать». Раньше это были четыре разных места: заказ
// клиента в новостях утра (events.ts), договор кафе «Пончик» в закупке (cafe.ts), «отложи мне» соседа
// в почте (returns.ts) и поставки хлеба соседним магазинам в улучшениях (bakery.ts). Правила и цены
// остались прежними (заказ клиента +30%, кафе +15%, сосед +20%) — сменилось только то, где их видно.
// Ярмарка (fair.ts) и звонки доставки на дом (delivery.ts) — сами по себе, как были.

import { onShelves, warehouseOf, type ProductId, type StoreState } from './economy';
import type { ClientOrder } from './events';
import { cafeCanDeliver, cafeOf, type CafeState } from './cafe';
import { collectOrder, dropOrder, orderPay, type NeighbourOrder } from './returns';
import { hasUpgrade } from './upgrades';
import { ovenBatch } from './gear';
import { WHOLESALE_BATCHES, WHOLESALE_PRICE } from './bakery';

export type OrderRow =
  /** Заказ клиента: ждёт ответа или принят (заберут вечером). */
  | { kind: 'client'; order: ClientOrder; accepted: boolean; ready: boolean }
  /** Кафе предлагает договор на неделю. */
  | { kind: 'cafeOffer'; offer: NonNullable<CafeState['offer']> }
  /** Договор с кафе идёт: утром, как откроешься, заберут своё. */
  | { kind: 'cafeDeal'; deal: NonNullable<CafeState['deal']>; ready: boolean }
  /** Сосед просил отложить: отдать сейчас или он зайдёт к закрытию. */
  | { kind: 'neighbour'; order: NeighbourOrder; pay: number; ready: boolean }
  /** Хлеб соседним магазинам: пекарь печёт сам (договор куплен) или можно договориться. */
  | { kind: 'bread'; owned: boolean; perDay: number };

const have = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Неизменное сегодня — ровно то, что можно показать на доске, по порядку: сначала то, что ждёт ответа. */
export function orderBoard(state: StoreState): OrderRow[] {
  const rows: OrderRow[] = [];
  const plan = state.plan?.day === state.day ? state.plan : undefined;
  if (plan?.offer) rows.push({ kind: 'client', order: plan.offer, accepted: false, ready: have(state, plan.offer.product) >= plan.offer.qty });
  const cafe = cafeOf(state);
  if (cafe.offer) rows.push({ kind: 'cafeOffer', offer: cafe.offer });
  const n = state.ret?.order;
  if (n && n.day === state.day) rows.push({ kind: 'neighbour', order: n, pay: orderPay(state, n), ready: have(state, n.pid) >= n.qty });
  if (plan?.order) rows.push({ kind: 'client', order: plan.order, accepted: true, ready: have(state, plan.order.product) >= plan.order.qty });
  if (cafe.deal) rows.push({ kind: 'cafeDeal', deal: cafe.deal, ready: cafeCanDeliver(state) });
  if (hasUpgrade(state, 'oven')) rows.push({ kind: 'bread', owned: hasUpgrade(state, 'wholesale'), perDay: WHOLESALE_BATCHES * ovenBatch(state) * WHOLESALE_PRICE });
  return rows;
}

/** Отдать соседу отложенное прямо сейчас (товара хватает): он платит, заказ закрыт. null — нечего отдавать. */
export function giveNeighbour(state: StoreState): { state: StoreState; paid: number } | null {
  const res = collectOrder(state);
  return res && res.paid ? { state: res.state, paid: res.paid } : null;
}

/** Отказать соседу: заказ снимается без обид (как «не дождался»). */
export const declineNeighbour = (state: StoreState): StoreState => dropOrder(state);
