// Эдуард растёт. По сюжету «МегаМарт» напротив открывается в третьей главе и закрывается
// в пятой. Но Эдуард не сдаётся: после сюжета он возвращается в то же помещение — сначала
// ларьком, потом маркетом и, наконец, торговым центром. Чем больше его магазин, тем больше
// гостей района уходит к нему и тем чаще он устраивает ценовые войны. Высокий рейтинг и
// реклама удерживают своих покупателей.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import { activeAd } from './ads';
import { CHAPTERS } from './story';

export interface EduardStage {
  nameKey: TextKey;
  /** Реплика Эдуарда, когда он открыл этот магазин. */
  lineKey: TextKey;
  /** Доля гостей района, которых он уводит. */
  pull: number;
  /** Во сколько раз чаще ценовые войны. */
  war: number;
}

export const EDUARD_STAGES: EduardStage[] = [
  { nameKey: 'eduard.stage0', lineKey: 'eduard.line0', pull: 0, war: 0.5 },
  { nameKey: 'eduard.stage1', lineKey: 'eduard.line1', pull: 0.03, war: 1 },
  { nameKey: 'eduard.stage2', lineKey: 'eduard.line2', pull: 0.06, war: 1.3 },
  { nameKey: 'eduard.stage3', lineKey: 'eduard.line3', pull: 0.09, war: 1.6 },
];
export const EDUARD_MAX = EDUARD_STAGES.length - 1;
/** Через сколько дней Эдуард открывает магазин побольше. */
export const EDUARD_GROWTH_DAYS = 12;
/** С таким рейтингом свои покупатели уходят к нему вдвое реже; реклама — тоже вдвое. */
export const EDUARD_LOYAL_RATING = 4.5;

/** Как выглядит помещение напротив. */
export type EduardLook = 'vacant' | 'mega' | 'kiosk' | 'market' | 'mall';

const freePlay = (state: StoreState): boolean => state.story.chapter >= CHAPTERS.length;

/** Стадия Эдуарда в свободной игре (null — ещё идёт сюжет). */
export const eduardStage = (state: StoreState): number | null => (freePlay(state) ? Math.min(EDUARD_MAX, state.eduard?.stage ?? 0) : null);

export function eduardLook(state: StoreState): EduardLook {
  const chapter = state.story.chapter;
  // До третьей главы помещение сдаётся; в пятой «МегаМарт» закрылся.
  if (chapter < 2) return 'vacant';
  if (chapter < 4) return 'mega';
  const stage = eduardStage(state);
  if (stage === null) return 'vacant';
  return (['vacant', 'kiosk', 'market', 'mall'] as const)[stage];
}

/** Ночью: в свободной игре Эдуард понемногу растёт. */
export function growEduard(state: StoreState): StoreState {
  if (!freePlay(state)) return state;
  const now = state.eduard;
  if (!now) return { ...state, eduard: { stage: 0, since: state.day, seen: 0 } };
  if (now.stage >= EDUARD_MAX || state.day - now.since < EDUARD_GROWTH_DAYS) return state;
  return { ...state, eduard: { ...now, stage: now.stage + 1, since: state.day } };
}

/** Какую новость про Эдуарда показать утром (стадия) или null. */
export function eduardNews(state: StoreState): number | null {
  const stage = eduardStage(state);
  return stage !== null && stage > (state.eduard?.seen ?? 0) ? stage : null;
}

export const seeEduardNews = (state: StoreState): StoreState =>
  state.eduard ? { ...state, eduard: { ...state.eduard, seen: state.eduard.stage } } : state;

/** Сколько гостей сегодня уходят к Эдуарду (доля). */
export function eduardPull(state: StoreState): number {
  const stage = eduardStage(state);
  if (stage === null) return 0;
  let pull = EDUARD_STAGES[stage].pull;
  if (state.rating >= EDUARD_LOYAL_RATING) pull /= 2;
  if (activeAd(state)) pull /= 2;
  return pull;
}

/** Множитель гостей: часть района ходит к Эдуарду. */
export const eduardGuests = (state: StoreState): number => 1 - eduardPull(state);

/** Множитель шанса ценовой войны: в свободной игре — по размеру его магазина. */
export function eduardWar(state: StoreState): number {
  const stage = eduardStage(state);
  return stage === null ? 1 : EDUARD_STAGES[stage].war;
}
