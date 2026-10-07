// Смена дня целиком: заказ забирают, холодильники греются, товар портится, счета,
// сюжетные счётчики и план на завтра. Этим пользуются и игра, и симулятор.

import { endDay, expectedGuests, spawnInterval, type DayStats, type NightResult, type StoreState } from './economy';
import {
  applyInspection,
  fulfillOrder,
  planDay,
  warmBrokenFridges,
  type InspectionResult,
  type OrderResult,
} from './events';
import { storyChances, storyGuests } from './story';

export interface NightSummary extends NightResult {
  order: Omit<OrderResult, 'state'> | null;
}

export function nightCycle(state: StoreState, stats: DayStats, random: () => number = Math.random): NightSummary {
  let s = warmBrokenFridges(state);
  const order = fulfillOrder(s);
  if (order) {
    s = order.state;
    if (order.delivered) s = { ...s, story: { ...s.story, ordersDone: s.story.ordersDone + 1 } };
  }
  const night = endDay(s, stats, random);
  const next = ensurePlan(night.state);
  return { ...night, state: next, order: order && { delivered: order.delivered, earned: order.earned } };
}

/** План на текущий день (если его ещё нет — например, в начале игры). */
export function ensurePlan(state: StoreState): StoreState {
  if (state.plan?.day === state.day) return state;
  return { ...state, plan: planDay(state, storyChances(state)) };
}

/** Итог проверки: штраф/рейтинг и счётчик для сюжета. */
export function inspectionDone(state: StoreState, result: InspectionResult): StoreState {
  const s = applyInspection(state, result);
  if (!result.passed) return s;
  return { ...s, story: { ...s.story, inspectionsPassed: s.story.inspectionsPassed + 1 } };
}

/** Секунд между гостями сегодня: рейтинг, помещение и сюжет (конкурент уводит часть гостей). */
export const spawnIntervalToday = (state: StoreState): number => spawnInterval(state.rating, state.level) / storyGuests(state);

export const guestsToday = (state: StoreState): number => Math.round(expectedGuests(state.rating, state.level) * storyGuests(state));
