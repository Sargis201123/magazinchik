// Погода дня — для атмосферы: дождь, снег в новогодний сезон, листопад в сезон урожая.
// На экономику не влияет. Как и всё случайное, зависит только от номера дня.

import { seasonFor } from './endless';
import { rng } from './random';

export type Weather = 'clear' | 'rain' | 'snow' | 'leaves';

/** Доля дождливых дней вне праздников. */
export const RAIN_CHANCE = 0.18;

export function weatherFor(day: number): Weather {
  const season = seasonFor(day)?.id;
  if (season === 'newyear') return 'snow';
  const random = rng(day * 7919 + 3);
  if (season === 'harvest') return random() < 0.3 ? 'rain' : 'leaves';
  return random() < RAIN_CHANCE ? 'rain' : 'clear';
}
