import { describe, expect, it } from 'vitest';
import { monthInYear, newGame, productAvailable, seasonalDemand, sellableProducts, MONTH_DAYS } from '../src/game/economy';
import { holidayFor, yearTime, YEAR_MONTHS } from '../src/game/calendar';
import { pickWanted } from '../src/game/endless';

const year = Array.from({ length: YEAR_MONTHS * MONTH_DAYS }, (_, i) => i + 1);

describe('seasonal goods', () => {
  it('мороженое только летом, цветы только весной, мандарины к Новому году', () => {
    for (const day of year) {
      if (productAvailable('icecream', day)) expect(yearTime(day)).toBe('summer');
      if (productAvailable('flowers', day)) expect(yearTime(day)).toBe('spring');
      if (holidayFor(day) === 'newyear') expect(productAvailable('tangerines', day)).toBe(true);
      expect(productAvailable('bread', day)).toBe(true);
    }
    expect(year.some((d) => productAvailable('icecream', d))).toBe(true);
    expect(year.some((d) => !productAvailable('icecream', d))).toBe(true);
  });

  it('на 8 Марта цветы берут в разы чаще', () => {
    const march8 = year.find((d) => holidayFor(d) === 'march8')!;
    const spring = year.find((d) => yearTime(d) === 'spring' && holidayFor(d) !== 'march8')!;
    expect(seasonalDemand('flowers', march8)).toBeGreaterThan(seasonalDemand('flowers', spring));
    expect(monthInYear(march8)).toBe(4);
  });

  it('вне сезона товар нельзя продать и его не хотят', () => {
    const summer = year.find((d) => yearTime(d) === 'summer')!;
    const winterless = year.find((d) => !productAvailable('icecream', d))!;
    const withFridge = { ...newGame(), shelves: [...newGame().shelves, { kind: 'dairy' as const, level: 0, items: {} }] };
    expect(sellableProducts({ ...withFridge, day: summer })).toContain('icecream');
    expect(sellableProducts({ ...withFridge, day: winterless })).not.toContain('icecream');
    for (let i = 0; i < 50; i++) expect(pickWanted({ ...withFridge, day: winterless }, Math.random, 2)).not.toContain('icecream');
  });
});
