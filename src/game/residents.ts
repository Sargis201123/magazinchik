// Жители района (13.11, автор: «жители приезжают и уезжают»). В домах вдоль задней улицы — квартиры, и в них живут
// семьи. Сколько их — медленно меняется от того, как ведёт себя магазин: честные цены, доброе имя района (goodwill.ts),
// рейтинг, сбывшиеся мечты соседей (dreams.ts). Району хорошо — въезжают новые семьи (гостей больше, иногда новый
// постоянный — Надя с тремя детьми), плохо — съезжают (гостей меньше, а обиженный постоянный может уехать насовсем,
// с прощальной историей утром). Не больше одной семьи за раз и не чаще раза в RES_EVERY дней: район — не биржа.
// Исход — от зерна магазина и дня (как находка кота, cat.ts): перезапуск утра его не меняет.
// Это общий API: дальше его читают «Район дорожает» и «Скупать улицу» (residents, residentsGuests, addResidents).
// На улице — scenes/streets.ts (окна домов, «Сдаётся», грузовик с мебелью), в утре — ui/residents.ts.

import type { StoreState } from './economy';
import { priceAppeal } from './economy';
import { goodwillOf } from './goodwill';
import { DREAMS, investsOf } from './dreams';
import { inZar } from './zarshop';
import { met, regularById, regularState, START_LOYALTY, type RegularId } from './regulars';

/** Квартир в домах района (видно на улице: столько окон у ближних домов задней улицы). */
export const RES_FLATS = 20;
/** Сколько семей живёт в районе в начале игры — и у старых сохранений (поля нет). */
export const RES_START = 12;
/** Сами по себе жители не опускаются ниже и не поднимаются выше (другие фичи — через addResidents, до 0…RES_FLATS). */
export const RES_MIN = 4;
export const RES_MAX = RES_FLATS;
/** С какого дня район начинает меняться: первые недели новичку хватает своего. */
export const RES_FROM = 12;
/** Район решает раз в столько дней (в «свой» день — от зерна магазина). */
export const RES_EVERY = 4;
/**
 * Гости: каждая семья сверх начальных — +0,75% (полный район — +6%, полупустой — −6%). Меньше доброго имени
 * (goodwill.ts, до ±15%): жители — медленный хвост тех же решений, а не новый рычаг.
 */
export const RES_GUESTS = 0.0075;
/** Настроение района, с которого семьи начинают ехать (по модулю), и шанс переезда за единицу настроения. */
export const MOOD_MOVE = 1;
export const MOVE_CHANCE = 0.15;
export const MOVE_CHANCE_MAX = 0.6;
/** Обиженный постоянный (доверие не выше этого) при плохом настроении уезжает вместо безымянной семьи — с таким шансом. */
export const LEAVE_LOYALTY = 2;
export const LEAVE_CHANCE = 0.6;
/** Уехавший постоянный возвращается с новой семьёй — с таким шансом (если есть кто). */
export const BACK_CHANCE = 0.5;
/** Надя с детьми въезжает не раньше этого дня и с таким шансом при переезде. */
export const NADYA_FROM = 30;
export const NADYA_CHANCE = 0.5;
/** Новость о переезде ждёт в очереди утра (headlines.ts) столько дней. */
export const RES_NEWS_DAYS = 3;
/** Вариантов безымянных историй: въехали и съехали. */
export const MOVE_IN_TALES = 4;
export const MOVE_OUT_TALES = 4;
/** Кто из постоянных может уехать: Света с Мишей — семья с корнями (life.ts), Миша без мамы не переедет. */
export const MAY_LEAVE: RegularId[] = ['petr', 'kostya', 'akhmed', 'olga', 'nadya'];

export interface ResidentMove {
  day: number;
  /** +1 — въехали, −1 — съехали. */
  dir: 1 | -1;
  /** Постоянный: въехал (Надя), вернулся (back) или уехал. Нет — безымянная семья, история tale. */
  who?: RegularId;
  back?: boolean;
  tale?: number;
  /** Новость прочитана. */
  seen?: boolean;
}

export interface ResidentsState {
  /** Семей в районе. */
  n: number;
  /** Последний переезд: новость утра и грузовик у подъезда в тот день. */
  move?: ResidentMove;
  /** Постоянные, уехавшие из района (не заходят, regulars.ts met). */
  gone?: RegularId[];
  /** Постоянные, въехавшие с переездом (Надя): без этого их ещё нет в районе. */
  came?: RegularId[];
}

/** Сколько семей живёт в районе. */
export const residents = (state: Pick<StoreState, 'residents'>): number => state.residents?.n ?? RES_START;

/** Множитель гостей от жителей (в Центре: day.ts homeOnly). */
export const residentsGuests = (state: Pick<StoreState, 'residents'>): number => 1 + (residents(state) - RES_START) * RES_GUESTS;

/** Поменять число семей (для других фич: «Район дорожает», «Скупать улицу»). Без изменений — тот же объект. */
export function addResidents(state: StoreState, delta: number): StoreState {
  const n = Math.max(0, Math.min(RES_FLATS, Math.round(residents(state) + delta)));
  if (n === residents(state)) return state;
  return { ...state, residents: { ...state.residents, n } };
}

export type MoodWhy = 'price' | 'goodwill' | 'rating' | 'dreams';

/**
 * Настроение района: доброе имя (±5 на краях), цены (средняя на 10% ниже обычной — +1,2), рейтинг (5★ — +1, 3★ — −1)
 * и сбывшиеся мечты соседей (+0,5 каждая). Около нуля — никто не едет; why — что сейчас весит больше всего.
 */
export function residentsMood(state: StoreState): { mood: number; why: MoodWhy } {
  const parts: Record<MoodWhy, number> = {
    goodwill: goodwillOf(state) / 20,
    price: (priceAppeal(state) - 1) * 20,
    rating: state.rating - 4,
    dreams: investsOf(state).filter((v) => v.end === 'ok').length * 0.5,
  };
  const mood = Object.values(parts).reduce((a, b) => a + b, 0);
  const keys = Object.keys(parts) as MoodWhy[];
  // Причина — та, что тянет в ту же сторону сильнее остальных.
  const why = keys.reduce((best, k) => (parts[k] * Math.sign(mood || 1) > parts[best] * Math.sign(mood || 1) ? k : best), keys[0]);
  return { mood, why };
}

/** Куда идёт район: +1 — едут к нам, −1 — уезжают, 0 — тихо (или упёрлись в край). */
export function residentsTrend(state: StoreState): -1 | 0 | 1 {
  if (inZar(state) || state.day < RES_FROM) return 0;
  const { mood } = residentsMood(state);
  const n = residents(state);
  if (mood >= MOOD_MOVE && n < RES_MAX) return 1;
  if (mood <= -MOOD_MOVE && n > RES_MIN) return -1;
  return 0;
}

/** Детерминированное 0…1 от зерна магазина и дня (salt — какой вопрос). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 40503 + salt * 7919 + 1013) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 10000) / 10000;
}

/** Сегодня район решает (раз в RES_EVERY дней, день — свой у каждого магазина). */
export const residentsDay = (state: StoreState): boolean => ((state.day + (state.seed ?? 1)) % RES_EVERY + RES_EVERY) % RES_EVERY === 0;

/** Постоянный, которому у нас плохо и который может уехать: знаком, обижен, не ждёт новостей о своей мечте. */
function leaver(state: StoreState): RegularId | null {
  const dreaming = new Set(investsOf(state).map((v) => DREAMS[v.id].regular));
  return MAY_LEAVE.find((id) => met(state, regularById(id)) && regularState(state, id).loyalty <= LEAVE_LOYALTY && !dreaming.has(id)) ?? null;
}

/**
 * Утро (day.ts, после смены дня): в свой день район решает, едет ли кто-то. Только в Центре (Заречье — свой район)
 * и не раньше RES_FROM. Въехала Надя — она в came; вернулся уехавший — снова заходит, доверие с начала.
 */
export function residentsMorning(state: StoreState): StoreState {
  if (!residentsDay(state)) return state;
  const dir = residentsTrend(state);
  if (!dir) return state;
  const { mood } = residentsMood(state);
  if (roll(state, 1) >= Math.min(MOVE_CHANCE_MAX, MOVE_CHANCE * Math.abs(mood))) return state;
  const cur = state.residents;
  const gone = cur?.gone ?? [];
  const came = cur?.came ?? [];
  const pick = roll(state, 2);
  const tale = (k: number) => Math.floor(roll(state, 3) * k);
  let move: ResidentMove;
  let next: ResidentsState = { ...cur, n: residents(state) + dir };
  let regulars = state.regulars;
  if (dir > 0) {
    if (state.day >= NADYA_FROM && !came.includes('nadya') && !gone.includes('nadya') && pick < NADYA_CHANCE) {
      move = { day: state.day, dir, who: 'nadya' };
      next = { ...next, came: [...came, 'nadya'] };
    } else if (gone.length && pick < BACK_CHANCE) {
      // Вернулся тот, кто уехал раньше всех: «нигде нет такого магазина, как у дома».
      const who = gone[0];
      move = { day: state.day, dir, who, back: true };
      next = { ...next, gone: gone.slice(1) };
      regulars = { ...regulars, [who]: { loyalty: START_LOYALTY, awayUntil: 0 } };
    } else move = { day: state.day, dir, tale: tale(MOVE_IN_TALES) };
  } else {
    const who = pick < LEAVE_CHANCE ? leaver(state) : null;
    if (who) {
      move = { day: state.day, dir, who };
      next = { ...next, gone: [...gone, who] };
    } else move = { day: state.day, dir, tale: tale(MOVE_OUT_TALES) };
  }
  if (!next.gone?.length) delete next.gone;
  return { ...state, regulars, residents: { ...next, move } };
}

/** Новость утра о переезде (ждёт RES_NEWS_DAYS, пока не прочитана). */
export function residentsNews(state: StoreState): ResidentMove | null {
  const m = state.residents?.move;
  return m && !m.seen && state.day - m.day <= RES_NEWS_DAYS && !inZar(state) ? m : null;
}

/** Прочитали новость. */
export function seeResidents(state: StoreState): StoreState {
  const r = state.residents;
  if (!r?.move || r.move.seen) return state;
  return { ...state, residents: { ...r, move: { ...r.move, seen: true } } };
}

/** Сегодня у подъезда грузовик с мебелью (день переезда). */
export const movingToday = (state: StoreState): ResidentMove | null => {
  const m = state.residents?.move;
  return m && m.day === state.day && !inZar(state) ? m : null;
};

/** Что нарисовано на улице: число семей и грузовик сегодня — сменилось, сцена перестраивает дома (morningFlow.ts). */
export const residentsLook = (state: StoreState): string => {
  const m = movingToday(state);
  return `${residents(state)}${m ? (m.dir > 0 ? '+' : '-') : ''}`;
};

/** Квартира, где сегодня переезд: въехали — последняя занятая, съехали — первая пустая (порядок — scenes/streets.ts). */
export const movingFlat = (state: StoreState): number | null => {
  const m = movingToday(state);
  if (!m) return null;
  return m.dir > 0 ? residents(state) - 1 : residents(state);
};

