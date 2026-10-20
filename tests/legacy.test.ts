import { describe, expect, it } from 'vitest';
import { buyStock, hire, newGame, type StaffMember, type StoreState } from '../src/game/economy';
import { buyPerk, canSell, legacyOf, perkCost, salePoints, sellBusiness } from '../src/game/legacy';
import { restartGame } from '../src/game/restart';
import { guestFactor } from '../src/game/day';
import { CHAPTERS } from '../src/game/story';

const done = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  level: 4,
  money: 50000,
  totalRevenue: 1_000_000,
  story: { chapter: CHAPTERS.length, introSeen: true, ordersDone: 0, inspectionsPassed: 0 },
  ...patch,
});

describe('наследие: продать бизнес и начать заново', () => {
  it('продать можно только универмаг после сюжета', () => {
    expect(canSell(done())).toBe(true);
    expect(canSell(done({ level: 3 }))).toBe(false);
    expect(canSell(done({ story: { chapter: 2, introSeen: true, ordersDone: 0, inspectionsPassed: 0 } }))).toBe(false);
    expect(sellBusiness(done({ level: 2 }))).toBeNull();
  });

  it('очки: корень из выручки за всё время; поколение растёт', () => {
    expect(salePoints(done())).toBe(10);
    expect(salePoints(done({ totalRevenue: 4_000_000 }))).toBe(20);
    // Деньги в кассе — вдвое: накопленное в конце игры не пропадает.
    expect(salePoints(done({ money: 1_500_000 }))).toBe(20);
    const sold = sellBusiness(done())!;
    expect(legacyOf(sold)).toMatchObject({ gen: 1, points: 10 });
  });

  it('бонусы стоят 1, 2, 3… очка и остаются в новом магазине', () => {
    let s = sellBusiness(done())!;
    expect(perkCost(s, 'capital')).toBe(1);
    s = buyPerk(s, 'capital')!;
    s = buyPerk(s, 'capital')!;
    s = buyPerk(s, 'fame')!;
    expect(legacyOf(s).points).toBe(10 - 1 - 2 - 1);
    const fresh = restartGame(s);
    expect(fresh.level).toBe(0);
    expect(fresh.money).toBe(newGame().money + 1000);
    expect(fresh.rating).toBeCloseTo(newGame().rating + 0.2);
    expect(legacyOf(fresh)).toMatchObject({ gen: 1, points: 6 });
  });

  it('новый магазин не даёт забрать награды недели второй раз и не теряет пропуск', () => {
    const pass = { season: 1, xp: 420, free: [1, 2], premium: [] as number[], paid: true };
    const fresh = restartGame({ ...done(), duelClaimed: 30, guildClaimed: 30, rushClaimed: 29, pass } as StoreState);
    expect(fresh).toMatchObject({ duelClaimed: 30, guildClaimed: 30, rushClaimed: 29 });
    expect(fresh.pass).toEqual(pass);
  });

  it('не хватает очков — нельзя', () => {
    const s = { ...done(), legacy: { gen: 1, points: 0, perks: {} } };
    expect(buyPerk(s, 'crowd')).toBeNull();
  });

  it('поставщики, слава и наставник работают в игре', () => {
    const base = newGame();
    const perks = { ...base, legacy: { gen: 1, points: 0, perks: { suppliers: 5, crowd: 5, mentor: 2 } } };
    expect(base.money - buyStock(base, 'bread', 10, 10)!.money).toBe(100);
    expect(perks.money - buyStock(perks, 'bread', 10, 10)!.money).toBe(85);
    expect(guestFactor(perks) / guestFactor(base)).toBeCloseTo(1.2);
    const member: StaffMember = { role: 'cashier', name: 0, skill: 1, wage: 360, months: 0 };
    expect(hire({ ...perks, level: 1 }, member)!.staff[0].skill).toBe(3);
  });
});
