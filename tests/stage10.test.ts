import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, servePerDay, cashierScan, type StaffMember, type StoreState } from '../src/game/economy';
import { lossAdvice, noteLost } from '../src/game/losses';
import { applyReorder } from '../src/game/reorder';
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
    // За первой кассой — хозяин. В ларьке касса одна: некому подменить, пока хозяин в зале, — сменщик.
    expect(key(rich({ level: 0 }))).toBe('loss.queue.hire');
    expect(key(rich())).toBe('loss.queue.buy');
    // Ур. 3 (индекс 2): место под две кассы. Стоит одна — поставить вторую; вторая без кассира — нанять;
    // обе заняты — сменщик, а с ним — расширяться (будет место под третью).
    expect(key(rich({ level: 2, staff: [member()] }))).toBe('loss.queue.buy');
    const two = rich({ level: 2, registers: 2, staff: [member()] });
    expect(key(two)).toBe('loss.queue.hire2');
    expect(key({ ...two, staff: [member({ role: 'cashier2' })] })).toBe('loss.queue.hire');
    expect(key({ ...two, staff: [member(), member({ role: 'cashier2' })] })).toBe('loss.queue.register');
    // Универмаг: четыре кассы, все с кассирами — остаётся учить.
    const all = rich({ level: 4, registers: 4, staff: ['cashier', 'cashier2', 'cashier3', 'cashier4'].map((role) => member({ role: role as 'cashier' })) });
    expect(key(all)).toBe('loss.queue.train');
  });
});

describe('закупка по плану', () => {
  it('урезанная по деньгам строка покупается, брак — не больше одной строки', () => {
    const plan = {
      lines: [
        { sid: 'farmer' as const, pid: 'bread' as const, qty: 2, price: 10 },
        { sid: 'dairy' as const, pid: 'milk' as const, qty: 2, price: 10 },
      ],
      total: 40,
      cut: false,
    };
    const s = rich({ day: 6 });
    const done = applyReorder(s, plan, () => true);
    expect(done.badLine?.pid).toBe('bread');
    expect(done.state.money).toBe(s.money - 40);
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
