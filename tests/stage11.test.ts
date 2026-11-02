import { describe, expect, it } from 'vitest';
import { emptyDayStats, expiringCount, newGame, type StoreState } from '../src/game/economy';
import { daysToFair, isFairDay, stallSale, STALL_MARKUP } from '../src/game/fair';
import { ensureWeekly, progressWeekly } from '../src/game/weekly';
import { pendingTip, seeTip } from '../src/game/tips';
import { planDay } from '../src/game/events';
import { carryOf, CART_CARRY } from '../src/game/upgrades';

const rich = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 10000, level: 3, ...patch });

describe('уценка того, что испортится ночью', () => {
  it('считает только старое и не уценённое', () => {
    const s = rich({ warehouse: { bread: [{ age: 1 }, { age: 0 }], potatoes: [{ age: 6 }] } });
    expect(expiringCount(s)).toBe(2);
    expect(expiringCount({ ...s, warehouse: { bread: [{ age: 1, markdown: true }] } })).toBe(0);
  });
});

describe('ярмарка', () => {
  it('раз в месяц, на пятый день, не в праздник', () => {
    const fairs = Array.from({ length: 112 }, (_, i) => i + 1).filter(isFairDay);
    expect(fairs.length).toBeGreaterThan(10);
    for (const d of fairs) expect(((d - 1) % 7) + 1).toBe(5);
    expect(daysToFair(fairs[1] - 2)).toBe(2);
    // Лишних гостей нет (касса и так не успевает) — зато лоток продаёт со склада с наценкой.
    const s = rich({ day: fairs[1], warehouse: { bread: [{ age: 0 }] } });
    const sale = stallSale(s, () => 0)!;
    expect(sale.price).toBe(Math.round(40 * STALL_MARKUP));
    expect(sale.state.warehouse.bread).toHaveLength(0);
    expect(sale.state.money).toBe(s.money + sale.price);
    expect(stallSale(sale.state, () => 0)).toBeNull();
  });
});

describe('испытания недели', () => {
  it('три цели, прогресс копится по дням, награда — сразу', () => {
    const s = ensureWeekly(rich({ day: 8 }), 60);
    expect(s.weekly!.challenges).toHaveLength(3);
    const stats = { ...emptyDayStats(), served: 1000, revenue: 100000, caught: 10, trashCleaned: 100, sold: { bread: 500, apples: 500, potatoes: 500, milk: 500, meat: 500 } };
    const r = progressWeekly(s, stats);
    expect(r.completed.length).toBeGreaterThan(0);
    expect(r.state.money).toBe(s.money + r.earned);
    // Уже выполненное второй раз не платит.
    expect(progressWeekly(r.state, stats).earned).toBeLessThanOrEqual(r.earned);
  });
});

describe('Эдуард доносит', () => {

  it('донос — внеплановая проверка', () => {
    const days = Array.from({ length: 300 }, (_, i) => i + 14);
    const plan = days.map((day) => planDay(rich({ day }))).find((p) => p.event?.kind === 'snitch');
    expect(plan?.inspection).toBe(true);
  });
});

describe('рохля на складе и подсказки', () => {
  it('со складом с рохлей несут больше (раньше — улучшение «Тележки»)', () => {
    expect(carryOf(rich({ gear: { warehouse: 1 } }))).toBe(CART_CARRY);
    expect(carryOf(rich({ gear: {} }))).toBeLessThan(CART_CARRY);
  });

  it('подсказки показываются по одной и один раз', () => {
    const s = rich({ day: 6, upgrades: ['oven'] });
    const first = pendingTip(s)!;
    expect(first).toBeTruthy();
    expect(pendingTip(seeTip(s, first))).not.toBe(first);
  });
});

import { makeHomeOrder, packHomeOrder, DELIVERY_FEE } from '../src/game/delivery';
import { recordDay, liveProgress, unlockAchievements } from '../src/game/achievements';

describe('доставка на дом', () => {
  it('заказ из того, что есть; собирают со склада, потом с полок', () => {
    const s = rich({ warehouse: { bread: [{ age: 0 }] }, shelves: [{ kind: 'bakery', level: 0, items: { bread: [{ age: 1 }, { age: 0 }] } }] });
    const order = { items: [{ id: 'bread' as const, qty: 3 }], pay: 3 * 40 + DELIVERY_FEE };
    const packed = packHomeOrder(s, order)!;
    expect(packed.warehouse.bread).toHaveLength(0);
    expect(packed.shelves[0].items.bread).toHaveLength(0);
    expect(packHomeOrder(s, { ...order, items: [{ id: 'bread', qty: 4 }] })).toBeNull();
    const made = makeHomeOrder(s, () => 0.3)!;
    expect(made.pay).toBeGreaterThan(DELIVERY_FEE);
    expect(makeHomeOrder(rich({ warehouse: {}, shelves: [] }), () => 0.3)).toBeNull();
  });
});

describe('новые достижения', () => {
  it('счётчики копятся по дням и открывают значки', () => {
    let s = rich();
    s = recordDay(s, { ...emptyDayStats(), coffees: 60, burnt: 1, mice: 5, fair: true });
    s = recordDay(s, { ...emptyDayStats(), coffees: 50, nightRevenue: 100 });
    const { unlocked } = unlockAchievements(liveProgress(s));
    expect(unlocked).toEqual(expect.arrayContaining(['burnt_bread', 'coffee_100', 'mouse_5']));
    expect(unlocked).not.toContain('night_owl');
    expect(s.lifetime.nights).toBe(1);
  });
});
