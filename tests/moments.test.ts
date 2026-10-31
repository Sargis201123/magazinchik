import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  haggleDiscount,
  MOMENT_KINDS,
  MOMENT_RATING_CAP,
  MOMENT_SPAN,
  MOMENTS_CAP,
  momentCount,
  momentGain,
  momentNow,
  momentRating,
  momentsFor,
  momentTip,
  noteMoment,
  simMoments,
} from '../src/game/moments';
import { payQuests, questsFor, rewardQuests, type Quest } from '../src/game/endless';
import { bigDayFor } from '../src/game/bigday';
import { nightCycle } from '../src/game/day';
import { rng } from '../src/game/random';
import { loadGame, saveGame } from '../src/game/save';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 10, ...patch });
/** Обычный (не особый) день не раньше from. */
const quietDay = (from: number): number => {
  let day = from;
  while (bigDayFor(day)) day++;
  return day;
};

describe('активные моменты: сколько', () => {
  it('в первый день нет, во второй — один, в третий — два', () => {
    expect(momentCount(shop({ day: 1 }))).toBe(0);
    expect(momentCount(shop({ day: 2 }))).toBe(1);
    expect(momentCount(shop({ day: 3 }))).toBe(2);
  });

  it('пока бабушка учит пробивать — ни одного', () => {
    expect(momentCount(shop({ day: 2, tut: { step: 'serve' } }))).toBe(0);
    expect(momentCount(shop({ day: 2, tut: { step: 'restock' } }))).toBe(1);
  });

  it('растёт с днями, но не больше потолка', () => {
    expect(momentCount(shop({ day: quietDay(4) }))).toBe(2);
    expect(momentCount(shop({ day: quietDay(20), level: 3 }))).toBe(3);
    for (let day = 1; day < 200; day++) for (let level = 0; level <= 5; level++) expect(momentCount(shop({ day, level }))).toBeLessThanOrEqual(MOMENTS_CAP);
  });
});

describe('активные моменты: расписание', () => {
  it('внутри дня, по порядку, с паузами и без повторов', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = rng(seed);
      const plan = momentsFor(shop({ day: quietDay(30), level: 4 }), random);
      expect(plan.length).toBe(3);
      expect(new Set(plan.map((m) => m.kind)).size).toBe(plan.length);
      for (const [i, m] of plan.entries()) {
        expect(m.at).toBeGreaterThanOrEqual(MOMENT_SPAN[0] * DAY_SECONDS);
        expect(m.at).toBeLessThanOrEqual(MOMENT_SPAN[1] * DAY_SECONDS);
        if (i) expect(m.at - plan[i - 1].at).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('первый момент новичка — монетка', () => {
    for (let seed = 1; seed <= 10; seed++) expect(momentsFor(shop({ day: 2 }), rng(seed))[0].kind).toBe('coin');
  });

  it('без гостей — замена, которой гости не нужны', () => {
    const empty = { hall: false, queue: false };
    for (const kind of MOMENT_KINDS) expect(['coin', 'tipjar', 'spill']).toContain(momentNow(kind, empty));
    expect(momentNow('wave', { hall: true, queue: false })).toBe('wave');
    expect(momentNow('haggle', { hall: true, queue: true })).toBe('haggle');
  });
});

describe('активные моменты: награда', () => {
  it('чаевые растут с магазином и остаются мелочью', () => {
    expect(momentTip(0)).toBe(5);
    for (let level = 1; level <= 5; level++) expect(momentTip(level)).toBeGreaterThan(momentTip(level - 1));
    expect(momentTip(5)).toBeLessThan(50);
  });

  it('уступить — скидка и искорка; лужа — только искорка', () => {
    expect(momentGain('haggle', 2)).toEqual({ money: -haggleDiscount(2), star: true });
    expect(momentGain('spill', 2)).toEqual({ money: 0, star: true });
    expect(momentGain('coin', 2)).toEqual({ money: momentTip(2), star: false });
  });

  it('учёт: показали, поймали, искорки; рейтинг за день — с потолком', () => {
    const stats = emptyDayStats();
    noteMoment(stats, false);
    noteMoment(stats, true, true);
    noteMoment(stats, true, false);
    expect(stats).toMatchObject({ momentsShown: 3, moments: 2, momentStars: 1 });
    expect(momentRating({ momentStars: 10 })).toBe(MOMENT_RATING_CAP);
    expect(momentRating({})).toBe(0);
  });

  it('вечером искорки прибавляются к рейтингу', () => {
    const state = shop({ day: 2, rating: 3 });
    const base = nightCycle(state, emptyDayStats(), rng(1)).state.rating;
    const sparkled = nightCycle(state, { ...emptyDayStats(), moments: 2, momentStars: 2 }, rng(1)).state.rating;
    expect(sparkled).toBeGreaterThan(base);
  });

  it('модель симулятора: ловит часть, денег — немного', () => {
    const state = shop({ day: quietDay(30), level: 3 });
    const sim = simMoments(state, rng(3), 1);
    expect(sim.caught).toBe(sim.shown);
    expect(simMoments(state, rng(3), 0).caught).toBe(0);
    expect(sim.money).toBeLessThanOrEqual(sim.shown * momentTip(3));
  });
});

describe('задания на сегодня', () => {
  const quest = (patch: Partial<Quest> = {}): Quest => ({ kind: 'serve', target: 5, reward: 30, ...patch });
  const withQuests = (quests: Quest[]): StoreState => shop({ money: 100, plan: { day: 10, decided: false, inspection: false, quests } });

  it('выполненное — награда сразу, второй раз днём и вечером не платим', () => {
    const stats = { ...emptyDayStats(), served: 6 };
    const first = payQuests(withQuests([quest(), quest({ kind: 'cleanTrash', target: 3 })]), stats);
    expect(first.paid).toHaveLength(1);
    expect(first.state.money).toBe(130);
    expect(first.state.plan!.quests[0].paid).toBe(true);
    const again = payQuests(first.state, stats);
    expect(again.paid).toHaveLength(0);
    expect(again.state).toBe(first.state);
    const night = rewardQuests(first.state, first.state.plan!.quests, stats);
    expect(night.state.money).toBe(130);
    expect(night.earned).toBe(30);
    expect(night.done).toBe(1);
  });

  it('«ни одной жалобы» днём не платится — только вечером, по итогам дня', () => {
    const stats = { ...emptyDayStats(), served: 6 };
    const day = payQuests(withQuests([quest({ kind: 'noComplaints', target: 0 })]), stats);
    expect(day.paid).toHaveLength(0);
    const night = rewardQuests(day.state, day.state.plan!.quests, { ...stats, complaints: 1 });
    expect(night.done).toBe(0);
    expect(night.state.money).toBe(100);
  });

  it('оплаченное днём засчитано вечером, даже если день начался заново (перезапуск)', () => {
    const paid = withQuests([quest({ paid: true }), quest({ kind: 'cleanTrash', target: 1 })]);
    const night = rewardQuests(paid, paid.plan!.quests, { ...emptyDayStats(), trashCleaned: 1 });
    expect(night.done).toBe(2);
    expect(night.state.money).toBe(130);
  });

  it('«поймай моменты» — только в дни, когда моментов хватает, и на один меньше их числа', () => {
    let seen = false;
    for (let day = 3; day < 120; day++) {
      const state = shop({ day, level: 2 });
      for (const q of questsFor(state, 30, momentCount(state))) {
        if (q.kind !== 'moments') continue;
        seen = true;
        expect(q.target).toBe(momentCount(state) - 1);
        expect(q.target).toBeGreaterThanOrEqual(1);
      }
    }
    expect(seen).toBe(true);
  });

  it('старое сохранение без отметок «оплачено» грузится и платится вечером как раньше', () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
    const old = withQuests([quest()]);
    saveGame(old);
    const loaded = loadGame()!;
    expect(loaded.plan!.quests[0].paid).toBeUndefined();
    const night = rewardQuests(loaded, loaded.plan!.quests, { ...emptyDayStats(), served: 5 });
    expect(night.state.money).toBe(loaded.money + 30);
  });
});

describe('активные моменты: баланс', () => {
  // Выручка за всё время, а не деньги в кассе: деньги в отдельный день скачут от покупок (расширение днём
  // раньше или позже — ±70% на одном сиде), а выручка показывает, сдвинулась ли сама экономика.
  it('выручка к 100-му дню сдвигается не больше чем на 5% (на тех же сидах)', async () => {
    const { simulate } = await import('../src/game/simulate');
    const { SIM_CATCH } = await import('../src/game/moments');
    let on = 0;
    let off = 0;
    for (let seed = 1; seed <= 8; seed++) {
      on += simulate({ days: 100, seed, momentCatch: SIM_CATCH }).final.totalRevenue;
      off += simulate({ days: 100, seed, momentCatch: 0 }).final.totalRevenue;
    }
    expect(Math.abs(on / off - 1)).toBeLessThan(0.05);
  }, 60_000);
});
