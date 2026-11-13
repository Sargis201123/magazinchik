// Ломбард в подсобке (13.11, автор: «утром иногда приходит человек и предлагает оставить вещь под деньги»).
// С «Минимаркета» в подсобке есть место под чужие вещи. Иногда утром заходит человек: часы, гитара, велосипед,
// кольцо, фотоаппарат или телефон — просит денег на несколько дней и обещает вернуть с процентом. Взять или отказать.
// Дальше одно из трёх: выкупил (деньги с процентом — в кассу), не пришёл (вещь наша и встаёт на полку «Разное»,
// её покупают дороже, чем отдали) или вещь краденая — через пару дней приходит полиция и забирает её (деньги пропали,
// рейтинг чуть ниже). Чтобы это был выбор, а не лотерея, у гостя есть примета: краденое обычно несут суетливые люди
// без чека, хотя бывает и наоборот.
//
// Всё — от зерна магазина и дня (как находки кота, cat.ts): перезапуск утра ничего не перекатывает, а общий генератор
// симулятора не сдвигается. Чем кончится залог, решается в момент, когда вещь взяли, и хранится в залоге — игроку не видно.
// Окно утра — ui/pawnshop.ts, полка «Разное» в подсобке — scenes/pawnFx.ts.

import type { StoreState } from './economy';
import { rng } from './random';
import { homeLevel, inZar } from './zarshop';

export type PawnItemId = 'watch' | 'guitar' | 'bike' | 'ring' | 'camera' | 'phone';
/** Чем кончится залог: выкупят, не придут или вещь краденая. */
export type PawnFate = 'repay' | 'forfeit' | 'stolen';

/** Вещи: во сколько раз дороже обычного под неё дают (кольцо — дороже всех). Картинка — pawn_<вещь> (art/pawnshop.py). */
export const PAWN_ITEMS: Record<PawnItemId, { worth: number }> = {
  watch: { worth: 0.8 },
  guitar: { worth: 0.7 },
  bike: { worth: 0.9 },
  ring: { worth: 1.2 },
  camera: { worth: 1 },
  phone: { worth: 0.6 },
};
export const PAWN_ITEM_IDS = Object.keys(PAWN_ITEMS) as PawnItemId[];

/** С какого помещения в подсобке есть ломбард: «Минимаркет» (там же открываются комнаты флигеля). */
export const PAWN_FROM_LEVEL = 2;
/** Как часто утром приходят с вещью. */
export const PAWN_CHANCE = 0.35;
/**
 * Сколько просят: доля средней дневной выручки за обычную вещь (× worth, ± 20%). В «Минимаркете» (выручка ~4 тыс.)
 * это 500–1400 💰, в универмаге (~10 тыс.) — 1200–3600: заметно, но не полкассы. Симулятор (npm run sim:features
 * 100 20 ломбард: берёт у спокойных, отказывает суетливым) — к сотому дню ≈ +3% денег, на сроки помещений не влияет.
 */
export const PAWN_SHARE = 0.25;
export const PAWN_MIN = 100;
/** Срок — 3, 4 или 5 дней; чем дольше, тем больше процент. */
export const PAWN_TERMS = [3, 4, 5] as const;
export const PAWN_RATES = [0.1, 0.15, 0.2] as const;
/** Доли исходов: краденое, не выкупят (остальное — выкупят). */
export const PAWN_STOLEN = 0.15;
export const PAWN_FORFEIT = 0.3;
/** Как часто у гостя подозрительная примета: если вещь краденая — и если нет. */
export const PAWN_SHADY_STOLEN = 0.7;
export const PAWN_SHADY_CLEAN = 0.15;
/** Невыкупленное на полке «Разное»: во сколько раз дороже, чем отдали, и как часто за день его покупают. */
export const PAWN_MARKUP = 1.6;
export const PAWN_SELL_CHANCE = 0.4;
/** Полиция забрала краденое — соседи судачат: рейтинг чуть ниже. */
export const PAWN_POLICE_RATING = 0.05;
/** Сколько последних изъятий помнить. */
export const PAWN_SEIZED_KEEP = 20;

export interface PawnLoan {
  item: PawnItemId;
  /** Сколько отдали и сколько вернут. */
  lent: number;
  back: number;
  /** Когда взяли вещь и утро выкупа: в это утро либо выкупят, либо вещь наша. */
  day: number;
  due: number;
  fate: PawnFate;
  /** Краденая: утро, когда придёт полиция (не позже срока). */
  police?: number;
}

/** Вещь на полке «Разное»: почём продаём, сколько за неё отдали и с какого дня стоит. */
export interface PawnSale {
  item: PawnItemId;
  price: number;
  lent: number;
  day: number;
}

/**
 * Изъятое полицией. Это зацепка для будущего «Дела недели»: что за вещь (по ней понятно, кто её принёс — у каждой
 * вещи свой хозяин, pawn.who.<вещь>), сколько за неё отдали, когда взяли и когда пришла полиция.
 */
export interface PawnSeized {
  item: PawnItemId;
  lent: number;
  took: number;
  day: number;
}

/** Что случилось утром: выкупили, не пришли (вещь — на полку), купили с полки, забрала полиция; n — деньги. */
export interface PawnEvent {
  kind: 'back' | 'kept' | 'sold' | 'police';
  item: PawnItemId;
  n: number;
}

export interface PawnState {
  loans: PawnLoan[];
  shelf: PawnSale[];
  /** В какое утро уже ответили на предложение (взяли или отказали): второго за утро не будет. */
  answered?: number;
  /** Новости этого утра и прочитаны ли они. */
  news?: { day: number; events: PawnEvent[]; seen?: boolean };
  /** Заработано на процентах и продажах (сверх отданного) и сколько пропало с краденым — для карточки. */
  earned: number;
  lost: number;
  seized?: PawnSeized[];
}

export interface PawnOffer {
  item: PawnItemId;
  lent: number;
  back: number;
  days: number;
  /** Процент за срок (0.15 = +15%). */
  rate: number;
  /** Примета гостя: какая строчка (pawn.tell.<shady|calm><n>). */
  tell: 'shady' | 'calm';
  tellN: 0 | 1;
  fate: PawnFate;
  /** Через сколько дней придёт полиция (только у краденого). */
  police?: number;
}

const round10 = (n: number): number => Math.round(n / 10) * 10;

/** Случайность дня: от зерна магазина, дня и «соли» (у каждой проверки своя). */
const dice = (state: StoreState, salt: number): (() => number) =>
  rng(((state.seed ?? 1) ^ Math.imul(state.day * 977 + salt, 0x85ebca6b)) >>> 0);

/** Ломбард открыт: в Центре, с «Минимаркета». В Заречье своей подсобки под это нет. */
export const pawnOpen = (state: StoreState): boolean => !inZar(state) && homeLevel(state) >= PAWN_FROM_LEVEL;

/** Сколько вещей одновременно можно держать в залоге: в большом магазине подсобка больше. */
export const pawnSlots = (state: StoreState): number => (homeLevel(state) >= 4 ? 3 : 2);

const known = (id: unknown): id is PawnItemId => typeof id === 'string' && id in PAWN_ITEMS;

/** Состояние ломбарда (пустое, если ещё не было); неизвестные вещи из кривого сохранения отбрасываем. */
export function pawnOf(state: StoreState): PawnState {
  const p = state.pawn;
  return {
    ...p,
    loans: (p?.loans ?? []).filter((l) => known(l.item)),
    shelf: (p?.shelf ?? []).filter((s) => known(s.item)),
    earned: p?.earned ?? 0,
    lost: p?.lost ?? 0,
  };
}

/** Средняя выручка за последние дни: от неё — суммы залогов. */
export function dayTake(state: StoreState): number {
  const last = (state.history ?? []).slice(-7).filter((n) => n > 0);
  return last.length ? last.reduce((a, b) => a + b, 0) / last.length : 1000;
}

/**
 * Кто пришёл сегодня утром и с чем (или никто). Первый раз в жизни ломбарда (state.pawn ещё нет) гость приходит
 * наверняка — вместе с подсказкой «Новое!», и вещь у него честная: сначала игрок видит, как это работает.
 */
export function pawnOffer(state: StoreState): PawnOffer | null {
  if (!pawnOpen(state)) return null;
  const p = state.pawn;
  if (p?.answered === state.day || pawnOf(state).loans.length >= pawnSlots(state)) return null;
  const r = dice(state, 1);
  if (r() >= PAWN_CHANCE && p) return null;
  const item = PAWN_ITEM_IDS[Math.floor(r() * PAWN_ITEM_IDS.length)];
  const term = Math.floor(r() * PAWN_TERMS.length);
  const days = PAWN_TERMS[term];
  const rate = PAWN_RATES[term];
  const lent = Math.max(PAWN_MIN, round10(dayTake(state) * PAWN_SHARE * PAWN_ITEMS[item].worth * (0.8 + 0.4 * r())));
  const roll = r();
  let fate: PawnFate = roll < PAWN_STOLEN ? 'stolen' : roll < PAWN_STOLEN + PAWN_FORFEIT ? 'forfeit' : 'repay';
  if (!p && fate === 'stolen') fate = 'repay';
  const shady = r() < (fate === 'stolen' ? PAWN_SHADY_STOLEN : PAWN_SHADY_CLEAN);
  const tellN = r() < 0.5 ? 0 : 1;
  // Полиция — со второго утра и не позже срока: краденое никогда не успевает встать на полку.
  const police = fate === 'stolen' ? 2 + Math.floor(r() * (days - 1)) : undefined;
  return { item, lent, back: round10(lent * (1 + rate)), days, rate, tell: shady ? 'shady' : 'calm', tellN, fate, ...(police ? { police } : {}) };
}

/** Взять вещь: деньги из кассы — гостю, вещь — в подсобку. null — гостя нет или не хватает денег. */
export function takePawn(state: StoreState): StoreState | null {
  const offer = pawnOffer(state);
  if (!offer || state.money < offer.lent) return null;
  const p = pawnOf(state);
  const loan: PawnLoan = { item: offer.item, lent: offer.lent, back: offer.back, day: state.day, due: state.day + offer.days, fate: offer.fate };
  if (offer.police) loan.police = state.day + offer.police;
  return { ...state, money: state.money - offer.lent, pawn: { ...p, loans: [...p.loans, loan], answered: state.day } };
}

/** Отказать: гость уходит, сегодня больше никто не придёт. */
export function refusePawn(state: StoreState): StoreState {
  if (!pawnOffer(state)) return state;
  return { ...state, pawn: { ...pawnOf(state), answered: state.day } };
}

/**
 * Утро (после смены дня, day.ts): вчерашние покупатели разобрали что-то с полки «Разное», пришла полиция за краденым,
 * у кого срок — выкупили или не пришли. Что случилось — в news (карточка утра).
 */
export function pawnMorning(state: StoreState): StoreState {
  if (!state.pawn) return state;
  const p = pawnOf(state);
  const events: PawnEvent[] = [];
  let { money, rating } = state;
  let { earned, lost } = p;
  const seized = [...(p.seized ?? [])];
  const shelf: PawnSale[] = [];
  p.shelf.forEach((s, i) => {
    if (dice(state, 50 + i)() < PAWN_SELL_CHANCE) {
      money += s.price;
      earned += s.price - s.lent;
      events.push({ kind: 'sold', item: s.item, n: s.price });
    } else shelf.push(s);
  });
  const loans: PawnLoan[] = [];
  for (const loan of p.loans) {
    if (loan.fate === 'stolen' && state.day >= (loan.police ?? loan.due)) {
      lost += loan.lent;
      rating = Math.max(0, Math.round((rating - PAWN_POLICE_RATING) * 100) / 100);
      seized.push({ item: loan.item, lent: loan.lent, took: loan.day, day: state.day });
      events.push({ kind: 'police', item: loan.item, n: loan.lent });
    } else if (state.day >= loan.due && loan.fate === 'repay') {
      money += loan.back;
      earned += loan.back - loan.lent;
      events.push({ kind: 'back', item: loan.item, n: loan.back });
    } else if (state.day >= loan.due) {
      const price = round10(loan.lent * PAWN_MARKUP);
      shelf.push({ item: loan.item, price, lent: loan.lent, day: state.day });
      events.push({ kind: 'kept', item: loan.item, n: price });
    } else loans.push(loan);
  }
  const next: PawnState = { ...p, loans, shelf, earned, lost };
  if (seized.length) next.seized = seized.slice(-PAWN_SEIZED_KEEP);
  if (events.length) next.news = { day: state.day, events };
  else delete next.news;
  return { ...state, money, rating, pawn: next };
}

/** Новости ломбарда этим утром, если их ещё не закрыли. */
export const pawnNews = (state: StoreState): PawnEvent[] => {
  const news = state.pawn?.news;
  return news && news.day === state.day && !news.seen ? news.events.filter((e) => known(e.item)) : [];
};

export function seePawnNews(state: StoreState): StoreState {
  const news = state.pawn?.news;
  if (!news || news.seen) return state;
  return { ...state, pawn: { ...pawnOf(state), news: { ...news, seen: true } } };
}
