import { describe, expect, it } from 'vitest';
import { ATTENTION_CAP, attentionTotal, CALLS_MAX, planAttention, thin } from '../src/game/attention';
import { momentsFor } from '../src/game/moments';
import { liveEventsFor } from '../src/game/minievents';
import { makeSpecial } from '../src/game/special';
import { deliveryDay, nextCallIn } from '../src/game/delivery';
import { DAY_SECONDS, newGame, type StoreState } from '../src/game/economy';
import { rng } from '../src/game/simulate';

// Бюджет внимания дня: моменты, мини-события, особый гость и звонки делят пять просьб «нажми».

describe('бюджет внимания', () => {
  it('всё хотят сразу — не больше пяти, и каждому виду что-то досталось', () => {
    const plan = planAttention({ moments: 3, live: 2, special: true, calls: 2 });
    expect(attentionTotal(plan)).toBe(ATTENTION_CAP);
    expect(plan.special).toBe(true);
    expect(plan.calls).toBeGreaterThan(0);
    expect(plan.moments).toBeGreaterThan(0);
    expect(plan.live).toBeGreaterThan(0);
  });

  it('хотят меньше бюджета — ничего не отнимают', () => {
    expect(planAttention({ moments: 2, live: 1, special: false, calls: 0 })).toEqual({ moments: 2, live: 1, special: false, calls: 0 });
  });

  it('звонков не больше CALLS_MAX; нулевой бюджет — тишина', () => {
    expect(planAttention({ moments: 0, live: 0, special: false, calls: 9 }).calls).toBe(CALLS_MAX);
    expect(attentionTotal(planAttention({ moments: 3, live: 2, special: true, calls: 2 }, 0))).toBe(0);
  });

  it('thin оставляет равномерно по дню и не меняет порядок', () => {
    expect(thin([1, 2, 3], 2)).toEqual([1, 3]);
    expect(thin([1, 2, 3], 1)).toEqual([2]);
    expect(thin([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(thin([1, 2, 3], 0)).toEqual([]);
  });

  it('середина игры: раньше просьба каждые ~10 секунд, теперь не больше пяти за день', () => {
    const fresh = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
    const mid: StoreState = { ...newGame(), day: 20, level: 2, upgrades: ['delivery'], warehouse: { bread: fresh(30), apples: fresh(30), milk: fresh(30), potatoes: fresh(30) } };
    let before = 0;
    let after = 0;
    const days = 200;
    for (let seed = 1; seed <= days; seed++) {
      const r = rng(seed);
      const moments = momentsFor(mid, r).length;
      const live = liveEventsFor(mid, r).kinds.length;
      const special = Boolean(makeSpecial(mid, r));
      // Звонки — как в игре: сколько позвонит за день по расписанию.
      let calls = 0;
      for (let t = nextCallIn(mid, r); t < DAY_SECONDS - 18; t += nextCallIn(mid, r)) calls++;
      // Прежнее расписание звонков: раз в 16–30 секунд.
      let oldCalls = 0;
      for (let t = 16 + r() * 14; t < DAY_SECONDS - 18; t += 16 + r() * 14) oldCalls++;
      before += moments + live + (special ? 1 : 0) + oldCalls;
      const plan = planAttention({ moments, live, special, calls: CALLS_MAX });
      after += plan.moments + plan.live + (plan.special ? 1 : 0) + Math.min(plan.calls, calls);
      expect(attentionTotal(plan)).toBeLessThanOrEqual(ATTENTION_CAP);
    }
    expect(before / days).toBeGreaterThan(7);
    expect(after / days).toBeLessThanOrEqual(ATTENTION_CAP);
    expect(deliveryDay(mid, rng(1)).delivered + deliveryDay(mid, rng(1)).missed).toBeLessThanOrEqual(CALLS_MAX);
  });
});
