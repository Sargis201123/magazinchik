import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { bestOffer, restockPlan, restockTarget } from '../src/game/restock';

const start = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 5000, ...patch });

describe('«Закупить нужное»', () => {
  it('берёт у того, у кого дешевле', () => {
    const s = start();
    const price = (sid: string) => (sid === 'dairy' ? 30 : 40);
    expect(bestOffer(s, 'milk', price)).toEqual({ sid: 'dairy', price: 30 });
    // Оптовик закрыт, пока нет полки его отдела: его цену не берём даже самую низкую.
    expect(bestOffer(s, 'milk', (sid) => (sid === 'wholesale' ? 1 : 40))?.sid).not.toBe('wholesale');
  });

  it('цель — по модели спроса и по продажам (что больше), с запасом, но не больше места на полках', () => {
    const s = start();
    const base = restockTarget(s, 'bread', 30);
    expect(base).toBeGreaterThan(0);
    // Больше гостей — больше нужно.
    expect(restockTarget(s, 'bread', 60)).toBeGreaterThanOrEqual(base);
    const report = (n: number) => start({ reports: [{ day: 1, sold: { bread: n }, missing: {} }] as unknown as StoreState['reports'] });
    // Продавали много — берём не меньше обычных продаж с запасом.
    expect(restockTarget(report(10), 'bread', 1)).toBeGreaterThanOrEqual(12);
    // Но и не больше, чем встанет на полки плюс пара походов со склада.
    expect(restockTarget(report(500), 'bread', 1)).toBeLessThan(500);
  });

  it('заказ дня и договор с кафе докупаются сверху', () => {
    // Склад побольше, чтобы всё влезло.
    const s = start({ level: 2 });
    const plain = restockPlan(s, () => 10, 30).lines.find((l) => l.pid === 'bread')?.qty ?? 0;
    const withCafe = restockPlan({ ...s, cafe: { deal: { items: { bread: 7 } } } } as unknown as StoreState, () => 10, 30).lines.find((l) => l.pid === 'bread')?.qty ?? 0;
    expect(withCafe).toBe(plain + 7);
  });

  it('докупает только недостающее, сначала самое пустое, в пределах денег', () => {
    const s = start();
    const plan = restockPlan(s, () => 10, 30);
    expect(plan.lines.length).toBeGreaterThan(0);
    for (const line of plan.lines) expect(line.qty).toBeGreaterThan(0);
    expect(plan.total).toBe(plan.lines.reduce((sum, l) => sum + l.qty * l.price, 0));
    const poor = restockPlan({ ...s, money: 25 }, () => 10, 30);
    expect(poor.total).toBeLessThanOrEqual(25);
    expect(poor.cut).toBe(true);
  });
});

import { onShelves, shelveAll, warehouseCapacity, warehouseCount } from '../src/game/economy';
import { applyReorder, buyLine } from '../src/game/reorder';
import { shelfRoom } from '../src/game/restock';
import { stockOf } from '../src/game/bakery';

describe('«Закупить нужное» за одно нажатие', () => {
  // Пустые полки и склад: купленное сразу встаёт на полки, склад нужен только под остаток.
  const bare = (patch: Partial<StoreState> = {}): StoreState => {
    const s = start({ level: 1, warehouse: {}, ...patch });
    return { ...s, shelves: s.shelves.map((sh) => ({ ...sh, items: {} })) };
  };
  const press = (s: StoreState) => shelveAll(applyReorder(s, restockPlan(s, () => 10, 40), () => false).state);

  it('место — свободный склад плюс свободные полки своего отдела: берёт больше, чем влезло бы на склад', () => {
    const s = bare();
    const plan = restockPlan(s, () => 10, 40);
    const qty = plan.lines.reduce((n, l) => n + l.qty, 0);
    expect(qty).toBeGreaterThan(warehouseCapacity(s));
    expect(plan.cut).toBe(false);
  });

  it('одно нажатие — и на полки, и на склад: второй раз докупать нечего', () => {
    const s = bare();
    const once = press(s);
    expect(restockPlan(once, () => 10, 40).lines).toHaveLength(0);
    // Всё купленное на месте: на полках и складе, ничего не потерялось.
    const plan = restockPlan(s, () => 10, 40);
    for (const l of plan.lines) expect(stockOf(once, l.pid)).toBe(l.qty);
    expect(once.money).toBe(s.money - plan.total);
    expect(warehouseCount(once)).toBeLessThanOrEqual(warehouseCapacity(once));
  });

  it('«не влезет» — только когда правда нет места: склад занят, на полке — четыре свободных места', () => {
    const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
    const s = bare();
    const packed: StoreState = {
      ...s,
      // Склад забит порошком (его полки нет), хлебная полка — без четырёх буханок, овощная — полная.
      warehouse: { detergent: units(warehouseCapacity(s)) },
      shelves: s.shelves.map((sh) => (sh.kind === 'bakery' ? { ...sh, items: { bread: units(4) } } : sh.kind === 'produce' ? { ...sh, items: { apples: units(4), potatoes: units(4) } } : sh)),
    };
    expect(shelfRoom(packed, 'bakery')).toBe(4);
    expect(shelfRoom(packed, 'produce')).toBe(0);
    const plan = restockPlan(packed, () => 10, 40);
    expect(plan.lines.map((l) => [l.pid, l.qty])).toEqual([['bread', 4]]);
    expect(plan.cut).toBe(true);
    expect(plan.short).toBe('room');
    // Бракованная партия на складе ждёт решения — её на полки не разложат, место она не освобождает.
    const pending = { ...packed, warehouse: { detergent: units(warehouseCapacity(s) - 2), bread: [{ age: 0, bad: true, pending: true }, { age: 0, bad: true, pending: true }] } };
    expect(shelfRoom(pending, 'bakery')).toBe(4);
  });

  it('не хватило денег — так и сказано: «денег», а не «места»', () => {
    const poor = restockPlan(bare({ money: 30 }), () => 10, 60);
    expect(poor.cut).toBe(true);
    expect(poor.short).toBe('money');
    expect(poor.total).toBeLessThanOrEqual(30);
  });

  it('строка больше склада покупается частями; брак ждёт решения на складе и на полки не идёт', () => {
    const s = bare();
    const room = warehouseCapacity(s) - warehouseCount(s);
    const line = { sid: 'farmer' as const, pid: 'bread' as const, qty: room + 5, price: 10 };
    const good = buyLine(s, line);
    expect(good.qty).toBe(room + 5);
    expect(good.bad).toBe(0);
    expect(onShelves(good.state, 'bread') + (good.state.warehouse.bread?.length ?? 0)).toBe(room + 5);
    // Бракованная — только та часть, что целиком на складе: её можно уценить или вернуть.
    const bad = buyLine(s, line, true);
    expect(bad.bad).toBeGreaterThan(0);
    expect(bad.state.warehouse.bread!.filter((u) => u.pending)).toHaveLength(bad.bad);
    expect(bad.state.shelves.every((sh) => (sh.items.bread ?? []).every((u) => !u.pending))).toBe(true);
  });
});
