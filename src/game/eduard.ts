// Конкуренты напротив. По сюжету «МегаМарт» открывается в третьей главе и закрывается в пятой.
// После сюжета в то же помещение по очереди въезжают «боссы» района — у каждого свой магазин,
// своя хватка и своя цена победы: ларёк Эдуарда, дискаунтер «Копеечка», фермерский «Свежак»
// и, наконец, Эдуард с торговым центром. Босс уводит часть гостей и устраивает ценовые войны.
// Победить его — держать рейтинг не ниже его планки BOSS_DAYS вечеров подряд: покупатели
// уходят от него, магазин закрывается, район платит премию. Через время приходит следующий.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import { activeAd } from './ads';
import { CHAPTERS } from './story';

export interface EduardStage {
  nameKey: TextKey;
  /** Реплика босса (или новость), когда он открылся. */
  lineKey: TextKey;
  /** Доля гостей района, которых он уводит. */
  pull: number;
  /** Во сколько раз чаще ценовые войны. */
  war: number;
  /** Какой рейтинг держать BOSS_DAYS вечеров подряд, чтобы он закрылся. */
  rating: number;
  /** Премия района за победу. */
  reward: number;
  /** Сам Эдуард (его портрет и походка) или новый хозяин — о нём рассказывают в новостях. */
  eduard: boolean;
}

export const EDUARD_STAGES: EduardStage[] = [
  { nameKey: 'eduard.stage0', lineKey: 'eduard.line0', pull: 0, war: 0.5, rating: 0, reward: 0, eduard: true },
  { nameKey: 'eduard.stage1', lineKey: 'eduard.line1', pull: 0.04, war: 1, rating: 4.2, reward: 1500, eduard: true },
  { nameKey: 'eduard.stage2', lineKey: 'eduard.line2', pull: 0.07, war: 1.6, rating: 4.4, reward: 3000, eduard: false },
  { nameKey: 'eduard.stage3', lineKey: 'eduard.line3', pull: 0.09, war: 1.2, rating: 4.6, reward: 5000, eduard: false },
  { nameKey: 'eduard.stage4', lineKey: 'eduard.line4', pull: 0.12, war: 1.6, rating: 4.8, reward: 10000, eduard: true },
];
export const EDUARD_MAX = EDUARD_STAGES.length - 1;
/** Сколько дней помещение пустует до следующего конкурента. */
export const EDUARD_GROWTH_DAYS = 12;
/** Столько вечеров подряд держать рейтинг босса, чтобы он закрылся. */
export const BOSS_DAYS = 5;
/** С таким рейтингом свои покупатели уходят к нему вдвое реже; реклама — тоже вдвое. */
export const EDUARD_LOYAL_RATING = 4.5;

/** Как выглядит помещение напротив. */
export type EduardLook = 'vacant' | 'mega' | 'kiosk' | 'discount' | 'farm' | 'mall';

const freePlay = (state: StoreState): boolean => state.story.chapter >= CHAPTERS.length;

/** Стадия в свободной игре (null — ещё идёт сюжет). */
export const eduardStage = (state: StoreState): number | null => (freePlay(state) ? Math.min(EDUARD_MAX, state.eduard?.stage ?? 0) : null);

/** Сейчас напротив работает босс (не пустует и его ещё не победили). */
export function bossActive(state: StoreState): boolean {
  const stage = eduardStage(state);
  return stage !== null && stage > 0 && !state.eduard?.beaten;
}

export function eduardLook(state: StoreState): EduardLook {
  const chapter = state.story.chapter;
  // До третьей главы помещение сдаётся; в пятой «МегаМарт» закрылся.
  if (chapter < 2) return 'vacant';
  if (chapter < 4) return 'mega';
  const stage = eduardStage(state);
  if (stage === null || !bossActive(state)) return 'vacant';
  return (['vacant', 'kiosk', 'discount', 'farm', 'mall'] as const)[stage];
}

/**
 * Ночью в свободной игре: пустующее помещение через время занимает следующий босс;
 * работающий босс закрывается, если рейтинг держался не ниже его планки BOSS_DAYS вечеров подряд.
 */
export function growEduard(state: StoreState): StoreState {
  if (!freePlay(state)) return state;
  const now = state.eduard;
  if (!now) return { ...state, eduard: { stage: 0, since: state.day, seen: 0 } };
  if (now.stage === 0 || now.beaten) {
    if (now.stage >= EDUARD_MAX || state.day - now.since < EDUARD_GROWTH_DAYS) return state;
    return { ...state, eduard: { ...now, stage: now.stage + 1, since: state.day, streak: 0, beaten: false } };
  }
  const boss = EDUARD_STAGES[Math.min(now.stage, EDUARD_MAX)];
  const streak = state.rating >= boss.rating ? (now.streak ?? 0) + 1 : 0;
  if (streak < BOSS_DAYS) return { ...state, eduard: { ...now, streak } };
  return { ...state, money: state.money + boss.reward, eduard: { ...now, streak, beaten: true, since: state.day } };
}

export interface EduardNews {
  stage: number;
  /** Открылся новый конкурент или мы его победили. */
  kind: 'open' | 'beaten';
}

/** Какую новость про конкурента показать утром (или null). */
export function eduardNews(state: StoreState): EduardNews | null {
  const stage = eduardStage(state);
  if (stage === null || stage === 0) return null;
  if (state.eduard?.beaten) return (state.eduard.beatenSeen ?? 0) < stage ? { stage, kind: 'beaten' } : null;
  return stage > (state.eduard?.seen ?? 0) ? { stage, kind: 'open' } : null;
}

export const seeEduardNews = (state: StoreState): StoreState =>
  state.eduard
    ? { ...state, eduard: state.eduard.beaten ? { ...state.eduard, beatenSeen: state.eduard.stage } : { ...state.eduard, seen: state.eduard.stage } }
    : state;

/** Сколько гостей сегодня уходят к конкуренту (доля). */
export function eduardPull(state: StoreState): number {
  if (!bossActive(state)) return 0;
  let pull = EDUARD_STAGES[eduardStage(state)!].pull;
  if (state.rating >= EDUARD_LOYAL_RATING) pull /= 2;
  if (activeAd(state)) pull /= 2;
  return pull;
}

/** Множитель гостей: часть района ходит к конкуренту. */
export const eduardGuests = (state: StoreState): number => 1 - eduardPull(state);

/** Множитель шанса ценовой войны: в свободной игре — по хватке босса (без него — реже). */
export function eduardWar(state: StoreState): number {
  const stage = eduardStage(state);
  if (stage === null) return 1;
  return bossActive(state) ? EDUARD_STAGES[stage].war : EDUARD_STAGES[0].war;
}
