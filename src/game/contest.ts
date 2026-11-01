// Финал истории и бесконечная слава. Во вторую неделю битвы с «Гигантом» районная администрация объявляет
// конкурс «Лучший магазин района»: неделя подготовки, в последний день приходит жюри. Оценивают
// четыре вещи — рейтинг, выручку недели, довольных покупателей и полные полки; хватает трёх.
// Первая победа — финал истории: церемония со всеми героями и кубок. Дальше раз в месяц —
// конкурсы города, области и страны, а после — звания «Легенда торговли II, III…».
// Каждая победа — новое звание, кубок, деньги и немного славы (гостей больше навсегда).

import type { DayStats, StoreState } from './economy';
import { GIANT_BATTLE_DAYS } from './giant';

/** Сколько дней после победы над «Гигантом» до первого конкурса. */
export const CONTEST_AFTER_GIANT = 5;
/** Неделя конкурса: жюри приходит в последний день. */
export const CONTEST_DAYS = 7;
/** Следующий конкурс: после победы — через месяц, после поражения — через три недели. */
export const CONTEST_EVERY_WON = 28;
export const CONTEST_EVERY_LOST = 21;
/** Сколько из четырёх оценок нужно для победы. */
export const CONTEST_NEED = 3;
/** Доля недовольных (ушли ни с чем или пожаловались) от всех гостей — не больше. */
export const CONTEST_UNHAPPY = 0.12;
/** Ушли из-за пустых полок за неделю — не больше. */
export const CONTEST_EMPTY = 6;
/** Слава за каждую победу (+3% гостей), но не больше +15%. */
export const CONTEST_FAME = 0.03;
export const CONTEST_FAME_MAX = 0.15;
/** Именных ступеней: район, город, область, страна; дальше — «Легенда торговли». */
export const CONTEST_TIERS = 4;

export type ContestCriterion = 'rating' | 'revenue' | 'happy' | 'shelves';
export const CRITERIA: ContestCriterion[] = ['rating', 'revenue', 'happy', 'shelves'];

export interface ContestResult {
  won: boolean;
  tier: number;
  passed: Record<ContestCriterion, boolean>;
  prize: number;
  seen?: boolean;
}

export interface ContestState {
  /** Ступень текущего (или следующего) конкурса: 0 — район. */
  tier: number;
  phase: 'run' | 'wait';
  /** Первый день недели конкурса или день, когда подвели итог. */
  since: number;
  target: number;
  /** Накоплено за неделю. */
  revenue: number;
  served: number;
  unhappy: number;
  empty: number;
  /** Объявление новой недели уже показали. */
  announced?: boolean;
  /** Сколько раз победили — это и звание. */
  wins: number;
  last?: ContestResult;
}

export const contestOf = (state: StoreState): ContestState | undefined => state.contest;

/** Нужный рейтинг: на каждом следующем конкурсе строже, но не выше 4.8. */
export const contestRating = (tier: number): number => Math.min(4.8, 4.4 + 0.1 * tier);

/** Цель недели: обычная выручка последней недели × 7 × (1 + 5% за ступень), не меньше 2000. */
export function contestTarget(state: StoreState, tier: number): number {
  const week = (state.history ?? []).slice(-7);
  const avg = week.length ? week.reduce((a, b) => a + b, 0) / week.length : 0;
  return Math.max(2000, Math.round((avg * CONTEST_DAYS * (1 + 0.05 * tier)) / 100) * 100);
}

/**
 * Приз: растёт со ступенью и с магазином — не меньше двух средних дневных выручек (+50% за ступень),
 * чтобы и у большого магазина награда была заметной.
 */
export function contestPrize(state: StoreState, tier: number): number {
  const week = (state.history ?? []).slice(-7);
  const avg = week.length ? week.reduce((a, b) => a + b, 0) / week.length : 0;
  return Math.max(2000 + 1500 * tier, Math.round((avg * (2 + 0.5 * tier)) / 100) * 100);
}

/** День визита жюри (последний день недели конкурса). */
export function juryDay(state: StoreState): boolean {
  const c = contestOf(state);
  return Boolean(c && c.phase === 'run' && state.day === c.since + CONTEST_DAYS - 1);
}

/** Множитель гостей от славы конкурсов. */
export const contestGuests = (state: StoreState): number => 1 + Math.min(CONTEST_FAME_MAX, CONTEST_FAME * (contestOf(state)?.wins ?? 0));

function newWeek(state: StoreState, tier: number, wins: number, last?: ContestResult): ContestState {
  return { tier, phase: 'run', since: state.day, target: contestTarget(state, tier), revenue: 0, served: 0, unhappy: 0, empty: 0, wins, last };
}

/** Оценки жюри по итогам недели. */
export function judge(state: StoreState, c: ContestState): Record<ContestCriterion, boolean> {
  return {
    rating: state.rating >= contestRating(c.tier),
    revenue: c.revenue >= c.target,
    happy: c.unhappy <= Math.max(3, Math.round(c.served * CONTEST_UNHAPPY)),
    shelves: c.empty <= CONTEST_EMPTY,
  };
}

/**
 * Ночью: конкурс объявляется, неделя копит выручку и недовольных, жюри подводит итог, через месяц —
 * следующий. state — уже следующего дня, stats — итоги только что закончившегося дня.
 */
export function contestNight(state: StoreState, stats: DayStats): StoreState {
  const c = contestOf(state);
  const day = state.day;
  if (!c) {
    const giant = state.giant;
    // «Бабушкина тетрадь» (notebook.ts): первый конкурс объявляют во вторую неделю битвы с «Гигантом» —
    // день жюри совпадает с её последним днём, и в этот день люди из тетради приходят «вернуть долги».
    // Сохранения, где «Гигант» уже побеждён, а конкурса не было, — как раньше, через несколько дней.
    const climax = giant?.phase === 'battle' && day - giant.since >= GIANT_BATTLE_DAYS - CONTEST_DAYS;
    const after = giant?.phase === 'won' && day - giant.since >= CONTEST_AFTER_GIANT;
    if (!climax && !after) return state;
    return { ...state, contest: newWeek(state, 0, 0) };
  }
  if (c.phase === 'wait') {
    const every = c.last?.won ? CONTEST_EVERY_WON : CONTEST_EVERY_LOST;
    if (day - c.since < every) return state;
    return { ...state, contest: newWeek(state, c.tier, c.wins, c.last) };
  }
  const counted = day - 1 >= c.since;
  const week: ContestState = counted
    ? {
        ...c,
        revenue: c.revenue + stats.revenue,
        served: c.served + stats.served,
        unhappy: c.unhappy + stats.lost + stats.complaints,
        empty: c.empty + (stats.lostWhy?.empty ?? 0),
      }
    : c;
  if (day - c.since < CONTEST_DAYS) return { ...state, contest: week };
  const passed = judge(state, week);
  const won = CRITERIA.filter((k) => passed[k]).length >= CONTEST_NEED;
  const prize = won ? contestPrize(state, week.tier) : 0;
  const result: ContestResult = { won, tier: week.tier, passed, prize };
  const next: ContestState = { ...week, phase: 'wait', since: day, tier: won ? week.tier + 1 : week.tier, wins: week.wins + (won ? 1 : 0), last: result };
  return {
    ...state,
    money: state.money + prize,
    rating: won ? Math.min(5, state.rating + 0.2) : state.rating,
    contest: next,
  };
}

/** Утром: объявить новую неделю конкурса (если ещё не объявили). */
export function contestAnnounce(state: StoreState): ContestState | null {
  const c = contestOf(state);
  return c && c.phase === 'run' && !c.announced && state.day === c.since ? c : null;
}

export function seeAnnounce(state: StoreState): StoreState {
  const c = contestOf(state);
  return c ? { ...state, contest: { ...c, announced: true } } : state;
}

/** Утром после визита жюри: итог, который игрок ещё не видел. */
export function contestResult(state: StoreState): ContestResult | null {
  const c = contestOf(state);
  return c?.phase === 'wait' && c.last && !c.last.seen && state.day === c.since ? c.last : null;
}

export function seeResult(state: StoreState): StoreState {
  const c = contestOf(state);
  return c?.last ? { ...state, contest: { ...c, last: { ...c.last, seen: true } } } : state;
}

/** Ступень для названия: 0 район, 1 город, 2 область, 3 страна, дальше — легенда (4, 5…). */
export const tierKey = (tier: number): 'district' | 'city' | 'region' | 'country' | 'legend' =>
  (['district', 'city', 'region', 'country'] as const)[tier] ?? 'legend';

/** Номер «Легенды»: II, III… (первая легенда — без номера). */
export function legendNumber(tier: number): string {
  const n = tier - CONTEST_TIERS + 1;
  if (n <= 1) return '';
  const romans: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  let left = n;
  for (const [v, r] of romans) while (left >= v) [out, left] = [out + r, left - v];
  return ` ${out}`;
}

/** Звание по числу побед: −1 — ещё ни одной. */
export const titleTier = (state: StoreState): number => (contestOf(state)?.wins ?? 0) - 1;
