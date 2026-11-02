import { describe, expect, it } from 'vitest';
import { newGame, onShelves, shelveAll, warehouseCapacity, warehouseCount, warehouseOf, type StoreState } from '../src/game/economy';
import {
  AUTO_FROM_DAY,
  AUTO_TOPUP_MARKUP,
  AUTO_TOPUP_QTY,
  AUTO_TOPUPS,
  autoArrived,
  autoAvailable,
  autoMorning,
  autoToggle,
  autoTopUp,
  migrateAutoOrder,
  settleInbound,
  topUpPrice,
} from '../src/game/autoorder';
import { restockPlan } from '../src/game/restock';

const price = () => 10;
const GUESTS = 60;
const base = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 12,
  level: 2,
  money: 4000,
  warehouse: {},
  autoOrder: { on: true },
  ...patch,
});
const empty = (s: StoreState): StoreState => ({ ...s, shelves: s.shelves.map((sh) => ({ ...sh, items: {} })) });

describe('«Закупать сам» — бесплатный переключатель', () => {
  it('виден с 7-го дня (или уже включён), включается и выключается бесплатно', () => {
    const fresh = { ...newGame(), day: AUTO_FROM_DAY - 1 };
    expect(autoAvailable(fresh)).toBe(false);
    expect(autoAvailable({ ...fresh, day: AUTO_FROM_DAY })).toBe(true);
    const on = autoToggle({ ...fresh, day: AUTO_FROM_DAY });
    expect(on.money).toBe(fresh.money);
    expect(on.autoOrder?.on).toBe(true);
    // Купившие старый «Автозаказ» раньше 7-го дня — переключатель у них виден.
    expect(autoAvailable({ ...fresh, autoOrder: { on: true } })).toBe(true);
  });

  it('утром покупает ровно то, что «Закупить нужное»', () => {
    const s = empty(base());
    const done = autoMorning(s, price, GUESTS);
    const today = done.autoOrder!.today!;
    expect(today.day).toBe(12);
    expect(today.spent).toBe(s.money - done.money);
    const plan = restockPlan(s, price, GUESTS);
    expect(today.lines.map((l) => [l.pid, l.qty])).toEqual(plan.lines.map((l) => [l.pid, l.qty]));
    expect(today.spent).toBe(plan.total);
    // Второй раз за утро — ничего лишнего.
    const again = autoMorning(done, price, GUESTS);
    expect(again.money).toBe(done.money);
  });

  it('утром закупает и на полки, и на склад — больше, чем влезло бы на один склад', () => {
    const more = base({ money: 100_000 });
    const s = empty({ ...more, shelves: [...more.shelves, { kind: 'dairy', level: 0, items: {} }, { kind: 'meat', level: 0, items: {} }] });
    const done = shelveAll(autoMorning(s, price, 200));
    const bought = done.autoOrder!.today!.lines.reduce((n, l) => n + l.qty, 0);
    expect(bought).toBeGreaterThan(warehouseCapacity(s));
    expect(warehouseCount(done)).toBeLessThanOrEqual(warehouseCapacity(done));
  });

  it('выключен — ничего не делает', () => {
    const s = empty(base());
    expect(autoMorning(autoToggle(s), price, GUESTS)).toEqual(autoToggle(s));
  });

  it('днём подвозит то, что покупают и что кончилось на складе, с наценкой и не больше AUTO_TOPUPS раз', () => {
    let s = empty(base());
    const pid = 'bread' as const;
    const sold = (id: string) => (id === pid ? 7 : 0);
    const r = autoTopUp(s, sold)!;
    expect(r.pid).toBe(pid);
    expect(r.qty).toBe(AUTO_TOPUP_QTY);
    expect(r.cost).toBe(AUTO_TOPUP_QTY * topUpPrice(pid)!);
    expect(topUpPrice(pid)! / AUTO_TOPUP_MARKUP).toBeGreaterThan(0);
    expect(r.state.money).toBe(s.money - r.cost);
    expect(r.state.autoOrder!.today!.spent).toBe(r.cost);
    // Уже едет — второй раз не заказывает; на складе есть — тоже.
    expect(autoTopUp(r.state, sold, [pid])).toBeNull();
    expect(autoTopUp({ ...r.state, warehouse: { bread: [{ age: 0 }] } }, sold)).toBeNull();
    // Не продаётся сегодня — не везёт.
    expect(autoTopUp(s, () => 0)).toBeNull();
    for (let i = 0; i < AUTO_TOPUPS; i++) s = autoTopUp(s, sold)!.state;
    expect(autoTopUp(s, sold)).toBeNull();
    expect(onShelves(s, pid) + warehouseOf(s, pid)).toBe(0);
  });

  it('денег мало — подвозит, сколько хватает', () => {
    const s = empty(base({ money: 100 }));
    const r = autoTopUp(s, (id) => (id === 'bread' ? 3 : 0))!;
    expect(r.qty).toBe(Math.min(AUTO_TOPUP_QTY, Math.floor(100 / topUpPrice('bread')!)));
  });

  it('подвоз в пути: приехал — вычеркнут; закрыли игру, пока ехал, — при загрузке на складе', () => {
    const s = empty(base());
    const r = autoTopUp(s, (id) => (id === 'bread' ? 4 : 0))!;
    expect(r.state.autoOrder!.today!.inbound).toEqual([{ pid: 'bread', qty: r.qty }]);
    const arrived = autoArrived(r.state, 'bread', r.qty);
    expect(arrived.autoOrder!.today!.inbound).toEqual([]);
    expect(warehouseOf(arrived, 'bread')).toBe(r.qty);
    const loaded = settleInbound(r.state);
    expect(warehouseOf(loaded, 'bread')).toBe(r.qty);
    expect(settleInbound(loaded)).toBe(loaded);
  });
});

describe('старые сохранения', () => {
  it('список автозаказа и закупки «как в прошлый раз» убираются, «включён» остаётся', () => {
    const old = { ...base(), autoOrder: { on: true, lines: [{ sid: 'farmer', pid: 'milk', qty: 5 }] }, purchases: [{ day: 3, lines: [] }] } as unknown as StoreState;
    const s = migrateAutoOrder(old) as StoreState & { purchases?: unknown };
    expect(s.autoOrder).toEqual({ on: true });
    expect(s.purchases).toBeUndefined();
    const fresh = base();
    expect(migrateAutoOrder(fresh)).toBe(fresh);
  });

  it('лимит, отмена и возвраты (до 02.11) забываются, купленное сегодня и подвоз в пути — остаются', () => {
    const today = { day: 12, base: 900, spent: 300, lines: [{ sid: 'farmer', pid: 'bread', qty: 5, paid: 100 }], topUps: 1, canceled: false, skip: ['milk'], inbound: [{ pid: 'bread', qty: 6 }] };
    const old = { ...base(), autoOrder: { on: true, share: 0.5, today } } as unknown as StoreState;
    const s = migrateAutoOrder(old);
    expect(s.autoOrder).toEqual({ on: true, today: { day: 12, spent: 300, lines: today.lines, topUps: 1, inbound: today.inbound } });
  });
});
