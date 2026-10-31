// Район — траты конца игры, которые видно на улице. Когда магазин вырос, деньги копятся, а тратить
// их не на что: можно благоустроить свой квартал. Новые фонари, клумбы, остановка с навесом, сквер с
// лавочками, фонтан у пруда, детская площадка, ярмарка — каждое улучшение остаётся на улице навсегда
// и чуть-чуть помогает магазину: гостей на 1–3% больше, рейтинг повыше, постоянные щедрее на чаевые.
// Последнее и самое дорогое — памятник бабушке на площади (в шутку: «основательнице торговли»).
//
// Открываются по мере роста магазина: первые — с третьего помещения, дорогие — с универмага. Цены от
// 10 000 до 300 000, памятник — миллион: обычный игрок к 150-му дню берёт 7–8 улучшений, а ярмарку и
// памятник — нет; игрок со всеми механиками копит на памятник до ~170-го дня (docs/BALANCE.md «Район»).

import type { StoreState } from './economy';
import type { TextKey } from '../i18n/ru';

export type HoodId = 'lamps' | 'beds' | 'bikes' | 'bus' | 'mural' | 'benches' | 'fir' | 'fountain' | 'playground' | 'facades' | 'fair' | 'statue';

export interface HoodItem {
  icon: string;
  price: number;
  /** С какого помещения можно купить (индекс STORE_LEVELS). */
  level: number;
  /** Прибавка к гостям (0.02 — +2%). */
  guests: number;
  /** Рейтинг — один раз, в день покупки. */
  rating?: number;
  /** Прибавка к чаевым постоянных покупателей (0.1 — на 10% щедрее). */
  tips?: number;
}

/**
 * Улучшения по порядку цены. Гостей всё вместе — +18%, рейтинга — +0,5, чаевых — +25%. Этого
 * хватает, чтобы почувствовать, но вложением район не становится: это гордость, а не доход.
 */
export const HOOD: Record<HoodId, HoodItem> = {
  lamps: { icon: '💡', price: 10000, level: 2, guests: 0.01 },
  beds: { icon: '🌷', price: 15000, level: 2, guests: 0.01, rating: 0.05 },
  bikes: { icon: '🚲', price: 20000, level: 2, guests: 0.01 },
  bus: { icon: '🚏', price: 30000, level: 3, guests: 0.02 },
  mural: { icon: '🎨', price: 40000, level: 3, guests: 0.01, tips: 0.1 },
  benches: { icon: '🪑', price: 55000, level: 3, guests: 0.01, rating: 0.1 },
  fir: { icon: '🎄', price: 75000, level: 3, guests: 0.02 },
  fountain: { icon: '⛲', price: 100000, level: 4, guests: 0.02, rating: 0.05 },
  playground: { icon: '🛝', price: 140000, level: 4, guests: 0.02 },
  facades: { icon: '🏘', price: 190000, level: 4, guests: 0.02, rating: 0.1 },
  fair: { icon: '🎪', price: 300000, level: 4, guests: 0.02, tips: 0.05 },
  statue: { icon: '🗿', price: 1_000_000, level: 4, guests: 0.01, rating: 0.2, tips: 0.1 },
};

export const HOOD_IDS = Object.keys(HOOD) as HoodId[];

/** Памятник бабушке — последним, когда весь остальной район уже готов. */
export const HOOD_FINAL: HoodId = 'statue';

/** Куплено: улучшение → день покупки. */
export type HoodState = Partial<Record<HoodId, number>>;

export const hoodName = (id: HoodId): TextKey => `hood.${id}` as TextKey;
export const hoodDesc = (id: HoodId): TextKey => `hood.${id}.desc` as TextKey;

/** Купленные улучшения (чужие ключи из старых или испорченных сохранений пропускаем). */
export const hoodOwned = (state: StoreState): HoodId[] => HOOD_IDS.filter((id) => typeof state.hood?.[id] === 'number');

export const hasHood = (state: StoreState, id: HoodId): boolean => typeof state.hood?.[id] === 'number';

/** Почему пока нельзя купить: магазин мал или (для памятника) район ещё не готов. */
export type HoodLock = 'level' | 'rest' | null;

export function hoodLock(state: StoreState, id: HoodId): HoodLock {
  if (state.level < HOOD[id].level) return 'level';
  if (id === HOOD_FINAL && HOOD_IDS.some((other) => other !== HOOD_FINAL && !hasHood(state, other))) return 'rest';
  return null;
}

/** Раздел «Район» в «Развитии» виден с третьего помещения. */
export const hoodVisible = (state: StoreState): boolean => state.level >= Math.min(...HOOD_IDS.map((id) => HOOD[id].level));

export function buyHood(state: StoreState, id: HoodId): StoreState | null {
  const item = HOOD[id];
  if (hasHood(state, id) || hoodLock(state, id) || state.debt > 0 || state.money < item.price) return null;
  const rating = item.rating ? Math.round(Math.min(5, state.rating + item.rating) * 100) / 100 : state.rating;
  return { ...state, money: state.money - item.price, rating, hood: { ...state.hood, [id]: state.day } };
}

const sum = (state: StoreState, pick: (item: HoodItem) => number | undefined): number => hoodOwned(state).reduce((s, id) => s + (pick(HOOD[id]) ?? 0), 0);

/** Множитель гостей от благоустройства. */
export const hoodGuests = (state: StoreState): number => 1 + sum(state, (i) => i.guests);

/** Множитель чаевых постоянных покупателей. */
export const hoodTips = (state: StoreState): number => 1 + sum(state, (i) => i.tips);

/** Сколько потрачено на район (для «Развития» и достижений). */
export const hoodSpent = (state: StoreState): number => sum(state, (i) => i.price);

/** Самое дешёвое, что можно купить прямо сейчас (для симулятора и подсказки). */
export function nextHood(state: StoreState): HoodId | null {
  return HOOD_IDS.filter((id) => !hasHood(state, id) && !hoodLock(state, id)).sort((a, b) => HOOD[a].price - HOOD[b].price)[0] ?? null;
}

/** Как район выглядит на улице: ключ для перестройки мира. */
export const hoodLook = (state: StoreState): string => hoodOwned(state).join(',');
