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
  /** kennel — какая будка (0 — простая, 1 — утеплённая, 2 — домик); outfits/outfit — одежда (11.11). */
  dog?: { since: number; kennel?: number; outfits?: DogOutfitId[]; outfit?: DogOutfitId };
}

/** Одежда Бобика (11.11): за монеты, носится в зале. В наряде Бобик бодрее — чаще замечает воришку. */
export type DogOutfitId = 'bandana' | 'bowtie' | 'sweater';
export const DOG_OUTFITS: Record<DogOutfitId, { price: number; icon: string }> = {
  bandana: { price: 150, icon: '🧣' },
  bowtie: { price: 200, icon: '🎀' },
  sweater: { price: 300, icon: '🧶' },
};
export const DOG_OUTFIT_IDS = Object.keys(DOG_OUTFITS) as DogOutfitId[];
/** Прибавка к поимке воришки, пока Бобик в наряде. */
export const DOG_OUTFIT_CATCH = 0.03;

/** Купить наряд Бобику и сразу надеть. */
export function buyDogOutfit(state: StoreState, id: DogOutfitId): StoreState | null {
  const dog = state.security?.dog;
  if (!dog || dog.outfits?.includes(id) || state.money < DOG_OUTFITS[id].price) return null;
  const next = { ...dog, outfits: [...(dog.outfits ?? []), id], outfit: id };
  return { ...state, money: state.money - DOG_OUTFITS[id].price, security: { ...securityOf(state), dog: next } };
}

/** Надеть купленный наряд (undefined — снять). */
export function wearDogOutfit(state: StoreState, id: DogOutfitId | undefined): StoreState | null {
  const dog = state.security?.dog;
  if (!dog || (id && !dog.outfits?.includes(id))) return null;
  return { ...state, security: { ...securityOf(state), dog: { ...dog, outfit: id } } };
}

/**
 * Будки Бобика (11.11, автор: «у кота есть улучшения, а у пса нет — собачке условия лучше»). Чем уютнее, тем
 * бодрее Бобик: чаще ловит воришку днём; домик с табличкой ещё и приводит детей погладить пса — гостей чуть больше.
 */
export const KENNELS = [
  { texture: 'kennel', price: 0, catch: DOG_DAY_CATCH, guests: 0 },
  { texture: 'kennel1', price: 800, catch: 0.55, guests: 0 },
  { texture: 'kennel2', price: 2200, catch: 0.7, guests: 0.02 },
] as const;

export const kennelOf = (state: StoreState): number => Math.min(KENNELS.length - 1, Math.max(0, state.security?.dog?.kennel ?? 0));
/** Как часто Бобик днём ловит воришку — от будки. */
export const dogCatch = (state: StoreState): number =>
  hasDog(state) ? KENNELS[kennelOf(state)].catch + (state.security?.dog?.outfit ? DOG_OUTFIT_CATCH : 0) : 0;
/** Гости от домика Бобика (дети приходят погладить). */
export const dogGuests = (state: StoreState): number => 1 + (hasDog(state) ? KENNELS[kennelOf(state)].guests : 0);

/** Купить следующую будку. null — пса нет, будка лучшая или не хватает денег. */
export function upgradeKennel(state: StoreState): StoreState | null {
  const dog = state.security?.dog;
  const next = kennelOf(state) + 1;
  if (!dog || next >= KENNELS.length || state.money < KENNELS[next].price) return null;
  return { ...state, money: state.money - KENNELS[next].price, security: { ...securityOf(state), dog: { ...dog, kennel: next } } };
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
