// «Крыша» (13.11, задача автора: «рэкет требует платить — платить, отказать или в полицию»). Однажды утром
// середины игры у входа встаёт чёрная «девятка», и вежливые ребята в кожанках предлагают «присмотреть» за
// магазином за долю недельной выручки. Без драк и угроз на экране — только последствия выбора:
//  · платить — каждую неделю забирают долю, спокойно; через недели «крыша» поднимает ставку (эхо решений);
//  · отказать — недели две пакостят: разбитая витрина, проколотые шины фургона, мусор у входа; потом отстают;
//  · в полицию — «Дело недели» о рэкете (cases.ts openCase); назвал главного — их нет навсегда, район
//    благодарен (доброе имя, goodwill.ts, и эхо соседей), не вышло — пакости, как при отказе.
//
// Когда придут, какая пакость и в какой день — только от зерна магазина и номера дня (как находки кота):
// перезапуск дня ничего не перекатывает, симулятор считает то же. Рэкет бывает один раз за игру.

import type { StoreState } from './economy';
import { casesOf, openCase, openCaseOf } from './cases';
import { echoDelay, echoesOf, plantEcho, answerEchoNews, type EchoId } from './echoes';
import { addGoodwill } from './goodwill';
import { inZar } from './zarshop';
import { tutStep } from './tutorial';
import { quietDays } from './firstday';

export type RacketMode = 'pay' | 'refuse' | 'police';
export const RACKET_MODES: RacketMode[] = ['pay', 'refuse', 'police'];
export type Trouble = 'glass' | 'tires' | 'trash';
export const TROUBLES: Trouble[] = ['glass', 'tires', 'trash'];

/** Не раньше середины игры: «Магазинчик» и дальше, с 35-го дня (обучение и знакомство с районом позади). */
export const RACKET_FROM = 35;
export const RACKET_LEVEL = 2;
/** Шанс, что придут этим утром (после RACKET_FROM): в среднем — через полторы недели. */
export const RACKET_CHANCE = 0.1;
/** Доля недельной выручки и как она растёт после каждого эха «поднимаем ставку». */
export const RACKET_RATE = 4;
export const RACKET_RAISE = 2;
export const RACKET_RATE_MAX = 10;
/** Меньше этого с недели не берут (неделя была пустая — всё равно «за беспокойство»). */
export const RACKET_MIN = 40;
/** Отказали (или дело развалилось): сколько дней пакостят и шанс пакости в день (первая — наутро наверняка). */
export const TROUBLE_DAYS = 14;
export const TROUBLE_CHANCE = 0.4;
/** Ремонт витрины и шиномонтаж: растут с магазином. */
export const troubleCost = (kind: Trouble, level: number): number => (kind === 'glass' ? 60 + 40 * level : kind === 'tires' ? 30 + 15 * level : 0);
/** Мусор у входа: гостей меньше, пока не уберут (весь день — уборщица выносит, но люди уже видели). */
export const TRASH_GUESTS = 0.92;
/** Банду взяли — доброе имя района. */
export const JAILED_GOODWILL = 12;

export interface RacketState {
  /** День, когда пришли. */
  from: number;
  /** Что решил хозяин (нет — ещё не ответил: утро ждёт ответа). */
  mode?: RacketMode;
  /** С какого дня действует решение. */
  since?: number;
  /** Платим: процент недельной выручки и сколько отдали всего. */
  rate?: number;
  paid?: number;
  /** Пакостят до этого дня включительно. */
  until?: number;
  /** Что стряслось этим утром (пакость или доля) — для строки утра и зала. */
  hit?: { day: number; kind: Trouble | 'pay'; cost: number };
  /** Всё кончилось: банду взяли (jailed) или отстали сами (quit). Второй раз не придут. */
  end?: 'jailed' | 'quit';
  /** Новость утра об исходе: взяли, дело развалилось, отстали. */
  news?: { kind: 'jailed' | 'free' | 'quit'; day: number; seen?: boolean };
}

/** Случайность «крыши»: зерно магазина, день и «соль» — у каждого броска своя. */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2246822519 + state.day * 3266489917 + salt * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const set = (state: StoreState, racket: RacketState): StoreState => ({ ...state, racket });

/** Придут ли этим утром. Не в обучении, не в тихие дни новичка, не в Заречье, не в беду района и не при банкротстве. */
export function racketStarts(state: StoreState): boolean {
  return (
    !state.racket &&
    state.day >= RACKET_FROM &&
    state.level >= RACKET_LEVEL &&
    !tutStep(state) &&
    !quietDays(state) &&
    !inZar(state) &&
    !state.bankrupt &&
    !state.crisis &&
    roll(state, 1) < RACKET_CHANCE
  );
}

/** Утро ждёт ответа: платить, отказать или в полицию. */
export const racketAsk = (state: StoreState): boolean => Boolean(state.racket && !state.racket.mode && !state.racket.end);

/** Доля недели: процент от выручки последних семи дней, не меньше RACKET_MIN. */
export function racketShare(state: StoreState, rate = state.racket?.rate ?? RACKET_RATE): number {
  const week = (state.history ?? []).slice(-7).reduce((a, b) => a + b, 0);
  return Math.max(RACKET_MIN, Math.round((week * rate) / 100));
}

/** Забрать долю: сколько есть в кассе, не больше. */
function collect(state: StoreState, r: RacketState): StoreState {
  const cost = Math.min(Math.max(0, state.money), racketShare(state, r.rate));
  return set({ ...state, money: state.money - cost }, { ...r, paid: (r.paid ?? 0) + cost, hit: { day: state.day, kind: 'pay', cost } });
}

/** Через сколько дней «крыша» поднимет ставку: две–четыре недели. */
const raiseIn = (state: StoreState): number => 14 + Math.floor(roll(state, 7) * 15);

const refuse = (state: StoreState, r: RacketState): StoreState => {
  const { rate: _rate, ...rest } = r;
  return set(state, { ...rest, mode: 'refuse', since: state.day, until: state.day + TROUBLE_DAYS });
};

/** Пойти в полицию: дело открывается сразу, а если идёт другое — как только его закроют (racketMorning). */
const police = (state: StoreState, r: RacketState): StoreState => {
  const { rate: _rate, ...rest } = r;
  const s = set(state, { ...rest, mode: 'police', since: state.day });
  return openCase(s, 'racket', 'racket') ?? s;
};

/** Ответ на первый визит. Платить — первая доля сразу (за них никто не решает), эхо «поднимаем ставку» — через недели. */
export function chooseRacket(state: StoreState, mode: RacketMode): StoreState | null {
  const r = state.racket;
  if (!r || !racketAsk(state)) return null;
  if (mode === 'refuse') return refuse(state, r);
  if (mode === 'police') return police(state, r);
  const s = collect(state, { ...r, mode: 'pay', since: state.day, rate: RACKET_RATE });
  return plantEcho(s, 'racketRaise', state.day + raiseIn(state), { n: RACKET_RATE + RACKET_RAISE });
}

/**
 * Эхо «поднимаем ставку» (echoes.ts racketRaise): 0 — платить больше, 1 — хватит, 2 — в полицию. Само эхо
 * уходит из списка, как любое; платим дальше — следующее поднятие через недели (не выше RACKET_RATE_MAX).
 */
export function answerRaise(state: StoreState, id: EchoId, choice: number): StoreState | null {
  const s = answerEchoNews(state, id, choice);
  const r = s?.racket;
  if (!s || !r || r.mode !== 'pay' || r.end) return s;
  if (choice === 1) return refuse(s, r);
  if (choice === 2) return police(s, r);
  const rate = Math.min(RACKET_RATE_MAX, (r.rate ?? RACKET_RATE) + RACKET_RAISE);
  const next = set(s, { ...r, rate });
  return rate < RACKET_RATE_MAX ? plantEcho(next, 'racketRaise', s.day + raiseIn(s), { n: Math.min(RACKET_RATE_MAX, rate + RACKET_RAISE) }) : next;
}

/**
 * Перестать платить в любое утро (строка «Сегодня», ui/racket.ts): отказать или в полицию. 14.11, ревью:
 * на потолке ставки новых поднятий нет, и без этой кнопки платящий застревал на 10% до конца игры.
 * Несостоявшееся поднятие ставки убираем — иначе потом пришло бы «Платить {n}%» тому, кто уже не платит.
 */
export function stopPaying(state: StoreState, mode: Exclude<RacketMode, 'pay'>): StoreState | null {
  const r = state.racket;
  if (r?.mode !== 'pay' || r.end) return null;
  const e = echoesOf(state);
  const s = { ...state, echoes: { ...e, list: e.list.filter((x) => x.id !== 'racketRaise') } };
  return mode === 'refuse' ? refuse(s, r) : police(s, r);
}

/** Пакость этого утра (или null): первая — наутро после отказа, витрина; дальше — от зерна и дня. */
export function troubleFor(state: StoreState, r: RacketState): Trouble | null {
  if (inZar(state) || state.day <= (r.since ?? state.day)) return null;
  if (state.day === (r.since ?? 0) + 1) return 'glass';
  if (roll(state, 3) >= TROUBLE_CHANCE) return null;
  return TROUBLES[Math.floor(roll(state, 4) * TROUBLES.length)];
}

/** Дело о рэкете закрыто с тех пор, как пошли в полицию: как. */
const racketCase = (state: StoreState, since: number) => (casesOf(state).done ?? []).find((d) => d.id === 'racket' && d.day >= since);

/**
 * Утро (day.ts nightCycle, после смены дня и утра дел): пришли ли ребята, доля — раз в неделю от дня решения,
 * пакости после отказа, чем кончилось дело в полиции. Ничего не поменялось — тот же объект.
 */
export function racketMorning(state: StoreState): StoreState {
  const r0 = state.racket;
  if (!r0) return racketStarts(state) ? set(state, { from: state.day }) : state;
  // Вчерашняя пакость или доля — в прошлом.
  const r: RacketState = r0.hit && r0.hit.day !== state.day ? (({ hit: _old, ...rest }) => rest)(r0) : r0;
  const s = r === r0 ? state : set(state, r);
  if (r.end || !r.mode) return s;
  const since = r.since ?? r.from;
  if (r.mode === 'pay') return (state.day - since) % 7 === 0 && state.day > since ? collect(s, r) : s;
  if (r.mode === 'police') {
    const rec = racketCase(s, since);
    if (!rec) return openCaseOf(s) ? s : (openCase(s, 'racket', 'racket') ?? s);
    if (rec.tone === 'great' || rec.tone === 'good') {
      const done = set(s, { ...r, end: 'jailed', news: { kind: 'jailed', day: s.day } });
      return plantEcho(addGoodwill(done, JAILED_GOODWILL), 'racketThanks', s.day + echoDelay(s, 41));
    }
    // Не того назвали или дело ушло в архив: ребята на свободе и знают, кто заявил.
    const free: RacketState = { ...r, news: { kind: 'free', day: s.day } };
    return refuse(s, free);
  }
  if (s.day > (r.until ?? 0)) return set(s, { ...r, end: 'quit', news: { kind: 'quit', day: s.day } });
  const kind = troubleFor(s, r);
  if (!kind) return s;
  const cost = Math.min(Math.max(0, s.money), troubleCost(kind, s.level));
  return set({ ...s, money: s.money - cost }, { ...r, hit: { day: s.day, kind, cost } });
}

/** Что стряслось этим утром (пакость или доля «крыши»). */
export const racketHit = (state: StoreState): RacketState['hit'] | null => (state.racket?.hit?.day === state.day ? state.racket.hit : null);

/** Мусор у входа: гостей меньше. */
export const racketGuests = (state: StoreState): number => (racketHit(state)?.kind === 'trash' ? TRASH_GUESTS : 1);

/** Новость об исходе ещё не рассказали (неделю ждёт своей очереди). */
export const racketNews = (state: StoreState): RacketState['news'] | null => {
  const n = state.racket?.news;
  return n && !n.seen && state.day - n.day <= 7 ? n : null;
};

export const seeRacketNews = (state: StoreState): StoreState =>
  state.racket?.news ? set(state, { ...state.racket, news: { ...state.racket.news, seen: true } }) : state;
