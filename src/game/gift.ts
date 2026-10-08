// Подарок за ежедневный вход: раз в календарный день бабушка присылает гостинец.
// Заходишь подряд — подарок растёт; седьмой день самый щедрый, потом серия начинается заново.
// Пропустил день — серия с начала.

import { buyStock, sellableProducts, warehouseCapacity, warehouseCount, type ProductId, type StoreState } from './economy';

export const GIFT_DAYS = 7;
/** Множитель денег по дню серии. */
export const GIFT_SCALE = [1, 1.5, 2, 2.5, 3, 4, 6];
/** В эти дни серии сверху ещё и товар на склад. */
const GOODS_DAYS = new Set([3, 6]);
const GOODS_QTY = 6;
/** Седьмой день — ещё и к рейтингу. */
export const GIFT_RATING = 0.1;

export interface Gift {
  /** День серии: 1…7. */
  day: number;
  money: number;
  goods?: { id: ProductId; qty: number };
  rating?: number;
}

/** Дата в местном времени игрока: YYYY-MM-DD. */
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const dayBefore = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d - 1));
};

export const giftBase = (state: StoreState): number => 40 + 60 * state.level;

/** Есть ли сегодня подарок; если есть — состояние с подарком и что именно подарили. */
export function claimGift(state: StoreState, today: string, random: () => number): { state: StoreState; gift: Gift } | null {
  const last = state.gift ?? { lastDate: '', streak: 0 };
  if (last.lastDate === today) return null;
  const continues = last.lastDate === dayBefore(today) && last.streak < GIFT_DAYS;
  const day = continues ? last.streak + 1 : 1;
  const gift: Gift = { day, money: Math.round(giftBase(state) * GIFT_SCALE[day - 1]) };
  let next: StoreState = { ...state, money: state.money + gift.money, gift: { lastDate: today, streak: day } };
  if (GOODS_DAYS.has(day)) {
    const options = sellableProducts(next);
    const id = options[Math.floor(random() * options.length)];
    const qty = Math.min(GOODS_QTY, warehouseCapacity(next) - warehouseCount(next));
    const withGoods = id && qty > 0 ? buyStock(next, id, qty, 0) : null;
    if (withGoods) {
      next = withGoods;
      gift.goods = { id, qty };
    }
  }
  if (day === GIFT_DAYS) {
    gift.rating = GIFT_RATING;
    next = { ...next, rating: Math.min(5, next.rating + GIFT_RATING) };
  }
  return { state: next, gift };
}
