// Кассы растут вместе с помещением: в ларьке и маленьком магазине — одна, дальше с каждым
// расширением ещё одна (до четырёх в универмаге). Касса ставится при стройке сама,
// а работать за ней — кассиру (своя роль на каждую кассу) или самому хозяину.

import { STORE_LEVELS, type StaffRole, type StoreState } from './economy';

export const REGISTERS_BY_LEVEL = [1, 1, 2, 3, 4];
export const CASHIER_ROLES: StaffRole[] = ['cashier', 'cashier2', 'cashier3', 'cashier4'];

/** Сколько касс в помещении (старые сохранения с купленной «второй кассой» — не меньше двух). */
export const registerCount = (state: StoreState): number =>
  Math.max(REGISTERS_BY_LEVEL[Math.min(state.level, REGISTERS_BY_LEVEL.length - 1)], (state.upgrades ?? []).includes('register2') ? 2 : 1);

/** Касс будет после следующего расширения (null — расширяться некуда). */
export const nextRegisterCount = (state: StoreState): number | null =>
  STORE_LEVELS[state.level + 1] ? REGISTERS_BY_LEVEL[Math.min(state.level + 1, REGISTERS_BY_LEVEL.length - 1)] : null;

export const isCashierRole = (role: StaffRole): boolean => CASHIER_ROLES.includes(role);
/** За какой кассой работает этот кассир (0 — основная). */
export const registerOfRole = (role: StaffRole): number => CASHIER_ROLES.indexOf(role);
