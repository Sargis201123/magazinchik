// Козни конкурента на улице. Время от времени соперник напротив (Эдуард или босс района)
// устраивает пакость — утром о ней известно, и можно ответить:
// - промоутер у нашего входа зазывает гостей к себе (сегодня гостей меньше) —
//   поставить своего промоутера или пожаловаться участковому (может и не помочь);
// - перетяжка через дорогу «У нас дешевле!» на три дня — повесить свою или промолчать;
// - подставной «проверяющий» придёт днём и найдёт, к чему придраться (штраф вечером) —
//   устроить генеральную уборку или позвонить в настоящую инспекцию (разоблачат — конкурент
//   заплатит нам за беспокойство).

import type { StoreState } from './economy';

export type TrickKind = 'promoter' | 'banner' | 'inspector';
export type TrickAnswer = 'counter' | 'complain' | 'ignore';

export interface Trick {
  kind: TrickKind;
  /** С какого дня и по какой (перетяжка висит три дня). */
  day: number;
  until: number;
  answer?: TrickAnswer;
  /** Жалоба сработала: промоутера убрали, проверяющего разоблачили. */
  stopped?: boolean;
  /** Чем кончился проверяющий (считается вечером). */
  result?: 'fined' | 'passed' | 'exposed';
  fine?: number;
  /** Утром рассказали, чем кончилось. */
  seen?: boolean;
}

export const TRICK_FROM_DAY = 10;
export const TRICK_CHANCE = 0.16;
/** Не чаще, чем раз в столько дней. */
export const TRICK_GAP = 5;
export const BANNER_DAYS = 3;
/** Множители гостей. */
export const PROMOTER_GUESTS = 0.85;
export const OWN_PROMOTER_GUESTS = 1.05;
export const BANNER_GUESTS = 0.92;
export const OWN_BANNER_GUESTS = 1.03;
/** Жалоба срабатывает с такой вероятностью. */
export const COMPLAIN_CHANCE = 0.5;
/** Проверяющий без подготовки находит, к чему придраться. */
export const INSPECTOR_FINE_CHANCE = 0.6;
export const INSPECTOR_RATING = 0.05;

/** Сколько стоит ответ: свой промоутер, своя перетяжка, генеральная уборка. */
export const counterCost = (kind: TrickKind, level: number): number =>
  ({ promoter: 200 + 60 * level, banner: 300 + 80 * level, inspector: 150 + 50 * level })[kind];
export const inspectorFine = (level: number): number => 250 + 150 * level;
/** Разоблачили подставного — конкурент платит за беспокойство. */
export const exposedPay = (level: number): number => 150 + 100 * level;

/** Пакость, которая действует сегодня. */
export const activeTrick = (state: StoreState): Trick | undefined => {
  const t = state.trick;
  return t && state.day >= t.day && state.day <= t.until ? t : undefined;
};

/** Ждёт ответа утром (новая пакость сегодня, ещё не ответили). */
export const trickToday = (state: StoreState): Trick | undefined => {
  const t = activeTrick(state);
  return t && t.day === state.day && !t.answer ? t : undefined;
};

/** Утро: может начаться новая пакость (rivalHere — напротив кто-то торгует или Эдуард рядом). */
export function tricksMorning(state: StoreState, random: () => number): StoreState {
  if (state.day < TRICK_FROM_DAY) return state;
  const last = state.trick;
  if (last && state.day - last.day < TRICK_GAP) return state;
  if (last && state.day <= last.until) return state;
  if (random() >= TRICK_CHANCE) return state;
  const kinds: TrickKind[] = ['promoter', 'banner', 'inspector'];
  const kind = kinds[Math.floor(random() * kinds.length)];
  return { ...state, trick: { kind, day: state.day, until: state.day + (kind === 'banner' ? BANNER_DAYS - 1 : 0) } };
}

/** Ответ игрока утром. complain — жалоба: random решает, сработала ли. */
export function answerTrick(state: StoreState, answer: TrickAnswer, random: () => number = Math.random): StoreState | null {
  const trick = trickToday(state);
  if (!trick) return null;
  if (answer === 'complain' && trick.kind === 'banner') return null;
  const cost = answer === 'counter' ? counterCost(trick.kind, state.level) : 0;
  if (state.money < cost) return null;
  const stopped = answer === 'complain' ? random() < COMPLAIN_CHANCE : undefined;
  return { ...state, money: state.money - cost, trick: { ...trick, answer, stopped } };
}

/** Множитель гостей сегодня. */
export function trickGuests(state: StoreState): number {
  const trick = activeTrick(state);
  if (!trick) return 1;
  if (trick.kind === 'promoter') {
    if (trick.answer === 'counter') return OWN_PROMOTER_GUESTS;
    return trick.stopped ? 1 : PROMOTER_GUESTS;
  }
  if (trick.kind === 'banner') return trick.answer === 'counter' ? OWN_BANNER_GUESTS : BANNER_GUESTS;
  return 1;
}

/**
 * Вечер: чем кончился «проверяющий». Готовились — ушёл ни с чем; жалоба сработала —
 * разоблачили, и конкурент платит; иначе с шансом — штраф и минус рейтинг (уборщица на смене
 * вдвое снижает шанс).
 */
export function trickNight(state: StoreState, random: () => number, cleaner: boolean): StoreState {
  const trick = state.trick;
  if (!trick || trick.kind !== 'inspector' || trick.day !== state.day || trick.result) return state;
  if (trick.answer === 'counter') return { ...state, trick: { ...trick, result: 'passed' } };
  if (trick.stopped) {
    const pay = exposedPay(state.level);
    return { ...state, money: state.money + pay, trick: { ...trick, result: 'exposed', fine: pay } };
  }
  if (random() >= INSPECTOR_FINE_CHANCE * (cleaner ? 0.5 : 1)) return { ...state, trick: { ...trick, result: 'passed' } };
  const fine = inspectorFine(state.level);
  return {
    ...state,
    money: state.money - fine,
    rating: Math.round(Math.max(0, state.rating - INSPECTOR_RATING) * 100) / 100,
    trick: { ...trick, result: 'fined', fine },
  };
}

/** Утром — чем кончился вчерашний проверяющий (один раз). */
export const trickResult = (state: StoreState): Trick | undefined => {
  const t = state.trick;
  return t?.result && !t.seen && t.day < state.day ? t : undefined;
};
export const seeTrickResult = (state: StoreState): StoreState => (state.trick ? { ...state, trick: { ...state.trick, seen: true } } : state);
