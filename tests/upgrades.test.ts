import { describe, expect, it } from 'vitest';
import { buyUpgrade, hasUpgrade, TERMINAL_PAY, UPGRADES, withUpgrades, type UpgradeId } from '../src/game/upgrades';
import { fillBargain, hasBargain } from '../src/game/bargain';
import { newGame } from '../src/game/economy';

describe('upgrades', () => {
  const rich = { ...newGame(), money: 10000, level: 2 };

  it('терминал ускоряет только оплату', () => {
    const s = buyUpgrade(rich, 'terminal')!;
    expect(hasUpgrade(s, 'terminal')).toBe(true);
    expect(withUpgrades(s, { item: 1, pay: 2 })).toEqual({ item: 1, pay: 2 * TERMINAL_PAY });
    expect(withUpgrades(rich, { item: 1, pay: 2 })).toEqual({ item: 1, pay: 2 });
  });

  it('нельзя купить дважды, без денег или раньше нужного уровня', () => {
    const s = buyUpgrade(rich, 'selfCheckout')!;
    expect(buyUpgrade(s, 'selfCheckout')).toBeNull();
    expect(buyUpgrade({ ...rich, money: 0 }, 'terminal')).toBeNull();
    expect(buyUpgrade({ ...rich, level: 1 }, 'selfCheckout')).toBeNull();
  });

  it('слишком дешёвые покупки подорожали; «Уценка» — с третьего помещения, доставка — с четвёртого, но купленное раньше остаётся', () => {
    expect(UPGRADES.loyalty.price).toBe(1500);
    expect(UPGRADES.bargain.price).toBe(900);
    expect(buyUpgrade({ ...rich, level: 1 }, 'bargain')).toBeNull();
    expect(buyUpgrade({ ...rich, level: 2 }, 'bargain')).not.toBeNull();
    expect(buyUpgrade({ ...rich, level: 2 }, 'delivery')).toBeNull();
    expect(buyUpgrade({ ...rich, level: 3 }, 'delivery')).not.toBeNull();
    // Старое сохранение: ларёк с полкой уценки и доставкой — всё работает, как работало.
    const old = { ...newGame(), upgrades: ['bargain', 'delivery'] as UpgradeId[] };
    expect(hasUpgrade(old, 'bargain') && hasBargain(old) && hasUpgrade(old, 'delivery')).toBe(true);
    const bread = old.shelves.find((sh) => (sh.items.bread?.length ?? 0) > 0);
    if (bread) {
      const aging = { ...old, shelves: old.shelves.map((sh) => (sh === bread ? { ...sh, items: { ...sh.items, bread: sh.items.bread!.map((u) => ({ ...u, age: 99 })) } } : sh)) };
      expect(fillBargain(aging).count).toBeGreaterThan(0);
    }
  });
});
