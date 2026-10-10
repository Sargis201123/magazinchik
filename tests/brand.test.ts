import { describe, expect, it } from 'vitest';
import { newGame, onShelves, sellableProducts, type StaffMember, type StoreState } from '../src/game/economy';
import { BRAND_BATCH, BRAND_COSTS, brandAvailable, brandDemand, brandToBake, buyBrandLevel, startBrandBatch, brandBatchCost } from '../src/game/brand';
import { takeOutBread } from '../src/game/bakery';
import { GEAR } from '../src/game/gear';
import { pickWanted } from '../src/game/endless';

const baker: StaffMember = { role: 'baker', name: 0, skill: 2, wage: 380, months: 0 };
const maxOven = GEAR.oven.models.length - 1;
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 30,
  money: 20000,
  level: 3,
  upgrades: ['oven'],
  gear: { oven: maxOven },
  staff: [baker],
  shelves: [{ kind: 'bakery', level: 1, items: { bread: Array.from({ length: 3 }, () => ({ age: 0 })) } }],
  ...patch,
});

describe('своя марка «От бабушки»', () => {
  it('открывается только с лучшей печью; ступени по очереди', () => {
    expect(brandAvailable(shop({ gear: { oven: 0 } }))).toBe(false);
    expect(buyBrandLevel(shop({ gear: { oven: 0 } }))).toBeNull();
    let s = shop();
    expect(sellableProducts(s)).not.toContain('pies');
    s = buyBrandLevel(s)!;
    expect(s.brand).toBe(1);
    expect(s.money).toBe(20000 - BRAND_COSTS[0]);
    expect(sellableProducts(s)).toContain('pies');
    expect(sellableProducts(s)).not.toContain('buns');
    s = buyBrandLevel(buyBrandLevel(s)!)!;
    expect(sellableProducts(s)).toEqual(expect.arrayContaining(['pies', 'buns', 'honeycake']));
    expect(buyBrandLevel(s)).toBeNull();
    expect(brandDemand(s, 'pies')).toBeGreaterThan(brandDemand(shop({ brand: 1 }), 'pies'));
    expect(brandDemand(s, 'bread')).toBe(1);
  });

  it('пекарь печёт то, чего меньше на полках; выпечка ложится на хлебную полку', () => {
    const s = shop({ brand: 2 });
    const id = brandToBake(s)!;
    expect(['pies', 'buns']).toContain(id);
    const started = startBrandBatch(s, id)!;
    expect(started.money).toBe(s.money - brandBatchCost(id));
    const out = takeOutBread(started, BRAND_BATCH, id);
    expect(onShelves(out.state, id)).toBe(out.onShelves);
    // Без пекаря — не печёт.
    expect(brandToBake({ ...s, staff: [] })).toBeNull();
  });

  it('свою выпечку хотят, только когда она на полке', () => {
    const s = shop({ brand: 3 });
    for (let i = 0; i < 50; i++) {
      const wanted = pickWanted(s, Math.random, 3);
      expect(wanted.some((w) => ['pies', 'buns', 'honeycake'].includes(w))).toBe(false);
    }
    const withPies = { ...s, shelves: [{ ...s.shelves[0], items: { pies: [{ age: 0 }] } }] };
    const seen = Array.from({ length: 50 }, () => pickWanted(withPies, Math.random, 2)).flat();
    expect(seen).toContain('pies');
  });
});
