// Улучшения фудкорта (game/foodcourtUps.ts, 14.11): три ступени одной линейки на общей основе улучшений этажей —
// цена, условия (этаж открыт, ступень раньше, ремонт), что дают (едоки, семьи по выходным, вечерний наплыв, аренда)
// и старые сохранения без поля up.
import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { buyFloorUp, FLOOR_UPGRADES, floorBonus, floorUpLock, floorUps, hasFloorUp } from '../src/game/floors';
import { FOOD_UPS } from '../src/game/foodcourtUps';
import { foodPlan, isFoodWeekend, stallRent, STALLS, type FoodcourtState } from '../src/game/foodcourt';

const four: FoodcourtState = { stalls: { pizza: 'rent', grill: 'rent', sushi: 'rent', coffee: 'rent' } };
/** «Универмаг», фудкорт открыт (отделка finish), куплены улучшения up. День 57 — будний. */
const court = (up?: string[], finish = 0, over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 57,
  level: 4,
  money: 100000,
  debt: 0,
  seed: 11,
  floors: { second: { since: 20, finish: 0 }, third: { since: 30, finish, ...(up ? { up } : {}) } },
  foodcourt: four,
  ...over,
});
const price = (id: string): number => FOOD_UPS.find((u) => u.id === id)!.price;
const weekend = (s: StoreState): StoreState => {
  for (let d = s.day; d < s.day + 7; d++) if (isFoodWeekend({ ...s, day: d })) return { ...s, day: d };
  throw new Error('нет выходных');
};

describe('улучшения фудкорта', () => {
  it('три ступени в «Этажах»: дизайн → детская зона → сцена', () => {
    expect(FLOOR_UPGRADES.third.map((u) => u.id)).toEqual(['design', 'kids', 'stage']);
    expect(FOOD_UPS.map((u) => u.price)).toEqual([9000, 12000, 16000]);
    expect(FOOD_UPS[1].needs).toBe('design');
    expect(FOOD_UPS[2].needs).toBe('kids');
  });

  it('старое сохранение без поля up — ничего не куплено, всё как раньше', () => {
    const old = court();
    expect(floorUps(old, 'third')).toEqual([]);
    expect(floorBonus(old, 'third', 'eaters')).toBe(0);
    const fresh = court([]);
    expect(foodPlan(old)).toEqual(foodPlan(fresh));
    expect(stallRent(old, 'pizza')).toBe(STALLS.pizza.rent);
  });

  it('условия: этаж закрыт или Заречье, ступень раньше, ремонт под сцену', () => {
    expect(floorUpLock(court(undefined, 0, { floors: {} }), 'third', 'design')).toBe('closed');
    expect(floorUpLock(court(undefined, 0, { zar: { at: 'zar' } as StoreState['zar'] }), 'third', 'design')).toBe('closed');
    expect(floorUpLock(court(), 'third', 'design')).toBeNull();
    expect(floorUpLock(court(), 'third', 'kids')).toBe('needs');
    expect(floorUpLock(court(['design']), 'third', 'kids')).toBeNull();
    // Сцена — только после ремонта этажа, и то после детской зоны.
    expect(floorUpLock(court(['design', 'kids']), 'third', 'stage')).toBe('finish');
    expect(floorUpLock(court(['design'], 1), 'third', 'stage')).toBe('needs');
    expect(floorUpLock(court(['design', 'kids'], 1), 'third', 'stage')).toBeNull();
    expect(floorUpLock(court(['design']), 'third', 'design')).toBe('owned');
  });

  it('покупка: цена списана, улучшение в сохранении; денег мало — нельзя', () => {
    const a = buyFloorUp(court(), 'third', 'design')!;
    expect(a.money).toBe(100000 - price('design'));
    expect(hasFloorUp(a, 'third', 'design')).toBe(true);
    expect(a.floors?.third?.since).toBe(30);
    expect(buyFloorUp(a, 'third', 'design')).toBeNull();
    expect(buyFloorUp({ ...court(), money: price('design') - 1 }, 'third', 'design')).toBeNull();
    const b = buyFloorUp(a, 'third', 'kids')!;
    expect(floorUps(b, 'third')).toEqual(['design', 'kids']);
  });

  it('дизайн зала: едоков +12%, аренда +10%', () => {
    const base = foodPlan(court())!;
    const nice = foodPlan(court(['design']))!;
    const ratio = nice.eaters / base.eaters;
    expect(ratio).toBeGreaterThan(1.08);
    expect(ratio).toBeLessThan(1.16);
    expect(stallRent(court(['design']), 'pizza')).toBe(Math.round(STALLS.pizza.rent * 1.1));
  });

  it('детская зона: в будни едоков столько же, в выходные — больше', () => {
    const weekday = court(['design']);
    expect(isFoodWeekend(weekday)).toBe(false);
    expect(foodPlan(court(['design', 'kids']))!.eaters).toBe(foodPlan(weekday)!.eaters);
    const sat = weekend(court(['design']));
    const satKids = weekend(court(['design', 'kids']));
    expect(foodPlan(satKids)!.eaters).toBeGreaterThan(foodPlan(sat)!.eaters);
  });

  it('сцена: вечерний наплыв — едоков ещё +15%, аренда складывается', () => {
    const before = foodPlan(court(['design', 'kids'], 1))!;
    const after = foodPlan(court(['design', 'kids', 'stage'], 1))!;
    expect(after.eaters / before.eaters).toBeGreaterThan(1.1);
    expect(floorBonus(court(['design', 'kids', 'stage'], 1), 'third', 'rent')).toBeCloseTo(0.25);
    // Вечер с улучшениями — детерминирован: тот же день, то же зерно — те же числа.
    expect(foodPlan(court(['design', 'kids', 'stage'], 1))).toEqual(after);
  });
});
