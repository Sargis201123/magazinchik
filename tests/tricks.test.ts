import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  activeTrick,
  answerTrick,
  BANNER_DAYS,
  counterCost,
  exposedPay,
  inspectorFine,
  seeTrickResult,
  trickGuests,
  trickNight,
  trickResult,
  tricksMorning,
  trickToday,
  TRICK_FROM_DAY,
  TRICK_GAP,
  type TrickKind,
} from '../src/game/tricks';
import { nightCycle } from '../src/game/day';
import { emptyDayStats } from '../src/game/economy';

const at = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, level: 2, money: 5000, ...patch });
const withTrick = (kind: TrickKind, patch: Partial<StoreState> = {}) => at({ trick: { kind, day: 20, until: kind === 'banner' ? 20 + BANNER_DAYS - 1 : 20 }, ...patch });

describe('козни конкурента', () => {
  it('начинаются не раньше 10-го дня и не чаще раза в 5 дней', () => {
    expect(tricksMorning(at({ day: TRICK_FROM_DAY - 1 }), () => 0).trick).toBeUndefined();
    const s = tricksMorning(at(), () => 0);
    expect(s.trick).toMatchObject({ kind: 'promoter', day: 20 });
    expect(tricksMorning({ ...s, day: 20 + TRICK_GAP - 1 }, () => 0).trick).toBe(s.trick);
    expect(tricksMorning({ ...s, day: 20 + TRICK_GAP }, () => 0).trick?.day).toBe(20 + TRICK_GAP);
    expect(tricksMorning(at(), () => 0.99).trick).toBeUndefined();
  });

  it('промоутер: без ответа −15% гостей, свой промоутер +5%, жалоба — как повезёт', () => {
    const s = withTrick('promoter');
    expect(trickToday(s)).toBeDefined();
    expect(trickGuests(s)).toBeLessThan(1);
    const own = answerTrick(s, 'counter')!;
    expect(own.money).toBe(5000 - counterCost('promoter', 2));
    expect(trickGuests(own)).toBeGreaterThan(1);
    expect(trickToday(own)).toBeUndefined();
    expect(trickGuests(answerTrick(s, 'complain', () => 0)!)).toBe(1);
    expect(trickGuests(answerTrick(s, 'complain', () => 0.99)!)).toBeLessThan(1);
    expect(answerTrick({ ...s, money: 10 }, 'counter')).toBeNull();
  });

  it('перетяжка висит три дня; на неё не пожалуешься', () => {
    const s = withTrick('banner');
    expect(answerTrick(s, 'complain')).toBeNull();
    const ignored = answerTrick(s, 'ignore')!;
    expect(activeTrick({ ...ignored, day: 20 + BANNER_DAYS - 1 })).toBeDefined();
    expect(activeTrick({ ...ignored, day: 20 + BANNER_DAYS })).toBeUndefined();
    expect(trickGuests({ ...ignored, day: 21 })).toBeLessThan(1);
  });

  it('«проверяющий»: уборка — ушёл ни с чем; разоблачили — нам платят; иначе штраф', () => {
    const s = withTrick('inspector');
    const clean = trickNight(answerTrick(s, 'counter')!, () => 0, false);
    expect(clean.trick?.result).toBe('passed');
    const exposed = trickNight(answerTrick(s, 'complain', () => 0)!, () => 0, false);
    expect(exposed.trick?.result).toBe('exposed');
    expect(exposed.money).toBe(5000 + exposedPay(2));
    const fined = trickNight(answerTrick(s, 'ignore')!, () => 0, false);
    expect(fined.money).toBe(5000 - inspectorFine(2));
    expect(fined.rating).toBeLessThan(s.rating);
    // Пустая касса — остаток штрафа уходит в долг, в минус касса не уходит.
    const broke = trickNight(answerTrick(withTrick('inspector', { money: 5, debt: 10 }), 'ignore')!, () => 0, false);
    expect(broke.money).toBe(0);
    expect(broke.debt).toBe(10 + inspectorFine(2) - 5);
    // Уборщица на смене — шанс штрафа вдвое меньше.
    expect(trickNight(answerTrick(s, 'ignore')!, () => 0.4, true).trick?.result).toBe('passed');
    // Утром рассказать один раз.
    const morning = { ...fined, day: 21 };
    expect(trickResult(morning)?.result).toBe('fined');
    expect(trickResult(seeTrickResult(morning))).toBeUndefined();
  });

  it('в ночном цикле: штраф за «проверяющего» списывается', () => {
    const s = answerTrick(withTrick('inspector', { staff: [] }), 'ignore')!;
    const night = nightCycle(s, emptyDayStats(), () => 0);
    expect(night.state.trick?.result).toBe('fined');
  });
});
