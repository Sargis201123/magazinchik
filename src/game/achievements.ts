// Книга достижений: пиксельные значки за вехи игры. Награды нет — только гордость и коллекция.
// Счётчики «за всю игру» копятся в конце каждого дня; днём к ним прибавляется сегодняшнее.

import type { TextKey } from '../i18n/ru';
import { newLifetime, type DayStats, type Lifetime, type StoreState } from './economy';
import { RARE_GUESTS } from './endless';
import { CHAPTERS } from './story';
import { registerCount } from './registers';
import { gearMaxed, gearUpgrades } from './gear';

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
  | 'story'
  | 'burnt_bread'
  | 'coffee_100'
  | 'cat_mascot'
  | 'night_owl'
  | 'two_registers'
  | 'courier_20'
  | 'mouse_5'
  | 'war_answer'
  | 'fair_3'
  | 'gear_first'
  | 'gear_10'
  | 'gear_all'
  | 'registers_4';

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
  { id: 'burnt_bread', tier: 'bronze', progress: ({ life }) => count(life.burnt ?? 0, 1) },
  { id: 'coffee_100', tier: 'silver', progress: ({ life }) => count(life.coffees ?? 0, 100) },
  { id: 'cat_mascot', tier: 'silver', progress: ({ state }) => flag(Boolean(state.cat?.beds.includes('house'))) },
  { id: 'night_owl', tier: 'silver', progress: ({ life }) => count(life.nights ?? 0, 5) },
  { id: 'two_registers', tier: 'bronze', progress: ({ state }) => flag(registerCount(state) >= 2) },
  { id: 'registers_4', tier: 'silver', progress: ({ state }) => count(registerCount(state), 4) },
  { id: 'courier_20', tier: 'silver', progress: ({ life }) => count(life.deliveries ?? 0, 20) },
  { id: 'mouse_5', tier: 'bronze', progress: ({ life }) => count(life.mice ?? 0, 5) },
  { id: 'war_answer', tier: 'bronze', progress: ({ life }) => count(life.wars ?? 0, 1) },
  { id: 'fair_3', tier: 'bronze', progress: ({ life }) => count(life.fairs ?? 0, 3) },
  // Оборудование: первая новая модель, десять улучшений и всё лучших моделей.
  { id: 'gear_first', tier: 'bronze', progress: ({ state }) => count(gearUpgrades(state), 1) },
  { id: 'gear_10', tier: 'silver', progress: ({ state }) => count(gearUpgrades(state), 10) },
  { id: 'gear_all', tier: 'gold', progress: ({ state }) => flag(gearMaxed(state)) },
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
      coffees: (life.coffees ?? 0) + (today?.coffees ?? 0),
      burnt: (life.burnt ?? 0) + (today?.burnt ?? 0),
      nights: life.nights ?? 0,
      deliveries: (life.deliveries ?? 0) + (today?.deliveries ?? 0),
      mice: (life.mice ?? 0) + (today?.mice ?? 0),
      fairs: life.fairs ?? 0,
      wars: life.wars ?? 0,
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
      coffees: (life.coffees ?? 0) + (stats.coffees ?? 0),
      burnt: (life.burnt ?? 0) + (stats.burnt ?? 0),
      nights: (life.nights ?? 0) + (stats.nightRevenue !== undefined ? 1 : 0),
      deliveries: (life.deliveries ?? 0) + (stats.deliveries ?? 0),
      mice: (life.mice ?? 0) + (stats.mice ?? 0),
      fairs: (life.fairs ?? 0) + (stats.fair ? 1 : 0),
      wars: life.wars ?? 0,
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
