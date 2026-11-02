import { describe, expect, it } from 'vitest';
import {
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

describe('опыт и ставка', () => {
  it('раз в два месяца растёт навык — и ставка сама поднимается до положенной (просить не надо)', () => {
    const first = monthForStaff([member()])[0];
    expect(first.months).toBe(1);
    expect(first.wage).toBe(wageFor('cashier', 1));
    const second = monthForStaff([first])[0];
    expect(second.skill).toBe(2);
    expect(second.wage).toBe(wageFor('cashier', 2));
  });

  it('кто получает больше ставки, тому не урезают; просьб, обид и увольнений нет', () => {
    const rich = member({ skill: 3, months: 40, wage: wageFor('cashier', 3) + 300 });
    expect(monthForStaff([rich])[0].wage).toBe(rich.wage);
    let staff = [member(), member({ role: 'loader', wage: wageFor('loader', 1) })];
    for (let i = 0; i < 12; i++) staff = monthForStaff(staff);
    expect(staff).toHaveLength(2);
    expect(staff.every((m) => m.skill === 3 && m.wage === wageFor(m.role, 3))).toBe(true);
  });

  it('в конце месяца зарплата в счёте, все остаются', () => {
    const s: StoreState = { ...newGame(), day: MONTH_DAYS, money: 5000, debt: 0, staff: [member()] };
    const night = endDay(s, emptyDayStats());
    expect(night.bill!.salaries).toBe(member().wage);
    expect(night.state.staff).toHaveLength(1);
  });
});

describe('воры', () => {
  it('в большом магазине воров больше, опытный охранник ловит чаще', () => {
    expect(thiefChance(4)).toBeGreaterThan(thiefChance(0));
    expect(guardCatchChance(member({ role: 'guard', skill: 3 }))).toBeGreaterThan(guardCatchChance(member({ role: 'guard' })));
    expect(guardCatchChance(member({ role: 'guard', skill: 3, trait: 'hardworker' }))).toBeLessThanOrEqual(0.95);
  });
});
