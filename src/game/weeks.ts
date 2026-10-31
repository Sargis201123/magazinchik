// Сезонные недели игрового года (по образцу праздников live.ts, но по календарю игры — calendar.ts):
// весной «Ночь распродаж», летом «Летний фестиваль», осенью «Ярмарка урожая». Неделя — один игровой
// месяц (7 дней) в своём сезоне; ни с праздничным месяцем (endless.ts seasonFor), ни с праздниками
// (holidayFor) не совпадает.
//
// Неделя даёт:
// - украшения в мире (scenes/weeks.ts): лотки урожая, баннер «−20%», фонарики и музыканты, салют;
// - свой товар (SEASONAL: тыквы — только на ярмарке, арбузы — только на фестивале) и спрос на любимое;
// - дорожку из шести шагов: по одному в день — небольшая награда монетами, за последний — памятная
//   вещь в зал (decor.ts, праздничная — остаётся и после «Начать заново», как ёлка);
// - на распродаже — вечерние часы «−20%» (последняя четверть смены): всё дешевле, гостей больше.
// Прибавка к выручке за неделю — не больше ~10% (tests/weeks.test.ts меряет симулятором).
// Пропущенные дни ничего не отнимают: шаг ждёт следующего дня, недоделанная дорожка — следующего года.

import type { TextKey } from '../i18n/ru';
import { grantDecor, type DecorId } from './decor';
import { questReward } from './endless';
import { MONTH_DAYS, monthInYear, monthOf, type DayStats, type ProductId, type StoreState } from './economy';

export type WeekId = 'sale' | 'summer' | 'harvest';
export const WEEK_IDS: WeekId[] = ['sale', 'summer', 'harvest'];

/** Шагов в дорожке недели: дней семь — один можно пропустить. */
export const WEEK_STEPS = 6;
/** Месяцев в игровом году (= YEAR_MONTHS в calendar.ts, проверяется тестом). */
const YEAR_MONTHS = 16;

/** Что нужно сделать за день, чтобы пройти шаг. */
export type WeekGoalKind = 'serve' | 'sell' | 'revenue';

export interface WeekGoal {
  kind: WeekGoalKind;
  target: number;
  /** Для «продай»: какие товары засчитываются (любой из них). */
  products?: ProductId[];
  /** Подпись цели для «продай» (live.ts-стиль: ключ текста). */
  what?: TextKey;
}

export interface Week {
  id: WeekId;
  /** Месяц игрового года (0…15, monthInYear). */
  month: number;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
  /** Множитель потока гостей на всю неделю. */
  guests: number;
  /** Чего хотят чаще (к сезонному спросу). */
  demand: Partial<Record<ProductId, number>>;
  /** Свой товар недели (SEASONAL — только в этот месяц). */
  product: ProductId | null;
  /** Памятная вещь за всю дорожку. */
  keepsake: DecorId;
  /** Цели шагов по порядку (доли гостей дня, штуки, выручка). */
  steps: { kind: WeekGoalKind; share: number; products?: ProductId[]; what?: TextKey }[];
}

/**
 * Весна — месяц 5 (после 8 Марта и цветов на всю весну), лето — 9 (между шашлыками и школой),
 * осень — 13 (после школы, перед Хэллоуином и урожаем).
 */
export const WEEKS: Record<WeekId, Week> = {
  sale: {
    id: 'sale',
    month: 5,
    icon: '🏷',
    nameKey: 'week.sale',
    descKey: 'week.sale.desc',
    guests: 1,
    demand: {},
    product: null,
    keepsake: 'holiday_cart',
    steps: [
      { kind: 'serve', share: 0.45 },
      { kind: 'sell', share: 0.12, products: ['soap', 'detergent', 'juice', 'water', 'milk', 'bread'], what: 'week.what.basket' },
      { kind: 'revenue', share: 0.4 },
      { kind: 'serve', share: 0.5 },
      { kind: 'revenue', share: 0.45 },
      { kind: 'serve', share: 0.55 },
    ],
  },
  summer: {
    id: 'summer',
    month: 9,
    icon: '🏮',
    nameKey: 'week.summer',
    descKey: 'week.summer.desc',
    guests: 1.04,
    demand: { icecream: 1.5, water: 1.3, juice: 1.3 },
    product: 'watermelons',
    keepsake: 'holiday_lantern',
    steps: [
      { kind: 'serve', share: 0.45 },
      { kind: 'sell', share: 0.1, products: ['watermelons'], what: 'week.what.watermelons' },
      { kind: 'sell', share: 0.1, products: ['icecream', 'watermelons', 'water', 'juice'], what: 'week.what.cool' },
      { kind: 'revenue', share: 0.4 },
      { kind: 'serve', share: 0.5 },
      { kind: 'revenue', share: 0.45 },
    ],
  },
  harvest: {
    id: 'harvest',
    month: 13,
    icon: '🎃',
    nameKey: 'week.harvest',
    descKey: 'week.harvest.desc',
    guests: 1.08,
    demand: { apples: 1.2, pies: 1.3, buns: 1.2 },
    product: 'pumpkins',
    keepsake: 'holiday_scarecrow',
    steps: [
      { kind: 'serve', share: 0.45 },
      { kind: 'sell', share: 0.1, products: ['pumpkins'], what: 'week.what.pumpkins' },
      { kind: 'sell', share: 0.12, products: ['apples', 'potatoes', 'pumpkins'], what: 'week.what.harvest' },
      // Конкурс пирогов: выпечка (хлеб, свои пирожки, булочки, медовик) — к четвёртому дню.
      { kind: 'sell', share: 0.1, products: ['bread', 'pies', 'buns', 'honeycake'], what: 'week.what.pies' },
      { kind: 'revenue', share: 0.4 },
      { kind: 'serve', share: 0.5 },
    ],
  },
};

/** День недели распродажи, в который вечером «−20%»: каждый. Вечер — последняя четверть смены. */
export const SALE_EVENING = 0.25;
/** Вечером на распродаже всё дешевле на 20%. */
export const SALE_DISCOUNT = 0.8;
/** И гостей вечером больше — сбегаются на скидки. */
export const SALE_CROWD = 1.4;
/** На четвёртый день ярмарки — конкурс пирогов, на последний день фестиваля — салют. */
export const PIE_CONTEST_DAY = 4;
export const FIREWORKS_DAY = 7;

// ---------------------------------------------------------------- календарь

const dayInMonth = (day: number): number => ((day - 1) % MONTH_DAYS) + 1;

/** Только для замеров баланса (tests/weeks.test.ts): какие недели наступают; null — все. В игре не меняется. */
let only: WeekId[] | null = null;
export const onlyWeeks = (ids: WeekId[] | null): void => {
  only = ids;
};

/** Какая неделя идёт в этот день и какой это её день (1…7), или null. */
export function weekFor(day: number): { id: WeekId; n: number } | null {
  if (day < 1) return null;
  const m = monthInYear(day);
  const id = WEEK_IDS.find((w) => WEEKS[w].month === m && (!only || only.includes(w)));
  return id ? { id, n: dayInMonth(day) } : null;
}

/** Номер игрового года (0 — первый): дорожки разных лет различает он. */
export const yearOf = (day: number): number => Math.floor((monthOf(day) - 1) / YEAR_MONTHS);

/** Ближайшая неделя в пределах days дней вперёд (1 — завтра): какая и через сколько дней. */
export function nextWeek(day: number, days: number): { id: WeekId; in: number } | null {
  for (let d = 1; d <= days; d++) {
    const w = weekFor(day + d);
    if (w && w.n === 1) return { id: w.id, in: d };
  }
  return null;
}

/** Первый день недели id не раньше дня from (для отладки и тестов: «перемотать» к неделе). */
export function weekStart(id: WeekId, from = 1): number {
  for (let d = Math.max(1, from); d < from + YEAR_MONTHS * MONTH_DAYS + MONTH_DAYS; d++) {
    const w = weekFor(d);
    if (w?.id === id && w.n === 1) return d;
  }
  return from;
}

// ---------------------------------------------------------------- экономика

/** Гостей в неделю: на ярмарку и на фестиваль заходят чуть чаще (лотки и музыка на улице). */
export const weekGuests = (day: number): number => {
  const w = weekFor(day);
  return w ? WEEKS[w.id].guests : 1;
};

/** Товар недели (тыквы, арбузы) продаётся, только пока идёт его неделя. Остальные товары — как обычно. */
export const weekProductOk = (id: ProductId, day: number): boolean => {
  const owner = WEEK_IDS.find((w) => WEEKS[w].product === id);
  return !owner || weekFor(day)?.id === owner;
};

/** Спрос на товар в неделю (к сезонному спросу). */
export const weekDemand = (id: ProductId, day: number): number => {
  const w = weekFor(day);
  return (w && WEEKS[w.id].demand[id]) || 1;
};

/** Сейчас идут вечерние часы «−20%» (отметку ставит сцена или симулятор, когда наступает вечер). */
export const saleOn = (state: StoreState): boolean => state.weeks?.sale === state.day && weekFor(state.day)?.id === 'sale';

/** Начать вечернюю распродажу сегодня. */
export const startSale = (state: StoreState): StoreState => (weekFor(state.day)?.id === 'sale' ? { ...state, weeks: { ...state.weeks, sale: state.day } } : state);

/** На скидке берут больше: вечером распродажи с такой вероятностью в корзине лишняя вещь. */
export const SALE_BASKET = 0.5;
export const saleExtraItems = (state: StoreState, random: () => number): number => (saleOn(state) && random() < SALE_BASKET ? 1 : 0);

/** Множитель цены на кассе: вечером распродажи −20%. */
export const saleFactor = (state: StoreState): number => (saleOn(state) ? SALE_DISCOUNT : 1);

// ---------------------------------------------------------------- дорожка

/** Дорожка недели: сколько шагов пройдено в этом году, в какой день — последний, получена ли вещь. */
export interface WeekTrack {
  year: number;
  steps: number;
  last?: number;
}

/** Что игрок сделал в неделях: дорожки по неделям и день вечерней распродажи. */
export interface WeeksState {
  tracks?: Partial<Record<WeekId, WeekTrack>>;
  /** День, в который вечером идёт распродажа «−20%». */
  sale?: number;
}

/**
 * Дорожка этой недели на этот год. Недоделанная в прошлом году — продолжается (ничего не сгорает),
 * пройденная до конца — начинается заново (за неё — уже монеты, вещь у игрока есть).
 */
export function trackOf(state: StoreState, id: WeekId, day: number): WeekTrack {
  const year = yearOf(day);
  const saved = state.weeks?.tracks?.[id];
  if (!saved || typeof saved.steps !== 'number') return { year, steps: 0 };
  if (saved.year === year) return saved;
  return saved.steps >= WEEK_STEPS ? { year, steps: 0 } : { ...saved, year };
}

/** Монеты за шаг: меньше задания дня (~3% прибыли дня), последний шаг — вдвое. */
export const stepReward = (level: number, step: number): number => Math.max(10, Math.round((questReward(level) * 0.6 * (step === WEEK_STEPS ? 2 : 1)) / 5) * 5);

/** Цель шага на сегодня: какой недели и какой по счёту шаг. */
export type WeekGoalToday = WeekGoal & { id: WeekId; step: number };

/** Цель сегодняшнего шага: null — не неделя, дорожка пройдена или шаг сегодня уже сделан. */
export function weekGoal(state: StoreState, guests: number): WeekGoalToday | null {
  const w = weekFor(state.day);
  if (!w) return null;
  const track = trackOf(state, w.id, state.day);
  if (track.steps >= WEEK_STEPS || track.last === state.day) return null;
  const def = WEEKS[w.id].steps[track.steps];
  const g = Math.max(8, guests);
  // Выручка — от среднего чека ~22 на гостя (как задание дня «выручка»), штуки — от гостей.
  const target =
    def.kind === 'revenue' ? Math.max(100, Math.round((g * 22 * def.share) / 10) * 10) : def.kind === 'sell' ? Math.max(3, Math.round(g * def.share)) : Math.max(5, Math.round(g * def.share));
  return { id: w.id, step: track.steps + 1, kind: def.kind, target, products: def.products, what: def.what };
}

/** Прогресс цели по итогам дня. */
export function goalProgress(goal: WeekGoal, stats: DayStats): number {
  if (goal.kind === 'serve') return stats.served;
  if (goal.kind === 'revenue') return stats.revenue;
  return (goal.products ?? []).reduce((sum, id) => sum + (stats.sold[id] ?? 0), 0);
}

export interface WeekNight {
  id: WeekId;
  step: number;
  coins: number;
  /** Вся дорожка пройдена: памятная вещь (или монеты, если она уже есть). */
  keepsake?: DecorId;
}

/** Итог дня недели: шаг пройден — монеты, последний — ещё и памятная вещь. */
export function weekNight(state: StoreState, stats: DayStats, goal: WeekGoalToday | null): { state: StoreState; done: WeekNight | null } {
  if (!goal || goalProgress(goal, stats) < goal.target) return { state, done: null };
  const track = trackOf(state, goal.id, state.day);
  if (track.steps + 1 !== goal.step) return { state, done: null };
  const step = goal.step;
  const coins = stepReward(state.level, step);
  let next: StoreState = {
    ...state,
    money: state.money + coins,
    weeks: { ...state.weeks, tracks: { ...state.weeks?.tracks, [goal.id]: { year: track.year, steps: step, last: state.day } } },
  };
  let keepsake: DecorId | undefined;
  const prize = WEEKS[goal.id].keepsake;
  if (step === WEEK_STEPS && !next.decor.owned.includes(prize)) {
    next = grantDecor(next, [prize]);
    keepsake = prize;
  }
  return { state: next, done: { id: goal.id, step, coins, keepsake } };
}

/** Старые и чужие сохранения: неизвестные недели и битые поля убираем. */
export function normalizeWeeks(raw: unknown): WeeksState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as WeeksState;
  const tracks: Partial<Record<WeekId, WeekTrack>> = {};
  for (const id of WEEK_IDS) {
    const t = src.tracks?.[id];
    if (!t || !Number.isFinite(t.year) || !Number.isFinite(t.steps)) continue;
    tracks[id] = { year: t.year, steps: Math.max(0, Math.min(WEEK_STEPS, Math.floor(t.steps))), ...(Number.isFinite(t.last) ? { last: t.last } : {}) };
  }
  return { tracks, ...(Number.isFinite(src.sale) ? { sale: src.sale } : {}) };
}
