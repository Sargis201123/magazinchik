// Лёгкое ядро Заречья (zarechye.ts) для экономики: где работаем, лестница помещений и счета двух
// магазинов. Отдельно, чтобы economy.ts не тянул за собой весь район (сюжет, филиал, смену дня) —
// иначе модули грузились бы по кругу. Всё остальное о Заречье — в zarechye.ts.

import { HYPER_LEVEL, MONTH_DAYS, STORE_LEVELS, type StoreLevel, type StoreState } from './economy';
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

/** Какая доля месячного счёта — за этот магазин: по дням, что в нём работали (без Заречья — 1). */
export function zarBillShare(state: StoreState, where: Where): number {
  const days = state.zar?.days;
  if (!days) return where === 'home' ? 1 : 0;
  const total = days.home + days.zar;
  // Счёт приходит в последний день месяца: сегодняшний день — тоже его.
  const today = state.zar!.at;
  const n = days[where] + (today === where ? 1 : 0);
  return Math.min(1, n / Math.max(MONTH_DAYS, total + 1));
}

/** Доля счёта второго магазина (того, где сегодня не работаем): аренда, вода, свет и зарплаты его людей. */
export function zarAwayBill(state: StoreState): { rent: number; utilities: number; power: number; salaries: number } {
  const zar = state.zar;
  if (!zar) return { rent: 0, utilities: 0, power: 0, salaries: 0 };
  const share = zarBillShare(state, zar.at === 'zar' ? 'home' : 'zar');
  const level = STORE_LEVELS[Math.max(0, Math.min(HYPER_LEVEL, zar.away.level ?? 0))];
  const part = (n: number) => Math.round(n * share);
  return {
    rent: part(level.rent),
    utilities: part(level.utilities),
    power: part(level.power),
    salaries: part((zar.away.staff ?? []).reduce((sum, m) => sum + m.wage, 0)),
  };
}

