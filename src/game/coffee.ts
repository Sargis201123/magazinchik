// Кофейный уголок: кофемашина в зале. Покупатель после покупок может взять стаканчик —
// машина варит сама, кофе оплачивают на кассе. Стаканчики (с кофе в зёрнах) докупают утром.
// В дождь, снег и грозу кофе берут чаще, в жару — реже.

import type { StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { WEATHER_EFFECTS, weatherFor } from './weather';

/** Себестоимость стаканчика и цена кофе. */
export const CUP_COST = 12;
export const COFFEE_PRICE = 45;
/** Сколько стаканчиков помещается в уголке. */
export const CUPS_MAX = 30;
/** Базовый шанс, что покупатель возьмёт кофе. */
export const COFFEE_CHANCE = 0.22;
/** Сколько секунд варится стаканчик. */
export const BREW_SECONDS = 2.2;

export const cupsOf = (state: StoreState): number => state.cups ?? 0;

/** Шанс взять кофе сегодня: зависит от погоды. */
export function coffeeChance(state: StoreState): number {
  if (!hasUpgrade(state, 'coffee') || cupsOf(state) <= 0) return 0;
  return Math.min(0.6, COFFEE_CHANCE * WEATHER_EFFECTS[weatherFor(state.day)].coffee);
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
