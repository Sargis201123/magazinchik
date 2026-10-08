import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { activeDecor, buyDecor, DECOR, decorItem, setDecor } from '../src/game/decor';

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
    const once = buyDecor({ ...newGame(), money: 1000 }, 'rug_red')!;
    expect(buyDecor(once, 'rug_red')).toBeNull();
    expect(buyDecor({ ...newGame(), money: 99999 }, 'floor_gold')).toBeNull();
  });

  it('можно переставить купленное и убрать', () => {
    let state = { ...newGame(), money: 2000 };
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
