// Сюжет «Папа и Соня» — драматическая история через всю игру. Игрок — отец, который после
// беды в семье с головой ушёл в работу; дочка Соня, бабушка и соседи иногда заговаривают
// с ним по утрам. Что случилось, раскрывается понемногу: сначала только намёки, правда —
// ближе к концу, а потом — светлый финал.
// Сцены привязаны к дням (не чаще одной за утро) и на экономику не влияют никак.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import type { Line } from './story';
import { SCENES } from './dramaScenes';

export interface DramaScene {
  /** С какого дня можно показать (если предыдущая уже показана). */
  day: number;
  /** Где происходит: «Вечер, дома», «Звонок»… */
  place: TextKey;
  /** Картинка над первой репликой. */
  art?: string;
  /** В этот день Соня заходит в магазин. */
  visit?: boolean;
  lines: Line[];
}

export interface DramaState {
  /** Сколько сцен уже показано. */
  seen: number;
  /** День, когда показали последнюю (вторую в то же утро не показываем). */
  last?: number;
  /** День, когда Соня заходит в магазин. */
  visit?: number;
}

export { SCENES };

const seenOf = (state: StoreState): number => state.drama?.seen ?? 0;

/** Сцена этого утра: следующая по порядку, если её день наступил. */
export function dramaScene(state: StoreState): DramaScene | null {
  const scene = SCENES[seenOf(state)];
  if (!scene || state.tourDone === false || state.day < scene.day || state.drama?.last === state.day) return null;
  return scene;
}

export function seeDrama(state: StoreState): StoreState {
  const scene = dramaScene(state);
  if (!scene) return state;
  return { ...state, drama: { seen: seenOf(state) + 1, last: state.day, visit: scene.visit ? state.day : state.drama?.visit } };
}

/** История рассказана до конца. */
export const dramaDone = (state: StoreState): boolean => seenOf(state) >= SCENES.length;
export const isLastScene = (scene: DramaScene): boolean => scene === SCENES[SCENES.length - 1];

/** Соня посадила подсолнухи у входа. */
const PLANTED = SCENES.findIndex((s) => s.place === 'drama.place.entrance') + 1;
export const sunflowersPlanted = (state: StoreState): boolean => seenOf(state) >= PLANTED;

/** После примирения Соня помогает по субботам (каждый седьмой день). */
const HELPS = SCENES.findIndex((s) => s.visit && s.day >= 80) + 1;

/** Соня сегодня заходит в магазин: в день сцены «в магазине» или по субботам после примирения. */
export const sonyaVisits = (state: StoreState): boolean => state.drama?.visit === state.day || (seenOf(state) >= HELPS && state.day % 7 === 6);
