// Кот магазина. Рыжий бродяга давно спит у входа — его можно оставить, назвать и кормить.
// Сытый кот приносит удачу: покупатели терпеливее в очереди и оставляют чаевые «за котика».
// (Не «больше гостей»: если касса не успевает, лишние гости уходят злыми — это вредит.)
// Лежанки — для красоты и ещё капельки удачи. Не кормить три дня — кот уйдёт гулять.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export const CAT_FROM_DAY = 5;
/** Отказались — кот спросит снова через неделю. */
export const CAT_ASK_AGAIN = 7;
export const FEED_COST = 10;
/** Столько дней без еды — и кот уходит гулять. */
export const CAT_AWAY_DAYS = 3;
/** Удача без лежанки, когда кот сыт. */
export const CAT_BASE_LUCK = 0.07;
/** Чаевые «за котика». */
export const CAT_TIP = 8;
export const CAT_NAME_MAX = 14;

export type CatBedId = 'basket' | 'pillow' | 'house';

export const CAT_BEDS: Record<CatBedId, { id: CatBedId; nameKey: TextKey; price: number; luck: number; texture: string }> = {
  basket: { id: 'basket', nameKey: 'cat.bed.basket', price: 150, luck: 0.09, texture: 'cat_basket' },
  pillow: { id: 'pillow', nameKey: 'cat.bed.pillow', price: 400, luck: 0.11, texture: 'cat_pillow' },
  house: { id: 'house', nameKey: 'cat.bed.house', price: 1000, luck: 0.13, texture: 'cat_house' },
};

export const CAT_BED_IDS = Object.keys(CAT_BEDS) as CatBedId[];

export interface ShopCat {
  name: string;
  /** С какого дня живёт при магазине. */
  since: number;
  /** Когда кормили последний раз. */
  fedDay: number;
  beds: CatBedId[];
  bed?: CatBedId;
}

export const catOffer = (state: StoreState): boolean => !state.cat && state.day >= CAT_FROM_DAY && (state.catAsk ?? 0) <= state.day;

export function adoptCat(state: StoreState, name: string): StoreState {
  const clean = name.trim().slice(0, CAT_NAME_MAX) || '…';
  return { ...state, cat: { name: clean, since: state.day, fedDay: state.day, beds: [] } };
}

export const declineCat = (state: StoreState): StoreState => ({ ...state, catAsk: state.day + CAT_ASK_AGAIN });

export const fedToday = (state: StoreState): boolean => state.cat?.fedDay === state.day;
/** Кот ушёл гулять: давно не кормили. */
export const catAway = (state: StoreState): boolean => Boolean(state.cat && state.day - state.cat.fedDay >= CAT_AWAY_DAYS);
/** Кот сегодня при магазине (свой и не ушёл). */
export const catHome = (state: StoreState): boolean => Boolean(state.cat) && !catAway(state);

export function feedCat(state: StoreState): StoreState | null {
  if (!state.cat || fedToday(state) || state.money < FEED_COST) return null;
  return { ...state, money: state.money - FEED_COST, cat: { ...state.cat, fedDay: state.day } };
}

/** Удача кота (0 — нет): сытый сегодня — полная, вчера — половина. */
export function catLuck(state: StoreState): number {
  const cat = state.cat;
  if (!cat || catAway(state)) return 0;
  const luck = cat.bed ? CAT_BEDS[cat.bed].luck : CAT_BASE_LUCK;
  return fedToday(state) ? luck : luck / 2;
}

/** Во сколько раз дольше покупатели ждут в очереди, пока кот рядом. */
export const catPatience = (state: StoreState): number => 1 + 2 * catLuck(state);
/** Шанс, что покупатель оставит чаевые «за котика». */
export const catTipChance = (state: StoreState): number => 2.5 * catLuck(state);

export function buyBed(state: StoreState, id: CatBedId): StoreState | null {
  const cat = state.cat;
  if (!cat || cat.beds.includes(id) || state.money < CAT_BEDS[id].price) return null;
  return { ...state, money: state.money - CAT_BEDS[id].price, cat: { ...cat, beds: [...cat.beds, id], bed: id } };
}

export function setBed(state: StoreState, id: CatBedId | undefined): StoreState | null {
  const cat = state.cat;
  if (!cat || (id && !cat.beds.includes(id))) return null;
  return { ...state, cat: { ...cat, bed: id } };
}

export function renameCat(state: StoreState, name: string): StoreState | null {
  const clean = name.trim().slice(0, CAT_NAME_MAX);
  if (!state.cat || !clean) return null;
  return { ...state, cat: { ...state.cat, name: clean } };
}
