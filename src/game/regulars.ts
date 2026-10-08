// Постоянные покупатели: знакомые лица с именами и привычками. Каждый любит свой товар
// и терпит цену только до своей границы. Нашёл любимое по честной цене — доверие растёт,
// на полном доверии оставляет чаевые; не нашёл или дорого — доверие падает;
// упало до нуля — обиделся и неделю не придёт.

import type { TextKey } from '../i18n/ru';
import { perceivedBase } from './endless';
import { sellableProducts, type ProductId, type StoreState } from './economy';

export type RegularId = 'petr' | 'sveta' | 'kostya' | 'akhmed' | 'olga';

export interface RegularLook {
  shirt: number;
  skin: number;
  pants: number;
  hair: number;
  style: 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';
  glasses?: boolean;
  bag?: 'bag' | 'backpack';
  bagTint?: number;
}

export interface Regular {
  id: RegularId;
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

export const REGULARS: Regular[] = [
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
];

export const START_LOYALTY = 3;
export const MAX_LOYALTY = 5;
/** Обиделся — столько дней не приходит. */
export const AWAY_DAYS = 7;
/** На полном доверии оставляет чаевые: такую долю от покупки. */
export const TIP_SHARE = 0.15;

export const regularById = (id: RegularId): Regular => REGULARS.find((r) => r.id === id)!;

export function regularState(state: StoreState, id: RegularId): { loyalty: number; awayUntil: number } {
  return state.regulars?.[id] ?? { loyalty: START_LOYALTY, awayUntil: 0 };
}

/** Уже знакомы (пора ходить по дням). */
export const met = (state: StoreState, r: Regular): boolean => state.day >= r.from;

/** Кто может прийти сегодня: знакомы, не в обиде, и любимый товар здесь вообще продаётся. */
export function regularsToday(state: StoreState): Regular[] {
  const sellable = sellableProducts(state);
  return REGULARS.filter((r) => met(state, r) && regularState(state, r.id).awayUntil < state.day && sellable.includes(r.favorite));
}

/** Согласен ли на эту цену любимого товара. */
export const acceptsPrice = (state: StoreState, r: Regular, price: number): boolean => price <= perceivedBase(state, r.favorite) * r.tolerance;

export type VisitResult = 'up' | 'down' | 'left';

/** Итог визита: доверие растёт или падает; упало до нуля — обиделся на неделю. */
export function recordVisit(state: StoreState, id: RegularId, happy: boolean): { state: StoreState; result: VisitResult } {
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
