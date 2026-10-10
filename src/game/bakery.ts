// Пекарня во флигеле: печь стоит там, работает пекарь (его нанимают). Он ставит противень,
// когда на хлебных полках есть место, и сам выносит свежий хлеб в зал — по залу пахнет
// хлебом, и его разбирают охотнее. Свой хлеб дешевле, чем у поставщика.

import { ovenBatch, ovenBatchCost } from './gear';
import { canPlace, onShift, shelfFree, warehouseCapacity, warehouseCount, type StoreState, type Unit } from './economy';

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

/** Пекарь ставит новый противень, когда на хлебных полках есть место хотя бы под половину. */
export const bakerShouldBake = (state: StoreState): boolean =>
  bakeryWorking(state) && breadShelfRoom(state) >= Math.ceil(ovenBatch(state) / 2) && state.money >= ovenBatchCost(state);

/** Заложить противень: деньги за муку. null — не хватает денег или хлеб некуда положить. */
export function startBatch(state: StoreState): StoreState | null {
  if (state.money < ovenBatchCost(state) || breadRoom(state) < ovenBatch(state)) return null;
  return { ...state, money: state.money - ovenBatchCost(state) };
}

/**
 * Свежий хлеб из печи: сразу на полки с хлебом (где есть место), остальное — на склад.
 * Склад может ненадолго переполниться: хлеб не выбрасывают.
 */
export function takeOutBread(state: StoreState, qty = ovenBatch(state)): { state: StoreState; onShelves: number } {
  let left = qty;
  let placed = 0;
  const fresh = (): Unit => ({ age: 0 });
  const shelves = state.shelves.map((shelf) => {
    if (left === 0 || shelf.broken || !canPlace('bread', shelf)) return shelf;
    const n = Math.min(left, shelfFree(shelf));
    if (n <= 0) return shelf;
    left -= n;
    placed += n;
    // Свежий — в конец: покупатели сначала берут то, что старше.
    return { ...shelf, items: { ...shelf.items, bread: [...(shelf.items.bread ?? []), ...Array.from({ length: n }, fresh)] } };
  });
  const warehouse = left ? { ...state.warehouse, bread: [...(state.warehouse.bread ?? []), ...Array.from({ length: left }, fresh)] } : state.warehouse;
  return { state: { ...state, shelves, warehouse }, onShelves: placed };
}
