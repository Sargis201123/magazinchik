// Второй этаж — магазин одежды (13.11, задача автора #64). Этаж здания (floors.ts) со своей маленькой лавкой:
// одежда ведётся отдельно от продуктов — свой запас на стойках, своя касса, свои покупатели.
//  · коллекция по сезону: к холодам — куртки и шапки, весной и осенью — плащи и зонты, летом — футболки и шорты.
//    Коллекции меняются с месяцем (а не с погодой за окном): магазин одежды завозит тёплое заранее, к холодам;
//  · закупка — партиями в меню этажа («Развитие» → «Этажи»), только текущей коллекции;
//  · продажи — вечером: часть гостей магазина поднимается наверх. Сколько — от гостей дня, погоды (в ливень плащи
//    нарасхват, в жару куртки никому не нужны), продавца-консультанта и ремонта этажа;
//  · сезон сменился — остатки старой коллекции либо распродаются за полцены (распродажа), либо пылятся на стойках
//    и занимают места до своего сезона через год;
//  · продавец-консультант этажа: платим каждый вечер, зато покупают заметно больше.
//
// Всё — от зерна магазина и номера дня (как находки кота, cat.ts): перезапуск дня ничего не перекатывает, прогноз
// утра честный, симулятор считает то же. Нет поля clothes — на втором этаже пусто (или этажа нет): всё как раньше.
// В Заречье этаж Центра закрыт — одежда ждёт хозяина. Вид этажа — scenes/floors/secondFloor.ts, вход с улицы —
// scenes/clothesFx.ts, меню — ui/clothes.ts.

import type { StoreState } from './economy';
import { monthInYear } from './calendar';
import { weatherToday } from './crisis';
import { floorOf } from './floors';
import type { Weather } from './weather';

export type Collection = 'warm' | 'rain' | 'summer';
export const COLLECTIONS: Collection[] = ['warm', 'rain', 'summer'];

export interface CollectionDef {
  /** Закупочная цена одной вещи и цена на бирке. */
  cost: number;
  price: number;
  icon: string;
}

/**
 * Куртка дорогая, но и наценка на ней больше; футболка дешёвая. Наценка ~×2 — как у одежды на рынке:
 * вещь лежит дольше хлеба и может пролежать сезон.
 */
export const COLLECTION_DEFS: Record<Collection, CollectionDef> = {
  warm: { cost: 110, price: 220, icon: '🧣' },
  rain: { cost: 60, price: 120, icon: '☂️' },
  summer: { cost: 40, price: 80, icon: '👕' },
};

/** Партия: столько вещей привозят за раз. */
export const BATCH = 10;
/** Мест на стойках: голый этаж — 40 вещей, после ремонта (отделка floors.ts) — 60. */
export const RACK_PLACES = [40, 60];
/**
 * Какая доля гостей магазина поднимается наверх и покупает вещь (в среднем, при обычной погоде).
 * 13.11, симулятор (npm run sim:features 200 12 одежда: этаж с 53–55-го дня, партии до полных стоек каждое утро,
 * распродажа, продавец): к 200-му дню денег на 11% больше, чем без этажа. При 0,08 было +52% — этаж затмевал
 * сам магазин; 2,5% — заметная, но побочная лавка.
 */
export const BUY_SHARE = 0.025;
/** После ремонта (свет, стойки, ковёр) покупают охотнее. */
export const FINISH_BOOST = 1.2;
/** Продавец-консультант: столько платим каждый вечер — и во столько раз больше покупают. */
export const CLERK_WAGE = 110;
export const CLERK_BOOST = 1.4;
/** Распродажа остатков старой коллекции: скидка и какая доля гостей на неё заглядывает. */
export const SALE_OFF = 0.5;
export const SALE_SHARE = 0.025;
/** В последние столько дней коллекции меню предупреждает: скоро сменится. */
export const SEASON_WARN = 7;

/** Коллекция месяца года (calendar.ts: 16 месяцев, 0–2 — поздняя осень, 3 — зима, 4–6 — весна, 7–10 — лето). */
export function collectionFor(day: number): Collection {
  const m = monthInYear(day);
  if (m <= 3) return 'warm';
  if (m >= 7 && m <= 10) return 'summer';
  return 'rain';
}

/** Сколько дней (с сегодняшним) осталось текущей коллекции. */
export function seasonDaysLeft(day: number): number {
  const now = collectionFor(day);
  let d = day;
  while (collectionFor(d + 1) === now && d - day < 200) d++;
  return d - day + 1;
}

/** Погода и коллекция: в ливень плащи и зонты нарасхват, в жару куртки не берут, в снег — тёплое. */
const FIT: Record<Collection, Record<Weather, number>> = {
  warm: { clear: 1, rain: 0.9, storm: 0.8, snow: 1.6, leaves: 1.1, heat: 0.3 },
  rain: { clear: 0.9, rain: 1.8, storm: 2, snow: 0.6, leaves: 1.2, heat: 0.5 },
  summer: { clear: 1.1, rain: 0.5, storm: 0.4, snow: 0.2, leaves: 0.7, heat: 1.8 },
};
export const weatherFit = (coll: Collection, weather: Weather): number => FIT[coll][weather];

/** Вечер на этаже: какая коллекция, сколько продали своей и с распродажи, деньги и плата продавцу. */
export interface ClothesDay {
  coll: Collection;
  /** Покупателей пришло за вещью сезона (продано — не больше, чем было на стойках). */
  buyers: number;
  sold: number;
  /** Продано с распродажи (вещи прошлых коллекций за полцены). */
  sale: number;
  income: number;
  wage: number;
}

export interface ClothesState {
  /** Сколько вещей каждой коллекции на стойках. */
  stock?: Partial<Record<Collection, number>>;
  /** Распродажа остатков прошлых коллекций включена. */
  sale?: boolean;
  /** Нанят продавец-консультант. */
  clerk?: boolean;
  /** Прошлый вечер — для карточки в «Этажах». */
  last?: ClothesDay & { day: number };
  /** Сколько этаж принёс за всё время (выручка за вычетом платы продавцу; закупка — не здесь). */
  earned?: number;
}

/** Случайность этажа: зерно магазина, день и «соль» (как у подвала, basement.ts). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 2246822519 + salt * 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const count = (n: unknown): number => Math.max(0, Math.floor(Number(n) || 0));

/** Этаж с одеждой (с поправкой на кривые поля); этажа нет или мы в Заречье — null. */
export function clothesOf(state: StoreState): ClothesState | null {
  if (!floorOf(state, 'second')) return null;
  const c = state.clothes ?? {};
  const stock: Partial<Record<Collection, number>> = {};
  for (const id of COLLECTIONS) if (count(c.stock?.[id])) stock[id] = count(c.stock?.[id]);
  const same = COLLECTIONS.every((id) => (c.stock?.[id] ?? 0) === (stock[id] ?? 0)) && Object.keys(c.stock ?? {}).every((k) => k in COLLECTION_DEFS);
  return same ? c : { ...c, stock };
}

const set = (state: StoreState, clothes: ClothesState): StoreState => ({ ...state, clothes });

/** Мест на стойках — по отделке этажа. */
export const rackPlaces = (state: StoreState): number => RACK_PLACES[Math.min(RACK_PLACES.length - 1, floorOf(state, 'second')?.finish ?? 0)];
/** Всего вещей на стойках. */
export const stockTotal = (c: ClothesState | null): number => COLLECTIONS.reduce((sum, id) => sum + (c?.stock?.[id] ?? 0), 0);
/** Вещей текущей коллекции и прошлых (остатков). */
export const freshStock = (state: StoreState): number => clothesOf(state)?.stock?.[collectionFor(state.day)] ?? 0;
export const oldStock = (state: StoreState): number => stockTotal(clothesOf(state)) - freshStock(state);
/** Сколько вещей ещё влезет на стойки. */
export const freePlaces = (state: StoreState): number => Math.max(0, rackPlaces(state) - stockTotal(clothesOf(state)));

/** Цена партии текущей коллекции (или сколько влезет, если мест меньше партии). */
export function batchSize(state: StoreState): number {
  return Math.min(BATCH, freePlaces(state));
}
export const batchCost = (state: StoreState): number => batchSize(state) * COLLECTION_DEFS[collectionFor(state.day)].cost;

/** Закупить партию текущей коллекции: деньги сразу, вещи — на стойки. */
export function buyBatch(state: StoreState): StoreState | null {
  const c = clothesOf(state);
  const n = batchSize(state);
  const cost = batchCost(state);
  if (!c || n <= 0 || state.money < cost) return null;
  const coll = collectionFor(state.day);
  return set({ ...state, money: state.money - cost }, { ...c, stock: { ...c.stock, [coll]: (c.stock?.[coll] ?? 0) + n } });
}

export function setSale(state: StoreState, sale: boolean): StoreState | null {
  const c = clothesOf(state);
  if (!c || Boolean(c.sale) === sale) return null;
  const { sale: _sale, ...rest } = c;
  return set(state, sale ? { ...c, sale: true } : rest);
}

export function setClerk(state: StoreState, clerk: boolean): StoreState | null {
  const c = clothesOf(state);
  if (!c || Boolean(c.clerk) === clerk) return null;
  const { clerk: _clerk, ...rest } = c;
  return set(state, clerk ? { ...c, clerk: true } : rest);
}

/**
 * Как пройдёт вечер на этаже (guests — гости магазина за день, day.ts guestsToday). Утром — тот же расчёт: прогноз
 * в меню честный, а сцена этажа показывает столько же покупателей.
 */
export function clothesPlan(state: StoreState, guests: number): ClothesDay | null {
  const c = clothesOf(state);
  if (!c || (!stockTotal(c) && !c.clerk)) return null;
  const coll = collectionFor(state.day);
  const boost = (c.clerk ? CLERK_BOOST : 1) * ((floorOf(state, 'second')?.finish ?? 0) > 0 ? FINISH_BOOST : 1);
  const buyers = Math.round(Math.max(0, guests) * BUY_SHARE * weatherFit(coll, weatherToday(state)) * boost * (0.75 + 0.5 * roll(state, 1)));
  const sold = Math.min(c.stock?.[coll] ?? 0, buyers);
  let income = sold * COLLECTION_DEFS[coll].price;
  // Распродажа: на скидку заглядывают свои покупатели — остатки уходят по старшинству коллекций.
  let sale = 0;
  if (c.sale) {
    let want = Math.round(Math.max(0, guests) * SALE_SHARE * (c.clerk ? CLERK_BOOST : 1) * (0.75 + 0.5 * roll(state, 2)));
    for (const id of COLLECTIONS) {
      if (id === coll || want <= 0) continue;
      const n = Math.min(want, c.stock?.[id] ?? 0);
      want -= n;
      sale += n;
      income += n * Math.round(COLLECTION_DEFS[id].price * SALE_OFF);
    }
  }
  return { coll, buyers, sold, sale, income, wage: c.clerk ? CLERK_WAGE : 0 };
}

/** Сколько продано каждой коллекции по плану (своя — sold, прошлые — с распродажи по старшинству). Сцена этажа берёт
 *  отсюда же, кого и за сколько показать на кассе. */
export function soldBy(c: ClothesState, plan: ClothesDay): Partial<Record<Collection, number>> {
  const out: Partial<Record<Collection, number>> = { [plan.coll]: plan.sold };
  let left = plan.sale;
  for (const id of COLLECTIONS) {
    if (id === plan.coll || left <= 0) continue;
    const n = Math.min(left, c.stock?.[id] ?? 0);
    out[id] = n;
    left -= n;
  }
  return out;
}

/**
 * Вечер (day.ts nightCycle, до счетов): выручка этажа в кассу, плата продавцу — из неё. Не хватило на плату —
 * остаток в долг (как штраф облавы в подвале). Проданное уходит со стоек.
 */
export function clothesNight(state: StoreState, guests: number): { state: StoreState; day: ClothesDay | null } {
  const c = clothesOf(state);
  const plan = clothesPlan(state, guests);
  if (!c || !plan) return { state, day: null };
  const sold = soldBy(c, plan);
  const stock: Partial<Record<Collection, number>> = {};
  for (const id of COLLECTIONS) {
    const n = (c.stock?.[id] ?? 0) - (sold[id] ?? 0);
    if (n > 0) stock[id] = n;
  }
  const money = state.money + plan.income - plan.wage;
  const net = plan.income - plan.wage;
  return {
    state: set(
      { ...state, money: Math.max(0, money), debt: state.debt + Math.max(0, -money) },
      { ...c, stock, last: { ...plan, day: state.day }, earned: (c.earned ?? 0) + net },
    ),
    day: plan,
  };
}
