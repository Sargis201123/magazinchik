// Реклама: листовки, баннер на фасаде, блогер. Платишь утром — сегодня (и дальше) больше гостей.
// Цена считается от сегодняшнего потока гостей: реклама слегка окупается, если полки полные,
// и не окупается, если товара нет. Одновременно работает одна реклама.

import type { TextKey } from '../i18n/ru';
import { expectedGuests, type StoreState } from './economy';

export type AdId = 'flyers' | 'banner' | 'blogger';

export interface Ad {
  id: AdId;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
  /** На сколько больше гостей, пока работает. */
  boost: number;
  days: number;
  /** Скидка за длинную рекламу (баннер дешевле в пересчёте на день). */
  discount: number;
}

export const ADS: Record<AdId, Ad> = {
  flyers: { id: 'flyers', icon: '📄', nameKey: 'ads.flyers', descKey: 'ads.flyers.desc', boost: 0.15, days: 1, discount: 1 },
  banner: { id: 'banner', icon: '🪧', nameKey: 'ads.banner', descKey: 'ads.banner.desc', boost: 0.1, days: 3, discount: 0.75 },
  blogger: { id: 'blogger', icon: '📱', nameKey: 'ads.blogger', descKey: 'ads.blogger.desc', boost: 0.35, days: 1, discount: 1 },
};

export const AD_IDS = Object.keys(ADS) as AdId[];

/** Сколько прибыли в среднем приносит один гость — от этого считаем цену рекламы. */
export const PROFIT_PER_GUEST = 18;

/** Какая реклама работает сегодня. */
export function activeAd(state: StoreState): Ad | undefined {
  const ads = state.ads;
  return ads && state.day >= ads.from && state.day <= ads.until ? ADS[ads.id] : undefined;
}

export const adBoost = (state: StoreState): number => 1 + (activeAd(state)?.boost ?? 0);

/** Цена: дополнительные гости за все дни × прибыль с гостя × скидка, округлено до 10. */
export function adPrice(state: StoreState, id: AdId): number {
  const ad = ADS[id];
  const extra = expectedGuests(state.rating, state.level) * ad.boost * ad.days;
  return Math.max(30, Math.round((extra * PROFIT_PER_GUEST * ad.discount) / 10) * 10);
}

export function buyAd(state: StoreState, id: AdId): StoreState | null {
  const price = adPrice(state, id);
  if (activeAd(state) || state.money < price) return null;
  return { ...state, money: state.money - price, ads: { id, from: state.day, until: state.day + ADS[id].days - 1 } };
}
