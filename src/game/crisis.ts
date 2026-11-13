// Беда района (13.11, задача автора «Кризис района: нажиться или помочь»). Изредка на 3–4 дня в районе
// беда: жара, отключили воду, буран, паводок. Товары первой нужды разбирают за минуты: спрос на них втрое,
// и за ними готовы платить дороже. Утром первого дня хозяин решает, как быть: поднять цены (деньги сейчас —
// злость района потом), держать обычные или держать и раздавать старикам воду и хлеб бесплатно (убыток сейчас).
// Каждый вечер район смотрит на ценники и запоминает — доброе имя (goodwill.ts) меняется и потом неделями
// сказывается на гостях, постоянных, чаевых и отзывах. Итог беды — новостью утром (headlines.ts).
//
// Когда начнётся беда, решают только зерно магазина и номер дня (как находки кота, cat.ts): перезапуск
// ничего не меняет. Не в первые недели (обучение), не в особые дни (bigday.ts) и не в Заречье.

import { PRICE_STEP, PRODUCTS, sellableProducts, type DayStats, type ProductId, type StoreState } from './economy';
import { lateAutumn, yearTime } from './calendar';
import { bigDayFor } from './bigday';
import { inZar } from './zarshop';
import { weatherFor, type Weather } from './weather';
import { addGoodwill, fadeGoodwill } from './goodwill';
import { MAX_LOYALTY, met, REGULARS, regularState } from './regulars';

export type CrisisKind = 'heat' | 'water' | 'blizzard' | 'flood';
export type CrisisMode = 'gouge' | 'hold' | 'give';
export const CRISIS_MODES: CrisisMode[] = ['gouge', 'hold', 'give'];

export interface Crisis {
  icon: string;
  /** Товары первой нужды: их разбирают, их поднимают в цене, их раздают. */
  staples: ProductId[];
  /** Как беда выглядит на улице (погода поверх обычной; null — погода дня). */
  weather: Weather | null;
}

/** Свечей, круп и консервов в магазине нет — берём то, что есть на полках (economy.ts PRODUCTS). */
export const CRISES: Record<CrisisKind, Crisis> = {
  heat: { icon: '🥵', staples: ['water', 'icecream', 'juice'], weather: 'heat' },
  water: { icon: '💧', staples: ['water', 'juice', 'milk'], weather: null },
  blizzard: { icon: '❄️', staples: ['bread', 'potatoes', 'milk'], weather: 'snow' },
  flood: { icon: '🌊', staples: ['water', 'bread', 'potatoes'], weather: 'rain' },
};

/** С какого дня бывают беды: первые недели — обучение и знакомство с районом. */
export const CRISIS_FROM = 24;
/**
 * Шанс, что беда начнётся этим утром. Особые дни заняты почти каждый четвёртый день, а беде нужно 3–4 дня
 * без них — на деле выходит одна беда примерно за 60–90 дней игры.
 */
export const CRISIS_CHANCE = 0.05;
/** После конца беды следующая — не раньше, чем через столько дней. */
export const CRISIS_GAP = 28;
/** Спрос на товары первой нужды во время беды. */
export const CRISIS_DEMAND = 3;
/** За нужное готовы платить дороже: «справедливая» цена для них выше во столько раз. */
export const CRISIS_TOLERANCE = 1.5;
/** Гостей больше: магазин — где взять воду. */
export const CRISIS_GUESTS = 1.1;
/** Берут впрок: каждый гость хочет на столько товаров больше. */
export const CRISIS_EXTRA_ITEMS = 1;
/** «Поднять цены»: товары первой нужды — во столько раз дороже обычного. */
export const GOUGE_PRICE = 1.6;
/** С такой средней наценки на товары первой нужды район считает, что на беде нажились (и без выбора «поднять»). */
export const GOUGE_RATIO = 1.3;
/** Сколько раздают старикам к открытию каждый день беды. */
export const giveUnits = (level: number): number => Math.min(6, 2 + level);
/** Доброе имя за каждый день беды и за её итог. */
export const DAY_GOODWILL: Record<CrisisMode, number> = { gouge: -6, hold: 1, give: 4 };
export const END_GOODWILL: Record<CrisisMode, number> = { gouge: -10, hold: 3, give: 8 };

export interface CrisisTally {
  gouge: number;
  hold: number;
  give: number;
}

/** Идущая беда (в сохранении). */
export interface CrisisState {
  kind: CrisisKind;
  /** Первый день и сколько длится. */
  from: number;
  days: number;
  /** Что решил хозяин утром (нет — ещё не решал: считается «держать цены»). */
  mode?: CrisisMode;
  /** Цены до «поднять цены»: когда беда кончится, вернутся сами. */
  was?: Partial<Record<ProductId, number>>;
  /** Раздали старикам: штук всего, по закупочной цене и в какой день последний раз. */
  given?: number;
  givenCost?: number;
  gaveDay?: number;
  /** Как прошёл каждый день беды по мнению района. */
  tally?: CrisisTally;
  /** Продано товаров первой нужды за беду. */
  sold?: number;
  /** Сколько доброго имени набежало за дни беды. */
  delta?: number;
}

/** Чем кончилась последняя беда: для новости утром и паузы до следующей. */
export interface CrisisEnd {
  kind: CrisisKind;
  mode: CrisisMode;
  given: number;
  sold: number;
  /** Насколько изменилось доброе имя за всю беду. */
  delta: number;
  /** День, когда беда кончилась (утро после последнего её дня). */
  day: number;
  seen?: boolean;
}

/** Случайность беды: зерно магазина, день и «соль» (у каждого броска своя). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 40503 + salt * 7919) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Какие беды бывают в это время года: жара — летом, буран — в предзимье и зимой, паводок — весной и осенью. */
export function kindsFor(day: number): CrisisKind[] {
  const time = yearTime(day);
  if (time === 'summer') return ['heat', 'water'];
  if (time === 'winter' || lateAutumn(day)) return ['blizzard', 'water'];
  return ['flood', 'water'];
}

/** Начнётся ли этим утром беда (и какая). Нужны хотя бы два её товара на полках — иначе нечего решать. */
export function crisisStarts(state: StoreState): CrisisState | null {
  if (state.crisis || state.day < CRISIS_FROM || inZar(state) || state.bankrupt) return null;
  const last = state.crisisEnd?.day;
  if (last !== undefined && state.day - last < CRISIS_GAP) return null;
  if (roll(state, 1) >= CRISIS_CHANCE) return null;
  const days = roll(state, 2) < 0.5 ? 3 : 4;
  // Не в особые дни: у них своя беда или праздник, две сразу — каша.
  for (let d = 0; d < days; d++) if (bigDayFor(state.day + d)) return null;
  const sellable = sellableProducts(state);
  const kinds = kindsFor(state.day).filter((k) => CRISES[k].staples.filter((id) => sellable.includes(id)).length >= 2);
  if (!kinds.length) return null;
  return { kind: kinds[Math.floor(roll(state, 3) * kinds.length)], from: state.day, days };
}

/** Беда, которая идёт сегодня (в Заречье её нет: это беда Центра). */
export function crisisToday(state: StoreState): CrisisState | null {
  const c = state.crisis;
  return c && CRISES[c.kind] && !inZar(state) && state.day >= c.from && state.day < c.from + c.days ? c : null;
}

/** Сколько дней беды осталось, считая сегодняшний. */
export const crisisDaysLeft = (state: StoreState): number => (state.crisis ? state.crisis.from + state.crisis.days - state.day : 0);

export const staplesToday = (state: StoreState): ProductId[] => {
  const c = crisisToday(state);
  return c ? CRISES[c.kind].staples : [];
};

const staple = (state: StoreState, id: ProductId): boolean => staplesToday(state).includes(id);

/** Спрос дня на товар (demand.ts). */
export const crisisDemand = (state: StoreState, id: ProductId): number => (staple(state, id) ? CRISIS_DEMAND : 1);
/** «Справедливая» цена для покупателя (шопинг в зале и симулятор). */
export const crisisTolerance = (state: StoreState, id: ProductId): number => (staple(state, id) ? CRISIS_TOLERANCE : 1);
export const crisisGuests = (state: StoreState): number => (crisisToday(state) ? CRISIS_GUESTS : 1);
export const crisisExtraItems = (state: StoreState): number => (crisisToday(state) ? CRISIS_EXTRA_ITEMS : 0);

/** Погода беды на улице (null — обычная погода дня). */
export const crisisWeather = (state: StoreState): Weather | null => {
  const c = crisisToday(state);
  return c ? CRISES[c.kind].weather : null;
};
/** Погода, которую видит игрок: беда поверх прогноза (жара, буран, ливень паводка). */
export const weatherToday = (state: StoreState): Weather => crisisWeather(state) ?? weatherFor(state.day);

/** Утром беды ещё не решили, как быть. */
export const crisisAsk = (state: StoreState): boolean => Boolean(crisisToday(state) && !state.crisis?.mode);

/** Цена «поднять цены»: в GOUGE_PRICE раз дороже обычной, но не дешевле, чем стояла, и не выше потолка. */
export const gougePrice = (id: ProductId, was: number): number =>
  Math.min(PRODUCTS[id].basePrice * 3, Math.max(was, Math.round((PRODUCTS[id].basePrice * GOUGE_PRICE) / PRICE_STEP) * PRICE_STEP));

/** Ответ на беду. «Поднять цены» сразу переписывает ценники товаров первой нужды (старые вернутся после беды). */
export function chooseCrisis(state: StoreState, mode: CrisisMode): StoreState | null {
  const c = crisisToday(state);
  if (!c || c.mode) return null;
  if (mode !== 'gouge') return { ...state, crisis: { ...c, mode } };
  const was: Partial<Record<ProductId, number>> = {};
  const prices = { ...state.prices };
  for (const id of CRISES[c.kind].staples) {
    was[id] = prices[id];
    prices[id] = gougePrice(id, prices[id]);
  }
  return { ...state, prices, crisis: { ...c, mode, was } };
}

/**
 * К открытию — раздать старикам воду и хлеб (выбор «раздавать»): понемногу каждого товара первой нужды,
 * сначала со склада (не пустеют полки), потом с полок. Раз в день. Ничего нет — ничего и не раздали.
 */
export function crisisGive(state: StoreState): { state: StoreState; given: ProductId[] } {
  const c = crisisToday(state);
  if (!c || c.mode !== 'give' || c.gaveDay === state.day) return { state, given: [] };
  const warehouse = { ...state.warehouse };
  let shelves = state.shelves;
  const given: ProductId[] = [];
  let cost = 0;
  let left = giveUnits(state.level);
  for (let progress = true; left > 0 && progress; ) {
    progress = false;
    for (const id of CRISES[c.kind].staples) {
      if (left <= 0) break;
      const units = warehouse[id] ?? [];
      // Брак, который ждёт решения игрока, не раздаём.
      const at = units.findIndex((u) => !u.pending);
      if (at >= 0) warehouse[id] = [...units.slice(0, at), ...units.slice(at + 1)];
      else {
        const shelf = shelves.findIndex((s) => (s.items[id]?.length ?? 0) > 0);
        if (shelf < 0) continue;
        shelves = shelves.map((s, i) => (i === shelf ? { ...s, items: { ...s.items, [id]: s.items[id]!.slice(1) } } : s));
      }
      given.push(id);
      cost += PRODUCTS[id].cost;
      left--;
      progress = true;
    }
  }
  if (!given.length) return { state, given };
  const crisis: CrisisState = { ...c, gaveDay: state.day, given: (c.given ?? 0) + given.length, givenCost: (c.givenCost ?? 0) + cost };
  return { state: { ...state, warehouse, shelves, crisis }, given };
}

/** Нажились ли сегодня: средняя наценка на товары первой нужды на полках — от GOUGE_RATIO. */
export function gouging(state: StoreState): boolean {
  const sellable = sellableProducts(state);
  const ids = staplesToday(state).filter((id) => sellable.includes(id));
  if (!ids.length) return false;
  return ids.reduce((sum, id) => sum + state.prices[id] / PRODUCTS[id].basePrice, 0) / ids.length >= GOUGE_RATIO;
}

/**
 * Вечер дня беды (day.ts nightCycle, до смены дня): район смотрит на ценники, а не на слова — поднял цены
 * сам, без выбора «поднять», тоже нажился. Раздавал сегодня — помог; иначе — держал цены.
 */
export function crisisNight(state: StoreState, stats: Pick<DayStats, 'sold'>): StoreState {
  const c = crisisToday(state);
  if (!c) return state;
  const verdict: CrisisMode = gouging(state) ? 'gouge' : c.mode === 'give' && c.gaveDay === state.day ? 'give' : 'hold';
  const tally = { ...(c.tally ?? { gouge: 0, hold: 0, give: 0 }) };
  tally[verdict]++;
  const sold = CRISES[c.kind].staples.reduce((n, id) => n + (stats.sold[id] ?? 0), 0);
  const delta = DAY_GOODWILL[verdict];
  return addGoodwill({ ...state, crisis: { ...c, tally, sold: (c.sold ?? 0) + sold, delta: (c.delta ?? 0) + delta } }, delta);
}

/** Как район запомнит беду целиком: нажился хотя бы в половину дней — нажился; раздавал — помог. */
export function crisisVerdict(c: CrisisState): CrisisMode {
  const t = c.tally ?? { gouge: 0, hold: 0, give: 0 };
  const played = t.gouge + t.hold + t.give;
  if (t.gouge > 0 && t.gouge * 2 >= played) return 'gouge';
  return (c.given ?? 0) > 0 ? 'give' : 'hold';
}

/** Постоянные видели всё сами: после жадной беды доверие каждого −1, после доброй — +1. */
function nudgeRegulars(state: StoreState, by: number): StoreState {
  if (!by) return state;
  const regulars = { ...state.regulars };
  for (const r of REGULARS) {
    if (!met(state, r)) continue;
    const cur = regularState(state, r.id);
    regulars[r.id] = { ...cur, loyalty: Math.max(1, Math.min(MAX_LOYALTY, cur.loyalty + by)) };
  }
  return { ...state, regulars };
}

/** Ценники «поднять цены» — назад; если игрок за беду поставил свою цену — её не трогаем. */
export function ungouged<P extends Partial<Record<ProductId, number>>>(prices: P, c: CrisisState | undefined): P {
  if (!c?.was) return prices;
  const out = { ...prices };
  for (const [id, was] of Object.entries(c.was) as [ProductId, number][]) if (out[id] === gougePrice(id, was)) (out as Record<ProductId, number>)[id] = was;
  return out;
}

/**
 * Цены и постоянные — у каждого магазина свои (zarechye.ts SHOP_KEYS), а беда — Центра. 13.11, ревью: если
 * беда кончилась, пока игрок работает в Заречье, Центр лежит в zar.away — правим его там, иначе ценники
 * Центра навсегда остаются втридорога, а доверие пишется чужим жителям.
 */
function atHome(state: StoreState, fn: (home: StoreState) => StoreState): StoreState {
  const zar = state.zar;
  if (!zar || !inZar(state)) return fn(state);
  const home = fn({ ...state, prices: zar.away.prices ?? state.prices, regulars: zar.away.regulars });
  return { ...state, zar: { ...zar, away: { ...zar.away, prices: home.prices, regulars: home.regulars } } };
}

function endCrisis(state: StoreState, c: CrisisState): StoreState {
  const { crisis: _done, ...rest } = state;
  let s: StoreState = atHome(rest, (home) => ({ ...home, prices: ungouged(home.prices, c) }));
  const mode = crisisVerdict(c);
  const t = c.tally ?? { gouge: 0, hold: 0, give: 0 };
  // Все дни беды магазин простоял в Заречье — району нечего вспомнить; новость не нужна.
  if (!t.gouge && !t.hold && !t.give) return { ...s, crisisEnd: { kind: c.kind, mode, given: 0, sold: 0, delta: 0, day: s.day, seen: true } };
  const bonus = END_GOODWILL[mode];
  s = atHome(addGoodwill(s, bonus), (home) => nudgeRegulars(home, mode === 'gouge' ? -1 : mode === 'give' ? 1 : 0));
  return { ...s, crisisEnd: { kind: c.kind, mode, given: c.given ?? 0, sold: c.sold ?? 0, delta: (c.delta ?? 0) + bonus, day: s.day } };
}

/**
 * Утро (day.ts nightCycle, после смены дня): район понемногу забывает, кончившаяся беда подводит итог,
 * новая — может начаться.
 */
export function crisisMorning(state: StoreState): StoreState {
  let s = fadeGoodwill(state);
  const c = s.crisis;
  if (c && (!CRISES[c.kind] || s.day >= c.from + c.days)) s = CRISES[c.kind] ? endCrisis(s, c) : (({ crisis: _bad, ...rest }) => rest)(s);
  if (!s.crisis) {
    const start = crisisStarts(s);
    if (start) s = { ...s, crisis: start };
  }
  return s;
}

/** Итог беды ещё не рассказали (неделю ждёт своей очереди в новостях утра). */
export const crisisNews = (state: StoreState): CrisisEnd | null => {
  const e = state.crisisEnd;
  return e && !e.seen && state.day - e.day <= 7 ? e : null;
};

export const seeCrisisEnd = (state: StoreState): StoreState => (state.crisisEnd ? { ...state, crisisEnd: { ...state.crisisEnd, seen: true } } : state);
