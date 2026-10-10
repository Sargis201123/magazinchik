// Своя марка «От бабушки». Когда в пекарне стоит лучшая печь (пекарский шкаф), можно открыть
// свою выпечку по бабушкиным рецептам. Ступени марки: пирожки → булочки с корицей → медовик.
// Каждая ступень — новый товар и лучше рецепт: всю свою выпечку берут охотнее.
// Печёт пекарь, когда хлеба на полках хватает; у поставщиков такой выпечки нет.

import { gearTier, GEAR } from './gear';
import { canPlace, OWN_PRODUCTS, onShelves, ownProductOpen, PRODUCTS, shelfFree, type ProductId, type StoreState } from './economy';
import { bakeryWorking } from './bakery';

export const BRAND_COSTS = [1000, 2000, 4000];
export const BRAND_MAX = BRAND_COSTS.length;
/** Сколько штук своей выпечки в одной закладке. */
export const BRAND_BATCH = 8;
/** На сколько охотнее берут свою выпечку за каждую ступень марки. */
export const BRAND_DEMAND_STEP = 0.12;

export const brandLevel = (state: StoreState): number => Math.min(BRAND_MAX, state.brand ?? 0);
/** Марку можно открывать: пекарня есть и печь — лучшая модель. */
export const brandAvailable = (state: StoreState): boolean =>
  (state.upgrades ?? []).includes('oven') && gearTier(state, 'oven') >= GEAR.oven.models.length - 1;

export const nextBrandCost = (state: StoreState): number | null => BRAND_COSTS[brandLevel(state)] ?? null;

export function buyBrandLevel(state: StoreState): StoreState | null {
  const cost = nextBrandCost(state);
  if (cost === null || !brandAvailable(state) || state.money < cost) return null;
  return { ...state, money: state.money - cost, brand: brandLevel(state) + 1 };
}

export const isOwnProduct = (id: ProductId): boolean => OWN_PRODUCTS.includes(id);

/** Своя выпечка идёт лучше с каждой ступенью марки. */
export const brandDemand = (state: StoreState, id: ProductId): number => (isOwnProduct(id) ? 1 + BRAND_DEMAND_STEP * brandLevel(state) : 1);

/** Сколько стоит закладка своей выпечки. */
export const brandBatchCost = (id: ProductId): number => PRODUCTS[id].cost * BRAND_BATCH;

/**
 * Что из своей выпечки поставить в печь: открытый товар, которого меньше всего на полках,
 * если на хлебных полках есть место под половину закладки и хватает денег. null — ничего.
 */
export function brandToBake(state: StoreState): ProductId | null {
  if (!bakeryWorking(state)) return null;
  const room = (id: ProductId) => state.shelves.reduce((sum, s) => sum + (!s.broken && canPlace(id, s) ? shelfFree(s) : 0), 0);
  const options = OWN_PRODUCTS.filter((id) => ownProductOpen(state, id) && room(id) >= BRAND_BATCH / 2 && state.money >= brandBatchCost(id));
  if (!options.length) return null;
  return options.sort((a, b) => onShelves(state, a) - onShelves(state, b))[0];
}

/** Заложить свою выпечку: деньги за продукты. */
export function startBrandBatch(state: StoreState, id: ProductId): StoreState | null {
  if (state.money < brandBatchCost(id) || !ownProductOpen(state, id)) return null;
  return { ...state, money: state.money - brandBatchCost(id) };
}
