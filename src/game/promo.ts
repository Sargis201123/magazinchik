// Акция дня: один товар со скидкой 20% или «2 по цене 1». Покупатели идут на акцию,
// товар разлетается, но маржа меньше. Ставится утром на один день.

import { promoKind, type ProductId, type StoreState } from './economy';

export type PromoKind = 'discount' | 'bogo';

/** Насколько чаще хотят товар по акции и насколько больше гостей приходит (видят ценник). */
export const PROMO_DEMAND: Record<PromoKind, number> = { discount: 1.8, bogo: 2.2 };
export const PROMO_GUESTS: Record<PromoKind, number> = { discount: 1.04, bogo: 1.06 };

export const activePromo = (state: StoreState) => (state.promo?.day === state.day ? state.promo : undefined);

export const promoDemand = (state: StoreState, id: ProductId): number => {
  const kind = promoKind(state, id);
  return kind ? PROMO_DEMAND[kind] : 1;
};

export const promoGuests = (state: StoreState): number => {
  const promo = activePromo(state);
  return promo ? PROMO_GUESTS[promo.kind] : 1;
};

/** Поставить акцию (одна на день); та же самая ещё раз — отменить. */
export function setPromo(state: StoreState, product: ProductId, kind: PromoKind): StoreState {
  const promo = activePromo(state);
  if (promo && promo.product === product && promo.kind === kind) return { ...state, promo: undefined };
  return { ...state, promo: { day: state.day, product, kind } };
}
