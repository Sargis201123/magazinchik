// Район (10.11, третий обход): правила на стороне игры для того, что связывает игроков без друзей, —
// общая цель недели, «Магазин дня» с отметкой «Был тут» и флажки над улицей после общей победы.
// Сервер — api/_lib/town.ts (считает выручку района и хранит отметки), награды выдаёт игра, как в турнире.

import type { StoreState } from './economy';
import { homeLevel } from './zarshop';

const DAY = 24 * 3600_000;

/** Цель недели: столько на район и ещё столько за каждый магазин, торговавший на этой неделе. */
export const GOAL_BASE = 200_000;
export const GOAL_PER_SHOP = 15_000;
/** Какую долю базы к концу недели приносят «соседи» — придуманные магазины района (как соседи лиги). */
export const GOAL_NEIGHBOURS = 0.85;

/** Вклад соседей к доле недели frac (0…1): растёт почти ровно, округлён до сотни. */
export const goalNeighbours = (frac: number): number => Math.round((GOAL_BASE * GOAL_NEIGHBOURS * Math.pow(Math.max(0, Math.min(1, frac)), 0.9)) / 100) * 100;

/** Номер недели (с понедельника, UTC) — как на сервере (api/_lib/week.ts). */
export const weekOf = (now: number): number => Math.floor((now / DAY + 3) / 7);

export interface TownState {
  /** За какую неделю награда общей цели уже забрана. */
  goal?: number;
  /** Неделя последней общей победы: флажки над улицей висят до конца следующей недели. */
  won?: number;
}

/** Награда за общую цель: растёт с помещением. */
export const goalReward = (level: number): number => 300 + 200 * level;

/** Забрать награду за цель недели week. null — уже забрана. */
export function claimGoal(state: StoreState, week: number): { state: StoreState; money: number } | null {
  if ((state.town?.goal ?? 0) >= week) return null;
  const money = goalReward(homeLevel(state));
  return { state: { ...state, money: state.money + money, town: { ...state.town, goal: week, won: Math.max(week, state.town?.won ?? 0) } }, money };
}

/** Флажки над улицей: неделя победы и следующая. */
export const townFlags = (state: StoreState, now: number): boolean => state.town?.won !== undefined && weekOf(now) <= state.town.won + 1;

/** Гости района, которые оставили отметку в твоём магазине, оставили и чаевые: за каждого — немного, не больше десяти гостей за раз. */
export const LIKES_MAX = 10;
export const likeTip = (level: number): number => 10 + 5 * level;
export function takeLikes(state: StoreState, n: number): { state: StoreState; money: number } | null {
  const count = Math.max(0, Math.min(LIKES_MAX, Math.floor(n)));
  if (!count) return null;
  const money = count * likeTip(homeLevel(state));
  return { state: { ...state, money: state.money + money }, money };
}
