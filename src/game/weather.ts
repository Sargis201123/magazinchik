// Погода дня: дождь и гроза, снег в новогодний сезон, листопад в сезон урожая, жара летом.
// Погода меняет спрос: в дождь берут хлеб и молоко «к чаю», в жару — мороженое, в снег — мясо
// и картошку. Как и всё случайное, зависит только от номера дня — прогноз на завтра честный.

import type { ProductId } from './economy';
import { seasonFor } from './endless';
import { yearTime } from './calendar';
import { rng } from './random';

export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'leaves' | 'heat';

/** Доля дождливых дней вне праздников. */
export const RAIN_CHANCE = 0.18;
/** Какая часть дождливых дней — с грозой. */
export const STORM_SHARE = 0.4;
/** Летом такая доля ясных дней — жаркие. */
export const HEAT_SHARE = 0.4;

/** Дождь или гроза: мокро, зонты, лужи. */
export const isWet = (weather: Weather): boolean => weather === 'rain' || weather === 'storm';

export function weatherFor(day: number): Weather {
  const season = seasonFor(day)?.id;
  if (season === 'newyear') return 'snow';
  const random = rng(day * 7919 + 3);
  if (season === 'harvest') return random() < 0.3 ? 'rain' : 'leaves';
  if (random() >= RAIN_CHANCE) return yearTime(day) === 'summer' && rng(day * 104729 + 5)() < HEAT_SHARE ? 'heat' : 'clear';
  return random() < STORM_SHARE ? 'storm' : 'rain';
}

export interface WeatherEffect {
  icon: string;
  /** Множитель потока гостей: в грозу сидят дома. */
  guests: number;
  /** Каких товаров хотят чаще или реже (вес при выборе корзины). */
  demand: Partial<Record<ProductId, number>>;
  /** Как часто берут кофе. */
  coffee: number;
}

export const WEATHER_EFFECTS: Record<Weather, WeatherEffect> = {
  clear: { icon: '☀️', guests: 1, demand: {}, coffee: 1 },
  rain: { icon: '🌧', guests: 0.9, demand: { bread: 1.4, milk: 1.4, flowers: 0.6, icecream: 0.5, dumplings: 1.3 }, coffee: 1.7 },
  storm: { icon: '⛈', guests: 0.8, demand: { bread: 1.5, milk: 1.5, flowers: 0.4, icecream: 0.3, dumplings: 1.4 }, coffee: 2 },
  snow: { icon: '❄️', guests: 0.95, demand: { meat: 1.5, potatoes: 1.4, tangerines: 1.4, icecream: 0.3, dumplings: 1.5, fish: 1.2 }, coffee: 1.8 },
  leaves: { icon: '🍂', guests: 1, demand: { apples: 1.3, potatoes: 1.2 }, coffee: 1.2 },
  heat: { icon: '🥵', guests: 1.05, demand: { icecream: 2.5, milk: 1.3, meat: 0.6, bread: 0.8, water: 2.2, juice: 1.6, dumplings: 0.6 }, coffee: 0.5 },
};

export const weatherDemand = (weather: Weather, id: ProductId): number => WEATHER_EFFECTS[weather].demand[id] ?? 1;
