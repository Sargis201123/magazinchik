// Кафе «Пончик» по соседству — с летней верандой. Оно закупается у нас: предлагает договор на
// неделю — каждое утро, как только магазин открылся, официант забирает одни и те же товары
// и платит за день. Неделя кончилась —
// кафе приходит договориться снова, и если всё привозили исправно, платит чуть больше.
// Не хватило товара — день не оплачен; два срыва — кафе обижается и уходит на неделю.

import { onShelves, PRODUCTS, SEASONAL, sellableProducts, warehouseOf, type ProductId, type StoreState } from './economy';

/** С какого дня кафе начинает предлагать договор, на сколько дней и сколько срывов терпит. */
export const CAFE_FROM_DAY = 6;
export const CAFE_DAYS = 7;
export const CAFE_MISSES = 2;
/** Кафе платит розничную цену: товар уходит гарантированно, без порчи на полке. */
export const CAFE_PAY = 1;
/** За неделю без срывов — +5% к оплате в следующем договоре (до +25%). */
export const CAFE_LOYALTY_STEP = 0.05;
export const CAFE_LOYALTY_MAX = 0.25;
/** Что кафе берёт охотнее всего. */
const CAFE_LIKES: ProductId[] = ['bread', 'milk', 'apples', 'juice', 'pies', 'buns', 'honeycake', 'potatoes', 'meat'];

export interface CafeTerms {
  items: Partial<Record<ProductId, number>>;
  /** Сколько платит за день. */
  pay: number;
}

export interface CafeState {
  /** Действующий договор: до какого дня (включительно) и сколько раз уже не привезли. */
  deal?: CafeTerms & { until: number; missed: number };
  /** Предложение, ждущее ответа (в этот день). */
  offer?: CafeTerms & { day: number };
  /** Когда кафе придёт с новым предложением. */
  nextDay: number;
  /** Сколько недель подряд всё привозили — надбавка к оплате. */
  streak: number;
}

export const cafeOf = (state: StoreState): CafeState => state.cafe ?? { nextDay: CAFE_FROM_DAY, streak: 0 };

export const cafeLoyalty = (state: StoreState): number => Math.min(CAFE_LOYALTY_MAX, cafeOf(state).streak * CAFE_LOYALTY_STEP);

/** Сколько кафе заплатит за день за такие товары. */
export const cafePay = (state: StoreState, items: Partial<Record<ProductId, number>>): number =>
  Math.round(
    Object.entries(items).reduce((sum, [id, n]) => sum + PRODUCTS[id as ProductId].basePrice * (n ?? 0), 0) * CAFE_PAY * (1 + cafeLoyalty(state)),
  );

/** Новое предложение: 2 товара из тех, что продаются в магазине, по 3–6 штук в день. */
export function makeCafeOffer(state: StoreState, random: () => number): CafeState['offer'] | undefined {
  const sellable = sellableProducts(state).filter((id) => !SEASONAL[id]);
  const liked = CAFE_LIKES.filter((id) => sellable.includes(id));
  const pool = liked.length >= 2 ? liked : sellable;
  if (pool.length === 0) return undefined;
  const picks = [...pool].sort(() => random() - 0.5).slice(0, Math.min(2, pool.length));
  const items = Object.fromEntries(picks.map((id) => [id, 3 + Math.floor(random() * 4)])) as Partial<Record<ProductId, number>>;
  return { items, pay: cafePay(state, items), day: state.day };
}

/** Утро: пора — кафе приходит с предложением. */
export function cafeMorning(state: StoreState, random: () => number): StoreState {
  const cafe = cafeOf(state);
  if (cafe.deal || state.day < cafe.nextDay || cafe.offer?.day === state.day) return state;
  const offer = makeCafeOffer(state, random);
  return offer ? { ...state, cafe: { ...cafe, offer } } : state;
}

/** Ответ на предложение: согласиться — договор на неделю, начиная с сегодняшнего утра. */
export function answerCafe(state: StoreState, accept: boolean): StoreState {
  const cafe = cafeOf(state);
  if (!cafe.offer) return state;
  if (!accept) return { ...state, cafe: { ...cafe, offer: undefined, nextDay: state.day + 3, streak: 0 } };
  const { items, pay } = cafe.offer;
  return { ...state, cafe: { ...cafe, offer: undefined, deal: { items, pay, until: state.day + CAFE_DAYS - 1, missed: 0 } } };
}

/** Хватает ли товара на сегодняшний заказ кафе (склад и полки). */
export const cafeCanDeliver = (state: StoreState): boolean => {
  const deal = cafeOf(state).deal;
  if (!deal) return false;
  return Object.entries(deal.items).every(([id, n]) => warehouseOf(state, id as ProductId) + onShelves(state, id as ProductId) >= (n ?? 0));
};

/** Забрать штуки: сначала со склада, потом с полок (сначала старые). */
function take(state: StoreState, id: ProductId, n: number): StoreState {
  let left = n;
  const fromWarehouse = Math.min(left, warehouseOf(state, id));
  left -= fromWarehouse;
  const warehouse = { ...state.warehouse, [id]: (state.warehouse[id] ?? []).slice(fromWarehouse) };
  const shelves = state.shelves.map((s) => {
    if (left === 0) return s;
    const units = s.items[id] ?? [];
    const k = Math.min(left, units.length);
    left -= k;
    return k ? { ...s, items: { ...s.items, [id]: units.slice(k) } } : s;
  });
  return { ...state, warehouse, shelves };
}

export interface CafeDelivery {
  delivered: boolean;
  pay: number;
  /** Неделя кончилась (договор выполнен) или кафе ушло из-за срывов. */
  ended?: 'done' | 'canceled';
}

/** Магазин открылся: кафе забирает свой заказ и платит; в конце недели — договор кончается. */
export function cafeDeliver(state: StoreState): { state: StoreState; result: CafeDelivery | null } {
  const cafe = cafeOf(state);
  const deal = cafe.deal;
  if (!deal) return { state, result: null };
  let s = state;
  const delivered = cafeCanDeliver(s);
  if (delivered) {
    for (const [id, n] of Object.entries(deal.items)) s = take(s, id as ProductId, n ?? 0);
    s = { ...s, money: s.money + deal.pay };
  }
  const missed = deal.missed + (delivered ? 0 : 1);
  if (missed >= CAFE_MISSES) {
    return { state: { ...s, cafe: { ...cafe, deal: undefined, nextDay: s.day + CAFE_DAYS, streak: 0 } }, result: { delivered, pay: delivered ? deal.pay : 0, ended: 'canceled' } };
  }
  if (s.day >= deal.until) {
    const streak = missed === 0 ? cafe.streak + 1 : 0;
    return { state: { ...s, cafe: { ...cafe, deal: undefined, nextDay: s.day + 1, streak } }, result: { delivered, pay: delivered ? deal.pay : 0, ended: 'done' } };
  }
  return { state: { ...s, cafe: { ...cafe, deal: { ...deal, missed } } }, result: { delivered, pay: delivered ? deal.pay : 0 } };
}

/** Сколько ещё дней по договору (включая сегодня). */
export const cafeDaysLeft = (state: StoreState): number => {
  const deal = cafeOf(state).deal;
  return deal ? Math.max(0, deal.until - state.day + 1) : 0;
};
