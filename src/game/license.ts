// Лицензия на пиво и сигареты (13.11, автор: задача #62). Дорогая бумага из «Развития» открывает два товара
// с высокой наценкой: их берут ближе к закрытию, и вечером заходят лишние гости. Товар стоит в «Витрине 18+»
// у кассы (полка на своём месте, как ларь и полка «От бабушки»), закупают его у оптовика.
//
// Обратная сторона: иногда у кассы подросток просит пиво (особый гость, special.ts). Продать — выручка сейчас
// и нарушение в счёт; отказать — он надуется, но всё чисто. Нарушения копятся до проверки. Проверка приходит
// иногда (от зерна магазина и дня): нашла нарушения — штраф; попались второй раз — лицензию отбирают,
// пиво и сигареты изымают, покупать заново. Всё денежное — от seed и дня (как catFind в cat.ts), без общего
// генератора: перезапуск дня ничего не меняет.
//
// Подаём нейтрально: игра для всех возрастов. Товар как товар, без праздника вокруг него; продажа подростку —
// явно плохой поступок, и игра это так и называет.

import { PRODUCT_IDS, restricted, SHELF_KINDS, type ProductId, type Shelf, type StoreState } from './economy';
import { inZar } from './zarshop';
import { rng } from './random';

/**
 * С какого помещения можно купить лицензию (= SHELF_KINDS.license.minLevel): с «Супермаркета» — в «Минимаркете»
 * у кассы нет свободного пола под витрину (layout.ts licenseSpotFor).
 */
export const LICENSE_LEVEL = SHELF_KINDS.license.minLevel ?? 3;
/**
 * Цена лицензии. Дорогая: в «Супермаркете» это дней пять-шесть прибыли. В симуляторе (8 прогонов × 150 дней,
 * 13.11) игрок берёт её к «Универмагу», прибыль дня растёт на ~15% (≈5200 → ≈6000), окупается недели за три-четыре.
 */
export const LICENSE_PRICE = 20000;
/** Вечерние гости: сверху к потоку дня (day.ts guestFactor), в зале — в последнюю треть смены (licenseRate). */
export const LICENSE_GUESTS = 0.06;
/**
 * Доля пива и сигарет в корзинах (demand.ts) относительно обычного товара: берут их не все. Подобрано
 * симулятором: при доле как у хлеба лицензия поднимала прибыль на четверть — слишком щедро.
 */
export const LICENSE_DEMAND = 0.6;
/** С какой доли дня начинается «вечер»: гостей за пивом и сигаретами больше. */
export const EVENING_FROM = 0.7;
/** Витрина встаёт сразу на втором уровне (12 мест): шесть банок и шесть пачек. */
export const COUNTER_LEVEL = 1;

/** Подросток у кассы: в какой доле дней заходит и сколько банок просит. */
export const TEEN_CHANCE = 0.3;
export const TEEN_CANS = 2;
/** Проверка: в какой доле дней приходит и сколько дней после покупки её ещё не бывает. */
export const INSPECT_CHANCE = 0.12;
export const INSPECT_AFTER = 3;
/** Штраф за каждое найденное нарушение. Продажа подростку приносит ~130 💰 — штраф перекрывает её с лихвой. */
export const LICENSE_FINE = 2000;

export interface LicenseCheck {
  day: number;
  /** Сколько нарушений нашли и штраф (0 — всё чисто). */
  found: number;
  fine: number;
  /** Лицензию отобрали. */
  revoked?: boolean;
  /** Утреннюю карточку о штрафе закрыли. */
  seen?: boolean;
}

export interface LicenseState {
  /** С какого дня лицензия действует. Нет — её нет (отобрали; купить можно заново). */
  since?: number;
  /** Продажи подросткам с прошлой проверки. */
  strikes: number;
  /** Сколько раз штрафовали по этой лицензии: попались снова — отберут. */
  fined: number;
  /** Последняя проверка. */
  last?: LicenseCheck;
}

export const hasLicense = (state: StoreState): boolean => state.license?.since !== undefined;

/** Почему купить нельзя: мало места (помещение) или ты в Заречье — лицензия выдана на магазин в Центре. */
export function licenseLock(state: StoreState): 'level' | 'zar' | null {
  if (inZar(state)) return 'zar';
  return state.level < LICENSE_LEVEL ? 'level' : null;
}

/** Купить лицензию: деньги — сразу, у кассы встаёт «Витрина 18+». Нарушения и штрафы — с чистого листа. */
export function buyLicense(state: StoreState): StoreState | null {
  if (hasLicense(state) || licenseLock(state) || state.money < LICENSE_PRICE) return null;
  const counter: Shelf = { kind: 'license', level: COUNTER_LEVEL, items: {} };
  const shelves = state.shelves.some((s) => s.kind === 'license') ? state.shelves : [...state.shelves, counter];
  return { ...state, money: state.money - LICENSE_PRICE, shelves, license: { since: state.day, strikes: 0, fined: 0, last: state.license?.last && { ...state.license.last, seen: true } } };
}

/** Бросок от зерна магазина, дня и соли — одинаковый при каждом перезапуске дня. */
const roll = (state: StoreState, salt: number): number => rng(((state.seed ?? 1) * 2654435761 + state.day * 40503 + salt * 97) >>> 0)();

const counterStock = (state: StoreState, id: ProductId): number => state.shelves.reduce((sum, s) => sum + (s.kind === 'license' ? (s.items[id]?.length ?? 0) : 0), 0);

/** Заглянет ли сегодня подросток за пивом: лицензия со вчера или раньше и на витрине есть банки. */
export function teenToday(state: StoreState): boolean {
  const since = state.license?.since;
  if (since === undefined || state.day <= since || inZar(state)) return false;
  return counterStock(state, 'beer') >= TEEN_CANS && roll(state, 1) < TEEN_CHANCE;
}

/** Сколько подросток заплатит за банки по ценнику. */
export const teenPay = (state: StoreState): number => state.prices.beer * TEEN_CANS;

/**
 * Ответ подростку. Продал — банки уходят с витрины, деньги в кассу, нарушение в счёт. Отказал — ничего:
 * обида только у него. Без лицензии или без банок продавать нечего.
 */
export function answerTeen(state: StoreState, sell: boolean): { state: StoreState; money: number } {
  const license = state.license;
  if (!sell || !license || license.since === undefined || counterStock(state, 'beer') < TEEN_CANS) return { state, money: 0 };
  let left = TEEN_CANS;
  const shelves = state.shelves.map((s) => {
    if (s.kind !== 'license' || !left) return s;
    const units = s.items.beer ?? [];
    const k = Math.min(left, units.length);
    left -= k;
    return { ...s, items: { ...s.items, beer: units.slice(k) } };
  });
  const pay = teenPay(state);
  return { state: { ...state, shelves, money: state.money + pay, license: { ...license, strikes: license.strikes + 1 } }, money: pay };
}

/** Придёт ли сегодня вечером проверка. */
export const inspectionToday = (state: StoreState): boolean => {
  const since = state.license?.since;
  return since !== undefined && state.day >= since + INSPECT_AFTER && !inZar(state) && roll(state, 2) < INSPECT_CHANCE;
};

/** Отобрать лицензию: витрину убирают, пиво и сигареты изымают — с полок, склада и полки уценки. */
export function revokeLicense(state: StoreState): StoreState {
  const strip = <T extends Partial<Record<ProductId, unknown>>>(stock: T): T => {
    const out = { ...stock };
    for (const id of PRODUCT_IDS) if (restricted(id)) delete out[id];
    return out;
  };
  return {
    ...state,
    shelves: state.shelves.filter((s) => s.kind !== 'license').map((s) => ({ ...s, items: strip(s.items) })),
    warehouse: strip(state.warehouse),
    ...(state.bargain ? { bargain: strip(state.bargain) } : {}),
    license: { strikes: 0, fined: 0, last: state.license?.last },
  };
}

/**
 * Ночь: если сегодня была проверка — итог. Нарушений нет — «всё чисто». Есть — штраф за каждое (сколько не
 * хватит в кассе — в долг, как штраф санинспекции в events.ts); уже штрафовали — ещё и лицензию отбирают.
 */
export function licenseNight(state: StoreState): StoreState {
  const license = state.license;
  if (!license || !inspectionToday(state)) return state;
  const found = license.strikes;
  if (!found) return { ...state, license: { ...license, last: { day: state.day, found: 0, fine: 0, seen: true } } };
  const fine = LICENSE_FINE * found;
  const revoked = license.fined > 0;
  const paid: StoreState = {
    ...state,
    money: Math.max(0, state.money - fine),
    debt: state.debt + Math.max(0, fine - Math.max(0, state.money)),
    license: { ...license, strikes: 0, fined: license.fined + 1, last: { day: state.day, found, fine, ...(revoked ? { revoked: true } : {}) } },
  };
  return revoked ? revokeLicense(paid) : paid;
}

/** Штраф или изъятие, о котором утром ещё не сказали (утренняя карточка, ui/license.ts). */
export const licenseNotice = (state: StoreState): LicenseCheck | null => {
  const last = state.license?.last;
  return last && last.fine > 0 && !last.seen ? last : null;
};

export const seeLicenseNotice = (state: StoreState): StoreState =>
  state.license?.last ? { ...state, license: { ...state.license, last: { ...state.license.last, seen: true } } } : state;

/** Вечерние гости — сверху к потоку дня (day.ts guestFactor): только с лицензией и витриной. */
export const licenseGuests = (state: StoreState): number => (hasLicense(state) && state.shelves.some((s) => s.kind === 'license') ? 1 + LICENSE_GUESTS : 1);

/**
 * В зале те же лишние гости приходят вечером: днём поток как без лицензии, в последнюю треть смены — гуще.
 * Множитель частоты появления гостей; в среднем за день — ровно 1 (guestFactor уже учёл LICENSE_GUESTS).
 */
export function licenseRate(state: StoreState, share: number): number {
  if (licenseGuests(state) === 1) return 1;
  const k = 1 + LICENSE_GUESTS;
  return share < EVENING_FROM ? 1 / k : (1 + LICENSE_GUESTS / (1 - EVENING_FROM)) / k;
}

/**
 * Ближе к закрытию пиво и сигареты берут чаще: с утра — вполовину, к вечеру — в полтора раза (в среднем за день
 * — как обычно: симулятор считает средний день). Только в зале; share — доля прошедшего дня.
 */
export const eveningPull = (id: ProductId, share: number): number => (restricted(id) ? 0.5 + Math.min(1, Math.max(0, share)) : 1);
