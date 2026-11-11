import { describe, expect, it } from 'vitest';
import { newGame, type StaffMember, type StoreState } from '../src/game/economy';
import { deedsPerShift, QUIRKS, quirkOf, RECORD_FROM_SHIFTS, tallyNight, WORLD_PER_METER } from '../src/game/staffStats';

// Статистика персонала (staffStats.ts): дела, рекорд смены, метры и привычка.

const cashier: StaffMember = { role: 'cashier', name: 3, skill: 1, wage: 300, months: 0 };
const shop = (staff: StaffMember[] = [cashier], day = 10): StoreState => ({ ...newGame(), day, staff });

describe('статистика персонала: ночь', () => {
  it('дела и метры копятся, смена засчитана', () => {
    const { state, records } = tallyNight(shop(), { cashier: 12 }, { cashier: 2500 });
    const t = state.staff[0].tally!;
    expect(t).toMatchObject({ deeds: 12, shifts: 1, best: 12, bestDay: 10, walked: 2500 / WORLD_PER_METER });
    expect(records).toEqual([]);
    expect(deedsPerShift(t)).toBe(12);
  });

  it('кто ничего не делал — смена не засчитана, состояние то же', () => {
    const s = shop();
    expect(tallyNight(s, {}, {}).state).toBe(s);
  });

  it('рекорд — в итоги только после первых смен и если побит', () => {
    let s = shop();
    for (let i = 0; i < RECORD_FROM_SHIFTS; i++) s = tallyNight({ ...s, day: 10 + i }, { cashier: 10 }).state;
    const same = tallyNight({ ...s, day: 20 }, { cashier: 10 });
    expect(same.records).toEqual([]);
    const beat = tallyNight({ ...s, day: 21 }, { cashier: 15 });
    expect(beat.records).toEqual([{ role: 'cashier', name: 3, friend: undefined, n: 15, kind: 'served' }]);
    expect(beat.state.staff[0].tally).toMatchObject({ best: 15, bestDay: 21, deeds: 10 * RECORD_FROM_SHIFTS + 15 });
  });

  it('привычка постоянная и в пределах списка', () => {
    expect(quirkOf(cashier)).toBe(quirkOf({ ...cashier, skill: 3 }));
    for (let n = 0; n < 16; n++) expect(quirkOf({ ...cashier, name: n })).toBeLessThan(QUIRKS);
  });
});
