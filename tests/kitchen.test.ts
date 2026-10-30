import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, roleOpen, STAFF_LIMIT, STAFF_ROLE_IDS, wageFor, type StaffMember, type StoreState } from '../src/game/economy';
import { gearAvailable, GEAR_IDS, upgradeGear } from '../src/game/gear';
import {
  canCook,
  cook,
  cookBatch,
  cookMenu,
  cookRoundsPerDay,
  dishAppeal,
  dishDemand,
  DISHES,
  DISH_IDS,
  dishPortions,
  kitchenNeeds,
  kitchenWorking,
  FOOD_KEEP,
  FOOD_SLOTS,
  foodSlots,
  menuAuto,
  morningOrder,
  orderCost,
  pantryOf,
  portionsTotal,
  sellDish,
  servePortions,
  spoilDishes,
  stovePots,
  stoveSeconds,
  stockKitchen,
  takeDish,
  takeIngredients,
  toggleMenu,
  topUpKitchen,
  wantsDish,
} from '../src/game/kitchen';
import { addReport } from '../src/game/reports';
import { nightCycle } from '../src/game/day';
import { restockPlan } from '../src/game/restock';
import { weatherFor, type Weather } from '../src/game/weather';
import { layoutFor, KITCHEN_FROM } from '../src/scenes/layout';
import { TEXTURES } from '../src/scenes/worldTextures';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const at = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  shelves: newGame().shelves.map((sh) => ({ ...sh, items: {} })),
  level: 3,
  upgrades: ['kitchen'],
  warehouse: { potatoes: units(10), meat: units(3), bread: units(5), milk: units(4), apples: units(1) },
  ...patch,
});
const chef = (extra: Partial<StaffMember> = {}): StaffMember => ({ role: 'cook', name: 0, skill: 2, wage: wageFor('cook', 2), months: 0, ...extra });
/** Вчера хотели столько порций (строка отчёта дня с кухней). */
const demand = (wanted: number): Partial<StoreState> => ({
  reports: [{ day: 1, revenue: 0, served: 0, lost: 0, sold: {}, spoiled: {}, pricey: {}, missing: {}, kitchen: { sold: wanted, wanted, spoiled: 0 } }],
});
/** День с такой погодой (погода зависит только от дня). */
const dayWith = (weather: Weather): number => {
  for (let d = 10; ; d++) if (weatherFor(d) === weather) return d;
};

describe('кухня', () => {
  it('комната есть только в больших помещениях и стоит над кофейней', () => {
    expect(layoutFor(KITCHEN_FROM - 1).kitchen).toBeUndefined();
    for (const level of [KITCHEN_FROM, KITCHEN_FROM + 1]) {
      const l = layoutFor(level);
      expect(l.kitchen!.y + l.kitchen!.h).toBeLessThan(l.coffee.y);
      expect(l.kitchen!.y).toBeGreaterThanOrEqual(0);
      expect(l.wing.y).toBe(l.kitchen!.y);
    }
  });

  it('готовка тратит продукты со склада и даёт порции', () => {
    expect(canCook({ ...at(), upgrades: [] }, 'olivier')).toBe(false);
    const s = cook(at(), 'olivier')!;
    expect(s.warehouse.potatoes).toHaveLength(8);
    expect(s.warehouse.meat).toHaveLength(2);
    expect(portionsTotal(s)).toBe(DISHES.olivier.portions);
    // Не хватает яблок на вторые блины (на складе одно, на полках яблок нет).
    const p = cook(s, 'pancakes')!;
    expect(cook(p, 'pancakes')).toBeNull();
  });

  it('чего нет на складе, берут с полок в зале', () => {
    const base = at({ warehouse: { milk: units(1) } });
    const shelves = base.shelves.map((sh, i) => (i === 0 ? { ...sh, items: { milk: units(3) } } : sh));
    const s = takeIngredients({ ...base, shelves }, 'syrniki')!;
    expect(s.warehouse.milk).toHaveLength(0);
    expect(s.shelves[0].items.milk).toHaveLength(1);
    expect(takeIngredients(s, 'syrniki')).toBeNull();
  });

  it('полка «Еда» не больше foodSlots; продажа и списание ночью', () => {
    const max = foodSlots(at());
    expect(max).toBe(FOOD_SLOTS[0]);
    let s: StoreState = { ...at(), kitchen: { olivier: max - 2 } };
    expect(canCook(s, 'borscht')).toBe(false);
    expect(portionsTotal(servePortions(s, 'borscht'))).toBe(max);
    s = { ...at(), kitchen: { borscht: 1 } };
    expect(sellDish(s, () => 0.99)).toBeNull();
    const sold = sellDish(s, () => 0)!;
    expect(sold.dish).toBe('borscht');
    // Хотел порцию, а витрина пуста — продажи нет, но спрос записан.
    expect(sellDish(sold.state, () => 0)).toEqual({ state: sold.state, dish: null });
    expect(spoilDishes({ ...at(), kitchen: { olivier: 3 } })).toMatchObject({ spoiled: 3, state: { kitchen: {} } });
  });

  it('новые блюда — из продуктов магазина и не повторяют выпечку пекарни', () => {
    expect(DISH_IDS).toEqual(['olivier', 'borscht', 'pancakes', 'pelmeni', 'syrniki', 'ukha']);
    for (const id of DISH_IDS) {
      expect(Object.keys(DISHES[id].needs).some((p) => ['pies', 'buns', 'honeycake'].includes(p))).toBe(false);
      // Порция дороже продуктов на неё, но не в разы: кухня выгодна, но не главная статья.
      const cost = Object.entries(DISHES[id].needs).reduce((sum, [p, n]) => sum + ({ potatoes: 10, meat: 90, bread: 25, milk: 36, apples: 16, dumplings: 45, fish: 60 }[p] ?? 0) * (n ?? 0), 0);
      const revenue = DISHES[id].price * DISHES[id].portions;
      expect(revenue / cost).toBeGreaterThan(1.6);
      expect(revenue / cost).toBeLessThan(3);
    }
  });

  it('у блюд и плит есть картинки в атласе', () => {
    for (const id of DISH_IDS) expect(TEXTURES).toContain(`kdish_${id}`);
    for (const key of ['stove0', 'stove1', 'stove2', 'kpot', 'kpan', 'ktable', 'kknife', 'kshowcase', 'kshowcase_glass', 'kbasket', 'kcrate', 'ktiles', 'kplates']) expect(TEXTURES).toContain(key);
    for (const key of ['food_shelf0', 'food_shelf1', 'food_shelf2', 'food_glass2']) expect(TEXTURES).toContain(key);
  });
});

describe('повар', () => {
  it('нанимается, когда есть кухня, и в большом помещении есть место для всех должностей', () => {
    expect(roleOpen({ ...at(), upgrades: [] }, 'cook')).toBe(false);
    expect(roleOpen(at(), 'cook')).toBe(true);
    // В супермаркете — три кассы, в универмаге — четыре: все должности с поваром помещаются.
    expect(STAFF_LIMIT[3]).toBeGreaterThanOrEqual(STAFF_ROLE_IDS.filter((r) => r !== 'cashier4').length);
    expect(STAFF_LIMIT[4]).toBeGreaterThanOrEqual(STAFF_ROLE_IDS.length);
  });

  it('без повара (или в его выходной) кухня сама не готовит', () => {
    expect(kitchenWorking(at())).toBe(false);
    expect(cookBatch(at())).toEqual([]);
    const off = at({ staff: [chef({ offDay: 1 })] });
    expect(kitchenWorking(off)).toBe(false);
    expect(kitchenWorking(at({ staff: [chef()] }))).toBe(true);
  });

  it('готовит по меню и разнообразно, пока порций не хватит до вечера', () => {
    const s = at({ staff: [chef()], gear: { stove: 1 }, ...demand(20) });
    const batch = cookBatch(s, 1);
    expect(batch).toHaveLength(stovePots(s));
    expect(new Set(batch).size).toBe(batch.length);
    // Только выбранное в меню.
    const menu = toggleMenu(s, 'pancakes');
    expect(menuAuto(menu)).toBe(false);
    expect(cookMenu(menu)).toEqual(['pancakes']);
    expect(cookBatch(menu, 1)).toEqual(['pancakes']);
    expect(menuAuto(toggleMenu(menu, 'pancakes'))).toBe(true);
    expect(menuAuto(toggleMenu(menu, null))).toBe(true);
    // Под вечер порций уже хватает — новое не ставит: к ночи всё лишнее спишется.
    const stocked = { ...s, kitchen: { olivier: 8 } };
    expect(cookBatch(stocked, 1)).not.toEqual([]);
    expect(cookBatch(stocked, 0.3)).toEqual([]);
    // Спрос маленький — одна кастрюля, а не две.
    expect(cookBatch({ ...s, ...demand(5) }, 1)).toHaveLength(1);
    // Полка «Еда» полна — тоже.
    expect(cookBatch({ ...s, kitchen: { olivier: foodSlots(s) } }, 1)).toEqual([]);
    // Продуктов нет — нечего ставить.
    expect(cookBatch({ ...s, warehouse: {} }, 1)).toEqual([]);
  });

  it('спрос считает с того, когда сварится: пока варится, витрина торгует своим', () => {
    const s = at({ staff: [chef()], ...demand(13.5) });
    // За 30 секунд до закрытия захотят 4–5 порций, но закладка будет в витрине лишь за 7 секунд до него.
    expect(cookBatch(s, 30 / 90)).not.toEqual([]);
    expect(cookBatch(s, 30 / 90, 23 / 90)).toEqual([]);
    // В витрине шесть порций, почти четыре из них разберут, пока варится: новое ставит, не дожидаясь пустой витрины.
    expect(cookBatch({ ...s, kitchen: { olivier: 6 } }, 60 / 90, 26 / 90)).toEqual(['olivier']);
  });

  it('в снег охотнее берут горячее, в жару — холодное; повар готовит под погоду', () => {
    const snow = dayWith('snow');
    const heat = dayWith('heat');
    expect(dishAppeal(at({ day: snow }), 'borscht')).toBeGreaterThan(dishAppeal(at({ day: snow }), 'olivier'));
    expect(dishAppeal(at({ day: heat }), 'olivier')).toBeGreaterThan(dishAppeal(at({ day: heat }), 'borscht'));
    const stock = { potatoes: units(10), meat: units(4), bread: units(4), milk: units(6), apples: units(2) };
    expect(DISHES[cookBatch(at({ day: snow, staff: [chef()], warehouse: stock }), 1)[0]].hot).toBe(true);
    expect(DISHES[cookBatch(at({ day: heat, staff: [chef()], warehouse: stock }), 1)[0]].hot).toBeFalsy();
  });

  it('спрос — по отчётам прошлых дней; без истории — по гостям', () => {
    const s = at();
    expect(dishDemand(s)).toBeGreaterThan(0);
    const stats = { ...emptyDayStats(), dishes: 9, dishWanted: 12 };
    const reported = addReport(s, 1, stats, {}, 3);
    expect(reported.reports!.at(-1)!.kitchen).toEqual({ sold: 9, wanted: 12, spoiled: 3 });
    expect(dishDemand(reported)).toBe(12);
    // День без кухни — строки нет, спрос по-прежнему по дням с кухней.
    expect(addReport(reported, 2, emptyDayStats(), {}).reports!.at(-1)!.kitchen).toBeUndefined();
    expect(dishDemand(addReport(reported, 2, emptyDayStats(), {}))).toBe(12);
  });

  it('ночью непроданное списывается и попадает в отчёт дня', () => {
    const s = at({ kitchen: { borscht: 5 } });
    const night = nightCycle(s, { ...emptyDayStats(), dishes: 3, dishWanted: 4 }, () => 0.5);
    expect(portionsTotal(night.state)).toBe(0);
    expect(night.state.reports!.at(-1)!.kitchen).toEqual({ sold: 3, wanted: 4, spoiled: 5 });
  });

  it('кухня с поваром утром сама закупает продукты в кладовую — из кассы; без повара — ничего', () => {
    const s = at({ staff: [chef()], money: 5000, warehouse: {}, shelves: [], cookMenu: ['olivier'] });
    expect(kitchenNeeds(at({ warehouse: {} }))).toEqual({});
    const needs = kitchenNeeds(s);
    expect(needs.meat).toBeGreaterThan(0);
    expect(needs.potatoes).toBe((needs.meat ?? 0) * 2);
    expect(morningOrder(s)).toEqual(needs);
    const bought = stockKitchen(s);
    expect(bought.spent).toBe(orderCost(needs));
    expect(bought.state.money).toBe(5000 - bought.spent);
    expect(pantryOf(bought.state, 'meat')).toBe(needs.meat);
    // Наутро в кладовой ещё осталось — докупает только недостающее.
    expect(morningOrder(bought.state)).toEqual({});
    // Без повара (и в его выходной) кухня ничего не покупает.
    expect(stockKitchen({ ...s, staff: [] }).spent).toBe(0);
    expect(stockKitchen({ ...s, staff: [chef({ offDay: 1 })] }).spent).toBe(0);
    // Денег мало — берёт, на что хватает, в минус не уходит.
    const poor = stockKitchen({ ...s, money: 100 });
    expect(poor.state.money).toBeGreaterThanOrEqual(0);
    expect(poor.spent).toBeLessThanOrEqual(100);
  });

  it('«Закупить нужное» больше не докупает повару: у кухни своя закупка', () => {
    const shelves = [
      { kind: 'meat' as const, level: 0, items: {} },
      { kind: 'produce' as const, level: 0, items: {} },
    ];
    const s = at({ staff: [chef()], money: 5000, warehouse: {}, shelves, cookMenu: ['olivier'] });
    const price = () => 10;
    const qty = (plan: ReturnType<typeof restockPlan>, id: 'meat' | 'potatoes') => plan.lines.filter((l) => l.pid === id).reduce((n, l) => n + l.qty, 0);
    expect(qty(restockPlan(s, price, 60), 'meat')).toBe(qty(restockPlan({ ...s, staff: [] }, price, 60), 'meat'));
  });

  it('повар берёт из кладовой, а кончилось днём — кухня докупает ровно на закладку', () => {
    const s = at({ staff: [chef()], money: 5000, warehouse: { potatoes: units(10), meat: units(3) }, cookMenu: ['olivier'], ...demand(20) });
    // Кладовая пуста: по продуктам из магазина повар не варит, пока кухня не докупит своё.
    const plan = cookBatch(s, 1, 0, undefined, true);
    expect(plan).toEqual(['olivier']);
    const top = topUpKitchen(s, plan);
    expect(top.bought).toEqual({ potatoes: 2, meat: 1 });
    expect(top.state.money).toBe(5000 - top.spent);
    const cooked = takeIngredients(top.state, 'olivier')!;
    expect(pantryOf(cooked, 'meat')).toBe(0);
    // Склад магазина не тронут.
    expect(cooked.warehouse.meat).toHaveLength(3);
    // Кладовой хватает — докупать нечего.
    expect(topUpKitchen(top.state, plan).spent).toBe(0);
  });

  it('закупка повару — по спросу за день, но не больше, чем он успеет сварить', () => {
    const shelves = [
      { kind: 'meat' as const, level: 0, items: {} },
      { kind: 'produce' as const, level: 0, items: {} },
    ];
    // Газовая плита: две кастрюли сразу.
    const base = at({ staff: [chef()], warehouse: {}, shelves, cookMenu: ['olivier'], gear: { stove: 1 } });
    // Хотят 20 порций: оливье по 4 и +1 с газовой плиты — четыре закладки, хотя повар успел бы больше.
    expect(kitchenNeeds({ ...base, ...demand(20) }).meat).toBe(4);
    // Хотят 500 — столько закладок, сколько раз за день повар успеет поставить кастрюли.
    const cap = cookRoundsPerDay(base, 90, 1) * stovePots(base);
    expect(kitchenNeeds({ ...base, ...demand(500) }).meat).toBe(cap);
    // Полка вмещает foodSlots, но за день порции разбирают: закупка не упирается в неё.
    expect(cap * DISHES.olivier.portions).toBeGreaterThan(foodSlots(base));
  });
});

describe('плита', () => {
  it('новые модели — только с кухней: быстрее, две кастрюли, у плиты шефа лишняя порция', () => {
    expect(GEAR_IDS).toContain('stove');
    expect(gearAvailable({ ...at(), upgrades: [] }, 'stove')).toBe(false);
    const s = at({ money: 10000 });
    expect(gearAvailable(s, 'stove')).toBe(true);
    const t1 = upgradeGear(s, 'stove')!;
    const t2 = upgradeGear(t1, 'stove')!;
    expect(stoveSeconds(t1)).toBeLessThan(stoveSeconds(s));
    expect(stoveSeconds(t2)).toBeLessThan(stoveSeconds(t1));
    expect([stovePots(s), stovePots(t1), stovePots(t2)]).toEqual([1, 2, 2]);
    expect(dishPortions(t2, 'olivier')).toBe(dishPortions(s, 'olivier') + 1);
    expect(cookRoundsPerDay(t2, 90)).toBeGreaterThan(cookRoundsPerDay(s, 90));
  });
});

describe('полка «Еда»', () => {
  it('улучшается только с кухней: больше порций, холодильник держит часть до утра, у витрины берут чаще', () => {
    expect(GEAR_IDS).toContain('foodShelf');
    expect(gearAvailable({ ...at(), upgrades: [] }, 'foodShelf')).toBe(false);
    const s = at({ money: 10000 });
    const t1 = upgradeGear(s, 'foodShelf')!;
    const t2 = upgradeGear(t1, 'foodShelf')!;
    expect([foodSlots(s), foodSlots(t1), foodSlots(t2)]).toEqual(FOOD_SLOTS);
    // Деревянная полка: к утру списывается всё; в холодильнике — половина, в витрине-горке — три четверти.
    expect(spoilDishes({ ...s, kitchen: { borscht: 8 } })).toMatchObject({ spoiled: 8, state: { kitchen: {} } });
    expect(spoilDishes({ ...t1, kitchen: { borscht: 8, olivier: 3 } })).toMatchObject({ spoiled: 6, state: { kitchen: { borscht: 4, olivier: 1 } } });
    expect(spoilDishes({ ...t2, kitchen: { borscht: 8 } })).toMatchObject({ spoiled: 2, state: { kitchen: { borscht: 6 } } });
    expect(FOOD_KEEP[0]).toBe(0);
    // Нарядная витрина: тот же бросок, что у простой полки мимо, у неё — порция.
    const roll = () => 0.17;
    expect(wantsDish(s, roll)).toBe(false);
    expect(wantsDish(t2, roll)).toBe(true);
  });

  it('покупатель берёт с полки порцию; пустая — ничего', () => {
    const s = at({ kitchen: { pancakes: 1 } });
    const took = takeDish(s, () => 0)!;
    expect(took.dish).toBe('pancakes');
    expect(portionsTotal(took.state)).toBe(0);
    expect(takeDish(took.state, () => 0)).toBeNull();
  });

  it('старое сохранение: порции из витрины кухни стоят на полке «Еда»', () => {
    const old = { ...at(), kitchen: { olivier: 4, ukha: 3 } } as StoreState;
    delete (old as { pantry?: unknown }).pantry;
    expect(portionsTotal(old)).toBe(7);
    expect(pantryOf(old, 'meat')).toBe(0);
    expect(takeDish(old, () => 0)?.dish).toBe('olivier');
  });
});
