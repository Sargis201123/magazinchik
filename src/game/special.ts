// Особые покупатели с выбором. Иногда днём заходит необычный гость, над ним «!» — нажми,
// и реши, как поступить:
// - бизнесмен хочет сразу много одного товара, но просит скидку 20% (деньги сразу, товар уходит);
// - бабушка просит хлеба, а денег нет: дать в долг — рейтинг растёт, часто она возвращает с
//   пирожками (иногда — с деньгами); отказать — соседи осудят;
// - ребёнку не хватает мелочи на яблоко или шоколадку: отпустить за сколько есть — рейтинг чуть выше.

import { onShelves, PRODUCTS, sellableProducts, warehouseOf, type ProductId, type StoreState } from './economy';

export type SpecialKind = 'business' | 'granny' | 'kid';

export interface SpecialVisit {
  kind: SpecialKind;
  product: ProductId;
  qty: number;
  /** Сколько гость заплатит, если согласиться. */
  pay: number;
}

/** С какого дня заходят особые гости и с каким шансом за день. */
export const SPECIAL_FROM_DAY = 5;
export const SPECIAL_CHANCE = 0.55;
export const BUSINESS_DISCOUNT = 0.8;
export const KIND_RATING = 0.05;
export const REFUSE_RATING = 0.03;
export const KID_RATING = 0.02;

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Какой гость зайдёт сегодня (или никто). */
export function makeSpecial(state: StoreState, random: () => number): SpecialVisit | null {
  if (state.day < SPECIAL_FROM_DAY || random() >= SPECIAL_CHANCE) return null;
  const sellable = sellableProducts(state);
  const roll = random();
  if (roll < 0.4) {
    // Бизнесмен: товар, которого много.
    const options = sellable.filter((id) => stockOf(state, id) >= 8);
    if (!options.length) return null;
    const product = options[Math.floor(random() * options.length)];
    const qty = Math.min(stockOf(state, product), 6 + Math.floor(random() * 5));
    return { kind: 'business', product, qty, pay: Math.round(state.prices[product] * qty * BUSINESS_DISCOUNT) };
  }
  if (roll < 0.75) {
    const product: ProductId = sellable.includes('bread') ? 'bread' : sellable.includes('milk') ? 'milk' : sellable[0];
    if (!product || stockOf(state, product) < 1) return null;
    return { kind: 'granny', product, qty: 1, pay: 0 };
  }
  const product = (['apples', 'juice', 'bread'] as ProductId[]).find((id) => sellable.includes(id) && stockOf(state, id) > 0);
  if (!product) return null;
  return { kind: 'kid', product, qty: 1, pay: Math.max(1, Math.floor(state.prices[product] / 2)) };
}

/** Забрать штуки: сначала с полок (гость берёт в зале), потом со склада. */
function take(state: StoreState, id: ProductId, n: number): StoreState {
  let left = n;
  const shelves = state.shelves.map((s) => {
    const units = s.items[id] ?? [];
    const k = Math.min(left, units.length);
    left -= k;
    return k ? { ...s, items: { ...s.items, [id]: units.slice(k) } } : s;
  });
  const fromWarehouse = Math.min(left, warehouseOf(state, id));
  return { ...state, shelves, warehouse: { ...state.warehouse, [id]: (state.warehouse[id] ?? []).slice(fromWarehouse) } };
}

export interface SpecialResult {
  state: StoreState;
  /** Сколько денег пришло сейчас и как изменился рейтинг. */
  money: number;
  rating: number;
}

/** Ответ игрока. Согласиться можно, только если товар ещё есть. */
export function answerSpecial(state: StoreState, visit: SpecialVisit, accept: boolean): SpecialResult {
  const clampRating = (r: number) => Math.round(Math.min(5, Math.max(0, r)) * 100) / 100;
  if (!accept) {
    const drop = visit.kind === 'granny' ? REFUSE_RATING : 0;
    return { state: { ...state, rating: clampRating(state.rating - drop) }, money: 0, rating: -drop };
  }
  if (stockOf(state, visit.product) < visit.qty) return { state, money: 0, rating: 0 };
  let s = take(state, visit.product, visit.qty);
  const up = visit.kind === 'granny' ? KIND_RATING : visit.kind === 'kid' ? KID_RATING : 0;
  s = { ...s, money: s.money + visit.pay, rating: clampRating(s.rating + up) };
  // Бабушка запоминает доброту: потом вернётся и отдаст вдвое (grannyRepays).
  if (visit.kind === 'granny') s = { ...s, grannyOwed: (s.grannyOwed ?? 0) + PRODUCTS[visit.product].basePrice };
  return { state: s, money: visit.pay, rating: up };
}

/** Бабушка возвращается и отдаёт долг с лихвой (вдвое). */
export function grannyRepays(state: StoreState): { state: StoreState; paid: number } {
  const owed = state.grannyOwed ?? 0;
  if (!owed) return { state, paid: 0 };
  return { state: { ...state, money: state.money + owed * 2, grannyOwed: 0 }, paid: owed * 2 };
}
