import { describe, expect, it } from 'vitest';
import {
  answerRaise,
  emptyDayStats,
  endDay,
  fire,
  guardCatchChance,
  hire,
  MONTH_DAYS,
  monthForStaff,
  newGame,
  skimmedToday,
  STAFF_LIMIT,
  STAFF_ROLES,
  thiefChance,
  UPSET_SPEED,
  wageFor,
  workSpeed,
  type StaffMember,
  type StoreState,
} from '../src/game/economy';
import { candidatesFor, currentCandidates, JOB_AD_COST, startJobSearch } from '../src/game/staff';

const member = (extra: Partial<StaffMember> = {}): StaffMember => ({
  role: 'cashier',
  name: 0,
  skill: 1,
  wage: wageFor('cashier', 1),
  months: 0,
  ...extra,
});
const never = () => 0.99;
const always = () => 0;

describe('поиск сотрудников', () => {
  it('кандидаты появляются только после объявления, объявление стоит денег', () => {
    const s = newGame();
    expect(currentCandidates(s)).toEqual([]);
    const searched = startJobSearch(s, 'cleaner')!;
    expect(searched.money).toBe(s.money - JOB_AD_COST);
    const list = currentCandidates(searched);
    expect(list).toHaveLength(3);
    expect(list.every((c) => c.role === 'cleaner')).toBe(true);
  });

  it('повторно открыть то же объявление бесплатно, завтра кандидатов уже нет', () => {
    const searched = startJobSearch(newGame(), 'guard')!;
    expect(startJobSearch(searched, 'guard')!.money).toBe(searched.money);
    expect(currentCandidates({ ...searched, day: searched.day + 1 })).toEqual([]);
  });

  it('без денег объявление не дать', () => {
    expect(startJobSearch({ ...newGame(), money: 0 }, 'guard')).toBeNull();
  });

  it('кандидаты одного дня одинаковые, имена не повторяются', () => {
    expect(candidatesFor(5, 0, 'loader')).toEqual(candidatesFor(5, 0, 'loader'));
    const names = candidatesFor(5, 0, 'loader').map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('найм', () => {
  it('одна роль — один человек, не больше лимита помещения', () => {
    const s = newGame();
    const one = hire(s, member())!;
    expect(one.staff).toHaveLength(1);
    expect(hire(one, member({ name: 3 }))).toBeNull(); // кассир уже есть
    expect(STAFF_LIMIT[0]).toBe(1);
    expect(hire(one, member({ role: 'guard' }))).toBeNull(); // в ларьке место только для одного
    expect(fire(one, 'cashier').staff).toEqual([]);
  });

  it('нанятый кандидат пропадает из списка', () => {
    const searched = startJobSearch(newGame(), 'cashier')!;
    const [first] = currentCandidates(searched);
    expect(currentCandidates(hire(searched, first)!)).toHaveLength(2);
  });

  it('зарплата: навык и черта характера', () => {
    expect(wageFor('cashier', 3)).toBeGreaterThan(wageFor('cashier', 1));
    expect(wageFor('cashier', 2, 'hardworker')).toBeGreaterThan(wageFor('cashier', 2));
    expect(wageFor('cashier', 2, 'sticky')).toBeLessThan(wageFor('cashier', 2));
    expect(wageFor('cashier', 2)).toBe(STAFF_ROLES.cashier.wage);
  });

  it('трудоголик быстрее, тормоз медленнее', () => {
    expect(workSpeed(member({ trait: 'hardworker' }))).toBeGreaterThan(workSpeed(member()));
    expect(workSpeed(member({ trait: 'slowpoke' }))).toBeLessThan(workSpeed(member()));
  });

  it('«нечист на руку» уносит часть выручки', () => {
    const s = { ...newGame(), staff: [member({ trait: 'sticky' })] };
    expect(skimmedToday(s, 1000)).toBe(40);
    expect(skimmedToday(newGame(), 1000)).toBe(0);
  });
});

describe('опыт и прибавки', () => {
  it('раз в два месяца растёт навык — и сотрудник просит прибавку', () => {
    const first = monthForStaff([member()], never).staff[0];
    expect(first.months).toBe(1);
    expect(first.raiseAsk).toBeUndefined();
    const second = monthForStaff([first], never).staff[0];
    expect(second.skill).toBe(2);
    expect(second.wage).toBe(wageFor('cashier', 1)); // сама зарплата не растёт
    expect(second.raiseAsk).toBe(wageFor('cashier', 2));
  });

  it('опытные иногда просят прибавку и без роста навыка', () => {
    const veteran = member({ skill: 3, months: 4, wage: 500 });
    expect(monthForStaff([veteran], always).staff[0].raiseAsk).toBe(550);
    expect(monthForStaff([veteran], never).staff[0].raiseAsk).toBeUndefined();
  });

  it('согласился — зарплата выше', () => {
    const s = { ...newGame(), staff: [member({ raiseAsk: 500 })] };
    const after = answerRaise(s, 'cashier', true).staff[0];
    expect(after.wage).toBe(500);
    expect(after.raiseAsk).toBeUndefined();
  });

  it('отказал — обида: медленнее и может уволиться в конце месяца', () => {
    const s = { ...newGame(), staff: [member({ raiseAsk: 500 })] };
    const upset = answerRaise(s, 'cashier', false).staff[0];
    expect(upset.upset).toBe(true);
    expect(workSpeed(upset)).toBeCloseTo(workSpeed(member()) * UPSET_SPEED);
    expect(monthForStaff([upset], always).quit).toHaveLength(1);
    const stayed = monthForStaff([upset], never);
    expect(stayed.quit).toHaveLength(0);
    expect(stayed.staff[0].upset).toBe(false);
  });

  it('в конце месяца зарплата в счёте, ушедшие — в уведомлении', () => {
    const s: StoreState = { ...newGame(), day: MONTH_DAYS, money: 5000, debt: 0, staff: [member({ upset: true })] };
    const night = endDay(s, emptyDayStats(), always);
    expect(night.bill!.salaries).toBe(member().wage);
    expect(night.state.staff).toEqual([]);
    expect(night.state.quitNotice).toHaveLength(1);
  });
});

describe('воры', () => {
  it('в большом магазине воров больше, опытный охранник ловит чаще', () => {
    expect(thiefChance(4)).toBeGreaterThan(thiefChance(0));
    expect(guardCatchChance(member({ role: 'guard', skill: 3 }))).toBeGreaterThan(guardCatchChance(member({ role: 'guard' })));
    expect(guardCatchChance(member({ role: 'guard', skill: 3, trait: 'hardworker' }))).toBeLessThanOrEqual(0.95);
  });
});
