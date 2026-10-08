// Погода дня — для атмосферы: дождь и гроза, снег в новогодний сезон, листопад в сезон урожая.
// На экономику не влияет. Как и всё случайное, зависит только от номера дня.

import { seasonFor } from './endless';
import { rng } from './random';

export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'leaves';

/** Доля дождливых дней вне праздников. */
export const RAIN_CHANCE = 0.18;
/** Какая часть дождливых дней — с грозой. */
export const STORM_SHARE = 0.4;

/** Дождь или гроза: мокро, зонты, лужи. */
export const isWet = (weather: Weather): boolean => weather === 'rain' || weather === 'storm';

export function weatherFor(day: number): Weather {
  const season = seasonFor(day)?.id;
  if (season === 'newyear') return 'snow';
  const random = rng(day * 7919 + 3);
  if (season === 'harvest') return random() < 0.3 ? 'rain' : 'leaves';
  if (random() >= RAIN_CHANCE) return 'clear';
  return random() < STORM_SHARE ? 'storm' : 'rain';
}
