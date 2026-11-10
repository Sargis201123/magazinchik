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

/**
 * Фон места, если у сцены нет своей картинки (art/family.py): до 10.11 из 61 сцены картинка была у трёх,
 * а «Вечер, дома» шёл поверх зала магазина. Сцены «в магазине» и «у входа» — без фона: за окном диалога
 * и так виден сам магазин.
 */
export const PLACE_ART: Partial<Record<TextKey, string>> = {
  'drama.place.home_evening': 'drama_home',
  'drama.place.kitchen': 'drama_kitchen',
  'drama.place.empty_home': 'drama_kitchen',
  'drama.place.call': 'drama_call',
  'drama.place.night': 'drama_night',
};

/** Картинка над первой репликой сцены: своя или фон места. */
export const sceneArt = (scene: DramaScene): string | undefined => scene.art ?? PLACE_ART[scene.place];

/** Сколько сцен за один настоящий день. Остальные ждут завтра (решение автора о темпе — здесь). */
export const DRAMA_PER_DAY = 2;
/**
 * Первая игровая неделя — без предела за настоящий день: новичок, который увлёкся в первый же вечер, не должен
 * через десять минут упереться в «загляни завтра». Сцен на эти дни шесть, по одной в утро — не проглотить.
 */
export const DRAMA_FREE_DAYS = 7;
const capped = (state: StoreState): boolean => state.day > DRAMA_FREE_DAYS;

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
  return scene && (!capped(state) || shownToday(state, today) < DRAMA_PER_DAY) ? scene : null;
}

/** Сцена готова, но сегодняшний предел выбран: Соня ждёт завтра (тизер в итогах дня). */
export const dramaHeld = (state: StoreState, today: string): boolean => capped(state) && Boolean(dueScene(state)) && shownToday(state, today) >= DRAMA_PER_DAY;

/**
 * Вечер первого дня новичка: первая сцена («Вечер, дома») играет сразу после итогов, а не утром третьего дня.
 * Так завязка истории попадает в первую же сессию, а «первый день в магазине» звучит в первый день.
 * state — уже после итогов (номер дня — следующий). Игру закрыли на итогах — сцена придёт утром, как раньше.
 */
export function eveningScene(state: StoreState): DramaScene | null {
  if (state.onboarding !== 'play' || state.day !== 2 || upToOf(state) > 0) return null;
  return SCENES[0];
}

/** Вечерняя сцена первого дня показана. */
export function seeEvening(state: StoreState, today: string): StoreState {
  const scene = eveningScene(state);
  if (!scene) return state;
  return { ...state, drama: { upTo: scene.day, last: state.day, date: today, today: shownToday(state, today) + 1 } };
}

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

// ---------- Соня замечает ночные смены ----------

/** На какую ночную смену подряд Соня пишет отцу; дальше — на каждую седьмую. */
export const NIGHT_NOTES = [2, 4, 7] as const;

/** День сцены у поворота под дождём: после неё Соня говорит о ночных сменах иначе — теплее и строже. */
const RECONCILED = SCENES.find((s) => s.place === 'drama.place.road')!.day;

/** Ночные смены подряд: отработал — на одну больше, закрылся вовремя — счёт сброшен. */
export function noteNight(state: StoreState, worked: boolean): StoreState {
  const run = worked ? (state.nightRun ?? 0) + 1 : 0;
  if (run === (state.nightRun ?? 0)) return state;
  return { ...state, nightRun: run || undefined };
}

/**
 * Соня пишет отцу, когда он собирается остаться в магазине на ночь уже которую смену подряд (окно «Ночная
 * смена?»). История — о том, что дочери нужен отец, а не продавец, а игра платит за ночную работу: пусть
 * она это замечает. Только текст: ни на деньги, ни на саму смену не влияет. null — история ещё не началась
 * или сегодня повода нет.
 */
export function sonyaNightNote(state: StoreState): TextKey | null {
  const told = upToOf(state);
  if (told <= 0) return null;
  const night = (state.nightRun ?? 0) + 1;
  const step = night >= 7 && night % 7 === 0 ? NIGHT_NOTES.length : (NIGHT_NOTES as readonly number[]).indexOf(night) + 1;
  if (!step) return null;
  return `drama.night.${told >= RECONCILED ? 'after' : 'before'}.${step}` as TextKey;
}
