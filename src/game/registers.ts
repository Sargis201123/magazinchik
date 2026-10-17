// Места под кассы растут вместе с помещением: в ларьке и маленьком магазине — одно, дальше с каждым
// расширением ещё одно (до четырёх в универмаге). Саму кассу на новое место хозяин покупает сам,
// когда очередь того стоит; работать за ней — кассиру (своя роль на каждую кассу) или самому хозяину.

import { STORE_LEVELS, type StaffRole, type StoreState } from './economy';

export const REGISTERS_BY_LEVEL = [1, 1, 2, 3, 4];
export const CASHIER_ROLES: StaffRole[] = ['cashier', 'cashier2', 'cashier3', 'cashier4'];
/** Цена второй, третьей и четвёртой кассы (первая есть всегда). */
export const REGISTER_PRICES = [0, 1200, 2400, 4000];

const slotsAt = (level: number): number => REGISTERS_BY_LEVEL[Math.min(level, REGISTERS_BY_LEVEL.length - 1)];

/** Сколько мест под кассы в помещении. */
export const registerSlots = (state: StoreState): number => slotsAt(state.level);

/**
 * Сколько касс стоит. Старые сохранения (без поля registers) получили кассы при стройке — их не отнимаем;
 * купленная когда-то «вторая касса» — тоже не меньше двух.
 */
export const registerCount = (state: StoreState): number => {
  const legacy = (state.upgrades ?? []).includes('register2') ? 2 : 1;
  const bought = state.registers ?? slotsAt(state.level);
  return Math.max(legacy, Math.min(registerSlots(state), bought));
};

/** Цена следующей кассы (null — мест нет, сначала расширься). */
export const nextRegisterPrice = (state: StoreState): number | null => {
  const n = registerCount(state);
  return n < registerSlots(state) ? REGISTER_PRICES[n] ?? null : null;
};

/** Поставить кассу на свободное место. */
export function buyRegister(state: StoreState): StoreState | null {
  const price = nextRegisterPrice(state);
  if (price === null || price > state.money) return null;
  return { ...state, money: state.money - price, registers: registerCount(state) + 1 };
}

/** Мест под кассы будет после следующего расширения (null — расширяться некуда). */
export const nextRegisterCount = (state: StoreState): number | null =>
  STORE_LEVELS[state.level + 1] ? slotsAt(state.level + 1) : null;

export const isCashierRole = (role: StaffRole): boolean => CASHIER_ROLES.includes(role);
/** За какой кассой работает этот кассир (0 — основная). */
export const registerOfRole = (role: StaffRole): number => CASHIER_ROLES.indexOf(role);
