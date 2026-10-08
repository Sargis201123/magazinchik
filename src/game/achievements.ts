// Книга достижений: пиксельные значки за вехи игры. Награды нет — только гордость и коллекция.
// Счётчики «за всю игру» копятся в конце каждого дня; днём к ним прибавляется сегодняшнее.

import type { TextKey } from '../i18n/ru';
import { newLifetime, type DayStats, type Lifetime, type StoreState } from './economy';
import { RARE_GUESTS } from './endless';
import { CHAPTERS } from './story';

export type AchievementId =
  | 'first_day'
  | 'served_100'
  | 'served_1000'
  | 'revenue_10k'
  | 'revenue_100k'
  | 'debt_free'
  | 'thief_10'
  | 'clean_50'
  | 'combo_5'
  | 'combo_10'
  | 'perfect_day'
  | 'perfect_7'
  | 'expand'
  | 'supermarket'
  | 'staff'
  | 'rating_5'
  | 'album'
  | 'story';

export type Tier = 'bronze' | 'silver' | 'gold';

/** Что видно сейчас: состояние и счётчики за всю игру вместе с сегодняшним днём. */
export interface Progress {
  state: StoreState;
  life: Lifetime & { revenue: number };
}

export interface Achievement {
  id: AchievementId;
  tier: Tier;
  /** Сколько сделано и сколько нужно. */
  progress: (p: Progress) => [number, number];
}

const count = (value: number, goal: number): [number, number] => [Math.min(value, goal), goal];
const flag = (done: boolean): [number, number] => [done ? 1 : 0, 1];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_day', tier: 'bronze', progress: ({ state }) => flag(state.day > 1) },
  { id: 'served_100', tier: 'bronze', progress: ({ life }) => count(life.served, 100) },
  { id: 'served_1000', tier: 'gold', progress: ({ life }) => count(life.served, 1000) },
  { id: 'revenue_10k', tier: 'silver', progress: ({ life }) => count(life.revenue, 10000) },
  { id: 'revenue_100k', tier: 'gold', progress: ({ life }) => count(life.revenue, 100000) },
  { id: 'debt_free', tier: 'silver', progress: ({ state }) => flag(state.debt === 0) },
  { id: 'thief_10', tier: 'silver', progress: ({ life }) => count(life.caught, 10) },
  { id: 'clean_50', tier: 'bronze', progress: ({ life }) => count(life.trashCleaned, 50) },
  { id: 'combo_5', tier: 'bronze', progress: ({ life }) => count(life.bestCombo, 5) },
  { id: 'combo_10', tier: 'gold', progress: ({ life }) => count(life.bestCombo, 10) },
  { id: 'perfect_day', tier: 'bronze', progress: ({ life }) => count(life.cleanDays, 1) },
  { id: 'perfect_7', tier: 'gold', progress: ({ life }) => count(life.cleanDays, 7) },
  { id: 'expand', tier: 'bronze', progress: ({ state }) => flag(state.level >= 1) },
  { id: 'supermarket', tier: 'gold', progress: ({ state }) => flag(state.level >= 4) },
  { id: 'staff', tier: 'bronze', progress: ({ state }) => flag(state.staff.length > 0) },
  { id: 'rating_5', tier: 'gold', progress: ({ state }) => flag(state.rating >= 4.95) },
  { id: 'album', tier: 'gold', progress: ({ state }) => count(state.album.length, RARE_GUESTS.length) },
  { id: 'story', tier: 'gold', progress: ({ state }) => count(state.story.chapter, CHAPTERS.length) },
];

export const achievementName = (id: AchievementId): TextKey => `ach.${id}` as TextKey;
export const achievementDesc = (id: AchievementId): TextKey => `ach.${id}.desc` as TextKey;

/** Счётчики с учётом сегодняшнего дня (пока он идёт). */
export function liveProgress(state: StoreState, today?: DayStats): Progress {
  const life = state.lifetime ?? newLifetime();
  return {
    state,
    life: {
      served: life.served + (today?.served ?? 0),
      caught: life.caught + (today?.caught ?? 0),
      trashCleaned: life.trashCleaned + (today?.trashCleaned ?? 0),
      bestCombo: Math.max(life.bestCombo, today?.bestCombo ?? 0),
      cleanDays: life.cleanDays,
      revenue: state.totalRevenue + (today?.revenue ?? 0),
    },
  };
}

/** Конец дня: сегодняшнее переходит в счётчики за всю игру. */
export function recordDay(state: StoreState, stats: DayStats): StoreState {
  const life = state.lifetime ?? newLifetime();
  return {
    ...state,
    lifetime: {
      served: life.served + stats.served,
      caught: life.caught + stats.caught,
      trashCleaned: life.trashCleaned + stats.trashCleaned,
      bestCombo: Math.max(life.bestCombo, stats.bestCombo),
      cleanDays: life.cleanDays + (stats.complaints === 0 && stats.served >= 10 ? 1 : 0),
    },
  };
}

export const isDone = (a: Achievement, p: Progress): boolean => {
  const [value, goal] = a.progress(p);
  return value >= goal;
};

/** Открывает всё, что уже выполнено. Возвращает новое состояние и что открылось сейчас. */
export function unlockAchievements(p: Progress): { state: StoreState; unlocked: AchievementId[] } {
  const have = new Set(p.state.achievements ?? []);
  const unlocked = ACHIEVEMENTS.filter((a) => !have.has(a.id) && isDone(a, p)).map((a) => a.id);
  if (!unlocked.length) return { state: p.state, unlocked };
  return { state: { ...p.state, achievements: [...have, ...unlocked] }, unlocked };
}
