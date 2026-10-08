// Время года и праздники для оформления улицы и магазина. На экономику не влияют.
// Год игры — 16 месяцев по 7 дней: в нём по разу каждый сезон (новогодняя неделя, шашлыки, школа, урожай).
// Весна идёт сразу после Нового года, лето — с шашлычным сезоном, осень — со школы до урожая и дальше.

import { MONTH_DAYS, monthOf } from './economy';
import { SEASON_EVERY } from './endless';

export type YearTime = 'spring' | 'summer' | 'autumn' | 'winter';
export type Holiday = 'march8' | 'halloween' | 'newyear';

/** Месяцев в игровом году. */
export const YEAR_MONTHS = SEASON_EVERY * 4;

/** Номер месяца в году: 0…15. Новогодняя неделя — 3, шашлыки — 7, школа — 11, урожай — 15. */
const monthInYear = (day: number): number => (monthOf(day) - 1) % YEAR_MONTHS;
const dayInMonth = (day: number): number => ((day - 1) % MONTH_DAYS) + 1;

export function yearTime(day: number): YearTime {
  const m = monthInYear(day);
  if (m === 3) return 'winter';
  if (m >= 4 && m <= 6) return 'spring';
  if (m >= 7 && m <= 10) return 'summer';
  return 'autumn';
}

/** Праздник дня: 8 Марта — первые два дня весны, Хэллоуин — последние три дня перед урожаем. */
export function holidayFor(day: number): Holiday | null {
  const m = monthInYear(day);
  if (m === 3) return 'newyear';
  if (m === 4 && dayInMonth(day) <= 2) return 'march8';
  if (m === 14 && dayInMonth(day) >= MONTH_DAYS - 2) return 'halloween';
  return null;
}
