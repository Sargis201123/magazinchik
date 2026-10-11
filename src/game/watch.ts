// Ночная охрана. Ночью к закрытому магазину иногда лезут воры: ломают замок, уносят самое
// дорогое со склада и выручку из кассы. Защита — пёс Бобик из приюта (лает, вор чаще всего
// убегает; днём лежит у входа и помогает ловить воришек) и ночной сторож Михалыч (ловит всех,
// за пойманного полиция платит премию). Камеры отпугивают и ночных воров.
// Ночь решает номер дня, а не общий генератор: перезапуск ничего не меняет, а остальная
// случайность (симулятор, события) не сдвигается.

import { PRODUCTS, type ProductId, type StoreState } from './economy';
import { cameraTheft } from './gear';
import { rng } from './random';

/** С какого дня возможны ночные кражи (до этого магазин никому не интересен). */
export const BURGLARY_FROM_DAY = 8;
/** После кражи (или попытки) воры затихают на столько дней. */
export const BURGLARY_QUIET_DAYS = 5;
/** Шанс за ночь: база и прибавка за каждый уровень помещения, верхняя граница. */
export const BURGLARY_BASE = 0.05;
export const BURGLARY_PER_LEVEL = 0.02;
export const BURGLARY_MAX = 0.13;

/** Сколько воры уносят: до трети склада, не больше 10 штук; из кассы — доля вчерашней выручки. */
export const STOLEN_SHARE = 0.33;
export const STOLEN_MAX_UNITS = 10;
export const CASH_SHARE = 0.2;
export const CASH_MAX = 300;
/** Новый замок после взлома. */
export const LOCK_REPAIR = 80;

/** Пёс Бобик: взять из приюта, корм за ночь, как часто прогоняет вора, днём — помогает поймать. */
export const DOG_PRICE = 600;
export const DOG_FOOD = 12;
export const DOG_SCARE = 0.85;
export const DOG_DAY_CATCH = 0.4;
export const DOG_FROM_DAY = BURGLARY_FROM_DAY;

/** Ночной сторож: плата за ночь и премия от полиции за пойманного. */
export const WATCHMAN_WAGE = 45;
export const WATCHMAN_BOUNTY = 150;

export type BurglaryOutcome = 'stolen' | 'dog' | 'watchman';

export interface BurglaryNews {
  /** Утро какого дня. */
  day: number;
  outcome: BurglaryOutcome;
  goods: { id: ProductId; n: number }[];
  cash: number;
  repair: number;
  bounty: number;
  /** Бобик был, но проспал. */
  dogSlept?: boolean;
  seen?: boolean;
}

export interface Security {
  dog?: { since: number };
  watchman?: boolean;
  /** Утро последней попытки кражи. */
  lastBurglary?: number;
  /** Сколько воров прогнал Бобик и поймал сторож — для гордости. */
  scared?: number;
  caught?: number;
  news?: BurglaryNews;
}

export const securityOf = (state: StoreState): Security => state.security ?? {};
export const hasDog = (state: StoreState): boolean => Boolean(state.security?.dog);
export const hasWatchman = (state: StoreState): boolean => Boolean(state.security?.watchman);

/** Шанс, что этой ночью полезут воры. */
export function burglaryChance(state: StoreState, day = state.day): number {
  const last = state.security?.lastBurglary;
  if (day < BURGLARY_FROM_DAY || (last !== undefined && day - last < BURGLARY_QUIET_DAYS)) return 0;
  return Math.min(BURGLARY_MAX, BURGLARY_BASE + BURGLARY_PER_LEVEL * state.level) * cameraTheft(state);
}

/** Взять Бобика из приюта. */
export function adoptDog(state: StoreState): StoreState | null {
  if (hasDog(state) || state.day < DOG_FROM_DAY || state.money < DOG_PRICE) return null;
  return { ...state, money: state.money - DOG_PRICE, security: { ...securityOf(state), dog: { since: state.day } } };
}

/** Нанять ночного сторожа или отпустить (платим только за отработанные ночи). */
export function setWatchman(state: StoreState, on: boolean): StoreState {
  return { ...state, security: { ...securityOf(state), watchman: on || undefined } };
}

/** Самое дорогое со склада (по цене закупки), не больше доли и предела. */
function steal(state: StoreState): { state: StoreState; goods: { id: ProductId; n: number }[] } {
  const units = Object.entries(state.warehouse).flatMap(([id, list]) =>
    (list ?? []).filter((u) => !u.pending).map(() => id as ProductId),
  );
  let left = Math.min(STOLEN_MAX_UNITS, Math.floor(units.length * STOLEN_SHARE));
  const warehouse = { ...state.warehouse };
  const goods: { id: ProductId; n: number }[] = [];
  const byValue = [...new Set(units)].sort((a, b) => PRODUCTS[b].cost - PRODUCTS[a].cost);
  for (const id of byValue) {
    if (left <= 0) break;
    const list = warehouse[id] ?? [];
    const keep = list.filter((u) => u.pending);
    const taken = list.filter((u) => !u.pending);
    const n = Math.min(left, taken.length);
    warehouse[id] = [...taken.slice(0, taken.length - n), ...keep];
    goods.push({ id, n });
    left -= n;
  }
  return { state: { ...state, warehouse }, goods };
}

/**
 * Ночь после закрытия: корм Бобику и плата сторожу, потом — полезут ли воры. state — уже
 * утро следующего дня (state.day — новый день), revenue — выручка прошедшего дня.
 */
export function burglaryNight(state: StoreState, revenue: number): StoreState {
  let s = state;
  const security = { ...securityOf(s) };
  if (security.dog) s = { ...s, money: s.money - Math.min(Math.max(0, s.money), DOG_FOOD) };
  // Нечем заплатить сторожу — этой ночью он не выходит.
  const watchman = Boolean(security.watchman) && s.money >= WATCHMAN_WAGE;
  if (watchman) s = { ...s, money: s.money - WATCHMAN_WAGE };
  const random = rng(s.day * 7907 + 13);
  if (random() >= burglaryChance(s)) return { ...s, security: { ...security, news: security.news?.seen ? undefined : security.news } };
  security.lastBurglary = s.day;
  const news: BurglaryNews = { day: s.day, outcome: 'stolen', goods: [], cash: 0, repair: 0, bounty: 0 };
  if (watchman) {
    news.outcome = 'watchman';
    news.bounty = WATCHMAN_BOUNTY;
    security.caught = (security.caught ?? 0) + 1;
    s = { ...s, money: s.money + WATCHMAN_BOUNTY };
  } else if (security.dog && random() < DOG_SCARE) {
    news.outcome = 'dog';
    security.scared = (security.scared ?? 0) + 1;
  } else {
    news.dogSlept = Boolean(security.dog);
    const robbed = steal(s);
    news.goods = robbed.goods;
    news.cash = Math.min(CASH_MAX, Math.round(Math.max(0, revenue) * CASH_SHARE), Math.max(0, s.money));
    news.repair = Math.min(LOCK_REPAIR, Math.max(0, s.money - news.cash));
    s = { ...robbed.state, money: s.money - news.cash - news.repair };
  }
  return { ...s, security: { ...security, news } };
}

/** Новость о ночи, которую игрок ещё не видел. */
export function burglaryNews(state: StoreState): BurglaryNews | null {
  const news = state.security?.news;
  return news && !news.seen && news.day === state.day ? news : null;
}

export function seeBurglaryNews(state: StoreState): StoreState {
  const news = state.security?.news;
  if (!news) return state;
  return { ...state, security: { ...securityOf(state), news: { ...news, seen: true } } };
}
