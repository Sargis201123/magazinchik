// Ярмарка: раз в месяц, на пятый день, у входа праздник — гирлянды из флажков, шарики, лоток.
// Гостей больше, к ценам терпимее.

import { MONTH_DAYS } from './economy';
import { holidayFor } from './calendar';

export const FAIR_DAY_IN_MONTH = 5;
export const FAIR_FROM_DAY = 8;
export const FAIR_GUESTS = 1.3;
export const FAIR_TOLERANCE = 1.1;

export const isFairDay = (day: number): boolean =>
  day >= FAIR_FROM_DAY && ((day - 1) % MONTH_DAYS) + 1 === FAIR_DAY_IN_MONTH && !holidayFor(day);

export const fairGuests = (day: number): number => (isFairDay(day) ? FAIR_GUESTS : 1);
export const fairTolerance = (day: number): number => (isFairDay(day) ? FAIR_TOLERANCE : 1);

/** Ближайшая ярмарка (через сколько дней), чтобы подготовиться. */
export function daysToFair(day: number): number {
  for (let d = 0; d < MONTH_DAYS * 2; d++) if (isFairDay(day + d)) return d;
  return -1;
}
