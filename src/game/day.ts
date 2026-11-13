// Смена дня целиком: заказ забирают, холодильники греются, товар портится, счета,
// сюжетные счётчики и план на завтра. Этим пользуются и игра, и симулятор.

import { dogNight, dogGuests } from './watch';
import { contestGuests, contestNight } from './contest';
import { lightsGuests } from './gear';
import { addReport } from './reports';
import { departmentGuests, endDay, onShift, priceAppeal, restStaff, staffOf, expectedGuests, spawnInterval, type DayStats, type NightResult, type StoreState } from './economy';
import {
  applyInspection,
  fulfillOrder,
  planDay,
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
import { fairGuests } from './fair';
import { weekGoal, weekGuests, weekNight, type WeekNight } from './weeks';
import { ensureWeekly, progressWeekly, type Challenge } from './weekly';
import { hiddenBigDayGuests, knownBigDayGuests } from './bigday';
import { coffeeTablesGuests } from './coffee';
import { legacyGuests } from './legacy';
import { taleGuests, talesMorning } from './tales';
import { skitGuests } from './skits';
import { caseGuests, caseMorning } from './cases';
import { echoGuests } from './echoes';
import { arcGuests, arcsMorning } from './arcs';
import { addPassXp } from './pass';
import { rushGuests } from './rush';
import { spoilDishes } from './kitchen';
import { staffMorning } from './staffEvents';
import { careerMorning, careerNight } from './career';
import { districtGuests } from './district';
import { hoodGuests } from './hood';
import { tenantGuests, tenantsNight } from './tenants';
import { dreamGuests, dreamsNight } from './dreams';
import { tallyNight, type StaffRecord } from './staffStats';
import { trickGuests, trickNight, tricksMorning } from './tricks';
import { nightBoostGuests, nightMorning } from './nightGuests';
import { laneGuests } from './lanes';
import { momentCount, momentRating } from './moments';
import { branchNight, branchReport } from './branch';
import { makeLines, type LinesNight } from './lines';
import { licenseGuests, licenseNight } from './license';
import { countZarDay, inZar, zarBossMorning, zarDuelNight, zarGuests, zarHomeNight, zarReport } from './zarechye';
import { pawnMorning } from './pawnshop';

export interface NightSummary extends NightResult {
  order: Omit<OrderResult, 'state'> | null;
  quests: { earned: number; done: number; total: number };
  /** Испытания недели, выполненные сегодня. */
  weekly: { completed: Challenge[]; earned: number };
  /** Чистый доход филиала за день (branch.ts; 0 — филиала нет). */
  branch: number;
  /** Аренда от арендаторов флигеля за день (tenants.ts). */
  rent: number;
  /** Доля с Костиной тележки у входа за день (dreams.ts; 0 — тележки нет). */
  cart: number;
  /** Сколько принёс Центр без игрока, пока он работал в Заречье (zarechye.ts; 0 — был в Центре). */
  home: number;
  /** Пройденный сегодня шаг сезонной недели (weeks.ts) или null. */
  week: WeekNight | null;
  /** Что наделали за ночь линейки своей марки (lines.ts). */
  lines: LinesNight;
  /** Кто из персонала побил свой рекорд за смену (staffStats.ts). */
  staffRecords: StaffRecord[];
}

export function nightCycle(state: StoreState, stats: DayStats, random: () => number = Math.random): NightSummary {
  let s = state;
  const order = fulfillOrder(s);
  if (order) {
    s = order.state;
    if (order.delivered) s = { ...s, story: { ...s.story, ordersDone: s.story.ordersDone + 1 } };
  }
  const quests = s.plan?.quests ?? [];
  const rewarded = rewardQuests(s, quests, stats);
  s = rewarded.state;
  // Искорки активных моментов дня — к рейтингу (moments.ts), понемногу.
  const sparkle = momentRating(stats);
  if (sparkle) s = { ...s, rating: Math.min(5, s.rating + sparkle) };
  const weekly = progressWeekly(s, stats);
  s = weekly.state;
  // Шаг сезонной недели (weeks.ts): цель — утренняя, из плана дня.
  const week = weekNight(s, stats, s.plan?.week !== undefined ? s.plan.week : weekGoal(s, guestsToday(s)));
  s = week.state;
  s = addPassXp(s, rewarded.done, weekly.completed.length);
  // Непроданное с кухни ночью списывается (сколько — в отчёт дня).
  const dishes = spoilDishes(s);
  s = dishes.state;
  // Карьера: смены и сделанное за день (career.ts); воодушевление тает на день.
  s = careerNight(s, stats.work);
  // Статистика персонала (staffStats.ts): дела, рекорды, шаги.
  const tally = tallyNight(s, stats.deeds, stats.walked);
  s = tally.state;
  s = restStaff(s);
  // «Проверяющий» от конкурента: штраф, ушёл ни с чем или разоблачили (tricks.ts).
  s = trickNight(s, random, Boolean(staffOf(s, 'cleaner')));
  // Проверка лицензии на пиво и сигареты (license.ts): иногда вечером; нашла продажу подростку — штраф до счетов.
  s = licenseNight(s);
  const day = s.day;
  // Филиал отдаёт доход за день до счетов: им можно расплатиться.
  const branch = branchNight(s, day);
  s = branch.state;
  // Арендаторы флигеля платят за день — тоже до счетов (tenants.ts).
  const rent = tenantsNight(s);
  s = rent.state;
  // Сбывшаяся мечта Кости: тележка у входа, доля с неё — тоже до счетов (dreams.ts).
  const cart = dreamsNight(s);
  s = cart.state;
  // Игрок в Заречье — гипермаркет в Центре торговал сам и тоже отдаёт доход до счетов (zarechye.ts).
  const home = zarHomeNight(s, day);
  s = home.state;
  // «Рыбный день» с Сомом: сколько рыбы продали.
  s = zarDuelNight(s, stats.sold.fish ?? 0);
  // Повар сегодня работал — ночью лепит пельмени (после смены дня план уже завтрашний).
  const lineCtx = { day, cook: onShift(s, 'cook') };
  const ended = endDay(s, stats);
  // После счетов — проверка долга: предупреждение, бабушка или банкротство.
  const billed = ended.bill ? { ...ended, state: afterBills(ended.state) } : ended;
  // День засчитан магазину, где работали (счета двух магазинов — по дням); после счетов — с нуля.
  billed.state = countZarDay(billed.state, ended.bill !== null);
  // Своя марка: после закрытия и счетов (деньги на них — первыми) варят варенье, солят, лепят пельмени,
  // ставят квас — из того, что осталось на складе и полках.
  const lines = makeLines(billed.state, lineCtx);
  const night = { ...billed, state: lines.state };
  // Строка в отчёт недели: что продали, что испортилось, где дорого, чего не хватило.
  // Ломбард (pawnshop.ts): уже утро — выкупили, не пришли, полиция за краденым, продажи с полки «Разное».
  // Дело недели (cases.ts): несданное — в архив, пропущенные улики — размытыми, в понедельник — новое.
  const next = caseMorning(pawnMorning(zarReport(zarBossMorning(branchReport(contestNight(dogNight(giantNight(nightMorning(tricksMorning(careerMorning(staffMorning(arcsMorning(talesMorning(cafeMorning(ensurePlan(growEduard(endWar(addReport(night.state, day, stats, night.spoiledBy, dishes.spoiled)))), random), random)), random)), random), random), stats.revenue)), stats), day, branch.income)), day, home.income)));
  return {
    ...night,
    state: next,
    order: order && { delivered: order.delivered, earned: order.earned },
    quests: { earned: rewarded.earned, done: rewarded.done, total: quests.length },
    weekly: { completed: weekly.completed, earned: weekly.earned },
    branch: branch.income,
    rent: rent.income,
    cart: cart.income,
    home: home.income,
    week: week.done,
    lines: lines.night,
    staffRecords: tally.records,
  };
}

/** План на текущий день (если его ещё нет — например, в начале игры). */
export function ensurePlan(state: StoreState): StoreState {
  const weekly = ensureWeekly(state, guestsToday(state));
  if (weekly.plan?.day === weekly.day && weekly.plan.quests) return weekly;
  const plan = planDay(weekly, storyChances(weekly));
  return { ...weekly, plan: { ...plan, quests: questsFor(weekly, guestsToday(weekly), momentCount(weekly)), week: weekGoal(weekly, guestsToday(weekly)) } };
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
  skitGuests(state) *
  homeOnly(state, echoGuests) *
  homeOnly(state, arcGuests) *
  rushGuests(state) *
  priceAppeal(state) *
  coffeeTablesGuests(state) *
  (seasonFor(state.day)?.guests ?? 1) *
  rankGuests(state) *
  adBoost(state) *
  WEATHER_EFFECTS[weatherFor(state.day)].guests *
  fairGuests(state.day) *
  weekGuests(state.day) *
  lightsGuests(state) *
  departmentGuests(state) *
  homeOnly(state, eduardGuests) *
  homeOnly(state, districtGuests) *
  homeOnly(state, hoodGuests) *
  homeOnly(state, tenantGuests) *
  homeOnly(state, dreamGuests) *
  homeOnly(state, dogGuests) *
  homeOnly(state, trickGuests) *
  // Вечерние гости за пивом и сигаретами (license.ts): лицензия — у магазина в Центре.
  homeOnly(state, licenseGuests) *
  nightBoostGuests(state) *
  homeOnly(state, giantGuests) *
  homeOnly(state, contestGuests) *
  homeOnly(state, caseGuests) *
  laneGuests(state) *
  knownBigDayGuests(state.day) *
  zarGuests(state);

/**
 * Гости, которые бывают только в Центре: его район и соседи (здания района, благоустройство, Эдуард,
 * «Гигант», конкурс, проделки конкурента, хроники района). В Заречье вместо них — свой район (zarGuests).
 */
const homeOnly = (state: StoreState, factor: (state: StoreState) => number): number => (inZar(state) ? 1 : factor(state));

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
