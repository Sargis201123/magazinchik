import { describe, expect, it } from 'vitest';
import { BIG_DAY_FROM, BIG_DAY_GAP, BIG_DAYS, bigDayDemand, bigDayFor, bigDayGuests, quakeBreak } from '../src/game/bigday';
import { yearTime } from '../src/game/calendar';
import { guestsToday, spawnIntervalToday } from '../src/game/day';
import { newGame } from '../src/game/economy';

const DAYS = Array.from({ length: 800 }, (_, i) => i + 1);

describe('особые дни', () => {
  it('не бывает до BIG_DAY_FROM и чаще раза в BIG_DAY_GAP дней', () => {
    const big = DAYS.filter((d) => bigDayFor(d));
    expect(big.every((d) => d >= BIG_DAY_FROM)).toBe(true);
    for (let i = 1; i < big.length; i++) expect(big[i] - big[i - 1]).toBeGreaterThanOrEqual(BIG_DAY_GAP);
  });

  it('бывают все и в своё время года', () => {
    const seen = new Set(DAYS.map(bigDayFor).filter(Boolean));
    expect(seen.size).toBe(Object.keys(BIG_DAYS).length);
    for (const d of DAYS) {
      const id = bigDayFor(d);
      if (id === 'heatwave' || id === 'carnival') expect(yearTime(d)).toBe('summer');
      if (id === 'flood' || id === 'quake' || id === 'parade') expect(['spring', 'autumn']).toContain(yearTime(d));
      if (id === 'frost') expect(['winter', 'autumn']).toContain(yearTime(d));
    }
  });

  it('не слишком часто: примерно каждый пятнадцатый–двадцатый день', () => {
    const share = DAYS.filter((d) => bigDayFor(d)).length / DAYS.length;
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.1);
  });

  it('утренний прогноз гостей не выдаёт особый день, а поток гостей — меняется', () => {
    const disaster = DAYS.find((d) => bigDayFor(d) === 'heatwave')!;
    const crowd = DAYS.find((d) => bigDayFor(d) === 'parade')!;
    const base = { ...newGame(), rating: 3 };
    for (const day of [disaster, crowd]) {
      const s = { ...base, day };
      const normal = { ...base, day: day + 1 };
      expect(bigDayFor(day + 1) ?? null).not.toBe(bigDayFor(day));
      // Прогноз — как в обычный день (тот же расчёт без особого дня).
      expect(guestsToday(s) / guestsToday(normal)).toBeCloseTo(1, 0);
      expect(bigDayGuests(day)).toBe(BIG_DAYS[bigDayFor(day)!].guests);
    }
    expect(spawnIntervalToday({ ...base, day: disaster })).toBeGreaterThan(spawnIntervalToday({ ...base, day: disaster - 1 }) * 1.5);
    expect(spawnIntervalToday({ ...base, day: crowd })).toBeLessThan(spawnIntervalToday({ ...base, day: crowd - 1 }) / 1.5);
  });

  it('спрос: в жару — вода и мороженое', () => {
    const heat = DAYS.find((d) => bigDayFor(d) === 'heatwave')!;
    expect(bigDayDemand(heat, 'water')).toBeGreaterThan(2);
    expect(bigDayDemand(heat, 'meat')).toBeLessThan(1);
    expect(bigDayDemand(heat - 1, 'water')).toBe(1);
  });

  it('землетрясение роняет часть товара с полок', () => {
    const s = newGame();
    const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
    const state = { ...s, shelves: s.shelves.map((sh, i) => ({ ...sh, items: i === 0 ? { bread: units(20) } : {} })) };
    let k = 0;
    const random = () => ((k++ % 4) === 0 ? 0 : 0.9);
    const { state: after, broken } = quakeBreak(state, random, 0.12);
    expect(broken).toBe(5);
    expect(after.shelves[0].items.bread?.length).toBe(15);
  });
});
