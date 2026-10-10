// Смена дня целиком: заказ забирают, холодильники греются, товар портится, счета,
// сюжетные счётчики и план на завтра. Этим пользуются и игра, и симулятор.

import { lightsGuests } from './gear';
import { addReport } from './reports';
import { departmentGuests, endDay, restStaff, expectedGuests, spawnInterval, type DayStats, type NightResult, type StoreState } from './economy';
import {
  applyInspection,
  fulfillOrder,
  planDay,
  warmBrokenFridges,
  type InspectionResult,
  type OrderResult,
} from './events';
import { storyChances, storyGuests } from './story';
import { questsFor, rankGuests, rewardQuests, seasonFor } from './endless';
import { adBoost } from './ads';
import { WEATHER_EFFECTS, weatherFor } from './weather';
import { endWar } from './war';
import { eduardGuests, growEduard } from './eduard';
import { promoGuests } from './promo';
import { fairGuests } from './fair';
import { ensureWeekly, progressWeekly, type Challenge } from './weekly';

export interface NightSummary extends NightResult {
  order: Omit<OrderResult, 'state'> | null;
  quests: { earned: number; done: number; total: number };
  /** Испытания недели, выполненные сегодня. */
  weekly: { completed: Challenge[]; earned: number };
}

export function nightCycle(state: StoreState, stats: DayStats, random: () => number = Math.random): NightSummary {
  let s = warmBrokenFridges(state);
  const order = fulfillOrder(s);
  if (order) {
    s = order.state;
    if (order.delivered) s = { ...s, story: { ...s.story, ordersDone: s.story.ordersDone + 1 } };
  }
  const quests = s.plan?.quests ?? [];
  const rewarded = rewardQuests(s, quests, stats);
  s = rewarded.state;
  const weekly = progressWeekly(s, stats);
  s = weekly.state;
  // Усталость считаем до смены плана: сегодняшний отгул обнуляет её.
  s = restStaff(s);
  const day = s.day;
  const night = endDay(s, stats, random);
  // Строка в отчёт недели: что продали, что испортилось, где дорого, чего не хватило.
  const next = ensurePlan(growEduard(endWar(addReport(night.state, day, stats, night.spoiledBy))));
  return {
    ...night,
    state: next,
    order: order && { delivered: order.delivered, earned: order.earned },
    quests: { earned: rewarded.earned, done: rewarded.done, total: quests.length },
    weekly: { completed: weekly.completed, earned: weekly.earned },
  };
}

/** План на текущий день (если его ещё нет — например, в начале игры). */
export function ensurePlan(state: StoreState): StoreState {
  const weekly = ensureWeekly(state, guestsToday(state));
  if (weekly.plan?.day === weekly.day && weekly.plan.quests) return weekly;
  const plan = planDay(weekly, storyChances(weekly));
  return { ...weekly, plan: { ...plan, quests: questsFor(weekly, guestsToday(weekly)) } };
}

/** Итог проверки: штраф/рейтинг и счётчик для сюжета. */
export function inspectionDone(state: StoreState, result: InspectionResult): StoreState {
  const s = applyInspection(state, result);
  if (!result.passed) return s;
  return { ...s, story: { ...s.story, inspectionsPassed: s.story.inspectionsPassed + 1 } };
}

/** Множитель гостей сегодня: сюжет (конкурент), сезон, звание магазина, реклама, погода и Эдуард. */
export const guestFactor = (state: StoreState): number =>
  storyGuests(state) *
  (seasonFor(state.day)?.guests ?? 1) *
  rankGuests(state) *
  adBoost(state) *
  WEATHER_EFFECTS[weatherFor(state.day)].guests *
  promoGuests(state) *
  fairGuests(state.day) *
  lightsGuests(state) *
  departmentGuests(state) *
  eduardGuests(state);

/** Секунд между гостями сегодня: рейтинг, помещение, сюжет, сезон и звание. */
export const spawnIntervalToday = (state: StoreState): number => spawnInterval(state.rating, state.level) / guestFactor(state);

export const guestsToday = (state: StoreState): number => Math.round(expectedGuests(state.rating, state.level) * guestFactor(state));
