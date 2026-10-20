// Кухня-кулинария во флигеле над кофейней (улучшение «Кухня», с 4-го помещения). Утром
// готовишь блюда из продуктов (со склада, потом с полок) — оливье, борщ, блины; днём покупатели докупают
// порцию на кассе (как кофе). Готовое хранится до вечера: что не продали — ночью списывается.

import { onShelves, warehouseOf, type ProductId, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';

export type DishId = 'olivier' | 'borscht' | 'pancakes';

export interface Dish {
  icon: string;
  /** Что уходит со склада на одну закладку и сколько порций выходит. */
  needs: Partial<Record<ProductId, number>>;
  portions: number;
  price: number;
}

export const DISHES: Record<DishId, Dish> = {
  olivier: { icon: '🥗', needs: { potatoes: 2, meat: 1 }, portions: 4, price: 70 },
  borscht: { icon: '🍲', needs: { potatoes: 1, meat: 1, bread: 1 }, portions: 4, price: 65 },
  pancakes: { icon: '🥞', needs: { milk: 2, apples: 1 }, portions: 4, price: 45 },
};
export const DISH_IDS = Object.keys(DISHES) as DishId[];

/** Сколько порций помещается в витрине кухни и шанс, что покупатель возьмёт порцию. */
export const PORTIONS_MAX = 24;
export const DISH_CHANCE = 0.16;

export const kitchenOpen = (state: StoreState): boolean => hasUpgrade(state, 'kitchen');
export const portionsOf = (state: StoreState, id: DishId): number => state.kitchen?.[id] ?? 0;
export const portionsTotal = (state: StoreState): number => DISH_IDS.reduce((n, id) => n + portionsOf(state, id), 0);

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Хватает ли продуктов (склад и полки) на закладку и места в витрине. */
export const canCook = (state: StoreState, id: DishId): boolean =>
  kitchenOpen(state) &&
  portionsTotal(state) + DISHES[id].portions <= PORTIONS_MAX &&
  Object.entries(DISHES[id].needs).every(([p, n]) => stockOf(state, p as ProductId) >= (n ?? 0));

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

/** Приготовить закладку: продукты со склада, потом с полок → порции. */
export function cook(state: StoreState, id: DishId): StoreState | null {
  if (!canCook(state, id)) return null;
  let s = state;
  for (const [p, n] of Object.entries(DISHES[id].needs)) s = take(s, p as ProductId, n ?? 0);
  return { ...s, kitchen: { ...s.kitchen, [id]: portionsOf(s, id) + DISHES[id].portions } };
}

/** Покупатель на кассе берёт порцию (случайное из того, что есть). */
export function sellDish(state: StoreState, random: () => number): { state: StoreState; dish: DishId } | null {
  if (!kitchenOpen(state) || random() >= DISH_CHANCE) return null;
  const ready = DISH_IDS.filter((id) => portionsOf(state, id) > 0);
  if (!ready.length) return null;
  const dish = ready[Math.floor(random() * ready.length)];
  return { state: { ...state, kitchen: { ...state.kitchen, [dish]: portionsOf(state, dish) - 1 } }, dish };
}

/** Ночью непроданное списывается: сколько порций пропало. */
export function spoilDishes(state: StoreState): { state: StoreState; spoiled: number } {
  const spoiled = portionsTotal(state);
  return spoiled ? { state: { ...state, kitchen: {} }, spoiled } : { state, spoiled: 0 };
}
