// Постоянные покупатели: знакомые лица с именами и привычками. Каждый любит свой товар
// и терпит цену только до своей границы. Нашёл любимое по честной цене — доверие растёт,
// на полном доверии оставляет чаевые; не нашёл или дорого — доверие падает;
// упало до нуля — обиделся и неделю не придёт.

import type { TextKey } from '../i18n/ru';
import { perceivedBase } from './endless';
import { sellableProducts, type ProductId, type StoreState } from './economy';

export type RegularId = 'petr' | 'sveta' | 'kostya' | 'akhmed' | 'olga' | 'misha';
/** Жители Заречья (zarechye.ts): ходят только в лавку у реки, знакомятся по дням, сыгранным там. */
export type ZarRegularId = 'nina' | 'yegor' | 'stepan' | 'lida' | 'tolik';

export interface RegularLook {
  shirt: number;
  skin: number;
  pants: number;
  hair: number;
  style: 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';
  glasses?: boolean;
  bag?: 'bag' | 'backpack';
  bagTint?: number;
  /** Ребёнок — ростом поменьше. */
  kid?: boolean;
  /** Катит коляску (life.ts). */
  stroller?: number;
}

export interface Regular {
  id: RegularId | ZarRegularId;
  nameKey: TextKey;
  habitKey: TextKey;
  favorite: ProductId;
  /** До какой цены (× «справедливая») согласен покупать любимый товар. */
  tolerance: number;
  /** Шанс зайти в обычный день. */
  every: number;
  /** С какого дня начинает ходить (знакомимся постепенно). */
  from: number;
  look: RegularLook;
}

export const REGULARS: (Regular & { id: RegularId })[] = [
  {
    id: 'petr',
    nameKey: 'regular.petr',
    habitKey: 'regular.petr.habit',
    favorite: 'bread',
    tolerance: 1.05,
    every: 0.8,
    from: 2,
    look: { shirt: 0x8b9bb4, skin: 0xf2c9a0, pants: 0x262b44, hair: 0xd8d8e0, style: 'bald', glasses: true },
  },
  {
    id: 'sveta',
    nameKey: 'regular.sveta',
    habitKey: 'regular.sveta.habit',
    favorite: 'milk',
    tolerance: 1.15,
    every: 0.6,
    from: 4,
    look: { shirt: 0xf6757a, skin: 0xeec39a, pants: 0x3a4466, hair: 0x733e39, style: 'ponytail', bag: 'bag', bagTint: 0xb55088 },
  },
  {
    id: 'kostya',
    nameKey: 'regular.kostya',
    habitKey: 'regular.kostya.habit',
    favorite: 'potatoes',
    tolerance: 0.95,
    every: 0.7,
    from: 6,
    look: { shirt: 0x5b6ee1, skin: 0xd9a066, pants: 0x262b44, hair: 0x181425, style: 'curly', bag: 'backpack', bagTint: 0xfeae34 },
  },
  {
    id: 'akhmed',
    nameKey: 'regular.akhmed',
    habitKey: 'regular.akhmed.habit',
    favorite: 'meat',
    tolerance: 1.25,
    every: 0.5,
    from: 9,
    look: { shirt: 0x3a4466, skin: 0xc68642, pants: 0x262b44, hair: 0xfee761, style: 'cap' },
  },
  {
    id: 'olga',
    nameKey: 'regular.olga',
    habitKey: 'regular.olga.habit',
    favorite: 'apples',
    tolerance: 1.1,
    every: 0.6,
    from: 12,
    look: { shirt: 0x3e8948, skin: 0xf2d3ab, pants: 0x5a6988, hair: 0xb86f50, style: 'bun', glasses: true },
  },
  {
    // Старший сын Светы: подрос и ходит сам (life.ts — появляется в районе позже).
    id: 'misha',
    nameKey: 'regular.misha',
    habitKey: 'regular.misha.habit',
    favorite: 'juice',
    tolerance: 1.2,
    every: 0.6,
    from: 180,
    look: { shirt: 0xfeae34, skin: 0xeec39a, pants: 0x3a4466, hair: 0x733e39, style: 'short', kid: true, bag: 'backpack', bagTint: 0xe43b44 },
  },
];

/**
 * Жители Заречья: свои лица у реки. from — с какого дня в Заречье (zar.played) начинают ходить;
 * их доверие хранится в постоянных лавки (regulars — поле магазина, zarechye.ts SHOP_KEYS).
 */
export const ZAR_REGULARS: (Regular & { id: ZarRegularId })[] = [
  {
    // Нина Петровна — бакенщица на пенсии, всю жизнь зажигала огни на реке.
    id: 'nina',
    nameKey: 'zar.res.nina',
    habitKey: 'zar.res.nina.habit',
    favorite: 'bread',
    tolerance: 1.1,
    every: 0.8,
    from: 0,
    look: { shirt: 0x124e89, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true, bag: 'bag', bagTint: 0x3e8948 },
  },
  {
    // Егор — студент речного техникума, бегом на пары.
    id: 'yegor',
    nameKey: 'zar.res.yegor',
    habitKey: 'zar.res.yegor.habit',
    favorite: 'apples',
    tolerance: 1.0,
    every: 0.7,
    from: 1,
    look: { shirt: 0x63c74d, skin: 0xeec39a, pants: 0x262b44, hair: 0x4a2c1a, style: 'beanie', bag: 'backpack', bagTint: 0x0099db },
  },
  {
    // Степан Ильич — лодочник, держит лодочную станцию у моста.
    id: 'stepan',
    nameKey: 'zar.res.stepan',
    habitKey: 'zar.res.stepan.habit',
    favorite: 'potatoes',
    tolerance: 1.15,
    every: 0.6,
    from: 3,
    look: { shirt: 0x8f563b, skin: 0xd9a066, pants: 0x3a4466, hair: 0x8b9bb4, style: 'cap' },
  },
  {
    // Лида — художница: рисует мост с набережной в любую погоду.
    id: 'lida',
    nameKey: 'zar.res.lida',
    habitKey: 'zar.res.lida.habit',
    favorite: 'milk',
    tolerance: 1.2,
    every: 0.6,
    from: 5,
    look: { shirt: 0xf6757a, skin: 0xf2d3ab, pants: 0x5a6988, hair: 0xe43b44, style: 'long', bag: 'bag', bagTint: 0xfee761 },
  },
  {
    // Толик — внук Нины Петровны, с удочкой и вечно мокрыми кедами.
    id: 'tolik',
    nameKey: 'zar.res.tolik',
    habitKey: 'zar.res.tolik.habit',
    favorite: 'bread',
    tolerance: 1.1,
    every: 0.6,
    from: 8,
    look: { shirt: 0xfeae34, skin: 0xeec39a, pants: 0x124e89, hair: 0xb86f50, style: 'cap', kid: true },
  },
];

export const START_LOYALTY = 3;
export const MAX_LOYALTY = 5;
/** Обиделся — столько дней не приходит. */
export const AWAY_DAYS = 7;
/** На полном доверии оставляет чаевые: такую долю от покупки. */
export const TIP_SHARE = 0.15;

export const regularById = (id: RegularId | ZarRegularId): Regular => REGULARS.find((r) => r.id === id) ?? ZAR_REGULARS.find((r) => r.id === id)!;

export function regularState(state: StoreState, id: RegularId | ZarRegularId): { loyalty: number; awayUntil: number } {
  return state.regulars?.[id] ?? { loyalty: START_LOYALTY, awayUntil: 0 };
}

/** Уже знакомы (пора ходить по дням). */
export const met = (state: StoreState, r: Regular): boolean => (ZAR_REGULARS.some((z) => z.id === r.id) ? (state.zar?.played ?? 0) >= r.from : state.day >= r.from);

/** Кто может прийти сегодня: знакомы, не в обиде, и любимый товар здесь вообще продаётся. В Заречье — свои жители. */
export function regularsToday(state: StoreState): Regular[] {
  const sellable = sellableProducts(state);
  return (state.zar?.at === 'zar' ? ZAR_REGULARS : REGULARS).filter((r) => met(state, r) && regularState(state, r.id).awayUntil < state.day && sellable.includes(r.favorite));
}

/** Согласен ли на эту цену любимого товара. */
export const acceptsPrice = (state: StoreState, r: Regular, price: number): boolean => price <= perceivedBase(state, r.favorite) * r.tolerance;

export type VisitResult = 'up' | 'down' | 'left';

/** Итог визита: доверие растёт или падает; упало до нуля — обиделся на неделю. */
export function recordVisit(state: StoreState, id: RegularId | ZarRegularId, happy: boolean): { state: StoreState; result: VisitResult } {
  const cur = regularState(state, id);
  let loyalty = happy ? Math.min(MAX_LOYALTY, cur.loyalty + 1) : cur.loyalty - 2;
  let awayUntil = cur.awayUntil;
  let result: VisitResult = happy ? 'up' : 'down';
  if (loyalty <= 0) {
    // Вернётся через неделю, но доверие придётся завоёвывать заново.
    loyalty = 1;
    awayUntil = state.day + AWAY_DAYS;
    result = 'left';
  }
  return { state: { ...state, regulars: { ...state.regulars, [id]: { loyalty, awayUntil } } }, result };
}

export const tipFor = (loyalty: number, total: number): number => (loyalty >= MAX_LOYALTY ? Math.round(total * TIP_SHARE) : 0);
