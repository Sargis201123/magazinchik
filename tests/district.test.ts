import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { answerOpening, BUILDINGS, buildingStage, buildingWorks, districtDemand, districtGuest, districtGuests, districtKey, districtNews, districtSite, isMatchDay, opensOn, OPENING_DAYS } from '../src/game/district';
import { guestFactor } from '../src/game/day';
import { yearTime } from '../src/game/calendar';

const at = (day: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day, money: 5000, ...patch });

describe('район растёт', () => {
  it('сначала стройка, потом здание; утром — что строят и сколько ждать', () => {
    expect(buildingStage(at(5), 'school')).toBe('none');
    expect(buildingStage(at(BUILDINGS.school.from), 'school')).toBe('site');
    expect(districtSite(at(BUILDINGS.school.from))).toEqual({ id: 'school', days: BUILDINGS.school.build });
    expect(buildingStage(at(opensOn('school')), 'school')).toBe('open');
    expect(districtKey(at(5))).not.toBe(districtKey(at(opensOn('school'))));
  });

  it('открытое здание приводит гостей и меняет спрос; школа летом на каникулах', () => {
    // Ищем учебный день после открытия школы (не лето).
    let day = opensOn('school');
    while (yearTime(day) === 'summer') day++;
    const s = at(day);
    expect(buildingWorks(s, 'school')).toBe(true);
    expect(districtDemand(s, 'juice')).toBeGreaterThan(1);
    expect(districtGuests(s)).toBeGreaterThan(1);
    let summer = opensOn('school');
    while (yearTime(summer) !== 'summer') summer++;
    expect(buildingWorks(at(summer), 'school')).toBe(false);
  });

  it('матч на стадионе раз в неделю: больше гостей, вода нарасхват', () => {
    let day = opensOn('stadium');
    while (day % 7 !== 4) day++;
    const match = at(day);
    expect(isMatchDay(match)).toBe(true);
    expect(isMatchDay(at(day + 1))).toBe(false);
    expect(districtDemand(match, 'water')).toBeGreaterThan(districtDemand(at(day + 1), 'water'));
    expect(guestFactor(match)).toBeGreaterThan(guestFactor({ ...match, day: day + 1 }) * 1.05);
  });

  it('гость из здания — свой образ и список; без зданий — обычный', () => {
    expect(districtGuest(at(3), () => 0)).toBeNull();
    let day = opensOn('office');
    while (yearTime(day) === 'summer') day++;
    const guest = districtGuest(at(day), () => 0);
    expect(guest?.id).toBe('school');
    expect(BUILDINGS.school.looks).toContain(guest?.look);
  });

  it('открытие: поздравить — деньги, рейтинг и гости вдвое; новость один раз', () => {
    const day = opensOn('office') + 1;
    const s = at(day, { district: { seen: ['school'] } });
    expect(districtNews(s)).toBe('office');
    const gifted = answerOpening(s, 'office', true)!;
    expect(gifted.money).toBe(5000 - BUILDINGS.office.gift);
    expect(gifted.rating).toBeGreaterThan(s.rating);
    expect(districtNews(gifted)).toBeNull();
    expect(answerOpening(gifted, 'office', true)).toBeNull();
    expect(districtGuests(gifted)).toBeGreaterThan(districtGuests(s));
    expect(districtGuests({ ...gifted, day: day + OPENING_DAYS })).toBeCloseTo(districtGuests({ ...s, day: day + OPENING_DAYS }));
    expect(answerOpening({ ...s, money: 10 }, 'office', true)).toBeNull();
    expect(answerOpening(s, 'office', false)!.money).toBe(5000);
  });
});
