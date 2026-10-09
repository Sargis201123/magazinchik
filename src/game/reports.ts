// Отчёт за неделю: что продавалось, что портилось, где дорого и чего не хватало — и советы,
// что поменять в закупке и ценах. Каждый вечер в отчёт ложится строка за прошедший день.

import type { TextKey } from '../i18n/ru';
import { PRODUCT_IDS, type DayStats, type ProductId, type StoreState } from './economy';
import { newDeal, SUPPLIER_IDS, SUPPLIERS, unitPrice } from './suppliers';

/** Сколько последних дней в отчёте. */
export const REPORT_DAYS = 7;

export interface DayReport {
  day: number;
  revenue: number;
  served: number;
  lost: number;
  sold: Partial<Record<ProductId, number>>;
  spoiled: Partial<Record<ProductId, number>>;
  /** Сколько раз сочли дорогим и сколько раз не нашли на полке. */
  pricey: Partial<Record<ProductId, number>>;
  missing: Partial<Record<ProductId, number>>;
}

export function addReport(state: StoreState, day: number, stats: DayStats, spoiled: Partial<Record<ProductId, number>>): StoreState {
  const row: DayReport = {
    day,
    revenue: stats.revenue,
    served: stats.served,
    lost: stats.lost,
    sold: { ...stats.sold },
    spoiled: { ...spoiled },
    pricey: { ...(stats.pricey ?? {}) },
    missing: { ...(stats.missing ?? {}) },
  };
  return { ...state, reports: [...(state.reports ?? []), row].slice(-REPORT_DAYS) };
}

/** Почём сейчас обычно закупаешь штуку: самый дешёвый поставщик без торга. */
export function usualCost(id: ProductId): number | null {
  const prices = SUPPLIER_IDS.map((sid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), id)).filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices) : null;
}

export interface ProductLine {
  id: ProductId;
  sold: number;
  /** Примерная выручка и прибыль: по сегодняшней цене и обычной закупке. */
  revenue: number;
  profit: number;
  spoiled: number;
  pricey: number;
  missing: number;
  /** Совет по товару (или нет). */
  advice?: TextKey;
}

export interface WeekReport {
  days: DayReport[];
  revenue: number;
  served: number;
  lost: number;
  lines: ProductLine[];
}

const sum = (rows: DayReport[], pick: (r: DayReport) => number): number => rows.reduce((s, r) => s + pick(r), 0);

export function weekReport(state: StoreState): WeekReport {
  const days = state.reports ?? [];
  const lines: ProductLine[] = PRODUCT_IDS.map((id) => {
    const sold = sum(days, (r) => r.sold[id] ?? 0);
    const spoiled = sum(days, (r) => r.spoiled[id] ?? 0);
    const pricey = sum(days, (r) => r.pricey[id] ?? 0);
    const missing = sum(days, (r) => r.missing[id] ?? 0);
    const price = state.prices[id] ?? 0;
    const cost = usualCost(id) ?? 0;
    const line: ProductLine = { id, sold, revenue: sold * price, profit: sold * (price - cost) - spoiled * cost, spoiled, pricey, missing };
    // Совет — по самой заметной беде товара.
    if (spoiled >= 3 && spoiled > sold * 0.25) line.advice = 'report.advice.spoils';
    else if (pricey >= 4 && pricey > sold * 0.3) line.advice = 'report.advice.pricey';
    else if (missing >= 4) line.advice = 'report.advice.missing';
    else if (price < cost * 1.15 && sold > 0) line.advice = 'report.advice.cheap';
    return line;
  })
    .filter((l) => l.sold || l.spoiled || l.pricey || l.missing)
    .sort((a, b) => b.profit - a.profit);
  return { days, revenue: sum(days, (r) => r.revenue), served: sum(days, (r) => r.served), lost: sum(days, (r) => r.lost), lines };
}
