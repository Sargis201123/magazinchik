// Кухня-кулинария во флигеле над кофейней (улучшение «Кухня», с 4-го помещения). Готовят блюда из
// продуктов (со склада, потом с полок) — оливье, борщ, блины, пельмени, сырники, уху; днём покупатели
// докупают порцию на кассе (как кофе). Готовое стоит в витрине-раздаче до вечера: что не продали —
// ночью списывается.
//
// Без повара готовишь сам — утром, сколько влезет в витрину. Повар (его нанимают) готовит весь день:
// ходит за продуктами (на склад, чего там нет — к полке в зале), режет, варит и выставляет порции —
// по меню дня и столько, сколько разберут до закрытия. «Закупить нужное» докупает продукты и ему.
// Плита (оборудование) варит быстрее и в двух кастрюлях сразу.

import { DAY_SECONDS, expectedGuests, onShelves, onShift, sellableProducts, staffOf, warehouseOf, workSpeed, type ProductId, type StoreState } from './economy';
import { gearTier } from './gear';
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

/** Сколько порций помещается в витрине кухни и шанс, что покупатель возьмёт порцию. */
export const PORTIONS_MAX = 24;
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

// ---------- Готовка ----------

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Хватает ли продуктов (склад и полки) на закладку. */
export const hasIngredients = (state: StoreState, id: DishId): boolean =>
  Object.entries(DISHES[id].needs).every(([p, n]) => stockOf(state, p as ProductId) >= (n ?? 0));

/** Хватает ли продуктов (склад и полки) на закладку и места в витрине. */
export const canCook = (state: StoreState, id: DishId): boolean =>
  kitchenOpen(state) && portionsTotal(state) + dishPortions(state, id) <= PORTIONS_MAX && hasIngredients(state, id);

/** Забрать штуки: сначала со склада, потом с полок. */
function take(state: StoreState, id: ProductId, n: number): StoreState {
  const fromWarehouse = Math.min(n, warehouseOf(state, id));
  let left = n - fromWarehouse;
  const shelves = state.shelves.map((s) => {
    const units = s.items[id] ?? [];
    const k = Math.min(left, units.length);
    left -= k;
    return k ? { ...s, items: { ...s.items, [id]: units.slice(k) } } : s;
  });
  return { ...state, shelves, warehouse: { ...state.warehouse, [id]: (state.warehouse[id] ?? []).slice(fromWarehouse) } };
}

/** Продукты на закладку: сначала со склада, потом с полок. null — не хватает. */
export function takeIngredients(state: StoreState, id: DishId): StoreState | null {
  if (!hasIngredients(state, id)) return null;
  let s = state;
  for (const [p, n] of Object.entries(DISHES[id].needs)) s = take(s, p as ProductId, n ?? 0);
  return s;
}

/** Готовые порции — в витрину (не больше, чем она вмещает). */
export const servePortions = (state: StoreState, id: DishId, n = dishPortions(state, id)): StoreState => ({
  ...state,
  kitchen: { ...state.kitchen, [id]: portionsOf(state, id) + Math.max(0, Math.min(n, PORTIONS_MAX - portionsTotal(state))) },
});

/** Приготовить закладку сразу (утром, своими руками): продукты со склада, потом с полок → порции. */
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
 * порций сверх того, что уже в витрине: готовое ночью списывается, лишнего к вечеру не варим.
 */
const worthCooking = (state: StoreState, id: DishId, want: number): boolean => portionsTotal(state) + dishPortions(state, id) / 2 < want;

/**
 * Что повар ставит на плиту сейчас (по кастрюле на блюдо, сколько есть кастрюль): из меню дня то, что
 * охотнее берут и чего меньше в витрине. Не готовит, если продуктов нет, витрина полна или порций уже
 * хватит до закрытия.
 */
export function cookBatch(state: StoreState, dayLeft = 1, pots = stovePots(state)): DishId[] {
  if (!kitchenWorking(state)) return [];
  const want = dishDemand(state) * dayLeft;
  const out: DishId[] = [];
  let s = state;
  for (let i = 0; i < pots; i++) {
    const have = portionsTotal(s);
    const options = cookMenu(s).filter((id) => have + dishPortions(s, id) <= PORTIONS_MAX && worthCooking(s, id, want) && hasIngredients(s, id));
    if (!options.length) break;
    const score = (id: DishId) => dishAppeal(s, id) / (1 + portionsOf(s, id));
    const best = options.reduce((a, b) => (score(b) > score(a) ? b : a));
    s = servePortions(takeIngredients(s, best)!, best);
    out.push(best);
  }
  return out;
}

/**
 * Сколько продуктов повар заберёт за день — «Закупить нужное» докупает это сверху. Считаем, как он сам
 * выбирает (охотнее берут и меньше в витрине), из блюд меню, чьи продукты магазин продаёт (есть полка).
 * Порции за день не упираются в витрину (их разбирают), но закладок не больше, чем повар успеет сварить.
 */
export function kitchenNeeds(state: StoreState): Partial<Record<ProductId, number>> {
  const chef = staffOf(state, 'cook');
  if (!kitchenWorking(state) || !chef) return {};
  const sold = sellableProducts(state);
  const menu = cookMenu(state).filter((id) => Object.keys(DISHES[id].needs).every((p) => sold.includes(p as ProductId)));
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

/**
 * Покупатель на кассе хочет порцию (шанс DISH_CHANCE) и берёт из готового — что сегодня по душе.
 * null — не захотел; dish: null — хотел, но витрина пуста (в отчёт: «не хватило»).
 */
export function sellDish(state: StoreState, random: () => number): { state: StoreState; dish: DishId | null } | null {
  if (!kitchenOpen(state) || random() >= DISH_CHANCE) return null;
  const ready = DISH_IDS.filter((id) => portionsOf(state, id) > 0);
  if (!ready.length) return { state, dish: null };
  const total = ready.reduce((sum, id) => sum + dishAppeal(state, id), 0);
  let roll = random() * total;
  const dish = ready.find((id) => (roll -= dishAppeal(state, id)) < 0) ?? ready[ready.length - 1];
  return { state: { ...state, kitchen: { ...state.kitchen, [dish]: portionsOf(state, dish) - 1 } }, dish };
}

/** Ночью непроданное списывается: сколько порций пропало. */
export function spoilDishes(state: StoreState): { state: StoreState; spoiled: number } {
  const spoiled = portionsTotal(state);
  return spoiled ? { state: { ...state, kitchen: {} }, spoiled } : { state, spoiled: 0 };
}

// ---------- Сколько успевает повар (закупка и симулятор) ----------

/** Дорога за продуктами и нарезка — секунд на закладку сверх варки (в игре повар ходит сам). */
export const COOK_ROUND_EXTRA = 9;
/** Сколько раз за день повар успевает поставить кастрюли (при скорости pace). */
export const cookRoundsPerDay = (state: StoreState, daySeconds: number, pace = 1): number =>
  Math.floor((daySeconds * pace) / (stoveSeconds(state) + COOK_ROUND_EXTRA));
