// Своя печь: продавец ставит противень — через полминуты в зале пахнет хлебом, и его
// разбирают охотнее. Свой хлеб дешевле, чем у поставщика, но печь надо караулить:
// если вовремя не вынуть, всё сгорит.

import { canPlace, shelfFree, warehouseCapacity, warehouseCount, type StoreState, type Unit } from './economy';

/** Сколько буханок в одной закладке и сколько стоят мука и дрожжи на неё. */
export const OVEN_BATCH = 6;
export const OVEN_BATCH_COST = 60;
/** Секунд печётся и сколько секунд готовый хлеб ждёт, прежде чем сгореть. */
export const OVEN_BAKE_SECONDS = 14;
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

/** Заложить противень: деньги за муку. null — не хватает денег или хлеб некуда положить. */
export function startBatch(state: StoreState): StoreState | null {
  if (state.money < OVEN_BATCH_COST || breadRoom(state) < OVEN_BATCH) return null;
  return { ...state, money: state.money - OVEN_BATCH_COST };
}

/**
 * Свежий хлеб из печи: сразу на полки с хлебом (где есть место), остальное — на склад.
 * Склад может ненадолго переполниться: хлеб не выбрасывают.
 */
export function takeOutBread(state: StoreState, qty = OVEN_BATCH): { state: StoreState; onShelves: number } {
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
