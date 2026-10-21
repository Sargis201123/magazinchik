import { describe, expect, it } from 'vitest';
import { hire, newGame, wageFor } from '../src/game/economy';
import { friendCandidates, friendsAtWork } from '../src/game/staff';

const friends = [{ id: 1, name: 'Аня' }, { id: 2, name: 'Боря' }];

describe('друзья на работе', () => {
  it('друг — опытнее и дешевле, под своим именем', () => {
    const [c] = friendCandidates(newGame(), 'cashier', friends);
    expect(c.skill).toBe(2);
    expect(c.wage).toBeLessThan(wageFor('cashier', 2, 'hardworker'));
    expect(c.friend?.name).toBe('Аня');
  });

  it('нанятый друг второй раз не предлагается', () => {
    const s = hire({ ...newGame(), level: 2 }, friendCandidates(newGame(), 'cashier', friends)[0])!;
    expect(friendsAtWork(s).map((m) => m.friend!.id)).toEqual([1]);
    expect(friendCandidates(s, 'cleaner', friends).map((c) => c.friend!.id)).toEqual([2]);
  });
});
