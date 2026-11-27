// Выездная торговля (13.11, автор: «покупаешь фургон; утром выбираешь событие и что грузить; вечером итог»).
// Фургон магазина продаёт там, где сегодня людно: матч на стадионе (свой, если он уже построен, иначе — в
// соседнем районе), дачи в выходные, пляж в жару, свадьба в соседнем районе. Каждое событие хочет своё: на
// матч — воду, сок, мороженое и выпечку, на дачи — мясо на шашлык, хлеб и картошку, на свадьбу — торт и
// цветы. Пиво и сигареты на матч и на дачи — только с лицензией (license.ts).
// 27.11, автор: «игрок заходит в уголки, собирает фургон и отправляет — не нужно так». Теперь фургон ездит сам:
// купил один раз — в каждый день события он сам уезжает на самое выгодное из них. Груз «свой»: товар под выезд
// он берёт у поставщика по закупочной цене, мимо полок и склада, — зал и склад фургон больше не трогает, грузить
// и выбирать нечего. Вечером в кассу — выручка по цене выезда за вычетом товара и бензина. В дороге бывает
// всякое: пробка, щедрый покупатель, дождь на пляже, спустило колесо — это строка в итогах дня.
// Всё решают зерно магазина и номер дня (без общего генератора): итог честный и не переигрывается.

import { yearTime } from './calendar';
import { MATCH_EVERY, buildingWorks } from './district';
import { MONTH_DAYS, PRODUCTS, restricted, sellableProducts, warehouseCapacity, warehouseCount, type ProductId, type Stock, type StoreState, type Unit } from './economy';
import { weatherToday } from './crisis';
import { hasLicense } from './license';
import { rng } from './random';
import { weatherDemand, weatherFor, type Weather } from './weather';
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
  match: { icon: '🏟', markup: 1.2, fuel: 80, wants: { water: 8, juice: 5, icecream: 5, beer: 5, pies: 4, buns: 4, kvass: 4, cigarettes: 2 } },
  dacha: { icon: '🏡', markup: 1.15, fuel: 70, wants: { meat: 6, potatoes: 6, bread: 5, water: 5, beer: 4, juice: 3, apples: 3, pickles: 3, kvass: 3 } },
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

export interface VanResult {
  day: number;
  event: VanEventId;
  /** Продано штук и на сколько (по цене выезда). */
  sold: number;
  revenue: number;
  /** Проданный товар по закупочной цене (27.11: груз фургон берёт сам, у поставщика). В итогах до 27.11 — нет. */
  goods?: number;
  incident?: VanIncident;
  /** Чаевые щедрого покупателя или ремонт колеса (со знаком). */
  extra: number;
  fuel: number;
  /** Чистыми в кассу: выручка − товар ± случай − бензин. */
  net: number;
  /**
   * Только для отката и старого кэша клиента (код до 27.11, ui/van.ts resultTable): без них старая карточка писала
   * «NaN шт.» и «{n} шт.», а случай в дороге второй раз выходил утренней новостью. Новый код их не читает - убрать
   * в следующем выпуске.
   */
  back?: number;
  spoiled?: number;
  seen?: boolean;
}

export interface VanState {
  /** С какого дня фургон у магазина. */
  since: number;
  /** Итог последнего выезда — для плитки фургона в «Уголках». */
  last?: VanResult;
  /** Выездов и чистыми за всё время. */
  trips?: number;
  earned?: number;
  /** До 27.11: утром загруженный кузов и «Не едем». Сохранение со старым кузовом разгружает migrateVan. */
  trip?: { day: number; event: VanEventId; load: Stock };
  skip?: number;
}

// ---------- Когда и куда ----------

/** Выходные игровой недели (6-й и 7-й день, как речная ярмарка в Заречье). */
export const weekendDay = (day: number): boolean => (day - 1) % MONTH_DAYS >= 5;

const roll = (state: StoreState, day: number, salt: number): (() => number) => rng(((state.seed ?? 1) * 2654435761 + day * 40503 + salt * 97) >>> 0);

/** Свадьба в соседнем районе — примерно раз в неделю, по зерну магазина. */
export const weddingDay = (state: StoreState, day: number): boolean => roll(state, day, 11)() < 1 / 6;

/** Погода дня: сегодня — с бедой района поверх прогноза (жара беды тоже зовёт на пляж), дальше — прогноз. */
const weatherOn = (state: StoreState, day: number): Weather => (day === state.day ? weatherToday(state) : weatherFor(day));

/** Куда можно поехать в этот день (по умолчанию — сегодня). */
export function vanEvents(state: StoreState, day = state.day): VanEventId[] {
  const out: VanEventId[] = [];
  // Матч — в тот же день недели, что и на своём стадионе (district.ts isMatchDay): свой ещё не построен — едем к соседям.
  if (day % MATCH_EVERY === 4) out.push('match');
  if (weekendDay(day) && yearTime(day) !== 'winter') out.push('dacha');
  if (weatherOn(state, day) === 'heat') out.push('beach');
  if (weddingDay(state, day)) out.push('wedding');
  return out;
}

/** Матч на своём стадионе (через дорогу): бензина меньше. */
export const nearMatch = (state: StoreState): boolean => buildingWorks(state, 'stadium');
export const vanFuel = (state: StoreState, id: VanEventId): number => (id === 'match' && nearMatch(state) ? VAN_FUEL_NEAR : VAN_EVENTS[id].fuel);
/** Цена штуки на выезде. */
export const vanPrice = (id: ProductId, event: VanEventId): number => Math.round(PRODUCTS[id].basePrice * VAN_EVENTS[event].markup);
/** Сколько фургон зарабатывает на штуке: цена выезда минус закупочная (товар он берёт у поставщика сам). */
export const vanMargin = (id: ProductId, event: VanEventId): number => vanPrice(id, event) - PRODUCTS[id].cost;

/** Ближайший день с выездом (не сегодня) — для строки «ближайший через N дн.». */
export function nextVanEvent(state: StoreState): { id: VanEventId; days: number } | null {
  for (let d = 1; d <= MONTH_DAYS * 2; d++) {
    const [id] = vanEvents(state, state.day + d);
    if (id) return { id, days: d };
  }
  return null;
}

/**
 * Сколько штук товара обычно разбирают на этом событии в этот день (без толпы и случая): пиво и сигареты —
 * только с лицензией, в непогоду берут меньше.
 */
export const vanWant = (state: StoreState, event: VanEventId, id: ProductId, day = state.day): number =>
  restricted(id) && !hasLicense(state) ? 0 : Math.floor((VAN_EVENTS[event].wants[id] ?? 0) * Math.min(1, weatherDemand(weatherOn(state, day), id)));

/**
 * Груз выезда: товары магазина (что он сам продаёт в этот день), которые берут на событии, — каждого сколько обычно
 * разбирают, самые ходовые первыми, пока есть место в кузове. Груз фургон берёт сам: полки и склад не трогает.
 */
export function vanCargo(state: StoreState, event: VanEventId, day = state.day): { id: ProductId; n: number }[] {
  const sells = sellableProducts(day === state.day ? state : { ...state, day });
  const ids = (Object.keys(VAN_EVENTS[event].wants) as ProductId[]).filter((id) => sells.includes(id) && vanWant(state, event, id, day) > 0);
  ids.sort((a, b) => vanWant(state, event, b, day) - vanWant(state, event, a, day));
  const out: { id: ProductId; n: number }[] = [];
  let room = VAN_CAP;
  for (const id of ids) {
    const n = Math.min(room, vanWant(state, event, id, day));
    if (n <= 0) break;
    out.push({ id, n });
    room -= n;
  }
  return out;
}

/** Сколько обычно приносит выезд чистыми (без толпы и случая в дороге): по этой цифре фургон и выбирает, куда ехать. */
export const vanGain = (state: StoreState, event: VanEventId, day = state.day): number =>
  vanCargo(state, event, day).reduce((sum, { id, n }) => sum + n * vanMargin(id, event), 0) - vanFuel(state, event);

/**
 * Худшая толпа (vanCrowd от 0,8) без случая в дороге: выезд, который при ней не окупает бензин, не едет - иначе в
 * шторм на матч с одним мороженым фургон уезжал и возвращался в минус без понятной причины.
 */
const vanFloorGain = (state: StoreState, event: VanEventId, day: number): number =>
  vanCargo(state, event, day).reduce((sum, { id, n }) => sum + Math.floor(n * 0.8) * vanMargin(id, event), 0) - vanFuel(state, event);

/** Можно купить фургон: минимаркет и больше, в Центре (в Заречье — своя лавка без фургона). */
export const vanOpen = (state: StoreState): boolean => state.level >= VAN_LEVEL && !inZar(state);

/**
 * Куда фургон едет в этот день (по умолчанию — сегодня): самое выгодное из событий дня. null — фургона нет, мы в
 * Заречье (фургон ждёт возвращения в Центр), выездов нет или везти нечего.
 */
export function vanTripOn(state: StoreState, day = state.day): VanEventId | null {
  if (!state.van || !vanOpen(state)) return null;
  let best: VanEventId | null = null;
  let gain = 0;
  for (const id of vanEvents(state, day)) {
    const g = vanGain(state, id, day);
    if (g > gain && vanFloorGain(state, id, day) > 0) [best, gain] = [id, g];
  }
  return best;
}

/** Выезд в календаре фургона: день, куда и сколько он там обычно зарабатывает. */
export interface VanPlan {
  day: number;
  event: VanEventId;
  gain: number;
}

/**
 * 15.11, автор: «непонятно, когда он едет». Ближайшие выезды — с сегодняшнего дня, не больше n штук и не дальше
 * horizon дней: календарь в карточке фургона. В день — один выезд (самый выгодный). Пляж дальше сегодняшнего дня —
 * по прогнозу погоды.
 */
export function vanCalendar(state: StoreState, n = 4, horizon = 14): VanPlan[] {
  const out: VanPlan[] = [];
  for (let d = 0; d <= horizon && out.length < n; d++) {
    const day = state.day + d;
    const event = vanTripOn(state, day);
    if (event) out.push({ day, event, gain: vanGain(state, event, day) });
  }
  return out;
}

export function buyVan(state: StoreState): StoreState | null {
  if (state.van || !vanOpen(state) || state.money < VAN_PRICE) return null;
  return { ...state, money: state.money - VAN_PRICE, van: { since: state.day } };
}

// ---------- Вечер ----------

/** Случай в дороге сегодня (одинаковый в любой момент дня — от зерна и дня). */
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
 * Итог сегодняшнего выезда — чистый расчёт: сцена показывает его, когда фургон вернулся, ночь — зачисляет.
 * Продано — сколько разобрали (толпа и случай в дороге), но не больше груза; товар — проданное по закупочной цене.
 */
export function vanOutcome(state: StoreState): VanResult | null {
  const event = vanTripOn(state);
  if (!event) return null;
  const incident = vanIncident(state, event);
  const share = (incident ? VAN_INCIDENTS[incident].sales : 1) * vanCrowd(state);
  let sold = 0;
  let revenue = 0;
  let goods = 0;
  for (const { id, n } of vanCargo(state, event)) {
    const k = Math.min(n, Math.floor(vanWant(state, event, id) * share));
    sold += k;
    revenue += k * vanPrice(id, event);
    goods += k * PRODUCTS[id].cost;
  }
  const extra = incident === 'wheel' ? -VAN_REPAIR : incident === 'generous' ? Math.max(VAN_TIP_MIN, Math.round((revenue * VAN_TIP) / 10) * 10) : 0;
  const fuel = vanFuel(state, event);
  return { day: state.day, event, sold, revenue, goods, incident, extra, fuel, net: revenue - goods + extra - fuel };
}

/** Ночь (day.ts nightCycle, до счетов): итог выезда — в кассу. Выезда сегодня не было — ничего не меняется. */
export function settleVan(state: StoreState, day: StoreState = state): { state: StoreState; result: VanResult | null } {
  const van = state.van;
  // Итог считается по магазину дня (day - состояние до вечера): вечерняя проверка лицензии не меняет задним числом
  // ни выезд, ни сумму, которую игрок уже видел над вернувшимся фургоном.
  const result = van ? vanOutcome(day) : null;
  if (!van || !result) return { state, result: null };
  // 14.11, аудит: колесо и бензин в неудачный выезд могли увести кассу в минус — нехватка уходит в долг, как у всех.
  const money = state.money + result.net;
  return {
    state: { ...state, money: Math.max(0, money), debt: state.debt + Math.max(0, -money), van: { ...van, last: { ...result, back: 0, spoiled: 0, seen: true }, trips: (van.trips ?? 0) + 1, earned: (van.earned ?? 0) + result.net } },
    result,
  };
}

/**
 * Сохранение до 27.11: утром загруженный кузов (груз с полок и склада) — назад на склад, сколько влезет; что не
 * влезло, магазин продаёт по закупочной цене (в Заречье склад чужой — продаёт всё). «Не едем» тоже снимаем.
 */
export function migrateVan(state: StoreState): StoreState {
  const van = state.van;
  if (!van || (van.trip === undefined && van.skip === undefined)) return state;
  const { trip, skip: _skip, ...rest } = van;
  const warehouse = { ...state.warehouse };
  let money = state.money;
  let room = inZar(state) ? 0 : Math.max(0, warehouseCapacity(state) - warehouseCount(state));
  for (const id of Object.keys(trip?.load ?? {}) as ProductId[]) {
    if (!(id in PRODUCTS)) continue;
    const units: Unit[] = trip?.load[id] ?? [];
    const k = Math.min(room, units.length);
    if (k) warehouse[id] = [...(warehouse[id] ?? []), ...units.slice(0, k)].sort((a, b) => b.age - a.age);
    room -= k;
    money += (units.length - k) * PRODUCTS[id].cost;
  }
  return { ...state, warehouse, money, van: rest };
}
