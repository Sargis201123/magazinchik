// Ночная смена: после закрытия можно поработать ещё немного. Гостей меньше (таксисты,
// студенты, полуночники), зато к ценам они не придираются. Свет ночью — за свой счёт.

import { hasUpgrade } from './upgrades';
import type { StoreState } from './economy';

export const NIGHT_SECONDS = 45;
/** Поток гостей ночью от дневного. */
export const NIGHT_GUESTS = 0.6;
/** Ночью «справедливая» цена в глазах покупателя выше. */
export const NIGHT_TOLERANCE = 1.45;
/**
 * Ночная наценка: ночью все цены выше на 40% (как у круглосуточных). Гости к ценам терпимее —
 * берут, хотя «справедливая» цена у них выше на 45%. Без наценки ночь только раскупала
 * то, что купили бы и днём (видно в симуляторе), и не окупала свет.
 */
export const NIGHT_MARKUP = 1.4;
/** Свет, вывеска и сверхурочные на одну ночь. */
export const NIGHT_POWER = 60;

export const canWorkNight = (state: StoreState): boolean => hasUpgrade(state, 'nightShift');

/** Открыть ночную смену: заплатить за свет. null — не куплено или нет денег. */
export function startNight(state: StoreState): StoreState | null {
  if (!canWorkNight(state) || state.money < NIGHT_POWER) return null;
  return { ...state, money: state.money - NIGHT_POWER };
}
