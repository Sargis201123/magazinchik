import { describe, expect, it } from 'vitest';
import {
  giveDayOff,
  isAbsent,
  isTired,
  managerBoost,
  newGame,
  restStaff,
  roleOpen,
  TIRED_DAYS,
  workSpeed,
  type StaffMember,
  type StoreState,
} from '../src/game/economy';
import { answerEvent } from '../src/game/events';
import { managerPick, orderUrgent, receiveUrgent, URGENT_FEE, urgentCost, urgentUnitPrice } from '../src/game/urgent';

const cashier: StaffMember = { role: 'cashier', name: 0, skill: 2, wage: 420, months: 1 };
const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, level: 3, staff: [cashier], ...patch });

describe('персонал — люди', () => {
  it(`без выходных ${TIRED_DAYS} дней — устаёт и работает медленнее; выходной снимает усталость`, () => {
    let s = shop();
    for (let i = 0; i < TIRED_DAYS; i++) s = restStaff({ ...s, day: s.day + 1 });
    const m = s.staff[0];
    expect(isTired(m)).toBe(true);
    expect(workSpeed(m)).toBeLessThan(workSpeed(cashier));
    s = giveDayOff(s, 'cashier')!;
    s = { ...s, day: s.day + 1 };
    expect(isAbsent(s, s.staff[0])).toBe(true);
    s = restStaff(s);
    expect(s.staff[0].streak).toBe(0);
  });

  it('просьба о выходном: отпустить — завтра не выйдет; отказать — обида', () => {
    const ask = (patch: Partial<StoreState> = {}) =>
      shop({ plan: { day: 20, decided: false, inspection: false, quests: [], event: { kind: 'dayOff', role: 'cashier', reason: 0 } }, ...patch });
    expect(answerEvent(ask(), true)!.staff[0].offDay).toBe(21);
    expect(answerEvent(ask(), false)!.staff[0].upset).toBe(true);
  });

  it('отпроситься сегодня: отпустить — сегодня его нет', () => {
    const s = shop({ plan: { day: 20, decided: false, inspection: false, quests: [], event: { kind: 'goHome', role: 'cashier', reason: 1 } } });
    const r = answerEvent(s, true)!;
    expect(isAbsent(r, r.staff[0])).toBe(true);
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

describe('срочный подвоз', () => {
  it('дороже обычного, платится сразу, товар приезжает потом', () => {
    const s = shop({ warehouse: {}, shelves: [{ kind: 'dairy', level: 0, items: {} }] });
    const unit = urgentUnitPrice(s, 'milk')!;
    expect(urgentCost(s, 'milk', 6)).toBe(unit * 6 + URGENT_FEE);
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
