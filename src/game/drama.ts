// Сюжет «Папа и Соня» — драматическая история через всю игру. Игрок — отец, который после
// беды в семье с головой ушёл в работу; дочка Соня, бабушка и соседи иногда заговаривают
// с ним по утрам. Что случилось, раскрывается понемногу: сначала только намёки, правда —
// ближе к концу, а потом — светлый финал.
// Сцены привязаны к дням (почти каждый день, но не больше одной за утро) и на экономику не влияют никак.
//
// «Приходи завтра»: игровой день длится пару минут, и без предела вся история проглатывалась
// бы за вечер. Поэтому за настоящий день (по часам игрока) — не больше DRAMA_PER_DAY сцен;
// следующая ждёт завтрашнего дня, а в итогах дня об этом намекает тизер («Соня что-то хотела
// сказать…»), и бот на следующий день пишет от имени Сони (api/_lib/remind.ts).

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
  /** День последней показанной сцены (по сценарию, а не по календарю игрока). */
  upTo?: number;
  /** Старые сохранения: сколько сцен показано (до того, как сцен стало больше). */
  seen?: number;
  /** День, когда показали последнюю (вторую в то же утро не показываем). */
  last?: number;
  /** День, когда Соня заходит в магазин. */
  visit?: number;
  /** Настоящий день (дата игрока «ГГГГ-ММ-ДД»), когда показали последнюю сцену, и сколько сцен за него. */
  date?: string;
  today?: number;
}

/** Сколько сцен за один настоящий день. Остальные ждут завтра (решение автора о темпе — здесь). */
export const DRAMA_PER_DAY = 2;

export { SCENES };

/** Дни сцен в первой версии сюжета — чтобы старое сохранение «N сцен показано» продолжилось с того же места. */
const FIRST_VERSION_DAYS = [2, 4, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 73, 76, 79, 82, 85, 88, 91];

/** До какого дня сценария история уже рассказана. */
function upToOf(state: StoreState): number {
  const drama = state.drama;
  if (drama?.upTo !== undefined) return drama.upTo;
  return drama?.seen ? FIRST_VERSION_DAYS[Math.min(drama.seen, FIRST_VERSION_DAYS.length) - 1] : 0;
}

/** Сцена, чей игровой день наступил, — без оглядки на предел за настоящий день. */
function dueScene(state: StoreState): DramaScene | null {
  const upTo = upToOf(state);
  const scene = SCENES.find((s) => s.day > upTo);
  if (!scene || state.tourDone === false || state.day < scene.day || state.drama?.last === state.day) return null;
  // Новое начало (onboarding.ts): утро второго дня — первое утро новичка, в нём уже вступление главы;
  // Соня подождёт до завтра, чтобы окна не шли одно за другим.
  if (state.onboarding === 'play' && state.day <= 2) return null;
  return scene;
}

/** Сколько сцен уже показали в этот настоящий день (today — дата игрока «ГГГГ-ММ-ДД»). */
const shownToday = (state: StoreState, today: string): number => (state.drama?.date === today ? (state.drama.today ?? 0) : 0);

/** Сцена этого утра: следующая по порядку, если её день наступил и предел на сегодня не выбран. */
export function dramaScene(state: StoreState, today: string): DramaScene | null {
  const scene = dueScene(state);
  return scene && shownToday(state, today) < DRAMA_PER_DAY ? scene : null;
}

/** Сцена готова, но сегодняшний предел выбран: Соня ждёт завтра (тизер в итогах дня). */
export const dramaHeld = (state: StoreState, today: string): boolean => Boolean(dueScene(state)) && shownToday(state, today) >= DRAMA_PER_DAY;

/**
 * Соне есть что сказать при следующей встрече: сцена ждёт сейчас или будет утром следующего
 * игрового дня (для напоминания бота — api/_lib/remind.ts).
 */
export const dramaWaiting = (state: StoreState): boolean => Boolean(dueScene(state) ?? dueScene({ ...state, day: state.day + 1 }));

export function seeDrama(state: StoreState, today: string): StoreState {
  const scene = dramaScene(state, today);
  if (!scene) return state;
  return {
    ...state,
    drama: { upTo: scene.day, last: state.day, visit: scene.visit ? state.day : state.drama?.visit, date: today, today: shownToday(state, today) + 1 },
  };
}

/** История рассказана до конца. */
export const dramaDone = (state: StoreState): boolean => upToOf(state) >= SCENES[SCENES.length - 1].day;
export const isLastScene = (scene: DramaScene): boolean => scene === SCENES[SCENES.length - 1];

/** Соня посадила подсолнухи у входа. */
const PLANTED = SCENES.find((s) => s.place === 'drama.place.entrance')!.day;
export const sunflowersPlanted = (state: StoreState): boolean => upToOf(state) >= PLANTED;

/** После примирения Соня помогает по субботам (каждый седьмой день). */
const HELPS = SCENES.find((s) => s.visit && s.day >= 80)!.day;

/** Соня сегодня заходит в магазин: в день сцены «в магазине» или по субботам после примирения. */
export const sonyaVisits = (state: StoreState): boolean => state.drama?.visit === state.day || (upToOf(state) >= HELPS && state.day % 7 === 6);
