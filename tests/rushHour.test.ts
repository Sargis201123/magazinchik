import { describe, expect, it } from 'vitest';
import { questReward } from '../src/game/endless';
import { RUSH_MIN_SERVED, rushBonus, rushOutcome } from '../src/game/rushHour';

describe('час пик без потерь', () => {
  it('никто не ушёл из очереди и обслужили достаточно — премия', () => {
    expect(rushOutcome(RUSH_MIN_SERVED, 0, 2)).toEqual({ kind: 'clean', bonus: rushBonus(2) });
  });

  it('кто-то ушёл, не дождавшись, — премии нет, сколько бы ни обслужили', () => {
    expect(rushOutcome(30, 1, 4)).toEqual({ kind: 'lost', lost: 1 });
  });

  it('пустой час пик — не заслуга: ни премии, ни упрёка', () => {
    expect(rushOutcome(RUSH_MIN_SERVED - 1, 0, 3)).toEqual({ kind: 'quiet' });
  });

  it('премия — половина задания дня, кратна пяти и не меньше пяти монет', () => {
    for (let level = 0; level <= 5; level++) {
      const bonus = rushBonus(level);
      expect(bonus % 5).toBe(0);
      expect(bonus).toBeGreaterThanOrEqual(5);
      expect(bonus).toBeLessThanOrEqual(questReward(level));
    }
    expect(rushBonus(5)).toBeGreaterThan(rushBonus(0));
  });
});
