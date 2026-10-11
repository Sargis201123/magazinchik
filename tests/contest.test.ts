import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type DayStats, type StoreState } from '../src/game/economy';
import {
  CONTEST_AFTER_GIANT,
  CONTEST_DAYS,
  CONTEST_EVERY_LOST,
  CONTEST_EVERY_WON,
  contestAnnounce,
  contestGuests,
  contestNight,
  contestPrize,
  contestResult,
  juryDay,
  legendNumber,
  seeAnnounce,
  seeResult,
  tierKey,
} from '../src/game/contest';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 100,
  money: 1000,
  rating: 4.8,
  history: Array(7).fill(1000),
  giant: { phase: 'won', since: 90, revenue: 0, target: 0, seen: 'won' },
  ...patch,
});
const dayStats = (patch: Partial<DayStats> = {}): DayStats => ({ ...emptyDayStats(), revenue: 1200, served: 40, ...patch });

/** Прожить неделю конкурса: каждую ночь — те же итоги дня. */
function week(start: StoreState, stats: DayStats): StoreState {
  let s = start;
  for (let i = 0; i < CONTEST_DAYS; i++) s = contestNight({ ...s, day: s.day + 1 }, stats);
  return s;
}

describe('конкурс «Лучший магазин района»', () => {
  it('объявляют через несколько дней после победы над «Гигантом»', () => {
    expect(contestNight(shop({ day: 90 + CONTEST_AFTER_GIANT - 1 }), dayStats()).contest).toBeUndefined();
    expect(contestNight(shop({ giant: { phase: 'lost', since: 80, revenue: 0, target: 0 } }), dayStats()).contest).toBeUndefined();
    const s = contestNight(shop(), dayStats());
    expect(s.contest).toMatchObject({ tier: 0, phase: 'run', since: 100, wins: 0 });
    expect(s.contest!.target).toBe(7000);
    expect(contestAnnounce(s)).not.toBeNull();
    expect(contestAnnounce(seeAnnounce(s))).toBeNull();
  });

  it('неделя: жюри в последний день, победа — приз, звание, слава', () => {
    const start = seeAnnounce(contestNight(shop(), dayStats()));
    expect(juryDay({ ...start, day: start.day + CONTEST_DAYS - 1 })).toBe(true);
    expect(juryDay({ ...start, day: start.day + 2 })).toBe(false);
    const after = week(start, dayStats());
    const result = contestResult(after)!;
    expect(result.won).toBe(true);
    expect(result.passed).toEqual({ rating: true, revenue: true, happy: true, shelves: true });
    expect(after.money).toBe(1000 + contestPrize(0));
    expect(after.contest).toMatchObject({ phase: 'wait', tier: 1, wins: 1 });
    expect(contestGuests(after)).toBeCloseTo(1.03);
    expect(contestResult(seeResult(after))).toBeNull();
    // Через месяц — конкурс города.
    let next = seeResult(after);
    for (let i = 0; i < CONTEST_EVERY_WON; i++) next = contestNight({ ...next, day: next.day + 1 }, dayStats());
    expect(next.contest).toMatchObject({ phase: 'run', tier: 1, wins: 1 });
    expect(tierKey(next.contest!.tier)).toBe('city');
  });

  it('хватает трёх оценок из четырёх; две — проигрыш и новый шанс через три недели', () => {
    const start = seeAnnounce(contestNight(shop(), dayStats()));
    // Пустые полки, но остальное хорошо — победа.
    expect(contestResult(week(start, dayStats({ lostWhy: { empty: 3 } })))!.won).toBe(true);
    // Низкий рейтинг и много недовольных — проигрыш.
    const lost = week({ ...start, rating: 4 }, dayStats({ lost: 10, complaints: 5 }));
    const result = contestResult(lost)!;
    expect(result.won).toBe(false);
    expect(result.passed.rating).toBe(false);
    expect(result.passed.happy).toBe(false);
    expect(lost.money).toBe(1000);
    expect(lost.contest).toMatchObject({ tier: 0, wins: 0, phase: 'wait' });
    let next = seeResult(lost);
    for (let i = 0; i < CONTEST_EVERY_LOST; i++) next = contestNight({ ...next, day: next.day + 1 }, dayStats());
    expect(next.contest).toMatchObject({ phase: 'run', tier: 0 });
  });

  it('звания: район, город, область, страна, легенда, легенда II…', () => {
    expect([0, 1, 2, 3, 4, 5].map(tierKey)).toEqual(['district', 'city', 'region', 'country', 'legend', 'legend']);
    expect(legendNumber(4)).toBe('');
    expect(legendNumber(5)).toBe(' II');
    expect(legendNumber(12)).toBe(' IX');
  });
});
