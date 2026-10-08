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

describe('бабушкино обучение', () => {
  it('новая игра начинается с обучения, старые сохранения — без него', () => {
    expect(newGame().tourDone).toBe(false);
    const { tourDone: _, ...old } = newGame();
    expect((old as StoreState).tourDone).toBeUndefined();
  });
});

describe('новые линейки оборудования', () => {
  const lvl = (level: number, gear: StoreState['gear'] = {}, patch: Partial<StoreState> = {}) => ({ ...at(level), gear, ...patch });

  it('склад: больше мест', async () => {
    const { warehouseCapacity } = await import('../src/game/economy');
    expect(warehouseCapacity(lvl(2, { warehouse: 3 }))).toBe(Math.round(warehouseCapacity(lvl(2)) * 1.6));
  });

  it('холодильники: молочка и мясо живут дольше, хлеб — как был; свет дешевле', async () => {
    const { unitLife, monthlyBill, PRODUCTS } = await import('../src/game/economy');
    const { fridgeLife } = await import('../src/game/gear');
    const s = lvl(2, { fridge: 2 });
    expect(unitLife('milk', { age: 0 }, fridgeLife(s))).toBe(PRODUCTS.milk.shelfLife + 2);
    expect(unitLife('bread', { age: 0 }, fridgeLife(s))).toBe(PRODUCTS.bread.shelfLife);
    const shelves: StoreState['shelves'] = [{ kind: 'dairy', level: 0, items: {} }, { kind: 'meat', level: 0, items: {} }];
    expect(monthlyBill({ ...s, shelves }).power).toBeLessThan(monthlyBill({ ...lvl(2), shelves }).power);
  });

  it('свет, климат, камеры, вход, туалет', async () => {
    const g = await import('../src/game/gear');
    expect(g.lightsGuests(lvl(3, { lights: 2 }))).toBeGreaterThan(1);
    expect(g.climatePatience(lvl(2), 'heat')).toBeLessThan(1);
    expect(g.climatePatience(lvl(2, { climate: 1 }), 'heat')).toBe(1);
    expect(g.climatePatience(lvl(2, { climate: 1 }), 'snow')).toBeLessThan(1);
    expect(g.climatePatience(lvl(2, { climate: 2 }), 'snow')).toBeGreaterThan(1);
    expect(g.cameraTheft(lvl(2, { cameras: 2 }))).toBeLessThan(g.cameraTheft(lvl(2)));
    expect(g.entranceMud(lvl(2, { entrance: 1 }))).toBe(0.5);
    expect(g.wcDirt(lvl(2, { wc: 2 }))).toBeLessThan(0.5);
  });

  it('старое ломается, новое — нет', async () => {
    const g = await import('../src/game/gear');
    expect(g.registerJam(lvl(0))).toBeGreaterThan(0);
    expect(g.registerJam(lvl(3, { register: 3 }))).toBe(0);
    expect(g.fridgeLeak(lvl(0))).toBeGreaterThan(0);
    expect(g.fridgeLeak(lvl(1, { fridge: 1 }))).toBe(0);
  });

  it('достижения за оборудование считают модели', async () => {
    const g = await import('../src/game/gear');
    expect(g.gearUpgrades(lvl(2, { register: 2, bin: 1 }))).toBe(3);
    const max = Object.fromEntries(g.GEAR_IDS.map((id) => [id, g.GEAR[id].models.length - 1]));
    expect(g.gearMaxed(lvl(4, max))).toBe(true);
    expect(g.gearMaxed(lvl(4, { register: 3 }))).toBe(false);
  });
});

describe('автозаказ, ценники, тележки', () => {
  it('автозаказ пополняет склад до списка, по обычной цене, и только когда включён', async () => {
    const { autoOrderPlan, rememberAutoOrder, toggleAutoOrder, recordPurchase } = await import('../src/game/reorder');
    let s: StoreState = { ...at(2), upgrades: ['autoOrder'], warehouse: { milk: [{ age: 0 }, { age: 0 }] } };
    expect(rememberAutoOrder(s)).toBeNull();
    s = recordPurchase(s, 'farmer', 'milk', 10);
    s = rememberAutoOrder(s)!;
    const price = () => 20;
    const plan = autoOrderPlan(s, price)!;
    expect(plan.lines).toEqual([{ sid: 'farmer', pid: 'milk', qty: 8, price: 20 }]);
    expect(plan.total).toBe(160);
    expect(autoOrderPlan(toggleAutoOrder(s)!, price)).toBeNull();
    expect(autoOrderPlan({ ...s, upgrades: [] }, price)).toBeNull();
  });

  it('умные ценники уценяют только то, что не успеют купить', async () => {
    const { markdownSurplus, PRODUCTS } = await import('../src/game/economy');
    const old = PRODUCTS.milk.shelfLife - 1;
    const s: StoreState = { ...at(2), warehouse: {}, shelves: [{ kind: 'dairy', level: 2, items: { milk: Array.from({ length: 6 }, () => ({ age: old })) } }] };
    const r = markdownSurplus(s, () => 4);
    expect(r.count).toBe(2);
    expect(r.state.shelves[0].items.milk!.filter((u) => u.markdown)).toHaveLength(2);
    expect(markdownSurplus(s, () => 10).count).toBe(0);
  });

  it('с тележками покупатель иногда берёт лишний товар', async () => {
    const { cartExtra } = await import('../src/game/upgrades');
    expect(cartExtra(at(1), () => 0)).toBe(0);
    expect(cartExtra({ ...at(1), upgrades: ['cart'] }, () => 0.1)).toBe(1);
    expect(cartExtra({ ...at(1), upgrades: ['cart'] }, () => 0.9)).toBe(0);
  });
});
