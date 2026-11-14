import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type StaffMember, type StoreState, type Unit } from '../src/game/economy';
import { buyFloor, finishFloor, floorAvailable, floorLock, FLOORS, hasFloor, openFloors, type FloorId } from '../src/game/floors';
import {
  answerInspection,
  answerParty,
  closeStall,
  closedToday,
  foodcourtGuests,
  foodcourtNight,
  foodcourtOf,
  foodPlan,
  INSPECT_FIX,
  INSPECT_GRACE,
  INSPECT_TENANT_SHARE,
  inspectionToday,
  OWN_MARGIN,
  OWN_MARGIN_COOK,
  openStall,
  PARTY_GOODWILL,
  partyOn,
  partyToday,
  setStallMode,
  STALL_PLACES,
  stallMode,
  stallPlaces,
  stallRent,
  STALLS,
  stallsOf,
  WEEKEND_EATERS,
  type FoodcourtState,
} from '../src/game/foodcourt';
import { guestsToday, nightCycle } from '../src/game/day';
import { goodwillOf } from '../src/game/goodwill';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { simulate } from '../src/game/simulate';

// Третий этаж — фудкорт (floors.ts + foodcourt.ts, 13.11): открывается с «Универмага» (над вторым этажом, если он
// есть в сборке), точки еды — сдать или вести самим со своей кухней, праздники и жалобы. Всё — от зерна и дня.

const units = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));
const cook: StaffMember = { role: 'cook', name: 0, skill: 2, wage: 400, months: 0 };
/** «Универмаг» на 60-й день (понедельник по игровому календарю — не выходной). */
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 57, level: 4, money: 100000, debt: 0, rating: 4.5, seed: 11, ...over });
/** Открыт ли этаж ниже третьего в этой сборке (второй этаж делается отдельно): его тоже открываем. */
const below = FLOORS.third.needs && FLOORS.third.needs in FLOORS ? (FLOORS.third.needs as FloorId) : null;
/** Фудкорт открыт (отделка finish), точки — как в fc. */
const court = (fc: FoodcourtState = {}, over: Partial<StoreState> = {}, finish = 0): StoreState =>
  shop({ floors: { ...(below ? { [below]: { since: 20, finish: 0 } } : {}), third: { since: 30, finish } }, foodcourt: fc, ...over });
const four = { pizza: 'rent', grill: 'rent', sushi: 'own', coffee: 'own' } as const;
/** Первый день от from, когда сработает условие. */
const dayWhen = (s: StoreState, ok: (s: StoreState) => boolean, from = 60): number => {
  for (let d = from; d < from + 3000; d++) if (ok({ ...s, day: d })) return d;
  throw new Error('не нашлось дня');
};

describe('третий этаж: открытие', () => {
  it('с «Универмага», не в Заречье, за свою цену; этаж ниже — если он есть в сборке', () => {
    expect(floorLock(shop({ level: 3 }), 'third')).toBe('level');
    expect(floorLock(shop({ zar: { at: 'zar' } as StoreState['zar'] }), 'third')).toBe('zar');
    if (below) {
      // Второй этаж есть в сборке: без него третий не открыть.
      expect(floorLock(shop(), 'third')).toBe('below');
      expect(floorAvailable(shop({ floors: { [below]: { since: 1, finish: 0 } } }), 'third')).toBe(true);
    } else {
      // Безопасный откат: второго этажа ещё нет — третий открывается по помещению.
      expect(floorLock(shop(), 'third')).toBeNull();
    }
    const ready = below ? shop({ floors: { [below]: { since: 1, finish: 0 } } }) : shop();
    const opened = buyFloor(ready, 'third')!;
    expect(opened.money).toBe(ready.money - FLOORS.third.cost);
    expect(opened.floors?.third).toEqual({ since: 57, finish: 0 });
    expect(openFloors(opened)).toContain('third');
    expect(buyFloor(opened, 'third')).toBeNull();
    expect(buyFloor({ ...ready, money: FLOORS.third.cost - 1 }, 'third')).toBeNull();
    // Подвал от этого не меняется.
    expect(hasFloor(opened, 'basement')).toBe(false);
    expect(floorLock(opened, 'basement')).toBeNull();
  });

  it('старое сохранение: фудкорта нет, гости и вечер — как раньше', () => {
    const old = shop();
    delete (old as Partial<StoreState>).foodcourt;
    expect(foodcourtOf(old)).toBeNull();
    expect(stallsOf(old)).toEqual([]);
    expect(foodcourtGuests(old)).toBe(1);
    expect(foodPlan(old)).toBeNull();
    const night = foodcourtNight(old);
    expect(night.state).toBe(old);
    expect(night.day).toBeNull();
    expect(nightCycle(old, emptyDayStats(), () => 0.5).food).toBeNull();
    // Этаж открыт, но точек ещё нет — тоже ничего.
    expect(foodcourtNight(court()).day).toBeNull();
    // Кривое поле — как пустой фудкорт.
    expect(stallsOf(court({ stalls: { pizza: 'bad' as never, nope: 'rent' } as never }))).toEqual([]);
  });
});

describe('точки еды', () => {
  it('мест три, после ремонта — четыре; обустройство платит хозяин', () => {
    let s = court();
    expect(stallPlaces(s)).toBe(STALL_PLACES[0]);
    for (const id of ['pizza', 'grill', 'coffee'] as const) s = openStall(s, id, 'rent')!;
    expect(s.money).toBe(100000 - STALLS.pizza.setup - STALLS.grill.setup - STALLS.coffee.setup);
    expect(stallsOf(s)).toEqual(['pizza', 'grill', 'coffee']);
    expect(openStall(s, 'sushi', 'rent')).toBeNull();
    expect(openStall(s, 'pizza', 'rent')).toBeNull();
    s = finishFloor(s, 'third')!;
    expect(stallPlaces(s)).toBe(STALL_PLACES[1]);
    expect(openStall({ ...s, money: STALLS.sushi.setup - 1 }, 'sushi', 'rent')).toBeNull();
    s = openStall(s, 'sushi', 'rent')!;
    expect(stallsOf(s)).toHaveLength(4);
    // Убрать — место свободно, денег не возвращают.
    const freed = closeStall(s, 'grill')!;
    expect(stallsOf(freed)).not.toContain('grill');
    expect(freed.money).toBe(s.money);
    expect(closeStall(freed, 'grill')).toBeNull();
  });

  it('вести самим — только со своей кухней; переключить можно бесплатно', () => {
    const s = court();
    expect(openStall(s, 'pizza', 'own')).toBeNull();
    const kitchen = court({}, { upgrades: ['kitchen'] });
    const own = openStall(kitchen, 'pizza', 'own')!;
    expect(stallMode(own, 'pizza')).toBe('own');
    const rented = setStallMode(own, 'pizza', 'rent')!;
    expect(stallMode(rented, 'pizza')).toBe('rent');
    expect(rented.money).toBe(own.money);
    expect(setStallMode(rented, 'pizza', 'rent')).toBeNull();
    // Кухню убрали (кривое сохранение) — «своя» работает как сданная.
    expect(stallMode({ ...own, upgrades: [] }, 'pizza')).toBe('rent');
  });

  it('вечер детерминирован; аренда — ровно аренда, своя — доля выручки (с поваром больше)', () => {
    const s = court({ stalls: four }, { upgrades: ['kitchen'] });
    expect(foodPlan(s)).toEqual(foodPlan({ ...s }));
    const plan = foodPlan(s)!;
    const pizza = plan.stalls.find((p) => p.id === 'pizza')!;
    expect(pizza.income).toBe(stallRent(s, 'pizza'));
    const sushi = plan.stalls.find((p) => p.id === 'sushi')!;
    expect(sushi.income).toBe(Math.round((sushi.eaters * STALLS.sushi.check * OWN_MARGIN) / 10) * 10);
    const withCook = foodPlan({ ...s, staff: [...s.staff, cook] })!.stalls.find((p) => p.id === 'sushi')!;
    expect(withCook.income).toBe(Math.round((withCook.eaters * STALLS.sushi.check * OWN_MARGIN_COOK) / 10) * 10);
    expect(withCook.income).toBeGreaterThan(sushi.income);
    // Едоков — в разумных пределах (±20% от базы).
    for (const p of plan.stalls) {
      expect(p.eaters).toBeGreaterThanOrEqual(Math.floor(STALLS[p.id].eaters * 0.8));
      expect(p.eaters).toBeLessThanOrEqual(Math.ceil(STALLS[p.id].eaters * 1.2));
    }
  });

  it('выходные — семьи, едоков больше; ремонт — и едоков, и аренды больше', () => {
    const s = court({ stalls: four }, { upgrades: ['kitchen'] });
    // В среднем за двадцать недель: суббота против понедельника (день 57 — понедельник, 62 — суббота).
    const avg = (first: number) => Array.from({ length: 20 }, (_, w) => eaters({ ...s, day: first + 7 * w })).reduce((a, b) => a + b, 0) / 20;
    expect(avg(62) / avg(57)).toBeGreaterThan(WEEKEND_EATERS - 0.1);
    expect(avg(62) / avg(57)).toBeLessThan(WEEKEND_EATERS + 0.1);
    const fin = court({ stalls: four }, { upgrades: ['kitchen'] }, 1);
    expect(stallRent(fin, 'pizza')).toBeGreaterThan(stallRent(s, 'pizza'));
    expect(eaters(fin)).toBeGreaterThan(eaters(s));
  });

  it('вечер кладёт деньги в кассу, помнит прошлый вечер и сколько заработано', () => {
    const s = court({ stalls: four }, { upgrades: ['kitchen'] });
    const plan = foodPlan(s)!;
    const night = foodcourtNight(s);
    expect(night.state.money).toBe(s.money + plan.income);
    expect(night.day).toEqual({ eaters: plan.eaters, income: plan.income });
    expect(night.state.foodcourt?.last).toEqual({ eaters: plan.eaters, income: plan.income, day: s.day });
    expect(night.state.foodcourt?.earned).toBe(plan.income);
    const cycle = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(cycle.food?.income).toBe(plan.income);
  });

  it('гости зала: каждая точка приводит своих, в Заречье — нет', () => {
    const s = court({ stalls: four }, {}, 1);
    // До ремонта мест три — четвёртая точка (кофе) не работает и гостей не ведёт.
    expect(foodcourtGuests(court({ stalls: four }))).toBeCloseTo(1 + STALLS.pizza.guests + STALLS.grill.guests + STALLS.sushi.guests, 6);
    expect(foodcourtGuests(s)).toBeCloseTo(1 + STALLS.pizza.guests + STALLS.grill.guests + STALLS.sushi.guests + STALLS.coffee.guests, 6);
    const base = court();
    expect(guestsToday(s)).toBeGreaterThan(guestsToday(base));
    expect(foodcourtGuests({ ...s, zar: { at: 'zar' } as StoreState['zar'] })).toBe(1);
  });
});

/** Сколько едоков за вечер. */
function eaters(s: StoreState): number {
  return foodPlan(s)?.eaters ?? 0;
}

describe('жалоба в санинспекцию', () => {
  const s = court({ stalls: four }, { upgrades: ['kitchen'] });
  const day = dayWhen(s, (x) => inspectionToday(x) !== null);
  const at = { ...s, day };

  it('бывает изредка, не в первую неделю после открытия; от зерна и дня', () => {
    const ins = inspectionToday(at)!;
    expect(inspectionToday({ ...at })).toEqual(ins);
    expect(inspectionToday({ ...at, floors: { ...at.floors, third: { since: day - INSPECT_GRACE + 1, finish: 0 } } })).toBeNull();
    let n = 0;
    for (let d = 100; d < 1100; d++) if (inspectionToday({ ...s, day: d })) n++;
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(90);
  });

  it('не ответили — точку закрывают на вечер; закрыть — то же; навести порядок — работает', () => {
    const ins = inspectionToday(at)!;
    expect(closedToday(at)).toBe(ins.stall);
    const closed = foodPlan(at)!.stalls.find((p) => p.id === ins.stall)!;
    expect(closed.income).toBe(0);
    expect(closed.eaters).toBe(0);
    const shut = answerInspection(at, false)!;
    expect(shut.money).toBe(at.money);
    expect(closedToday(shut)).toBe(ins.stall);
    expect(foodcourtNight(shut).day?.closed).toBe(ins.stall);
    const fixed = answerInspection(at, true)!;
    expect(fixed.money).toBe(at.money - ins.fix);
    expect(closedToday(fixed)).toBeNull();
    expect(foodPlan(fixed)!.stalls.find((p) => p.id === ins.stall)!.income).toBeGreaterThan(0);
    // Второй раз не ответить; без денег — не навести порядок.
    expect(answerInspection(fixed, true)).toBeNull();
    expect(answerInspection({ ...at, money: ins.fix - 1 }, true)).toBeNull();
    // Цена: своя точка — целиком, сданная — пополам с арендатором.
    expect(ins.fix).toBe(Math.round(INSPECT_FIX * (stallMode(at, ins.stall) === 'own' ? 1 : INSPECT_TENANT_SHARE)));
  });
});

describe('день рождения на фудкорте', () => {
  const stocked = court(
    { stalls: four },
    {
      shelves: [
        { kind: 'drinks', level: 1, items: { juice: units(4) } },
        { kind: 'icebox', level: 1, items: { icecream: units(2) } },
      ],
      warehouse: { juice: units(20), icecream: units(10) },
    },
  );
  const day = dayWhen(stocked, (x) => partyToday(x) !== null);
  const at = { ...stocked, day };

  it('от двух точек, торт и напитки — из того, что магазин продаёт', () => {
    const party = partyToday(at)!;
    expect(Object.keys(party.items).sort()).toEqual(['icecream', 'juice']);
    expect(party.ready).toBe(true);
    expect(partyToday({ ...at, foodcourt: { stalls: { pizza: 'rent' } } })).toBeNull();
    expect(partyToday({ ...at, shelves: [] })).toBeNull();
  });

  it('собрать заказ: товар уходит, деньги приходят, район доволен; отказать — без последствий', () => {
    const party = partyToday(at)!;
    const ok = answerParty(at, true)!;
    expect(ok.money).toBe(at.money + party.pay);
    expect(goodwillOf(ok)).toBe(goodwillOf(at) + PARTY_GOODWILL);
    const juice = (st: StoreState) => (st.warehouse.juice?.length ?? 0) + st.shelves.reduce((n, sh) => n + (sh.items.juice?.length ?? 0), 0);
    expect(juice(ok)).toBe(juice(at) - (party.items.juice ?? 0));
    expect(partyOn(ok)).toBe(true);
    expect(foodcourtNight(ok).day?.party).toBe(true);
    expect(answerParty(ok, true)).toBeNull();
    const no = answerParty(at, false)!;
    expect(no.money).toBe(at.money);
    expect(partyOn(no)).toBe(false);
    // Товара не хватает — собрать нельзя.
    const empty = { ...at, warehouse: {}, shelves: at.shelves.map((sh) => ({ ...sh, items: {} })) };
    expect(partyToday(empty)?.ready).toBe(false);
    expect(answerParty(empty, true)).toBeNull();
  });
});

describe('подсказка и симулятор', () => {
  it('подсказка — когда третий этаж можно открыть; значки подсказок не повторяются', () => {
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'foodcourt');
    const ready = below ? shop({ floors: { [below]: { since: 1, finish: 0 } }, seenTips: others }) : shop({ seenTips: others });
    expect(pendingTip({ ...ready, level: 3 })).toBeNull();
    expect(pendingTip(ready)).toBe('foodcourt');
    expect(pendingTip({ ...ready, seenTips: [...others, 'foodcourt'] })).toBeNull();
    expect(new Set(Object.values(TIP_ICONS)).size).toBe(Object.keys(TIP_ICONS).length);
  });

  it('симулятор с фудкортом идёт до конца, открывает этаж и ставит точки', () => {
    const run = simulate({ days: 110, seed: 3, features: { foodcourt: true } });
    expect(run.days.length).toBe(110);
    if (!below) {
      expect(hasFloor(run.final, 'third')).toBe(true);
      expect(stallsOf(run.final).length).toBeGreaterThan(0);
    }
  });
});
