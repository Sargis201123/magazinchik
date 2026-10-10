import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame } from '../src/game/economy';
import { updateRecords } from '../src/game/records';
import { restartGame } from '../src/game/restart';

describe('личные рекорды', () => {
  it('первый день задаёт рекорды молча, дальше — побитые выручка, покупатели и серия', () => {
    const day1 = updateRecords({ ...newGame(), money: 500 }, { ...emptyDayStats(), revenue: 800, served: 20, bestCombo: 4 }, 1);
    expect(day1.broken).toEqual([]);
    expect(day1.state.records?.revenue).toEqual({ n: 800, day: 1 });
    const day2 = updateRecords({ ...day1.state, money: 900 }, { ...emptyDayStats(), revenue: 1200, served: 15, bestCombo: 6 }, 2);
    expect(day2.broken).toEqual(['revenue', 'combo']);
    expect(day2.state.records?.served).toEqual({ n: 20, day: 1 });
    // Деньги и дни растут почти каждый день — рекорд обновляется, но не объявляется.
    expect(day2.state.records?.money).toEqual({ n: 900, day: 2 });
    expect(day2.state.records?.days).toEqual({ n: 2 });
  });

  it('переживают новую игру', () => {
    const played = updateRecords({ ...newGame(), money: 500 }, { ...emptyDayStats(), revenue: 800 }, 30).state;
    expect(restartGame(played).records).toEqual(played.records);
  });
});
