// Ценовая война: Эдуард через дорогу на несколько дней снижает цену на один товар, и
// покупатели идут за ним к нему. Можно ответить: сравнять цену, дать рекламу или переждать.

import { PRICE_STEP, PRODUCTS, sellableProducts, SEASONAL, type ProductId, type StoreState } from './economy';
import { activeAd, buyAd } from './ads';

/** С какого дня Эдуард начинает войны и как часто. */
export const WAR_FROM_DAY = 12;
export const WAR_CHANCE = 0.1;
export const WAR_DAYS = 3;
/** Эдуард продаёт на 20% дешевле справедливой цены. */
export const WAR_DISCOUNT = 0.8;
/** Пока у нас дороже, этот товар хотят реже; когда сравняли — чуть чаще (у нас ещё и рядом). */
export const WAR_LOSE = 0.4;
export const WAR_WIN = 1.15;
/** С рекламой уходит меньше покупателей. */
export const WAR_AD_KEEP = 0.75;

export type WarAnswer = 'match' | 'ad' | 'wait';

export interface War {
  product: ProductId;
  /** Цена у Эдуарда. */
  price: number;
  /** Последний день войны (включительно). */
  until: number;
  answer?: WarAnswer;
  /** Наша цена до войны — вернём, когда война кончится. */
  oldPrice?: number;
}

export function makeWar(state: StoreState, random: () => number): { product: ProductId; price: number; days: number } | undefined {
  const options = sellableProducts(state).filter((id) => !SEASONAL[id]);
  if (!options.length) return undefined;
  const product = options[Math.floor(random() * options.length)];
  const price = Math.max(PRICE_STEP, Math.round((PRODUCTS[product].basePrice * WAR_DISCOUNT) / PRICE_STEP) * PRICE_STEP);
  return { product, price, days: WAR_DAYS };
}

export const activeWar = (state: StoreState): War | undefined => (state.war && state.day <= state.war.until ? state.war : undefined);

/** Ответ на войну. null — не хватило денег на рекламу. */
export function answerWar(state: StoreState, war: { product: ProductId; price: number; days: number }, answer: WarAnswer): StoreState | null {
  const base: War = { product: war.product, price: war.price, until: state.day + war.days - 1, answer };
  const plan = state.plan && { ...state.plan, decided: true };
  if (answer === 'match') {
    const oldPrice = state.prices[war.product];
    return {
      ...state,
      plan,
      war: { ...base, oldPrice },
      prices: { ...state.prices, [war.product]: Math.min(oldPrice, war.price) },
    };
  }
  if (answer === 'ad' && !activeAd(state)) {
    const bought = buyAd(state, 'banner');
    return bought && { ...bought, plan, war: base };
  }
  return { ...state, plan, war: base };
}

/** Насколько чаще (или реже) хотят этот товар у нас сегодня из-за войны. */
export function warDemand(state: StoreState, id: ProductId): number {
  const war = activeWar(state);
  if (!war || war.product !== id) return 1;
  if (state.prices[id] <= war.price) return WAR_WIN;
  return war.answer === 'ad' ? WAR_AD_KEEP : WAR_LOSE;
}

/** Война кончилась: возвращаем свою прежнюю цену, если её снижали. */
export function endWar(state: StoreState): StoreState {
  const war = state.war;
  if (!war || state.day <= war.until) return state;
  const prices = war.oldPrice !== undefined ? { ...state.prices, [war.product]: war.oldPrice } : state.prices;
  return { ...state, war: undefined, prices };
}
