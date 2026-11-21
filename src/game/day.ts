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
import { WEATHER_EFFECTS } from './weather';
import { crisisGuests, crisisMorning, crisisNight, weatherToday } from './crisis';
import { goodwillGuests } from './goodwill';
import { racketGuests, racketMorning } from './racket';
import { residentsGuests, residentsMorning } from './residents';
import { gentGuests, gentMorning } from './gentrify';
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
import { districtNight } from './districtPlots';
import { hoodGuests } from './hood';
import { tenantGuests, tenantsNight } from './tenants';
import { estateGuests, estateMorning, estateNight } from './estate';
import { settleVan, type VanResult } from './van';
import { rentalNight, type RentalDay } from './rental';
import { basementGuests, basementNight, type SlotsDay } from './basement';
import { clothesNight, type ClothesDay } from './clothes';
import { foodcourtGuests, foodcourtNight, type FoodDay } from './foodcourt';
import { dreamGuests, dreamsNight } from './dreams';
import { lotteryGuests, lotteryNight } from './lottery';
import { tallyNight, type StaffRecord } from './staffStats';
import { managerNight } from './managerLog';
import { apprGuests, apprNight } from './apprentice';
import { trickGuests, trickNight, tricksMorning } from './tricks';
import { nightBoostGuests, nightMorning } from './nightGuests';
import { laneGuests } from './lanes';
import { momentCount, momentRating } from './moments';
import { branchNight, branchReport } from './branch';
import { makeLines, type LinesNight } from './lines';
import { licenseGuests, licenseNight } from './license';
import { countZarDay, inZar, zarBossMorning, zarDuelNight, zarGuests, zarHomeNight, zarReport } from './zarechye';
import { pawnMorning } from './pawnshop';
import { greyGuests, greyNight } from './grey';

export interface NightSummary extends NightResult {
  order: Omit<OrderResult, 'state'> | null;
  quests: { earned: number; done: number; total: number };
  /** Испытания недели, выполненные сегодня. */
  weekly: { completed: Challenge[]; earned: number };
  /** Чистый доход филиала за день (branch.ts; 0 — филиала нет). */
  branch: number;
  /** Аренда от арендаторов флигеля за день (tenants.ts). */
  rent: number;
  /** Аренда с лавок скупленной улицы за день (estate.ts; 0 — никого). */
  estate: number;
  /** Итог выезда фургона (van.ts) или null — сегодня не выезжал. */
  van: VanResult | null;
  /** Прокат у входа за день (rental.ts): сколько взяли и не вернули, сколько денег; null — стойки нет или закрыта. */
  rental: RentalDay | null;
  /** Вечер у автоматов в подвале (basement.ts): доход, доля «крыши», облава; null — автоматов нет. */
  slots: SlotsDay | null;
  /** Вечер на втором этаже (clothes.ts): сколько вещей продали и с распродажи, деньги, плата продавцу; null — пусто. */
  clothes: ClothesDay | null;
  /** Вечер на фудкорте третьего этажа (foodcourt.ts): едоки и деньги; null — точек нет. */
  food: FoodDay | null;
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
  // Беда района: вечером район смотрит на ценники — нажился, держал цены или раздавал (crisis.ts).
  let s = crisisNight(state, stats);
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
  // Что сделал менеджер зала — в его карточку: вчера и за всё время (managerLog.ts, 15.11).
  s = managerNight(s, stats.mgr, stats.served);
  s = restStaff(s);
  // Ученик (apprentice.ts): стипендия, доверие, навык; отучился сезон — уходит открывать свою лавку.
  s = apprNight(s, stats.appr);
  // «Проверяющий» от конкурента: штраф, ушёл ни с чем или разоблачили (tricks.ts).
  s = trickNight(s, random, Boolean(staffOf(s, 'cleaner')));
  // Проверка лицензии на пиво и сигареты (license.ts): иногда вечером; нашла продажу подростку — штраф до счетов.
  s = licenseNight(s);
  // Серая схема (grey.ts): пришёл день сделки, на которой попался, — штраф до счетов, наутро магазин опечатан.
  s = greyNight(s);
  const day = s.day;
  // Филиал отдаёт доход за день до счетов: им можно расплатиться.
  const branch = branchNight(s, day);
  s = branch.state;
  // Арендаторы флигеля платят за день — тоже до счетов (tenants.ts).
  const rent = tenantsNight(s);
  s = rent.state;
  // Лавки скупленной улицы — тоже до счетов; бар иногда шумит (estate.ts).
  const estate = estateNight(s);
  s = estate.state;
  // Фургон вернулся с выезда (van.ts): выручка — до счетов, остаток — на склад до ночи (там он и стареет).
  const van = settleVan(s);
  s = van.state;
  // Прокат у входа — тоже до счетов (rental.ts). Прохожие — гости дня по утреннему состоянию: как в прогнозе утра.
  const rental = rentalNight(s, guestsToday(state));
  s = rental.state;
  // Автоматы в подвале (basement.ts): доход и доля «крыши» — до счетов; облава приходит к закрытию.
  const slots = basementNight(s);
  s = slots.state;
  // Второй этаж — одежда (clothes.ts): наверх поднимается часть гостей дня (по утреннему состоянию, как прокат).
  const clothes = clothesNight(s, guestsToday(state));
  s = clothes.state;
  // Фудкорт (foodcourt.ts): аренда точек и выручка своих — тоже до счетов.
  const food = foodcourtNight(s);
  s = food.state;
  // Сбывшаяся мечта Кости: тележка у входа, доля с неё — тоже до счетов (dreams.ts).
  const cart = dreamsNight(s);
  s = cart.state;
  // Вечерний тираж и решения города о лотереях (lottery.ts): премия за счастливый билет — тоже до счетов.
  s = lotteryNight(s);
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
  // Утро: доброе имя понемногу забывается, беда подводит итог или начинается новая (crisis.ts).
  // Район (districtPlots.ts, 13.11): завтра на участке начинают стройку — что строить, решает отчёт с сегодняшней строкой.
  // «Крыша» (racket.ts) — после утра дел: видит, чем кончилось дело в полиции, и не приходит в первое утро беды.
  // Жители района (residents.ts): в свой день район решает, въезжает ли кто-то или съезжает — по утреннему доброму имени.
  // Район дорожает (gentrify.ts): престиж на шаг к заслуженному; при высоком кто-то из старых может уехать от цен —
  // после жителей, чтобы в один день не было двух переездов.
  // Скупленная улица (estate.ts): кто открылся сегодня впервые — от того семьи въезжают или съезжают (после решения района).
  const next = estateMorning(gentMorning(residentsMorning(racketMorning(crisisMorning(caseMorning(pawnMorning(zarReport(zarBossMorning(branchReport(contestNight(dogNight(giantNight(nightMorning(tricksMorning(careerMorning(staffMorning(arcsMorning(talesMorning(cafeMorning(ensurePlan(growEduard(endWar(districtNight(addReport(night.state, day, stats, night.spoiledBy, dishes.spoiled))))), random), random)), random)), random), random), stats.revenue)), stats), day, branch.income)), day, home.income))))))));
  return {
    ...night,
    state: next,
    order: order && { delivered: order.delivered, earned: order.earned },
    quests: { earned: rewarded.earned, done: rewarded.done, total: quests.length },
    weekly: { completed: weekly.completed, earned: weekly.earned },
    branch: branch.income,
    rent: rent.income,
    estate: estate.income,
    van: van.result,
    rental: rental.day,
    slots: slots.day,
    clothes: clothes.day,
    food: food.day,
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
  WEATHER_EFFECTS[weatherToday(state)].guests *
  homeOnly(state, crisisGuests) *
  // Доброе имя района (goodwill.ts): помнят, как магазин вёл себя в беду.
  homeOnly(state, goodwillGuests) *
  // Мусор у входа от «крыши» (racket.ts): гости обходят.
  homeOnly(state, racketGuests) *
  // Жители района (residents.ts): семей в домах вдоль улицы больше или меньше, чем было.
  homeOnly(state, residentsGuests) *
  // Район дорожает (gentrify.ts): «для новых» — богатые заходят, «для своих» — обходят.
  homeOnly(state, gentGuests) *
  fairGuests(state.day) *
  weekGuests(state.day) *
  lightsGuests(state) *
  departmentGuests(state) *
  homeOnly(state, eduardGuests) *
  homeOnly(state, districtGuests) *
  homeOnly(state, hoodGuests) *
  homeOnly(state, tenantGuests) *
  // Лавки скупленной улицы (estate.ts) и табличка «улица вашего имени».
  homeOnly(state, estateGuests) *
  homeOnly(state, dreamGuests) *
  homeOnly(state, lotteryGuests) *
  homeOnly(state, apprGuests) *
  homeOnly(state, dogGuests) *
  homeOnly(state, trickGuests) *
  // Вечерние гости за пивом и сигаретами (license.ts): лицензия — у магазина в Центре.
  homeOnly(state, licenseGuests) *
  // Опечатан до обеда после серой схемы (grey.ts): гостей вдвое меньше.
  homeOnly(state, greyGuests) *
  // Автоматы в подвале (basement.ts): мамы с детьми обходят магазин.
  homeOnly(state, basementGuests) *
  // Фудкорт на третьем этаже (foodcourt.ts): часть едоков спускается за продуктами.
  homeOnly(state, foodcourtGuests) *
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

/** Откуда пришли деньги мимо кассы зала (otherIncome): аренда, лавки улицы, филиал, этажи, фургон, прокат, тележка. */
export type IncomeId = 'rent' | 'estate' | 'branch' | 'home' | 'van' | 'rental' | 'slots' | 'clothes' | 'food' | 'cart';

/**
 * Прочие доходы дня — всё, что пришло вечером мимо кассы зала. 21.11, автор: «не показывает ежедневно в выручке
 * доход с аренды — он вообще есть?». Есть: эти деньги зачисляются каждый вечер до счетов, но «Выручка» в итогах —
 * только касса зала, а они прятались под «Подробнее». Теперь итоги показывают их одним блоком (ui/hud.ts).
 * Только ненулевые; облава в подвале и плата продавцу этажа — с минусом (их вычитают из того же вечера).
 */
export function otherIncome(night: NightSummary): { id: IncomeId; n: number }[] {
  const slots = night.slots ? (night.slots.raid ? -night.slots.raid.fine : night.slots.income - night.slots.share) : 0;
  const rows: { id: IncomeId; n: number }[] = [
    { id: 'rent', n: night.rent },
    { id: 'estate', n: night.estate },
    { id: 'branch', n: night.branch },
    { id: 'home', n: night.home },
    { id: 'van', n: night.van?.net ?? 0 },
    { id: 'rental', n: night.rental?.income ?? 0 },
    { id: 'slots', n: slots },
    { id: 'clothes', n: night.clothes ? night.clothes.income - night.clothes.wage : 0 },
    { id: 'food', n: night.food?.income ?? 0 },
    { id: 'cart', n: night.cart },
  ];
  return rows.filter((r) => r.n !== 0);
}
