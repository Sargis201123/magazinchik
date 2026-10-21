// Пока игрока нет: если нанят кассир, он торгует понемногу — продаёт с полок то, что обычно берут,
// по ценам хозяина. Не больше AWAY_MAX_HOURS часов за раз (дальше полки всё равно пустеют), и только
// если не было хотя бы часа. Деньги и проданное — сразу в магазин, полки пустеют: утром есть что закупить.

import { PRODUCT_IDS, type ProductId, type StoreState } from './economy';
import { usualSales } from './bakery';

/** Меньше часа — не считаем: игрок просто переключался. */
export const AWAY_MIN_HOURS = 1;
/** Больше стольких часов не копится. */
export const AWAY_MAX_HOURS = 8;
/** За час кассир продаёт такую долю обычных дневных продаж (за 8 часов — около трети дня). */
export const AWAY_RATE = 0.04;

export interface AwayTrade {
  state: StoreState;
  hours: number;
  units: number;
  revenue: number;
}

/** Торговал ли кто-то без хозяина: нужен кассир. */
export const canTradeAway = (state: StoreState): boolean => state.staff.some((m) => m.role === 'cashier');

/** Торговля за время отсутствия (awayMs — сколько не было игрока). null — нечего начислять. */
export function awayTrade(state: StoreState, awayMs: number): AwayTrade | null {
  const hours = Math.min(AWAY_MAX_HOURS, awayMs / 3_600_000);
  if (!(hours >= AWAY_MIN_HOURS) || !canTradeAway(state) || state.bankrupt) return null;
  const shelves = state.shelves.map((sh) => ({ ...sh, items: { ...sh.items } }));
  let units = 0;
  let revenue = 0;
  for (const pid of PRODUCT_IDS) {
    let want = Math.floor((usualSales(state, pid) ?? 0) * AWAY_RATE * hours);
    for (const sh of shelves) {
      if (want <= 0) break;
      const stock = sh.items[pid as ProductId];
      if (!stock?.length || sh.broken) continue;
      // Самое старое уходит первым.
      const taken = Math.min(want, stock.length);
      sh.items[pid as ProductId] = stock.slice(taken);
      want -= taken;
      units += taken;
      revenue += taken * state.prices[pid as ProductId];
    }
  }
  if (!units) return null;
  return { state: { ...state, shelves, money: state.money + revenue }, hours, units, revenue };
}
