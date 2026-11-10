import { describe, expect, it } from 'vitest';
import { buyStock, newGame, warehouseCapacity, warehouseCount, warehouseOf, type StoreState } from '../src/game/economy';
import { buildGarden, cropQty, GARDEN_CROPS, GARDEN_FROM_DAY, GARDEN_PRICE, gardenLeft, gardenLook, gardenProgress, gardenRipe, gardenStage, gardenVisible, GROW_MS, harvest } from '../src/game/garden';

// «Бабушкина теплица» (garden.ts): растёт по настоящему времени, урожай — бесплатно на склад.

const NOW = Date.UTC(2026, 10, 10, 9, 0, 0);
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 5, money: 1000, ...over });
const planted = (over: Partial<StoreState> = {}): StoreState => buildGarden(shop(over), NOW)!;

describe('теплица: поставить', () => {
  it('с третьего дня, за деньги, один раз', () => {
    expect(gardenVisible(shop({ day: GARDEN_FROM_DAY - 1 }))).toBe(false);
    expect(buildGarden(shop({ day: GARDEN_FROM_DAY - 1 }), NOW)).toBeNull();
    expect(buildGarden(shop({ money: GARDEN_PRICE - 1 }), NOW)).toBeNull();
    const state = planted();
    expect(state.money).toBe(1000 - GARDEN_PRICE);
    expect(state.garden).toEqual({ since: NOW, harvests: 0 });
    expect(buildGarden(state, NOW)).toBeNull();
  });
});

describe('теплица: рост по настоящему времени', () => {
  it('стадии 0 → 3 за время роста, перевод часов назад рост в минус не уводит', () => {
    const state = planted();
    expect(gardenStage(state, NOW)).toBe(0);
    expect(gardenStage(state, NOW + GROW_MS * 0.4)).toBe(1);
    expect(gardenStage(state, NOW + GROW_MS * 0.8)).toBe(2);
    expect(gardenStage(state, NOW + GROW_MS)).toBe(3);
    expect(gardenRipe(state, NOW + GROW_MS - 1)).toBe(false);
    expect(gardenProgress(state, NOW - 5 * 3600_000)).toBe(0);
    expect(gardenLeft(state, NOW + GROW_MS / 2)).toBe(GROW_MS / 2);
    expect(gardenLeft(state, NOW + GROW_MS * 3)).toBe(0);
    expect(gardenLook(state, NOW)).not.toBe(gardenLook(state, NOW + GROW_MS));
    expect(gardenLook(shop(), NOW)).toBe('');
  });
});

describe('теплица: урожай', () => {
  it('не созрел — собирать нечего', () => {
    expect(harvest(planted(), NOW + GROW_MS - 1)).toBeNull();
    expect(harvest(shop(), NOW)).toBeNull();
  });

  it('созрел — яблоки и картофель бесплатно на склад, рассада посажена заново', () => {
    const state = planted({ warehouse: {} });
    const later = NOW + GROW_MS + 1000;
    const done = harvest(state, later)!;
    expect(done.got.map((g) => g.id)).toEqual(GARDEN_CROPS);
    for (const { id, qty } of done.got) {
      expect(qty).toBe(cropQty(state));
      expect(warehouseOf(done.state, id)).toBe(qty);
    }
    expect(done.state.money).toBe(state.money);
    expect(done.state.garden).toEqual({ since: later, harvests: 1 });
    expect(gardenRipe(done.state, later)).toBe(false);
  });

  it('в большом магазине урожай больше', () => {
    expect(cropQty(shop({ level: 4 }))).toBeGreaterThan(cropQty(shop({ level: 0 })));
  });

  it('на складе нет места — урожай ждёт, а не пропадает', () => {
    const state = planted({ warehouse: {} });
    const stuffed = buyStock(state, 'apples', warehouseCapacity(state), 0)!;
    expect(warehouseCount(stuffed)).toBe(warehouseCapacity(stuffed));
    const later = NOW + GROW_MS;
    expect(harvest(stuffed, later)).toBeNull();
    expect(gardenRipe(stuffed, later)).toBe(true);
  });
});
