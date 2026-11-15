// Кухня сама и живой повар; видно, что делает менеджер зала (15.11, задача #69).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, MANAGER_BOOST, newGame, wageFor, type StaffMember, type StoreState } from '../src/game/economy';
import {
  cookBatch,
  foodSlots,
  MORNING_ROUNDS,
  morningCook,
  openingPortions,
  pantryOf,
  portionsTotal,
  stockKitchen,
  stovePots,
  autoCook,
  toggleSelfCook,
} from '../src/game/kitchen';
import { fasterServed, managerNight, urgentSaving } from '../src/game/managerLog';
import { topUpPrice } from '../src/game/autoorder';
import { MANAGER_QTY, urgentUnitPrice } from '../src/game/urgent';
import { nightCycle } from '../src/game/day';
import { simulate } from '../src/game/simulate';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const member = (role: StaffMember['role'], extra: Partial<StaffMember> = {}): StaffMember => ({ role, name: 3, skill: 2, wage: wageFor(role, 2), months: 0, ...extra });
const demand = (wanted: number): Partial<StoreState> => ({
  reports: [{ day: 1, revenue: 0, served: 0, lost: 0, sold: {}, spoiled: {}, pricey: {}, missing: {}, kitchen: { sold: wanted, wanted, spoiled: 0 } }],
});
const kitchen = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  shelves: newGame().shelves.map((sh) => ({ ...sh, items: {} })),
  level: 3,
  day: 20,
  money: 5000,
  upgrades: ['kitchen'],
  warehouse: {},
  staff: [member('cook')],
  ...demand(12),
  ...patch,
});

describe('повар варит до открытия, как пекарь', () => {
  it('к открытию на полке порции — на первую часть дня, продукты кухня докупает из кассы', () => {
    const s = stockKitchen(kitchen()).state;
    const early = morningCook(s);
    expect(early.portions).toBeGreaterThan(0);
    expect(portionsTotal(early.state)).toBe(early.portions);
    // Не больше, чем возьмут за утро с запасом в одну закладку, и не больше полки.
    expect(early.portions).toBeLessThanOrEqual(foodSlots(s));
    expect(early.dishes.length).toBeLessThanOrEqual(MORNING_ROUNDS * stovePots(s));
    // Склад магазина не тронут: всё из кладовой кухни, деньги не уходят в минус.
    expect(early.state.money).toBeGreaterThanOrEqual(0);
    expect(early.state.money).toBe(s.money - early.spent);
  });

  it('пустая кладовая: кухня докупает к утренним закладкам и считает это в расходы', () => {
    const s = kitchen({ pantry: {} });
    const early = morningCook(s);
    expect(early.portions).toBeGreaterThan(0);
    expect(early.spent).toBeGreaterThan(0);
    expect(early.state.money).toBe(5000 - early.spent);
  });

  it('детерминировано: одно и то же утро — одни и те же блюда', () => {
    const s = stockKitchen(kitchen()).state;
    expect(morningCook(s).dishes).toEqual(morningCook(s).dishes);
    expect(morningCook(s).portions).toBe(morningCook(s).portions);
  });

  it('без повара, без кухни, без денег — ничего не варит и ничего не тратит', () => {
    expect(morningCook(kitchen({ staff: [] })).portions).toBe(0);
    expect(morningCook(kitchen({ upgrades: [] })).portions).toBe(0);
    const broke = morningCook(kitchen({ money: 0, pantry: {} }));
    expect(broke.portions).toBe(0);
    expect(broke.spent).toBe(0);
  });

  it('полка уже полна (холодильник сохранил с вечера) — утром не варит лишнего', () => {
    const s = kitchen({ kitchen: { borscht: foodSlots(kitchen()) } });
    expect(morningCook(stockKitchen(s).state).portions).toBe(0);
  });

  it('днём он продолжает: после утренних закладок до конца дня ещё есть что сварить', () => {
    const s = morningCook(stockKitchen(kitchen()).state).state;
    // Сразу после открытия (готово через ~30% дня) повару есть что ставить — он не стоит столбом.
    expect(cookBatch(s, 1, 0.3, undefined, true).length).toBeGreaterThan(0);
  });

  it('утренние закладки входят в утреннюю закупку кухни: докупать к ним не приходится', () => {
    const s = stockKitchen(kitchen()).state;
    const early = morningCook(s);
    expect(early.portions).toBeGreaterThan(0);
    expect(early.spent).toBe(0);
  });

  it('утреннее меню показывает, что будет на полке к открытию (без касаний)', () => {
    const s = kitchen();
    expect(openingPortions(s)).toBe(morningCook(stockKitchen(s).state).portions);
    expect(openingPortions(s)).toBeGreaterThan(0);
    // Без повара — что сварит сама кухня из продуктов магазина; выключили — ноль.
    const self = kitchen({ staff: [], warehouse: { potatoes: units(10), meat: units(3), milk: units(6), apples: units(2), bread: units(2) } });
    expect(openingPortions(self)).toBe(autoCook(self).portions);
    expect(openingPortions(self)).toBeGreaterThan(0);
    expect(openingPortions(toggleSelfCook(self))).toBe(0);
    expect(openingPortions(kitchen({ upgrades: [] }))).toBe(0);
  });
});

describe('менеджер зала: что сделал вчера и за всё время', () => {
  const withMgr = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), level: 3, day: 30, staff: [member('cashier'), member('manager')], ...patch });

  it('ночью дела дня ложатся в его карточку: вчера и сумма', () => {
    let s = managerNight(withMgr(), { calls: 3, parcels: 2, urgent: 1, saved: 120 }, 99);
    const m = s.staff.find((x) => x.role === 'manager')!;
    expect(m.mgr!.last).toEqual({ day: 30, calls: 3, parcels: 2, urgent: 1, saved: 120, faster: fasterServed(99) });
    expect(m.mgr!.shifts).toBe(1);
    s = managerNight({ ...s, day: 31 }, { calls: 1 }, 50);
    const again = s.staff.find((x) => x.role === 'manager')!.mgr!;
    expect(again.last).toEqual({ day: 31, calls: 1, parcels: 0, urgent: 0, saved: 0, faster: fasterServed(50) });
    expect(again.total).toEqual({ calls: 4, parcels: 2, urgent: 1, saved: 120, faster: fasterServed(99) + fasterServed(50) });
    expect(again.shifts).toBe(2);
    // Кассира это не касается.
    expect(s.staff.find((x) => x.role === 'cashier')!.mgr).toBeUndefined();
  });

  it('нет менеджера — состояние не меняется', () => {
    const s = withMgr({ staff: [member('cashier')] });
    expect(managerNight(s, { calls: 5 }, 100)).toBe(s);
  });

  it('«касса быстрее ≈ на N»: столько прошло сверх того, что пробили бы без его +10%', () => {
    expect(fasterServed(0)).toBe(0);
    expect(fasterServed(110)).toBe(Math.round(110 - 110 / MANAGER_BOOST));
    expect(fasterServed(99)).toBe(9);
  });

  it('экономия срочного подвоза — против цены автозаказа, без минусов', () => {
    const s = withMgr();
    const saved = urgentSaving(s, 'milk', MANAGER_QTY);
    expect(saved).toBe((topUpPrice('milk')! - urgentUnitPrice(s, 'milk')!) * MANAGER_QTY);
    expect(saved).toBeGreaterThan(0);
  });

  it('nightCycle сам пишет итог менеджера из статистики дня', () => {
    const night = nightCycle(withMgr(), { ...emptyDayStats(), served: 44, mgr: { calls: 2, parcels: 1 } }, () => 0.5);
    const log = night.state.staff.find((x) => x.role === 'manager')!.mgr!;
    expect(log.last).toMatchObject({ calls: 2, parcels: 1, urgent: 0, faster: fasterServed(44) });
  });
});

describe('баланс и старые сохранения', () => {
  it('симулятор с кухней работает, утренние закладки не ломают деньги', () => {
    const { days } = simulate({ days: 40, seed: 3, features: { kitchen: true, coffee: true, oven: true } });
    expect(days.length).toBe(40);
    expect(days.at(-1)!.money).toBeGreaterThan(0);
  });

  describe('загрузка', () => {
    let local: Record<string, string> = {};
    beforeEach(() => {
      vi.resetModules();
      local = {};
      Object.assign(globalThis, {
        localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
      });
    });
    afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

    it('старое сохранение без журнала менеджера грузится как было, журнал появится после смены', async () => {
      const { loadGame } = await import('../src/game/save');
      const old = { ...newGame(), level: 3, staff: [member('manager'), member('cook')], upgrades: ['kitchen'] } as unknown as Record<string, unknown>;
      local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
      const s = loadGame()!;
      const m = s.staff.find((x) => x.role === 'manager')!;
      expect(m.mgr).toBeUndefined();
      expect(pantryOf(s, 'meat')).toBe(0);
      expect(managerNight(s, undefined, 10).staff.find((x) => x.role === 'manager')!.mgr!.shifts).toBe(1);
    });

    it('журнал менеджера переживает сохранение', async () => {
      const { loadGame, saveGame } = await import('../src/game/save');
      const s = managerNight({ ...newGame(), level: 3, staff: [member('manager')] }, { calls: 2, urgent: 1, saved: 40 }, 30);
      saveGame(s);
      expect(loadGame()!.staff[0].mgr).toEqual(s.staff[0].mgr);
    });
  });
});
