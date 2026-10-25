import { describe, expect, it } from 'vitest';
import { newGame, onShelves, shelveAll, warehouseOf, type StoreState } from '../src/game/economy';
import {
  AUTO_SHARE,
  AUTO_TOPUP_MARKUP,
  AUTO_TOPUP_QTY,
  AUTO_TOPUPS,
  autoCancel,
  autoLimit,
  autoMorning,
  autoResume,
  autoReturn,
  autoSetShare,
  autoToggle,
  autoTopUp,
  migrateAutoOrder,
  topUpPrice,
} from '../src/game/autoorder';
import { restockPlan } from '../src/game/restock';
import { stockOf } from '../src/game/bakery';

const price = () => 10;
const GUESTS = 60;
const base = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 12,
  level: 2,
  money: 4000,
  warehouse: {},
  upgrades: ['autoOrder'],
  autoOrder: { on: true },
  ...patch,
});
const empty = (s: StoreState): StoreState => ({ ...s, shelves: s.shelves.map((sh) => ({ ...sh, items: {} })) });

describe('автозаказ — закупщик', () => {
  it('утром покупает то же, что «Закупить нужное», в пределах лимита', () => {
    const s = empty(base());
    const done = autoMorning(s, price, GUESTS);
    const today = done.autoOrder!.today!;
    expect(today.day).toBe(12);
    expect(today.lines.length).toBeGreaterThan(0);
    expect(today.spent).toBe(s.money - done.money);
    expect(today.spent).toBeLessThanOrEqual(Math.floor(s.money * AUTO_SHARE));
    // Без лимита купил бы те же товары.
    const plan = restockPlan(s, price, GUESTS);
    for (const line of today.lines) expect(plan.lines.some((l) => l.pid === line.pid)).toBe(true);
    // Второй раз за утро — ничего лишнего.
    const again = autoMorning(done, price, GUESTS);
    expect(again.money).toBe(done.money);
  });

  it('лимит — доля денег на утро; маленький лимит урезает закупку', () => {
    const s = empty(base({ money: 400 }));
    expect(autoLimit(s)).toBe(Math.floor(400 * AUTO_SHARE));
    const small = autoMorning(autoSetShare(s, 0.25), price, GUESTS);
    expect(small.autoOrder!.today!.spent).toBeLessThanOrEqual(100);
    expect(small.autoOrder!.today!.cut).toBe(true);
    // Подняли лимит — докупает до нового (от денег до закупки, а не от остатка).
    const more = autoMorning(autoSetShare(small, 0.75), price, GUESTS);
    expect(autoLimit(more)).toBe(300);
    expect(more.autoOrder!.today!.spent).toBeGreaterThan(small.autoOrder!.today!.spent);
    expect(more.autoOrder!.today!.spent).toBeLessThanOrEqual(300);
  });

  it('выключен или не куплен — ничего не делает', () => {
    const s = empty(base());
    expect(autoMorning(autoToggle(s), price, GUESTS)).toEqual(autoToggle(s));
    expect(autoMorning({ ...s, upgrades: [] }, price, GUESTS).money).toBe(s.money);
  });

  it('строку можно вернуть — деньги назад, сегодня её больше не докупает', () => {
    const done = shelveAll(autoMorning(empty(base()), price, GUESTS));
    const line = done.autoOrder!.today!.lines[0];
    const back = autoReturn(done, line.pid)!;
    expect(back.money).toBe(done.money + line.paid);
    expect(stockOf(back, line.pid)).toBe(stockOf(done, line.pid) - line.qty);
    expect(back.autoOrder!.today!.lines.some((l) => l.pid === line.pid)).toBe(false);
    expect(autoMorning(back, price, GUESTS).autoOrder!.today!.lines.some((l) => l.pid === line.pid)).toBe(false);
  });

  it('«Вернуть всё» отдаёт все деньги и до завтра не закупает; передумал — закупит снова', () => {
    const s = empty(base());
    const done = autoMorning(s, price, GUESTS);
    const canceled = autoCancel(done)!;
    expect(canceled.money).toBe(s.money);
    expect(canceled.autoOrder!.today!.canceled).toBe(true);
    expect(autoMorning(canceled, price, GUESTS).money).toBe(s.money);
    expect(autoTopUp(canceled, () => 5)).toBeNull();
    const resumed = autoMorning(autoResume(canceled), price, GUESTS);
    expect(resumed.money).toBe(done.money);
    // Новый день — снова сам.
    expect(autoMorning({ ...canceled, day: 13 }, price, GUESTS).money).toBeLessThan(s.money);
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
    // Уже едет — второй раз не заказывает; на складе есть — тоже.
    expect(autoTopUp(r.state, sold, [pid])).toBeNull();
    expect(autoTopUp({ ...r.state, warehouse: { bread: [{ age: 0 }] } }, sold)).toBeNull();
    // Не продаётся сегодня — не везёт.
    expect(autoTopUp(s, () => 0)).toBeNull();
    for (let i = 0; i < AUTO_TOPUPS; i++) s = autoTopUp(s, sold)!.state;
    expect(autoTopUp(s, sold)).toBeNull();
    expect(onShelves(s, pid) + warehouseOf(s, pid)).toBe(0);
  });

  it('подвоз тратит тот же лимит дня', () => {
    const s = empty(base({ money: 100 }));
    const r = autoTopUp(s, (id) => (id === 'bread' ? 3 : 0));
    // Лимит — доля от 100 монет: сколько штук на него хватит.
    expect(r).not.toBeNull();
    expect(r!.qty).toBe(Math.min(AUTO_TOPUP_QTY, Math.floor(Math.floor(100 * AUTO_SHARE) / topUpPrice('bread')!)));
    expect(r!.state.autoOrder!.today!.spent).toBe(r!.cost);
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
});
