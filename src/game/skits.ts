// «Сценки дня» (11.11, идея автора: доп. сюжеты с выбором и сценками; на время сюжета магазин на паузе).
// Посреди рабочего дня в магазин заходит житель района со своей историей: мальчик потерял щенка, студент-повар
// принёс пирожки, блогер хочет снять обзор, сосед забыл кошелёк, школьники собирают на подарок учительнице,
// курьер прячется от ливня. Гость подходит к кассе, магазин замирает (scenes/skitsFx.ts), идёт разговор с
// портретами (ui/skits.ts) и выбор. От выбора — последствия (немного денег, рейтинга, гостей на несколько
// дней) и продолжение через пару дней или конец истории. Без наказаний: отказ просто закрывает историю.
//
// Когда и какая сценка — от дня и зерна магазина (как хроники района, arcs.ts): перезапуск дня ничего не
// перекатывает, а общий генератор случайностей (симулятор) не сдвигается. Не в первые тихие дни, не в особые
// дни и не в день, когда утром ждёт своя история постоянного (tales.ts) — по одной за раз.

import { onShelves, warehouseOf, type ProductId, type StoreState } from './economy';
import { take, taleToday } from './tales';
import { bigDayFor } from './bigday';
import { quietDays } from './firstday';
import { inZar } from './zarechye';
import { isWet, weatherFor } from './weather';
import { rng } from './random';

export type SkitId = 'puppy' | 'pies' | 'blogger' | 'wallet' | 'gift' | 'rain';
export type SkitMood = 'happy' | 'sad' | 'surprised' | 'angry' | null;

export interface SkitEffect {
  money?: number;
  rating?: number;
  /** Больше гостей: на сколько (0.1 = +10%) и сколько дней. */
  boost?: [number, number];
  /** Отдать товар (с полок, потом со склада). */
  take?: [ProductId, number];
}

export interface SkitChoice {
  effect: SkitEffect;
  /** Настроение гостя в ответной реплике. */
  mood: SkitMood;
  /** Следующий эпизод и через сколько дней; нет — история кончилась. */
  next?: [number, number];
}

export interface SkitEpisode {
  /** Настроения двух реплик гостя (тексты — skit.<id>.<ep>.line1/line2). */
  moods: [SkitMood, SkitMood];
  /** Два варианта ответа (тексты — skit.<id>.<ep>.a / .b, ответ гостя — .a.reply / .b.reply). */
  choices: [SkitChoice, SkitChoice];
}

export interface Skit {
  /** Портрет без настроения (portrait_skit_<who>) и во что одет в зале. */
  who: string;
  /** С какого дня история может начаться. */
  from: number;
  /** Только в дождь (курьер прячется от ливня). */
  wet?: boolean;
  episodes: SkitEpisode[];
}

export const SKITS: Record<SkitId, Skit> = {
  puppy: {
    who: 'tyoma',
    from: 6,
    episodes: [
      {
        moods: ['sad', 'sad'],
        choices: [
          { effect: { rating: 0.02 }, mood: 'happy', next: [1, 2] },
          { effect: {}, mood: 'sad' },
        ],
      },
      {
        moods: ['happy', 'happy'],
        choices: [
          { effect: { rating: 0.05, boost: [0.05, 5] }, mood: 'happy' },
          { effect: { take: ['milk', 1], boost: [0.08, 5] }, mood: 'happy' },
        ],
      },
    ],
  },
  wallet: {
    who: 'fyodor',
    from: 7,
    episodes: [
      {
        moods: ['surprised', null],
        choices: [
          { effect: { take: ['bread', 1] }, mood: 'happy', next: [1, 2] },
          { effect: { rating: 0.01 }, mood: null },
        ],
      },
      {
        moods: ['happy', null],
        choices: [
          { effect: { rating: 0.04, boost: [0.06, 5] }, mood: 'happy' },
          { effect: { money: 120, rating: 0.03 }, mood: 'happy' },
        ],
      },
    ],
  },
  pies: {
    who: 'lyosha',
    from: 9,
    episodes: [
      {
        moods: ['happy', null],
        choices: [
          { effect: { money: -150 }, mood: 'happy', next: [1, 3] },
          { effect: { rating: 0.01 }, mood: null },
        ],
      },
      {
        moods: ['happy', 'sad'],
        choices: [
          { effect: { money: 500, boost: [0.06, 7] }, mood: 'happy' },
          { effect: { rating: 0.08 }, mood: 'happy' },
        ],
      },
    ],
  },
  gift: {
    who: 'masha',
    from: 10,
    episodes: [
      {
        moods: [null, 'sad'],
        choices: [
          { effect: { money: -50, rating: 0.06 }, mood: 'happy' },
          { effect: { take: ['apples', 5], rating: 0.04 }, mood: 'surprised' },
        ],
      },
    ],
  },
  blogger: {
    who: 'karina',
    from: 12,
    episodes: [
      {
        moods: ['happy', null],
        choices: [
          { effect: { boost: [0.1, 3] }, mood: 'happy', next: [1, 4] },
          { effect: {}, mood: null },
        ],
      },
      {
        moods: ['surprised', null],
        choices: [
          { effect: { money: -300, boost: [0.15, 6] }, mood: 'happy' },
          { effect: { rating: 0.05 }, mood: null },
        ],
      },
    ],
  },
  rain: {
    who: 'ruslan',
    from: 14,
    wet: true,
    episodes: [
      {
        moods: ['sad', null],
        choices: [
          { effect: { take: ['bread', 1] }, mood: 'happy', next: [1, 3] },
          { effect: {}, mood: 'sad' },
        ],
      },
      {
        moods: ['happy', 'happy'],
        choices: [
          { effect: { rating: 0.03, boost: [0.1, 5] }, mood: 'happy' },
          { effect: { money: 300, boost: [0.05, 5] }, mood: 'happy' },
        ],
      },
    ],
  },
};

export const SKIT_IDS = Object.keys(SKITS) as SkitId[];

/** С какого дня сценки, шанс в свободный день и передышка после законченной истории. */
export const SKIT_FROM = 6;
export const SKIT_CHANCE = 0.45;
export const SKIT_GAP = 2;

export interface SkitsState {
  /** Идущая история: какой эпизод и с какого дня он ждёт. */
  cur?: { id: SkitId; ep: number; due: number };
  done: SkitId[];
  /** Раньше этого дня новая история не начнётся. */
  nextAt?: number;
  /** Прибавка гостей от сценок. */
  boost?: { pct: number; until: number };
}

export const skitsOf = (state: StoreState): SkitsState => state.skits ?? { done: [] };

/** Случай дня: от зерна магазина и дня (не общий генератор — симулятор не сдвигается). */
const roll = (state: StoreState, salt: number): number => rng(((state.seed ?? 1) ^ Math.imul(state.day * 131 + salt, 0x9e3779b1)) >>> 0)();

/** Сценка сегодня (или null): продолжение, если пора, или новая история в свободный день. */
export function skitToday(state: StoreState): { id: SkitId; ep: number } | null {
  if (inZar(state) || state.day < SKIT_FROM || quietDays(state) || bigDayFor(state.day) || taleToday(state)) return null;
  const skits = skitsOf(state);
  if (skits.cur) return state.day >= skits.cur.due ? { id: skits.cur.id, ep: skits.cur.ep } : null;
  if (state.day < (skits.nextAt ?? 0) || roll(state, 1) >= SKIT_CHANCE) return null;
  const wet = isWet(weatherFor(state.day));
  const options = SKIT_IDS.filter((id) => !skits.done.includes(id) && state.day >= SKITS[id].from && (!SKITS[id].wet || wet));
  if (!options.length) return null;
  return { id: options[Math.floor(roll(state, 2) * options.length)], ep: 0 };
}

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Хватает ли на этот ответ денег и товара. */
export function canAnswer(state: StoreState, choice: SkitChoice): boolean {
  const e = choice.effect;
  if (e.money !== undefined && e.money < 0 && state.money < -e.money) return false;
  if (e.take && stockOf(state, e.take[0]) < e.take[1]) return false;
  return true;
}

/** Ответ на сценку: последствия, продолжение или конец истории. null — сценки нет или ответ недоступен. */
export function answerSkit(state: StoreState, id: SkitId, ep: number, index: number): StoreState | null {
  const today = skitToday(state);
  if (!today || today.id !== id || today.ep !== ep) return null;
  const choice = SKITS[id].episodes[ep]?.choices[index];
  if (!choice || !canAnswer(state, choice)) return null;
  const e = choice.effect;
  let s = state;
  if (e.take) s = take(s, e.take[0], e.take[1]);
  if (e.money) s = { ...s, money: s.money + e.money };
  if (e.rating) s = { ...s, rating: Math.round(Math.min(5, Math.max(0, s.rating + e.rating)) * 100) / 100 };
  const skits = skitsOf(s);
  let boost = skits.boost;
  if (e.boost) {
    const [pct, days] = e.boost;
    const still = boost && boost.until >= s.day ? boost : undefined;
    boost = still && still.pct > pct ? still : { pct, until: s.day + days - 1 };
  }
  const next = choice.next;
  const cur = next ? { id, ep: next[0], due: s.day + next[1] } : undefined;
  const done = next ? skits.done : [...skits.done, id];
  return { ...s, skits: { ...skits, cur, done, boost, nextAt: next ? skits.nextAt : s.day + SKIT_GAP } };
}

/** Множитель гостей от сценок (друзья Тёмы, подписчики Карины, курьеры Руслана…). */
export const skitGuests = (state: StoreState): number => {
  const boost = skitsOf(state).boost;
  return boost && state.day <= boost.until ? 1 + boost.pct : 1;
};

/** Портрет гостя с настроением. */
export const skitPortrait = (id: SkitId, mood: SkitMood): string => `portrait_skit_${SKITS[id].who}${mood ? `_${mood}` : ''}`;
