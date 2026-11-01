// Лёгкое ядро Заречья (zarechye.ts) для экономики: где работаем, лестница помещений и счета двух
// магазинов. Отдельно, чтобы economy.ts не тянул за собой весь район (сюжет, филиал, смену дня) —
// иначе модули грузились бы по кругу. Всё остальное о Заречье — в zarechye.ts.

import { MONTH_DAYS, monthlyBill, STORE_LEVELS, type StoreLevel, type StoreState } from './economy';
import type { Where, ZarState } from './zarechye';

/** Сегодня работаем в Заречье. */
export const inZar = (state: { zar?: ZarState }): boolean => state.zar?.at === 'zar';

/**
 * Помещения Заречья: та же лестница, что в первый раз (ларёк → … → универсам), но короче и быстрее —
 * игрок уже опытный, и улица у реки меньше Центра. Цены подобраны симулятором так, чтобы каждая
 * ступень окупалась примерно за столько же дней, сколько средние ступени первого прохода.
 */
export const ZAR_LEVEL_COST = [0, 2500, 6500, 8000];
export const ZAR_MAX_LEVEL = ZAR_LEVEL_COST.length - 1;

/** Следующее помещение в Заречье (null — лестница пройдена). */
export function zarNextLevel(state: StoreState): StoreLevel | undefined {
  const next = state.level + 1;
  if (next > ZAR_MAX_LEVEL) return undefined;
  return { ...STORE_LEVELS[next], cost: ZAR_LEVEL_COST[next] };
}

/**
 * Какая доля месячного счёта — за этот магазин: по дням месяца, что в нём работали, а оставшиеся дни —
 * сегодняшнему (так и прогноз утром не занижен; в последний день месяца оставшийся — ровно сегодняшний).
 * Без Заречья — 1.
 */
export function zarBillShare(state: StoreState, where: Where): number {
  const days = state.zar?.days;
  if (!days) return where === 'home' ? 1 : 0;
  const left = Math.max(0, MONTH_DAYS - days.home - days.zar);
  const n = days[where] + (state.zar!.at === where ? left : 0);
  return Math.min(1, n / MONTH_DAYS);
}

/** Уровень Центра, где бы игрок ни работал сегодня: награды недели, письма, рейтинг друзей. */
export const homeLevel = (state: StoreState): number => (inZar(state) ? (state.zar!.away.level ?? state.level) : state.level);

/**
 * Доля счёта второго магазина (того, где сегодня не работаем): его собственный счёт — тот же расчёт,
 * что у monthlyBill (холодильники, свет, «новоселье»), — умноженный на его долю дней.
 */
export function zarAwayBill(state: StoreState): { rent: number; utilities: number; power: number; salaries: number } {
  const zar = state.zar;
  if (!zar) return { rent: 0, utilities: 0, power: 0, salaries: 0 };
  const share = zarBillShare(state, zar.at === 'zar' ? 'home' : 'zar');
  const view = { ...state, ...zar.away, zar: undefined } as StoreState;
  for (const key of ['movedFrom', 'upgrades', 'gear'] as const) if (zar.away[key] === undefined) delete view[key];
  const bill = monthlyBill(view);
  const part = (n: number) => Math.round(n * share);
  return { rent: part(bill.rent), utilities: part(bill.utilities), power: part(bill.power), salaries: part(bill.salaries) };
}

