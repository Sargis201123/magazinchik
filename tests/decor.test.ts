import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { activeDecor, buyDecor, DECOR, DECOR_KINDS, decorItem, normalizeDecor, setDecor, type DecorId, type DecorState } from '../src/game/decor';
import { TEXTURES } from '../src/scenes/textures';
import { en } from '../src/i18n/en';
import { ru, type TextKey } from '../src/i18n/ru';

describe('оформление', () => {
  it('покупка за монеты ставит вещь сразу', () => {
    const state = { ...newGame(), money: 1000 };
    const bought = buyDecor(state, 'wall_mint')!;
    expect(bought.money).toBe(1000 - decorItem('wall_mint').price!);
    expect(bought.decor.owned).toContain('wall_mint');
    expect(activeDecor(bought, 'wall')?.id).toBe('wall_mint');
  });

  it('без денег, повторно и за Stars купить нельзя', () => {
    expect(buyDecor({ ...newGame(), money: 10 }, 'floor_wood')).toBeNull();
    const once = buyDecor({ ...newGame(), money: 5000 }, 'rug_red')!;
    expect(buyDecor(once, 'rug_red')).toBeNull();
    expect(buyDecor({ ...newGame(), money: 99999 }, 'floor_gold')).toBeNull();
  });

  it('можно переставить купленное и убрать', () => {
    let state = { ...newGame(), money: 5000 };
    state = buyDecor(state, 'floor_wood')!;
    state = buyDecor(state, 'floor_checker')!;
    expect(activeDecor(state, 'floor')?.id).toBe('floor_checker');
    state = setDecor(state, 'floor', 'floor_wood')!;
    expect(activeDecor(state, 'floor')?.id).toBe('floor_wood');
    state = setDecor(state, 'floor', null)!;
    expect(activeDecor(state, 'floor')).toBeUndefined();
    expect(setDecor(state, 'floor', 'floor_marble')).toBeNull();
    expect(setDecor(state, 'wall', 'floor_wood')).toBeNull();
  });

  it('у каждой вещи есть цена в монетах или в Stars', () => {
    for (const d of DECOR) expect((d.price ?? 0) > 0 || (d.stars ?? 0) > 0).toBe(true);
  });
});

describe('оформление за монеты: второй набор и цены', () => {
  const coinItems = DECOR.filter((d) => d.price !== undefined);

  it('за монеты — не меньше 30 вещей, и мелочью они больше не стоят', () => {
    expect(coinItems.length).toBeGreaterThanOrEqual(30);
    for (const d of coinItems) expect(d.price!).toBeGreaterThanOrEqual(600);
    // Есть на что копить и в большом магазине.
    expect(Math.max(...coinItems.map((d) => d.price!))).toBeGreaterThanOrEqual(5000);
  });

  it('новые виды: на прилавок и у входа — в списке разделов', () => {
    expect(DECOR_KINDS).toContain('counter');
    expect(DECOR_KINDS).toContain('outdoor');
    for (const kind of DECOR_KINDS) expect(DECOR.some((d) => d.kind === kind)).toBe(true);
  });

  it('каждая картинка оформления есть в списке текстур и лежит в public/assets', () => {
    const files = Object.keys(import.meta.glob('../public/assets/*.png'));
    // Наряды хозяина — слои костюма (scenes/wardrobe), а не отдельная картинка.
    for (const d of DECOR) {
      if (!d.texture || d.kind === 'outfit') continue;
      expect(TEXTURES).toContain(d.texture);
      expect(files).toContain(`../public/assets/${d.texture}.png`);
    }
  });

  it('у каждой вещи и раздела есть название на обоих языках', () => {
    for (const d of DECOR) {
      expect(ru[d.nameKey]).toBeTruthy();
      expect(en[d.nameKey]).toBeTruthy();
    }
    for (const kind of DECOR_KINDS) {
      const key = `decor.kind.${kind}` as TextKey;
      expect(ru[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
  });

  it('купленное раньше остаётся купленным и стоит на месте', () => {
    const saved = { owned: ['wall_mint', 'rug_red', 'plants_big', 'floor_gold'] as DecorId[], active: { wall: 'wall_mint', rug: 'rug_red' } as DecorState['active'] };
    const decor = normalizeDecor(saved);
    expect(decor.owned).toEqual(saved.owned);
    expect(decor.active).toEqual(saved.active);
  });

  it('новые вещи покупаются и ставятся в свой раздел', () => {
    let state = { ...newGame(), money: 20000 };
    state = buyDecor(state, 'counter_piggy')!;
    state = buyDecor(state, 'out_planters')!;
    expect(activeDecor(state, 'counter')?.id).toBe('counter_piggy');
    expect(activeDecor(state, 'outdoor')?.id).toBe('out_planters');
    expect(state.money).toBe(20000 - decorItem('counter_piggy').price! - decorItem('out_planters').price!);
  });
});
