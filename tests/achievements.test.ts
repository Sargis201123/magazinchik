import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, liveProgress, recordDay, unlockAchievements } from '../src/game/achievements';
import { emptyDayStats, newGame } from '../src/game/economy';

describe('achievements', () => {
  it('новая игра — ничего не открыто', () => {
    expect(unlockAchievements(liveProgress(newGame())).unlocked).toEqual([]);
  });

  it('сегодняшние покупатели считаются ещё днём, а в конце дня переходят в счётчик', () => {
    const today = { ...emptyDayStats(), served: 100, bestCombo: 5 };
    const live = unlockAchievements(liveProgress(newGame(), today));
    expect(live.unlocked).toContain('served_100');
    expect(live.unlocked).toContain('combo_5');
    const night = recordDay(newGame(), today);
    expect(night.lifetime.served).toBe(100);
    expect(night.lifetime.bestCombo).toBe(5);
  });

  it('день без жалоб засчитывается только при 10+ покупателях', () => {
    expect(recordDay(newGame(), { ...emptyDayStats(), served: 5 }).lifetime.cleanDays).toBe(0);
    expect(recordDay(newGame(), { ...emptyDayStats(), served: 12 }).lifetime.cleanDays).toBe(1);
  });

  it('открытое не открывается второй раз', () => {
    const s = { ...newGame(), day: 2 };
    const first = unlockAchievements(liveProgress(s));
    expect(first.unlocked).toEqual(['first_day']);
    expect(unlockAchievements(liveProgress(first.state)).unlocked).toEqual([]);
  });

  it('у каждого достижения уникальный id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
