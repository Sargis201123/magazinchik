// Хозяин растёт вместе с магазином: опыт — за каждого покупателя, которого обслужил магазин.
// С уровнем хозяин сам понемногу становится ловчее: быстрее пробивает, легче сбивает цену, больше
// носит со склада, воришки чаще обходят магазин стороной.
// Раньше за уровень давали очко навыка и игрок раскладывал их по пяти навыкам (по три ступени) — это
// дублировало оборудование и персонал и почти не меняло итог (+4,6% ±2,8). С 02.11 всё растёт само,
// плавно, без выбора; прежние очки ничего не стоили, возвращать нечего. «Обаяние» (дольше ждут в
// очереди) убрано совсем: из шести «терпений очереди» оставлены кот и радио (решено 02.11).

import { ownerScan, type ScanTiming, type StoreState } from './economy';

/** Сколько покупателей (за всю игру) нужно для каждого уровня хозяина. */
export const XP_LEVELS = [0, 40, 100, 180, 280, 400, 550, 750, 1000, 1300, 1700, 2200, 2800, 3500, 4300, 5200];
export const OWNER_LEVEL_MAX = XP_LEVELS.length;

/** Опыт хозяина — все обслуженные магазином покупатели. */
export const ownerXp = (state: StoreState): number => state.lifetime?.served ?? 0;
/** Уровень хозяина, 1…OWNER_LEVEL_MAX. Его же может читать закупка (скидка поставщика за опыт). */
export const ownerLevelOf = (state: StoreState): number => XP_LEVELS.filter((n) => ownerXp(state) >= n).length;
/** Сколько покупателей до следующего уровня (null — максимум). */
export const nextLevelXp = (state: StoreState): number | null => XP_LEVELS[ownerLevelOf(state)] ?? null;
/** Насколько хозяин вырос: 0 на первом уровне, 1 на последнем. Все бонусы ниже — от этой доли. */
export const ownerGrowth = (state: StoreState): number => (ownerLevelOf(state) - 1) / (OWNER_LEVEL_MAX - 1);

// ---------- Что даёт уровень (на последнем — примерно половина прежних навыков на максимуме) ----------

/** Пробивка: до −15% времени. */
export const OWNER_HANDS = 0.15;
/** Торг: до +8% к шансу сбить цену. */
export const OWNER_HAGGLE = 0.08;
/** Со склада: до +3 штук за ходку. */
export const OWNER_CARRY = 3;
/** Очередь: ждут до 12% дольше. */
/** Воришек до 15% меньше. */
export const OWNER_EYE = 0.15;

export const handsFactor = (state: StoreState): number => 1 - OWNER_HANDS * ownerGrowth(state);
/** Время пробивки у хозяина: опыт кассы (ownerScan) и ловкость по уровню. */
export function ownerTiming(state: StoreState): ScanTiming {
  const base = ownerScan(state.ownerServed);
  const k = handsFactor(state);
  return { item: base.item * k, pay: base.pay * k };
}
export const haggleBonus = (state: StoreState): number => OWNER_HAGGLE * ownerGrowth(state);
export const carryBonus = (state: StoreState): number => Math.round(OWNER_CARRY * ownerGrowth(state));
export const eyeTheft = (state: StoreState): number => 1 - OWNER_EYE * ownerGrowth(state);
