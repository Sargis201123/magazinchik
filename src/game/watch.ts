// Пёс Бобик из приюта: живёт при магазине, днём лежит у входа и лает на воришек — те с перепугу
// бросают товар. Корм — понемногу каждую ночь.
// 02.11 ночные кражи убраны (вместе с ночным сторожем Михалычем, которому больше нечего было делать):
// это было наказание без выбора. Сторожу платили за каждую ночь, вперёд ничего не оплачено — возвращать
// нечего; старые сохранения теряют только поля сторожа и ночных новостей (save.ts → migrateCalm).

import type { StoreState } from './economy';

/** Пёс Бобик: взять из приюта, корм за ночь, как часто днём помогает поймать воришку. */
export const DOG_PRICE = 600;
export const DOG_FOOD = 12;
export const DOG_DAY_CATCH = 0.4;
/** С какого дня приют предлагает Бобика. */
export const DOG_FROM_DAY = 8;

export interface Security {
  dog?: { since: number };
}

export const securityOf = (state: StoreState): Security => state.security ?? {};
export const hasDog = (state: StoreState): boolean => Boolean(state.security?.dog);

/** Взять Бобика из приюта. */
export function adoptDog(state: StoreState): StoreState | null {
  if (hasDog(state) || state.day < DOG_FROM_DAY || state.money < DOG_PRICE) return null;
  return { ...state, money: state.money - DOG_PRICE, security: { ...securityOf(state), dog: { since: state.day } } };
}

/** Ночь после закрытия: корм Бобику (если есть на что). state — уже утро следующего дня. */
export function dogNight(state: StoreState): StoreState {
  if (!hasDog(state)) return state;
  return { ...state, money: state.money - Math.min(Math.max(0, state.money), DOG_FOOD) };
}
