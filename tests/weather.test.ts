import { describe, expect, it } from 'vitest';
import { isWet, weatherFor } from '../src/game/weather';
import { seasonFor } from '../src/game/endless';

describe('weather', () => {
  const days = Array.from({ length: 400 }, (_, i) => i + 1);

  it('один и тот же день — одна и та же погода', () => {
    for (const day of days) expect(weatherFor(day)).toBe(weatherFor(day));
  });

  it('грозы бывают, но реже обычного дождя', () => {
    const storms = days.filter((d) => weatherFor(d) === 'storm').length;
    const rains = days.filter((d) => weatherFor(d) === 'rain').length;
    expect(storms).toBeGreaterThan(0);
    expect(storms).toBeLessThan(rains);
  });

  it('в новогодний сезон снег, а не гроза', () => {
    for (const day of days) {
      if (seasonFor(day)?.id === 'newyear') expect(weatherFor(day)).toBe('snow');
    }
  });

  it('мокро и в дождь, и в грозу', () => {
    expect(isWet('rain')).toBe(true);
    expect(isWet('storm')).toBe(true);
    expect(isWet('snow')).toBe(false);
  });
});
