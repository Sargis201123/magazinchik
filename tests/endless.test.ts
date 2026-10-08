import { describe, expect, it } from 'vitest';
import { emptyDayStats, endDay, MONTH_DAYS, newGame, recordSale, type StoreState } from '../src/game/economy';
import {
  ALBUM_REWARD,
  collectRareGuest,
  perceivedBase,
  pickRareGuest,
  pickWanted,
  QUESTS_FROM_DAY,
  questDone,
  questsFor,
  rankName,
  rankOf,
  rankThreshold,
  RARE_GUESTS,
  rewardQuests,
  seasonFor,
  SEASON_EVERY,
  type Quest,
} from '../src/game/endless';
import { rng } from '../src/game/random';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 10,
  shelves: [
    { kind: 'bakery', level: 0, items: {} },
    { kind: 'produce', level: 0, items: {} },
    { kind: 'meat', level: 0, items: {} },
  ],
  ...patch,
});

describe('сезоны', () => {
  it('праздник — каждый четвёртый месяц, по кругу', () => {
    const firstDay = (month: number) => (month - 1) * MONTH_DAYS + 1;
    expect(seasonFor(firstDay(1))).toBeNull();
    expect(seasonFor(firstDay(SEASON_EVERY))?.id).toBe('newyear');
    expect(seasonFor(firstDay(SEASON_EVERY * 2))?.id).toBe('bbq');
    expect(seasonFor(firstDay(SEASON_EVERY * 5))?.id).toBe('newyear');
  });

  it('в сезон шашлыков мясо берут чаще', () => {
    const count = (day: number) => {
      const random = rng(5);
      const state = shop({ day });
      let meat = 0;
      for (let i = 0; i < 2000; i++) if (pickWanted(state, random, 1)[0] === 'meat') meat++;
      return meat;
    };
    const bbqDay = (SEASON_EVERY * 2 - 1) * MONTH_DAYS + 1;
    expect(count(bbqDay)).toBeGreaterThan(count(10) * 1.5);
  });

  it('в корзине нет повторов и только то, что можно продать', () => {
    const random = rng(1);
    for (let i = 0; i < 200; i++) {
      const wanted = pickWanted(shop(), random, 2);
      expect(new Set(wanted).size).toBe(wanted.length);
      expect(wanted.every((id) => id !== 'milk')).toBe(true);
    }
  });

  it('в Новый год к ценам терпимее', () => {
    const newYear = (SEASON_EVERY - 1) * MONTH_DAYS + 1;
    expect(perceivedBase(shop({ day: newYear }), 'bread')).toBeGreaterThan(perceivedBase(shop(), 'bread'));
  });
});

describe('задания дня', () => {
  it('три задания, одинаковые для одного дня; в первые дни заданий нет', () => {
    expect(questsFor(shop(), 30)).toHaveLength(3);
    expect(questsFor(shop(), 30)).toEqual(questsFor(shop(), 30));
    expect(questsFor(shop({ day: QUESTS_FROM_DAY - 1 }), 30)).toEqual([]);
  });

  it('прогресс считается по статистике дня', () => {
    const stats = emptyDayStats();
    const sell: Quest = { kind: 'sell', product: 'bread', target: 2, reward: 50 };
    recordSale(stats, [{ id: 'bread', unit: { age: 0 } }]);
    expect(questDone(sell, stats)).toBe(false);
    recordSale(stats, [{ id: 'bread', unit: { age: 0 } }]);
    expect(questDone(sell, stats)).toBe(true);

    const calm: Quest = { kind: 'noComplaints', target: 0, reward: 50 };
    expect(questDone(calm, { ...stats, served: 2 })).toBe(false);
    expect(questDone(calm, { ...stats, served: 6 })).toBe(true);
    expect(questDone(calm, { ...stats, served: 6, complaints: 1 })).toBe(false);
  });

  it('награда за выполненные, бонус к рейтингу — только за все три', () => {
    const quests: Quest[] = [
      { kind: 'serve', target: 5, reward: 40 },
      { kind: 'catchThief', target: 1, reward: 60 },
      { kind: 'cleanTrash', target: 2, reward: 40 },
    ];
    const state = shop({ money: 0, rating: 3 });
    const some = rewardQuests(state, quests, { ...emptyDayStats(), served: 6 });
    expect(some.earned).toBe(40);
    expect(some.state.rating).toBe(3);
    const all = rewardQuests(state, quests, { ...emptyDayStats(), served: 6, caught: 1, trashCleaned: 3 });
    expect(all.earned).toBe(140);
    expect(all.state.rating).toBeGreaterThan(3);
  });
});

describe('альбом редких гостей', () => {
  it('новый гость попадает в альбом один раз, полный альбом — награда', () => {
    let state = shop({ money: 0 });
    for (const [i, g] of RARE_GUESTS.entries()) {
      const r = collectRareGuest(state, g.id);
      expect(r.isNew).toBe(true);
      expect(r.completed).toBe(i === RARE_GUESTS.length - 1);
      state = r.state;
    }
    expect(state.money).toBe(ALBUM_REWARD.money);
    const again = collectRareGuest(state, RARE_GUESTS[0].id);
    expect(again.isNew).toBe(false);
    expect(again.state.money).toBe(ALBUM_REWARD.money);
  });

  it('чаще заходят те, кого ещё нет в альбоме', () => {
    const state = shop({ album: RARE_GUESTS.slice(1).map((g) => g.id) });
    const random = rng(3);
    let missing = 0;
    for (let i = 0; i < 1000; i++) if (pickRareGuest(state, random).id === RARE_GUESTS[0].id) missing++;
    expect(missing).toBeGreaterThan(600);
  });
});

describe('звание магазина', () => {
  it('растёт с общей выручкой и не кончается', () => {
    expect(rankOf(0)).toBe(0);
    expect(rankOf(rankThreshold(1))).toBe(1);
    expect(rankOf(rankThreshold(1) - 1)).toBe(0);
    for (let n = 1; n < 12; n++) expect(rankThreshold(n + 1)).toBeGreaterThan(rankThreshold(n));
    const t = (key: string) => key;
    expect(rankName(7, t)).toBe('rank.6 II');
    expect(rankName(9, t)).toBe('rank.6 IV');
  });

  it('выручка дня копится в общей выручке и в истории для графика', () => {
    const state = shop({ totalRevenue: 100, history: [10, 20] });
    const { state: next } = endDay(state, { ...emptyDayStats(), revenue: 250 }, rng(1));
    expect(next.totalRevenue).toBe(350);
    expect(next.history).toEqual([10, 20, 250]);
    const long = shop({ history: Array.from({ length: 14 }, (_, i) => i) });
    expect(endDay(long, { ...emptyDayStats(), revenue: 99 }, rng(1)).state.history).toHaveLength(14);
  });
});
