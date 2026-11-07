import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { restockPlan, restockTarget } from '../src/game/restock';
import { weatherFor } from '../src/game/weather';
import { FORECAST_BONUS_SHARE, forecastBonus, forecastOnOpen, forecastTaken, markForecast, weatherBoosts } from '../src/game/forecast';

const start = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 50000, level: 2, ...patch });
/** Первый день с такой погодой (погода зависит только от номера дня). */
const dayWith = (w: string, from = 10): number => {
  for (let d = from; d < 2000; d++) if (weatherFor(d) === w) return d;
  throw new Error(`нет дня с погодой ${w}`);
};

describe('прогноз погоды: запас под погоду (forecast.ts)', () => {
  it('в дождь называет то, что берут чаще и что сейчас продаётся (в ларьке — хлеб), сильнее — первым; в ясный день — ничего', () => {
    const rain = start({ day: dayWith('rain') });
    const boosts = weatherBoosts(rain);
    expect(boosts.map((b) => b.pid)).toContain('bread');
    expect(boosts.every((b) => b.k >= 1.25)).toBe(true);
    expect([...boosts].sort((a, b) => b.k - a.k)).toEqual(boosts);
    expect(weatherBoosts(start({ day: dayWith('clear') }))).toEqual([]);
  });

  it('«Закупить нужное» берёт по среднему, «Под погоду» — больше того, что погода подняла', () => {
    const s = start({ day: dayWith('rain') });
    // Гостей немного — цель не упирается в место на полках.
    expect(restockTarget(s, 'bread', 6, true)).toBeGreaterThan(restockTarget(s, 'bread', 6));
    const avg = restockPlan(s, () => 10, 20).lines.find((l) => l.pid === 'bread')?.qty ?? 0;
    const sky = restockPlan(s, () => 10, 20, [], undefined, true).lines.find((l) => l.pid === 'bread')?.qty ?? 0;
    expect(sky).toBeGreaterThan(avg);
    // В ясный день разницы нет.
    const clear = start({ day: dayWith('clear') });
    expect(restockTarget(clear, 'bread', 6, true)).toBe(restockTarget(clear, 'bread', 6));
  });

  it('бонус вечером — только если взял запас под погоду: доля выручки с погодных товаров', () => {
    const s = start({ day: dayWith('rain') });
    const stats = { sold: { bread: 10, milk: 5, apples: 50 } };
    expect(forecastBonus(s, stats)).toBe(0);
    const taken = markForecast(s);
    expect(forecastTaken(taken)).toBe(true);
    // Считается только погодное, что продаётся (хлеб); яблоки дождь не поднимает.
    const revenue = weatherBoosts(s).reduce((sum, b) => sum + (stats.sold[b.pid as 'bread'] ?? 0) * s.prices[b.pid], 0);
    expect(revenue).toBeGreaterThan(0);
    expect(forecastBonus(taken, stats)).toBe(Math.round(revenue * FORECAST_BONUS_SHARE));
    // Вчерашняя отметка не считается.
    expect(forecastBonus({ ...taken, day: taken.day + 1 }, stats)).toBe(0);
  });

  it('запас уже лежит к открытию — засчитан и без кнопки; не хватает — нет', () => {
    const s = start({ day: dayWith('rain') });
    expect(forecastTaken(forecastOnOpen(s, 60))).toBe(false);
    const full = { ...s, warehouse: { ...s.warehouse, bread: Array.from({ length: 400 }, () => ({ age: 0 })), milk: Array.from({ length: 400 }, () => ({ age: 0 })), dumplings: Array.from({ length: 400 }, () => ({ age: 0 })) } } as unknown as StoreState;
    expect(forecastTaken(forecastOnOpen(full, 60))).toBe(true);
  });
});
