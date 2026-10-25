import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { bigDayFor } from '../src/game/bigday';
import { LIVE_FROM_DAY, LIVE_REPEAT, liveEventsFor, type LiveKind } from '../src/game/minievents';
import { rng } from '../src/game/random';

/** Прожить дни подряд: какие мини-события были в каждый. */
function run(from: number, to: number, seed = 7): { day: number; kinds: LiveKind[] }[] {
  const random = rng(seed);
  let s: StoreState = newGame();
  const out: { day: number; kinds: LiveKind[] }[] = [];
  for (let day = from; day <= to; day++) {
    const r = liveEventsFor({ ...s, day }, random);
    s = r.state;
    out.push({ day, kinds: r.kinds });
  }
  return out;
}

describe('мини-события дня', () => {
  it('в дни обучения их нет', () => {
    expect(run(1, LIVE_FROM_DAY - 1).every((d) => !d.kinds.length)).toBe(true);
  });

  it('почти каждый день что-то случается', () => {
    const days = run(LIVE_FROM_DAY, 400);
    const busy = days.filter((d) => d.kinds.length || bigDayFor(d.day)).length / days.length;
    expect(busy).toBeGreaterThan(0.8);
    // Иногда два за день.
    expect(days.some((d) => d.kinds.length === 2)).toBe(true);
  });

  it('по очереди: событие не повторяется, пока не прошли LIVE_REPEAT других', () => {
    const all = run(LIVE_FROM_DAY, 400).flatMap((d) => d.kinds);
    for (let i = 1; i < all.length; i++) expect(all.slice(Math.max(0, i - LIVE_REPEAT), i)).not.toContain(all[i]);
    expect(new Set(all).size).toBe(5);
  });

  it('в большую беду — ни одного, в особый день — не больше одного', () => {
    for (const { day, kinds } of run(LIVE_FROM_DAY, 400)) {
      const big = bigDayFor(day);
      if (big === 'robbery' || big === 'quake' || big === 'blackout') expect(kinds).toEqual([]);
      if (big) expect(kinds.length).toBeLessThanOrEqual(1);
      if (big === 'pigeons') expect(kinds).not.toContain('pigeon');
    }
  });
});
