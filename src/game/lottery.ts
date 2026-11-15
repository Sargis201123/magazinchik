// Лотерея у кассы (13.11, автор: задача #59). Стойку с билетами ставят утром в «Уголках», как радио или
// стойку со сладостями. Пока стоишь в очереди, можно взять билет: магазину с билета — небольшая доля, без
// закупок и без запаса (scenes/lotteryFx.ts: билет летит со стойки в руки). Вечером — тираж: изредка билет
// «из нашего магазина» выигрывает крупно — утром новость (headlines.ts), премия магазину, счастливчик
// приходит с тортом, и несколько дней «здесь счастливый магазин» — гостей больше и билеты берут охотнее.
// Риски: город иногда на несколько дней запрещает лотереи (стойка закрыта), а проигравшие ворчат у кассы
// и в отзывах (без жалоб — рейтинг это не роняет, автор просил «не жёстко»).
//
// Тираж и запреты — от зерна магазина и дня (как catFind, cat.ts): перезапуск дня ничего не перекатывает,
// общий генератор случайностей симулятора не сдвигается.

import type { StoreState } from './economy';
import { inZar } from './zarshop';

export interface LotteryState {
  /** День, когда поставили стойку. */
  since: number;
  /** Сколько билетов продали за всё время (доля магазина — sold × TICKET_CUT). */
  sold?: number;
  /** Последний крупный выигрыш: день тиража (вечер), прочитана ли новость. */
  win?: { day: number; seen?: boolean };
  /** Запрет города: с какого по какой день стойка закрыта, прочитана ли новость. */
  ban?: { from: number; until: number; seen?: boolean };
  // 15.11, автор: «непонятно, кто что выиграл и получил ли игрок деньги». Ниже — статистика для карточки.
  /** Последний день с проданными билетами: сколько их было и сколько выиграли (вчера — если day = сегодня − 1). */
  today?: { day: number; n: number; w?: number };
  /** Вечерних тиражей, пока стойка работала. */
  draws?: number;
  /** Выигравших билетов из нашего магазина (мелких и крупных) и сколько всего выиграли наши покупатели. */
  wins?: number;
  prizes?: number;
  /** Крупных выигрышей (за каждый — премия магазину WIN_BONUS). */
  bigs?: number;
  /** Последние выигрыши — для списка в карточке (не больше LOG_MAX, новые в конце). */
  log?: LotteryWin[];
}

/** Выигрыш билета из нашего магазина: день, кто (номер имени, staffName), сколько, крупный ли. */
export interface LotteryWin {
  day: number;
  who: number;
  prize: number;
  big?: boolean;
}

/** Цена стойки: как терминал (600) — дороже радио (350), дешевле печи и кофейни. */
export const LOTTERY_PRICE = 600;
/** С «Магазинчика»: в ларьке у кассы и так тесно. */
export const LOTTERY_MIN_LEVEL = 1;
/** Доля магазина с билета (как прибыль с шоколадки: 15 − 9 = 6). */
export const TICKET_CUT = 5;
/** Сколько из стоящих в очереди берут билет. */
export const TICKET_CHANCE = 0.1;
/** В «счастливом магазине» билеты берут охотнее. */
export const LUCKY_TICKETS = 1.5;
/** Шанс, что в вечернем тираже крупно выиграл наш билет (≈ раз в месяц-полтора). */
export const WIN_CHANCE = 0.03;
/** Премия магазину, продавшему счастливый билет. */
export const WIN_BONUS = 500;
/** «Здесь счастливый магазин»: столько дней после тиража гостей больше — на столько. */
export const LUCKY_DAYS = 5;
export const LUCKY_GUESTS = 0.08;
/** Шанс, что вечером город объявит запрет, и на сколько дней. */
export const BAN_CHANCE = 0.025;
export const BAN_DAYS = 3;
/** Первые дни после покупки — ни запретов, ни тиражей: стойка успевает себя показать. */
export const GRACE_DAYS = 3;
/**
 * Мелкие выигрыши (15.11): примерно каждый восьмой билет что-то выигрывает — 20, 50 или 100. Платит их лотерея,
 * не касса магазина: деньги игрока это не трогает, зато видно, что билеты «работают» и людям везёт.
 */
export const SMALL_WIN_CHANCE = 0.12;
export const SMALL_PRIZES = [20, 20, 20, 50, 50, 100] as const;
/** Крупный выигрыш счастливчика (тоже платит лотерея): от 10 000 до 100 000. */
export const JACKPOTS = [10000, 25000, 50000, 100000] as const;
/** Сколько последних выигрышей помнить для карточки. */
export const LOG_MAX = 5;
/** Сколько имён у счастливчиков (staffName: тот же список имён, что у сотрудников). */
export const WHO_COUNT = 16;

const lotteryOf = (state: StoreState): LotteryState | undefined => state.lottery;
export const hasLottery = (state: StoreState): boolean => state.lottery !== undefined;

/** Число 0…1 от зерна магазина, дня и соли — своё у тиража и у запрета. */
export function lotteryRoll(state: StoreState, day: number, salt: number): number {
  let h = (Math.imul(state.seed ?? 1, 0x9e3779b1) ^ Math.imul(day + 1, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const WIN_SALT = 59;
const BAN_SALT = 137;
const SMALL_SALT = 211;
const PRIZE_SALT = 263;
const WHO_SALT = 331;

/** Стойка закрыта по запрету в этот день. */
export const lotteryBanned = (state: StoreState, day = state.day): boolean => {
  const ban = lotteryOf(state)?.ban;
  return Boolean(ban && day >= ban.from && day <= ban.until);
};

/** «Счастливый магазин»: дни после тиража с нашим выигрышем (сам вечер тиража — ещё нет). */
export const luckyOn = (state: StoreState, day = state.day): boolean => {
  const win = lotteryOf(state)?.win;
  return Boolean(win && day > win.day && day <= win.day + LUCKY_DAYS);
};

/** Сколько «счастливых» дней осталось, считая сегодняшний (0 — не счастливый). */
export const luckyLeft = (state: StoreState): number => (luckyOn(state) ? lotteryOf(state)!.win!.day + LUCKY_DAYS - state.day + 1 : 0);

/** Стойка работает: куплена и нет запрета. */
export const lotteryOpen = (state: StoreState, day = state.day): boolean => hasLottery(state) && !lotteryBanned(state, day);

/** Шанс, что стоящий в очереди возьмёт билет (стойка — в Центре: в Заречье её нет). */
export function ticketChance(state: StoreState): number {
  if (!lotteryOpen(state) || inZar(state)) return 0;
  return TICKET_CHANCE * (luckyOn(state) ? LUCKY_TICKETS : 1);
}

/** Множитель гостей: «здесь счастливый магазин». */
export const lotteryGuests = (state: StoreState): number => (luckyOn(state) ? 1 + LUCKY_GUESTS : 1);

export function buyLottery(state: StoreState): StoreState | null {
  if (hasLottery(state) || state.level < LOTTERY_MIN_LEVEL || state.money < LOTTERY_PRICE) return null;
  return { ...state, money: state.money - LOTTERY_PRICE, lottery: { since: state.day } };
}

/**
 * Выиграл ли билет номер n (по счёту проданных за всё время) и сколько — от зерна магазина и номера: тот же
 * билет выигрывает одинаково, сколько ни перезапускай день. 0 — пусто.
 */
export function ticketPrize(state: StoreState, n: number): number {
  if (lotteryRoll(state, n, SMALL_SALT) >= SMALL_WIN_CHANCE) return 0;
  return SMALL_PRIZES[Math.floor(lotteryRoll(state, n, PRIZE_SALT) * SMALL_PRIZES.length)];
}

/** Кто выиграл: номер имени — от зерна, дня и соли (у крупного — свой). */
const whoWon = (state: StoreState, n: number): number => Math.floor(lotteryRoll(state, n, WHO_SALT) * WHO_COUNT);

/** Выигрыш — в статистику и в короткий список последних. */
function addWin(lot: LotteryState, win: LotteryWin): LotteryState {
  return {
    ...lot,
    wins: (lot.wins ?? 0) + 1,
    prizes: (lot.prizes ?? 0) + win.prize,
    ...(win.big ? { bigs: (lot.bigs ?? 0) + 1 } : {}),
    log: [...(lot.log ?? []), win].slice(-LOG_MAX),
  };
}

/**
 * Билет пробили на кассе: деньги магазину идут вместе с чеком (extras), здесь — счёт проданных (всего и за
 * сегодня) и мгновенный выигрыш билета (ticketPrize: стираешь слой — и сразу видно). Выигрыш платит лотерея.
 */
export function countTicket(state: StoreState): StoreState {
  const lot = lotteryOf(state);
  if (!lot) return state;
  const sold = (lot.sold ?? 0) + 1;
  const prize = ticketPrize(state, sold);
  const same = lot.today?.day === state.day;
  const w = (same ? (lot.today?.w ?? 0) : 0) + (prize ? 1 : 0);
  const today = { day: state.day, n: same ? lot.today!.n + 1 : 1, ...(w ? { w } : {}) };
  const next: LotteryState = { ...lot, sold, today };
  return { ...state, lottery: prize ? addWin(next, { day: state.day, who: whoWon(state, sold), prize }) : next };
}

/** Сколько билетов взяли вчера (для карточки утром). */
export const ticketsYesterday = (state: StoreState): number => (lotteryOf(state)?.today?.day === state.day - 1 ? lotteryOf(state)!.today!.n : 0);
/** Сколько билетов взяли сегодня. */
export const ticketsToday = (state: StoreState): number => (lotteryOf(state)?.today?.day === state.day ? lotteryOf(state)!.today!.n : 0);
/**
 * Строка лотереи в итогах дня (nightShift): сколько билетов взяли за день day, доля магазина, сколько билетов
 * выиграло и был ли в вечернем тираже крупный выигрыш (after — состояние после ночи). null — нечего показать.
 */
export function lotteryDay(before: StoreState, after: StoreState, day: number): { n: number; sum: number; w: number; big: boolean } | null {
  const today = lotteryOf(before)?.today;
  const n = today?.day === day ? today.n : 0;
  const big = lotteryOf(after)?.win?.day === day && lotteryOf(before)?.win?.day !== day;
  if (!n && !big) return null;
  return { n, sum: n * TICKET_CUT, w: today?.day === day ? (today.w ?? 0) : 0, big };
}

/** Премий магазину за крупные выигрыши за всё время. */
export const bonusEarned = (state: StoreState): number => (lotteryOf(state)?.bigs ?? 0) * WIN_BONUS;

/** Сколько всего принесли билеты (доля магазина). */
export const ticketsEarned = (state: StoreState): number => (lotteryOf(state)?.sold ?? 0) * TICKET_CUT;

/**
 * Вечер дня state.day (до счетов — премией можно расплатиться): тираж и решение города. Выигрыш —
 * только если стойка сегодня работала и сейчас не «счастливые» дни (они не копятся); запрет — со
 * следующего утра, не поверх запрета и не посреди «счастливых» дней (не отнимать радость).
 */
export function lotteryNight(state: StoreState): StoreState {
  const lot = lotteryOf(state);
  const day = state.day;
  // 14.11, аудит: хозяин в Заречье — стойка Центра закрыта, билетов не продают (ticketChance 0), значит, и тиража
  // с премией нет; запрет города тоже ждёт — закрывать нечего.
  if (!lot || day - lot.since < GRACE_DAYS || inZar(state)) return state;
  const next = day + 1;
  // 15.11: тираж считаем в карточку, только когда стойка в этот день работала.
  const open = lotteryOpen(state, day);
  const drawn: LotteryState = open ? { ...lot, draws: (lot.draws ?? 0) + 1 } : lot;
  if (open && !luckyOn(state, day) && lotteryRoll(state, day, WIN_SALT) < WIN_CHANCE) {
    const prize = JACKPOTS[Math.floor(lotteryRoll(state, day, PRIZE_SALT) * JACKPOTS.length)];
    const won = addWin(drawn, { day, who: whoWon(state, -day), prize, big: true });
    return { ...state, money: state.money + WIN_BONUS, lottery: { ...won, win: { day } } };
  }
  if (!lotteryBanned(state, next) && !luckyOn(state, next) && lotteryRoll(state, day, BAN_SALT) < BAN_CHANCE) {
    return { ...state, lottery: { ...drawn, ban: { from: next, until: next + BAN_DAYS - 1 } } };
  }
  return open ? { ...state, lottery: drawn } : state;
}

/** Утренняя новость (headlines.ts, вид 'lottery'): выигрыш — пока идут «счастливые» дни, запрет — пока он идёт. */
export function lotteryNews(state: StoreState): 'win' | 'ban' | null {
  const lot = lotteryOf(state);
  if (!lot) return null;
  if (lot.win && !lot.win.seen && luckyOn(state)) return 'win';
  if (lot.ban && !lot.ban.seen && lotteryBanned(state)) return 'ban';
  return null;
}

export function seeLotteryNews(state: StoreState): StoreState {
  const lot = lotteryOf(state);
  const kind = lotteryNews(state);
  if (!lot || !kind) return state;
  return kind === 'win' ? { ...state, lottery: { ...lot, win: { ...lot.win!, seen: true } } } : { ...state, lottery: { ...lot, ban: { ...lot.ban!, seen: true } } };
}

/** Счастливчик заходит с тортом на следующий день после тиража. */
export const winnerVisitToday = (state: StoreState): boolean => lotteryOf(state)?.win?.day === state.day - 1;

/** Как выглядит стойка в зале: нет, работает, закрыта по запрету, «счастливая». */
export type LotteryLook = 'none' | 'open' | 'closed' | 'lucky';
export function lotteryLook(state: StoreState): LotteryLook {
  if (!hasLottery(state)) return 'none';
  if (lotteryBanned(state)) return 'closed';
  return luckyOn(state) ? 'lucky' : 'open';
}

/** Сколько ворчат проигравшие: доля купивших билет, кто вспоминает вчерашний тираж. */
export const GRUMBLE_CHANCE = 0.2;
