import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import {
  BRANCH_AWAY_MAX_HOURS,
  BRANCH_MIN_INCOME,
  BRANCH_PRICE,
  BRANCH_SPREAD,
  BRANCH_TRACK_IDS,
  BRANCH_TRACKS,
  branchAway,
  branchGain,
  branchIncome,
  branchLock,
  branchLook,
  branchMaxed,
  branchShare,
  branchSignName,
  branchUsual,
  buyBranch,
  nextBranchTier,
  upgradeBranch,
} from '../src/game/branch';
import { nightCycle } from '../src/game/day';
import { weekReport } from '../src/game/reports';
import { rng } from '../src/game/random';

// Филиал в здании «Гиганта» (branch.ts): когда можно купить, сколько приносит, улучшения,
// ночь и отчёт, «пока тебя не было» и старые сохранения.

const LAST = STORE_LEVELS.length - 1;
const won = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 100,
  level: LAST,
  money: 100000,
  debt: 0,
  rating: 4.5,
  history: Array(7).fill(6000),
  giant: { phase: 'won', since: 90, revenue: 0, target: 0 },
  ...over,
});
const owned = (over: Partial<StoreState> = {}): StoreState => buyBranch(won(over))!;

describe('филиал: покупка', () => {
  it('пока «Гигант» не побеждён или магазин не универмаг — закрыто, и почему', () => {
    expect(branchLock(newGame())).toBe('giant');
    expect(branchLock(won({ giant: { phase: 'lost', since: 90, revenue: 0, target: 0 } }))).toBe('giant');
    expect(branchLock(won({ level: LAST - 1 }))).toBe('level');
    expect(branchLock(won())).toBeNull();
    expect(buyBranch(won({ level: LAST - 1 }))).toBeNull();
  });

  it('покупка: деньги списаны, второй раз не купить; без денег или с долгом — нельзя', () => {
    const s = owned();
    expect(s.money).toBe(100000 - BRANCH_PRICE);
    expect(s.branch?.since).toBe(100);
    expect(buyBranch(s)).toBeNull();
    expect(buyBranch(won({ money: BRANCH_PRICE - 1 }))).toBeNull();
    expect(buyBranch(won({ debt: 100 }))).toBeNull();
  });

  it('на вывеске — своё название с «№2», иначе запасное', () => {
    expect(branchSignName(won(), 'Магазинчик')).toBe('Магазинчик №2');
    expect(branchSignName(won({ shopName: ' У Сони ' }), 'Магазинчик')).toBe('У Сони №2');
    expect(branchLook(won())).toBe('');
    expect(branchLook(owned())).not.toBe('');
  });
});

describe('филиал: улучшения', () => {
  it('каждая ступень дороже предыдущей и прибавляет доход; после последней — всё', () => {
    let s = owned({ money: 1e6 });
    for (const id of BRANCH_TRACK_IDS) {
      const tiers = BRANCH_TRACKS[id].tiers;
      for (let i = 0; i < tiers.length; i++) {
        if (i) expect(tiers[i].price).toBeGreaterThan(tiers[i - 1].price);
        const before = branchUsual(s);
        const gain = branchGain(s, id);
        const money = s.money;
        s = upgradeBranch(s, id)!;
        expect(s.money).toBe(money - tiers[i].price);
        expect(branchUsual(s) - before).toBeCloseTo(gain, -1);
      }
      expect(nextBranchTier(s, id)).toBeNull();
      expect(upgradeBranch(s, id)).toBeNull();
    }
    expect(branchMaxed(s)).toBe(true);
  });

  it('всего вложений — 20–40 тысяч; первые ступени окупаются за 15–20 дней, последние — дольше, но не больше 40', () => {
    const total = BRANCH_TRACK_IDS.reduce((sum, id) => sum + BRANCH_TRACKS[id].tiers.reduce((a, t) => a + t.price, 0), 0);
    expect(total).toBeGreaterThanOrEqual(20000);
    expect(total).toBeLessThanOrEqual(40000);
    // Окупаемость — у игрока с выручкой около 10 000 в день (универмаг после победы над «Гигантом»).
    const ref = 10000;
    for (const id of BRANCH_TRACK_IDS) {
      const days = BRANCH_TRACKS[id].tiers.map((t) => t.price / (t.share * ref));
      expect(days[0]).toBeGreaterThanOrEqual(15);
      expect(days[0]).toBeLessThanOrEqual(20);
      expect(days[days.length - 1]).toBeGreaterThan(days[0]);
      expect(days[days.length - 1]).toBeLessThanOrEqual(40);
    }
  });

  it('без филиала улучшать нечего', () => {
    expect(upgradeBranch(won(), 'shelves')).toBeNull();
    expect(branchShare(won())).toBe(0);
  });
});

describe('филиал: доход', () => {
  it('никогда не в минус и не больше выручки своего магазина, даже со всеми улучшениями', () => {
    let s = owned({ money: 1e6 });
    for (const id of BRANCH_TRACK_IDS) while (nextBranchTier(s, id)) s = upgradeBranch(s, id)!;
    for (const history of [[], [0, 0, 0], Array(7).fill(6000), Array(7).fill(1e6)]) {
      for (const rating of [0, 2, 5]) {
        const t = { ...s, history, rating };
        for (let day = 100; day < 160; day++) {
          const n = branchIncome(t, day);
          expect(n).toBeGreaterThanOrEqual(BRANCH_MIN_INCOME);
          expect(Number.isFinite(n)).toBe(true);
        }
      }
    }
    expect(branchShare(s)).toBeLessThan(0.6);
  });

  it('день ото дня немного разный, но тот же день — тот же доход', () => {
    const s = owned();
    const days = Array.from({ length: 30 }, (_, i) => branchIncome(s, 100 + i));
    expect(new Set(days).size).toBeGreaterThan(5);
    expect(branchIncome(s, 105)).toBe(days[5]);
    const usual = branchUsual(s);
    for (const n of days) {
      expect(n).toBeGreaterThan(usual * (1 - BRANCH_SPREAD) * 0.85);
      expect(n).toBeLessThan(usual * (1 + BRANCH_SPREAD) * 1.15);
    }
  });

  it('ночью доход — в кассу, в итоги дня и в строку отчёта недели', () => {
    const s = { ...owned(), reports: [] };
    const night = nightCycle(s, { ...emptyDayStats(), revenue: 0 }, rng(3));
    expect(night.branch).toBe(branchIncome(s, 100));
    expect(night.state.branch?.last).toEqual({ day: 100, income: night.branch });
    expect(night.state.branch?.earned).toBe(night.branch);
    expect(night.state.reports?.at(-1)?.branch).toBe(night.branch);
    expect(weekReport(night.state).branch).toBe(night.branch);
    // Деньги: доход филиала пришёл (остальное за ночь — счета и прочее — от филиала не зависит).
    const without = nightCycle({ ...s, branch: undefined }, { ...emptyDayStats(), revenue: 0 }, rng(3));
    expect(night.state.money - without.state.money).toBe(night.branch);
  });

  it('без филиала ночь как прежде: строки и дохода нет', () => {
    const night = nightCycle({ ...won(), reports: [] }, emptyDayStats(), rng(3));
    expect(night.branch).toBe(0);
    expect(night.state.reports?.at(-1)?.branch).toBeUndefined();
    expect(weekReport(night.state).branch).toBe(0);
  });
});

describe('филиал: пока тебя не было', () => {
  it('меньше часа — ничего; дальше понемногу, не больше чем за 8 часов', () => {
    const s = owned();
    expect(branchAway(s, 30 * 60_000)).toBeNull();
    expect(branchAway(won(), 5 * 3_600_000)).toBeNull();
    const two = branchAway(s, 2 * 3_600_000)!;
    const long = branchAway(s, 48 * 3_600_000)!;
    expect(two.income).toBeGreaterThan(0);
    expect(long.hours).toBe(BRANCH_AWAY_MAX_HOURS);
    expect(long.income).toBe(branchAway(s, BRANCH_AWAY_MAX_HOURS * 3_600_000)!.income);
    // Скромно: за целую ночь без игрока — меньше трети обычного дня.
    expect(long.income).toBeLessThan(branchUsual(s) / 3);
    expect(long.state.money).toBe(s.money + long.income);
    expect(long.state.branch?.earned).toBe(long.income);
  });
});

describe('филиал: сохранения', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => local[k] ?? null,
        setItem: (k: string, v: string) => {
          local[k] = v;
        },
        removeItem: (k: string) => delete local[k],
      },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение без филиала грузится: филиала нет, его можно купить', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = won() as unknown as Record<string, unknown>;
    delete old.branch;
    local['magazinchik.save'] = JSON.stringify({ version: 10, state: old });
    const s = loadGame()!;
    expect(s.branch).toBeUndefined();
    expect(branchLook(s)).toBe('');
    expect(buyBranch(s)?.branch?.since).toBe(100);
  });

  it('филиал с улучшениями переживает сохранение и загрузку', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const s = upgradeBranch(owned(), 'ads')!;
    saveGame({ ...s, branch: { ...s.branch!, last: { day: 101, income: 900 }, earned: 5000 } });
    const back = loadGame()!;
    expect(back.branch).toEqual({ ...s.branch, last: { day: 101, income: 900 }, earned: 5000 });
    expect(branchShare(back)).toBe(branchShare(s));
  });
});
