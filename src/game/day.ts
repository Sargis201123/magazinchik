// Смена дня целиком: заказ забирают, холодильники греются, товар портится, счета,
// сюжетные счётчики и план на завтра. Этим пользуются и игра, и симулятор.

import { burglaryNight } from './watch';
import { contestGuests, contestNight } from './contest';
import { lightsGuests } from './gear';
import { addReport } from './reports';
import { departmentGuests, endDay, priceAppeal, restStaff, staffOf, expectedGuests, spawnInterval, type DayStats, type NightResult, type StoreState } from './economy';
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
import { afterBills } from './bankruptcy';
import { cafeMorning } from './cafe';
import { giantGuests, giantNight } from './giant';
import { promoGuests } from './promo';
import { fairGuests } from './fair';
import { ensureWeekly, progressWeekly, type Challenge } from './weekly';
import { hiddenBigDayGuests, knownBigDayGuests } from './bigday';
import { coffeeTablesGuests } from './coffee';
import { legacyGuests } from './legacy';
import { taleGuests, talesMorning } from './tales';
import { addPassXp } from './pass';
import { rushGuests } from './rush';
import { spoilDishes } from './kitchen';
import { staffMorning } from './staffEvents';
import { districtGuests } from './district';
import { trickGuests, trickNight, tricksMorning } from './tricks';
import { nightBoostGuests, nightMorning } from './nightGuests';
import { laneGuests } from './lanes';
import { branchNight, branchReport } from './branch';

export interface NightSummary extends NightResult {
  order: Omit<OrderResult, 'state'> | null;
  quests: { earned: number; done: number; total: number };
  /** Испытания недели, выполненные сегодня. */
  weekly: { completed: Challenge[]; earned: number };
  /** Чистый доход филиала за день (branch.ts; 0 — филиала нет). */
  branch: number;
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
  s = addPassXp(s, rewarded.done, weekly.completed.length);
  // Непроданное с кухни ночью списывается (сколько — в отчёт дня).
  const dishes = spoilDishes(s);
  s = dishes.state;
  // Усталость считаем до смены плана: сегодняшний отгул обнуляет её, ночная смена — удваивает.
  s = restStaff(s, (stats.nightRevenue ?? 0) > 0);
  // «Проверяющий» от конкурента: штраф, ушёл ни с чем или разоблачили (tricks.ts).
  s = trickNight(s, random, Boolean(staffOf(s, 'cleaner')));
  const day = s.day;
  // Филиал отдаёт доход за день до счетов: им можно расплатиться.
  const branch = branchNight(s, day);
  s = branch.state;
  const ended = endDay(s, stats, random);
  // После счетов — проверка долга: предупреждение, бабушка или банкротство.
  const night = ended.bill ? { ...ended, state: afterBills(ended.state) } : ended;
  // Строка в отчёт недели: что продали, что испортилось, где дорого, чего не хватило.
  const next = branchReport(contestNight(burglaryNight(giantNight(nightMorning(tricksMorning(staffMorning(talesMorning(cafeMorning(ensurePlan(growEduard(endWar(addReport(night.state, day, stats, night.spoiledBy, dishes.spoiled)))), random), random), random), random), random), stats.revenue), stats.revenue, random), stats), day, branch.income);
  return {
    ...night,
    state: next,
    order: order && { delivered: order.delivered, earned: order.earned },
    quests: { earned: rewarded.earned, done: rewarded.done, total: quests.length },
    weekly: { completed: weekly.completed, earned: weekly.earned },
    branch: branch.income,
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

/** Множитель гостей сегодня: сюжет (конкурент), сезон, звание магазина, реклама, погода, цены, Эдуард и открытые кассы. */
export const guestFactor = (state: StoreState): number =>
  storyGuests(state) *
  legacyGuests(state) *
  taleGuests(state) *
  rushGuests(state) *
  priceAppeal(state) *
  coffeeTablesGuests(state) *
  (seasonFor(state.day)?.guests ?? 1) *
  rankGuests(state) *
  adBoost(state) *
  WEATHER_EFFECTS[weatherFor(state.day)].guests *
  promoGuests(state) *
  fairGuests(state.day) *
  lightsGuests(state) *
  departmentGuests(state) *
  eduardGuests(state) *
  districtGuests(state) *
  trickGuests(state) *
  nightBoostGuests(state) *
  giantGuests(state) *
  contestGuests(state) *
  laneGuests(state) *
  knownBigDayGuests(state.day);

/**
 * Секунд между гостями сегодня: рейтинг, помещение, сюжет, сезон и звание. Особый день
 * (bigday.ts), о котором утром ещё не знают, — только здесь: в прогноз гостей он не входит.
 */
export const spawnIntervalToday = (state: StoreState): number =>
  spawnInterval(state.rating, state.level) / guestFactor(state) / hiddenBigDayGuests(state.day);

/** Сколько гостей придёт на самом деле — с особым днём (для симулятора). */
export const actualGuestsToday = (state: StoreState): number => Math.round(guestsToday(state) * hiddenBigDayGuests(state.day));

export const guestsToday = (state: StoreState): number => Math.round(expectedGuests(state.rating, state.level) * guestFactor(state));

/** Сколько гостей в день прибавится, если магазин станет таким (after — с новой кассой или киоском): для «Развития». */
export const guestsGain = (state: StoreState, after: StoreState): number => Math.max(0, guestsToday(after) - guestsToday(state));
