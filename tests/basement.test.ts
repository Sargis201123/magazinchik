import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { billTotal, emptyDayStats, monthlyBill, newGame, STORE_LEVELS, warehouseCapacity, type StoreState } from '../src/game/economy';
import { buyFloor, finishCost, finishFloor, floorAvailable, floorLock, floorOf, FLOORS, hasFloor, openFloors } from '../src/game/floors';
import {
  BACK_PAWN_SLOTS,
  basementGuests,
  basementNight,
  basementOf,
  buyPart,
  buySlot,
  COLD_POWER,
  COLD_ROOM,
  MOMS_PER_SLOT,
  PARTS,
  RACKET_SLOT_SHARE,
  RAID_COOLDOWN,
  RAID_GOODWILL,
  RAID_GRACE,
  RAID_RATING,
  raidChance,
  raidFine,
  raidLock,
  sellSlot,
  SLOT_COST,
  SLOT_PLACES,
  SLOT_RESALE,
  slotIncome,
  slotPlaces,
  slotsPlan,
} from '../src/game/basement';
import { pawnSlots } from '../src/game/pawnshop';
import { guestsToday, nightCycle } from '../src/game/day';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { simulate } from '../src/game/simulate';

// Подвал (floors.ts + basement.ts, 13.11): этажи здания, автоматы с ценой для репутации, облавы, «крыша»,
// склад-холодильник и подсобка ломбарда. Всё — от зерна магазина и дня; старые сохранения — без изменений.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: 2, money: 20000, debt: 0, rating: 4, seed: 11, ...over });
/** Подвал открыт (отделка finish) и в нём n автоматов, стоящих с дня since. */
const cellar = (n: number, over: Partial<StoreState> = {}, finish = 1, since = 40): StoreState =>
  shop({ floors: { basement: { since: 30, finish } }, basement: { slots: n, ...(n ? { since } : {}) }, ...over });
/** Первый день от from, когда у этого подвала случится облава. */
const raidDay = (s: StoreState, from = 50): number => {
  for (let d = from; d < from + 5000; d++) if (basementNight({ ...s, day: d }).day?.raid) return d;
  throw new Error('облавы нет');
};
const quietDay = (s: StoreState, from = 50): number => {
  for (let d = from; d < from + 500; d++) if (!basementNight({ ...s, day: d }).day?.raid) return d;
  throw new Error('всё время облавы');
};

describe('этажи здания', () => {
  it('подвал открывается с «Минимаркета», не в Заречье и один раз', () => {
    expect(floorLock(shop({ level: FLOORS.basement.minLevel - 1 }), 'basement')).toBe('level');
    expect(floorAvailable(shop(), 'basement')).toBe(true);
    expect(floorLock(shop({ zar: { at: 'zar' } as StoreState['zar'] }), 'basement')).toBe('zar');
    const opened = buyFloor(shop(), 'basement')!;
    expect(opened.money).toBe(20000 - FLOORS.basement.cost);
    expect(opened.floors?.basement).toEqual({ since: 60, finish: 0 });
    expect(hasFloor(opened, 'basement')).toBe(true);
    expect(openFloors(opened)).toEqual(['basement']);
    expect(buyFloor(opened, 'basement')).toBeNull();
    expect(buyFloor(shop({ money: FLOORS.basement.cost - 1 }), 'basement')).toBeNull();
    expect(buyFloor(shop({ level: 1 }), 'basement')).toBeNull();
  });

  it('отделка: по ступеням, за деньги, до последней', () => {
    const s = buyFloor(shop(), 'basement')!;
    expect(finishCost(s, 'basement')).toBe(FLOORS.basement.finish[0]);
    const done = finishFloor(s, 'basement')!;
    expect(floorOf(done, 'basement')?.finish).toBe(1);
    expect(done.money).toBe(s.money - FLOORS.basement.finish[0]);
    expect(finishCost(done, 'basement')).toBeNull();
    expect(finishFloor(done, 'basement')).toBeNull();
    expect(finishFloor(shop(), 'basement')).toBeNull();
  });

  it('кривая отделка в сохранении не ломает подвал', () => {
    const s = shop({ floors: { basement: { since: 1, finish: 99 } } });
    expect(floorOf(s, 'basement')?.finish).toBe(FLOORS.basement.finish.length);
    expect(slotPlaces(s)).toBe(SLOT_PLACES[SLOT_PLACES.length - 1]);
    expect(basementOf(shop({ floors: { basement: { since: 1, finish: 0 } }, basement: { slots: 77 } }))?.slots).toBe(SLOT_PLACES[SLOT_PLACES.length - 1]);
  });
});

describe('старое сохранение без этажей', () => {
  it('всё как раньше: гости, склад, счета, ломбард, вечер', () => {
    const old = shop();
    expect(old.floors).toBeUndefined();
    expect(basementOf(old)).toBeNull();
    expect(basementGuests(old)).toBe(1);
    expect(warehouseCapacity(old)).toBe(STORE_LEVELS[2].warehouse);
    expect(pawnSlots(old)).toBe(2);
    expect(basementNight(old)).toEqual({ state: old, day: null });
    expect(nightCycle(old, emptyDayStats(), () => 0.5).slots).toBeNull();
  });

  describe('загрузка', () => {
    let local: Record<string, string> = {};
    beforeEach(() => {
      local = {};
      Object.assign(globalThis, {
        localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
      });
    });
    afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

    it('сохранение без floors грузится без подвала, а подвал переживает сохранение', async () => {
      const { loadGame, saveGame } = await import('../src/game/save');
      local['magazinchik.save'] = JSON.stringify({ version: 11, state: shop() });
      const loaded = loadGame()!;
      expect(loaded.floors).toBeUndefined();
      expect(loaded.basement).toBeUndefined();
      expect(hasFloor(loaded, 'basement')).toBe(false);
      saveGame(cellar(3, { basement: { slots: 3, since: 40, parts: ['cold'] } }));
      const back = loadGame()!;
      expect(back.basement).toEqual({ slots: 3, since: 40, parts: ['cold'] });
      expect(back.floors).toEqual({ basement: { since: 30, finish: 1 } });
    });
  });
});

describe('автоматы', () => {
  it('ставят до мест подвала: в голом — два, после ремонта — четыре', () => {
    let s = cellar(0, {}, 0);
    for (let i = 0; i < SLOT_PLACES[0]; i++) s = buySlot(s)!;
    expect(basementOf(s)?.slots).toBe(SLOT_PLACES[0]);
    expect(s.money).toBe(20000 - SLOT_PLACES[0] * SLOT_COST);
    expect(buySlot(s)).toBeNull();
    s = finishFloor(s, 'basement')!;
    s = buySlot(buySlot(s)!)!;
    expect(basementOf(s)?.slots).toBe(4);
    expect(buySlot(s)).toBeNull();
    expect(buySlot(shop())).toBeNull();
    expect(buySlot(cellar(0, { money: SLOT_COST - 1 }))).toBeNull();
  });

  it('первый автомат запоминает день — от него неделя без облав', () => {
    const s = buySlot(cellar(0))!;
    expect(basementOf(s)?.since).toBe(60);
    expect(basementOf(buySlot(s)!)?.since).toBe(60);
    expect(raidChance(s)).toBe(0);
    expect(raidChance({ ...s, day: 60 + RAID_GRACE - 1 })).toBe(0);
    expect(raidChance({ ...s, day: 60 + RAID_GRACE })).toBeGreaterThan(0);
  });

  it('убрать — за полцены; последний убрали — дня установки больше нет', () => {
    const s = sellSlot(cellar(1))!;
    expect(s.money).toBe(20000 + SLOT_COST * SLOT_RESALE);
    expect(basementOf(s)?.slots).toBe(0);
    expect(basementOf(s)?.since).toBeUndefined();
    expect(sellSlot(s)).toBeNull();
  });

  it('мамы с детьми обходят магазин: гостей меньше на 3% за автомат', () => {
    expect(basementGuests(cellar(0))).toBe(1);
    expect(basementGuests(cellar(4))).toBeCloseTo(1 - 4 * MOMS_PER_SLOT);
    expect(guestsToday(cellar(4))).toBeLessThan(guestsToday(cellar(0)));
    // В Заречье подвал Центра закрыт — и не пугает гостей второго магазина.
    expect(basementGuests(cellar(4, { zar: { at: 'zar' } as StoreState['zar'] }))).toBe(1);
  });

  it('вечер: деньги в кассу, прогноз утра совпадает с вечером, всё от зерна и дня', () => {
    const s = cellar(3, {}, 1, 40);
    const day = quietDay(s);
    const at = { ...s, day };
    const plan = slotsPlan(at)!;
    const night = basementNight(at);
    expect(night.day).toEqual({ ...plan });
    expect(night.state.money).toBe(at.money + plan.income);
    expect(basementOf(night.state)?.earned).toBe(plan.income);
    expect(basementOf(night.state)?.last).toEqual({ ...plan, day });
    // Тот же день — тот же итог; доход в своих рамках.
    expect(basementNight(at)).toEqual(night);
    expect(plan.income).toBeGreaterThanOrEqual(Math.round((3 * slotIncome(2) * 0.7) / 10) * 10);
    expect(plan.income).toBeLessThanOrEqual(Math.round((3 * slotIncome(2) * 1.3) / 10) * 10);
    expect(plan.players).toBeGreaterThanOrEqual(6);
    expect(plan.players).toBeLessThanOrEqual(12);
    // Другое зерно — другой вечер (хотя бы в один из дней).
    const other = Array.from({ length: 10 }, (_, k) => slotsPlan({ ...at, seed: 99, day: day + k })!.income);
    const mine = Array.from({ length: 10 }, (_, k) => slotsPlan({ ...at, day: day + k })!.income);
    expect(other).not.toEqual(mine);
  });

  it('«крыша», которой платят, забирает треть дохода автоматов', () => {
    const s = cellar(2, { racket: { from: 40, mode: 'pay', since: 41, rate: 4, paid: 100 } });
    const day = quietDay(s);
    const at = { ...s, day };
    const plan = slotsPlan(at)!;
    expect(plan.share).toBe(Math.round(plan.income * RACKET_SLOT_SHARE));
    const night = basementNight(at);
    expect(night.state.money).toBe(at.money + plan.income - plan.share);
    expect(night.state.racket?.paid).toBe(100 + plan.share);
    // Отказали или банду взяли — доли нет.
    expect(slotsPlan({ ...at, racket: { from: 40, mode: 'refuse', since: 41 } })!.share).toBe(0);
    expect(slotsPlan({ ...at, racket: { from: 40, mode: 'pay', since: 41, end: 'jailed' } })!.share).toBe(0);
  });

  it('нет автоматов или мы в Заречье — вечера у автоматов нет', () => {
    expect(basementNight(cellar(0)).day).toBeNull();
    const zar = cellar(3, { zar: { at: 'zar' } as StoreState['zar'] });
    expect(basementNight(zar)).toEqual({ state: zar, day: null });
  });
});

describe('облава', () => {
  it('изымает все автоматы, штраф, рейтинг и доброе имя — вниз; неделю новых не поставить', () => {
    const s = cellar(4, { goodwill: 10 });
    const day = raidDay(s);
    const at = { ...s, day };
    const night = basementNight(at);
    const fine = raidFine(4);
    expect(night.day).toEqual({ players: slotsPlan(at)!.players, income: 0, share: 0, raid: { fine, n: 4 } });
    expect(night.state.money).toBe(at.money - fine);
    expect(night.state.rating).toBeCloseTo(4 - RAID_RATING);
    expect(night.state.goodwill).toBe(10 + RAID_GOODWILL);
    const b = basementOf(night.state)!;
    expect(b.slots).toBe(0);
    expect(b.raid).toEqual({ day, fine, n: 4 });
    // Неделю после облавы новых не поставить; потом — можно.
    const next = { ...night.state, day: day + 1 };
    expect(raidLock(next)).toBe(day + RAID_COOLDOWN - 1);
    expect(buySlot(next)).toBeNull();
    expect(buySlot({ ...night.state, day: day + RAID_COOLDOWN })).not.toBeNull();
  });

  it('штраф больше кассы — недостача уходит в долг', () => {
    const s = cellar(4, { money: 100 });
    const day = raidDay(s);
    const night = basementNight({ ...s, day });
    expect(night.state.money).toBe(0);
    expect(night.state.debt).toBe(raidFine(4) - 100);
  });

  it('в первую неделю после установки облав не бывает', () => {
    const s = cellar(4, {}, 1, 100);
    for (let d = 100; d < 100 + RAID_GRACE; d++) expect(basementNight({ ...s, day: d }).day?.raid).toBeUndefined();
  });

  it('чем больше автоматов, тем чаще облавы: четыре — в среднем раз в полтора месяца', () => {
    const count = (n: number) => {
      const s = cellar(n, {}, 1, 0);
      let raids = 0;
      for (let d = 10; d < 4010; d++) if (basementNight({ ...s, day: d }).day?.raid) raids++;
      return raids / 4000;
    };
    const one = count(1);
    const four = count(4);
    expect(four).toBeGreaterThan(one);
    expect(four).toBeGreaterThan(0.015);
    expect(four).toBeLessThan(0.035);
  });
});

describe('склад-холодильник и подсобка ломбарда', () => {
  it('холодильник: склад больше на 40%, свет — как ещё один холодильник', () => {
    const s = cellar(0);
    const cold = buyPart(s, 'cold')!;
    expect(cold.money).toBe(s.money - PARTS.cold.cost);
    expect(warehouseCapacity(cold)).toBe(Math.round(STORE_LEVELS[2].warehouse * (1 + COLD_ROOM)));
    expect(billTotal(monthlyBill(cold)) - billTotal(monthlyBill(s))).toBe(COLD_POWER);
    expect(buyPart(cold, 'cold')).toBeNull();
    // В Заречье склад второго магазина — без подвала Центра.
    expect(warehouseCapacity({ ...cold, zar: { at: 'zar' } as StoreState['zar'] })).toBe(warehouseCapacity({ ...s, zar: { at: 'zar' } as StoreState['zar'] }));
  });

  it('подсобка: в залог на две вещи больше', () => {
    const s = cellar(0);
    const back = buyPart(s, 'back')!;
    expect(pawnSlots(back)).toBe(pawnSlots(s) + BACK_PAWN_SLOTS);
    expect(buyPart(shop(), 'back')).toBeNull();
    expect(buyPart(cellar(0, { money: PARTS.back.cost - 1 }), 'back')).toBeNull();
  });
});

describe('вечер дня и подсказка', () => {
  it('nightCycle кладёт доход автоматов в итог дня до счетов', () => {
    const s = cellar(2);
    const day = quietDay(s);
    const at = { ...s, day: day % 7 === 0 ? day + 1 : day };
    const plan = slotsPlan(at)!;
    const night = nightCycle(at, emptyDayStats(), () => 0.5);
    if (!basementNight(at).day?.raid) expect(night.slots).toEqual({ ...plan });
    expect(basementOf(night.state)?.last?.day).toBe(at.day);
  });

  it('первая подсказка — когда подвал можно открыть', () => {
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'basement');
    expect(pendingTip(shop({ level: 1, seenTips: others }))).toBeNull();
    expect(pendingTip(shop({ seenTips: others }))).toBe('basement');
    expect(pendingTip(shop({ seenTips: [...others, 'basement'] }))).toBeNull();
    expect(new Set(Object.values(TIP_ICONS)).size).toBe(Object.keys(TIP_ICONS).length);
  });

  it('симулятор с подвалом идёт до конца и открывает его', () => {
    const run = simulate({ days: 60, seed: 3, features: { basement: true } });
    expect(run.days.length).toBe(60);
    expect(hasFloor(run.final, 'basement')).toBe(true);
    expect(basementOf(run.final)?.parts).toContain('cold');
  });
});
