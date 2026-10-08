// Кот магазина. Рыжий бродяга давно спит у входа — его можно оставить, назвать и кормить.
// Сытый кот приносит удачу: гостей чуть больше (заходят погладить). Лежанки — для красоты
// и ещё капельки удачи. Не кормить три дня — кот уйдёт гулять, пока не покормишь.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export const CAT_FROM_DAY = 5;
/** Отказались — кот спросит снова через неделю. */
export const CAT_ASK_AGAIN = 7;
export const FEED_COST = 10;
/** Столько дней без еды — и кот уходит гулять. */
export const CAT_AWAY_DAYS = 3;
/** Удача без лежанки: на столько больше гостей, когда кот сыт. */
export const CAT_BASE_LUCK = 0.04;
export const CAT_NAME_MAX = 14;

export type CatBedId = 'basket' | 'pillow' | 'house';

export const CAT_BEDS: Record<CatBedId, { id: CatBedId; nameKey: TextKey; price: number; luck: number; texture: string }> = {
  basket: { id: 'basket', nameKey: 'cat.bed.basket', price: 150, luck: 0.06, texture: 'cat_basket' },
  pillow: { id: 'pillow', nameKey: 'cat.bed.pillow', price: 400, luck: 0.09, texture: 'cat_pillow' },
  house: { id: 'house', nameKey: 'cat.bed.house', price: 1000, luck: 0.12, texture: 'cat_house' },
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

/** Множитель гостей от кота: сытый сегодня — полная удача, вчера — половина. */
export function catLuck(state: StoreState): number {
  const cat = state.cat;
  if (!cat || catAway(state)) return 1;
  const luck = CAT_BASE_LUCK + (cat.bed ? CAT_BEDS[cat.bed].luck - CAT_BASE_LUCK : 0);
  return 1 + (fedToday(state) ? luck : luck / 2);
}

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
