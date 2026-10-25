import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { activeDecor, buyDecor, DECOR, decorFromPurchases, decorItem, grantDecor, setDecor, STAR_PACKS } from '../src/game/decor';
import { restartGame } from '../src/game/restart';

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

  it('у каждой вещи есть цена в монетах или в Stars, набор за звёзды или праздник, который её дарит', () => {
    for (const d of DECOR) expect((d.price ?? 0) > 0 || (d.stars ?? 0) > 0 || (d.pack !== undefined && STAR_PACKS[d.pack]?.items.includes(d.id)) || d.holiday !== undefined).toBe(true);
  });

  it('праздничное не купить, но после «Начать заново» оно остаётся — как и купленное за звёзды', () => {
    let state = { ...newGame(), money: 99999 };
    expect(buyDecor(state, 'holiday_tree')).toBeNull();
    expect(buyDecor(state, 'sign_frost')).toBeNull();
    state = grantDecor(state, ['holiday_tree', ...decorFromPurchases(['pack_newyear', 'ghost'])]);
    expect(state.decor.owned).toEqual(['holiday_tree', 'sign_frost', 'wall_winter']);
    expect(activeDecor(state, 'holiday')?.id).toBe('holiday_tree');
    const again = restartGame(state);
    expect(again.decor.owned).toEqual(['holiday_tree', 'sign_frost', 'wall_winter']);
    expect(activeDecor(again, 'holiday')?.id).toBe('holiday_tree');
  });
});
