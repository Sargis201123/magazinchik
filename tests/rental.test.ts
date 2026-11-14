import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  buyStand,
  DEPOSIT_IDS,
  DEPOSITS,
  ITEM_COST,
  KIT_PRICE,
  RENTAL_CAP,
  RENTAL_FROM_DAY,
  RENTAL_FROM_LEVEL,
  rentalDay,
  rentalDemand,
  rentalKit,
  kitToday,
  rentalLook,
  rentalNight,
  rentalOf,
  rentalOpen,
  restockRental,
  setDeposit,
  STAND_COST,
  type Deposit,
} from '../src/game/rental';
import { guestsToday, nightCycle } from '../src/game/day';
import { weatherFor } from '../src/game/weather';
import { yearTime } from '../src/game/calendar';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { ru } from '../src/i18n/ru';
import { simulate } from '../src/game/simulate';

// Прокат у входа (rental.ts, 13.11): стойка, набор по погоде, деньги вечером, залог и пропавшие вещи.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, level: 2, money: 5000, debt: 0, rating: 4, seed: 7, ...over });
const rented = (deposit: Deposit = 'medium', over: Partial<StoreState> = {}): StoreState => shop({ rental: { stock: RENTAL_CAP, deposit }, ...over });
/** Первый день после day, когда погода такая (для набора и спроса). */
const dayWhen = (ok: (day: number) => boolean, from = 20): number => {
  for (let d = from; d < from + 400; d++) if (ok(d)) return d;
  throw new Error('нет такого дня');
};

describe('прокат: стойка', () => {
  it('открывается с «Магазинчика» и третьей недели, не в Заречье', () => {
    expect(rentalOpen(shop({ day: RENTAL_FROM_DAY - 1 }))).toBe(false);
    expect(rentalOpen(shop({ day: RENTAL_FROM_DAY, level: RENTAL_FROM_LEVEL - 1 }))).toBe(false);
    expect(rentalOpen(shop({ day: RENTAL_FROM_DAY, level: RENTAL_FROM_LEVEL }))).toBe(true);
    expect(buyStand(shop({ day: RENTAL_FROM_DAY - 1 }))).toBeNull();
  });

  it('стойку покупают один раз — сразу с полным набором и средним залогом', () => {
    const before = shop();
    const after = buyStand(before)!;
    expect(after.money).toBe(before.money - STAND_COST);
    expect(after.rental).toEqual({ stock: RENTAL_CAP, deposit: 'medium' });
    expect(buyStand(after)).toBeNull();
    expect(buyStand(shop({ money: STAND_COST - 1 }))).toBeNull();
  });

  it('докупка: сколько не хватает и сколько по карману', () => {
    const s = shop({ rental: { stock: 4, deposit: 'small' } });
    const full = restockRental(s, 99)!;
    expect(full.rental!.stock).toBe(RENTAL_CAP);
    expect(full.money).toBe(s.money - (RENTAL_CAP - 4) * ITEM_COST);
    const poor = restockRental({ ...s, money: ITEM_COST * 2 + 5 }, 99)!;
    expect(poor.rental!.stock).toBe(6);
    expect(poor.money).toBe(5);
    expect(restockRental(rented(), 1)).toBeNull();
    expect(restockRental(shop(), 1)).toBeNull();
    expect(restockRental({ ...s, money: ITEM_COST - 1 }, 1)).toBeNull();
  });

  it('залог меняется только на другой и только у стойки', () => {
    expect(setDeposit(rented('medium'), 'large')!.rental!.deposit).toBe('large');
    expect(setDeposit(rented('medium'), 'medium')).toBeNull();
    expect(setDeposit(shop(), 'small')).toBeNull();
    expect(setDeposit(rented(), 'huge' as Deposit)).toBeNull();
  });
});

describe('прокат: набор и спрос по погоде', () => {
  it('в дождь — зонты, в снег и зимой — санки, в остальные дни — колёса', () => {
    const rain = dayWhen((d) => weatherFor(d) === 'rain');
    const storm = dayWhen((d) => weatherFor(d) === 'storm');
    const snow = dayWhen((d) => weatherFor(d) === 'snow');
    const summer = dayWhen((d) => yearTime(d) === 'summer' && weatherFor(d) === 'clear');
    expect(rentalKit(rain)).toBe('rain');
    expect(rentalKit(storm)).toBe('rain');
    expect(rentalKit(snow)).toBe('winter');
    expect(rentalKit(summer)).toBe('wheels');
    expect(rentalDemand(rain)).toBeGreaterThan(rentalDemand(summer));
    expect(rentalDemand(snow)).toBeGreaterThan(1);
  });

  it('летом катаются охотнее, чем осенью', () => {
    const summer = dayWhen((d) => yearTime(d) === 'summer' && weatherFor(d) === 'clear');
    const autumn = dayWhen((d) => yearTime(d) === 'autumn' && weatherFor(d) === 'clear');
    expect(rentalDemand(summer)).toBeGreaterThan(rentalDemand(autumn));
  });

  it('беда района меняет набор: в буран — санки, в паводок — зонты, и спрос вслед за погодой', () => {
    const summer = dayWhen((d) => yearTime(d) === 'summer' && weatherFor(d) === 'clear');
    const calm = rented('medium', { day: summer });
    const flood = { ...calm, crisis: { kind: 'flood' as const, from: summer, days: 3 } };
    const blizzard = { ...calm, crisis: { kind: 'blizzard' as const, from: summer, days: 3 } };
    expect(kitToday(calm)).toBe('wheels');
    expect(kitToday(flood)).toBe('rain');
    expect(kitToday(blizzard)).toBe('winter');
    expect(rentalDay(flood, 100)!.kit).toBe('rain');
    // Зонтов в ливень паводка берут больше, чем колёс в ясный день (прохожих столько же).
    expect(rentalDay({ ...flood, rental: { stock: RENTAL_CAP, deposit: 'medium' } }, 60)!.rented).toBeGreaterThanOrEqual(rentalDay(calm, 60)!.rented);
  });
});

describe('прокат: день', () => {
  it('одинаковое зерно и день — одинаковый итог; другой день — свой', () => {
    const s = rented('small');
    expect(rentalDay(s, 80)).toEqual(rentalDay({ ...s }, 80));
    const days = Array.from({ length: 30 }, (_, i) => JSON.stringify(rentalDay({ ...s, day: 40 + i }, 80)));
    expect(new Set(days).size).toBeGreaterThan(5);
  });

  it('берут не больше, чем вещей на стойке; без стойки и в Заречье — ничего', () => {
    const s = shop({ rental: { stock: 3, deposit: 'small' } });
    for (let d = 20; d < 80; d++) expect(rentalDay({ ...s, day: d }, 500)!.rented).toBeLessThanOrEqual(3);
    expect(rentalDay(shop({ rental: { stock: 0, deposit: 'small' } }), 500)!.rented).toBe(0);
    expect(rentalDay(shop(), 100)).toBeNull();
    expect(rentalDay(rented('medium', { zar: { at: 'zar' } as StoreState['zar'] }), 100)).toBeNull();
  });

  it('прохожих больше — берут больше', () => {
    const s = rented();
    let few = 0;
    let many = 0;
    for (let d = 20; d < 120; d++) {
      few += rentalDay({ ...s, day: d }, 30)!.rented;
      many += rentalDay({ ...s, day: d }, 90)!.rented;
    }
    expect(many).toBeGreaterThan(few * 1.8);
  });

  it('деньги: прокат по цене набора плюс залоги за невернувшиеся вещи', () => {
    for (let d = 20; d < 120; d++) {
      const day = rentalDay(rented('small', { day: d }), 120)!;
      expect(day.kept).toBe(day.lost * DEPOSITS.small.sum);
      expect(day.income).toBe(day.rented * KIT_PRICE[day.kit] + day.kept);
      expect(day.lost).toBeLessThanOrEqual(day.rented);
    }
  });

  it('маленький залог — берут чаще и теряют чаще; большой — реже и почти без потерь', () => {
    const total = (deposit: Deposit) => {
      let n = 0;
      let lost = 0;
      for (let d = 20; d < 220; d++) {
        const day = rentalDay(rented(deposit, { day: d }), 50)!;
        n += day.rented;
        lost += day.lost;
      }
      return { n, lost };
    };
    const [small, medium, large] = DEPOSIT_IDS.map(total);
    expect(small.n).toBeGreaterThan(medium.n);
    expect(medium.n).toBeGreaterThan(large.n);
    expect(small.lost).toBeGreaterThan(medium.lost);
    expect(medium.lost).toBeGreaterThanOrEqual(large.lost);
    expect(small.lost / small.n).toBeGreaterThan(0.06);
    expect(large.lost / large.n).toBeLessThan(0.03);
  });

  it('когда желающих больше, чем вещей, большой залог выгоднее маленького (с докупкой пропавшего)', () => {
    const net = (deposit: Deposit) => {
      let sum = 0;
      for (let d = 20; d < 220; d++) {
        const day = rentalDay(rented(deposit, { day: d }), 400)!;
        sum += day.income - day.lost * ITEM_COST;
      }
      return sum;
    };
    expect(net('large')).toBeGreaterThan(net('small'));
  });
});

describe('прокат: вечер', () => {
  it('деньги — в кассу, пропавшие — со стойки, итог дня — в карточку', () => {
    const d = dayWhen((day) => {
      const r = rentalDay(rented('small', { day }), 150);
      return Boolean(r && r.lost > 0);
    }, RENTAL_FROM_DAY);
    const s = rented('small', { day: d });
    const plan = rentalDay(s, 150)!;
    const { state, day } = rentalNight(s, 150);
    expect(day).toEqual(plan);
    expect(state.money).toBe(s.money + plan.income);
    expect(state.rental!.stock).toBe(RENTAL_CAP - plan.lost);
    expect(state.rental!.last).toEqual({ ...plan, day: d });
    expect(state.rental!.earned).toBe(plan.income);
  });

  it('без стойки вечер ничего не меняет', () => {
    const s = shop();
    expect(rentalNight(s, 100)).toEqual({ state: s, day: null });
  });

  it('смена дня (day.ts): прокат платит до счетов, прохожие — гости дня по утреннему расчёту', () => {
    const s = rented('medium', { day: 41 });
    const plan = rentalDay(s, guestsToday(s))!;
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.rental).toEqual(plan);
    expect(night.state.rental!.stock).toBe(RENTAL_CAP - plan.lost);
    // Без стойки в итогах дня проката нет.
    expect(nightCycle(shop({ day: 41 }), emptyDayStats(), () => 0.5).rental).toBeNull();
  });
});

describe('прокат: старые сохранения и мир', () => {
  it('старое сохранение без стойки: прокат не мешает, вечер тот же', () => {
    const old = shop();
    delete (old as Partial<StoreState>).rental;
    expect(rentalOf(old)).toBeNull();
    expect(rentalLook(old)).toBe('');
    expect(rentalDay(old, 100)).toBeNull();
  });

  it('испорченная стойка в сохранении чинится: запас в пределах, залог — средний', () => {
    const bad = shop({ rental: { stock: 99, deposit: 'gold' as Deposit } });
    expect(rentalOf(bad)).toMatchObject({ stock: RENTAL_CAP, deposit: 'medium' });
    expect(rentalOf(shop({ rental: { stock: -3, deposit: 'small' } }))!.stock).toBe(0);
    expect(rentalOf(shop({ rental: { stock: Number.NaN, deposit: 'small' } }))!.stock).toBe(0);
  });

  it('вид стойки меняется с набором и запасом (сцена ставит её заново)', () => {
    const s = rented();
    expect(rentalLook(s)).toBe(`${rentalKit(s.day)}:${RENTAL_CAP}`);
    expect(rentalLook({ ...s, rental: { ...s.rental!, stock: 3 } })).not.toBe(rentalLook(s));
  });

  it('подсказка «Новое» — когда стойку можно поставить, и один раз', () => {
    // Все прочие карточки уже видены (их на main много) — остаётся только прокат.
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'rental');
    const early = shop({ day: RENTAL_FROM_DAY - 1, seenTips: others });
    expect(pendingTip(early)).toBeNull();
    expect(pendingTip({ ...early, day: RENTAL_FROM_DAY })).toBe('rental');
    expect(pendingTip({ ...early, day: RENTAL_FROM_DAY, seenTips: [...early.seenTips!, 'rental'] })).toBeNull();
  });

  it('тексты на месте: заголовок, залоги, итог дня', () => {
    for (const id of DEPOSIT_IDS) {
      expect(ru[`rental.dep.${id}` as keyof typeof ru]).toBeTruthy();
      expect(ru[`rental.dep.${id}.note` as keyof typeof ru]).toBeTruthy();
    }
    for (const kit of ['winter', 'wheels', 'rain']) expect(ru[`rental.kit.${kit}` as keyof typeof ru]).toBeTruthy();
    expect(ru['tip.rental.title']).toBeTruthy();
  });
});

describe('прокат: сохранение в телефоне', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('стойка переживает сохранение и загрузку; сохранение без неё грузится как было', async () => {
    vi.resetModules();
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
    const { loadGame, saveGame } = await import('../src/game/save');
    const s = rented('large', { day: 50 });
    saveGame(s);
    expect(loadGame()!.rental).toEqual({ stock: RENTAL_CAP, deposit: 'large' });
    const old = shop();
    delete (old as Partial<StoreState>).rental;
    saveGame(old);
    expect(loadGame()!.rental).toBeUndefined();
  });
});

describe('прокат: симулятор', () => {
  // Стойка — приятная добавка, а не новая главная статья: к сотому дню денег чуть больше, не вдвое.
  it('ставит стойку, докупает пропавшее и не ломает баланс', () => {
    const features = { tenants: true, garden: true };
    let base = 0;
    let withRental = 0;
    let earned = 0;
    for (let seed = 1; seed <= 3; seed++) {
      base += simulate({ days: 100, seed, features }).days.at(-1)!.money;
      const run = simulate({ days: 100, seed, features: { ...features, rental: true } });
      withRental += run.days.at(-1)!.money;
      earned += run.final.rental?.earned ?? 0;
      expect(run.final.rental).toBeTruthy();
    }
    expect(earned).toBeGreaterThan(0);
    expect(withRental).toBeGreaterThan(base * 0.97);
    expect(withRental).toBeLessThan(base * 1.25);
  }, 60_000);
});
