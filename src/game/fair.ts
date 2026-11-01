// Ярмарка: раз в месяц, на пятый день, у входа праздник — гирлянды из флажков, шарики, лоток.
// Лоток сам продаёт товар со склада с наценкой — мимо кассы, а в зале к ценам терпимее.
// Лишних гостей нет: раньше было «+30% гостей», но касса и полки не успевали, лишние гости
// уходили злыми, и ярмарочный день выходил хуже обычного (это видно в симуляторе).

import { MONTH_DAYS, PRODUCT_IDS, PRODUCTS, type ProductId, type StoreState } from './economy';
import { holidayFor } from './calendar';
import { zarFairDay } from './zarechye';

export const FAIR_DAY_IN_MONTH = 5;
export const FAIR_FROM_DAY = 8;
export const FAIR_GUESTS = 1;
export const FAIR_TOLERANCE = 1.1;
/** Лоток: продаёт штуку со склада раз в столько секунд, с наценкой, не больше стольких за день. */
export const STALL_EVERY_SECONDS = 5;
export const STALL_MARKUP = 1.25;
export const STALL_MAX = 18;

export const isFairDay = (day: number): boolean =>
  day >= FAIR_FROM_DAY && ((day - 1) % MONTH_DAYS) + 1 === FAIR_DAY_IN_MONTH && !holidayFor(day);

export const fairGuests = (day: number): number => (isFairDay(day) ? FAIR_GUESTS : 1);

/** Ярмарка в этом магазине сегодня: обычная раз в месяц или речная в Заречье по выходным (zarechye.ts). */
export const fairToday = (state: StoreState): boolean => isFairDay(state.day) || zarFairDay(state);
/** Терпимость к ценам в ярмарочный день этого магазина. */
export const fairTodayTolerance = (state: StoreState): number => (fairToday(state) ? FAIR_TOLERANCE : 1);
export const fairTolerance = (day: number): number => (isFairDay(day) ? FAIR_TOLERANCE : 1);

/** Ближайшая ярмарка (через сколько дней), чтобы подготовиться. */
export function daysToFair(day: number): number {
  for (let d = 0; d < MONTH_DAYS * 2; d++) if (isFairDay(day + d)) return d;
  return -1;
}

/**
 * Цена на лотке: ярмарочная наценка к цене на ценнике, но не дороже обычной цены товара с наценкой —
 * лоток продаёт мимо кассы, никто не торгуется, и задранный ценник не должен печатать деньги.
 */
export const stallPrice = (state: StoreState, id: ProductId): number =>
  Math.round(Math.min(state.prices[id], PRODUCTS[id].basePrice) * STALL_MARKUP);

/** Лоток продал штуку со склада (самую старую) с ярмарочной наценкой. null — склад пуст. */
export function stallSale(state: StoreState, random: () => number): { state: StoreState; id: ProductId; price: number } | null {
  const options = PRODUCT_IDS.filter((id) => (state.warehouse[id] ?? []).some((u) => !u.pending));
  if (!options.length) return null;
  const id = options[Math.floor(random() * options.length)];
  const units = state.warehouse[id]!;
  const index = units.findIndex((u) => !u.pending);
  const price = stallPrice(state, id);
  return {
    state: { ...state, money: state.money + price, warehouse: { ...state.warehouse, [id]: units.filter((_, i) => i !== index) } },
    id,
    price,
  };
}
