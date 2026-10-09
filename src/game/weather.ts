// Погода дня по времени года: осенью дожди, грозы и листопад, зимой снег, весной дожди,
// летом жара и грозы; в новогодний сезон — снег. Больше трёх ясных дней подряд не бывает.
// Погода меняет спрос: в дождь берут хлеб и молоко «к чаю», в жару — мороженое, в снег — мясо
// и картошку. Как и всё случайное, зависит только от номера дня — прогноз на завтра честный.

import type { ProductId } from './economy';
import { seasonFor } from './endless';
import { yearTime } from './calendar';
import { rng } from './random';

export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'leaves' | 'heat';

/** Какая погода бывает в каждое время года: доли дней (остальное — ясно). */
const CLIMATE: Record<string, [Weather, number][]> = {
  autumn: [['rain', 0.2], ['storm', 0.1], ['leaves', 0.2]],
  winter: [['snow', 0.6], ['rain', 0.05]],
  spring: [['rain', 0.22], ['storm', 0.1]],
  summer: [['storm', 0.12], ['rain', 0.08], ['heat', 0.35]],
};
/** Больше стольких ясных дней подряд не бывает: игрок должен видеть разную погоду. */
export const MAX_CLEAR_STREAK = 3;
export const FIRST_STORM_DAY = 6;

/** Дождь или гроза: мокро, зонты, лужи. */
export const isWet = (weather: Weather): boolean => weather === 'rain' || weather === 'storm';

function rawWeather(day: number): Weather {
  const season = seasonFor(day)?.id;
  if (season === 'newyear') return 'snow';
  const random = rng(day * 7919 + 3);
  if (season === 'harvest') return random() < 0.3 ? 'rain' : 'leaves';
  let roll = random();
  for (const [weather, share] of CLIMATE[yearTime(day)]) {
    if (roll < share) return weather;
    roll -= share;
  }
  return 'clear';
}

const memo = new Map<number, Weather>();

export function weatherFor(day: number): Weather {
  const known = memo.get(day);
  if (known) return known;
  // Первые два дня — обучение: ясно. На шестой — первая гроза, чтобы её точно увидели.
  let weather: Weather = day <= 2 ? 'clear' : day === FIRST_STORM_DAY ? 'storm' : rawWeather(day);
  if (weather === 'clear' && day > MAX_CLEAR_STREAK + 2) {
    const streak = Array.from({ length: MAX_CLEAR_STREAK }, (_, k) => weatherFor(day - 1 - k)).every((w) => w === 'clear');
    // Затянулось ясно — самая частая для сезона непогода.
    if (streak) weather = CLIMATE[yearTime(day)][0][0];
  }
  memo.set(day, weather);
  return weather;
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
  rain: { icon: '🌧', guests: 0.95, demand: { bread: 1.4, milk: 1.4, flowers: 0.6, icecream: 0.5, dumplings: 1.3 }, coffee: 1.7 },
  storm: { icon: '⛈', guests: 0.9, demand: { bread: 1.5, milk: 1.5, flowers: 0.4, icecream: 0.3, dumplings: 1.4 }, coffee: 2 },
  snow: { icon: '❄️', guests: 0.95, demand: { meat: 1.5, potatoes: 1.4, tangerines: 1.4, icecream: 0.3, dumplings: 1.5, fish: 1.2 }, coffee: 1.8 },
  leaves: { icon: '🍂', guests: 1, demand: { apples: 1.3, potatoes: 1.2 }, coffee: 1.2 },
  heat: { icon: '🥵', guests: 1.05, demand: { icecream: 2.5, milk: 1.3, meat: 0.6, bread: 0.8, water: 2.2, juice: 1.6, dumplings: 0.6 }, coffee: 0.5 },
};

export const weatherDemand = (weather: Weather, id: ProductId): number => WEATHER_EFFECTS[weather].demand[id] ?? 1;
