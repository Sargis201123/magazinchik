import { describe, expect, it } from 'vitest';
import { emptyDayStats, MONTH_DAYS, newGame, START_DEBT, type StoreState } from '../src/game/economy';
import { afterBills, BANKRUPT_BILLS, baseBill, debtLimit, debtOutcome, seeDebtWarning, seeGrandmaRescue } from '../src/game/bankruptcy';
import { nightCycle } from '../src/game/day';
import { premiumDecor, restartGame } from '../src/game/restart';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 0, ...patch });

describe('банкротство', () => {
  it('предел долга: стартовый долг и три обычных счёта', () => {
    const s = shop();
    expect(debtLimit(s)).toBe(START_DEBT + BANKRUPT_BILLS * baseBill(s));
    expect(debtOutcome({ ...s, debt: debtLimit(s) })).toBe('ok');
  });

  it('выше предела: предупреждение → бабушка гасит половину → закрытие', () => {
    const over = (s: StoreState) => ({ ...s, debt: debtLimit(s) * 2 });
    let s = afterBills(over(shop()));
    expect(s.debtWarning).toEqual({ seen: false });
    expect(seeDebtWarning(s).debtWarning).toEqual({ seen: true });
    s = afterBills(over(s));
    const before = debtLimit(s) * 2;
    expect(s.grandmaRescue).toEqual({ paid: before / 2, seen: false });
    expect(s.debt).toBe(before / 2);
    expect(s.debtWarning).toBeUndefined();
    expect(seeGrandmaRescue(s).grandmaRescue!.seen).toBe(true);
    // Бабушка выручает один раз: дальше снова предупреждение, а потом закрытие.
    s = afterBills(over(s));
    expect(s.debtWarning).toBeDefined();
    expect(s.bankrupt).toBeUndefined();
    s = afterBills(over(s));
    expect(s.bankrupt).toBe(true);
  });

  it('погасил долг до счетов — предупреждение снимается', () => {
    const warned = afterBills({ ...shop(), debt: 99999 });
    const ok = afterBills({ ...warned, debt: 0 });
    expect(ok.debtWarning).toBeUndefined();
    expect(ok.bankrupt).toBeUndefined();
  });

  it('проверка идёт только в ночь счетов', () => {
    const big = { ...shop(), debt: 99999, plan: undefined };
    const quiet = nightCycle({ ...big, day: MONTH_DAYS * 3 + 2 }, emptyDayStats(), () => 0.5);
    expect(quiet.state.debtWarning).toBeUndefined();
    const billNight = nightCycle({ ...big, day: MONTH_DAYS * 3 }, emptyDayStats(), () => 0.5);
    expect(billNight.bill).not.toBeNull();
    expect(billNight.state.debtWarning).toEqual({ seen: false });
  });
});

describe('начать заново', () => {
  const played = shop({
    day: 80,
    money: 5000,
    level: 3,
    debt: 1200,
    achievements: ['firstDay', 'cat'],
    decor: { owned: ['floor_gold', 'wall_mint', 'aquarium', 'neon_open'], active: { floor: 'floor_gold', wall: 'wall_mint', aquarium: 'aquarium' } },
    skills: { hands: 2 },
    bankrupt: true,
    gift: { lastDate: '2026-10-10', streak: 4 },
  });

  it('магазин с нуля, покупки за звёзды и достижения остаются', () => {
    const s = restartGame(played);
    const fresh = newGame();
    expect(s.day).toBe(fresh.day);
    expect(s.money).toBe(fresh.money);
    expect(s.level).toBe(0);
    expect(s.debt).toBe(fresh.debt);
    expect(s.skills).toBeUndefined();
    expect(s.bankrupt).toBeUndefined();
    expect(s.story).toEqual(fresh.story);
    // Премиальное (за звёзды) осталось и стоит на месте, купленное за монеты — нет.
    expect(premiumDecor(played)).toEqual(['floor_gold', 'aquarium', 'neon_open']);
    expect(s.decor.owned).toEqual(['floor_gold', 'aquarium', 'neon_open']);
    expect(s.decor.active).toEqual({ floor: 'floor_gold', aquarium: 'aquarium' });
    expect(s.achievements).toEqual(['firstDay', 'cat']);
    expect(s.gift).toEqual(played.gift);
    expect(s.tourDone).toBe(true);
    expect(s.runs).toBe(1);
    expect(restartGame(s).runs).toBe(2);
  });
});
