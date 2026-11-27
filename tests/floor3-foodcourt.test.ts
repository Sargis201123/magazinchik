import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type StaffMember, type StoreState, type Unit } from '../src/game/economy';
import { buyFloor, finishFloor, floorAvailable, floorLock, FLOORS, hasFloor, openFloors, type FloorId } from '../src/game/floors';
import {
  answerParty,
  closeStall,
  closedToday,
  floorEstimate,
  foodcourtGuests,
  foodcourtNight,
  foodcourtOf,
  foodPlan,
  foodRun,
  INSPECT_GRACE,
  inspectionToday,
  OWN_MARGIN,
  OWN_MARGIN_COOK,
  openStall,
  PARTY_GOODWILL,
  partyOn,
  partyToday,
  stallEstimate,
  stallIncome,
  STALL_IDS,
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
// есть в сборке), точки еды работают сами (27.11: без Кухни — сданы, с Кухней — свои), праздники и жалобы (жалоба
// закрывает точку на вечер сама). Всё — от зерна и дня.

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
    for (const id of ['pizza', 'grill', 'coffee'] as const) s = openStall(s, id)!;
    expect(s.money).toBe(100000 - STALLS.pizza.setup - STALLS.grill.setup - STALLS.coffee.setup);
    expect(stallsOf(s)).toEqual(['pizza', 'grill', 'coffee']);
    expect(openStall(s, 'sushi')).toBeNull();
    expect(openStall(s, 'pizza')).toBeNull();
    s = finishFloor(s, 'third')!;
    expect(stallPlaces(s)).toBe(STALL_PLACES[1]);
    expect(openStall({ ...s, money: STALLS.sushi.setup - 1 }, 'sushi')).toBeNull();
    s = openStall(s, 'sushi')!;
    expect(stallsOf(s)).toHaveLength(4);
    // Убрать — место свободно, денег не возвращают.
    const freed = closeStall(s, 'grill')!;
    expect(stallsOf(freed)).not.toContain('grill');
    expect(freed.money).toBe(s.money);
    expect(closeStall(freed, 'grill')).toBeNull();
  });

  it('27.11: выбора нет — без Кухни точки сданы, с Кухней свои, с поваром выгоднее; старые сохранения читаются', () => {
    const opened = openStall(court(), 'pizza')!;
    expect(opened.money).toBe(100000 - STALLS.pizza.setup);
    expect(foodRun(opened)).toBe('rent');
    expect(stallMode(opened, 'pizza')).toBe('rent');
    // Кухню купили — ту же точку сразу ведёт своя кухня, ничего не переключая.
    const kitchen = { ...opened, upgrades: ['kitchen'] } as StoreState;
    expect(foodRun(kitchen)).toBe('kitchen');
    expect(stallMode(kitchen, 'pizza')).toBe('own');
    expect(foodRun({ ...kitchen, staff: [...kitchen.staff, cook] })).toBe('cook');
    // Сохранение до 27.11: «своя» без Кухни — сдана, «сдана» с Кухней — своя; сохранённое значение не читаем.
    const old = court({ stalls: { pizza: 'own', grill: 'rent' } });
    expect(stallsOf(old)).toEqual(['pizza', 'grill']);
    expect(foodPlan(old)!.stalls.map((p) => p.mode)).toEqual(['rent', 'rent']);
    const oldKitchen = court({ stalls: { pizza: 'own', grill: 'rent' }, inspect: { day: 57, fix: true } }, { upgrades: ['kitchen'] });
    expect(foodPlan(oldKitchen)!.stalls.map((p) => p.mode)).toEqual(['own', 'own']);
    expect(foodcourtNight(oldKitchen).day!.income).toBe(foodPlan(oldKitchen)!.income);
  });

  it('своя точка никогда не даёт меньше аренды; с поваром — больше, чем без него', () => {
    for (const finish of [0, 1]) {
      const s = court({ stalls: four }, {}, finish);
      for (const id of STALL_IDS) {
        for (const eaters of [0, 5, STALLS[id].eaters, 40]) {
          const rent = stallIncome(s, id, eaters, 'rent');
          expect(rent).toBe(stallRent(s, id));
          expect(stallIncome(s, id, eaters, 'kitchen')).toBeGreaterThanOrEqual(rent);
          expect(stallIncome(s, id, eaters, 'cook')).toBeGreaterThanOrEqual(stallIncome(s, id, eaters, 'kitchen'));
        }
      }
    }
    // Суши без повара: доля выручки чуть меньше аренды — тогда аренда (раньше «своя» тут проигрывала).
    const s = court({ stalls: four });
    const eaters = STALLS.sushi.eaters;
    expect(Math.round((eaters * STALLS.sushi.check * OWN_MARGIN) / 10) * 10).toBeLessThan(stallRent(s, 'sushi'));
    expect(stallIncome(s, 'sushi', eaters, 'kitchen')).toBe(stallRent(s, 'sushi'));
  });

  it('вечер детерминирован; без Кухни — ровно аренда, с Кухней — доля выручки (с поваром больше)', () => {
    const rented = court({ stalls: four });
    expect(foodPlan(rented)).toEqual(foodPlan({ ...rented }));
    for (const p of foodPlan(rented)!.stalls) expect(p.income).toBe(p.closed ? 0 : stallRent(rented, p.id));
    const s = court({ stalls: four }, { upgrades: ['kitchen'] });
    const plan = foodPlan(s)!;
    const pizza = plan.stalls.find((p) => p.id === 'pizza')!;
    expect(pizza.mode).toBe('own');
    expect(pizza.income).toBe(Math.max(stallRent(s, 'pizza'), Math.round((pizza.eaters * STALLS.pizza.check * OWN_MARGIN) / 10) * 10));
    const withCook = foodPlan({ ...s, staff: [...s.staff, cook] })!.stalls.find((p) => p.id === 'pizza')!;
    expect(withCook.income).toBe(Math.round((withCook.eaters * STALLS.pizza.check * OWN_MARGIN_COOK) / 10) * 10);
    expect(withCook.income).toBeGreaterThan(pizza.income);
    // «А если бы»: тот же вечер, посчитанный за другого — для строки в плитке.
    expect(foodPlan(rented, 'cook')).toEqual(foodPlan({ ...s, staff: [...s.staff, cook] }));
    expect(foodPlan(s, 'rent')!.income).toBe(foodPlan(rented)!.income);
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
    const stall = inspectionToday(at)!;
    expect(STALL_IDS).toContain(stall);
    expect(inspectionToday({ ...at })).toBe(stall);
    expect(inspectionToday({ ...at, floors: { ...at.floors, third: { since: day - INSPECT_GRACE + 1, finish: 0 } } })).toBeNull();
    let n = 0;
    for (let d = 100; d < 1100; d++) if (inspectionToday({ ...s, day: d })) n++;
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(90);
  });

  it('27.11: решается сама — точка закрыта на вечер, денег не берут, строка в итогах; завтра снова работает', () => {
    const stall = inspectionToday(at)!;
    expect(closedToday(at)).toBe(stall);
    const closed = foodPlan(at)!.stalls.find((p) => p.id === stall)!;
    expect(closed.income).toBe(0);
    expect(closed.eaters).toBe(0);
    const night = foodcourtNight(at);
    expect(night.day?.closed).toBe(stall);
    expect(night.state.money).toBe(at.money + foodPlan(at)!.income);
    // Старое сохранение с ответом «навели порядок» сегодня — точка всё равно закрыта (ответ не читаем).
    const old = { ...at, foodcourt: { ...at.foodcourt, inspect: { day: at.day, fix: true } } };
    expect(closedToday(old)).toBe(stall);
    // Назавтра (если жалобы нет) точка снова работает.
    const next = dayWhen(at, (x) => inspectionToday(x) === null, at.day + 1);
    expect(foodPlan({ ...at, day: next })!.stalls.every((p) => !p.closed && p.income > 0)).toBe(true);
  });
});

describe('сколько точка даст — до того, как её открыли', () => {
  it('аренда — ровно аренда; своя — по средней неделе, не меньше аренды; ремонт и Кухня с поваром — больше', () => {
    const s = court();
    for (const id of STALL_IDS) expect(stallEstimate(s, id)).toBe(STALLS[id].rent);
    const k = court({}, { upgrades: ['kitchen'] });
    const kc = court({}, { upgrades: ['kitchen'], staff: [cook] });
    for (const id of STALL_IDS) {
      expect(stallEstimate(k, id)).toBeGreaterThanOrEqual(stallEstimate(s, id));
      expect(stallEstimate(kc, id)).toBeGreaterThan(stallEstimate(k, id));
      // Тот же расчёт, что вечер: средняя неделя близко к среднему вечеру точки за много дней.
      const avg = Array.from({ length: 140 }, (_, d) => foodPlan({ ...court({ stalls: { [id]: 'rent' } }, { upgrades: ['kitchen'], staff: [cook] }), day: 300 + d })!)
        .filter((p) => !p.stalls[0].closed)
        .reduce((sum, p, _, all) => sum + p.income / all.length, 0);
      expect(stallEstimate(kc, id)).toBeGreaterThan(avg * 0.93);
      expect(stallEstimate(kc, id)).toBeLessThan(avg * 1.07);
    }
    const fin = court({}, {}, 1);
    expect(stallEstimate(fin, 'pizza')).toBeGreaterThan(stallEstimate(s, 'pizza'));
  });

  it('весь этаж: стоящие точки и на свободные места — самые доходные; этаж ещё не открыт — три места', () => {
    const closedFloor = shop(below ? { floors: { [below]: { since: 1, finish: 0 } } } : {});
    // Голый этаж без Кухни: три лучшие аренды — суши, пицца, шаурма.
    expect(floorEstimate(closedFloor)).toBe(STALLS.sushi.rent + STALLS.pizza.rent + STALLS.grill.rent);
    expect(floorEstimate({ ...closedFloor, upgrades: ['kitchen'], staff: [cook] })).toBeGreaterThan(floorEstimate(closedFloor));
    // Стоит кофе — оно считается, а на два свободных места — лучшие из остальных.
    const s = court({ stalls: { coffee: 'rent' } });
    expect(floorEstimate(s)).toBe(STALLS.coffee.rent + STALLS.sushi.rent + STALLS.pizza.rent);
    expect(floorEstimate(court({ stalls: four }, {}, 1))).toBe(STALL_IDS.reduce((n, id) => n + stallRent(court({}, {}, 1), id), 0));
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
    // Третий стоит на втором: симулятор сперва открывает второй (пустым), потом фудкорт.
    if (below) expect(hasFloor(run.final, below)).toBe(true);
    expect(hasFloor(run.final, 'third')).toBe(true);
    expect(stallsOf(run.final).length).toBeGreaterThan(0);
  });
});
