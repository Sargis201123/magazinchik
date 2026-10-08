// Оформление магазина: стены, пол, картины, ковёр, растения, неон, аквариум.
// Обычное покупается за монеты; премиальное — за Telegram Stars (оплата появится вместе с сервером).

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export type DecorKind = 'wall' | 'floor' | 'art' | 'rug' | 'plants' | 'neon' | 'aquarium';

export type DecorId =
  | 'wall_mint'
  | 'wall_peach'
  | 'wall_lilac'
  | 'floor_cool'
  | 'floor_wood'
  | 'floor_checker'
  | 'floor_marble'
  | 'floor_gold'
  | 'art_sunflowers'
  | 'art_sea'
  | 'art_cat'
  | 'rug_red'
  | 'plants_big'
  | 'neon_open'
  | 'aquarium';

export interface DecorItem {
  id: DecorId;
  kind: DecorKind;
  nameKey: TextKey;
  /** Цена в монетах. */
  price?: number;
  /** Цена в Telegram Stars — премиальные вещи. */
  stars?: number;
  /** Цвет (стены) или текстура (пол, картина) — для отрисовки. */
  color?: number;
  texture?: string;
}

export const DECOR: DecorItem[] = [
  { id: 'wall_mint', kind: 'wall', nameKey: 'decor.wall_mint', price: 150, color: 0xd6f2e4 },
  { id: 'wall_peach', kind: 'wall', nameKey: 'decor.wall_peach', price: 150, color: 0xffe2d2 },
  { id: 'wall_lilac', kind: 'wall', nameKey: 'decor.wall_lilac', price: 150, color: 0xe6dcf6 },
  { id: 'floor_cool', kind: 'floor', nameKey: 'decor.floor_cool', price: 300, texture: 'floor2' },
  { id: 'floor_wood', kind: 'floor', nameKey: 'decor.floor_wood', price: 450, texture: 'floor_wood' },
  { id: 'floor_checker', kind: 'floor', nameKey: 'decor.floor_checker', price: 450, texture: 'floor_checker' },
  { id: 'floor_marble', kind: 'floor', nameKey: 'decor.floor_marble', price: 900, texture: 'floor3' },
  { id: 'floor_gold', kind: 'floor', nameKey: 'decor.floor_gold', stars: 50, texture: 'floor_gold' },
  { id: 'art_sunflowers', kind: 'art', nameKey: 'decor.art_sunflowers', price: 200, texture: 'art_sunflowers' },
  { id: 'art_sea', kind: 'art', nameKey: 'decor.art_sea', price: 200, texture: 'art_sea' },
  { id: 'art_cat', kind: 'art', nameKey: 'decor.art_cat', price: 250, texture: 'art_cat' },
  { id: 'rug_red', kind: 'rug', nameKey: 'decor.rug_red', price: 250, texture: 'rug' },
  { id: 'plants_big', kind: 'plants', nameKey: 'decor.plants_big', price: 300, texture: 'plant_big' },
  { id: 'neon_open', kind: 'neon', nameKey: 'decor.neon_open', stars: 30, texture: 'neon' },
  { id: 'aquarium', kind: 'aquarium', nameKey: 'decor.aquarium', stars: 75, texture: 'aquarium' },
];

export const DECOR_KINDS: DecorKind[] = ['wall', 'floor', 'art', 'rug', 'plants', 'neon', 'aquarium'];

export interface DecorState {
  owned: DecorId[];
  /** Что сейчас стоит в магазине: по одной вещи каждого вида. */
  active: Partial<Record<DecorKind, DecorId>>;
}

export const newDecor = (): DecorState => ({ owned: [], active: {} });

export const decorItem = (id: DecorId): DecorItem => DECOR.find((d) => d.id === id)!;

/** Что стоит в магазине для этого вида (или ничего). */
export const activeDecor = (state: StoreState, kind: DecorKind): DecorItem | undefined => {
  const id = state.decor.active[kind];
  return id ? decorItem(id) : undefined;
};

/** Купить за монеты и сразу поставить. Премиальное (за Stars) так купить нельзя. */
export function buyDecor(state: StoreState, id: DecorId): StoreState | null {
  const item = decorItem(id);
  if (item.price === undefined || state.decor.owned.includes(id) || state.money < item.price) return null;
  return {
    ...state,
    money: state.money - item.price,
    decor: { owned: [...state.decor.owned, id], active: { ...state.decor.active, [item.kind]: id } },
  };
}

/** Поставить купленное или убрать (id = null — вернуть как было). */
export function setDecor(state: StoreState, kind: DecorKind, id: DecorId | null): StoreState | null {
  if (id && (!state.decor.owned.includes(id) || decorItem(id).kind !== kind)) return null;
  const active = { ...state.decor.active };
  if (id) active[kind] = id;
  else delete active[kind];
  return { ...state, decor: { ...state.decor, active } };
}
