import { describe, expect, it } from 'vitest';
import { cashierScan, newGame, type StaffMember, type StoreState } from '../src/game/economy';
import { nextRegisterCount, registerCount, registerOfRole } from '../src/game/registers';
import {
  binCapacity,
  brewSeconds,
  coffeePrice,
  gearAvailable,
  gearTier,
  nextGear,
  ovenBatch,
  ovenBatchCost,
  registerSprite,
  upgradeGear,
} from '../src/game/gear';
import { startBatch, takeOutBread } from '../src/game/bakery';
import { withUpgrades } from '../src/game/upgrades';

const at = (level: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 20000, level, ...patch });
const member: StaffMember = { role: 'cashier', name: 0, skill: 1, wage: 360, months: 0 };

describe('кассы растут вместе с помещением', () => {
  it('1, 1, 2, 3, 4 кассы по уровням', () => {
    expect([0, 1, 2, 3, 4].map((l) => registerCount(at(l)))).toEqual([1, 1, 2, 3, 4]);
    expect(nextRegisterCount(at(1))).toBe(2);
    expect(nextRegisterCount(at(4))).toBeNull();
  });

  it('старое сохранение с купленной второй кассой не теряет её', () => {
    expect(registerCount(at(1, { upgrades: ['register2' as never] }))).toBe(2);
  });

  it('у каждого кассира своя касса', () => {
    expect(['cashier', 'cashier2', 'cashier3', 'cashier4'].map((r) => registerOfRole(r as never))).toEqual([0, 1, 2, 3]);
  });
});

describe('модели оборудования', () => {
  it('новая касса пробивает быстрее и рисуется по-новому', () => {
    let s = at(3);
    const base = withUpgrades(s, cashierScan(member)).item;
    expect(registerSprite(s)).toBe('counter0');
    s = upgradeGear(s, 'register')!;
    s = upgradeGear(s, 'register')!;
    expect(gearTier(s, 'register')).toBe(2);
    expect(registerSprite(s)).toBe('counter2');
    expect(withUpgrades(s, cashierScan(member)).item).toBeCloseTo(base * 0.72);
    expect(s.money).toBe(20000 - 500 - 1500);
  });

  it('модель не поставить раньше нужного помещения и без денег', () => {
    let s = at(1);
    s = upgradeGear(s, 'register')!;
    expect(gearAvailable(s, 'register')).toBe(false);
    expect(upgradeGear(s, 'register')).toBeNull();
    expect(upgradeGear(at(1, { money: 100 }), 'register')).toBeNull();
  });

  it('лучшую модель дальше не улучшить', () => {
    let s = at(4);
    for (let i = 0; i < 3; i++) s = upgradeGear(s, 'register')!;
    expect(nextGear(s, 'register')).toBeNull();
    expect(upgradeGear(s, 'register')).toBeNull();
  });

  it('мусорка вмещает больше', () => {
    let s = at(2);
    expect(binCapacity(s)).toBe(5);
    s = upgradeGear(upgradeGear(s, 'bin')!, 'bin')!;
    expect(binCapacity(s)).toBe(12);
  });

  it('кофемашину и печь улучшают, только когда они есть', () => {
    expect(upgradeGear(at(3), 'coffee')).toBeNull();
    let s = at(3, { upgrades: ['coffee', 'oven'] });
    s = upgradeGear(upgradeGear(s, 'coffee')!, 'coffee')!;
    expect(brewSeconds(s)).toBeLessThan(brewSeconds(at(3)));
    expect(coffeePrice(s)).toBe(50);
    s = upgradeGear(s, 'oven')!;
    expect(ovenBatch(s)).toBe(9);
    expect(ovenBatchCost(s)).toBe(90);
  });

  it('большая печь закладывает и выдаёт больше хлеба', () => {
    const s = upgradeGear(at(3, { upgrades: ['oven'] }), 'oven')!;
    const started = startBatch(s)!;
    expect(started.money).toBe(s.money - 90);
    const out = takeOutBread(started);
    const bread = (st: StoreState) =>
      st.shelves.reduce((n, sh) => n + (sh.items.bread?.length ?? 0), 0) + (st.warehouse.bread?.length ?? 0);
    expect(bread(out.state) - bread(started)).toBe(9);
  });
});

describe('ночная наценка', () => {
  it('ночью товар пробивается на 25% дороже (с округлением вверх)', async () => {
    const { checkout, PRODUCTS } = await import('../src/game/economy');
    const { NIGHT_MARKUP } = await import('../src/game/night');
    const s = at(3);
    const items = [{ id: 'milk' as const, unit: { age: 0 } }];
    const day = checkout(s, items).total;
    expect(day).toBe(s.prices.milk ?? PRODUCTS.milk.basePrice);
    expect(checkout(s, items, NIGHT_MARKUP).total).toBe(Math.ceil(day * 1.25));
  });
});
