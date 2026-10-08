import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, servePerDay, cashierScan, type StaffMember, type StoreState } from '../src/game/economy';
import { lossAdvice, noteLost } from '../src/game/losses';
import { applyReorder, previousOrder, recordPurchase, reorderPlan } from '../src/game/reorder';
import { SLOWPOKE_FIX_COST, train, trainingCost, TRAINING_COST } from '../src/game/staff';

const rich = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 10000, level: 3, ...patch });
const member = (patch: Partial<StaffMember> = {}): StaffMember => ({ role: 'cashier', name: 0, skill: 1, wage: 360, months: 0, ...patch });

describe('куда ушли покупатели', () => {
  it('считает причины и товары, советы — по убыванию', () => {
    const stats = emptyDayStats();
    noteLost(stats, 'queue');
    noteLost(stats, 'queue');
    noteLost(stats, 'empty', 'milk');
    noteLost(stats, 'empty', 'milk');
    noteLost(stats, 'empty', 'meat');
    noteLost(stats, 'expensive', 'bread');
    const advice = lossAdvice(stats, rich());
    expect(advice.map((a) => [a.reason, a.count])).toEqual([
      ['empty', 3],
      ['queue', 2],
      ['expensive', 1],
    ]);
    expect(advice[0].params.list).toBe('🥛🥩');
    expect(advice[2].params.list).toBe('🍞');
  });

  it('совет по очереди зависит от того, что уже есть', () => {
    const stats = emptyDayStats();
    noteLost(stats, 'queue');
    const key = (s: StoreState) => lossAdvice(stats, s)[0].key;
    expect(key(rich())).toBe('loss.queue.hire');
    // Ур. 3 (индекс 2): две кассы. Свободна вторая — нанять; обе заняты — расширяться (будет третья).
    const two = rich({ level: 2, staff: [member()] });
    expect(key(two)).toBe('loss.queue.hire2');
    expect(key({ ...two, staff: [member(), member({ role: 'cashier2' })] })).toBe('loss.queue.register');
    // Универмаг: четыре кассы, все с кассирами — остаётся учить.
    const all = rich({ level: 4, staff: ['cashier', 'cashier2', 'cashier3', 'cashier4'].map((role) => member({ role: role as 'cashier' })) });
    expect(key(all)).toBe('loss.queue.train');
  });
});

describe('как в прошлый раз', () => {
  const price = () => 10;

  it('помнит закупку и повторяет её на следующий день', () => {
    let s = recordPurchase(rich({ day: 5 }), 'farmer', 'bread', 5);
    s = recordPurchase(s, 'farmer', 'bread', 5);
    s = recordPurchase(s, 'dairy', 'milk', 4);
    expect(previousOrder(s)).toBeNull();
    const tomorrow = { ...s, day: 6 };
    expect(previousOrder(tomorrow)!.lines).toEqual([
      { sid: 'farmer', pid: 'bread', qty: 10 },
      { sid: 'dairy', pid: 'milk', qty: 4 },
    ]);
    const plan = reorderPlan(tomorrow, price)!;
    expect(plan.total).toBe(140);
    const done = applyReorder(tomorrow, plan, () => false);
    expect(done.state.money).toBe(tomorrow.money - 140);
    expect(done.state.warehouse.milk).toHaveLength((tomorrow.warehouse.milk?.length ?? 0) + 4);
    // Повтор — тоже закупка сегодняшнего дня.
    expect(done.state.purchases!.find((d) => d.day === 6)!.lines).toHaveLength(2);
  });

  it('урезает по деньгам и складу; брак — не больше одной строки', () => {
    const s = { ...recordPurchase(rich({ day: 5 }), 'farmer', 'bread', 30), day: 6, money: 100 };
    const plan = reorderPlan(s, price)!;
    expect(plan.cut).toBe(true);
    expect(plan.lines[0].qty).toBe(10);
    const two = { ...recordPurchase(recordPurchase(rich({ day: 5 }), 'farmer', 'bread', 2), 'dairy', 'milk', 2), day: 6 };
    const done = applyReorder(two, reorderPlan(two, price)!, () => true);
    expect(done.badLine?.pid).toBe('bread');
    expect(done.state.warehouse.milk!.every((u) => !u.pending)).toBe(true);
  });
});

describe('обучение персонала', () => {
  it('курсы поднимают навык и скорость, на 3★ лечат «тормоза»', () => {
    const slow = member({ trait: 'slowpoke' });
    let s = rich({ staff: [slow] });
    expect(trainingCost(slow)).toBe(TRAINING_COST[0]);
    s = train(s, 'cashier')!;
    expect(s.staff[0].skill).toBe(2);
    s = train(s, 'cashier')!;
    expect(s.staff[0].skill).toBe(3);
    expect(trainingCost(s.staff[0])).toBe(SLOWPOKE_FIX_COST);
    const before = servePerDay(cashierScan(s.staff[0]));
    s = train(s, 'cashier')!;
    expect(s.staff[0].trait).toBeUndefined();
    expect(servePerDay(cashierScan(s.staff[0]))).toBeGreaterThan(before);
    expect(train(s, 'cashier')).toBeNull();
    expect(s.money).toBe(10000 - TRAINING_COST[0] - TRAINING_COST[1] - SLOWPOKE_FIX_COST);
  });

  it('без денег не учат', () => {
    expect(train(rich({ money: 0, staff: [member()] }), 'cashier')).toBeNull();
  });
});
