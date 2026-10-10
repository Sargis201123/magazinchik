// Оформление магазина: стены, пол, картины, ковёр, растения, неон, аквариум.
// Обычное покупается за монеты; премиальное — за Telegram Stars (platform/stars.ts),
// его можно один раз бесплатно примерить на день. Купленное за звёзды остаётся навсегда,
// даже после «Начать заново».

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export type DecorKind = 'sign' | 'wall' | 'floor' | 'light' | 'showpiece' | 'art' | 'rug' | 'plants' | 'neon';

export type DecorId =
  | 'wall_mint'
  | 'wall_peach'
  | 'wall_lilac'
  | 'wall_brick'
  | 'wall_walnut'
  | 'wall_metro'
  | 'wall_damask'
  | 'wall_provence'
  | 'floor_cool'
  | 'floor_wood'
  | 'floor_checker'
  | 'floor_marble'
  | 'floor_gold'
  | 'floor_chevron'
  | 'floor_terracotta'
  | 'floor_azulejo'
  | 'floor_noir'
  | 'sign_wood'
  | 'sign_neon'
  | 'sign_gold'
  | 'sign_marquee'
  | 'sign_candy'
  | 'light_sconce'
  | 'light_pendant'
  | 'light_lantern'
  | 'light_chandelier'
  | 'light_garland'
  | 'art_sunflowers'
  | 'art_sea'
  | 'art_cat'
  | 'rug_red'
  | 'plants_big'
  | 'neon_open'
  | 'aquarium'
  | 'fountain'
  | 'jukebox'
  | 'lucky_cat'
  | 'gumball';

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
  /** Цвет надписи на вывеске. */
  textColor?: number;
}

const coins = (id: DecorId, kind: DecorKind, price: number, extra: Partial<DecorItem> = {}): DecorItem => ({
  id,
  kind,
  nameKey: `decor.${id}` as TextKey,
  price,
  ...extra,
});
/** Премиальная вещь: текстура совпадает с id. */
const stars = (id: DecorId, kind: DecorKind, n: number, extra: Partial<DecorItem> = {}): DecorItem => ({
  id,
  kind,
  nameKey: `decor.${id}` as TextKey,
  stars: n,
  texture: id,
  ...extra,
});

export const DECOR: DecorItem[] = [
  stars('sign_wood', 'sign', 50, { textColor: 0xfff3d6 }),
  stars('sign_neon', 'sign', 75, { textColor: 0x7af7ff }),
  stars('sign_candy', 'sign', 75, { textColor: 0xffffff }),
  stars('sign_marquee', 'sign', 100, { textColor: 0xffffff }),
  stars('sign_gold', 'sign', 100, { textColor: 0xf7dc85 }),
  coins('wall_mint', 'wall', 150, { color: 0xd6f2e4 }),
  coins('wall_peach', 'wall', 150, { color: 0xffe2d2 }),
  coins('wall_lilac', 'wall', 150, { color: 0xe6dcf6 }),
  stars('wall_brick', 'wall', 50),
  stars('wall_metro', 'wall', 50),
  stars('wall_provence', 'wall', 50),
  stars('wall_walnut', 'wall', 75),
  stars('wall_damask', 'wall', 75),
  coins('floor_cool', 'floor', 300, { texture: 'floor2' }),
  coins('floor_wood', 'floor', 450, { texture: 'floor_wood' }),
  coins('floor_checker', 'floor', 450, { texture: 'floor_checker' }),
  coins('floor_marble', 'floor', 900, { texture: 'floor3' }),
  stars('floor_gold', 'floor', 50),
  stars('floor_chevron', 'floor', 50),
  stars('floor_terracotta', 'floor', 50),
  stars('floor_azulejo', 'floor', 75),
  stars('floor_noir', 'floor', 100),
  stars('light_sconce', 'light', 50),
  stars('light_pendant', 'light', 50),
  stars('light_lantern', 'light', 50),
  stars('light_garland', 'light', 75),
  stars('light_chandelier', 'light', 100),
  stars('gumball', 'showpiece', 50),
  stars('aquarium', 'showpiece', 75),
  stars('lucky_cat', 'showpiece', 75),
  stars('fountain', 'showpiece', 100),
  stars('jukebox', 'showpiece', 100),
  coins('art_sunflowers', 'art', 200, { texture: 'art_sunflowers' }),
  coins('art_sea', 'art', 200, { texture: 'art_sea' }),
  coins('art_cat', 'art', 250, { texture: 'art_cat' }),
  coins('rug_red', 'rug', 250, { texture: 'rug' }),
  coins('plants_big', 'plants', 300, { texture: 'plant_big' }),
  stars('neon_open', 'neon', 30, { texture: 'neon' }),
];

export const DECOR_KINDS: DecorKind[] = ['sign', 'wall', 'floor', 'light', 'showpiece', 'art', 'rug', 'plants', 'neon'];

export interface DecorState {
  owned: DecorId[];
  /** Что сейчас стоит в магазине: по одной вещи каждого вида. */
  active: Partial<Record<DecorKind, DecorId>>;
  /** Примерка премиальной вещи на один день (каждую можно примерить один раз). */
  trial?: { id: DecorId; day: number };
  tried?: DecorId[];
}

export const newDecor = (): DecorState => ({ owned: [], active: {} });

export const decorItem = (id: DecorId): DecorItem => DECOR.find((d) => d.id === id)!;

export const isDecorId = (id: string): id is DecorId => DECOR.some((d) => d.id === id);

/** Премиальная — та, что продаётся за звёзды. */
export const isPremium = (id: DecorId): boolean => decorItem(id).stars !== undefined;

/** Примерка идёт сегодня? */
const trialToday = (state: StoreState): DecorItem | undefined => {
  const trial = state.decor.trial;
  return trial && trial.day === state.day && isDecorId(trial.id) ? decorItem(trial.id) : undefined;
};

/** Что стоит в магазине для этого вида (или ничего). Примерка на сегодня — поверх купленного. */
export const activeDecor = (state: StoreState, kind: DecorKind): DecorItem | undefined => {
  const trial = trialToday(state);
  if (trial?.kind === kind) return trial;
  const id = state.decor.active[kind];
  return id && isDecorId(id) ? decorItem(id) : undefined;
};

/** Можно ли примерить: премиальная, не куплена и ещё не примерялась. */
export const canTry = (state: StoreState, id: DecorId): boolean =>
  isPremium(id) && !state.decor.owned.includes(id) && !(state.decor.tried ?? []).includes(id);

/** Поставить премиальную вещь на сегодняшний день — посмотреть, как она смотрится в магазине. */
export function tryDecor(state: StoreState, id: DecorId): StoreState | null {
  if (!canTry(state, id)) return null;
  return { ...state, decor: { ...state.decor, trial: { id, day: state.day }, tried: [...(state.decor.tried ?? []), id] } };
}

/** Выдать купленное за звёзды (после оплаты или восстановления покупок) и сразу поставить. */
export function grantDecor(state: StoreState, ids: DecorId[], activate = true): StoreState {
  const fresh = ids.filter((id) => isDecorId(id) && !state.decor.owned.includes(id));
  if (!fresh.length) return state;
  const active = { ...state.decor.active };
  if (activate) for (const id of fresh) active[decorItem(id).kind] = id;
  const trial = state.decor.trial && fresh.includes(state.decor.trial.id) ? undefined : state.decor.trial;
  return { ...state, decor: { ...state.decor, owned: [...state.decor.owned, ...fresh], active, trial } };
}

/** Старые сохранения: аквариум переехал в «Украшения», неизвестные вещи убираем. */
export function normalizeDecor(decor: DecorState | undefined): DecorState {
  if (!decor) return newDecor();
  const owned = (decor.owned ?? []).filter(isDecorId);
  const active: DecorState['active'] = {};
  for (const id of Object.values(decor.active ?? {}) as DecorId[]) {
    if (id && isDecorId(id) && owned.includes(id)) active[decorItem(id).kind] = id;
  }
  return { ...decor, owned, active };
}

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
