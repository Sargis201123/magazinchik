// Бабушкино обучение для каждого новичка: первые два-три дня бабушка ведёт за руку.
// Каждый шаг ждёт, пока игрок сам сделает дело: пробьёт покупку, разложит товар, закупит нужное,
// откроет магазин. Над тем, что нажать, — подсветка и стрелка (ui/coach.ts), рядом — одна строчка.
// Шаг хранится в сохранении (поле tut): переживёт перестройку зала, сворачивание и перезапуск.
// Цель на экране не видна — шаг не держит игру: ждёт, а потом сам идёт дальше (TUT_WAIT_MS).
// Первая неделя: каждое утро со 3-го по 7-й день бабушка говорит, что появилось нового (weekNote).

import { buyStock, nextStoreLevel, onShelves, PRODUCTS, sellableProducts, warehouseCapacity, warehouseCount, warehouseOf, type ProductId, type StoreState } from './economy';
import { openAllTabs, tabOpen } from './onboarding';

/** Шаги обучения по порядку. */
export const TUT_STEPS = ['serve', 'restock', 'summary', 'reorder', 'open', 'hall'] as const;
export type TutStep = (typeof TUT_STEPS)[number];

/** Повтор из профиля (🏆 → «Бабушкино обучение»): начинается утром, итога дня в нём нет. */
export const REPLAY_STEPS: readonly TutStep[] = ['reorder', 'open', 'serve', 'restock', 'hall'];

export interface TutState {
  /** Какой шаг сейчас; 'done' — пройдено или пропущено. */
  step: TutStep | 'done';
  /** Запущено заново из профиля — свой порядок шагов (REPLAY_STEPS). */
  replay?: boolean;
  /** Пропустил кнопкой «Пропустить обучение». */
  skipped?: boolean;
  /**
   * В первый день полка так и не опустела: шаг «Разложи товар» перенесён на второй день — после
   * «Открыть магазин», а за ним — «Зал».
   */
  late?: boolean;
  /** Какой шаг уже ушёл в аналитику (tut_step) — после перезапуска не считается второй раз. */
  told?: TutStep;
}

/** Где идёт шаг: в зале днём, в итогах дня или в утреннем окне. */
export type TutPlace = 'hall' | 'summary' | 'morning';
export const TUT_PLACE: Record<TutStep, TutPlace> = {
  serve: 'hall',
  restock: 'hall',
  summary: 'summary',
  reorder: 'morning',
  open: 'morning',
  hall: 'morning',
};

/**
 * Сколько ждать (мс игрового дня), если цели на экране нет (некого пробивать, полки полные), и сколько —
 * если цель есть, а игрок её не трогает. Потом шаг идёт дальше сам: обучение не держит игру.
 */
export const TUT_WAIT_MS = 45_000;
export const TUT_IGNORE_MS = 40_000;

const isStep = (v: unknown): v is TutStep => (TUT_STEPS as readonly string[]).includes(v as string);
const route = (tut: TutState): readonly TutStep[] => (tut.replay ? REPLAY_STEPS : TUT_STEPS);

/** Идущий шаг обучения (null — обучения нет или оно кончилось). */
export const tutStep = (state: StoreState): TutStep | null => (state.tut && state.tut.step !== 'done' ? state.tut.step : null);

/** Номер шага с 1 — для аналитики (tut_step, tut_skip). */
export const tutIndex = (state: StoreState): number => {
  const step = tutStep(state);
  return step && state.tut ? route(state.tut).indexOf(step) + 1 : 0;
};

/**
 * Шаг, который сейчас идёт именно здесь. «Зал» ждёт утра, когда вкладка уже открыта (у новичка — 3-й день):
 * во втором утре её ещё нет — шаг просто подождёт.
 */
export function tutAt(state: StoreState, place: TutPlace): TutStep | null {
  const step = tutStep(state);
  if (!step || TUT_PLACE[step] !== place) return null;
  if (step === 'hall' && !tabOpen(state, 'hall')) return null;
  return step;
}

/**
 * Ждать ли шаг без срока, пока цели нет. Первый день новичка: первая продажа и первая пустая полка
 * случатся сами, до конца дня (тогда шаг закроется вместе с днём). В повторе из профиля — по TUT_WAIT_MS.
 */
export const tutPatient = (state: StoreState, step: TutStep): boolean =>
  !state.tut?.replay && ((state.day === 1 && step === 'serve') || (state.day <= 2 && step === 'restock'));

/** Шаг ещё не ушёл в аналитику: отметить (вернёт новое состояние) — или null, если уже. */
export function tutTell(state: StoreState): StoreState | null {
  const step = tutStep(state);
  if (!step || !state.tut || state.tut.told === step) return null;
  return { ...state, tut: { ...state.tut, told: step } };
}

/** Следующий шаг по порядку (после последнего — 'done'). */
export function tutNext(state: StoreState): StoreState {
  const tut = state.tut;
  const step = tutStep(state);
  if (!tut || !step) return state;
  // Перенесённая полка — сразу после открытия второго дня, а за ней — дальше по порядку («Зал»).
  if (tut.late && step === 'open') return { ...state, tut: { ...tut, step: 'restock' } };
  if (tut.late && step === 'restock') return { ...state, tut: { ...tut, step: 'hall', late: undefined } };
  const steps = route(tut);
  const next = steps[steps.indexOf(step) + 1] ?? 'done';
  return { ...state, tut: { ...tut, step: next } };
}

/** Игрок сделал то, чего ждал шаг step: дальше. Другой шаг — ничего (кнопку нажали не в обучении). */
export const tutPass = (state: StoreState, step: TutStep): StoreState => (tutStep(state) === step ? tutNext(state) : state);

/**
 * Конец дня: шаги зала, до которых не дошло (не было продажи, полки не пустели), закрываются вместе с днём.
 * Полку в первый день новичка не показали — она переносится на второй (late).
 */
export function tutDayEnd(state: StoreState): StoreState {
  const tut = state.tut;
  const step = tutStep(state);
  if (!tut || !step || TUT_PLACE[step] !== 'hall') return state;
  // Первый раз (у новичка — первый день): прямо к итогам, а полка — завтра. Номер дня тут не смотрим:
  // к итогам он уже следующий.
  if (!tut.replay && !tut.late) return { ...state, tut: { ...tut, step: 'summary', late: true } };
  let next = state;
  for (let i = 0; i < TUT_STEPS.length; i++) {
    const now = tutStep(next);
    if (!now || TUT_PLACE[now] !== 'hall') break;
    next = tutNext(next);
  }
  return next;
}

/** Утро: итоги вчерашнего дня уже позади (игру закрыли на итогах) — шаг о них пропускаем. */
export const tutMorning = (state: StoreState): StoreState => tutPass(state, 'summary');

/** Новичок: обучение с первого шага. */
export const tutStart = (state: StoreState): StoreState => ({ ...state, tut: { step: TUT_STEPS[0] } });

/** «Бабушкино обучение» из профиля: заново, с утренней закупки. */
export const tutReplay = (state: StoreState): StoreState => ({ ...state, tut: { step: REPLAY_STEPS[0], replay: true } });

/** «Пропустить обучение»: шаги кончаются, все вкладки утра открыты и знакомы. */
export function tutSkip(state: StoreState): StoreState {
  if (!tutStep(state)) return state;
  return openAllTabs({ ...state, tut: { ...state.tut, step: 'done', skipped: true } });
}

/**
 * Сохранение без поля tut. Новичок нового начала, который как раз в первых днях (игра обновилась
 * посреди них), получает обучение с того места, где он сейчас; остальные — без него. Испорченный
 * шаг (не из списка) — обучение окончено.
 */
export function migrateTut(state: StoreState): StoreState {
  if (state.tut) return isStep(state.tut.step) || state.tut.step === 'done' ? state : { ...state, tut: { step: 'done' } };
  if (state.onboarding !== 'play' || state.day > 2) return state;
  if (state.day === 2) return { ...state, tut: { step: 'reorder' } };
  return { ...state, tut: { step: state.onb?.done.includes('sale') ? 'restock' : 'serve' } };
}

// ---------- Первая неделя: что ни день — что-то новое ----------

/** Дни первой недели, в которые бабушка говорит о новом (2-й — сами шаги обучения). */
export const WEEK_DAYS = [3, 4, 5, 6, 7] as const;

/** Гостинец с дачи в конце первой недели: на склад, бесплатно, как запас в первый день. */
export const WEEK_GIFT: Partial<Record<ProductId, number>> = { apples: 4, potatoes: 4 };

export interface WeekNote {
  day: number;
  key: 'tut.week.product' | 'tut.week.price' | 'tut.week.event' | 'tut.week.staff' | 'tut.week.grow' | 'tut.week.gift';
  /** Новый товар (3-й день). */
  product?: ProductId;
  /** Цена следующего помещения (6-й день). */
  cost?: number;
}

/**
 * Что нового сегодня (новичок первой недели): 3-й — товар, которого ещё нет в магазине, 4-й — в зале
 * бывают мелкие хлопоты (мини-события), 5-й — первый помощник, 6-й — первое расширение, 7-й — гостинец.
 * null — сегодня ничего или уже сказано.
 */
export function weekNote(state: StoreState): WeekNote | null {
  const day = state.day;
  if (state.onboarding !== 'play' || !(WEEK_DAYS as readonly number[]).includes(day) || (state.onb?.week ?? 0) >= day) return null;
  if (day === 3) {
    const product = sellableProducts(state).find((id) => PRODUCTS[id] && onShelves(state, id) + warehouseOf(state, id) === 0);
    return product ? { day, key: 'tut.week.product', product } : { day, key: 'tut.week.price' };
  }
  if (day === 4) return { day, key: 'tut.week.event' };
  if (day === 5) return { day, key: 'tut.week.staff' };
  if (day === 6) {
    const next = nextStoreLevel(state);
    return next ? { day, key: 'tut.week.grow', cost: next.cost } : null;
  }
  return { day, key: 'tut.week.gift' };
}

/** Новость дня сказана: больше не показывать; в 7-й день — гостинец на склад (сколько влезет). */
export function seeWeek(state: StoreState, note: WeekNote): StoreState {
  let next: StoreState = { ...state, onb: { done: state.onb?.done ?? [], ...state.onb, week: note.day } };
  if (note.key !== 'tut.week.gift') return next;
  for (const [id, qty] of Object.entries(WEEK_GIFT) as [ProductId, number][]) {
    const room = Math.min(qty, warehouseCapacity(next) - warehouseCount(next));
    if (room > 0) next = buyStock(next, id, room, 0) ?? next;
  }
  return next;
}
