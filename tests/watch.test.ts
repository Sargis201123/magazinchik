import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { adoptDog, DOG_FOOD, DOG_FROM_DAY, DOG_PRICE, dogNight, hasDog } from '../src/game/watch';

// Ночных краж и сторожа больше нет (02.11) — остался пёс Бобик: днём лает на воришек у входа.
const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 2000, level: 2, ...patch });

describe('пёс Бобик', () => {
  it('берут из приюта с DOG_FROM_DAY и если хватает денег, один раз', () => {
    expect(adoptDog(shop({ day: DOG_FROM_DAY - 1 }))).toBeNull();
    expect(adoptDog(shop({ money: DOG_PRICE - 1 }))).toBeNull();
    const withDog = adoptDog(shop())!;
    expect(hasDog(withDog)).toBe(true);
    expect(withDog.money).toBe(2000 - DOG_PRICE);
    expect(adoptDog(withDog)).toBeNull();
  });

  it('ночь: только корм Бобику, в минус не уводит; без Бобика ночь ничего не стоит', () => {
    const withDog = adoptDog(shop())!;
    expect(dogNight(withDog).money).toBe(withDog.money - DOG_FOOD);
    expect(dogNight({ ...withDog, money: 5 }).money).toBe(0);
    const noDog = shop();
    expect(dogNight(noDog)).toBe(noDog);
  });
});
