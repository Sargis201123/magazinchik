import { afterEach, describe, expect, it, vi } from 'vitest';
import { MONTH_DAYS, newGame, productAvailable, SEASONAL, unitSalePrice, type DayStats, type StoreState } from '../src/game/economy';
import { holidayFor, yearTime, YEAR_MONTHS } from '../src/game/calendar';
import { seasonFor } from '../src/game/endless';
import { isKeepsake } from '../src/game/decor';
import { restartGame } from '../src/game/restart';
import { tomorrowTeaser } from '../src/game/nudge';
import { ensurePlan, guestFactor, nightCycle } from '../src/game/day';
import { simulate } from '../src/game/simulate';
import { ETAGS_EVENING } from '../src/game/upgrades';
import {
  nextWeek,
  normalizeWeeks,
  onlyWeeks,
  SALE_EVENING,
  saleOn,
  startSale,
  stepReward,
  trackOf,
  weekFor,
  weekGoal,
  weekNight,
  weekStart,
  WEEK_IDS,
  WEEK_STEPS,
  WEEKS,
  type WeekId,
} from '../src/game/weeks';

const year = Array.from({ length: YEAR_MONTHS * MONTH_DAYS }, (_, i) => i + 1);
const stats = (over: Partial<DayStats> = {}): DayStats => ({
  revenue: 0,
  served: 0,
  lost: 0,
  complaints: 0,
  spoiled: 0,
  stolen: 0,
  caught: 0,
  skimmed: 0,
  sold: {},
  trashCleaned: 0,
  bestCombo: 0,
  ...over,
});
/** День, который выполняет любую цель шага. */
const bigDay = stats({ served: 999, revenue: 99999, sold: { pumpkins: 99, watermelons: 99, apples: 99, bread: 99, icecream: 99, soap: 99 } });

afterEach(() => onlyWeeks(null));

describe('сезонные недели: календарь', () => {
  it('каждая неделя — раз в год, семь дней подряд, в своё время года', () => {
    const season: Record<WeekId, string> = { sale: 'spring', summer: 'summer', harvest: 'autumn' };
    for (const id of WEEK_IDS) {
      const days = year.filter((d) => weekFor(d)?.id === id);
      expect(days).toHaveLength(MONTH_DAYS);
      expect(days.map((d) => weekFor(d)!.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      for (const d of days) expect(yearTime(d)).toBe(season[id]);
      // И на следующий год — снова.
      expect(weekFor(days[0] + YEAR_MONTHS * MONTH_DAYS)).toEqual({ id, n: 1 });
    }
  });

  it('не совпадает с праздничным месяцем и праздниками игрового года', () => {
    for (const d of year) {
      if (!weekFor(d)) continue;
      expect(seasonFor(d)).toBeNull();
      expect(holidayFor(d)).toBeNull();
    }
  });

  it('товар недели продаётся только в свою неделю (SEASONAL совпадает с WEEKS)', () => {
    for (const id of WEEK_IDS) {
      const product = WEEKS[id].product;
      if (!product) continue;
      expect(SEASONAL[product]).toEqual([WEEKS[id].month]);
      for (const d of year) expect(productAvailable(product, d)).toBe(weekFor(d)?.id === id);
    }
  });

  it('nextWeek и weekStart находят начало недели', () => {
    const start = weekStart('harvest');
    expect(weekFor(start)).toEqual({ id: 'harvest', n: 1 });
    expect(nextWeek(start - 2, 3)).toEqual({ id: 'harvest', in: 2 });
    expect(nextWeek(start, 3)).toBeNull();
  });

  it('вечер распродажи — та же четверть дня, что у электронных ценников (симулятор делит день один раз)', () => {
    expect(SALE_EVENING).toBe(ETAGS_EVENING);
  });
});

describe('сезонные недели: дорожка', () => {
  const at = (id: WeekId, n = 1, extra: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: weekStart(id) + n - 1, ...extra });

  it('за день — один шаг: монеты сразу, второй раз в тот же день — нет', () => {
    const s = at('harvest');
    const goal = weekGoal(s, 30)!;
    expect(goal.step).toBe(1);
    const r = weekNight(s, bigDay, goal);
    expect(r.done?.coins).toBe(stepReward(s.level, 1));
    expect(r.state.money).toBe(s.money + r.done!.coins);
    expect(weekGoal(r.state, 30)).toBeNull();
    expect(weekNight(r.state, bigDay, goal).done).toBeNull();
  });

  it('не выполнил цель — шаг ждёт следующего дня, ничего не отнимается', () => {
    const s = at('summer');
    const r = weekNight(s, stats(), weekGoal(s, 30));
    expect(r.done).toBeNull();
    expect(r.state).toBe(s);
    const next = { ...s, day: s.day + 1 };
    expect(weekGoal(next, 30)!.step).toBe(1);
  });

  it('шесть шагов — памятная вещь в зал; она остаётся и после «Начать заново»', () => {
    let s = at('sale');
    for (let n = 1; n <= WEEK_STEPS; n++) {
      s = { ...s, day: weekStart('sale') + n - 1 };
      const r = weekNight(s, bigDay, weekGoal(s, 30));
      expect(r.done?.step).toBe(n);
      if (n === WEEK_STEPS) expect(r.done?.keepsake).toBe('holiday_cart');
      s = r.state;
    }
    expect(s.decor.owned).toContain('holiday_cart');
    expect(s.decor.active.holiday).toBe('holiday_cart');
    expect(isKeepsake('holiday_cart')).toBe(true);
    expect(restartGame(s).decor.owned).toContain('holiday_cart');
    // В следующем году дорожка заново, а за последний шаг — монеты (вещь уже есть).
    const nextYear = { ...s, day: weekStart('sale', s.day + 1) };
    expect(trackOf(nextYear, 'sale', nextYear.day).steps).toBe(0);
  });

  it('недоделанная дорожка продолжается в следующем году', () => {
    let s = at('harvest');
    s = weekNight(s, bigDay, weekGoal(s, 30)).state;
    const later = { ...s, day: weekStart('harvest', s.day + 7) };
    expect(trackOf(later, 'harvest', later.day).steps).toBe(1);
    expect(weekGoal(later, 30)!.step).toBe(2);
  });

  it('цель утром запоминается в плане и вечером засчитывается (nightCycle)', () => {
    const s = ensurePlan(at('harvest', 2));
    expect(s.plan?.week?.step).toBe(1);
    const night = nightCycle(s, bigDay, () => 0.5);
    expect(night.week?.step).toBe(1);
    expect(night.state.weeks?.tracks?.harvest?.steps).toBe(1);
  });

  it('гостей в неделю урожая и фестиваля чуть больше', () => {
    const plain = { ...newGame(), day: weekStart('harvest') - 1 };
    onlyWeeks([]);
    const off = guestFactor({ ...plain, day: plain.day + 1 });
    onlyWeeks(null);
    expect(guestFactor({ ...plain, day: plain.day + 1 })).toBeCloseTo(off * WEEKS.harvest.guests, 5);
  });
});

describe('сезонные недели: распродажа', () => {
  it('−20% только вечером распродажи и только в её неделю', () => {
    const s = { ...newGame(), day: weekStart('sale') + 2 };
    const unit = { age: 0 };
    expect(saleOn(s)).toBe(false);
    const on = startSale(s);
    expect(saleOn(on)).toBe(true);
    expect(unitSalePrice(on, 'bread', unit)).toBe(Math.round(s.prices.bread * 0.8));
    // Отметка вчерашнего вечера сегодня не действует.
    expect(saleOn({ ...on, day: on.day + 1 })).toBe(false);
    // Не в неделю распродажи — отметку не ставим.
    const other = { ...newGame(), day: weekStart('summer') };
    expect(startSale(other)).toBe(other);
  });
});

describe('сезонные недели: «Завтра:» и сохранения', () => {
  it('утром перед неделей обещают её начало', () => {
    const s = { ...newGame(), day: weekStart('summer'), rating: 3 };
    const teaser = tomorrowTeaser({ ...s, story: { ...s.story, introSeen: false } });
    expect(teaser.key).toBe('teaser.week');
    expect(teaser.params.name).toBe('week.summer');
  });

  it('битые и чужие поля недель убираются, старые сохранения без них грузятся', () => {
    expect(normalizeWeeks(undefined)).toBeUndefined();
    expect(normalizeWeeks('x')).toBeUndefined();
    expect(normalizeWeeks({ tracks: { harvest: { year: 0, steps: 99 }, bogus: { year: 1, steps: 1 }, sale: { year: 'x' } }, sale: 40 })).toEqual({
      tracks: { harvest: { year: 0, steps: WEEK_STEPS } },
      sale: 40,
    });
  });

  it('сохранение с неделями и без них загружается', async () => {
    const local: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] });
    vi.resetModules();
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 40 } as Record<string, unknown>;
    delete old.weeks;
    // Старое сохранение — без цен новых товаров.
    old.prices = { bread: 40 };
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(s.weeks).toBeUndefined();
    expect(s.prices.pumpkins).toBe(45);
    saveGame({ ...s, weeks: { tracks: { sale: { year: 0, steps: 2, last: 38 } }, sale: 39 } });
    expect(loadGame()!.weeks).toEqual({ tracks: { sale: { year: 0, steps: 2, last: 38 } }, sale: 39 });
    vi.unstubAllGlobals();
  });
});

describe('сезонные недели: баланс (симулятор)', () => {
  // Каждую неделю меряем отдельно: до её начала прогоны с ней и без неё совпадают день в день.
  // Прибавка к выручке за неделю — не больше ~10%, и ни выручка, ни прибыль не меньше, чем без недели
  // (неделя ничем не наказывает; на распродаже скидку окупают толпа и лишняя вещь в корзине).
  const SEEDS = 10;
  for (const id of WEEK_IDS) {
    it(`${id}: выручка за неделю — от +0% до +10%, прибыль не ниже`, () => {
      const from = weekStart(id);
      const sum = (on: boolean) => {
        let revenue = 0;
        let profit = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          onlyWeeks(on ? [id] : []);
          const r = simulate({ days: from + MONTH_DAYS - 1, seed });
          for (const d of r.days.filter((d) => d.day >= from && d.day < from + MONTH_DAYS)) {
            revenue += d.revenue;
            profit += d.profit;
          }
        }
        onlyWeeks(null);
        return { revenue, profit };
      };
      const off = sum(false);
      const on = sum(true);
      expect(on.revenue / off.revenue).toBeGreaterThan(1);
      expect(on.revenue / off.revenue).toBeLessThan(1.1);
      expect(on.profit).toBeGreaterThan(off.profit);
    });
  }
});
