import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { friendState, shopSnapshot } from '../src/game/friendShop';

describe('в гости к другу', () => {
  it('снимок своего магазина превращается обратно в тот же зал', () => {
    const mine: StoreState = {
      ...newGame(),
      level: 2,
      shopName: 'У Ани',
      shelves: [{ kind: 'bakery', level: 2, items: { bread: [{ age: 1 }, { age: 0 }] } }],
      slotPos: { level: 2, at: [{ x: 10, y: 20 }] },
      tillPos: { level: 2, dx: -8 },
    };
    const home = { ...newGame(), money: 777 };
    const guest = friendState(JSON.parse(JSON.stringify(shopSnapshot(mine))), home)!;
    expect(guest.level).toBe(2);
    expect(guest.shopName).toBe('У Ани');
    expect(guest.shelves[0].items.bread).toHaveLength(2);
    expect(guest.slotPos).toEqual(mine.slotPos);
    expect(guest.tillPos).toEqual(mine.tillPos);
    // Деньги — свои, чужие на экране не показываем.
    expect(guest.money).toBe(777);
  });

  it('чужой снимок проверяется: лишнее отбрасывается, числа ограничены', () => {
    const home = newGame();
    expect(friendState(null, home)).toBeNull();
    expect(friendState('x', home)).toBeNull();
    const guest = friendState(
      {
        level: 99,
        rating: 'много',
        shelves: [{ kind: 'toString', items: {} }, { kind: 'bakery', level: 50, items: { bread: 1e9, hacker: 3 } }, 'мусор'],
        decor: { owned: 'нет', active: { wall: 'нет-такого' } },
        tillPos: { level: 1, dx: 500 },
        shopName: 'x'.repeat(100),
      },
      home,
    )!;
    expect(guest.level).toBe(5);
    expect(guest.rating).toBe(3);
    expect(guest.shelves).toHaveLength(1);
    expect(guest.shelves[0].level).toBe(4);
    expect(guest.shelves[0].items.bread).toHaveLength(60);
    expect(Object.keys(guest.shelves[0].items)).toEqual(['bread']);
    expect(guest.decor.owned).toEqual([]);
    expect(guest.tillPos?.dx).toBe(0);
    expect(guest.shopName).toHaveLength(16);
  });
});
