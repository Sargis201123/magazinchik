// Начало игры новичка (docs/PLAN.md «Дальше» п. 1, А–Е): первый день — гарантированный успех, первые
// три дня — тишина без технических окон и с одной подсказкой за раз, первая цель — мечта, а не долг,
// зал первой недели без лишнего шума, а первая сессия кончается подарком от бабушки.
// Здесь — только правила (кто, когда и сколько); как это выглядит — StoreScene.ts, ui/hud.ts, ui/morning.ts.
// Всё — только для нового начала (onboarding === 'play'): старые сохранения и прежнее начало идут как раньше.

import type { TextKey } from '../i18n/ru';
import { CATEGORIES, freeSlots, nextStoreLevel, SHELF_KINDS, shelfKindOpen, type Category, type StoreState } from './economy';
import { decorItem, type DecorId } from './decor';
import { onbDone, playDayOne } from './onboarding';
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

/** Рейтинг первого дня не падает (А): before — утром, after — после ночи. */
export const firstDayRating = (s: StoreState, before: number, after: number): number => (gentleDay(s) ? Math.max(before, after) : after);

// ---------- Цель-мечта (В) ----------

/** Самая дешёвая полка, которую уже можно поставить на свободное место и которой ещё нет. */
export function dreamShelf(s: StoreState): Category | null {
  if (freeSlots(s) <= 0) return null;
  const have = new Set(s.shelves.map((sh) => sh.kind));
  const open = CATEGORIES.filter((k) => shelfKindOpen(s, k) && !have.has(k) && SHELF_KINDS[k].price > 0);
  open.sort((a, b) => SHELF_KINDS[a].price - SHELF_KINDS[b].price);
  return open[0] ?? null;
}

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
