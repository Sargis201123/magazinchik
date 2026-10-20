import { describe, expect, it } from 'vitest';
import { newGame, workSpeed, restStaff, type StaffMember, type StoreState } from '../src/game/economy';
import { answerStaffEvent, COURSE_COST, INSPIRED_DAYS, staffMorning } from '../src/game/staffEvents';

const member = (role: StaffMember['role'], skill = 1): StaffMember => ({ role, name: 0, skill, wage: 400, months: 2 });
const at = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, level: 2, money: 5000, staff: [member('cashier'), member('loader', 3)], ...patch });
const withEvent = (kind: NonNullable<StoreState['staffEvent']>['kind'], roles: StaffMember['role'][] = ['cashier']) => at({ staffEvent: { kind, roles, day: 20 } });

describe('персонал с характером', () => {
  it('история случается не раньше 10-го дня и только при двух сотрудниках', () => {
    expect(staffMorning(at({ day: 5 }), () => 0).staffEvent).toBeUndefined();
    expect(staffMorning(at({ staff: [member('cashier')] }), () => 0).staffEvent).toBeUndefined();
    expect(staffMorning(at(), () => 0).staffEvent).toBeDefined();
    expect(staffMorning(at(), () => 0.99).staffEvent).toBeUndefined();
  });

  it('свадьба: отпустил — выходной и воодушевление; отказал — обида', () => {
    const yes = answerStaffEvent(withEvent('wedding'), true)!;
    const m = yes.staff[0];
    expect(m).toMatchObject({ offDay: 21, inspired: INSPIRED_DAYS });
    expect(workSpeed(m)).toBeGreaterThan(workSpeed(member('cashier')));
    expect(answerStaffEvent(withEvent('wedding'), false)!.staff[0].upset).toBe(true);
    expect(yes.staffEvent).toBeUndefined();
  });

  it('курсы повышают навык за деньги; без денег — нельзя', () => {
    const s = answerStaffEvent(withEvent('course'), true)!;
    expect(s.staff[0].skill).toBe(2);
    expect(s.money).toBe(5000 - COURSE_COST);
    expect(answerStaffEvent({ ...withEvent('course'), money: 10 }, true)).toBeNull();
  });

  it('ссора: пицца мирит, иначе оба обижены; воодушевление проходит со временем', () => {
    const peace = answerStaffEvent(withEvent('quarrel', ['cashier', 'loader']), true)!;
    expect(peace.staff.every((m) => !m.upset)).toBe(true);
    const sulk = answerStaffEvent(withEvent('quarrel', ['cashier', 'loader']), false)!;
    expect(sulk.staff.every((m) => m.upset)).toBe(true);
    let s = answerStaffEvent(withEvent('best'), true)!;
    for (let i = 0; i < INSPIRED_DAYS; i++) s = restStaff(s);
    expect(s.staff[0].inspired).toBeUndefined();
  });
});
