import { describe, expect, it } from 'vitest';
import { holidayFor, yearTime, YEAR_MONTHS } from '../src/game/calendar';
import { MONTH_DAYS } from '../src/game/economy';
import { seasonFor } from '../src/game/endless';

const days = Array.from({ length: YEAR_MONTHS * MONTH_DAYS * 2 }, (_, i) => i + 1);

describe('calendar', () => {
  it('новогодняя неделя — зима и праздник «Новый год»', () => {
    for (const day of days) {
      if (seasonFor(day)?.id === 'newyear') {
        expect(yearTime(day)).toBe('winter');
        expect(holidayFor(day)).toBe('newyear');
      }
    }
  });

  it('шашлыки летом, урожай осенью', () => {
    for (const day of days) {
      if (seasonFor(day)?.id === 'bbq') expect(yearTime(day)).toBe('summer');
      if (seasonFor(day)?.id === 'harvest') expect(yearTime(day)).toBe('autumn');
    }
  });

  it('за год бывают все времена года и все праздники, 8 Марта — весной', () => {
    const year = days.slice(0, YEAR_MONTHS * MONTH_DAYS);
    expect(new Set(year.map(yearTime))).toEqual(new Set(['spring', 'summer', 'autumn', 'winter']));
    expect(new Set(year.map(holidayFor).filter(Boolean))).toEqual(new Set(['march8', 'halloween', 'newyear']));
    for (const day of year) if (holidayFor(day) === 'march8') expect(yearTime(day)).toBe('spring');
  });
});
