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
  DOG_PRICE,
  LOCK_REPAIR,
  seeBurglaryNews,
  setWatchman,
  STOLEN_MAX_UNITS,
  WATCHMAN_BOUNTY,
  WATCHMAN_WAGE,
} from '../src/game/watch';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 20,
  money: 2000,
  level: 2,
  warehouse: { meat: units(6), bread: units(10), water: units(14) },
  ...patch,
});
/** Первая ночь, когда воры точно полезут (решает номер дня). */
function burglaryDay(base: StoreState): number {
  for (let day = 20; day < 400; day++) {
    const s = burglaryNight({ ...base, day }, 0);
    if (s.security?.news?.day === day) return day;
  }
  throw new Error('нет ночи с ворами');
}

describe('ночные воры', () => {
  it('в первые дни и сразу после кражи — тихо', () => {
    expect(burglaryChance(shop({ day: BURGLARY_FROM_DAY - 1 }))).toBe(0);
    expect(burglaryChance(shop())).toBeGreaterThan(0);
    expect(burglaryChance(shop({ security: { lastBurglary: 18 } }))).toBe(0);
    expect(burglaryChance(shop({ security: { lastBurglary: 20 - BURGLARY_QUIET_DAYS } }))).toBeGreaterThan(0);
    // Камеры отпугивают и ночью.
    expect(burglaryChance(shop({ gear: { ...shop().gear, cameras: 2 } }))).toBeLessThan(burglaryChance(shop()));
  });

  it('без охраны: уносят самое дорогое, деньги из кассы и ломают замок', () => {
    const day = burglaryDay(shop());
    const before = shop({ day });
    const after = burglaryNight(before, 1000);
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
    const after = burglaryNight({ ...base, day }, 1000);
    expect(burglaryNews(after)?.outcome).toBe('watchman');
    expect(after.money).toBe(base.money - WATCHMAN_WAGE + WATCHMAN_BOUNTY);
    expect(after.warehouse).toEqual(base.warehouse);
    expect(after.security?.caught).toBe(1);
    // Нечем платить — сторож не выходит, и вор уносит товар.
    const broke = burglaryNight({ ...base, day, money: WATCHMAN_WAGE - 1 }, 0);
    expect(burglaryNews(broke)?.outcome).toBe('stolen');
  });

  it('Бобик: берут из приюта, кормят каждую ночь, чаще всего прогоняет вора', () => {
    expect(adoptDog(shop({ day: BURGLARY_FROM_DAY - 1 }))).toBeNull();
    expect(adoptDog(shop({ money: DOG_PRICE - 1 }))).toBeNull();
    const withDog = adoptDog(shop())!;
    expect(withDog.money).toBe(2000 - DOG_PRICE);
    expect(adoptDog(withDog)).toBeNull();
    const quiet = burglaryNight({ ...withDog, day: 21, security: { ...withDog.security, lastBurglary: 20 } }, 0);
    expect(quiet.money).toBe(withDog.money - DOG_FOOD);
    let scared = 0;
    let robbed = 0;
    for (let day = 20; day < 2000; day++) {
      const news = burglaryNews(burglaryNight({ ...withDog, day }, 0));
      if (news?.outcome === 'dog') scared++;
      if (news?.outcome === 'stolen') {
        robbed++;
        expect(news.dogSlept).toBe(true);
      }
    }
    expect(scared).toBeGreaterThan(robbed * 3);
  });
});
