// Кухня-кулинария во флигеле над кофейней (улучшение «Кухня», с 4-го помещения). Готовят блюда из
// продуктов — оливье, борщ, блины, пельмени, сырники, уху — и выставляют на полку «Еда» у входа:
// покупатели по пути к кассе берут с неё порцию сверх покупок. Что не продали, ночью списывается
// (холодильная витрина часть сохраняет до утра).
//
// Без повара готовишь сам — утром, из продуктов магазина (склад, потом полки), сколько влезет на полку.
// Повар (его нанимают) ведёт кухню сам: у кухни своя кладовая (ящик с продуктами), её он каждое утро
// заполняет у поставщиков на день вперёд — из кассы магазина, — а кончится днём, докупает к следующей
// закладке. Режет, варит, носит тарелки на полку — по меню дня и столько, сколько разберут до закрытия.
// Плита (оборудование) варит быстрее и в двух кастрюлях сразу, полка «Еда» (тоже оборудование) вмещает
// больше и в холодильнике держит готовое до утра.

import { DAY_SECONDS, expectedGuests, onShelves, onShift, PRODUCTS, staffOf, warehouseOf, workSpeed, type ProductId, type StoreState } from './economy';
import { gearTier } from './gear';
import { usualCost } from './reports';
import { hasUpgrade } from './upgrades';
import { weatherFor } from './weather';

export type DishId = 'olivier' | 'borscht' | 'pancakes' | 'pelmeni' | 'syrniki' | 'ukha';

export interface Dish {
  icon: string;
  /** Что уходит со склада на одну закладку и сколько порций выходит. */
  needs: Partial<Record<ProductId, number>>;
  portions: number;
  price: number;
  /** Горячее: в дождь, грозу и снег его берут охотнее, в жару — реже. */
  hot?: boolean;
}

// Пельмени — из замороженных (отдел заморозки), сырники — из молока (творог), уха — из рыбы с картошкой.
// С выпечкой пекарни (пирожки, булочки, медовик) не пересекаются. Из кастрюли супа и стопки блинов
// порций больше. Порции дороже продуктов на них в полтора раза по магазинным ценам: готовить выгодно,
// даже если эти продукты разобрали бы и так, но не в разы (tests/kitchen.test.ts).
export const DISHES: Record<DishId, Dish> = {
  olivier: { icon: '🥗', needs: { potatoes: 2, meat: 1 }, portions: 4, price: 75 },
  borscht: { icon: '🍲', needs: { potatoes: 1, meat: 1, bread: 1 }, portions: 6, price: 55, hot: true },
  pancakes: { icon: '🥞', needs: { milk: 2, apples: 1 }, portions: 6, price: 40 },
  pelmeni: { icon: '🥣', needs: { dumplings: 2, milk: 1 }, portions: 5, price: 70, hot: true },
  syrniki: { icon: '🧀', needs: { milk: 3 }, portions: 6, price: 45 },
  ukha: { icon: '🍜', needs: { fish: 1, potatoes: 2 }, portions: 5, price: 45, hot: true },
};
export const DISH_IDS = Object.keys(DISHES) as DishId[];

/** Шанс, что покупатель возьмёт порцию с полки «Еда» (у нарядной витрины — чаще, FOOD_APPEAL). */
export const DISH_CHANCE = 0.16;

export const kitchenOpen = (state: StoreState): boolean => hasUpgrade(state, 'kitchen');
/** Кухня готовит сама: куплена и повар сегодня на смене. */
export const kitchenWorking = (state: StoreState): boolean => kitchenOpen(state) && onShift(state, 'cook');
export const portionsOf = (state: StoreState, id: DishId): number => state.kitchen?.[id] ?? 0;
export const portionsTotal = (state: StoreState): number => DISH_IDS.reduce((n, id) => n + portionsOf(state, id), 0);

// ---------- Плита (оборудование, gear.ts) ----------

/** Сколько секунд варится закладка, сколько кастрюль на плите сразу и лишняя порция у плиты шефа. */
export const STOVE_SECONDS = [12, 10, 8];
export const STOVE_POTS = [1, 2, 2];
export const STOVE_EXTRA = [0, 0, 1];
export const stoveSeconds = (state: StoreState): number => STOVE_SECONDS[gearTier(state, 'stove')];
export const stovePots = (state: StoreState): number => STOVE_POTS[gearTier(state, 'stove')];
/** Сколько порций выходит из закладки на этой плите. */
export const dishPortions = (state: StoreState, id: DishId): number => DISHES[id].portions + STOVE_EXTRA[gearTier(state, 'stove')];
/** Картинка плиты для модели. */
export const stoveSprite = (state: StoreState): string => `stove${gearTier(state, 'stove')}`;

// ---------- Полка «Еда» у входа (оборудование, gear.ts) ----------

/**
 * Сколько порций вмещает полка, какая доля готового доживает до утра (деревянная полка — ничего,
 * холодильник — половина, витрина-горка — три четверти) и насколько охотнее берут с нарядной витрины.
 */
export const FOOD_SLOTS = [20, 28, 36];
export const FOOD_KEEP = [0, 0.5, 0.75];
export const FOOD_APPEAL = [1, 1, 1.15];
export const foodSlots = (state: StoreState): number => FOOD_SLOTS[gearTier(state, 'foodShelf')];
/** Картинка полки «Еда» для модели. */
export const foodSprite = (state: StoreState): string => `food_shelf${gearTier(state, 'foodShelf')}`;

// ---------- Кладовая кухни: закупка у поставщиков ----------

export const pantryOf = (state: StoreState, id: ProductId): number => state.pantry?.[id] ?? 0;
/** Почём кухня берёт продукт у поставщиков: как обычная закупка магазина. */
export const ingredientPrice = (id: ProductId): number => usualCost(id) ?? PRODUCTS[id].cost;
export const orderCost = (items: Partial<Record<ProductId, number>>): number =>
  Object.entries(items).reduce((sum, [p, n]) => sum + ingredientPrice(p as ProductId) * (n ?? 0), 0);

/** Продукты на закладки plan. */
export function dishNeeds(plan: DishId[]): Partial<Record<ProductId, number>> {
  const out: Partial<Record<ProductId, number>> = {};
  for (const id of plan) for (const [p, n] of Object.entries(DISHES[id].needs)) out[p as ProductId] = (out[p as ProductId] ?? 0) + (n ?? 0);
  return out;
}

/** Чего не хватает в кладовой на эти продукты. */
export function pantryShort(state: StoreState, needs: Partial<Record<ProductId, number>>): Partial<Record<ProductId, number>> {
  const out: Partial<Record<ProductId, number>> = {};
  for (const [p, n] of Object.entries(needs)) {
    const short = (n ?? 0) - pantryOf(state, p as ProductId);
    if (short > 0) out[p as ProductId] = short;
  }
  return out;
}

/**
 * Кухня закупает продукты в кладовую — из кассы магазина. На что денег не хватает, того не берёт
 * (по продуктам по порядку). Возвращает, что купили и почём.
 */
export function buyPantry(state: StoreState, items: Partial<Record<ProductId, number>>): { state: StoreState; spent: number; bought: Partial<Record<ProductId, number>> } {
  let money = state.money;
  const pantry = { ...(state.pantry ?? {}) };
  const bought: Partial<Record<ProductId, number>> = {};
  for (const [p, n] of Object.entries(items)) {
    const id = p as ProductId;
    const price = ingredientPrice(id);
    const qty = Math.min(n ?? 0, Math.floor(money / price));
    if (qty <= 0) continue;
    money -= qty * price;
    pantry[id] = (pantry[id] ?? 0) + qty;
    bought[id] = qty;
  }
  const spent = state.money - money;
  return spent ? { state: { ...state, money, pantry }, spent, bought } : { state, spent: 0, bought };
}

/** Что кухня закупит утром: продукты на день вперёд (kitchenNeeds) за вычетом того, что осталось в кладовой. */
export const morningOrder = (state: StoreState): Partial<Record<ProductId, number>> => pantryShort(state, kitchenNeeds(state));

/** Утром, пока повар на смене: кухня сама заполняет кладовую на день. Без повара — ничего не покупает. */
export const stockKitchen = (state: StoreState): { state: StoreState; spent: number; bought: Partial<Record<ProductId, number>> } =>
  kitchenWorking(state) ? buyPantry(state, morningOrder(state)) : { state, spent: 0, bought: {} };

/**
 * Днём продукты кончились: повар собирается ставить plan (cookBatch с stocked) — кухня докупает
 * в кладовую ровно то, чего на эти закладки не хватает.
 */
export const topUpKitchen = (state: StoreState, plan: DishId[]): { state: StoreState; spent: number; bought: Partial<Record<ProductId, number>> } =>
  kitchenWorking(state) ? buyPantry(state, pantryShort(state, dishNeeds(plan))) : { state, spent: 0, bought: {} };

// ---------- Готовка ----------

const stockOf = (state: StoreState, id: ProductId): number => pantryOf(state, id) + warehouseOf(state, id) + onShelves(state, id);

/** Хватает ли продуктов (кладовая кухни, склад и полки) на закладку. */
export const hasIngredients = (state: StoreState, id: DishId): boolean =>
  Object.entries(DISHES[id].needs).every(([p, n]) => stockOf(state, p as ProductId) >= (n ?? 0));

/** Хватает ли продуктов на закладку и места на полке «Еда». */
export const canCook = (state: StoreState, id: DishId): boolean =>
  kitchenOpen(state) && portionsTotal(state) + dishPortions(state, id) <= foodSlots(state) && hasIngredients(state, id);

/** Забрать штуки: сначала из кладовой кухни, потом со склада, потом с полок. */
function take(state: StoreState, id: ProductId, n: number): StoreState {
  const fromPantry = Math.min(n, pantryOf(state, id));
  const fromWarehouse = Math.min(n - fromPantry, warehouseOf(state, id));
  let left = n - fromPantry - fromWarehouse;
  const shelves = state.shelves.map((s) => {
    const units = s.items[id] ?? [];
    const k = Math.min(left, units.length);
    left -= k;
    return k ? { ...s, items: { ...s.items, [id]: units.slice(k) } } : s;
  });
  const pantry = fromPantry ? { pantry: { ...state.pantry, [id]: pantryOf(state, id) - fromPantry } } : {};
  return { ...state, ...pantry, shelves, warehouse: { ...state.warehouse, [id]: (state.warehouse[id] ?? []).slice(fromWarehouse) } };
}

/** Продукты на закладку: из кладовой, потом со склада, потом с полок. null — не хватает. */
export function takeIngredients(state: StoreState, id: DishId): StoreState | null {
  if (!hasIngredients(state, id)) return null;
  let s = state;
  for (const [p, n] of Object.entries(DISHES[id].needs)) s = take(s, p as ProductId, n ?? 0);
  return s;
}

/** Готовые порции — на полку «Еда» (не больше, чем она вмещает). */
export const servePortions = (state: StoreState, id: DishId, n = dishPortions(state, id)): StoreState => ({
  ...state,
  kitchen: { ...state.kitchen, [id]: portionsOf(state, id) + Math.max(0, Math.min(n, foodSlots(state) - portionsTotal(state))) },
});

/** Приготовить закладку сразу (утром, своими руками): продукты из кладовой, со склада, потом с полок → порции. */
export function cook(state: StoreState, id: DishId): StoreState | null {
  if (!canCook(state, id)) return null;
  const taken = takeIngredients(state, id);
  return taken && servePortions(taken, id);
}

// ---------- Спрос и меню дня ----------

/**
 * Насколько охотно берут блюдо сегодня: в дождь, грозу и снег — горячее, в жару — холодное.
 * Из готового покупатель выбирает с этими весами, повар «по спросу» готовит с ними же.
 */
export function dishAppeal(state: StoreState, id: DishId): number {
  const weather = weatherFor(state.day);
  const cold = weather === 'rain' || weather === 'storm' || weather === 'snow';
  if (DISHES[id].hot) return cold ? 1.6 : weather === 'heat' ? 0.6 : 1;
  return weather === 'heat' ? 1.4 : 1;
}

/** Блюда, которые игрок выбрал в меню дня (незнакомые из старых сохранений — мимо). */
const chosenMenu = (state: StoreState): DishId[] => (state.cookMenu ?? []).filter((id) => id in DISHES);
/** «Авто»: меню не выбрано — повар сам решает, что готовить, из всех блюд. */
export const menuAuto = (state: StoreState): boolean => chosenMenu(state).length === 0;
/** Из чего повар выбирает сегодня. */
export const cookMenu = (state: StoreState): DishId[] => (menuAuto(state) ? DISH_IDS : chosenMenu(state));

/** Включить или выключить блюдо в меню дня; null — «авто» (повар выбирает сам). */
export function toggleMenu(state: StoreState, id: DishId | null): StoreState {
  if (id === null) return { ...state, cookMenu: undefined };
  const now = chosenMenu(state);
  const next = now.includes(id) ? now.filter((d) => d !== id) : [...now, id];
  return { ...state, cookMenu: next.length ? DISH_IDS.filter((d) => next.includes(d)) : undefined };
}

/**
 * Сколько порций обычно хотят за день: по отчётам последних трёх дней (вместе с теми, кому
 * не хватило), а без истории — примерно каждый шестой гость.
 */
export function dishDemand(state: StoreState): number {
  const days = (state.reports ?? []).filter((d) => d.kitchen).slice(-3);
  if (days.length) return days.reduce((sum, d) => sum + d.kitchen!.wanted, 0) / days.length;
  return expectedGuests(state.rating, state.level) * DISH_CHANCE;
}

/**
 * Новая закладка нужна, если до закрытия (dayLeft — доля дня впереди) разберут хотя бы половину её
 * порций сверх того, что уже на полке: готовое ночью списывается, лишнего к вечеру не варим.
 */
const worthCooking = (state: StoreState, id: DishId, want: number): boolean => portionsTotal(state) + dishPortions(state, id) / 2 < want;

/**
 * Что повар ставит на плиту сейчас (по кастрюле на блюдо, сколько есть кастрюль): из меню дня то, что
 * охотнее берут и чего меньше на полке. Не готовит, если продуктов нет, полка полна или порций уже
 * хватит до закрытия. readyIn — через какую долю дня закладка будет на полке (нарезка, варка, дорога).
 * stocked — продукты не проверять: что повар поставил бы, будь всё в кладовой (по этому кухня докупает).
 */
export function cookBatch(state: StoreState, dayLeft = 1, readyIn = 0, pots = stovePots(state), stocked = false): DishId[] {
  if (!kitchenWorking(state)) return [];
  // Сваренное продаётся, только когда окажется на полке: пока варится, разбирают то, что на ней уже есть,
  // а кому не хватило — уходят без порции.
  const demand = dishDemand(state);
  const want = demand * Math.max(0, dayLeft - readyIn) + Math.min(portionsTotal(state), demand * readyIn);
  const out: DishId[] = [];
  let s = state;
  for (let i = 0; i < pots; i++) {
    const have = portionsTotal(s);
    const options = cookMenu(s).filter((id) => have + dishPortions(s, id) <= foodSlots(s) && worthCooking(s, id, want) && (stocked || hasIngredients(s, id)));
    if (!options.length) break;
    const score = (id: DishId) => dishAppeal(s, id) / (1 + portionsOf(s, id));
    const best = options.reduce((a, b) => (score(b) > score(a) ? b : a));
    s = servePortions(stocked ? s : takeIngredients(s, best)!, best);
    out.push(best);
  }
  return out;
}

/**
 * Сколько продуктов повар заберёт за день — столько кухня утром закупает в кладовую. Считаем, как он сам
 * выбирает (охотнее берут и меньше на полке), из блюд меню (продукты кухня берёт у поставщиков сама).
 * Порции за день не упираются в полку (их разбирают), но закладок не больше, чем повар успеет сварить.
 */
export function kitchenNeeds(state: StoreState): Partial<Record<ProductId, number>> {
  const chef = staffOf(state, 'cook');
  if (!kitchenWorking(state) || !chef) return {};
  const menu = cookMenu(state);
  const want = dishDemand(state);
  const batches = cookRoundsPerDay(state, DAY_SECONDS, workSpeed(chef)) * stovePots(state);
  const out: Partial<Record<ProductId, number>> = {};
  let s = state;
  for (let i = 0; menu.length && i < batches; i++) {
    const options = menu.filter((id) => worthCooking(s, id, want));
    if (!options.length) break;
    const score = (id: DishId) => dishAppeal(s, id) / (1 + portionsOf(s, id));
    const best = options.reduce((a, b) => (score(b) > score(a) ? b : a));
    s = { ...s, kitchen: { ...s.kitchen, [best]: portionsOf(s, best) + dishPortions(s, best) } };
    for (const [p, n] of Object.entries(DISHES[best].needs)) out[p as ProductId] = (out[p as ProductId] ?? 0) + (n ?? 0);
  }
  return out;
}

// ---------- Продажа и ночь ----------

/** Покупатель хочет порцию с полки «Еда» (шанс DISH_CHANCE, у нарядной витрины — выше). */
export const wantsDish = (state: StoreState, random: () => number): boolean =>
  kitchenOpen(state) && random() < DISH_CHANCE * FOOD_APPEAL[gearTier(state, 'foodShelf')];

/** Покупатель берёт с полки порцию — что сегодня по душе. null — полка пуста (в отчёт: «не хватило»). */
export function takeDish(state: StoreState, random: () => number): { state: StoreState; dish: DishId } | null {
  const ready = DISH_IDS.filter((id) => portionsOf(state, id) > 0);
  if (!ready.length) return null;
  const total = ready.reduce((sum, id) => sum + dishAppeal(state, id), 0);
  let roll = random() * total;
  const dish = ready.find((id) => (roll -= dishAppeal(state, id)) < 0) ?? ready[ready.length - 1];
  return { state: { ...state, kitchen: { ...state.kitchen, [dish]: portionsOf(state, dish) - 1 } }, dish };
}

/**
 * Покупатель хочет порцию и берёт с полки — что сегодня по душе (wantsDish + takeDish, для симулятора).
 * null — не захотел; dish: null — хотел, но полка пуста.
 */
export function sellDish(state: StoreState, random: () => number): { state: StoreState; dish: DishId | null } | null {
  if (!wantsDish(state, random)) return null;
  return takeDish(state, random) ?? { state, dish: null };
}

/**
 * Ночью непроданное списывается: сколько порций пропало. В холодильнике (полка «Еда» получше) часть
 * каждого блюда доживает до утра.
 */
export function spoilDishes(state: StoreState): { state: StoreState; spoiled: number } {
  const keep = FOOD_KEEP[gearTier(state, 'foodShelf')];
  const kitchen: Partial<Record<DishId, number>> = {};
  for (const id of DISH_IDS) {
    const kept = Math.floor(portionsOf(state, id) * keep);
    if (kept > 0) kitchen[id] = kept;
  }
  const spoiled = portionsTotal(state) - portionsTotal({ ...state, kitchen });
  return spoiled ? { state: { ...state, kitchen }, spoiled } : { state, spoiled: 0 };
}

// ---------- Сколько успевает повар (закупка и симулятор) ----------

/** Продукты из ящика, нарезка и дорога с тарелками к полке «Еда» — секунд на закладку сверх варки (в игре повар ходит сам). */
export const COOK_ROUND_EXTRA = 9;
/** Сколько раз за день повар успевает поставить кастрюли (при скорости pace). */
export const cookRoundsPerDay = (state: StoreState, daySeconds: number, pace = 1): number =>
  Math.floor((daySeconds * pace) / (stoveSeconds(state) + COOK_ROUND_EXTRA));
