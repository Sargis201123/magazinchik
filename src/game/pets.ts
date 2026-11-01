// Питомцы за звёзды: попугай, хомяк, корги, черепаха, енот и крольчиха. Только для души — никаких
// денег, гостей и рейтинга: живут в зале, здороваются утром, радуются рекорду, спят ночью и отвечают
// сердечком, если их погладить. В зале одновременно один — выбранный в «Уголке питомцев», остальные
// ждут дома. Кот магазина (cat.ts) и Бобик (watch.ts) — сами по себе, это не они.
// Цены и названия — и на сервере (api/_lib/telegram.ts, STARS_CATALOG; совпадение проверяет тест).
// Купленные остаются навсегда, даже после «Начать заново» (restart.ts). Мир — scenes/starPets.ts,
// окно — ui/pets.ts.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export type PetId = 'hamster' | 'turtle' | 'parrot' | 'bunny' | 'corgi' | 'raccoon';

/** Где питомец живёт в зале (scenes/starPets.ts). */
export type PetSpot = 'counter' | 'wall' | 'perch' | 'corner' | 'door' | 'storage';

export interface PetDef {
  id: PetId;
  /** Цена в звёздах. */
  stars: number;
  icon: string;
  /** Где живёт в зале. */
  spot: PetSpot;
}

export const PETS: Record<PetId, PetDef> = {
  hamster: { id: 'hamster', stars: 25, icon: '🐹', spot: 'counter' },
  turtle: { id: 'turtle', stars: 35, icon: '🐢', spot: 'wall' },
  parrot: { id: 'parrot', stars: 50, icon: '🦜', spot: 'perch' },
  bunny: { id: 'bunny', stars: 50, icon: '🐰', spot: 'corner' },
  corgi: { id: 'corgi', stars: 75, icon: '🐶', spot: 'door' },
  raccoon: { id: 'raccoon', stars: 100, icon: '🦝', spot: 'storage' },
};

export const PET_IDS = Object.keys(PETS) as PetId[];

export const PET_NAME_MAX = 14;

export interface PetsState {
  owned: PetId[];
  /** Кто сейчас в зале; нет — никого. */
  active?: PetId;
  /** Имена, которые дал игрок; нет — имя по умолчанию из словаря (pets.<id>.name). */
  names?: Partial<Record<PetId, string>>;
}

export const isPetId = (id: unknown): id is PetId => typeof id === 'string' && Object.hasOwn(PETS, id);

/** Вещь в каталоге звёзд: pet_parrot и т. д. */
export const petItem = (id: PetId): string => `pet_${id}`;
/** Питомец по вещи каталога (или undefined). */
export const petFromItem = (item: string): PetId | undefined => {
  const id = item.startsWith('pet_') ? item.slice(4) : '';
  return isPetId(id) ? id : undefined;
};

export const petNameKey = (id: PetId): TextKey => `pets.${id}.title` as TextKey;
export const petDefaultKey = (id: PetId): TextKey => `pets.${id}.name` as TextKey;

/** Имя: убрать переводы строк и управляющие символы, обрезать. Пусто — нет имени. */
export const cleanPetName = (name: unknown): string =>
  typeof name === 'string'
    ? name
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, '')
        .trim()
        .slice(0, PET_NAME_MAX)
        .trim()
    : '';

export const ownsPet = (state: StoreState, id: PetId): boolean => Boolean(state.pets?.owned.includes(id));

/** Кто сегодня в зале: id и имя, если игрок его дал. */
export function activePet(state: StoreState): { id: PetId; name?: string } | undefined {
  const id = state.pets?.active;
  if (!id || !ownsPet(state, id)) return undefined;
  const name = state.pets?.names?.[id];
  return name ? { id, name } : { id };
}

/**
 * Купленные питомцы (после оплаты или по списку покупок Telegram). activate — новый сразу идёт в зал
 * (после оплаты); при восстановлении покупок выбор игрока не трогаем, разве что зал пуст.
 */
export function grantPets(state: StoreState, items: string[], activate = true): StoreState {
  const was = state.pets?.owned ?? [];
  const fresh = [...new Set(items.map(petFromItem).filter((id): id is PetId => Boolean(id) && !was.includes(id!)))];
  if (!fresh.length) return state;
  const pets = state.pets ?? { owned: [] };
  const active = activate || !pets.active ? fresh[fresh.length - 1] : pets.active;
  return { ...state, pets: { ...pets, owned: [...was, ...fresh], active } };
}

/** Позвать в зал другого (или никого — null). */
export function setActivePet(state: StoreState, id: PetId | null): StoreState | null {
  const pets = state.pets;
  if (!pets || (id && !pets.owned.includes(id))) return null;
  const next: PetsState = { ...pets };
  if (id) next.active = id;
  else delete next.active;
  return { ...state, pets: next };
}

/** Дать имя (пустое — вернуть имя по умолчанию). */
export function renamePet(state: StoreState, id: PetId, name: string): StoreState | null {
  const pets = state.pets;
  if (!pets?.owned.includes(id)) return null;
  const clean = cleanPetName(name);
  const names = { ...pets.names };
  if (clean) names[id] = clean;
  else delete names[id];
  return { ...state, pets: { ...pets, names } };
}

/**
 * Питомцы из сохранения (или снимка друга): неизвестные выкидываем, имена чистим. Нет ни одного — undefined
 * (старые сохранения так и остаются без поля).
 */
export function normalizePets(raw: unknown): PetsState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Partial<PetsState>;
  const owned = [...new Set(Array.isArray(src.owned) ? src.owned.filter(isPetId) : [])];
  if (!owned.length) return undefined;
  const names: Partial<Record<PetId, string>> = {};
  if (src.names && typeof src.names === 'object') {
    for (const id of owned) {
      const name = cleanPetName((src.names as Record<string, unknown>)[id]);
      if (name) names[id] = name;
    }
  }
  return {
    owned,
    ...(isPetId(src.active) && owned.includes(src.active) ? { active: src.active } : {}),
    ...(Object.keys(names).length ? { names } : {}),
  };
}
