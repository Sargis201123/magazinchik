import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { addPassXp, claimPass, ensureSeason, grantPass, passCoins, passDecor, passItem, passLevel, passReady, PASS_STARS, seasonDaysLeft, seasonOf, XP_PER_LEVEL } from '../src/game/pass';
import { catalogItem, PASS_STARS as SERVER_PASS_STARS, itemFromPayload, ownedFrom } from '../api/_lib/telegram';

const DAY = 24 * 3600_000;
const START = Date.UTC(2026, 9, 19);

describe('сезонный пропуск', () => {
  it('сезоны по 28 дней с 19 октября; новый сезон — с нуля', () => {
    expect(seasonOf(START)).toBe(1);
    expect(seasonOf(START + 27 * DAY)).toBe(1);
    expect(seasonOf(START + 28 * DAY)).toBe(2);
    expect(seasonDaysLeft(START)).toBe(28);
    let s = ensureSeason(newGame(), START);
    s = { ...s, pass: { ...s.pass!, xp: 500, free: [1] } };
    expect(ensureSeason(s, START + DAY)).toBe(s);
    expect(ensureSeason(s, START + 28 * DAY).pass).toEqual({ season: 2, xp: 0, free: [], premium: [] });
  });

  it('очки за ночь и награды: бесплатно — монеты, премиум — вдвое и декор', () => {
    let s: StoreState = { ...ensureSeason(newGame(), START), level: 2 };
    s = addPassXp(s, 3, 1);
    expect(s.pass!.xp).toBe(10 + 15 + 20);
    s = { ...s, pass: { ...s.pass!, xp: XP_PER_LEVEL * 10 } };
    expect(passLevel(s.pass!)).toBe(10);
    expect(passReady(s)).toBe(10);
    expect(claimPass(s, 11, 'free')).toBeNull();
    expect(claimPass(s, 10, 'premium')).toBeNull();
    const money = s.money;
    s = claimPass(s, 10, 'free')!;
    expect(s.money).toBe(money + passCoins(s, 10));
    expect(claimPass(s, 10, 'free')).toBeNull();
    s = grantPass(s, [passItem(1)]);
    expect(s.pass!.paid).toBe(true);
    const decor = passDecor(s, 10)!;
    expect(decor).toBeTruthy();
    s = claimPass(s, 10, 'premium')!;
    expect(s.decor.owned).toContain(decor);
    expect(s.money).toBe(money + passCoins(s, 10) * 3);
  });

  it('сервер продаёт пропуск сезона по той же цене', () => {
    expect(SERVER_PASS_STARS).toBe(PASS_STARS);
    expect(catalogItem('pass_3')).toMatchObject({ stars: PASS_STARS });
    expect(catalogItem('pass_x')).toBeUndefined();
    expect(itemFromPayload('decor:pass_3')).toBe('pass_3');
    const tx = { id: 'a', amount: PASS_STARS, source: { type: 'user', user: { id: 7 }, invoice_payload: 'decor:pass_3' } };
    expect(ownedFrom([tx], 7)).toEqual(['pass_3']);
  });
});
