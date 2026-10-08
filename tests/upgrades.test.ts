import { describe, expect, it } from 'vitest';
import { buyUpgrade, hasUpgrade, TERMINAL_PAY, withUpgrades } from '../src/game/upgrades';
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
});
