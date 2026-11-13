import { newGame } from '../../src/game/economy';
import { crisisStarts, CRISIS_CHANCE } from '../../src/game/crisis';
import { bigDayFor, setBigDaySeed } from '../../src/game/bigday';

for (const seed of [1, 2, 3, 12345, 987654]) {
  setBigDaySeed(seed);
  const base = { ...newGame(), level: 2, seed };
  const hits: number[] = [];
  const rolls: number[] = [];
  let big = 0;
  for (let day = 24; day < 400; day++) {
    if (bigDayFor(day)) big++;
    const s = { ...base, day };
    const c = crisisStarts(s);
    if (c) hits.push(day);
  }
  console.log('seed', seed, 'bigdays', big, 'starts', hits.slice(0, 20).join(','), 'chance', CRISIS_CHANCE, rolls.length);
}
