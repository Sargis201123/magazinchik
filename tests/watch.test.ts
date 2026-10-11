import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  adoptDog,
  BURGLARY_FROM_DAY,
  BURGLARY_QUIET_DAYS,
  burglaryChance,
  burglaryNews,
  burglaryNight,
  DOG_FOOD,
  DOG_FROM_DAY,
  DOG_PRICE,
  LOCK_REPAIR,
  seeBurglaryNews,
  setWatchman,
  STOLEN_MAX_UNITS,
  WATCHMAN_BOUNTY,
  WATCHMAN_WAGE,
} from '../src/game/watch';
import { rng } from '../src/game/random';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 20,
  money: 2000,
  level: 2,
  warehouse: { meat: units(6), bread: units(10), water: units(14) },
  ...patch,
});
/** Генератор ночи по списку значений: 0 — воры лезут и Бобик их прогоняет, 0.99 — тихо / Бобик проспал. */
const rolls = (...xs: number[]) => () => xs.shift() ?? 0.5;
const burglaryDay = (_: StoreState) => 20;

describe('ночные воры', () => {
  it('в первые дни и сразу после кражи — тихо', () => {
    expect(burglaryChance(shop({ day: BURGLARY_FROM_DAY - 1 }))).toBe(0);
    expect(burglaryChance(shop())).toBeGreaterThan(0);
    expect(burglaryChance(shop({ security: { lastBurglary: 18 } }))).toBe(0);
    expect(burglaryChance(shop({ security: { lastBurglary: 20 - BURGLARY_QUIET_DAYS } }))).toBeGreaterThan(0);
    // Камеры отпугивают и ночью.
    expect(burglaryChance(shop({ gear: { ...shop().gear, cameras: 2 } }))).toBeLessThan(burglaryChance(shop()));
  });

  it('у каждого игрока свои ночи: шанс кидается генератором ночи', () => {
    expect(burglaryNews(burglaryNight(shop(), 1000, rolls(0.99)))).toBeNull();
    expect(burglaryNews(burglaryNight(shop(), 1000, rolls(0)))?.outcome).toBe('stolen');
  });

  it('у бедного магазина воры не забирают последнее: касса и замок — доля денег', () => {
    const after = burglaryNight(shop({ money: 300 }), 2000, rolls(0));
    const news = burglaryNews(after)!;
    expect(news.cash).toBeLessThanOrEqual(45);
    expect(news.repair).toBeLessThanOrEqual(30);
    expect(after.money).toBeGreaterThan(200);
  });

  it('без охраны: уносят самое дорогое, деньги из кассы и ломают замок', () => {
    const day = burglaryDay(shop());
    const before = shop({ day });
    const after = burglaryNight(before, 1000, rolls(0));
    const news = burglaryNews(after)!;
    expect(news.outcome).toBe('stolen');
    expect(news.goods[0].id).toBe('meat');
    const taken = news.goods.reduce((sum, g) => sum + g.n, 0);
    expect(taken).toBeLessThanOrEqual(STOLEN_MAX_UNITS);
    expect(after.warehouse.meat?.length).toBe(6 - (news.goods.find((g) => g.id === 'meat')?.n ?? 0));
    expect(news.repair).toBe(LOCK_REPAIR);
    expect(after.money).toBe(before.money - news.cash - LOCK_REPAIR);
    // Увидел новость — больше не показывается; на следующую ночь воры не лезут.
    expect(burglaryNews(seeBurglaryNews(after))).toBeNull();
    expect(burglaryChance(after, day + 1)).toBe(0);
  });

  it('сторож ловит вора: премия, ничего не пропало; плата — каждую ночь', () => {
    const base = setWatchman(shop(), true);
    const day = burglaryDay(base);
    const after = burglaryNight({ ...base, day }, 1000, rolls(0));
    expect(burglaryNews(after)?.outcome).toBe('watchman');
    expect(after.money).toBe(base.money - WATCHMAN_WAGE + WATCHMAN_BOUNTY);
    expect(after.warehouse).toEqual(base.warehouse);
    expect(after.security?.caught).toBe(1);
    // Нечем платить — сторож не выходит, и вор уносит товар.
    const broke = burglaryNight({ ...base, day, money: WATCHMAN_WAGE - 1 }, 0, rolls(0));
    expect(burglaryNews(broke)?.outcome).toBe('stolen');
  });

  it('Бобик: берут из приюта, кормят каждую ночь, чаще всего прогоняет вора', () => {
    expect(adoptDog(shop({ day: DOG_FROM_DAY - 1 }))).toBeNull();
    // Бобика можно взять заранее — до первых воров.
    expect(DOG_FROM_DAY).toBeLessThan(BURGLARY_FROM_DAY);
    expect(adoptDog(shop({ money: DOG_PRICE - 1 }))).toBeNull();
    const withDog = adoptDog(shop())!;
    expect(withDog.money).toBe(2000 - DOG_PRICE);
    expect(adoptDog(withDog)).toBeNull();
    const quiet = burglaryNight({ ...withDog, day: 21, security: { ...withDog.security, lastBurglary: 20 } }, 0, rolls(0));
    expect(quiet.money).toBe(withDog.money - DOG_FOOD);
    let scared = 0;
    let robbed = 0;
    const random = rng(7);
    for (let day = 20; day < 2000; day++) {
      const news = burglaryNews(burglaryNight({ ...withDog, day }, 0, random));
      if (news?.outcome === 'dog') scared++;
      if (news?.outcome === 'stolen') {
        robbed++;
        expect(news.dogSlept).toBe(true);
      }
    }
    expect(scared).toBeGreaterThan(robbed * 3);
  });
});
