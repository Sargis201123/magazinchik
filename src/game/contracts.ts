// Договор с поставщиком на неделю: каждое утро товар приезжает сам, на 10% дешевле
// и без брака. Деньги списываются при доставке; не хватило денег или места — в этот день не везут.

import { buyStock, productAvailable, warehouseCapacity, warehouseCount, type ProductId, type StoreState } from './economy';
import type { SupplierId } from './suppliers';

export const CONTRACT_DAYS = 7;
export const CONTRACT_DISCOUNT = 0.1;
export const CONTRACT_QTYS = [5, 10, 20];

export interface Contract {
  sid: SupplierId;
  pid: ProductId;
  qty: number;
  /** Последний день доставки (включительно). */
  until: number;
  /** В какой день уже привезли. */
  last?: number;
}

export const activeContracts = (state: StoreState): Contract[] =>
  ((state.contracts ?? []) as Contract[]).filter((c) => c.until >= state.day);

export const contractOf = (state: StoreState, sid: SupplierId): Contract | undefined => activeContracts(state).find((c) => c.sid === sid);

/** Подписать (одна поставка на поставщика; новая заменяет старую). Первая доставка — завтра утром. */
export function signContract(state: StoreState, sid: SupplierId, pid: ProductId, qty: number): StoreState {
  const others = activeContracts(state).filter((c) => c.sid !== sid);
  return { ...state, contracts: [...others, { sid, pid, qty, until: state.day + CONTRACT_DAYS, last: state.day }] };
}

export function cancelContract(state: StoreState, sid: SupplierId): StoreState {
  return { ...state, contracts: activeContracts(state).filter((c) => c.sid !== sid) };
}

export const contractPrice = (unitPrice: number): number => Math.max(1, Math.round(unitPrice * (1 - CONTRACT_DISCOUNT)));

export interface Delivery {
  pid: ProductId;
  qty: number;
  cost: number;
  /** Не привезли: не хватило денег или места. */
  skipped?: boolean;
}

/** Утренние поставки по договорам (один раз в день). */
export function deliverContracts(state: StoreState, priceOf: (sid: SupplierId, pid: ProductId) => number | null): { state: StoreState; deliveries: Delivery[] } {
  let next = state;
  const deliveries: Delivery[] = [];
  const contracts = activeContracts(state);
  for (const c of contracts) {
    if (c.last === state.day) continue;
    const base = priceOf(c.sid, c.pid);
    if (base === null || !productAvailable(c.pid, state.day)) continue;
    const price = contractPrice(base);
    const qty = Math.min(c.qty, warehouseCapacity(next) - warehouseCount(next), Math.floor(next.money / price));
    const bought = qty > 0 ? buyStock(next, c.pid, qty, price) : null;
    if (bought) next = bought;
    deliveries.push({ pid: c.pid, qty: bought ? qty : 0, cost: bought ? qty * price : 0, skipped: !bought || qty < c.qty });
  }
  const contractsAfter = ((next.contracts ?? []) as Contract[]).map((c) => (contracts.includes(c) && c.until >= state.day ? { ...c, last: state.day } : c));
  return { state: { ...next, contracts: contractsAfter.filter((c) => c.until >= state.day) }, deliveries };
}
