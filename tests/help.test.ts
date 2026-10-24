import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { HELP_REWARD, HELP_SCAN, HELP_THANKS, helpAsked, helpGiven, helpScan, markHelpAsked, takeHelp } from '../src/game/help';
import { withUpgrades } from '../src/game/upgrades';

describe('«Позвать на помощь»', () => {
  it('друзья откликнулись: монеты за каждого и быстрая касса — только в этот день', () => {
    const s = { ...newGame(), day: 12, money: 1000 };
    expect(takeHelp(s, 0)).toBe(s);
    const helped = takeHelp(s, 2);
    expect(helped.money).toBe(1000 + 2 * HELP_THANKS);
    expect(helpScan(helped)).toBe(HELP_SCAN);
    const timing = { item: 1, pay: 2 };
    const fast = withUpgrades(helped, timing);
    const usual = withUpgrades(s, timing);
    expect(fast.item).toBeCloseTo(usual.item / HELP_SCAN);
    expect(fast.pay).toBeCloseTo(usual.pay / HELP_SCAN);
    // Назавтра подмога кончилась.
    expect(helpScan({ ...helped, day: 13 })).toBe(1);
  });

  it('звал сегодня — второй раз кнопки нет; назавтра можно снова', () => {
    const s = { ...newGame(), day: 7 };
    expect(helpAsked(s)).toBe(false);
    const asked = markHelpAsked(s);
    expect(helpAsked(asked)).toBe(true);
    expect(helpAsked({ ...asked, day: 8 })).toBe(false);
  });

  it('помог другу — монеты за помощь', () => {
    const s = { ...newGame(), money: 50 };
    expect(helpGiven(s).money).toBe(50 + HELP_REWARD);
  });

  it('старое сохранение без новых полей: подмоги нет, звать можно', () => {
    const s = newGame();
    expect(s.helpDay).toBeUndefined();
    expect(helpScan(s)).toBe(1);
    expect(helpAsked(s)).toBe(false);
  });
});
