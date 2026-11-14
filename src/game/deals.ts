// «Предложение дня» от поставщиков (11.11, автор: «между „Закупать сам“ и „Закупить нужное“ нет разницы — веса нет»).
// Каждое утро поставщики дают скидку на два-три товара: −20%, −15%, −10%. Видит и берёт её только тот, кто закупает
// руками — кнопкой «Закупить нужное» или «+1 / +5» по товарам. «Закупать сам» скидок не ловит: удобно, но по обычным
// ценам. Какие товары — от дня и зерна магазина (общий генератор симулятора не трогается).

import { restricted, sellableProducts, type ProductId, type StoreState } from './economy';
import { canStock } from './restock';

export const DEAL_CUTS = [0.2, 0.15, 0.1] as const;

/** Скидки дня: товар → доля скидки. Только то, что магазин сейчас продаёт и может поставить на полку. */
export function dealsToday(state: StoreState): Partial<Record<ProductId, number>> {
  // На пиво и сигареты скидок дня не бывает (economy.ts restricted): их не рекламируем.
  const pool = sellableProducts(state).filter((pid) => canStock(state, pid) && !restricted(pid));
  if (pool.length < 2) return {};
  let h = (((state.seed ?? 1) * 2246822519) ^ (state.day * 3266489917)) >>> 0;
  const next = () => {
    h = (h ^ (h << 13)) >>> 0;
    h = (h ^ (h >>> 17)) >>> 0;
    h = (h ^ (h << 5)) >>> 0;
    return h;
  };
  const picks = [...pool];
  const out: Partial<Record<ProductId, number>> = {};
  const n = Math.min(pool.length - 1, DEAL_CUTS.length);
  for (let i = 0; i < n; i++) {
    const k = next() % picks.length;
    out[picks[k]] = DEAL_CUTS[i];
    picks.splice(k, 1);
  }
  return out;
}

/** Цена с учётом скидки дня (для закупки руками). */
export const dealPrice = (state: StoreState, pid: ProductId, price: number): number => {
  const cut = dealsToday(state)[pid] ?? 0;
  return cut ? Math.max(1, Math.round(price * (1 - cut))) : price;
};
