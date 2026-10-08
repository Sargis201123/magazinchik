// Ночная смена: после закрытия можно поработать ещё немного. Гостей меньше (таксисты,
// студенты, полуночники), зато к ценам они не придираются. Свет ночью — за свой счёт.

import { hasUpgrade } from './upgrades';
import type { StoreState } from './economy';

export const NIGHT_SECONDS = 45;
/** Поток гостей ночью от дневного. */
export const NIGHT_GUESTS = 0.5;
/** Ночью «справедливая» цена в глазах покупателя выше. */
export const NIGHT_TOLERANCE = 1.3;
/**
 * Ночная наценка: ночью все цены выше на 25% (как у круглосуточных). Гости к ценам терпимее —
 * берут, хотя «справедливая» цена у них выше на 30%. Без наценки ночь только раскупала
 * то, что купили бы и днём (видно в симуляторе), и не окупала свет.
 */
export const NIGHT_MARKUP = 1.25;
/** Свет, вывеска и сверхурочные на одну ночь. */
export const NIGHT_POWER = 60;

export const canWorkNight = (state: StoreState): boolean => hasUpgrade(state, 'nightShift');

/** Открыть ночную смену: заплатить за свет. null — не куплено или нет денег. */
export function startNight(state: StoreState): StoreState | null {
  if (!canWorkNight(state) || state.money < NIGHT_POWER) return null;
  return { ...state, money: state.money - NIGHT_POWER };
}
