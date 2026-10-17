import { describe, expect, it } from 'vitest';
import { monthInYear, newGame, productAvailable, seasonalDemand, sellableProducts, MONTH_DAYS } from '../src/game/economy';
import { holidayFor, yearTime, YEAR_MONTHS } from '../src/game/calendar';
import { pickWanted } from '../src/game/endless';

const year = Array.from({ length: YEAR_MONTHS * MONTH_DAYS }, (_, i) => i + 1);

describe('seasonal goods', () => {
  it('мороженое круглый год (летом охотнее), цветы только весной, мандарины к Новому году', () => {
    for (const day of year) {
      expect(productAvailable('icecream', day)).toBe(true);
      if (productAvailable('flowers', day)) expect(yearTime(day)).toBe('spring');
      if (holidayFor(day) === 'newyear') expect(productAvailable('tangerines', day)).toBe(true);
      expect(productAvailable('bread', day)).toBe(true);
    }
    const summer = year.find((d) => yearTime(d) === 'summer')!;
    const newyear = year.find((d) => holidayFor(d) === 'newyear')!;
    const autumn = year.find((d) => yearTime(d) === 'autumn')!;
    expect(seasonalDemand('icecream', summer)).toBeGreaterThan(seasonalDemand('icecream', autumn));
    expect(seasonalDemand('icecream', newyear)).toBeLessThan(seasonalDemand('icecream', autumn));
  });

  it('на 8 Марта цветы берут в разы чаще', () => {
    const march8 = year.find((d) => holidayFor(d) === 'march8')!;
    const spring = year.find((d) => yearTime(d) === 'spring' && holidayFor(d) !== 'march8')!;
    expect(seasonalDemand('flowers', march8)).toBeGreaterThan(seasonalDemand('flowers', spring));
    expect(monthInYear(march8)).toBe(4);
  });

  it('вне сезона товар нельзя продать и его не хотят', () => {
    const spring = year.find((d) => productAvailable('flowers', d))!;
    const off = year.find((d) => !productAvailable('flowers', d))!;
    const s = newGame();
    expect(sellableProducts({ ...s, day: spring })).toContain('flowers');
    expect(sellableProducts({ ...s, day: off })).not.toContain('flowers');
    for (let i = 0; i < 50; i++) expect(pickWanted({ ...s, day: off }, Math.random, 2)).not.toContain('flowers');
  });
});
