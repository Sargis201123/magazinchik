import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { adoptCat, buyCatOutfit, CAT_OUTFIT_IDS, CAT_OUTFIT_LUCK, CAT_OUTFITS, catLuck, wearCatOutfit } from '../src/game/cat';
import { adoptDog, buyDogOutfit, DOG_OUTFIT_CATCH, DOG_OUTFIT_IDS, DOG_OUTFITS, dogCatch, wearDogOutfit } from '../src/game/watch';
import { OUTFIT_TEXTURES } from '../src/scenes/petOutfits';

const files = new Set(Object.keys(import.meta.glob('../public/assets/ovl_*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, '')));

// Одежда питомцев (11.11): покупается за монеты, надевается и снимается, даёт немного пользы, рисуется слоем.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 10000, seed: 3, ...over });

describe('одежда кота', () => {
  it('купить — монеты уходят, наряд сразу надет; второй раз не купить', () => {
    const s = adoptCat(shop(), 'Барсик');
    const bought = buyCatOutfit(s, 'bow')!;
    expect(bought.money).toBe(s.money - CAT_OUTFITS.bow.price);
    expect(bought.cat?.outfit).toBe('bow');
    expect(bought.cat?.outfits).toEqual(['bow']);
    expect(buyCatOutfit(bought, 'bow')).toBeNull();
    expect(catLuck(bought)).toBeCloseTo(catLuck(s) + CAT_OUTFIT_LUCK);
  });

  it('надеть купленное, снять; некупленное не надеть; без кота и денег — нет', () => {
    const s = buyCatOutfit(buyCatOutfit(adoptCat(shop(), 'Мурка'), 'bell')!, 'scarf')!;
    expect(wearCatOutfit(s, 'bell')?.cat?.outfit).toBe('bell');
    expect(wearCatOutfit(s, undefined)?.cat?.outfit).toBeUndefined();
    expect(wearCatOutfit(s, 'bow')).toBeNull();
    expect(buyCatOutfit(shop(), 'bell')).toBeNull();
    expect(buyCatOutfit(adoptCat(shop({ money: 10 }), 'Мурка'), 'bell')).toBeNull();
  });

  it('старое сохранение без одежды работает как раньше', () => {
    const s = adoptCat(shop(), 'Барсик');
    expect(s.cat?.outfits).toBeUndefined();
    expect(wearCatOutfit(s, undefined)).not.toBeNull();
  });
});

describe('одежда Бобика', () => {
  it('в наряде Бобик чаще ловит воришку; снять — как было', () => {
    const s = adoptDog(shop())!;
    const dressed = buyDogOutfit(s, 'sweater')!;
    expect(dressed.money).toBe(s.money - DOG_OUTFITS.sweater.price);
    expect(dogCatch(dressed)).toBeCloseTo(dogCatch(s) + DOG_OUTFIT_CATCH);
    const off = wearDogOutfit(dressed, undefined)!;
    expect(dogCatch(off)).toBeCloseTo(dogCatch(s));
    expect(wearDogOutfit(off, 'sweater')?.security?.dog?.outfit).toBe('sweater');
    expect(wearDogOutfit(off, 'bandana')).toBeNull();
    expect(buyDogOutfit(shop(), 'bandana')).toBeNull();
  });
});

describe('одежда: картинки', () => {
  it('на каждый кадр и наряд есть слой (art/pet_outfits.py)', () => {
    expect(OUTFIT_TEXTURES.length).toBe(13 * CAT_OUTFIT_IDS.length + 6 * DOG_OUTFIT_IDS.length);
    for (const key of OUTFIT_TEXTURES) expect(files.has(key), key).toBe(true);
  });
});
