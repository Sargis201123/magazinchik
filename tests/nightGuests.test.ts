import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  answerNightStory,
  DEBT_DAYS,
  DEBT_UNITS,
  debtProduct,
  NIGHT_GUEST_IDS,
  NIGHT_GUEST_TYPES,
  nightBoostGuests,
  nightMorning,
  nightStory,
  pickNightGuest,
  TAXI_GUESTS,
} from '../src/game/nightGuests';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

const shelfWith = (id: 'dumplings' | 'bread', n: number) => ({ kind: 'freezer', items: { [id]: Array.from({ length: n }, () => ({ age: 0 })) } });
const at = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 30, money: 1000, ...patch });

describe('ночные гости', () => {
  it('у каждого — реплики на обоих языках и список покупок', () => {
    for (const id of NIGHT_GUEST_IDS) {
      expect(NIGHT_GUEST_TYPES[id].wants.length).toBeGreaterThan(0);
      for (let n = 0; n < NIGHT_GUEST_TYPES[id].lines; n++) {
        expect((ru as Record<string, string>)[`nightGuest.${id}.${n}`]).toBeTruthy();
        expect((en as Record<string, string>)[`nightGuest.${id}.${n}`]).toBeTruthy();
      }
    }
    expect(pickNightGuest(() => 0)).toBe('taxi');
    expect(pickNightGuest(() => 0.9999)).toBe('vampire');
  });

  it('студент в долг: вернёт вдвое через три дня (или пропадёт)', () => {
    const s = at({ shelves: [shelfWith('dumplings', 5)] as StoreState['shelves'] });
    expect(debtProduct(s)).toBe('dumplings');
    expect(debtProduct(at({ shelves: [shelfWith('dumplings', 1)] as StoreState['shelves'] }))).toBeNull();
    const owed = answerNightStory(s, 'studentDebt', true).state;
    const amount = s.prices.dumplings * DEBT_UNITS * 2;
    expect(owed.nightGuests?.debt).toEqual({ amount, due: 30 + DEBT_DAYS });
    expect(nightMorning({ ...owed, day: 31 }, () => 0).money).toBe(1000);
    const repaid = nightMorning({ ...owed, day: 30 + DEBT_DAYS }, () => 0);
    expect(repaid.money).toBe(1000 + amount);
    expect(repaid.nightGuests).toMatchObject({ news: 'repaid', newsAmount: amount });
    // Новость — одно утро.
    expect(nightMorning({ ...repaid, day: 34 }, () => 0).nightGuests?.news).toBeUndefined();
    expect(nightMorning({ ...owed, day: 30 + DEBT_DAYS }, () => 0.99).nightGuests).toMatchObject({ news: 'vanished' });
  });

  it('таксист — завтра гостей больше; врач — накупил и +рейтинг; музыкант — чаевые; отказ — ничего', () => {
    const s = at();
    const taxi = answerNightStory(s, 'taxiTea', true).state;
    expect(nightBoostGuests({ ...taxi, day: 31 })).toBe(TAXI_GUESTS);
    expect(nightBoostGuests({ ...taxi, day: 32 })).toBe(1);
    const doctor = answerNightStory(s, 'sleepyDoctor', true, 100);
    expect(doctor.money).toBe(300);
    expect(doctor.state.rating).toBeGreaterThan(s.rating);
    expect(answerNightStory(s, 'busker', true).money).toBeGreaterThan(0);
    expect(answerNightStory(s, 'busker', false)).toEqual({ state: s, money: 0, rating: 0 });
  });

  it('история случается не каждую ночь', () => {
    expect(nightStory(() => 0.99)).toBeNull();
    expect(nightStory(() => 0)).toBe('studentDebt');
  });
});
