// Прогноз погоды как решение утра (docs/PLAN.md «Дальше», п. 2; решено автором 07.11). Погода и раньше меняла
// спрос (weather.ts), но «Закупить нужное» само докупало под неё — игроку прогноз был ни к чему. Теперь:
// «Закупить нужное» берёт по среднему, без погоды; что погода сегодня поднимает, видно утром у закупки и вечером
// в итогах («Прогноз на завтра»), и одной кнопкой можно взять запас под погоду. Кто взял — вечером бонус:
// доля выручки с товаров, которые погода подняла («Угадал с погодой»). Прогноз честный: погода зависит только
// от номера дня.

import { PRODUCTS, sellableProducts, type DayStats, type ProductId, type StoreState } from './economy';
import { restockTarget } from './restock';
import { stockOf } from './bakery';
import { WEATHER_EFFECTS, weatherDemand, weatherFor, type Weather } from './weather';

/** С какого множителя спроса товар считается «погодным» — его показываем и под него докупаем. */
export const WEATHER_BOOST_MIN = 1.25;
/** Сколько погодных товаров называть строкой (самые сильные). */
export const WEATHER_BOOST_SHOWN = 3;
/** Бонус «Угадал с погодой»: доля выручки за день с погодных товаров. */
export const FORECAST_BONUS_SHARE = 0.15;

export interface Boost {
  pid: ProductId;
  /** Во сколько раз чаще берут. */
  k: number;
}

/** Что погода дня поднимает в цене спроса — из того, что сейчас продаётся; сильнее — первым. */
export function weatherBoosts(state: StoreState, day = state.day): Boost[] {
  const weather = weatherFor(day);
  return sellableProducts(state)
    .map((pid) => ({ pid, k: weatherDemand(weather, pid) }))
    .filter((b) => b.k >= WEATHER_BOOST_MIN)
    .sort((a, b) => b.k - a.k);
}

/** Строка товаров для прогноза: «🍦 ×2,5 · 💧 ×2,2 · 🧃 ×1,6». */
export function boostList(boosts: Boost[], fmt: (k: number) => string): string {
  return boosts
    .slice(0, WEATHER_BOOST_SHOWN)
    .map((b) => `${PRODUCTS[b.pid].icon} ×${fmt(b.k)}`)
    .join(' · ');
}

export const weatherOf = (day: number): { weather: Weather; icon: string } => {
  const weather = weatherFor(day);
  return { weather, icon: WEATHER_EFFECTS[weather].icon };
};

/** Игрок взял запас под погоду сегодня (кнопка у закупки). */
export const markForecast = (state: StoreState): StoreState => ({ ...state, forecast: { day: state.day } });

/** Запас под погоду сегодня взят. */
export const forecastTaken = (state: StoreState): boolean => state.forecast?.day === state.day;

/** Бонус вечером: взял запас под погоду — доля выручки с погодных товаров за день (0 — не брал или нечего). */
export function forecastBonus(state: StoreState, stats: Pick<DayStats, 'sold'>): number {
  if (!forecastTaken(state)) return 0;
  const revenue = weatherBoosts(state).reduce((sum, b) => sum + (stats.sold[b.pid] ?? 0) * state.prices[b.pid], 0);
  return Math.round(revenue * FORECAST_BONUS_SHARE);
}

/** Запаса погодных товаров хватает с поправкой на погоду (не меньше 90 % цели): докупать нечего. */
export function stockedForWeather(state: StoreState, guests: number): boolean {
  const boosts = weatherBoosts(state);
  return boosts.length > 0 && boosts.every((b) => stockOf(state, b.pid) >= Math.floor(restockTarget(state, b.pid, guests, true) * 0.9));
}

/** При открытии магазина: запас под погоду уже лежит (докупил вручную или осталось со вчера) — тоже засчитан. */
export const forecastOnOpen = (state: StoreState, guests: number): StoreState =>
  !forecastTaken(state) && stockedForWeather(state, guests) ? markForecast(state) : state;
