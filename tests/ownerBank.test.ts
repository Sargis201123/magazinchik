import { describe, expect, it } from 'vitest';
import { emptyDayStats, monthlyBill, newGame, newLifetime, ownerScan, payBill, type StoreState } from '../src/game/economy';
import { afterLoanPayment, loanOptions, loanPayment, loanTotal, repayLoan, takeLoan } from '../src/game/bank';
import { carryBonus, charmPatience, eyeTheft, haggleBonus, learnSkill, ownerLevelOf, ownerTiming, SKILL_MAX, skillPoints, XP_LEVELS } from '../src/game/owner';
import { addReport, REPORT_DAYS, weekReport } from '../src/game/reports';
import { haggleChance, SUPPLIERS } from '../src/game/suppliers';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, ...patch });
const served = (n: number): Partial<StoreState> => ({ lifetime: { ...newLifetime(), served: n } });

describe('навыки хозяина', () => {
  it('уровень растёт с обслуженными покупателями, за уровень — очко', () => {
    expect(ownerLevelOf(shop())).toBe(1);
    expect(skillPoints(shop())).toBe(0);
    const s = shop(served(XP_LEVELS[3]));
    expect(ownerLevelOf(s)).toBe(4);
    expect(skillPoints(s)).toBe(3);
  });

  it('очко тратится на навык, без очков и сверх максимума — нельзя', () => {
    expect(learnSkill(shop(), 'hands')).toBeNull();
    let s = shop(served(XP_LEVELS[XP_LEVELS.length - 1]));
    for (let i = 0; i < SKILL_MAX; i++) s = learnSkill(s, 'hands')!;
    expect(s.skills?.hands).toBe(SKILL_MAX);
    expect(learnSkill(s, 'hands')).toBeNull();
    expect(skillPoints(s)).toBe(XP_LEVELS.length - 1 - SKILL_MAX);
  });

  it('навыки действуют: быстрее пробивка, торг, ноша, терпение, меньше воров', () => {
    const base = shop();
    const s = shop({ skills: { hands: 3, haggle: 2, strong: 1, charm: 3, eye: 2 } });
    expect(ownerTiming(s).item).toBeLessThan(ownerTiming(base).item);
    expect(ownerTiming(base)).toEqual(ownerScan(base.ownerServed));
    expect(haggleBonus(s)).toBeCloseTo(0.12);
    const zina = SUPPLIERS[Object.keys(SUPPLIERS)[0] as keyof typeof SUPPLIERS];
    expect(haggleChance(zina, 0.1, 3, haggleBonus(s))).toBeGreaterThan(haggleChance(zina, 0.1, 3));
    expect(carryBonus(s)).toBe(2);
    expect(charmPatience(s)).toBeGreaterThan(1);
    expect(eyeTheft(s)).toBeLessThan(1);
  });
});

describe('банк', () => {
  it('кредит: деньги сразу, долг с процентом, один за раз', () => {
    const s = shop({ level: 2 });
    const [half, full] = loanOptions(s);
    expect(half).toBeLessThan(full);
    const taken = takeLoan(s, full)!;
    expect(taken.money).toBe(s.money + full);
    expect(taken.loan).toEqual({ left: loanTotal(full), payment: loanPayment(full) });
    expect(takeLoan(taken, half)).toBeNull();
    expect(takeLoan(s, 1234)).toBeNull();
  });

  it('платёж приходит со счетами и уменьшает остаток; последний — не больше остатка', () => {
    let s = takeLoan(shop({ level: 1, money: 100000 }), loanOptions(shop({ level: 1 }))[1])!;
    const total = s.loan!.left;
    expect(monthlyBill(s).loan).toBe(s.loan!.payment);
    let months = 0;
    while (s.loan && months < 10) {
      s = payBill(s).state;
      months++;
    }
    expect(months).toBe(4);
    expect(s.loan).toBeUndefined();
    expect(total).toBeGreaterThan(0);
  });

  it('не хватило на счета — платёж всё равно засчитан, недостача в долг', () => {
    const s = takeLoan(shop({ level: 1, money: 0 }), 1500)!;
    const after = payBill({ ...s, money: 0 }).state;
    expect(after.loan!.left).toBe(s.loan!.left - s.loan!.payment);
    expect(after.debt).toBeGreaterThan(s.debt);
  });

  it('досрочное погашение', () => {
    const s = takeLoan(shop({ level: 1 }), 1500)!;
    const part = repayLoan(s, 500)!;
    expect(part.loan!.left).toBe(s.loan!.left - 500);
    const all = repayLoan(s, 999999)!;
    expect(all.loan).toBeUndefined();
    expect(all.money).toBe(s.money - s.loan!.left);
    expect(repayLoan(shop(), 100)).toBeNull();
    expect(afterLoanPayment(shop(), 100)).toEqual(shop());
  });
});

describe('отчёт недели', () => {
  it(`хранит ${REPORT_DAYS} последних дней`, () => {
    let s = shop();
    for (let d = 1; d <= REPORT_DAYS + 3; d++) s = addReport(s, d, { ...emptyDayStats(), revenue: d * 100 }, {});
    expect(s.reports).toHaveLength(REPORT_DAYS);
    expect(s.reports![0].day).toBe(4);
    expect(weekReport(s).revenue).toBe((4 + 5 + 6 + 7 + 8 + 9 + 10) * 100);
  });

  it('советы: портится, дорого, не хватало; строки — по прибыли', () => {
    let s = shop();
    for (let d = 1; d <= 7; d++) {
      s = addReport(s, d, { ...emptyDayStats(), sold: { milk: 10, bread: 2 }, pricey: { apples: 2 }, missing: { potatoes: 1 } }, { bread: 1 });
    }
    const r = weekReport(s);
    const line = (id: string) => r.lines.find((l) => l.id === id)!;
    expect(line('bread').advice).toBe('report.advice.spoils');
    expect(line('apples').advice).toBe('report.advice.pricey');
    expect(line('potatoes').advice).toBe('report.advice.missing');
    expect(r.lines[0].id).toBe('milk');
  });
});
