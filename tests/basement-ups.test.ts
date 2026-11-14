// Улучшения подвала (game/basement.ts BASEMENT_UPS на общей основе floors.ts, 14.11): неон — выручка автоматов,
// вытяжка — меньше уходят мамы с детьми, охрана — реже облавы. Цена, порядок ступеней, отделка, эффект, старые
// сохранения и то, что всё по-прежнему зависит только от зерна и дня.
import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { buyFloorUp, FLOOR_UPGRADES, floorBonus, floorUpLock, floorUps, type Floor } from '../src/game/floors';
import { basementGuests, basementNight, BASEMENT_UPS, MOMS_PER_SLOT, RAID_BASE, RAID_PER_SLOT, raidChance, slotsPlan } from '../src/game/basement';
import { ru } from '../src/i18n/ru';

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: 3, money: 20000, debt: 0, rating: 4, seed: 11, ...over });
/** Подвал с n автоматами (стоят давно — облавы возможны), отделка finish, купленные улучшения up. */
const cellar = (n: number, up?: string[], finish = 1, over: Partial<StoreState> = {}): StoreState => {
  const floor: Floor = { since: 30, finish, ...(up ? { up } : {}) };
  return shop({ floors: { basement: floor }, basement: { slots: n, ...(n ? { since: 30 } : {}) }, ...over });
};
const price = (id: string): number => BASEMENT_UPS.find((u) => u.id === id)!.price;

describe('улучшения подвала: список и правила', () => {
  it('три ступени в меню этажа: неон → вытяжка → охрана', () => {
    expect(FLOOR_UPGRADES.basement.map((u) => u.id)).toEqual(['neon', 'vent', 'guard']);
    expect(BASEMENT_UPS.map((u) => u.needs)).toEqual([undefined, 'neon', 'vent']);
    expect(BASEMENT_UPS.every((u, i) => i === 0 || u.price > BASEMENT_UPS[i - 1].price)).toBe(true);
  });

  it('у каждого улучшения есть название и описание (ключи fup.basement.*; остальные языки сверяет i18n.test)', () => {
    const keys = new Set(Object.keys(ru));
    for (const u of BASEMENT_UPS) {
      expect(keys.has(`fup.basement.${u.id}`)).toBe(true);
      expect(keys.has(`fup.basement.${u.id}.note`)).toBe(true);
    }
  });

  it('порядок: сначала неон, потом вытяжка; охрана — после вытяжки и только после отделки', () => {
    expect(floorUpLock(cellar(2), 'basement', 'neon')).toBeNull();
    expect(floorUpLock(cellar(2), 'basement', 'vent')).toBe('needs');
    expect(floorUpLock(cellar(2, ['neon']), 'basement', 'vent')).toBeNull();
    expect(floorUpLock(cellar(2, ['neon', 'vent'], 0), 'basement', 'guard')).toBe('finish');
    expect(floorUpLock(cellar(2, ['neon', 'vent'], 1), 'basement', 'guard')).toBeNull();
    expect(floorUpLock(cellar(2, ['neon'], 1), 'basement', 'guard')).toBe('needs');
    expect(floorUpLock(shop(), 'basement', 'neon')).toBe('closed');
    expect(floorUpLock(shop({ floors: { basement: { since: 1, finish: 0 } }, zar: { at: 'zar' } as StoreState['zar'] }), 'basement', 'neon')).toBe('closed');
  });

  it('покупка: цена списана, улучшение в сохранении этажа, второй раз не купить, денег мало — нельзя', () => {
    const s = cellar(2);
    const a = buyFloorUp(s, 'basement', 'neon')!;
    expect(a.money).toBe(s.money - price('neon'));
    expect(floorUps(a, 'basement')).toEqual(['neon']);
    expect(a.floors?.basement?.finish).toBe(1);
    expect(buyFloorUp(a, 'basement', 'neon')).toBeNull();
    expect(buyFloorUp({ ...s, money: price('neon') - 1 }, 'basement', 'neon')).toBeNull();
    const b = buyFloorUp(buyFloorUp(a, 'basement', 'vent')!, 'basement', 'guard')!;
    expect(floorUps(b, 'basement')).toEqual(['neon', 'vent', 'guard']);
    expect(b.money).toBe(s.money - price('neon') - price('vent') - price('guard'));
  });
});

describe('улучшения подвала: что дают', () => {
  it('старое сохранение (нет поля up) — всё как раньше', () => {
    const old = cellar(4);
    expect(floorBonus(old, 'basement', 'slots')).toBe(0);
    expect(basementGuests(old)).toBeCloseTo(1 - MOMS_PER_SLOT * 4);
    expect(raidChance(old)).toBeCloseTo(RAID_BASE + RAID_PER_SLOT * 4);
    // Кривое поле — как будто ничего не куплено.
    const broken = cellar(4, 'neon' as unknown as string[]);
    expect(slotsPlan(broken)).toEqual(slotsPlan(old));
  });

  it('неон: вечерняя выручка автоматов +20%, завсегдатаев столько же', () => {
    for (let day = 60; day < 80; day++) {
      const plain = slotsPlan(cellar(4, undefined, 1, { day }))!;
      const lit = slotsPlan(cellar(4, ['neon'], 1, { day }))!;
      expect(lit.players).toBe(plain.players);
      expect(lit.income).toBeGreaterThan(plain.income);
      expect(Math.abs(lit.income - plain.income * 1.2)).toBeLessThanOrEqual(10);
    }
    // И деньги вечером приходят с неоном.
    const s = cellar(2, ['neon'], 1, { day: 61 });
    const night = basementNight(s);
    if (!night.day?.raid) expect(night.state.money - s.money).toBe(slotsPlan(s)!.income - slotsPlan(s)!.share);
  });

  it('вытяжка: мамы с детьми уходят на треть реже', () => {
    expect(basementGuests(cellar(4, ['neon', 'vent']))).toBeCloseTo(1 - MOMS_PER_SLOT * 4 * (2 / 3));
    expect(basementGuests(cellar(0, ['neon', 'vent']))).toBe(1);
  });

  it('охрана: облавы вдвое реже (и ни одной, где их не было)', () => {
    expect(raidChance(cellar(4, ['neon', 'vent', 'guard']))).toBeCloseTo((RAID_BASE + RAID_PER_SLOT * 4) / 2);
    expect(raidChance(cellar(0, ['neon', 'vent', 'guard']))).toBe(0);
    // За 2000 вечеров с охраной облав меньше, чем без неё.
    const raids = (up?: string[]): number => {
      let k = 0;
      for (let day = 100; day < 2100; day++) if (basementNight(cellar(4, up, 1, { day })).day?.raid) k++;
      return k;
    };
    expect(raids(['neon', 'vent', 'guard'])).toBeLessThan(raids());
  });

  it('всё — от зерна и дня: тот же вечер считается одинаково', () => {
    const s = cellar(3, ['neon', 'vent', 'guard'], 1, { day: 77 });
    expect(basementNight(s)).toEqual(basementNight(s));
    expect(slotsPlan(s)).toEqual(slotsPlan({ ...s }));
  });
});
