import { describe, expect, it } from 'vitest';
import { checkout, emptyDayStats, expiringCount, markdownExpiring, newGame, unitSalePrice, type StoreState } from '../src/game/economy';
import { activePromo, promoDemand, setPromo } from '../src/game/promo';
import { cancelContract, contractOf, deliverContracts, signContract } from '../src/game/contracts';
import { daysToFair, isFairDay } from '../src/game/fair';
import { ensureWeekly, progressWeekly } from '../src/game/weekly';
import { pendingTip, seeTip } from '../src/game/tips';
import { answerEvent, planDay } from '../src/game/events';
import { carryOf, CART_CARRY } from '../src/game/upgrades';
import { guestFactor } from '../src/game/day';

const rich = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 10000, level: 3, ...patch });

describe('акция дня', () => {
  it('−20% меняет цену, «2=1» — вторая штука бесплатно; повтор отменяет', () => {
    const s = setPromo(rich(), 'bread', 'discount');
    expect(unitSalePrice(s, 'bread', { age: 0 })).toBe(32);
    expect(promoDemand(s, 'bread')).toBeGreaterThan(1);
    expect(guestFactor(s)).toBeGreaterThan(guestFactor(rich()));
    expect(activePromo(setPromo(s, 'bread', 'discount'))).toBeUndefined();
    expect(activePromo({ ...s, day: s.day + 1 })).toBeUndefined();
    const total = checkout(rich(), [{ id: 'bread', unit: { age: 0 } }, { id: 'bread', unit: { age: 0 }, free: true }]).total;
    expect(total).toBe(40);
  });
});

describe('уценка того, что испортится ночью', () => {
  it('уценивает только старое', () => {
    const s = rich({ warehouse: { bread: [{ age: 1 }, { age: 0 }], potatoes: [{ age: 6 }] } });
    expect(expiringCount(s)).toBe(2);
    const done = markdownExpiring(s);
    expect(done.count).toBe(2);
    expect(done.state.warehouse.bread![0].markdown).toBe(true);
    expect(done.state.warehouse.bread![1].markdown).toBeUndefined();
    expect(expiringCount(done.state)).toBe(0);
  });
});

describe('договор с поставщиком', () => {
  it('везут каждое утро со скидкой, до конца срока; можно расторгнуть', () => {
    let s = signContract(rich({ day: 10 }), 'farmer', 'bread', 10);
    expect(deliverContracts(s, () => 20).deliveries).toEqual([]);
    s = { ...s, day: 11 };
    const before = s.warehouse.bread?.length ?? 0;
    const morning = deliverContracts(s, () => 20);
    expect(morning.deliveries[0]).toMatchObject({ qty: 10, cost: 180 });
    expect(morning.state.warehouse.bread).toHaveLength(before + 10);
    expect(deliverContracts(morning.state, () => 20).deliveries).toEqual([]);
    // Подписан на 10-й день: везут с 11-го по 17-й.
    expect(contractOf({ ...morning.state, day: 17 }, 'farmer')).toBeDefined();
    expect(contractOf({ ...morning.state, day: 18 }, 'farmer')).toBeUndefined();
    expect(contractOf(cancelContract(morning.state, 'farmer'), 'farmer')).toBeUndefined();
  });

  it('без денег не везут', () => {
    const s = { ...signContract(rich({ day: 10 }), 'farmer', 'bread', 10), day: 11, money: 0 };
    expect(deliverContracts(s, () => 20).deliveries[0]).toMatchObject({ qty: 0, skipped: true });
  });
});

describe('ярмарка', () => {
  it('раз в месяц, на пятый день, не в праздник', () => {
    const fairs = Array.from({ length: 112 }, (_, i) => i + 1).filter(isFairDay);
    expect(fairs.length).toBeGreaterThan(10);
    for (const d of fairs) expect(((d - 1) % 7) + 1).toBe(5);
    expect(daysToFair(fairs[1] - 2)).toBe(2);
    expect(guestFactor(rich({ day: fairs[1] }))).toBeGreaterThan(guestFactor(rich({ day: fairs[1] + 1 })));
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

describe('Эдуард переманивает и доносит', () => {
  it('переманивание: перебить — зарплата растёт, отпустить — сотрудник уходит', () => {
    const staff = [{ role: 'cashier' as const, name: 0, skill: 2, wage: 400, months: 3 }];
    const days = Array.from({ length: 300 }, (_, i) => i + 15);
    const day = days.find((d) => planDay(rich({ day: d, staff })).event?.kind === 'poach')!;
    expect(day).toBeDefined();
    const s = { ...rich({ day, staff }), plan: planDay(rich({ day, staff })) };
    const kept = answerEvent(s, true)!;
    expect(kept.staff[0].wage).toBe(500);
    expect(answerEvent(s, false)!.staff).toHaveLength(0);
  });

  it('донос — внеплановая проверка', () => {
    const days = Array.from({ length: 300 }, (_, i) => i + 14);
    const plan = days.map((day) => planDay(rich({ day }))).find((p) => p.event?.kind === 'snitch');
    expect(plan?.inspection).toBe(true);
  });
});

describe('тележка и подсказки', () => {
  it('с тележкой несут больше', () => {
    expect(carryOf(rich({ upgrades: ['cart'] }))).toBe(CART_CARRY);
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
