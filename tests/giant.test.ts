import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { CHAPTERS } from '../src/game/story';
import {
  GIANT_BATTLE_DAYS,
  GIANT_BUILD_DAYS,
  GIANT_FAME,
  GIANT_FROM_DAY,
  GIANT_PULL,
  GIANT_REMATCH_DAYS,
  giantGuests,
  giantLook,
  giantNews,
  giantNight,
  giantPull,
  seeGiantNews,
} from '../src/game/giant';

const free = (day: number, extra: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day,
  rating: 4.2,
  history: [1000, 1000, 1000, 1000, 1000, 1000, 1000],
  story: { chapter: CHAPTERS.length, introSeen: true, ordersDone: 0, inspectionsPassed: 0 },
  ...extra,
});

/** Прожить n ночей с одинаковой выручкой. */
function nights(s: StoreState, n: number, revenue: number): StoreState {
  for (let i = 0; i < n; i++) s = giantNight({ ...s, day: s.day + 1 }, revenue);
  return s;
}

describe('гипермаркет «Гигант»', () => {
  it('появляется только после сюжета и с нужного дня', () => {
    expect(giantNight({ ...newGame(), day: GIANT_FROM_DAY + 5 }, 0).giant).toBeUndefined();
    expect(giantNight(free(GIANT_FROM_DAY - 1), 0).giant).toBeUndefined();
    const s = giantNight(free(GIANT_FROM_DAY), 0);
    expect(s.giant?.phase).toBe('build');
    expect(giantLook(s)).toBe('site');
    expect(giantNews(s)).toBe('build');
    expect(giantNews(seeGiantNews(s))).toBeNull();
  });

  it('стройка → битва с целью; в битву часть гостей уходит, защита помогает', () => {
    let s = giantNight(free(GIANT_FROM_DAY), 0);
    s = nights(s, GIANT_BUILD_DAYS, 1000);
    expect(s.giant?.phase).toBe('battle');
    expect(s.giant?.target).toBeGreaterThan(0);
    expect(giantPull(s)).toBeCloseTo(GIANT_PULL);
    expect(giantGuests(s)).toBeCloseTo(1 - GIANT_PULL);
    const defended = { ...s, rating: 4.6, upgrades: ['loyalty', 'oven'] } as StoreState;
    expect(giantPull(defended)).toBeLessThan(giantPull(s));
  });

  it('победа: выручка и рейтинг — «Гигант» закрывается, награда и слава', () => {
    let s = nights(giantNight(free(GIANT_FROM_DAY), 0), GIANT_BUILD_DAYS, 1000);
    const money = s.money;
    s = nights(s, GIANT_BATTLE_DAYS, 2000);
    expect(s.giant?.phase).toBe('won');
    expect(s.money).toBeGreaterThan(money);
    expect(giantGuests(s)).toBe(GIANT_FAME);
    expect(giantLook(s)).toBe('closed');
  });

  it('поражение: остаётся и уводит гостей, через месяц — реванш', () => {
    let s = nights(giantNight(free(GIANT_FROM_DAY), 0), GIANT_BUILD_DAYS, 1000);
    s = nights(s, GIANT_BATTLE_DAYS, 100);
    expect(s.giant?.phase).toBe('lost');
    expect(giantPull(s)).toBeGreaterThan(0);
    s = nights(s, GIANT_REMATCH_DAYS, 100);
    expect(s.giant?.phase).toBe('battle');
    expect(s.giant?.revenue).toBe(0);
  });
});
