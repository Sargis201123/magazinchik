import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  buyStand,
  KIT_PRICE,
  RENT_SHARE,
  RENTAL_CAPS,
  RENTAL_FROM_DAY,
  RENTAL_FROM_LEVEL,
  rentalCap,
  rentalDay,
  rentalDemand,
  rentalKit,
  kitToday,
  rentalLog,
  rentalLook,
  rentalNight,
  rentalOf,
  rentalOpen,
  STAND_COST,
} from '../src/game/rental';
import { guestsToday, nightCycle } from '../src/game/day';
import { weatherFor } from '../src/game/weather';
import { yearTime } from '../src/game/calendar';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { ru } from '../src/i18n/ru';
import { simulate } from '../src/game/simulate';

// Прокат у входа (rental.ts): стойка, набор по погоде, деньги вечером. 27.11: без залога, пропаж и докупки -
// стойка растёт с магазином сама, цена проката за день видна в карточке.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, level: 2, money: 5000, debt: 0, rating: 4, seed: 7, ...over });
const rented = (over: Partial<StoreState> = {}): StoreState => shop({ rental: {}, ...over });
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

  it('стойку покупают один раз — и всё: ни залога, ни запаса вещей', () => {
    const before = shop();
    const after = buyStand(before)!;
    expect(after.money).toBe(before.money - STAND_COST);
    expect(after.rental).toEqual({});
    expect(rentalOf(after)).toEqual({});
    expect(buyStand(after)).toBeNull();
    expect(buyStand(shop({ money: STAND_COST - 1 }))).toBeNull();
  });

  it('стойка растёт с магазином: 10 / 15 / 20 / 30 / 40 вещей', () => {
    expect([1, 2, 3, 4, 5].map((level) => rentalCap(rented({ level })))).toEqual([10, 15, 20, 30, 40]);
    expect(RENTAL_CAPS).toHaveLength(6);
    // В Заречье — по помещению Центра.
    expect(rentalCap(rented({ level: 1, zar: { at: 'zar', away: { level: 4 } } as unknown as StoreState['zar'] }))).toBe(30);
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
    const calm = rented({ day: summer });
    const flood = { ...calm, crisis: { kind: 'flood' as const, from: summer, days: 3 } };
    const blizzard = { ...calm, crisis: { kind: 'blizzard' as const, from: summer, days: 3 } };
    expect(kitToday(calm)).toBe('wheels');
    expect(kitToday(flood)).toBe('rain');
    expect(kitToday(blizzard)).toBe('winter');
    expect(rentalDay(flood, 100)!.kit).toBe('rain');
    // Зонтов в ливень паводка берут больше, чем колёс в ясный день (прохожих столько же).
    expect(rentalDay(flood, 60)!.rented).toBeGreaterThanOrEqual(rentalDay(calm, 60)!.rented);
  });
});

describe('прокат: день', () => {
  it('одинаковое зерно и день — одинаковый итог; другой день — свой', () => {
    const s = rented();
    expect(rentalDay(s, 80)).toEqual(rentalDay({ ...s }, 80));
    const days = Array.from({ length: 30 }, (_, i) => JSON.stringify(rentalDay({ ...s, day: 40 + i }, 80)));
    expect(new Set(days).size).toBeGreaterThan(5);
  });

  it('берут не больше, чем вещей на стойке; без стойки и в Заречье — ничего', () => {
    for (const level of [1, 3, 5]) {
      const s = rented({ level });
      let full = 0;
      for (let d = 20; d < 80; d++) {
        const day = rentalDay({ ...s, day: d }, 2000)!;
        expect(day.rented).toBeLessThanOrEqual(rentalCap(s));
        if (day.rented === rentalCap(s)) full++;
      }
      // Прохожих много — стойку разбирают всю.
      expect(full).toBeGreaterThan(40);
    }
    expect(rentalDay(shop(), 100)).toBeNull();
    expect(rentalDay(rented({ zar: { at: 'zar' } as StoreState['zar'] }), 100)).toBeNull();
  });

  it('прохожих больше — берут больше', () => {
    const s = rented({ level: 5 });
    let few = 0;
    let many = 0;
    for (let d = 20; d < 120; d++) {
      few += rentalDay({ ...s, day: d }, 30)!.rented;
      many += rentalDay({ ...s, day: d }, 90)!.rented;
    }
    expect(many).toBeGreaterThan(few * 1.8);
  });

  it('деньги: взятые вещи × цена набора (25 / 30 / 12), без залогов и пропаж', () => {
    expect(KIT_PRICE).toEqual({ winter: 25, wheels: 30, rain: 12 });
    for (let d = 20; d < 120; d++) {
      const day = rentalDay(rented({ day: d }), 120)!;
      expect(day.income).toBe(day.rented * KIT_PRICE[day.kit]);
      expect(Object.keys(day).sort()).toEqual(['income', 'kit', 'rented']);
    }
  });

  it('в Универмаге стойка больше — и денег заметно больше, чем у стойки на 10 вещей', () => {
    // Прохожие Универмага (~200 гостей дня): желающих ~20 при обычном спросе — раньше стойка на 10 упиралась в предел.
    let big = 0;
    let small = 0;
    for (let d = 20; d < 385; d++) {
      big += rentalDay(rented({ level: 4, day: d }), 210)!.income;
      small += rentalDay(rented({ level: 1, day: d }), 210)!.income;
    }
    expect(big / 365).toBeGreaterThan(450);
    expect(big).toBeGreaterThan(small * 1.6);
    expect(RENT_SHARE).toBe(0.1);
  });
});

describe('прокат: вечер', () => {
  it('деньги — в кассу, итог дня — в карточку («вчера» и «всего»)', () => {
    const s = rented({ day: 50 });
    const plan = rentalDay(s, 150)!;
    const { state, day } = rentalNight(s, 150);
    expect(day).toEqual(plan);
    expect(state.money).toBe(s.money + plan.income);
    expect(state.rental).toEqual({ last: { ...plan, day: 50 }, earned: plan.income });
    const next = rentalNight({ ...state, day: 51 }, 150).state;
    expect(rentalLog({ ...next, day: 52 })).toEqual({ n: next.rental!.last!.rented, last: next.rental!.last!.income, total: next.rental!.earned });
    expect(rentalLog({ ...next, day: 55 })).toBeNull();
  });

  it('без стойки вечер ничего не меняет', () => {
    const s = shop();
    expect(rentalNight(s, 100)).toEqual({ state: s, day: null });
  });

  it('смена дня (day.ts): прокат платит до счетов, прохожие — гости дня по утреннему расчёту', () => {
    const s = rented({ day: 41 });
    const plan = rentalDay(s, guestsToday(s))!;
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.rental).toEqual(plan);
    expect(night.state.rental!.earned).toBe(plan.income);
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

  it('стойка до 27.11 (запас 4 из 10, маленький залог) работает как полная, первый вечер убирает старые поля', () => {
    const old = shop({ level: 4, day: 60, rental: { stock: 4, deposit: 'small', earned: 900, last: { kit: 'rain', rented: 4, lost: 1, income: 68, kept: 20, day: 59 } } as unknown as StoreState['rental'] });
    const fresh = rented({ level: 4, day: 60 });
    expect(rentalDay(old, 300)).toEqual(rentalDay(fresh, 300));
    expect(rentalDay(old, 300)!.rented).toBeGreaterThan(4);
    expect(rentalLog(old)).toMatchObject({ last: 68, total: 900 });
    const night = rentalNight(old, 300).state;
    expect(Object.keys(night.rental!).sort()).toEqual(['earned', 'last']);
    expect(night.rental!.earned).toBe(900 + rentalDay(old, 300)!.income);
  });

  it('вид стойки меняется с набором и размером (сцена ставит её заново)', () => {
    const s = rented();
    expect(rentalLook(s)).toBe(`${rentalKit(s.day)}:${rentalCap(s)}`);
    expect(rentalLook({ ...s, level: 4 })).not.toBe(rentalLook(s));
  });

  it('подсказка «Новое» — когда стойку можно поставить, и один раз', () => {
    // Все прочие карточки уже видены (их на main много) — остаётся только прокат.
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'rental');
    const early = shop({ day: RENTAL_FROM_DAY - 1, seenTips: others });
    expect(pendingTip(early)).toBeNull();
    expect(pendingTip({ ...early, day: RENTAL_FROM_DAY })).toBe('rental');
    expect(pendingTip({ ...early, day: RENTAL_FROM_DAY, seenTips: [...early.seenTips!, 'rental'] })).toBeNull();
  });

  it('тексты на месте: наборы, цена за день, плитка; про залог — ни слова', () => {
    for (const kit of ['winter', 'wheels', 'rain']) expect(ru[`rental.kit.${kit}` as keyof typeof ru]).toBeTruthy();
    expect(ru['rental.perDay']).toContain('{n}');
    expect(ru['rental.tile']).toContain('{sum}');
    expect(ru['tip.rental.title']).toBeTruthy();
    expect(Object.entries(ru).filter(([k, v]) => k.startsWith('rental.') || k === 'tip.rental.text' ? /залог/i.test(v) : false)).toEqual([]);
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
    const s = rentalNight(rented({ day: 50 }), 100).state;
    saveGame(s);
    expect(loadGame()!.rental).toEqual(s.rental);
    const old = shop();
    delete (old as Partial<StoreState>).rental;
    saveGame(old);
    expect(loadGame()!.rental).toBeUndefined();
  });
});

describe('прокат: симулятор', () => {
  // Стойка — заметная добавка, а не новая главная статья: к сотому дню денег больше, но не вдвое.
  it('ставит стойку и не ломает баланс', () => {
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
