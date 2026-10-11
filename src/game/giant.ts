// Гипермаркет «Гигант» — продолжение после сюжета. Когда Эдуард побеждён и магазин живёт
// своей жизнью, на пустыре за дорогой федеральная сеть начинает стройку. Десять дней видно, как
// растёт гипермаркет, — есть время подготовиться. Потом «Гигант» открывается, и начинается
// битва за покупателей на две недели: часть района уходит к нему. Удержать своих помогают
// высокий рейтинг, реклама, карта лояльности и свои постоянные покупатели.
// Цель битвы — выручка за 14 дней и рейтинг не ниже 4. Победа: «Гигант» закрывается, награда
// и слава района (+5% гостей навсегда). Поражение: он остаётся и забирает часть гостей, а через
// месяц — реванш.

import type { StoreState } from './economy';
import { activeAd } from './ads';
import { hasUpgrade } from './upgrades';
import { CHAPTERS } from './story';

export type GiantPhase = 'build' | 'battle' | 'won' | 'lost';

export interface GiantState {
  phase: GiantPhase;
  /** С какого дня идёт фаза. */
  since: number;
  /** Выручка за битву и сколько нужно. */
  revenue: number;
  target: number;
  /** Какую фазу игрок уже видел в новостях. */
  seen?: GiantPhase;
}

/** Стройка начинается с этого дня (если сюжет пройден). */
export const GIANT_FROM_DAY = 60;
export const GIANT_BUILD_DAYS = 10;
export const GIANT_BATTLE_DAYS = 14;
export const GIANT_REMATCH_DAYS = 30;
/** Сколько гостей «Гигант» уводит в битву и после поражения. */
export const GIANT_PULL = 0.3;
export const GIANT_PULL_LOST = 0.12;
/** Нижняя граница — сколько бы ни старались, часть района всё равно сходит посмотреть. */
export const GIANT_PULL_MIN = 0.08;
/** Нужный рейтинг в конце битвы и слава района после победы. */
export const GIANT_RATING = 4;
export const GIANT_FAME = 1.05;
/** Цель по выручке: столько от обычной выручки за 14 дней. */
export const GIANT_TARGET_SHARE = 0.85;

const freePlay = (state: StoreState): boolean => state.story.chapter >= CHAPTERS.length;

export const giantOf = (state: StoreState): GiantState | undefined => state.giant;

/** Чем удерживаем своих покупателей: рейтинг, реклама, карта лояльности, своя выпечка «От бабушки». */
export function giantDefense(state: StoreState): { rating: boolean; ad: boolean; loyalty: boolean; brand: boolean } {
  return {
    rating: state.rating >= 4.5,
    ad: Boolean(activeAd(state)),
    loyalty: hasUpgrade(state, 'loyalty'),
    brand: hasUpgrade(state, 'oven'),
  };
}

/** Какая доля гостей сегодня уходит к «Гиганту». */
export function giantPull(state: StoreState): number {
  const giant = giantOf(state);
  if (!giant || (giant.phase !== 'battle' && giant.phase !== 'lost')) return 0;
  const base = giant.phase === 'battle' ? GIANT_PULL : GIANT_PULL_LOST;
  const d = giantDefense(state);
  const cut = (d.rating ? 0.08 : 0) + (d.ad ? 0.06 : 0) + (d.loyalty ? 0.05 : 0) + (d.brand ? 0.04 : 0);
  return Math.max(giant.phase === 'battle' ? GIANT_PULL_MIN : GIANT_PULL_MIN / 2, base - cut * (giant.phase === 'battle' ? 1 : 0.5));
}

/** Множитель гостей: битва и поражение — минус уведённые, победа — слава района. */
export const giantGuests = (state: StoreState): number => (giantOf(state)?.phase === 'won' ? GIANT_FAME : 1 - giantPull(state));

/** Цель битвы: обычная выручка последней недели × 14 дней × доля; не меньше 3000. */
export function giantTarget(state: StoreState): number {
  const week = (state.history ?? []).slice(-7);
  const avg = week.length ? week.reduce((a, b) => a + b, 0) / week.length : 0;
  return Math.max(3000, Math.round((avg * GIANT_BATTLE_DAYS * GIANT_TARGET_SHARE) / 100) * 100);
}

/** Награда за победу. */
export const giantReward = (state: StoreState): number => 3000 + 2000 * state.level;

/**
 * Ночью: стройка начинается, битва открывается, выручка копится, итог подводится, реванш.
 * state — уже следующего дня (день сменился), revenue — выручка только что закончившегося дня.
 */
export function giantNight(state: StoreState, revenue: number): StoreState {
  const giant = giantOf(state);
  const day = state.day;
  if (!giant) {
    if (!freePlay(state) || day < GIANT_FROM_DAY) return state;
    return { ...state, giant: { phase: 'build', since: day, revenue: 0, target: 0 } };
  }
  if (giant.phase === 'build' && day - giant.since >= GIANT_BUILD_DAYS) {
    return { ...state, giant: { ...giant, phase: 'battle', since: day, revenue: 0, target: giantTarget(state) } };
  }
  if (giant.phase === 'battle') {
    const total = giant.revenue + (day - 1 >= giant.since ? revenue : 0);
    if (day - giant.since < GIANT_BATTLE_DAYS) return { ...state, giant: { ...giant, revenue: total } };
    const won = total >= giant.target && state.rating >= GIANT_RATING;
    const s: StoreState = { ...state, giant: { ...giant, phase: won ? 'won' : 'lost', since: day, revenue: total } };
    return won ? { ...s, money: s.money + giantReward(s), rating: Math.min(5, s.rating + 0.5) } : s;
  }
  if (giant.phase === 'lost' && day - giant.since >= GIANT_REMATCH_DAYS) {
    return { ...state, giant: { ...giant, phase: 'battle', since: day, revenue: 0, target: giantTarget(state) } };
  }
  return state;
}

/** Новость утром: фаза сменилась, а игрок её ещё не видел. */
export const giantNews = (state: StoreState): GiantPhase | null => {
  const giant = giantOf(state);
  return giant && giant.seen !== giant.phase ? giant.phase : null;
};

export const seeGiantNews = (state: StoreState): StoreState => (state.giant ? { ...state, giant: { ...state.giant, seen: state.giant.phase } } : state);

/** Как выглядит пустырь за дорогой. */
export type GiantLook = 'none' | 'site' | 'store' | 'closed';

export function giantLook(state: StoreState): GiantLook {
  const phase = giantOf(state)?.phase;
  if (!phase) return 'none';
  return phase === 'build' ? 'site' : phase === 'won' ? 'closed' : 'store';
}
