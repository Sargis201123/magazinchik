// Наследие: универмаг после сюжета можно продать и начать новый магазин с нуля — но не с пустыми
// руками. За продажу дают очки наследия (чем больше заработал магазин за всё время, тем больше),
// а на них — бонусы, которые остаются во всех следующих магазинах: стартовый капитал, известное
// имя, старые связи с поставщиками, слава района и опытные знакомые. Деньги магазина не переносятся.

import { STORE_LEVELS, type StoreState } from './economy';
import { CHAPTERS } from './story';

export type PerkId = 'capital' | 'fame' | 'suppliers' | 'crowd' | 'mentor';

export interface Perk {
  icon: string;
  max: number;
}

export const PERKS: Record<PerkId, Perk> = {
  /** +500 💰 на старте за ступень. */
  capital: { icon: '💰', max: 5 },
  /** +0,2★ стартового рейтинга за ступень. */
  fame: { icon: '⭐', max: 3 },
  /** −3% к закупке за ступень. */
  suppliers: { icon: '🚚', max: 5 },
  /** +4% гостей за ступень. */
  crowd: { icon: '👥', max: 5 },
  /** Новые сотрудники приходят на ступень опытнее. */
  mentor: { icon: '🎓', max: 2 },
};
export const PERK_IDS = Object.keys(PERKS) as PerkId[];

export const CAPITAL_STEP = 500;
export const FAME_STEP = 0.2;
export const SUPPLIERS_STEP = 0.03;
export const CROWD_STEP = 0.04;

export interface Legacy {
  /** Сколько магазинов уже продано. */
  gen: number;
  /** Неистраченные очки. */
  points: number;
  perks: Partial<Record<PerkId, number>>;
  /** Выручка всех проданных магазинов — для рейтинга (место не теряется после продажи). */
  revenue?: number;
}

export const legacyOf = (state: StoreState): Legacy => state.legacy ?? { gen: 0, points: 0, perks: {} };
export const perkLevel = (state: StoreState, id: PerkId): number => Math.min(PERKS[id].max, legacyOf(state).perks[id] ?? 0);

/** Продать можно универмаг после сюжета. */
export const canSell = (state: StoreState): boolean => state.level >= STORE_LEVELS.length - 1 && state.story.chapter >= CHAPTERS.length;

/**
 * Деньги в кассе при продаже идут в зачёт вдвое: в конце игры деньгам иначе некуда деться
 * (в симуляторе к 180-му дню у обычного игрока 200 тыс., у опытного — больше миллиона).
 */
export const SALE_CASH_WEIGHT = 2;

/** Очки за продажу: корень из выручки за всё время и денег в кассе (1 млн — 10 очков, 4 млн — 20). */
export const salePoints = (state: StoreState): number =>
  Math.floor(Math.sqrt((state.totalRevenue + SALE_CASH_WEIGHT * Math.max(0, state.money)) / 10000));

/** Следующая ступень бонуса стоит столько очков, какая это ступень (1, 2, 3…). */
export const perkCost = (state: StoreState, id: PerkId): number | null => {
  const level = perkLevel(state, id);
  return level >= PERKS[id].max ? null : level + 1;
};

export function buyPerk(state: StoreState, id: PerkId): StoreState | null {
  const cost = perkCost(state, id);
  const legacy = legacyOf(state);
  if (cost === null || legacy.points < cost) return null;
  return { ...state, legacy: { ...legacy, points: legacy.points - cost, perks: { ...legacy.perks, [id]: perkLevel(state, id) + 1 } } };
}

/** Продать магазин: очки наследия и следующее поколение. Новый магазин — restartGame(). */
export function sellBusiness(state: StoreState): StoreState | null {
  if (!canSell(state)) return null;
  const legacy = legacyOf(state);
  return { ...state, legacy: { ...legacy, gen: legacy.gen + 1, points: legacy.points + salePoints(state), revenue: (legacy.revenue ?? 0) + state.totalRevenue } };
}

/** Новый магазин получает стартовые бонусы наследия: деньги и рейтинг. */
export function applyLegacyStart(state: StoreState): StoreState {
  if (!state.legacy) return state;
  return {
    ...state,
    money: state.money + perkLevel(state, 'capital') * CAPITAL_STEP,
    rating: Math.min(5, state.rating + perkLevel(state, 'fame') * FAME_STEP),
  };
}

/** Множитель цены закупки (связи с поставщиками). */
export const legacyPurchase = (state: StoreState): number => 1 - perkLevel(state, 'suppliers') * SUPPLIERS_STEP;
/** Множитель гостей (слава района). */
export const legacyGuests = (state: StoreState): number => 1 + perkLevel(state, 'crowd') * CROWD_STEP;
/** Насколько опытнее приходят новые сотрудники. */
export const legacyMentor = (state: StoreState): number => perkLevel(state, 'mentor');

/** Выручка за всю историю: проданные магазины и нынешний. */
export const lifetimeRevenue = (state: StoreState): number => (state.legacy?.revenue ?? 0) + state.totalRevenue;
