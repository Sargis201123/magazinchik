// «Заречье» — второй район после финала и гипермаркета. Через мост пустует торговая улица у реки:
// город предлагает открыть там второй магазин. Это не филиал под управляющим, а свой магазин, где
// игрок работает сам: утром выбирает «Где работаем сегодня: Центр / Заречье».
//
// Как устроено. У каждого магазина свой «срез» состояния (SHOP_KEYS): помещение, полки, склад, цены,
// сотрудники, рейтинг, постоянные, план дня. Сегодняшний магазин — в самом состоянии, как всегда, и
// всё остальное в игре (сцена, утро, симулятор) работает с ним, не зная о районах. Второй ждёт в
// zar.away; переключение меняет их местами. Деньги, долг, навыки хозяина, сюжет, альбом, марка,
// оформление — общие: кошелёк один, игрок один.
//
// Пока игрок в Заречье, гипермаркет в Центре торгует сам, как филиал (branch.ts): тот же расчёт от
// его выручки за последнюю неделю, со своей долей. Филиал «№2» тоже работает, как работал. Пока
// игрок в Центре, лавка в Заречье закрыта: ни выручки, ни расходов. Счета месяца каждый магазин
// платит за свои дни: сколько дней месяца в нём работали (zarBillShare) — без Заречья всё как раньше.
//
// Свой район: лестница помещений короче и быстрее (ZAR_LEVEL_COST), свои жители (regulars.ts ZAR_REGULARS)
// и их истории (ZAR_TALES), свой спрос (рыба и квас у реки, студенты техникума, туристы летом), речная
// ярмарка по выходным (fair.ts fairToday), теплоход с туристами летом и хозяин рыбной лавки Семён Сом —
// соперник с короткой историей (ZAR_BOSS): ворчит, зовёт на «Рыбный день», потом мирится. Без наказаний.

import { HYPER_LEVEL, MONTH_DAYS, newGame, type ProductId, type StoreState } from './economy';
import { afterFinale } from './arcs';
import { BRANCH_AWAY_MAX_HOURS, BRANCH_AWAY_MIN_HOURS, BRANCH_AWAY_RATE, BRANCH_REF_DAYS, BRANCH_REF_MAX, BRANCH_REF_MIN, BRANCH_SPREAD, branchMood } from './branch';
import { yearTime } from './calendar';
import { rng } from './random';
import type { TextKey } from '../i18n/ru';
import { homeLevel, inZar, ZAR_LEVEL_COST, ZAR_MAX_LEVEL, zarBillShare, zarAwayBill, zarNextLevel } from './zarshop';

export { homeLevel, inZar, ZAR_LEVEL_COST, ZAR_MAX_LEVEL, zarBillShare, zarAwayBill, zarNextLevel };
import type { ZarRegularId } from './regulars';
import { ensurePlan } from './day';

export type Where = 'home' | 'zar';

/**
 * Поля, которые у каждого магазина свои. Всё прочее в состоянии — общее для обоих.
 * Новое поле магазина (полки, касса, сотрудники) — сюда, иначе оно «переедет» из Центра в Заречье.
 */
export const SHOP_KEYS = [
  'level',
  'staff',
  'rating',
  'warehouse',
  'shelves',
  'prices',
  'history',
  'registers',
  'kiosks',
  'ownerTill',
  'upgrades',
  'gear',
  'rack',
  'bargain',
  'cups',
  'slotPos',
  'tillPos',
  'propPos',
  'floorWear',
  'storedShelves',
  'movedFrom',
  'kitchen',
  'pantry',
  'cookMenu',
  'bakeMode',
  'jobSearch',
  'quitNotice',
  'staffEvent',
  // Карьера (career.ts) — общая: «свой человек на филиале» и доска почёта — одни на хозяина.
  'regulars',
  'reviews',
  'promo',
  'contracts',
  'autoOrder',
  'ads',
  'adRuns',
  'security',
  'war',
  'trick',
  'plan',
] as const satisfies readonly (keyof StoreState)[];

export type ShopKey = (typeof SHOP_KEYS)[number];
export type ShopSlice = Partial<Pick<StoreState, ShopKey>>;

/** Шаг истории Семёна Сома (ZAR_BOSS). */
export interface ZarBoss {
  /** 0 — ещё не знакомы; дальше — ZAR_BOSS[stage - 1] уже случился. */
  stage: number;
  /** С какого дня в Заречье идёт шаг (дни считаются по сыгранным в Заречье, played). */
  since: number;
  /** Какой шаг игрок уже видел утром. */
  seen: number;
  /** «Рыбный день»: в какой день игры спор и сколько рыбы продали тогда. */
  duel?: { at: number; sold?: number };
}

export interface ZarState {
  /** Где работаем сегодня. */
  at: Where;
  /** В какой день открыли лавку. */
  since: number;
  /** Магазин, где сегодня не работаем: его поля (SHOP_KEYS). */
  away: ShopSlice;
  /** Сколько дней сыграно в Заречье (жители и Сом считают по ним). */
  played?: number;
  /** Дней работы в каждом магазине в этом месяце — для счетов (zarBillShare). */
  days?: { home: number; zar: number };
  /** Сколько принёс Центр без игрока: последний день и за всё время. */
  homeLast?: { day: number; income: number };
  homeEarned?: number;
  boss?: ZarBoss;
  /** Истории жителей: сколько шагов показано у каждого. */
  tales?: Partial<Record<ZarTaleId, number>>;
  /** День (по played), когда показали последний шаг истории: не чаще одного в ZAR_TALE_GAP дней. */
  taleAt?: number;
  /** Теплоход у пристани: в какой день (по игре) и уже видели ли утром. */
  boat?: number;
}

// ---------- Открытие ----------

/** Цена открытия: аренда улицы и ремонт лавки у моста (docs/BALANCE.md «Заречье»). */
export const ZAR_PRICE = 45000;
/** Карточку «Пустует торговая улица» показываем снова не раньше, чем через столько дней после «Потом». */
export const ZAR_CARD_AGAIN = 14;

/**
 * Гипермаркет в Центре без игрока: доля его обычной выручки. Расчёт тот же, что у филиала, но доля выше,
 * чем у филиала со всеми улучшениями (≈ 0,155): решение автора — Заречье «в ноль», ходить туда не в убыток
 * (через день — прибыль поздней игры −3…+0,4%, npm run sim:zar; docs/BALANCE.md «Заречье»).
 */
export const ZAR_HOME_SHARE = 0.21;

export const zarOf = (state: StoreState): ZarState | undefined => state.zar;
export const hasZar = (state: StoreState): boolean => Boolean(state.zar);
/** Что держит Заречье закрытым: финал не пройден или Центр ещё не гипермаркет. */
export type ZarLock = 'finale' | 'hyper' | null;

export function zarLock(state: StoreState): ZarLock {
  if (!afterFinale(state)) return 'finale';
  if (homeShop(state).level < HYPER_LEVEL) return 'hyper';
  return null;
}

/** Можно открыть (денег — отдельно, в кнопке). */
export const zarOpen = (state: StoreState): boolean => !state.zar && zarLock(state) === null;

/** Утренняя карточка от города: Заречье открыто, ещё не открыли и не откладывали недавно. */
export const zarCardDue = (state: StoreState): boolean => zarOpen(state) && (state.zarCard === undefined || state.day - state.zarCard >= ZAR_CARD_AGAIN);

/** «Потом»: карточка уходит, Заречье остаётся в «Развитии». */
export const zarLater = (state: StoreState): StoreState => ({ ...state, zarCard: state.day });

/** Новая лавка у моста: ларёк, но хозяин опытный — цены свои, рейтинг выше, немного товара на первый день. */
export function newZarShop(state: StoreState): ShopSlice {
  const fresh = newGame();
  const slice = pick(fresh);
  return {
    ...slice,
    // Цены — те же, что в Центре: игрок их уже подобрал.
    prices: { ...fresh.prices, ...homeShop(state).prices },
    rating: 3.5,
    history: [],
    regulars: {},
  };
}

/** force — только для симулятора: без финала (он в симуляторе не обязателен), но с гипермаркетом. */
export function buyZar(state: StoreState, force = false): StoreState | null {
  if (!(force ? !state.zar && homeShop(state).level >= HYPER_LEVEL : zarOpen(state)) || state.money < ZAR_PRICE || state.debt > 0) return null;
  const firstDay = (state.day - 1) % MONTH_DAYS;
  return {
    ...state,
    money: state.money - ZAR_PRICE,
    zarCard: state.day,
    // Дни этого месяца до открытия — дни Центра: счёт за них Центр заплатит как обычно.
    zar: { at: 'home', since: state.day, away: newZarShop(state), played: 0, days: { home: firstDay, zar: 0 } },
  };
}

// ---------- Два магазина в одном состоянии ----------

function pick(state: Partial<StoreState>): ShopSlice {
  const out: Record<string, unknown> = {};
  for (const key of SHOP_KEYS) if (state[key] !== undefined) out[key] = state[key];
  return out as ShopSlice;
}

/** Состояние с полями магазина из slice: чего в срезе нет, того нет и в состоянии. */
function withSlice(state: StoreState, slice: ShopSlice): StoreState {
  const out: Record<string, unknown> = { ...state };
  for (const key of SHOP_KEYS) {
    if (slice[key] === undefined) delete out[key];
    else out[key] = slice[key];
  }
  return out as unknown as StoreState;
}

/**
 * Центр, каким он стоит: сегодня работаем в Заречье — с полями из away. Для филиала (branch.ts),
 * дохода гипермаркета без игрока и всего, что смотрит именно на главный магазин.
 */
export function homeShop(state: StoreState): StoreState {
  return inZar(state) ? withSlice(state, state.zar!.away) : state;
}

/** Лавка в Заречье, какой она стоит (сегодня в Центре — из away). */
export function zarShop(state: StoreState): StoreState | null {
  if (!state.zar) return null;
  return inZar(state) ? state : withSlice(state, state.zar.away);
}

/** Переехать на сегодня: магазины меняются местами. План дня у каждого свой. */
export function switchDistrict(state: StoreState, where: Where): StoreState {
  const zar = state.zar;
  if (!zar || zar.at === where) return state;
  const away = pick(state);
  const next = withSlice(state, zar.away);
  return { ...next, zar: { ...zar, at: where, away } };
}

/**
 * Утром «Где работаем сегодня»: магазины меняются местами, у пришедшего — свой план дня (если на
 * сегодня его ещё не было) и, в Заречье, новый шаг истории Сома. Переключиться обратно тем же утром —
 * всё вернётся как было: закупка, расстановка и план дня остались в срезе.
 */
export function switchToday(state: StoreState, where: Where): StoreState {
  const next = switchDistrict(state, where);
  return next === state ? state : ensurePlan(zarBossMorning(next));
}

/** Ключ для перестройки мира: в каком районе, шаг Сома, теплоход у пристани. */
export const zarLook = (state: StoreState): string => (state.zar ? `${state.zar.at}${state.zar.boss?.stage ?? 0}${zarBoatToday(state) ? 'b' : ''}` : '');

// ---------- Помещения ----------

// ---------- Счета (доля каждого магазина — zarshop.ts) ----------

/** Ночью: день засчитан сегодняшнему магазину; после счетов (новый месяц) — с нуля. */
export function countZarDay(state: StoreState, billed: boolean): StoreState {
  const zar = state.zar;
  if (!zar) return state;
  const days = billed ? { home: 0, zar: 0 } : { ...(zar.days ?? { home: 0, zar: 0 }), [zar.at]: (zar.days?.[zar.at] ?? 0) + 1 };
  const played = (zar.played ?? 0) + (zar.at === 'zar' ? 1 : 0);
  return { ...state, zar: { ...zar, days, played } };
}

// ---------- Центр без игрока ----------

/** Обычная выручка гипермаркета в день — средняя за последнюю неделю, в пределах, как у филиала. */
export function zarHomeRef(state: StoreState): number {
  const week = (homeShop(state).history ?? []).slice(-BRANCH_REF_DAYS);
  const avg = week.length ? week.reduce((a, b) => a + b, 0) / week.length : 0;
  return Math.min(BRANCH_REF_MAX, Math.max(BRANCH_REF_MIN, avg));
}

/** Обычный доход Центра за день без игрока (уже за вычетом его аренды и зарплат). */
export const zarHomeUsual = (state: StoreState): number => (inZar(state) ? Math.round(zarHomeRef(state) * ZAR_HOME_SHARE) : 0);

/** Сколько примерно принесёт Центр за день без игрока (для «Развития» и переключателя — из любого района). */
export const zarHomeEstimate = (state: StoreState): number => Math.round(zarHomeRef(state) * ZAR_HOME_SHARE);

/** Доход Центра за день day, пока игрок в Заречье: как у филиала — погода, сезон, рейтинг и случай. */
export function zarHomeIncome(state: StoreState, day: number): number {
  if (!inZar(state)) return 0;
  const random = rng(day * 51787 + (state.seed ?? 0) + 17);
  const luck = 1 + (random() * 2 - 1) * BRANCH_SPREAD;
  return Math.max(0, Math.round(zarHomeUsual(state) * branchMood(homeShop(state), day) * luck));
}

/** Вечером: Центр отдаёт доход за день — до счетов, как филиал. */
export function zarHomeNight(state: StoreState, day: number): { state: StoreState; income: number } {
  const zar = state.zar;
  const income = zarHomeIncome(state, day);
  if (!zar || !income) return { state, income: 0 };
  return { state: { ...state, money: state.money + income, zar: { ...zar, homeLast: { day, income }, homeEarned: (zar.homeEarned ?? 0) + income } }, income };
}

/** Доход Центра — в строку отчёта дня day (как доход филиала). */
export function zarReport(state: StoreState, day: number, income: number): StoreState {
  if (!income || !state.reports?.some((r) => r.day === day)) return state;
  return { ...state, reports: state.reports.map((r) => (r.day === day ? { ...r, home: income } : r)) };
}

/** Пока игрока не было вовсе: Центр торговал понемногу, как филиал (branchAway). */
export function zarHomeAway(state: StoreState, hours: number): number {
  if (!inZar(state) || !(hours >= BRANCH_AWAY_MIN_HOURS) || state.bankrupt) return 0;
  return Math.round(zarHomeUsual(state) * BRANCH_AWAY_RATE * Math.min(BRANCH_AWAY_MAX_HOURS, hours));
}

// ---------- Свой район: спрос, гости, теплоход, ярмарка ----------

/** Речная ярмарка — по выходным (6-й и 7-й день месяца-недели), лоток у входа как на обычной ярмарке. */
export const zarFairDay = (state: StoreState): boolean => inZar(state) && ((state.day - 1) % MONTH_DAYS) + 1 >= 6;

/** Теплоход с туристами летом: два дня в неделю (по зерну магазина) причаливает к пристани. */
export function zarBoatToday(state: StoreState): boolean {
  if (!inZar(state) || yearTime(state.day) !== 'summer') return false;
  const week = Math.floor((state.day - 1) / MONTH_DAYS);
  const r = rng(week * 7349 + (state.seed ?? 0))();
  const first = 1 + Math.floor(r * 5);
  const d = ((state.day - 1) % MONTH_DAYS) + 1;
  return d === first || d === first + 2;
}

/** Будний день не летом — студенты речного техникума забегают между парами. */
const studentsDay = (state: StoreState): boolean => yearTime(state.day) !== 'summer' && ((state.day - 1) % MONTH_DAYS) + 1 <= 5;

/** Гостей в Заречье: своя улица (помещение и рейтинг — как обычно), ярмарка и теплоход — праздник. Сом пока ворчит — часть рыбаков у него. */
export const ZAR_GUESTS = 1;
export const ZAR_FAIR_GUESTS = 1.12;
export const ZAR_BOAT_GUESTS = 1.25;

export function zarGuests(state: StoreState): number {
  if (!inZar(state)) return 1;
  const boss = bossGuests(state);
  return ZAR_GUESTS * (zarFairDay(state) ? ZAR_FAIR_GUESTS : 1) * (zarBoatToday(state) ? ZAR_BOAT_GUESTS : 1) * boss;
}

/** Спрос у реки: рыба и соленья, квас и вода у набережной, студенты — сок и булочки, туристы — мороженое. */
const ZAR_DEMAND: Partial<Record<ProductId, number>> = { fish: 1.6, pickles: 1.3, kvass: 1.3, water: 1.15, potatoes: 1.1, meat: 0.85, detergent: 0.8 };
const STUDENT_DEMAND: Partial<Record<ProductId, number>> = { juice: 1.4, buns: 1.4, pies: 1.3, water: 1.2 };
const TOURIST_DEMAND: Partial<Record<ProductId, number>> = { icecream: 1.6, water: 1.4, kvass: 1.3, flowers: 1.2 };
const FAIR_DEMAND: Partial<Record<ProductId, number>> = { fish: 1.3, watermelons: 1.3, pumpkins: 1.3, jam: 1.3 };

export function zarDemand(state: StoreState, id: ProductId): number {
  if (!inZar(state)) return 1;
  const boss = state.zar?.boss;
  // Пока Сом ворчит, за рыбой идут к нему; помирились — его сыновья шлют покупателей к нам.
  const fish = id !== 'fish' ? 1 : bossWon(state) ? 1.15 : (boss?.stage ?? 0) >= 1 ? 0.8 : 1;
  return (
    (ZAR_DEMAND[id] ?? 1) *
    (studentsDay(state) ? (STUDENT_DEMAND[id] ?? 1) : 1) *
    (zarBoatToday(state) ? (TOURIST_DEMAND[id] ?? 1) : 1) *
    (zarFairDay(state) ? (FAIR_DEMAND[id] ?? 1) : 1) *
    fish
  );
}

// ---------- Семён Сом ----------

export interface ZarBossStep {
  /** Через сколько дней в Заречье после прошлого шага. */
  after: number;
  /** Что ещё нужно для шага (рейтинг лавки, помещение). */
  need?: (state: StoreState) => boolean;
  lineKey: TextKey;
  noteKey: TextKey;
  mood?: 'happy' | 'angry' | 'sad' | 'surprised';
  /** Награда, когда шаг показан. */
  reward?: { money?: number; rating?: number };
}

/** Сколько рыбы продать в «Рыбный день», чтобы Сом признал лавку. */
export const ZAR_DUEL_FISH = 14;
/** Сом уводит гостей, пока не помирились: самую малость. */
export const ZAR_BOSS_PULL = 0.95;

export const ZAR_BOSS: ZarBossStep[] = [
  // 1. Знакомство: ворчит у своей лавки.
  { after: 1, lineKey: 'zar.boss.1', noteKey: 'zar.boss.1.note', mood: 'angry' },
  // 2. Ценник на рыбу пониже — «посмотрим, кто кого».
  { after: 3, lineKey: 'zar.boss.2', noteKey: 'zar.boss.2.note' },
  // 3. Вызов: «Рыбный день» в ближайшую субботу.
  { after: 3, need: (s) => s.level >= 1, lineKey: 'zar.boss.3', noteKey: 'zar.boss.3.note', mood: 'surprised' },
  // 4. Проиграл спор и мирится: сыновья будут слать покупателей.
  { after: 0, need: (s) => (s.zar?.boss?.duel?.sold ?? 0) >= ZAR_DUEL_FISH, lineKey: 'zar.boss.4', noteKey: 'zar.boss.4.note', mood: 'happy', reward: { money: 3000, rating: 0.2 } },
  // 5. Через пару недель — зовёт на рыбалку и дарит удочку в зал.
  { after: 10, lineKey: 'zar.boss.5', noteKey: 'zar.boss.5.note', mood: 'happy', reward: { money: 1500 } },
];

/** Номер шага, на котором Сом вызывает на спор. */
export const ZAR_DUEL_STAGE = 3;

export const bossWon = (state: StoreState): boolean => (state.zar?.boss?.stage ?? 0) > ZAR_DUEL_STAGE;
const bossGuests = (state: StoreState): number => {
  const stage = state.zar?.boss?.stage ?? 0;
  return stage >= 1 && stage <= ZAR_DUEL_STAGE ? ZAR_BOSS_PULL : 1;
};

/** Сегодня «Рыбный день» (спор с Сомом). */
export const zarDuelToday = (state: StoreState): boolean => {
  const boss = state.zar?.boss;
  return inZar(state) && boss?.stage === ZAR_DUEL_STAGE && boss.duel?.at === state.day;
};

/** Через сколько дней ближайшая суббота (6-й день недели) — день спора. */
function nextSaturday(state: StoreState): number {
  const d = ((state.day - 1) % MONTH_DAYS) + 1;
  return d <= 6 ? 6 - d : 6;
}

/** Утро в Заречье: следующий шаг Сома, если пора. */
export function zarBossMorning(state: StoreState): StoreState {
  const zar = state.zar;
  if (!zar || !inZar(state)) return state;
  const boss = zar.boss ?? { stage: 0, since: 0, seen: 0 };
  const played = zar.played ?? 0;
  const step = ZAR_BOSS[boss.stage];
  // Суббота прошла без победы (или игрок был в Центре) — спор переносится на следующую, без наказаний.
  if (boss.stage === ZAR_DUEL_STAGE && boss.duel && state.day > boss.duel.at && (boss.duel.sold ?? 0) < ZAR_DUEL_FISH) {
    return { ...state, zar: { ...zar, boss: { ...boss, duel: { at: state.day + nextSaturday(state) } } } };
  }
  if (!step || played - boss.since < step.after || (step.need && !step.need(state))) return state;
  const stage = boss.stage + 1;
  const duel = stage === ZAR_DUEL_STAGE ? { at: state.day + nextSaturday(state) } : boss.duel;
  const reward = step.reward;
  return {
    ...state,
    money: state.money + (reward?.money ?? 0),
    rating: Math.min(5, state.rating + (reward?.rating ?? 0)),
    zar: { ...zar, boss: { stage, since: played, seen: boss.seen, ...(duel ? { duel } : {}) } },
  };
}

/** Вечером в «Рыбный день» — сколько рыбы продали. */
export function zarDuelNight(state: StoreState, fishSold: number): StoreState {
  if (!zarDuelToday(state)) return state;
  const zar = state.zar!;
  const boss = zar.boss!;
  return { ...state, zar: { ...zar, boss: { ...boss, duel: { ...boss.duel!, sold: fishSold } } } };
}

/** Новый шаг Сома, который игрок ещё не видел утром. */
export function zarBossNews(state: StoreState): { stage: number; step: ZarBossStep } | null {
  const boss = state.zar?.boss;
  if (!boss || !inZar(state) || boss.seen >= boss.stage) return null;
  return { stage: boss.stage, step: ZAR_BOSS[boss.stage - 1] };
}

export function seeZarBoss(state: StoreState): StoreState {
  const zar = state.zar;
  if (!zar?.boss) return state;
  return { ...state, zar: { ...zar, boss: { ...zar.boss, seen: zar.boss.stage } } };
}

/** Как выглядит лавка Сома: хмурая вывеска, «Рыбный день» с флажками или дружная после мира. */
export type BossLook = 'grumpy' | 'duel' | 'friends';
export function zarBossLook(state: StoreState): BossLook {
  if (bossWon(state)) return 'friends';
  return zarDuelToday(state) ? 'duel' : 'grumpy';
}

// ---------- Жители Заречья ----------

export type ZarTaleId = ZarRegularId;

export interface ZarTale {
  id: ZarTaleId;
  /** Постоянный из regulars.ts ZAR_REGULARS: имя и любимый товар. */
  nameKey: TextKey;
  portrait: string;
  /** Шаги истории; шаг — когда житель знаком (from по played) и доверие не ниже нужного. */
  beats: { key: TextKey; loyalty: number; reward?: { money?: number; rating?: number } }[];
}

/** Не чаще одного шага историй жителей за столько дней в Заречье. */
export const ZAR_TALE_GAP = 2;

export const ZAR_TALES: ZarTale[] = [
  {
    id: 'nina',
    nameKey: 'zar.res.nina',
    portrait: 'portrait_zar_nina',
    beats: [
      { key: 'zar.tale.nina.1', loyalty: 0 },
      { key: 'zar.tale.nina.2', loyalty: 4, reward: { rating: 0.05 } },
      { key: 'zar.tale.nina.3', loyalty: 5, reward: { money: 600 } },
    ],
  },
  {
    id: 'yegor',
    nameKey: 'zar.res.yegor',
    portrait: 'portrait_zar_yegor',
    beats: [
      { key: 'zar.tale.yegor.1', loyalty: 0 },
      { key: 'zar.tale.yegor.2', loyalty: 4 },
      { key: 'zar.tale.yegor.3', loyalty: 5, reward: { money: 500 } },
    ],
  },
  {
    id: 'stepan',
    nameKey: 'zar.res.stepan',
    portrait: 'portrait_zar_stepan',
    beats: [
      { key: 'zar.tale.stepan.1', loyalty: 0 },
      { key: 'zar.tale.stepan.2', loyalty: 4, reward: { rating: 0.05 } },
      { key: 'zar.tale.stepan.3', loyalty: 5, reward: { money: 700 } },
    ],
  },
  {
    id: 'lida',
    nameKey: 'zar.res.lida',
    portrait: 'portrait_zar_lida',
    beats: [
      { key: 'zar.tale.lida.1', loyalty: 0 },
      { key: 'zar.tale.lida.2', loyalty: 4 },
      { key: 'zar.tale.lida.3', loyalty: 5, reward: { money: 800 } },
    ],
  },
  {
    id: 'tolik',
    nameKey: 'zar.res.tolik',
    portrait: 'portrait_zar_tolik',
    beats: [
      { key: 'zar.tale.tolik.1', loyalty: 0 },
      { key: 'zar.tale.tolik.2', loyalty: 4, reward: { rating: 0.05 } },
      { key: 'zar.tale.tolik.3', loyalty: 5, reward: { money: 600 } },
    ],
  },
];

/** С какого дня в Заречье знакомы жители (совпадает с from у ZAR_REGULARS, проверяется тестом). */
export const ZAR_MEET: Record<ZarTaleId, number> = { nina: 0, yegor: 1, stepan: 3, lida: 5, tolik: 8 };

/** Шаг истории жителя, который пора показать утром (или null). */
export function zarTaleToday(state: StoreState): { tale: ZarTale; beat: number } | null {
  const zar = state.zar;
  if (!zar || !inZar(state)) return null;
  const played = zar.played ?? 0;
  if (zar.taleAt !== undefined && played - zar.taleAt < ZAR_TALE_GAP) return null;
  for (const tale of ZAR_TALES) {
    const beat = zar.tales?.[tale.id] ?? 0;
    const step = tale.beats[beat];
    if (!step || played < ZAR_MEET[tale.id]) continue;
    const loyalty = state.regulars?.[tale.id]?.loyalty ?? 3;
    if (loyalty >= step.loyalty) return { tale, beat };
  }
  return null;
}

/** «Понятно» на истории жителя: шаг засчитан, награда — сразу. */
export function seeZarTale(state: StoreState, id: ZarTaleId): StoreState {
  const zar = state.zar;
  const tale = ZAR_TALES.find((x) => x.id === id);
  if (!zar || !tale) return state;
  const beat = zar.tales?.[id] ?? 0;
  const reward = tale.beats[beat]?.reward;
  return {
    ...state,
    money: state.money + (reward?.money ?? 0),
    rating: Math.min(5, state.rating + (reward?.rating ?? 0)),
    zar: { ...zar, tales: { ...zar.tales, [id]: beat + 1 }, taleAt: zar.played ?? 0 },
  };
}

// ---------- Сохранения ----------

/**
 * Старые сохранения поля zar не знают — им ничего не нужно. Сохранение с Заречьем: срез второго
 * магазина дополняем недостающим из новой лавки (поле магазина появилось в игре позже).
 */
export function normalizeZar(state: StoreState): StoreState {
  const zar = state.zar;
  if (!zar) return state;
  const at: Where = zar.at === 'zar' ? 'zar' : 'home';
  const away = zar.away ?? {};
  const fill = newGame();
  const fixed: ShopSlice = {
    ...away,
    level: Math.min(at === 'zar' ? HYPER_LEVEL : ZAR_MAX_LEVEL, Math.max(0, away.level ?? 0)),
    staff: away.staff ?? [],
    rating: away.rating ?? 3.5,
    warehouse: away.warehouse ?? {},
    shelves: away.shelves ?? fill.shelves,
    prices: { ...fill.prices, ...away.prices },
    history: away.history ?? [],
  };
  return { ...state, zar: { ...zar, at, away: fixed } };
}
