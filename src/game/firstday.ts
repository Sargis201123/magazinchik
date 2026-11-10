// Начало игры новичка (docs/PLAN.md «Дальше» п. 1, А–Е): первый день — гарантированный успех, первые
// три дня — тишина без технических окон и с одной подсказкой за раз, первая цель — мечта, а не долг,
// зал первой недели без лишнего шума, а первая сессия кончается подарком от бабушки.
// Здесь — только правила (кто, когда и сколько); как это выглядит — StoreScene.ts, ui/hud.ts, ui/morning.ts.
// Всё — только для нового начала (onboarding === 'play'): старые сохранения и прежнее начало идут как раньше.

import type { TextKey } from '../i18n/ru';
import { nextStoreLevel, SHELF_KINDS, type StoreState } from './economy';
import { decorItem, type DecorId } from './decor';
import { dreamShelf, markOnb, onbDone, playDayOne } from './onboarding';
import type { Goal } from './nudge';

/** Сколько первых дней тихие: без технических окон, цель — мечта, о долге — только тёплой историей. */
export const QUIET_DAYS = 3;
/** Сколько дней зал без шума: закрытые пристройки без надписей, «Сдаётся» и «+» — когда дорастёшь. */
export const CLEAN_DAYS = 7;

/** Новичок нового начала. */
const newbie = (s: StoreState): boolean => s.onboarding === 'play';

/** Тихие первые дни новичка (Б, В). */
export const quietDays = (s: StoreState): boolean => newbie(s) && s.day <= QUIET_DAYS;

/** Зал первой недели без шума (Д): только в киоске — дальше пристройки уже нужны. */
export const cleanHall = (s: StoreState): boolean => newbie(s) && s.day <= CLEAN_DAYS && s.level === 0;

/**
 * Бабушка весь первый день за прилавком (Г): стоит у кассы, иногда пробивает сама, раскладывает товар.
 * Сохранение, где она уже уехала (прежняя версия игры), — без неё.
 */
export const grannyStays = (s: StoreState): boolean => playDayOne(s) && !onbDone(s, 'bye');

/**
 * Бабушка сама раскладывает опустевшую полку (А). В первый раз — сразу, показывает, как это делается
 * (demoed — уже показала); дальше обучение подсвечивает полку, а бабушка ждёт GRANNY_LATE_MS: не
 * нажал — разложит сама. Покупатель в первый день не уходит из-за полки, долго стоящей пустой.
 */
export const grannyStocksNow = (s: StoreState, emptyMs: number, demoed: boolean): boolean => grannyStays(s) && (!demoed || emptyMs >= GRANNY_LATE_MS);
export const GRANNY_LATE_MS = 9000;

/**
 * Через сколько мс ожидания у кассы хозяина бабушка пробивает покупателя сама: хозяин стоит у кассы —
 * дольше (пусть игрок успеет сам), ушёл по делам — скорее. До первой продажи — никогда: её делает игрок.
 */
export const GRANNY_SERVE_MS = 7000;
export const GRANNY_SERVE_BUSY_MS = 2500;
/** Бабушка пробивает медленнее хозяина. */
export const GRANNY_SCAN_SLOW = 1.7;

export function grannyServesAfter(s: StoreState, ownerBusy: boolean): number | null {
  if (!grannyStays(s) || !onbDone(s, 'sale')) return null;
  return ownerBusy ? GRANNY_SERVE_BUSY_MS : GRANNY_SERVE_MS;
}

/** Бабушка хвалит: на серии покупок подряд (комбо) и на счёте покупок, пробитых самим новичком. */
export const PRAISE_COMBOS = [3, 6, 10] as const;
export const PRAISE_OWN = [4, 8, 14] as const;
export const praiseAt = (s: StoreState, combo: number, own: number): boolean =>
  grannyStays(s) && ((PRAISE_COMBOS as readonly number[]).includes(combo) || (PRAISE_OWN as readonly number[]).includes(own));

/**
 * Первый день новичка: покупатель, не нашедший товар (кончился совсем), не считается ушедшим без
 * покупки — «всё раскупили» в первый день не провал. Очередь в этот день держит бабушка.
 */
export const gentleDay = (s: StoreState): boolean => playDayOne(s);

/**
 * Рейтинг тихих дней не падает (может расти): before — утром, after — после ночи, s — ещё до ночи (день — тот,
 * что кончился). Первый день — праздник с бабушкой (А); во 2-й и 3-й новичок впервые сам и за кассой, и у полок,
 * пусть учится без штрафа (07.11: кто во 2-й день жал только кассу, получал «10 ушли» и минус рейтинга).
 */
export const quietRating = (s: StoreState, before: number, after: number): number => (quietDays(s) ? Math.max(before, after) : after);

/**
 * Вечер 2-го и 3-го дня новичка: за ушедших без покупки бабушка не ругает, а подсказывает, что делать
 * (первый вечер — её прощание, с 4-го — обычные оценки дня). s — ещё до ночи.
 */
export const learningEvening = (s: StoreState): boolean => quietDays(s) && !playDayOne(s);

/**
 * Покупатель у полки, где товар кончился, а на складе он есть, говорит «сейчас поднесут» и ждёт.
 * В первый день — пока бабушка в зале (она и разложит); во 2-й и 3-й — новичку: подсветка обучения
 * и строчка снизу показывают полку, и он успевает нажать её сам.
 */
export const shelfWaits = (s: StoreState, grannyHere: boolean): boolean => (gentleDay(s) ? grannyHere : quietDays(s));

// ---------- Цель-мечта (В) ----------

// Полка-мечта считается в onboarding.ts: по ней же «Зал» открывается на день раньше, когда на неё уже хватает.
export { dreamShelf };

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Первая цель новичка — мечта: накопить на новую полку (потом — на первое расширение), с полоской.
 * null — не тихие дни, у HUD обычная цель (глава сюжета).
 */
export function dreamGoal(s: StoreState): Goal | null {
  if (!quietDays(s)) return null;
  const kind = dreamShelf(s);
  if (kind) {
    const cost = SHELF_KINDS[kind].price;
    return {
      id: 'dream',
      icon: '✨',
      // Хватает — полоска не стоит полной до вечера, а зовёт за покупкой.
      key: s.money >= cost ? 'goal.dream.shelfReady' : 'goal.dream.shelf',
      params: { name: SHELF_KINDS[kind].nameKey, n: Math.min(s.money, cost), cost },
      progress: clamp01(s.money / cost),
      next: s.money >= cost ? 'goal.next.dreamReady' : 'goal.next.dream',
    };
  }
  const next = nextStoreLevel(s);
  if (!next) return null;
  return {
    id: 'dream',
    icon: '✨',
    key: 'goal.dream.level',
    params: { name: next.nameKey, n: Math.min(s.money, next.cost), cost: next.cost },
    progress: clamp01(s.money / next.cost),
    next: 'goal.next.dreamGrow',
  };
}

/** Тёплая версия реплики о долге во втором утре (бабушкина семейная история, без давления). */
export const WARM_LINES: Partial<Record<TextKey, TextKey>> = {
  'story.ch1.intro2': 'story.ch1.intro2warm',
  'story.ch1.goal': 'story.ch1.goalWarm',
};
export const warmKey = (s: StoreState, key: TextKey): TextKey => (newbie(s) && s.day <= CLEAN_DAYS ? (WARM_LINES[key] ?? key) : key);

// ---------- Подарок после первого дня (Е) ----------

/** Бабушкин подарок за первый день: ваза с цветами на прилавок (вещь оформления, без бонусов к экономике). */
export const FIRST_GIFT: DecorId = 'counter_vase';

/**
 * Подарок за первый день: в оформление и сразу на прилавок (если там ничего нет). state — уже после ночи
 * первого дня; null — не новичок, уже подарено или вещь уже есть.
 */
export function firstDayGift(s: StoreState): StoreState | null {
  if (!newbie(s) || s.day !== 2 || onbDone(s, 'gift')) return null;
  const item = decorItem(FIRST_GIFT);
  const owned = s.decor.owned.includes(FIRST_GIFT);
  const decor = {
    ...s.decor,
    owned: owned ? s.decor.owned : [...s.decor.owned, FIRST_GIFT],
    active: s.decor.active[item.kind] ? s.decor.active : { ...s.decor.active, [item.kind]: FIRST_GIFT },
  };
  return { ...s, decor, onb: { ...s.onb, done: [...(s.onb?.done ?? []), 'gift'] } };
}

// ---------- Бабушкина шкатулка: загадка первых вечеров ----------

/** Со второго утра за прилавком стоит запертая шкатулка с запиской «не открывать до дня 4». */
export const BOX_FROM_DAY = 2;
export const BOX_OPENS_DAY = 4;
/** Что внутри, кроме старого ключа с биркой «у моста» (зацепка к Заречью): монеты «на первые полки». */
export const BOX_COINS = 150;

/** Шкатулка в зале: заперта, ждёт касания или её уже нет (не новичок, рано, открыта). */
export function grannyBox(s: StoreState): 'locked' | 'ready' | null {
  if (!newbie(s) || onbDone(s, 'box') || s.day < BOX_FROM_DAY) return null;
  return s.day >= BOX_OPENS_DAY ? 'ready' : 'locked';
}

/** Открыть шкатулку: монеты в кассу, шаг пройден. Не пора — состояние как было. */
export function openGrannyBox(s: StoreState): StoreState {
  if (grannyBox(s) !== 'ready') return s;
  return markOnb({ ...s, money: s.money + BOX_COINS }, 'box');
}

// ---------- Первая монета в рамке ----------

/** Первая выручка новичка — в рамку на стену (один раз, только в новом начале). */
export function frameFirstCoin(s: StoreState, total: number): StoreState {
  if (!newbie(s) || s.onb?.firstCoin) return s;
  return { ...s, onb: { ...s.onb, done: s.onb?.done ?? [], firstCoin: Math.max(1, Math.round(total)) } };
}

/** Сколько было в первой выручке; нет рамки — undefined. */
export const firstCoin = (s: StoreState): number | undefined => s.onb?.firstCoin;

// ---------- Первый постоянный и гость дня ----------

/** Первый постоянный новичка: Пётр Ильич (хлеб каждое утро). */
export const FIRST_REGULAR = 'petr' as const;

/**
 * Когда (доля дня) заходит первый постоянный и что говорит: в 1-й день — знакомится («оставь батон на
 * завтра»), во 2-й — с утра, как обещал, и зовёт магазин по имени. Дальше — как все постоянные.
 */
export function firstRegularVisit(s: StoreState): { at: number; line: 'meet' | 'back' } | null {
  if (!newbie(s)) return null;
  if (s.day === 1) return { at: 0.45, line: 'meet' };
  if (s.day === 2) return { at: 0.12, line: 'back' };
  return null;
}

/** Первые дни новичка в каждый день гарантированно заходит один редкий гость — «гость дня» (альбом). */
export const GUEST_OF_DAY_DAYS = 3;
export const GUEST_OF_DAY_AT = 0.6;
export const guestOfDay = (s: StoreState): boolean => newbie(s) && s.day <= GUEST_OF_DAY_DAYS;

/** Первые тихие дни новичка (09.11, решение автора): воров нет — первые впечатления без «Украли!». */
export const noThieves = (s: StoreState): boolean => quietDays(s);
