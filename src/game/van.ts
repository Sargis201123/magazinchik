// Выездная торговля (13.11, автор: «покупаешь фургон; утром выбираешь событие и что грузить; вечером итог»).
// Фургон магазина продаёт там, где сегодня людно: матч на стадионе (свой, если он уже построен, иначе — в
// соседнем районе), дачи в выходные, пляж в жару, свадьба в соседнем районе. Каждое событие хочет своё: на
// матч — воду, сок, мороженое и выпечку, на дачи — мясо на шашлык, хлеб и картошку, на свадьбу — торт и
// цветы. Пива нет: лицензии пока нет. Грузят утром из магазина (сначала склад, потом полки) — этот товар
// весь день не в зале. Вечером фургон возвращается: продал по цене выезда (дороже обычной), остаток — на
// склад; мясо, молочное и мороженое весь день без холодильника, а свежая выпечка черствеет — часть может
// испортиться. В дороге бывает всякое: пробка, щедрый покупатель, дождь на пляже, спустило колесо.
// Всё решают зерно магазина и номер дня (без общего генератора): итог честный и не переигрывается.

import { yearTime } from './calendar';
import { MATCH_EVERY, buildingWorks } from './district';
import { MONTH_DAYS, PRODUCTS, unitLife, type ProductId, type Stock, type StoreState, type Unit } from './economy';
import { rng } from './random';
import { weatherDemand, weatherFor } from './weather';
import { inZar } from './zarshop';

export type VanEventId = 'match' | 'dacha' | 'beach' | 'wedding';
export type VanIncident = 'jam' | 'wheel' | 'generous' | 'rain';

/** Фургон — с минимаркета: в ларьке и магазинчике лишнего товара под выезд не бывает. */
export const VAN_LEVEL = 2;
export const VAN_PRICE = 3000;
/** Сколько штук влезает в кузов. */
export const VAN_CAP = 24;
/** Бензин до своего стадиона — через дорогу. */
export const VAN_FUEL_NEAR = 30;

export interface VanEvent {
  icon: string;
  /** Во сколько раз дороже обычной цены продают на выезде. */
  markup: number;
  /** Бензин туда и обратно. */
  fuel: number;
  /** Сколько штук каждого товара разберут в обычный день (до погоды, толпы и случая в дороге). */
  wants: Partial<Record<ProductId, number>>;
}

/**
 * События выезда. Числа подобраны так, чтобы выезд с полным кузовом приносил ~400–700 чистыми на
 * минимаркете: заметно, но не дороже одного хорошего дня в зале (фургон окупается за две-три недели).
 */
export const VAN_EVENTS: Record<VanEventId, VanEvent> = {
  match: { icon: '🏟', markup: 1.2, fuel: 80, wants: { water: 8, juice: 5, icecream: 5, pies: 4, buns: 4, kvass: 4 } },
  dacha: { icon: '🏡', markup: 1.15, fuel: 70, wants: { meat: 6, potatoes: 6, bread: 5, water: 5, juice: 3, apples: 3, pickles: 3, kvass: 3 } },
  beach: { icon: '🏖', markup: 1.3, fuel: 60, wants: { water: 9, icecream: 8, juice: 5, watermelons: 4, kvass: 4 } },
  wedding: { icon: '💒', markup: 1.25, fuel: 80, wants: { flowers: 6, juice: 5, honeycake: 4, apples: 4, meat: 4, tangerines: 4, water: 4 } },
};
export const VAN_EVENT_IDS = Object.keys(VAN_EVENTS) as VanEventId[];

/** Случай в дороге: доля продаж, ремонт, чаевые; и как часто бывает. На пляже в каждый пятый выезд — дождь. */
export const VAN_INCIDENTS: Record<VanIncident, { chance: number; sales: number }> = {
  rain: { chance: 0.2, sales: 0.1 },
  jam: { chance: 0.12, sales: 0.65 },
  wheel: { chance: 0.08, sales: 0.85 },
  generous: { chance: 0.12, sales: 1 },
};
export const VAN_REPAIR = 120;
/** Щедрый покупатель: столько от выручки сверху, но не меньше VAN_TIP_MIN. */
export const VAN_TIP = 0.15;
export const VAN_TIP_MIN = 40;

export interface VanTrip {
  day: number;
  event: VanEventId;
  /** Что в кузове: штуки со своим возрастом (самые старые — в начале). */
  load: Stock;
}

export interface VanResult {
  day: number;
  event: VanEventId;
  /** Продано штук и на сколько (по цене выезда). */
  sold: number;
  revenue: number;
  /** Привёз назад на склад и сколько испортилось в дороге. */
  back: number;
  spoiled: number;
  incident?: VanIncident;
  /** Чаевые щедрого покупателя или ремонт колеса (со знаком). */
  extra: number;
  fuel: number;
  /** Чистыми в кассу: выручка ± случай − бензин. */
  net: number;
}

export interface VanState {
  /** С какого дня фургон у магазина. */
  since: number;
  /** Сегодняшний выезд: куда и что в кузове. */
  trip?: VanTrip;
  /** Итог последнего выезда — для утренней карточки. */
  last?: VanResult;
  /** Выездов и чистыми за всё время. */
  trips?: number;
  earned?: number;
}

// ---------- Когда и куда ----------

/** Выходные игровой недели (6-й и 7-й день, как речная ярмарка в Заречье). */
export const weekendDay = (day: number): boolean => (day - 1) % MONTH_DAYS >= 5;

const roll = (state: StoreState, day: number, salt: number): (() => number) => rng(((state.seed ?? 1) * 2654435761 + day * 40503 + salt * 97) >>> 0);

/** Свадьба в соседнем районе — примерно раз в неделю, по зерну магазина. */
export const weddingDay = (state: StoreState, day: number): boolean => roll(state, day, 11)() < 1 / 6;

/** Куда можно поехать в этот день (по умолчанию — сегодня). */
export function vanEvents(state: StoreState, day = state.day): VanEventId[] {
  const out: VanEventId[] = [];
  // Матч — в тот же день недели, что и на своём стадионе (district.ts isMatchDay): свой ещё не построен — едем к соседям.
  if (day % MATCH_EVERY === 4) out.push('match');
  if (weekendDay(day) && yearTime(day) !== 'winter') out.push('dacha');
  if (weatherFor(day) === 'heat') out.push('beach');
  if (weddingDay(state, day)) out.push('wedding');
  return out;
}

/** Матч на своём стадионе (через дорогу): бензина меньше. */
export const nearMatch = (state: StoreState): boolean => buildingWorks(state, 'stadium');
export const vanFuel = (state: StoreState, id: VanEventId): number => (id === 'match' && nearMatch(state) ? VAN_FUEL_NEAR : VAN_EVENTS[id].fuel);
/** Цена штуки на выезде. */
export const vanPrice = (id: ProductId, event: VanEventId): number => Math.round(PRODUCTS[id].basePrice * VAN_EVENTS[event].markup);

/** Ближайший день с выездом (не сегодня) — для строки «ближайший через N дн.». */
export function nextVanEvent(state: StoreState): { id: VanEventId; days: number } | null {
  for (let d = 1; d <= MONTH_DAYS * 2; d++) {
    const [id] = vanEvents(state, state.day + d);
    if (id) return { id, days: d };
  }
  return null;
}

// ---------- Фургон и кузов ----------

/** Можно купить фургон: минимаркет и больше, в Центре (в Заречье — своя лавка без фургона). */
export const vanOpen = (state: StoreState): boolean => state.level >= VAN_LEVEL && !inZar(state);

export function buyVan(state: StoreState): StoreState | null {
  if (state.van || !vanOpen(state) || state.money < VAN_PRICE) return null;
  return { ...state, money: state.money - VAN_PRICE, van: { since: state.day } };
}

const count = (stock: Stock): number => Object.values(stock).reduce((sum, units) => sum + (units?.length ?? 0), 0);
/** Сегодняшний выезд (вчерашний, не разобранный ночью, — не сегодняшний). */
export const tripToday = (state: StoreState): VanTrip | null => (state.van?.trip?.day === state.day ? state.van.trip : null);
export const vanLoaded = (state: StoreState): number => count(tripToday(state)?.load ?? {});
export const loadedOf = (state: StoreState, id: ProductId): number => tripToday(state)?.load[id]?.length ?? 0;
/** Фургон сегодня уезжает: есть куда и есть что везти. */
export const vanGoes = (state: StoreState): boolean => vanLoaded(state) > 0;

/** Сколько штук товара сейчас в магазине (склад и полки) — то, что можно погрузить. */
export const inStore = (state: StoreState, id: ProductId): number =>
  (state.warehouse[id] ?? []).filter((u) => !u.pending).length + state.shelves.reduce((sum, s) => sum + (s.items[id]?.length ?? 0), 0);

/** Самые старые — первыми: и в кузове, и на складе так и лежат. */
const byAge = (units: Unit[]): Unit[] => [...units].sort((a, b) => b.age - a.age);

/** Выбрать, куда едем сегодня (кузов остаётся загруженным). null — фургона нет или туда сегодня не едут. */
export function planTrip(state: StoreState, event: VanEventId): StoreState | null {
  if (!state.van || !vanOpen(state) || !vanEvents(state).includes(event)) return null;
  const trip = tripToday(state);
  return { ...state, van: { ...state.van, trip: { day: state.day, event, load: trip?.load ?? {} } } };
}

/**
 * Погрузить до n штук товара: сначала со склада, потом с полок, самые старые — первыми (в зале остаётся
 * свежее). Не больше места в кузове. null — некуда или нечего.
 */
export function loadVan(state: StoreState, id: ProductId, n: number): StoreState | null {
  const trip = tripToday(state);
  const room = Math.min(n, VAN_CAP - vanLoaded(state));
  if (!state.van || !trip || room <= 0) return null;
  const taken: Unit[] = [];
  // Склад: брак, по которому ещё не решили, не трогаем.
  const stored = state.warehouse[id] ?? [];
  const keep: Unit[] = [];
  for (const u of stored) {
    if (taken.length < room && !u.pending) taken.push(u);
    else keep.push(u);
  }
  let shelves = state.shelves;
  if (taken.length < room) {
    shelves = state.shelves.map((s) => {
      const units = s.items[id];
      if (!units?.length || taken.length >= room) return s;
      const k = Math.min(units.length, room - taken.length);
      taken.push(...units.slice(0, k));
      return { ...s, items: { ...s.items, [id]: units.slice(k) } };
    });
  }
  if (!taken.length) return null;
  const load = { ...trip.load, [id]: byAge([...(trip.load[id] ?? []), ...taken]) };
  const warehouse = stored.length ? { ...state.warehouse, [id]: keep } : state.warehouse;
  return { ...state, warehouse, shelves, van: { ...state.van, trip: { ...trip, load } } };
}

/** Вернуть из кузова на склад n штук товара (или всё, если товар не указан; и из не разобранного вчерашнего выезда). */
export function unloadVan(state: StoreState, id?: ProductId, n = Infinity): StoreState {
  const trip = state.van?.trip;
  if (!state.van || !trip) return state;
  const warehouse = { ...state.warehouse };
  const load = { ...trip.load };
  for (const pid of id ? [id] : (Object.keys(load) as ProductId[])) {
    const units = load[pid] ?? [];
    // Назад — самые свежие: старые пусть едут продаваться.
    const k = Math.min(units.length, n);
    if (!k) continue;
    warehouse[pid] = byAge([...(warehouse[pid] ?? []), ...units.slice(units.length - k)]);
    load[pid] = units.slice(0, units.length - k);
  }
  return { ...state, warehouse, van: { ...state.van, trip: { ...trip, load } } };
}

/** Не едем: кузов — на склад, выезд отменён. */
export function cancelTrip(state: StoreState): StoreState {
  if (!state.van?.trip) return state;
  const back = unloadVan(state);
  const { trip: _trip, ...van } = back.van!;
  return { ...back, van };
}

/** Сколько штук товара обычно разбирают на этом событии (без толпы и случая) — подсказка при погрузке. */
export const vanWant = (state: StoreState, event: VanEventId, id: ProductId): number =>
  Math.floor((VAN_EVENTS[event].wants[id] ?? 0) * Math.min(1, weatherDemand(weatherFor(state.day), id)));

/** Товары события, которые сейчас вообще можно погрузить или уже в кузове, — по спросу. */
export const vanGoods = (state: StoreState, event: VanEventId): ProductId[] =>
  (Object.keys(VAN_EVENTS[event].wants) as ProductId[])
    .filter((id) => vanWant(state, event, id) > 0 && (inStore(state, id) > 0 || loadedOf(state, id) > 0))
    .sort((a, b) => vanWant(state, event, b) - vanWant(state, event, a));

/** «Загрузить под событие»: каждого товара — сколько обычно разбирают, из того, что есть, пока есть место. */
export function autoLoad(state: StoreState): StoreState {
  const trip = tripToday(state);
  if (!trip) return state;
  let next = state;
  for (const id of vanGoods(state, trip.event)) {
    const need = vanWant(next, trip.event, id) - loadedOf(next, id);
    if (need > 0) next = loadVan(next, id, need) ?? next;
  }
  return next;
}

// ---------- Вечер ----------

/** Случай в дороге сегодня (одинаковый, сколько ни грузи, — от зерна и дня). */
export function vanIncident(state: StoreState, event: VanEventId): VanIncident | undefined {
  let r = roll(state, state.day, 23)();
  const order: VanIncident[] = event === 'beach' ? ['rain', 'jam', 'wheel', 'generous'] : ['jam', 'wheel', 'generous'];
  for (const id of order) {
    if (r < VAN_INCIDENTS[id].chance) return id;
    r -= VAN_INCIDENTS[id].chance;
  }
  return undefined;
}

/** Сколько народу сегодня на событии: от 0,8 до 1,2 обычного. */
export const vanCrowd = (state: StoreState): number => 0.8 + 0.4 * roll(state, state.day, 31)();

/**
 * Без холодильника весь день: мясо, молочное, мороженое и заморозка стареют на два дня, прочий скоропорт —
 * на день, вода, сок и порошок — нисколько.
 */
export const vanAging = (id: ProductId): number => {
  const p = PRODUCTS[id];
  if (!Number.isFinite(p.shelfLife)) return 0;
  return ['meat', 'dairy', 'icebox', 'frozen'].includes(p.category) ? 2 : p.shelfLife <= 7 ? 1 : 0;
};

/** Итог сегодняшнего выезда — чистый расчёт: сцена показывает его, когда фургон вернулся, ночь — зачисляет. */
export function vanOutcome(state: StoreState): (VanResult & { home: Stock }) | null {
  const trip = tripToday(state);
  if (!trip || !vanLoaded(state)) return null;
  const incident = vanIncident(state, trip.event);
  const share = (incident ? VAN_INCIDENTS[incident].sales : 1) * vanCrowd(state);
  let sold = 0;
  let revenue = 0;
  let back = 0;
  let spoiled = 0;
  const home: Stock = {};
  for (const id of Object.keys(trip.load) as ProductId[]) {
    const units = trip.load[id] ?? [];
    if (!units.length) continue;
    // Разбирают сначала самое старое (как и в зале); остальное едет назад и в дороге стареет.
    const n = Math.min(units.length, Math.floor(vanWant(state, trip.event, id) * share));
    sold += n;
    revenue += n * vanPrice(id, trip.event);
    const aged = units.slice(n).map((u) => ({ ...u, age: u.age + vanAging(id) }));
    // Не доживёт и до утра (unitLife без холодильников) — списать сразу: в дороге испортилось.
    const fresh = aged.filter((u) => u.age + 1 < unitLife(id, u));
    spoiled += aged.length - fresh.length;
    back += fresh.length;
    if (fresh.length) home[id] = fresh;
  }
  const extra = incident === 'wheel' ? -VAN_REPAIR : incident === 'generous' ? Math.max(VAN_TIP_MIN, Math.round((revenue * VAN_TIP) / 10) * 10) : 0;
  const fuel = vanFuel(state, trip.event);
  return { day: state.day, event: trip.event, sold, revenue, back, spoiled, incident, extra, fuel, net: revenue + extra - fuel, home };
}

/**
 * Ночь (day.ts nightCycle, до смены дня): выручка выезда — в кассу, остаток — на склад, выезд закрыт.
 * Выезд не сегодняшний (сохранение посреди дня и т. п.) — товар просто возвращается, без продаж и бензина.
 */
export function settleVan(state: StoreState): { state: StoreState; result: VanResult | null } {
  const van = state.van;
  if (!van?.trip) return { state, result: null };
  const outcome = vanOutcome(state);
  if (!outcome) return { state: cancelTrip(state), result: null };
  const { home, ...result } = outcome;
  const warehouse = { ...state.warehouse };
  for (const id of Object.keys(home) as ProductId[]) warehouse[id] = byAge([...(warehouse[id] ?? []), ...(home[id] ?? [])]);
  const { trip: _trip, ...rest } = van;
  return {
    state: { ...state, money: state.money + result.net, warehouse, van: { ...rest, last: result, trips: (van.trips ?? 0) + 1, earned: (van.earned ?? 0) + result.net } },
    result,
  };
}
