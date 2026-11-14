// Улучшения второго этажа (clothesUps.ts, 14.11): три ступени по порядку — витрины, примерочная, бренды. Цена,
// замки (ступень раньше, «Универмаг» для брендов), что дают в вечере этажа и что старые сохранения ничего не теряют.
import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { buyFloorUp, FLOOR_UPGRADES, floorBonus, floorUpLock, floorUps, hasFloorUp } from '../src/game/floors';
import { CLOTHES_UPS } from '../src/game/clothesUps';
import { clothesNight, clothesPlan, COLLECTION_DEFS, collectionFor, SALE_OFF, salePrice, tagPrice, upsBoost, type ClothesState } from '../src/game/clothes';

/** День 60 — лето, «Супермаркет», на стойках футболки и прошлогодние куртки. */
const shop = (up?: string[], over: Partial<StoreState> = {}, clothes: ClothesState = { stock: { summer: 40, warm: 10 }, sale: true }): StoreState => ({
  ...newGame(),
  day: 60,
  level: 3,
  money: 30000,
  debt: 0,
  rating: 4.5,
  seed: 7,
  floors: { second: { since: 50, finish: 0, ...(up ? { up } : {}) } },
  clothes,
  ...over,
});
const price = (id: string): number => CLOTHES_UPS.find((u) => u.id === id)!.price;

describe('улучшения второго этажа', () => {
  it('три ступени в таблице этажей, у каждой — цена и картинка', () => {
    expect(FLOOR_UPGRADES.second.slice(0, 3).map((u) => u.id)).toEqual(['showcase', 'fitting', 'brands']);
    for (const u of CLOTHES_UPS) {
      expect(u.price).toBeGreaterThan(0);
      expect(u.art).toMatch(/^fl2b_/);
    }
  });

  it('старое сохранение (нет поля up) — ничего не куплено, вечер как раньше', () => {
    const old = shop();
    expect(floorUps(old, 'second')).toEqual([]);
    expect(upsBoost(old)).toBe(1);
    expect(tagPrice(old, 'summer')).toBe(COLLECTION_DEFS.summer.price);
    expect(salePrice(old, 'warm')).toBe(Math.round(COLLECTION_DEFS.warm.price * SALE_OFF));
  });

  it('по порядку: витрины → примерочная → бренды, бренды — с «Универмага»', () => {
    expect(floorUpLock(shop(), 'second', 'showcase')).toBeNull();
    expect(floorUpLock(shop(), 'second', 'fitting')).toBe('needs');
    expect(floorUpLock(shop(['showcase']), 'second', 'fitting')).toBeNull();
    expect(floorUpLock(shop(['showcase', 'fitting']), 'second', 'brands')).toBe('level');
    expect(floorUpLock(shop(['showcase', 'fitting'], { level: 4 }), 'second', 'brands')).toBeNull();
    expect(floorUpLock(shop(['showcase']), 'second', 'showcase')).toBe('owned');
    // Этаж не открыт — купить нельзя.
    expect(floorUpLock({ ...shop(), floors: {} }, 'second', 'showcase')).toBe('closed');
  });

  it('покупка: списывает цену, нет денег — нельзя', () => {
    const a = buyFloorUp(shop(), 'second', 'showcase')!;
    expect(a.money).toBe(30000 - price('showcase'));
    expect(hasFloorUp(a, 'second', 'showcase')).toBe(true);
    expect(buyFloorUp(shop(undefined, { money: price('showcase') - 1 }), 'second', 'showcase')).toBeNull();
    const b = buyFloorUp(buyFloorUp(a, 'second', 'fitting')!, 'second', 'brands');
    expect(b).toBeNull();
  });

  it('витрины и примерочная — покупателей больше, бренды — бирка дороже', () => {
    const guests = 400;
    const base = clothesPlan(shop(), guests)!;
    const lit = clothesPlan(shop(['showcase']), guests)!;
    const both = clothesPlan(shop(['showcase', 'fitting']), guests)!;
    expect(upsBoost(shop(['showcase']))).toBeCloseTo(1.15);
    expect(upsBoost(shop(['showcase', 'fitting']))).toBeCloseTo(1.15 * 1.15);
    expect(lit.buyers).toBeGreaterThan(base.buyers);
    expect(both.buyers).toBeGreaterThan(lit.buyers);
    const brands = shop(['showcase', 'fitting', 'brands'], { level: 4 });
    expect(floorBonus(brands, 'second', 'price')).toBeCloseTo(0.25);
    expect(tagPrice(brands, 'summer')).toBe(Math.round(COLLECTION_DEFS.summer.price * 1.25));
    expect(salePrice(brands, 'warm')).toBe(Math.round(Math.round(COLLECTION_DEFS.warm.price * 1.25) * SALE_OFF));
    const plan = clothesPlan(brands, guests)!;
    const coll = collectionFor(brands.day);
    expect(plan.income).toBe(plan.sold * tagPrice(brands, coll) + plan.sale * salePrice(brands, 'warm'));
  });

  // 14.11, ревью баланса: закупка — половина бирки, и +25% к бирке давали +50% наценки — «Бренды» окупались втрое
  // быстрее остальных ступеней. Теперь за процент прибыли этажа каждая ступень просит сопоставимо (в пределах 1.5 раза).
  it('за процент прибыли этажа ступени просят сопоставимо', () => {
    const margin = (s: StoreState, id: 'summer'): number => tagPrice(s, id) - COLLECTION_DEFS[id].cost;
    const profit = (s: StoreState): number => upsBoost(s) * margin(s, 'summer');
    const steps = [shop(), shop(['showcase']), shop(['showcase', 'fitting']), shop(['showcase', 'fitting', 'brands'], { level: 4 })];
    const base = profit(steps[0]);
    const perPct = CLOTHES_UPS.map((u, i) => u.price / (((profit(steps[i + 1]) - profit(steps[i])) / base) * 100));
    expect(Math.max(...perPct) / Math.min(...perPct)).toBeLessThan(1.5);
  });

  it('вечер считает то же, что прогноз, и от перезапуска не меняется', () => {
    const s = shop(['showcase', 'fitting', 'brands'], { level: 4 });
    const a = clothesNight(s, 300);
    const b = clothesNight(s, 300);
    expect(a.day).toEqual(clothesPlan(s, 300));
    expect(a.state.money).toBe(b.state.money);
    expect(a.state.money).toBe(s.money + a.day!.income - a.day!.wage);
  });

  it('кривое поле up в сохранении — как будто ничего не куплено', () => {
    const s = shop('showcase' as unknown as string[]);
    expect(floorUps(s, 'second')).toEqual([]);
    expect(upsBoost(s)).toBe(1);
  });
});
