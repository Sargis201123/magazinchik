import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { adoptCat, CAT_FIND, catBrought, catFind, feedCat } from '../src/game/cat';
import { adoptDog, DOG_DAY_CATCH, dogCatch, dogGuests, KENNELS, kennelOf, upgradeKennel } from '../src/game/watch';

// Питомцы (11.11): кот приносит видимую пользу (копилка «принёс», утренние находки), у Бобика — будки.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 10000, seed: 3, ...over });

describe('кот: польза видна', () => {
  it('чаевые и находки — в кассу и в копилку кота', () => {
    const s = adoptCat(shop(), 'Барсик');
    const next = catBrought(s, 8);
    expect(next.money).toBe(s.money + 8);
    expect(next.cat?.tips).toBe(8);
    expect(catBrought(shop(), 8)).toEqual(shop());
  });

  it('находка — только у сытого вчера кота, иногда, в пределах', () => {
    let fedDays = 0;
    let found = 0;
    for (let day = 10; day < 110; day++) {
      const s = { ...adoptCat(shop({ day: day - 1 }), 'Барсик'), day };
      const fed = { ...s, cat: { ...s.cat!, fedDay: day - 1 } };
      fedDays++;
      const n = catFind(fed);
      if (n) {
        found++;
        expect(n).toBeGreaterThanOrEqual(CAT_FIND[0]);
        expect(n).toBeLessThanOrEqual(CAT_FIND[1]);
      }
      expect(catFind({ ...s, cat: { ...s.cat!, fedDay: day - 3 } })).toBe(0);
    }
    expect(found).toBeGreaterThan(fedDays * 0.15);
    expect(found).toBeLessThan(fedDays * 0.5);
    expect(feedCat(shop())).toBeNull();
  });
});

describe('Бобик: будки', () => {
  it('утеплённая будка и домик: чаще ловит воришку, домик — ещё и гости', () => {
    const s = adoptDog(shop())!;
    expect(dogCatch(s)).toBe(DOG_DAY_CATCH);
    expect(dogGuests(s)).toBe(1);
    const warm = upgradeKennel(s)!;
    expect(kennelOf(warm)).toBe(1);
    expect(warm.money).toBe(s.money - KENNELS[1].price);
    expect(dogCatch(warm)).toBeGreaterThan(dogCatch(s));
    const house = upgradeKennel(warm)!;
    expect(kennelOf(house)).toBe(2);
    expect(dogGuests(house)).toBeGreaterThan(1);
    expect(upgradeKennel(house)).toBeNull();
    expect(upgradeKennel(shop())).toBeNull();
    expect(upgradeKennel({ ...s, money: 10 })).toBeNull();
  });
});
