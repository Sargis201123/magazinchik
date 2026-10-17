// Кофейня во флигеле: варит бариста (его нанимают). Покупатель после покупок может зайти
// за стаканчиком — кофе оплачивают на кассе. Зёрна и стаканчики докупают утром.
// В дождь, снег и грозу кофе берут чаще, в жару — реже.

import { onShift, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { WEATHER_EFFECTS, weatherFor } from './weather';

/** Себестоимость стаканчика (цена кофе и время варки — от модели кофемашины, gear.ts). */
export const CUP_COST = 15;
/** Сколько стаканчиков помещается в уголке. */
export const CUPS_MAX = 30;
/** Базовый шанс, что покупатель возьмёт кофе. */
export const COFFEE_CHANCE = 0.12;

export const cupsOf = (state: StoreState): number => state.cups ?? 0;

/** Кофейня работает: уголок куплен и бариста сегодня на смене. */
export const coffeeWorking = (state: StoreState): boolean => hasUpgrade(state, 'coffee') && onShift(state, 'barista');

/** Столики в кофейне: посидеть с кофе заходят чаще, а ради кофейни приходят и новые гости. */
export const TABLES_COFFEE = 1.4;
export const TABLES_GUESTS = 1.05;
export const coffeeTablesGuests = (state: StoreState): number => (hasUpgrade(state, 'coffeeTables') && coffeeWorking(state) ? TABLES_GUESTS : 1);

/** Шанс взять кофе сегодня: зависит от погоды и от столиков. */
export function coffeeChance(state: StoreState): number {
  if (!coffeeWorking(state) || cupsOf(state) <= 0) return 0;
  return Math.min(0.6, COFFEE_CHANCE * WEATHER_EFFECTS[weatherFor(state.day)].coffee * (hasUpgrade(state, 'coffeeTables') ? TABLES_COFFEE : 1));
}

export function buyCups(state: StoreState, qty: number): StoreState | null {
  const n = Math.min(qty, CUPS_MAX - cupsOf(state), Math.floor(state.money / CUP_COST));
  if (n <= 0) return null;
  return { ...state, money: state.money - n * CUP_COST, cups: cupsOf(state) + n };
}

export function useCup(state: StoreState): StoreState | null {
  if (cupsOf(state) <= 0) return null;
  return { ...state, cups: cupsOf(state) - 1 };
}
