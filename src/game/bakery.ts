// Пекарня во флигеле: печь стоит там, работает пекарь (его нанимают). Он ставит противень,
// когда на хлебных полках есть место, и сам выносит свежий хлеб в зал — по залу пахнет
// хлебом, и его разбирают охотнее. Свой хлеб дешевле, чем у поставщика.

import { ovenBatch, ovenBatchCost } from './gear';
import { canPlace, onShelves, onShift, shelfCapacity, shelfFree, warehouseCapacity, warehouseCount, type ProductId, type StoreState, type Unit } from './economy';
import { hasUpgrade } from './upgrades';

/**
 * Сколько хлеба печь: «по спросу» — столько, сколько обычно разбирают (не печь в порчу);
 * «сколько влезет» — пока на полках есть место; «не печь хлеб» — хлеб закупаешь сам, пекарь печёт только своё.
 */
export type BakeMode = 'auto' | 'full' | 'off';
export const BAKE_MODES: BakeMode[] = ['auto', 'full', 'off'];
export const bakeModeOf = (state: StoreState): BakeMode => state.bakeMode ?? 'auto';
export const setBakeMode = (state: StoreState, mode: BakeMode): StoreState => ({ ...state, bakeMode: mode });

/** Сколько штук товара обычно разбирают за день: среднее за последние три дня (с теми, кому не хватило). */
export function usualSales(state: StoreState, id: ProductId): number | null {
  const days = (state.reports ?? []).slice(-3);
  if (!days.length) return null;
  return days.reduce((sum, d) => sum + (d.sold[id] ?? 0) + (d.missing[id] ?? 0), 0) / days.length;
}

/** Сколько этого товара сейчас есть: на полках и на складе. */
export const stockOf = (state: StoreState, id: ProductId): number => onShelves(state, id) + (state.warehouse[id]?.length ?? 0);

/**
 * «По спросу»: печём, пока запаса меньше, чем разберут до закрытия (dayLeft — доля дня впереди),
 * плюс полпротивня про запас. Под вечер печь почти перестаёт — к ночи не остаётся лишнего.
 */
export function needsBaking(state: StoreState, id: ProductId, batch: number, dayLeft = 1): boolean {
  const usual = usualSales(state, id);
  if (usual === null) return true;
  return stockOf(state, id) < Math.ceil(usual * dayLeft) + Math.ceil(batch / 2);
}

/** Сколько буханок в закладке, почём мука и сколько печётся — зависит от модели печи (gear.ts). */
/** Сколько секунд готовый хлеб ждёт, прежде чем сгореть. */
export const OVEN_BURN_SECONDS = 10;
/** Сколько секунд в зале пахнет хлебом. */
export const AROMA_SECONDS = 25;
/** Пока пахнет — хлеб хотят вдвое чаще и готовы платить чуть дороже. */
export const AROMA_DEMAND = 2;
export const AROMA_TOLERANCE = 1.2;

/** Сколько свежего хлеба сейчас есть куда положить: свободное место на хлебных полках и на складе. */
export const breadRoom = (state: StoreState): number =>
  state.shelves.reduce((sum, s) => sum + (!s.broken && canPlace('bread', s) ? shelfFree(s) : 0), 0) +
  Math.max(0, warehouseCapacity(state) - warehouseCount(state));

/** Свободное место на хлебных полках в зале. */
export const breadShelfRoom = (state: StoreState): number =>
  state.shelves.reduce((sum, s) => sum + (!s.broken && canPlace('bread', s) ? shelfFree(s) : 0), 0);

/** Пекарня работает: печь куплена и пекарь сегодня на смене. */
export const bakeryWorking = (state: StoreState): boolean => (state.upgrades ?? []).includes('oven') && onShift(state, 'baker');

/** Доля хлебных полок под хлеб, когда открыта своя марка. */
export const BREAD_SHARE_WITH_BRAND = 0.5;

/** Пекарь ставит новый противень, когда на хлебных полках есть место хотя бы под половину (и хлеб нужен — по режиму). */
export function bakerShouldBake(state: StoreState, dayLeft = 1): boolean {
  if (!bakeryWorking(state) || breadShelfRoom(state) < Math.ceil(ovenBatch(state) / 2) || state.money < ovenBatchCost(state)) return false;
  const mode = bakeModeOf(state);
  if (mode === 'off' || (mode === 'auto' && !needsBaking(state, 'bread', ovenBatch(state), dayLeft))) return false;
  // Со своей маркой хлеб занимает половину хлебных полок — остальное под выпечку «От бабушки».
  if (!(state.brand ?? 0)) return true;
  const capacity = state.shelves.reduce((sum, s) => sum + (!s.broken && canPlace('bread', s) ? shelfCapacity(s) : 0), 0);
  return onShelves(state, 'bread') < capacity * BREAD_SHARE_WITH_BRAND;
}

/** Заложить противень: деньги за муку. null — не хватает денег или хлеб некуда положить. */
export function startBatch(state: StoreState): StoreState | null {
  if (state.money < ovenBatchCost(state) || breadRoom(state) < ovenBatch(state)) return null;
  return { ...state, money: state.money - ovenBatchCost(state) };
}

/**
 * Свежий хлеб из печи: сразу на полки с хлебом (где есть место), остальное — на склад.
 * Склад может ненадолго переполниться: хлеб не выбрасывают.
 */
export function takeOutBread(state: StoreState, qty = ovenBatch(state), id: ProductId = 'bread'): { state: StoreState; onShelves: number } {
  let left = qty;
  let placed = 0;
  const fresh = (): Unit => ({ age: 0 });
  const shelves = state.shelves.map((shelf) => {
    if (left === 0 || shelf.broken || !canPlace(id, shelf)) return shelf;
    const n = Math.min(left, shelfFree(shelf));
    if (n <= 0) return shelf;
    left -= n;
    placed += n;
    // Свежий — в конец: покупатели сначала берут то, что старше.
    return { ...shelf, items: { ...shelf.items, [id]: [...(shelf.items[id] ?? []), ...Array.from({ length: n }, fresh)] } };
  });
  const warehouse = left ? { ...state.warehouse, [id]: [...(state.warehouse[id] ?? []), ...Array.from({ length: left }, fresh)] } : state.warehouse;
  return { state: { ...state, shelves, warehouse }, onShelves: placed };
}

/** Поставки соседним магазинам: столько противней хлеба в день пекарь печёт на продажу им. */
export const WHOLESALE_BATCHES = 2;
/** Почём соседи берут буханку (оптом — дешевле, чем в зале). */
export const WHOLESALE_PRICE = 26;

/** Испечь ещё противень для соседей: договор куплен, пекарь на смене, свой хлеб для зала не нужен прямо сейчас. */
export const wholesaleToBake = (state: StoreState, bakedToday: number): boolean =>
  hasUpgrade(state, 'wholesale') && bakeryWorking(state) && bakedToday < WHOLESALE_BATCHES && state.money >= ovenBatchCost(state);

/** Соседи забрали противень: деньги за хлеб (мука уже оплачена при закладке). */
export const sellWholesale = (state: StoreState): { state: StoreState; pay: number } => {
  const pay = ovenBatch(state) * WHOLESALE_PRICE;
  return { state: { ...state, money: state.money + pay }, pay };
};
