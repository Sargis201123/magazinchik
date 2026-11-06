import { describe, expect, it } from 'vitest';
import { CROPS, stageOf } from '../src/game/farm/crops';
import { FARM_TEXTURES } from '../src/farm/textures';
import { TEXTURES } from '../src/scenes/worldTextures';
import {
  DRY_GROWTH,
  FARM_DAY_SECONDS,
  START_MONEY,
  grow,
  harvest,
  newFarm,
  nextDay,
  normalizeFarm,
  pay,
  plant,
  stockShelves,
  stuck,
  takeFromShelves,
  thirsty,
  water,
  wish,
  type FarmState,
} from '../src/game/farm/farm';

describe('«Бабушкина ферма»: грядки', () => {
  it('посадка берёт семена из кассы, на занятую грядку не сажает', () => {
    const s = plant(newFarm(), 0, 'carrot');
    expect(s.money).toBe(START_MONEY - CROPS.carrot.seed);
    expect(s.beds[0].crop).toBe('carrot');
    expect(plant(s, 0, 'pumpkin')).toBe(s);
  });

  it('без денег не сажает', () => {
    const s = { ...newFarm(), money: 1 };
    expect(plant(s, 0, 'carrot')).toBe(s);
  });

  it('политое растёт в срок, сухое — медленнее, в дождь поливать не надо', () => {
    let s = plant(newFarm(), 0, 'carrot');
    expect(thirsty(s.beds[0], 'clear')).toBe(true);
    expect(thirsty(s.beds[0], 'rain')).toBe(false);
    const dry = grow(s, 10, 'clear');
    expect(dry.beds[0].grow).toBeCloseTo((10 * DRY_GROWTH) / CROPS.carrot.grow);
    s = water(s, 0, 'clear');
    s = grow(s, CROPS.carrot.grow, 'clear');
    expect(s.beds[0].grow).toBe(1);
    const rainy = grow(plant(newFarm(), 1, 'carrot'), CROPS.carrot.grow, 'rain');
    expect(rainy.beds[1].grow).toBe(1);
  });

  it('стадии: росток → куст → созрело', () => {
    expect([0, 0.2, 0.6, 1].map(stageOf)).toEqual([0, 1, 2, 3]);
  });

  it('тыква успевает за день, если посадить утром и поливать', () => {
    expect(CROPS.pumpkin.grow).toBeLessThan(FARM_DAY_SECONDS);
  });
});

describe('«Бабушкина ферма»: урожай и лавка', () => {
  const ripe = (crop: 'carrot' | 'strawberry' | 'pumpkin') => {
    const s = plant(newFarm(), 0, crop);
    return { ...s, beds: s.beds.map((b, i) => (i === 0 ? { ...b, grow: 1 } : b)) };
  };

  it('сбор — на полку, грядка свободна; несозревшее не собирается', () => {
    const { state, n, crop } = harvest(ripe('carrot'), 0);
    expect(crop).toBe('carrot');
    expect(n).toBe(CROPS.carrot.yield);
    expect(state.beds[0].crop).toBeNull();
    expect(state.shelves.find((x) => x.crop === 'carrot')?.count).toBe(CROPS.carrot.yield);
    expect(harvest(plant(newFarm(), 0, 'carrot'), 0).n).toBe(0);
  });

  it('что не влезло на полки — в ящик, освободилось место — добирается', () => {
    let s: FarmState = { ...newFarm(), crate: { carrot: 30 } };
    s = stockShelves(s);
    expect(s.shelves.every((x) => x.crop === 'carrot' && x.count === CROPS.carrot.shelf)).toBe(true);
    expect(s.crate.carrot).toBe(30 - 3 * CROPS.carrot.shelf);
    const took = takeFromShelves(s, 'carrot', 3);
    expect(took.n).toBe(3);
    expect(took.state.crate.carrot ?? 0).toBe(30 - 3 * CROPS.carrot.shelf - 3);
    expect(took.state.shelves[0].count).toBe(CROPS.carrot.shelf);
  });

  it('покупатель платит по цене культуры; нет товара — уходит ни с чем', () => {
    const { state } = harvest(ripe('pumpkin'), 0);
    const took = takeFromShelves(state, 'pumpkin', 1);
    expect(took.n).toBe(1);
    const paid = pay(took.state, 'pumpkin', 1);
    expect(paid.coins).toBe(CROPS.pumpkin.price);
    expect(paid.state.stats.revenue).toBe(CROPS.pumpkin.price);
    expect(takeFromShelves(paid.state, 'pumpkin', 1).n).toBe(0);
  });

  it('желание покупателя — из списка культур и в пределах «сколько берёт»', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const w = wish(() => r);
      expect(w.qty).toBeGreaterThanOrEqual(CROPS[w.crop].take[0]);
      expect(w.qty).toBeLessThanOrEqual(CROPS[w.crop].take[1]);
    }
  });

  it('новый день: итоги обнуляются, грядки остаются', () => {
    const s = nextDay(grow(water(plant(newFarm(), 0, 'pumpkin'), 0, 'clear'), 30, 'clear'));
    expect(s.day).toBe(2);
    expect(s.stats.planted).toBe(0);
    expect(s.beds[0].grow).toBeGreaterThan(0);
  });

  it('застрял (нет денег, ничего не растёт и не продаётся) — видно', () => {
    expect(stuck({ ...newFarm(), money: 0 })).toBe(true);
    expect(stuck(newFarm())).toBe(false);
  });
});

describe('«Бабушкина ферма»: сохранение', () => {
  it('чинит кривое и отбрасывает лишнее', () => {
    const s = normalizeFarm({ day: 3, money: 15.7, beds: [{ crop: 'banana', grow: 1 }, { crop: 'carrot', grow: 7 }], crate: { carrot: 2, x: 5 } });
    expect(s?.day).toBe(3);
    expect(s?.money).toBe(15);
    expect(s?.beds[0].crop).toBeNull();
    expect(s?.beds[1].grow).toBe(1);
    expect(s?.beds).toHaveLength(6);
    expect(s?.crate).toEqual({ carrot: 2 });
    expect(normalizeFarm(null)).toBeNull();
  });
});

describe('«Бабушкина ферма»: картинки', () => {
  const files = Object.keys(import.meta.glob('../public/assets/farm_*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, ''));
  it('сцена грузит ровно то, что нарисовал art/farm.py', () => {
    expect([...FARM_TEXTURES].sort()).toEqual(files.sort());
  });
  it('в общий атлас магазина картинки фермы не попадают', () => {
    expect(TEXTURES.filter((k) => k.startsWith('farm_'))).toEqual([]);
  });
});
