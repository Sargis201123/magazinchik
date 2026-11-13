// Прокат у входа (13.11, задача автора #61 «Прокат по погоде»). Стойка на тротуаре покупается утром во вкладке
// «Уголки». Что на ней — решает погода и время года: в дождь зонты, зимой и в снег санки и ватрушки, в остальные
// дни велосипеды и самокаты. Прохожие берут вещь на день: чем больше народу ходит мимо магазина (гости дня) и чем
// погода к месту, тем больше берут. Деньги за прокат приходят вечером, до счетов (как аренда флигеля).
//
// Залог выбирает игрок: маленький — берут охотнее, но вещь чаще не возвращают; большой — берут реже, зато почти
// всё возвращается. Невернувшаяся вещь пропадает со стойки (залог остаётся у нас), запас докупается за монеты.
// Сколько взяли и что пропало — только от зерна магазина и дня (без общего генератора): прогноз утра честный.
// В Заречье хозяин работает в другом магазине — стойка в Центре в эти дни закрыта.
// В мире — scenes/rentalFx.ts (стойка и прохожие с вещами), в меню — ui/rental.ts.

import type { StoreState } from './economy';
import { isWet, weatherFor } from './weather';
import { yearTime } from './calendar';
import { homeLevel, inZar } from './zarshop';

/** Что стоит на стойке: зимний набор, колёса или зонты. */
export type RentalKit = 'winter' | 'wheels' | 'rain';
export type RentalItem = 'sled' | 'tube' | 'bike' | 'kick' | 'umbrella';
export type Deposit = 'small' | 'medium' | 'large';
export const DEPOSIT_IDS: Deposit[] = ['small', 'medium', 'large'];

export interface Rental {
  /** Сколько вещей на стойке (остальные пропали — докупить). */
  stock: number;
  deposit: Deposit;
  /** Как прошёл прошлый день проката — для карточки утром. */
  last?: RentalDay & { day: number };
  /** Сколько стойка принесла за всё время. */
  earned?: number;
}

/** С какого дня и помещения («Магазинчик») можно поставить стойку: не в первые две недели, когда нового и так много. */
export const RENTAL_FROM_DAY = 16;
export const RENTAL_FROM_LEVEL = 1;
/** Стойка сразу с полным набором вещей. */
export const STAND_COST = 1500;
export const RENTAL_CAP = 10;
/** Докупить одну пропавшую вещь. */
export const ITEM_COST = 80;
/** Какая доля гостей дня берёт вещь при обычном спросе и среднем залоге. */
export const RENT_SHARE = 0.1;

export const KIT_ITEMS: Record<RentalKit, RentalItem[]> = { winter: ['sled', 'tube'], wheels: ['bike', 'kick'], rain: ['umbrella'] };
export const KIT_ICON: Record<RentalKit, string> = { winter: '🛷', wheels: '🚲', rain: '☂️' };
/** Цена проката одной вещи на день: зонт дешёвый, зато в дождь его берут нарасхват. */
export const KIT_PRICE: Record<RentalKit, number> = { winter: 25, wheels: 30, rain: 12 };

/**
 * Залог: сумма, во сколько раз охотнее берут (маленький залог не пугает) и шанс, что вещь не вернут. Маленький
 * выгоден, пока прохожих мало и стойка не пустеет, но вещи пропадают каждый день-два; большой — когда желающих
 * больше, чем вещей: берут столько же (всё равно разбирают всю стойку), а возвращают почти всё.
 * 13.11, прогон дней 16–127 с докупкой каждое утро (чистыми в день): «Магазинчик» — маленький ≈ средний ≈ 90,
 * большой 72; «Супермаркет» — средний 179, маленький и большой ~160; гипермаркет — большой 245, средний 223.
 * В ливень у большого магазина желающих вдвое больше вещей — там и большой залог выгоднее.
 */
export const DEPOSITS: Record<Deposit, { sum: number; take: number; lose: number }> = {
  small: { sum: 20, take: 1.4, lose: 0.12 },
  medium: { sum: 40, take: 1, lose: 0.04 },
  large: { sum: 120, take: 0.75, lose: 0.01 },
};

/** Набор дня: дождь — зонты в любое время года; зима или снег — санки и ватрушки; иначе — колёса. */
export function rentalKit(day: number): RentalKit {
  const weather = weatherFor(day);
  if (isWet(weather)) return 'rain';
  return weather === 'snow' || yearTime(day) === 'winter' ? 'winter' : 'wheels';
}

/** Спрос на прокат: в ливень зонты нарасхват, в снег — санки; летом катаются охотнее, чем весной и осенью. */
export function rentalDemand(day: number): number {
  const weather = weatherFor(day);
  if (weather === 'storm') return 2;
  if (weather === 'rain') return 1.8;
  if (weather === 'snow') return 1.4;
  const season = yearTime(day);
  // Зима без снега: ватрушкам скучно.
  if (season === 'winter') return 0.6;
  if (season === 'summer') return weather === 'heat' ? 0.9 : 1.2;
  if (season === 'spring') return 0.9;
  return weather === 'leaves' ? 0.8 : 0.7;
}

/** Стойка в сохранении — с поправкой на испорченные поля; нет стойки — null. */
export function rentalOf(state: StoreState): Rental | null {
  const r = state.rental;
  if (!r) return null;
  const stock = Math.max(0, Math.min(RENTAL_CAP, Math.floor(Number(r.stock) || 0)));
  const deposit = r.deposit in DEPOSITS ? r.deposit : 'medium';
  return stock === r.stock && deposit === r.deposit ? r : { ...r, stock, deposit };
}

/** Стойку можно поставить: в Центре, с «Магазинчика» и третьей недели. */
export const rentalOpen = (state: StoreState): boolean => !inZar(state) && homeLevel(state) >= RENTAL_FROM_LEVEL && state.day >= RENTAL_FROM_DAY;

export function buyStand(state: StoreState): StoreState | null {
  if (!rentalOpen(state) || state.rental || state.money < STAND_COST) return null;
  return { ...state, money: state.money - STAND_COST, rental: { stock: RENTAL_CAP, deposit: 'medium' } };
}

/** Докупить пропавшие вещи (сколько влезет на стойку и на сколько хватит денег). */
export function restockRental(state: StoreState, n: number): StoreState | null {
  const r = rentalOf(state);
  if (!r) return null;
  const k = Math.min(n, RENTAL_CAP - r.stock, Math.floor(state.money / ITEM_COST));
  if (k <= 0) return null;
  return { ...state, money: state.money - k * ITEM_COST, rental: { ...r, stock: r.stock + k } };
}

export function setDeposit(state: StoreState, deposit: Deposit): StoreState | null {
  const r = rentalOf(state);
  if (!r || !(deposit in DEPOSITS) || r.deposit === deposit) return null;
  return { ...state, rental: { ...r, deposit } };
}

export interface RentalDay {
  kit: RentalKit;
  /** Сколько вещей взяли. */
  rented: number;
  /** Сколько не вернули. */
  lost: number;
  /** Всего денег: прокат плюс залоги за невернувшиеся вещи. */
  income: number;
  /** Из них — оставшиеся у нас залоги. */
  kept: number;
}

/** Генератор дня проката: от зерна магазина и дня (общий генератор и симулятор не трогаются). */
function dayRoll(state: StoreState): () => number {
  let h = (((state.seed ?? 1) * 2654435761) ^ (state.day * 2246822519) ^ 0x5bd1e995) >>> 0;
  return () => {
    h = (h ^ (h << 13)) >>> 0;
    h = (h ^ (h >>> 17)) >>> 0;
    h = (h ^ (h << 5)) >>> 0;
    return h / 4294967296;
  };
}

/**
 * День проката: passers — сколько людей придёт за день (гости дня, day.ts guestsToday). Утром — прогноз (без потерь
 * он точный), вечером — расчёт. null — стойки нет или хозяин сегодня в Заречье.
 */
export function rentalDay(state: StoreState, passers: number): RentalDay | null {
  const r = rentalOf(state);
  if (!r || inZar(state)) return null;
  const kit = rentalKit(state.day);
  const dep = DEPOSITS[r.deposit];
  const roll = dayRoll(state);
  // День на день не приходится: ±20% к желающим.
  const want = Math.round(Math.max(0, passers) * RENT_SHARE * rentalDemand(state.day) * dep.take * (0.8 + 0.4 * roll()));
  const rented = Math.min(r.stock, want);
  let lost = 0;
  for (let i = 0; i < rented; i++) if (roll() < dep.lose) lost++;
  const kept = lost * dep.sum;
  return { kit, rented, lost, income: rented * KIT_PRICE[kit] + kept, kept };
}

/** Вечер: деньги за прокат — в кассу (до счетов), невернувшиеся вещи — со стойки. */
export function rentalNight(state: StoreState, passers: number): { state: StoreState; day: RentalDay | null } {
  const r = rentalOf(state);
  const day = rentalDay(state, passers);
  if (!r || !day) return { state, day: null };
  const rental: Rental = { ...r, stock: r.stock - day.lost, last: { ...day, day: state.day }, earned: (r.earned ?? 0) + day.income };
  return { state: { ...state, money: state.money + day.income, rental }, day };
}

/** Что видно в мире: стойка есть и что на ней. Изменилось — сцена ставит стойку заново. */
export const rentalLook = (state: StoreState): string => {
  const r = rentalOf(state);
  return r && !inZar(state) ? `${rentalKit(state.day)}:${r.stock}` : '';
};
