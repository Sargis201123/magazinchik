// Заявки соседей: школа, общежитие, детский сад, больница и бизнес-центр присылают заказы
// с запасом времени — «к пятнице 20 молока и 15 яблок». Отправить можно в любое утро до срока,
// если товара хватает (берётся со склада, потом с полок). Платят дороже розницы, и с каждым
// выполненным заказом у соседа растёт репутация: он платит больше и заказывает крупнее.
// Сорвал срок — репутация падает. Новых соседей становится больше, когда растёт магазин.

import type { TextKey } from '../i18n/ru';
import { PRODUCTS, sellableProducts, warehouseOf, onShelves, type ProductId, type StoreState } from './economy';

export type NeighborId = 'school' | 'dorm' | 'kindergarten' | 'hospital' | 'office';

export interface Neighbor {
  id: NeighborId;
  nameKey: TextKey;
  icon: string;
  /** Портрет (assets/portrait_<portrait>.png). */
  portrait: string;
  /** С какого уровня помещения сосед начинает заказывать. */
  level: number;
  /** Что заказывает (берутся те, что продаются в магазине). */
  likes: ProductId[];
}

export const NEIGHBORS: Record<NeighborId, Neighbor> = {
  school: { id: 'school', nameKey: 'neighbor.school', icon: '🏫', portrait: 'school', level: 0, likes: ['milk', 'apples', 'buns', 'juice', 'bread', 'pies'] },
  dorm: { id: 'dorm', nameKey: 'neighbor.dorm', icon: '🏢', portrait: 'commandant', level: 0, likes: ['dumplings', 'potatoes', 'bread', 'soap', 'detergent', 'water'] },
  kindergarten: { id: 'kindergarten', nameKey: 'neighbor.kindergarten', icon: '🧸', portrait: 'nanny', level: 1, likes: ['milk', 'bread', 'apples', 'tangerines', 'juice', 'icecream'] },
  hospital: { id: 'hospital', nameKey: 'neighbor.hospital', icon: '🏥', portrait: 'nurse', level: 2, likes: ['water', 'juice', 'apples', 'soap', 'milk', 'fish'] },
  office: { id: 'office', nameKey: 'neighbor.office', icon: '💼', portrait: 'clerk', level: 3, likes: ['water', 'juice', 'pies', 'buns', 'honeycake', 'flowers'] },
};

export const NEIGHBOR_IDS = Object.keys(NEIGHBORS) as NeighborId[];

/** С какого дня приходят заявки, сколько их может быть сразу и шанс новой каждое утро. */
export const NEIGHBORS_FROM_DAY = 8;
export const MAX_ORDERS = 2;
export const ORDER_CHANCE = 0.4;
/** Платят дороже розницы; каждое очко репутации — ещё +5% (до +50%). */
export const NEIGHBOR_MARKUP = 1.35;
export const REP_STEP = 0.05;
export const REP_MAX = 10;

export interface NeighborOrder {
  /** Уникальный номер заявки. */
  id: number;
  from: NeighborId;
  items: { product: ProductId; qty: number }[];
  /** Последний день, когда можно отправить (включительно). */
  due: number;
  pay: number;
}

export interface NeighborsState {
  rep: Partial<Record<NeighborId, number>>;
  orders: NeighborOrder[];
  /** Номер следующей заявки. */
  next: number;
  /** Что сорвалось сегодня утром (просрочено) — показать игроку. */
  expired?: NeighborId[];
}

export const neighborsOf = (state: StoreState): NeighborsState => state.neighbors ?? { rep: {}, orders: [], next: 1 };

export const repOf = (state: StoreState, id: NeighborId): number => neighborsOf(state).rep[id] ?? 0;

/** Кто из соседей уже заказывает (по уровню помещения). */
export const activeNeighbors = (state: StoreState): NeighborId[] => NEIGHBOR_IDS.filter((id) => NEIGHBORS[id].level <= state.level);

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Сколько заплатят за заявку: розница с наценкой и надбавкой за репутацию. */
export const orderPay = (state: StoreState, from: NeighborId, items: NeighborOrder['items']): number =>
  Math.round(
    items.reduce((sum, { product, qty }) => sum + state.prices[product] * qty, 0) * NEIGHBOR_MARKUP * (1 + REP_STEP * Math.min(REP_MAX, repOf(state, from))),
  );

/** Новая заявка: 2–3 товара из любимых у соседа, срок 2–4 дня; с репутацией — крупнее. */
export function makeOrder(state: StoreState, from: NeighborId, random: () => number): NeighborOrder | null {
  const sellable = sellableProducts(state);
  const pool = NEIGHBORS[from].likes.filter((id) => sellable.includes(id));
  if (pool.length === 0) return null;
  const count = Math.min(pool.length, 2 + (random() < 0.4 ? 1 : 0));
  const picks = [...pool].sort(() => random() - 0.5).slice(0, count);
  const size = 1 + 0.1 * repOf(state, from) + 0.25 * state.level;
  const items = picks.map((product) => ({ product, qty: Math.round((5 + Math.floor(random() * 6)) * size) }));
  const n = neighborsOf(state);
  return { id: n.next, from, items, due: state.day + 2 + Math.floor(random() * 3), pay: orderPay(state, from, items) };
}

/**
 * Утро: просроченные заявки сгорают (репутация −1), иногда приходит новая — от соседа,
 * у которого сейчас нет открытой заявки.
 */
export function neighborsMorning(state: StoreState, random: () => number): StoreState {
  if (state.day < NEIGHBORS_FROM_DAY) return state;
  const n = neighborsOf(state);
  const expired = n.orders.filter((o) => o.due < state.day);
  const rep = { ...n.rep };
  for (const o of expired) rep[o.from] = Math.max(0, (rep[o.from] ?? 0) - 1);
  let orders = n.orders.filter((o) => o.due >= state.day);
  let next = n.next;
  let s: StoreState = { ...state, neighbors: { ...n, rep, orders, next, expired: expired.map((o) => o.from) } };
  if (orders.length < MAX_ORDERS && random() < ORDER_CHANCE) {
    const free = activeNeighbors(s).filter((id) => !orders.some((o) => o.from === id));
    const from = free.length ? free[Math.floor(random() * free.length)] : null;
    const order = from ? makeOrder(s, from, random) : null;
    if (order) {
      orders = [...orders, order];
      next += 1;
      s = { ...s, neighbors: { ...s.neighbors!, orders, next } };
    }
  }
  return s;
}

/** Хватает ли товара, чтобы отправить заявку. */
export const canSend = (state: StoreState, order: NeighborOrder): boolean => order.items.every(({ product, qty }) => stockOf(state, product) >= qty);

/** Отправить: товар уходит со склада (потом с полок), деньги сразу, репутация +1. */
export function sendOrder(state: StoreState, orderId: number): StoreState | null {
  const n = neighborsOf(state);
  const order = n.orders.find((o) => o.id === orderId);
  if (!order || !canSend(state, order)) return null;
  let s = state;
  for (const { product, qty } of order.items) {
    let need = qty;
    let toTake = Math.min(need, (s.warehouse[product] ?? []).filter((u) => !u.pending).length);
    need -= toTake;
    const warehouse = (s.warehouse[product] ?? []).filter((u) => {
      if (u.pending || toTake === 0) return true;
      toTake--;
      return false;
    });
    const shelves = s.shelves.map((shelf) => {
      if (need === 0) return shelf;
      const units = shelf.items[product] ?? [];
      const take = Math.min(need, units.length);
      need -= take;
      return take ? { ...shelf, items: { ...shelf.items, [product]: units.slice(take) } } : shelf;
    });
    s = { ...s, warehouse: { ...s.warehouse, [product]: warehouse }, shelves };
  }
  const rep = { ...n.rep, [order.from]: Math.min(REP_MAX, (n.rep[order.from] ?? 0) + 1) };
  return {
    ...s,
    money: s.money + order.pay,
    neighbors: { ...n, rep, orders: n.orders.filter((o) => o.id !== orderId) },
  };
}

/** Отказаться от заявки: без штрафа к репутации, просто сосед найдёт другой магазин. */
export function declineOrder(state: StoreState, orderId: number): StoreState {
  const n = neighborsOf(state);
  return { ...state, neighbors: { ...n, orders: n.orders.filter((o) => o.id !== orderId) } };
}

/** Иконки заявки: «🥛×12 🍎×8». */
export const orderText = (order: NeighborOrder): string => order.items.map(({ product, qty }) => `${PRODUCTS[product].icon}×${qty}`).join('  ');
