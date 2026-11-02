import { describe, expect, it } from 'vitest';
import { managerBoost, newGame, onShift, restStaff, roleOpen, workSpeed, type StaffMember, type StoreState } from '../src/game/economy';
import { MANAGER_MARKUP, managerPick, orderUrgent, receiveUrgent, urgentCost, urgentUnitPrice } from '../src/game/urgent';
import { listPrice } from '../src/game/suppliers';

const cashier: StaffMember = { role: 'cashier', name: 0, skill: 2, wage: 420, months: 1 };
const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, level: 3, staff: [cashier], ...patch });

describe('персонал — без усталости и выходных (02.11)', () => {
  it('сколько ни работай подряд, днём и ночью, — скорость та же, и все на смене', () => {
    let s = shop();
    for (let i = 0; i < 30; i++) s = restStaff({ ...s, day: s.day + 1 });
    expect(s.staff[0]).toEqual(cashier);
    expect(workSpeed(s.staff[0])).toBe(workSpeed(cashier));
    expect(onShift(s, 'cashier')).toBe(true);
  });

  it('воодушевление тает по дню за ночь', () => {
    let s = shop({ staff: [{ ...cashier, inspired: 2 }] });
    expect(workSpeed(s.staff[0])).toBeGreaterThan(workSpeed(cashier));
    s = restStaff(s);
    expect(s.staff[0].inspired).toBe(1);
    s = restStaff(s);
    expect(s.staff[0].inspired).toBeUndefined();
  });
});

describe('менеджер', () => {
  it('нанимается только с супермаркета и ускоряет всех', () => {
    expect(roleOpen(shop({ level: 2 }), 'manager')).toBe(false);
    expect(roleOpen(shop({ level: 3 }), 'manager')).toBe(true);
    const manager: StaffMember = { role: 'manager', name: 1, skill: 2, wage: 650, months: 0 };
    expect(managerBoost(shop({ staff: [cashier, manager] }))).toBeGreaterThan(1);
    expect(managerBoost(shop())).toBe(1);
  });
});

describe('срочный подвоз (только менеджер — у игрока кнопки нет с 02.11)', () => {
  it('дороже обычного (+10%), платится сразу, товар приезжает потом', () => {
    const s = shop({ warehouse: {}, shelves: [{ kind: 'dairy', level: 0, items: {} }] });
    const unit = urgentUnitPrice(s, 'milk')!;
    expect(unit).toBe(Math.round(listPrice('milk')! * MANAGER_MARKUP));
    expect(urgentCost(s, 'milk', 6)).toBe(unit * 6);
    const paid = orderUrgent(s, 'milk', 6)!;
    expect(paid.money).toBe(s.money - urgentCost(s, 'milk', 6)!);
    expect(paid.warehouse.milk ?? []).toHaveLength(0);
    expect(receiveUrgent(paid, 'milk', 6).warehouse.milk).toHaveLength(6);
  });

  it('нет денег — не заказать; менеджер видит, что кончилось', () => {
    const s = shop({ money: 10, warehouse: {}, shelves: [{ kind: 'dairy', level: 0, items: {} }] });
    expect(orderUrgent(s, 'milk', 6)).toBeNull();
    expect(managerPick(s)).toBe('milk');
  });
});
