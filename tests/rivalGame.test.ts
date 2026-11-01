import { describe, expect, it } from 'vitest';
import { newGame, type StaffMember, type StoreState } from '../src/game/economy';
import { friendState } from '../src/game/friendShop';
import {
  applyPranks,
  bonusGuests,
  bossLeft,
  bossShop,
  MAX_BONUS_GUESTS,
  MAX_LOST,
  MAX_SPILLS,
  MAX_TRASH,
  messToday,
  PRANK_COINS,
  RIVAL_ACTIONS,
  takeRivalDay,
  usePrank,
  type PrankIn,
} from '../src/game/rival';

const base = (): StoreState => ({ ...newGame(), day: 20, money: 1000 });
const hire = (s: StoreState, ...roles: StaffMember['role'][]): StoreState => ({ ...s, staff: roles.map((role) => ({ role }) as StaffMember) });
const prank = (p: Partial<PrankIn>): PrankIn => ({ key: 'abcdefabcdefabcd', name: 'Петя', spill: 0, trash: 0, lure: 0, ...p });

describe('«Заглянуть к конкуренту»', () => {
  it('проделки у босса: монеты, RIVAL_ACTIONS в день, позванные гости — назавтра', () => {
    let s = base();
    expect(bossLeft(s)).toBe(RIVAL_ACTIONS);
    s = usePrank(s, 'spill', true);
    s = usePrank(s, 'lure', true);
    s = usePrank(s, 'lure', false);
    expect(s.money).toBe(1000 + PRANK_COINS.spill + 2 * PRANK_COINS.lure);
    expect(bossLeft(s)).toBe(RIVAL_ACTIONS - 2);
    expect(bonusGuests(s)).toBe(0);
    const next = { ...s, day: 21 };
    expect(bonusGuests(next)).toBe(2);
    expect(bossLeft(next)).toBe(RIVAL_ACTIONS);
    // Гостей не больше MAX_BONUS_GUESTS, и при открытии они забираются один раз.
    let many = base();
    for (let i = 0; i < 6; i++) many = usePrank(many, 'lure', false);
    expect(bonusGuests({ ...many, day: 21 })).toBe(MAX_BONUS_GUESTS);
    const opened = takeRivalDay(next);
    expect(bonusGuests(opened)).toBe(0);
    expect(takeRivalDay(opened)).toBe(opened);
  });

  it('без защиты — лужи и мусор к открытию (с потолком) и подсказка про охрану', () => {
    const { state, news } = applyPranks(base(), [prank({ spill: 2, trash: 1, lure: 1 }), prank({ key: 'b'.repeat(16), name: 'Оля', spill: 2, trash: 4, lure: 3 })]);
    expect(messToday(state)).toEqual({ day: 20, spill: MAX_SPILLS, trash: MAX_TRASH, lost: MAX_LOST });
    expect(news?.hint).toBe(true);
    expect(news?.helped).toEqual([]);
    expect(news?.visitors.map((v) => v.name)).toEqual(['Петя', 'Оля']);
    // Денег не убывает.
    expect(state.money).toBe(1000);
    expect(applyPranks(base(), []).news).toBeNull();
  });

  it('охранник не пускает мусорить, камеры и уборщица — вдвое меньше', () => {
    const p = [prank({ spill: 2, trash: 3, lure: 1 })];
    const guarded = applyPranks(hire(base(), 'guard'), p);
    expect(messToday(guarded.state)).toEqual({ day: 20, spill: 0, trash: 0, lost: 1 });
    expect(guarded.news?.helped).toEqual(['guard']);
    expect(guarded.news?.hint).toBe(false);
    const cleaner = applyPranks(hire(base(), 'cleaner'), p);
    expect(messToday(cleaner.state)).toMatchObject({ spill: 1, trash: 1 });
    expect(cleaner.news?.helped).toEqual(['cleaner']);
    const both = applyPranks({ ...hire(base(), 'cleaner'), gear: { cameras: 1 } }, p);
    expect(messToday(both.state)).toMatchObject({ spill: 0, trash: 0 });
    expect(both.news?.helped).toEqual(['cameras', 'cleaner']);
  });

  it('открытие забирает беспорядок дня', () => {
    const { state } = applyPranks(base(), [prank({ trash: 2 })]);
    expect(messToday(takeRivalDay(state))).toBeNull();
  });

  it('магазин босса строится из нашего зала и читается как магазин друга', () => {
    const home = base();
    const shop = friendState(bossShop(home, 'Ларёк Эдуарда — очень длинное', 4.1), home);
    expect(shop?.shopName).toBe('Ларёк Эдуарда — '.slice(0, 16));
    expect(shop?.rating).toBe(4.1);
    expect(shop?.shelves.length).toBe(home.shelves.length);
    expect(shop?.money).toBe(home.money);
  });
});

describe('«Заглянуть к конкуренту»: магазин уже открыт', () => {
  it('проделки, пришедшие днём, ждут завтрашнего открытия', () => {
    const { state } = applyPranks(base(), [prank({ trash: 1 })], 21);
    expect(messToday(state)).toBeNull();
    expect(messToday(takeRivalDay(state))).toBeNull();
    expect(messToday({ ...takeRivalDay(state), day: 21 })).toMatchObject({ trash: 1 });
  });
});
