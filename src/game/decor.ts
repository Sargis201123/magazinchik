// Оформление магазина: стены, пол, картины, ковёр, растения, свет, украшения зала, вещицы
// на прилавке и у входа, неон — и наряд хозяина. Обычное покупается за монеты: цены растут
// от сотен до нескольких тысяч, чтобы и в большом магазине было на что копить; премиальное — за Telegram Stars (platform/stars.ts),
// его можно один раз бесплатно примерить на день. Купленное за звёзды остаётся навсегда,
// даже после «Начать заново». Праздничное (ёлка, мимоза…) не продаётся: его дарят открытки
// праздников по настоящему календарю (live.ts), и оно тоже остаётся навсегда. Некоторые
// премиальные вещи продаются только набором (STAR_PACKS) — например, новогодний.
// Эксклюзив звёздного пропуска (season, pass.ts) не продаётся вовсе: вывеска и наряд сезона
// только с его звёздной дорожки. Табличка «Спасибо!» и кот в цилиндре — подарки за поддержку
// автора (support, support.ts). И то и другое тоже остаётся навсегда.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export type DecorKind = 'outfit' | 'sign' | 'wall' | 'floor' | 'light' | 'showpiece' | 'art' | 'rug' | 'plants' | 'counter' | 'outdoor' | 'neon' | 'holiday' | 'plaque' | 'mascot';

export type DecorId =
  | 'outfit_farmer'
  | 'outfit_retro'
  | 'outfit_tuxedo'
  | 'outfit_cyber'
  | 'wall_mint'
  | 'wall_peach'
  | 'wall_lilac'
  | 'wall_brick'
  | 'wall_walnut'
  | 'wall_metro'
  | 'wall_damask'
  | 'wall_provence'
  | 'wall_sky'
  | 'wall_lemon'
  | 'floor_cool'
  | 'floor_wood'
  | 'floor_checker'
  | 'floor_marble'
  | 'floor_gold'
  | 'floor_chevron'
  | 'floor_terracotta'
  | 'floor_azulejo'
  | 'floor_noir'
  | 'floor_oak'
  | 'floor_mosaic'
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
  | 'light_bulbs'
  | 'light_shade'
  | 'art_sunflowers'
  | 'art_sea'
  | 'art_cat'
  | 'art_mountains'
  | 'art_stilllife'
  | 'art_city'
  | 'rug_red'
  | 'rug_blue'
  | 'rug_patch'
  | 'plants_big'
  | 'plants_cactus'
  | 'plants_palm'
  | 'counter_vase'
  | 'counter_piggy'
  | 'out_planters'
  | 'out_chalkboard'
  | 'grand_clock'
  | 'globe'
  | 'neon_open'
  | 'aquarium'
  | 'fountain'
  | 'jukebox'
  | 'lucky_cat'
  | 'gumball'
  | 'sign_frost'
  | 'wall_winter'
  | 'holiday_tree'
  | 'holiday_ship'
  | 'holiday_mimosa'
  | 'sign_s1'
  | 'outfit_s1'
  | 'sign_s2'
  | 'outfit_s2'
  | 'thanks_plaque'
  | 'cat_hat';

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
  /** Продаётся только набором за звёзды (STAR_PACKS): id набора. */
  pack?: string;
  /** Праздничная вещь: её дарят открытки этого праздника (live.ts), не купить. */
  holiday?: 'newyear' | 'feb23' | 'march8';
  /** Эксклюзив звёздного пропуска этого сезона (pass.ts): не купить, только с его дорожки. */
  season?: number;
  /** Подарок за поддержку автора (support.ts): не купить отдельно. */
  support?: true;
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
  // Наряд хозяина: во что одет продавец за прилавком (StoreScene → COSTUMES).
  stars('outfit_farmer', 'outfit', 30),
  stars('outfit_retro', 'outfit', 50),
  stars('outfit_tuxedo', 'outfit', 70),
  stars('outfit_cyber', 'outfit', 100),
  stars('sign_wood', 'sign', 50, { textColor: 0xfff3d6 }),
  stars('sign_neon', 'sign', 75, { textColor: 0x7af7ff }),
  stars('sign_candy', 'sign', 75, { textColor: 0xffffff }),
  stars('sign_marquee', 'sign', 100, { textColor: 0xffffff }),
  stars('sign_gold', 'sign', 100, { textColor: 0xf7dc85 }),
  // Краска за монеты: на первые выручки, но уже не мелочь.
  coins('wall_mint', 'wall', 600, { color: 0xd6f2e4 }),
  coins('wall_peach', 'wall', 600, { color: 0xffe2d2 }),
  coins('wall_lilac', 'wall', 700, { color: 0xe6dcf6 }),
  coins('wall_sky', 'wall', 800, { color: 0xd8ecfa }),
  coins('wall_lemon', 'wall', 800, { color: 0xfff4c8 }),
  stars('wall_brick', 'wall', 50),
  stars('wall_metro', 'wall', 50),
  stars('wall_provence', 'wall', 50),
  stars('wall_walnut', 'wall', 75),
  stars('wall_damask', 'wall', 75),
  // Пол — дорогая переделка всего зала: мрамор — на большой магазин.
  coins('floor_cool', 'floor', 1200, { texture: 'floor2' }),
  coins('floor_wood', 'floor', 2000, { texture: 'floor_wood' }),
  coins('floor_checker', 'floor', 2000, { texture: 'floor_checker' }),
  coins('floor_oak', 'floor', 3000, { texture: 'floor_oak' }),
  coins('floor_mosaic', 'floor', 3500, { texture: 'floor_mosaic' }),
  coins('floor_marble', 'floor', 6000, { texture: 'floor3' }),
  stars('floor_gold', 'floor', 50),
  stars('floor_chevron', 'floor', 50),
  stars('floor_terracotta', 'floor', 50),
  stars('floor_azulejo', 'floor', 75),
  stars('floor_noir', 'floor', 100),
  coins('light_bulbs', 'light', 2200, { texture: 'light_bulbs' }),
  coins('light_shade', 'light', 3500, { texture: 'light_shade' }),
  stars('light_sconce', 'light', 50),
  stars('light_pendant', 'light', 50),
  stars('light_lantern', 'light', 50),
  stars('light_garland', 'light', 75),
  stars('light_chandelier', 'light', 100),
  coins('globe', 'showpiece', 4000, { texture: 'globe' }),
  coins('grand_clock', 'showpiece', 7000, { texture: 'grand_clock' }),
  stars('gumball', 'showpiece', 50),
  stars('aquarium', 'showpiece', 75),
  stars('lucky_cat', 'showpiece', 75),
  stars('fountain', 'showpiece', 100),
  stars('jukebox', 'showpiece', 100),
  coins('art_sunflowers', 'art', 900, { texture: 'art_sunflowers' }),
  coins('art_sea', 'art', 900, { texture: 'art_sea' }),
  coins('art_cat', 'art', 1200, { texture: 'art_cat' }),
  coins('art_mountains', 'art', 1500, { texture: 'art_mountains' }),
  coins('art_stilllife', 'art', 1800, { texture: 'art_stilllife' }),
  coins('art_city', 'art', 2500, { texture: 'art_city' }),
  coins('rug_red', 'rug', 1200, { texture: 'rug' }),
  coins('rug_patch', 'rug', 1600, { texture: 'rug_patch' }),
  coins('rug_blue', 'rug', 2500, { texture: 'rug_blue' }),
  coins('plants_big', 'plants', 1200, { texture: 'plant_big' }),
  coins('plants_cactus', 'plants', 1600, { texture: 'plants_cactus' }),
  coins('plants_palm', 'plants', 2800, { texture: 'plants_palm' }),
  // Мелочи на прилавок у кассы и вещи у входа (на тротуаре).
  coins('counter_vase', 'counter', 1000, { texture: 'counter_vase' }),
  coins('counter_piggy', 'counter', 1800, { texture: 'counter_piggy' }),
  coins('out_chalkboard', 'outdoor', 1500, { texture: 'out_chalkboard' }),
  coins('out_planters', 'outdoor', 2500, { texture: 'out_planters' }),
  stars('neon_open', 'neon', 30, { texture: 'neon' }),
  // Новогодний набор за звёзды (по желанию): снежная вывеска и зимние обои (art/holidays.py).
  { id: 'sign_frost', kind: 'sign', nameKey: 'decor.sign_frost', texture: 'sign_frost', textColor: 0xffffff, pack: 'pack_newyear' },
  { id: 'wall_winter', kind: 'wall', nameKey: 'decor.wall_winter', texture: 'wall_winter', pack: 'pack_newyear' },
  // Праздничное — подарок за открытки (live.ts): ставится у входа в зал, рядом с витриной.
  { id: 'holiday_tree', kind: 'holiday', nameKey: 'decor.holiday_tree', texture: 'holiday_tree', holiday: 'newyear' },
  { id: 'holiday_ship', kind: 'holiday', nameKey: 'decor.holiday_ship', texture: 'holiday_ship', holiday: 'feb23' },
  { id: 'holiday_mimosa', kind: 'holiday', nameKey: 'decor.holiday_mimosa', texture: 'holiday_mimosa', holiday: 'march8' },
  // Эксклюзив звёздного пропуска (art/season.py): «Листопад» — первый сезон, «Северное сияние» — второй.
  { id: 'outfit_s1', kind: 'outfit', nameKey: 'decor.outfit_s1', texture: 'outfit_s1', season: 1 },
  { id: 'sign_s1', kind: 'sign', nameKey: 'decor.sign_s1', texture: 'sign_s1', textColor: 0xf7dc85, season: 1 },
  { id: 'outfit_s2', kind: 'outfit', nameKey: 'decor.outfit_s2', texture: 'outfit_s2', season: 2 },
  { id: 'sign_s2', kind: 'sign', nameKey: 'decor.sign_s2', texture: 'sign_s2', textColor: 0xc8ffe6, season: 2 },
  // Подарки за поддержку автора (support.ts): табличка у кассы и кот на прилавке.
  { id: 'thanks_plaque', kind: 'plaque', nameKey: 'decor.thanks_plaque', texture: 'thanks_plaque', support: true },
  { id: 'cat_hat', kind: 'mascot', nameKey: 'decor.cat_hat', texture: 'cat_hat', support: true },
];

export const DECOR_KINDS: DecorKind[] = ['outfit', 'sign', 'wall', 'floor', 'light', 'showpiece', 'art', 'rug', 'plants', 'counter', 'outdoor', 'neon', 'holiday', 'plaque', 'mascot'];

/**
 * Наборы за звёзды: одна покупка — несколько вещей. Цена и название — и на сервере
 * (api/_lib/telegram.ts, STARS_CATALOG; совпадение проверяет тест).
 */
export const STAR_PACKS: Record<string, { stars: number; nameKey: TextKey; items: DecorId[] }> = {
  pack_newyear: { stars: 100, nameKey: 'decor.pack_newyear', items: ['sign_frost', 'wall_winter'] },
};

/** Что дают покупки за звёзды (вещи и наборы — по данным Telegram): только вещи оформления. */
export const decorFromPurchases = (ids: string[]): DecorId[] =>
  ids.flatMap((id) => STAR_PACKS[id]?.items ?? (isDecorId(id) ? [id] : []));

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

/** Премиальная — та, что продаётся за звёзды (сама или в наборе). */
export const isPremium = (id: DecorId): boolean => decorItem(id).stars !== undefined || decorItem(id).pack !== undefined;

/**
 * Принадлежит игроку, а не магазину: за звёзды (сама или в наборе), праздничная, эксклюзив пропуска
 * и подарок за поддержку — остаётся после «Начать заново».
 */
export const isKeepsake = (id: DecorId): boolean => {
  const item = decorItem(id);
  return isPremium(id) || item.holiday !== undefined || item.season !== undefined || item.support === true;
};

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

/** Можно ли примерить: премиальная или эксклюзив пропуска, не куплена и ещё не примерялась. */
export const canTry = (state: StoreState, id: DecorId): boolean =>
  (isPremium(id) || decorItem(id).season !== undefined) && !state.decor.owned.includes(id) && !(state.decor.tried ?? []).includes(id);

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

/** Купить за монеты и сразу поставить. Премиальное (за Stars) и праздничное так купить нельзя. */
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
