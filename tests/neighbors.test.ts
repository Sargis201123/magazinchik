import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { canSend, declineOrder, makeOrder, neighborsMorning, neighborsOf, NEIGHBORS_FROM_DAY, repOf, sendOrder } from '../src/game/neighbors';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const always = () => 0;

describe('заявки соседей', () => {
  it('до своего дня заявок нет, потом приходят (не больше двух)', () => {
    const early = neighborsMorning({ ...newGame(), day: NEIGHBORS_FROM_DAY - 1 }, always);
    expect(early.neighbors).toBeUndefined();
    let s = { ...newGame(), day: NEIGHBORS_FROM_DAY };
    for (let i = 0; i < 5; i++) s = neighborsMorning({ ...s, day: NEIGHBORS_FROM_DAY }, always);
    const orders = neighborsOf(s).orders;
    expect(orders.length).toBe(2);
    expect(new Set(orders.map((o) => o.from)).size).toBe(2);
    expect(orders.every((o) => o.due >= NEIGHBORS_FROM_DAY + 2 && o.pay > 0)).toBe(true);
  });

  it('отправка: товар уходит, деньги приходят, репутация растёт', () => {
    const fresh = newGame();
    const base = { ...fresh, day: 10, warehouse: {}, shelves: fresh.shelves.map((sh) => ({ ...sh, items: {} })) };
    const order = makeOrder(base, 'school', always)!;
    expect(order).not.toBeNull();
    const s = { ...base, neighbors: { rep: {}, orders: [order], next: 2 } };
    expect(canSend(s, order)).toBe(false);
    const stocked = { ...s, warehouse: Object.fromEntries(order.items.map(({ product, qty }) => [product, units(qty)])) };
    expect(canSend(stocked, order)).toBe(true);
    const sent = sendOrder(stocked, order.id)!;
    expect(sent.money).toBe(stocked.money + order.pay);
    expect(repOf(sent, 'school')).toBe(1);
    expect(neighborsOf(sent).orders).toEqual([]);
    expect(order.items.every(({ product }) => (sent.warehouse[product]?.length ?? 0) === 0)).toBe(true);
  });

  it('просрочка — репутация падает; отказ — без штрафа', () => {
    const base = { ...newGame(), day: 10 };
    const order = { ...makeOrder(base, 'dorm', always)!, due: 9 };
    const s = { ...base, neighbors: { rep: { dorm: 3 }, orders: [order], next: 2 } };
    const after = neighborsMorning(s, () => 0.99);
    expect(repOf(after, 'dorm')).toBe(2);
    expect(neighborsOf(after).expired).toEqual(['dorm']);
    const declined = declineOrder({ ...s, neighbors: { ...s.neighbors, orders: [{ ...order, due: 12 }] } }, order.id);
    expect(repOf(declined, 'dorm')).toBe(3);
    expect(neighborsOf(declined).orders).toEqual([]);
  });

  it('с репутацией заказы крупнее и дороже', () => {
    const base = { ...newGame(), day: 10 };
    const plain = makeOrder(base, 'school', always)!;
    const loved = makeOrder({ ...base, neighbors: { rep: { school: 10 }, orders: [], next: 1 } }, 'school', always)!;
    const qty = (o: typeof plain) => o.items.reduce((sum, i) => sum + i.qty, 0);
    expect(qty(loved)).toBeGreaterThan(qty(plain));
    expect(loved.pay).toBeGreaterThan(plain.pay);
  });
});
