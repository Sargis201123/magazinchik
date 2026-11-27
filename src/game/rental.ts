// Прокат у входа (13.11, задача автора #61 «Прокат по погоде»). Стойка на тротуаре покупается утром во вкладке
// «Уголки». Что на ней — решает погода и время года: в дождь зонты, зимой и в снег санки и ватрушки, в остальные
// дни велосипеды и самокаты. Прохожие берут вещь на день: чем больше народу ходит мимо магазина (гости дня) и чем
// погода к месту, тем больше берут. Деньги за прокат приходят вечером, до счетов (как аренда флигеля).
//
// 27.11, автор: «20-40-120 - ну слабо. Что даёт изменение цены? Тогда цену можно убрать и оставить только прокат».
// 20/40/120 были залогом, а не ценой, и в большом магазине ничего не меняли: стойку разбирали всю при любом залоге.
// Залога, пропавших вещей и докупки больше нет. Стойка растёт с магазином сама (10 вещей в «Магазинчике» … 40
// в гипермаркете), цена проката за день видна в карточке, плитка «Уголков» показывает, сколько стойка принесёт сегодня.
// Сколько взяли — только от зерна магазина и дня (без общего генератора): прогноз утра совпадает с вечером.
// В Заречье хозяин работает в другом магазине — стойка в Центре в эти дни закрыта.
// В мире — scenes/rentalFx.ts (стойка и прохожие с вещами), в меню — ui/rental.ts.

import type { StoreState } from './economy';
import { isWet, weatherFor, type Weather } from './weather';
import { weatherToday } from './crisis';
import { yearTime } from './calendar';
import { homeLevel, inZar } from './zarshop';

/** Что стоит на стойке: зимний набор, колёса или зонты. */
export type RentalKit = 'winter' | 'wheels' | 'rain';
export type RentalItem = 'sled' | 'tube' | 'bike' | 'kick' | 'umbrella';

export interface Rental {
  /** Как прошёл прошлый день проката — для карточки утром. */
  last?: RentalDay & { day: number };
  /** Сколько стойка принесла за всё время. */
  earned?: number;
  /** До 27.11: вещей на стойке и залог. Новый код их не читает (стойка всегда полная), пишет на один выпуск (OLD_STAND). */
  stock?: number;
  deposit?: string;
}

/**
 * На один выпуск стойка пишется и со старыми полями: код до 27.11 (rentalOf) без них видит пустую стойку
 * и предлагает «докупить» 10 вещей. При откате или со старым кэшем клиента стойка у игрока полная. Убрать
 * в следующем выпуске.
 */
const OLD_STAND = { stock: 10, deposit: 'medium' } as const;

/** С какого дня и помещения («Магазинчик») можно поставить стойку: не в первые две недели, когда нового и так много. */
export const RENTAL_FROM_DAY = 16;
export const RENTAL_FROM_LEVEL = 1;
/** Стойка сразу с полным набором вещей. */
export const STAND_COST = 1500;
/** Сколько вещей на стойке по помещению: растёт с магазином сама («Магазинчик» 10 … гипермаркет 40). */
export const RENTAL_CAPS = [10, 10, 15, 20, 30, 40];
/** Какая доля гостей дня берёт вещь при обычном спросе. */
export const RENT_SHARE = 0.1;

export const KIT_ITEMS: Record<RentalKit, RentalItem[]> = { winter: ['sled', 'tube'], wheels: ['bike', 'kick'], rain: ['umbrella'] };
export const KIT_ICON: Record<RentalKit, string> = { winter: '🛷', wheels: '🚲', rain: '☂️' };
/** Цена проката одной вещи на день: зонт дешёвый, зато в дождь его берут нарасхват. */
export const KIT_PRICE: Record<RentalKit, number> = { winter: 25, wheels: 30, rain: 12 };

/** Набор дня: дождь — зонты в любое время года; зима или снег — санки и ватрушки; иначе — колёса. */
export function rentalKit(day: number, weather: Weather = weatherFor(day)): RentalKit {
  if (isWet(weather)) return 'rain';
  return weather === 'snow' || yearTime(day) === 'winter' ? 'winter' : 'wheels';
}

/** Спрос на прокат: в ливень зонты нарасхват, в снег — санки; летом катаются охотнее, чем весной и осенью. */
export function rentalDemand(day: number, weather: Weather = weatherFor(day)): number {
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

/**
 * Набор и спрос сегодня — по погоде дня с поправкой на беду района (crisis.ts: в буран — санки, в паводок — зонты,
 * в жару — колёса), как её видит игрок на улице.
 */
export const kitToday = (state: StoreState): RentalKit => rentalKit(state.day, weatherToday(state));
const demandToday = (state: StoreState): number => rentalDemand(state.day, weatherToday(state));

/** Стойка в сохранении; нет стойки — null. */
export const rentalOf = (state: StoreState): Rental | null => state.rental ?? null;

/** Сколько вещей на стойке: по помещению в Центре. */
export const rentalCap = (state: StoreState): number => RENTAL_CAPS[Math.max(0, Math.min(homeLevel(state), RENTAL_CAPS.length - 1))];

/** Стойку можно поставить: в Центре, с «Магазинчика» и третьей недели. */
export const rentalOpen = (state: StoreState): boolean => !inZar(state) && homeLevel(state) >= RENTAL_FROM_LEVEL && state.day >= RENTAL_FROM_DAY;

export function buyStand(state: StoreState): StoreState | null {
  if (!rentalOpen(state) || state.rental || state.money < STAND_COST) return null;
  return { ...state, money: state.money - STAND_COST, rental: { ...OLD_STAND } };
}

export interface RentalDay {
  kit: RentalKit;
  /** Сколько вещей взяли. */
  rented: number;
  /** Сколько денег: вещи × цена набора. */
  income: number;
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
 * День проката: passers — сколько людей придёт за день (гости дня, day.ts guestsToday). Утром — прогноз, вечером —
 * расчёт, они совпадают. null — стойки нет или хозяин сегодня в Заречье.
 */
export function rentalDay(state: StoreState, passers: number): RentalDay | null {
  if (!state.rental || inZar(state)) return null;
  const kit = kitToday(state);
  // День на день не приходится: ±20% к желающим.
  const want = Math.round(Math.max(0, passers) * RENT_SHARE * demandToday(state) * (0.8 + 0.4 * dayRoll(state)()));
  const rented = Math.min(rentalCap(state), want);
  return { kit, rented, income: rented * KIT_PRICE[kit] };
}

/** Вечер: деньги за прокат — в кассу (до счетов), итог дня — в карточку («вчера» и «всего»). */
export function rentalNight(state: StoreState, passers: number): { state: StoreState; day: RentalDay | null } {
  const r = state.rental;
  const day = rentalDay(state, passers);
  if (!r || !day) return { state, day: null };
  const rental: Rental = { last: { ...day, day: state.day }, earned: (r.earned ?? 0) + day.income, ...OLD_STAND };
  return { state: { ...state, money: state.money + day.income, rental }, day };
}

/** Что принесла стойка в прошлый вечер (null — вчера не работала) и всего: для карточки. */
export function rentalLog(state: StoreState): { icon: string; n: number; last: number; total: number } | null {
  const last = state.rental?.last;
  // Значок вчерашнего набора: вчера зонты по 12, сегодня велосипеды по 30 - без него «30 шт.: +360» рядом с
  // «16 из 30 - ~480» читалось как ошибка.
  return last && last.day === state.day - 1 ? { icon: KIT_ICON[last.kit] ?? '', n: last.rented, last: last.income, total: state.rental?.earned ?? last.income } : null;
}

/** Что видно в мире: стойка есть, что на ней и какого она размера. Изменилось — сцена ставит стойку заново. */
export const rentalLook = (state: StoreState): string => (state.rental && !inZar(state) ? `${kitToday(state)}:${rentalCap(state)}` : '');
