// Казуальная петля: одна понятная цель с полоской (HUD), мягкая подсказка «что дальше», если игрок
// застыл, и строка «Завтра:» в итогах дня. Ничего нового в экономике — только то, что уже есть в игре:
// глава сюжета, помещения, испытания недели, ярмарка, сезоны, праздники, погода.

import type { TextKey } from '../i18n/ru';
import { nextStoreLevel, START_DEBT, type StoreState } from './economy';
import { CHAPTERS } from './story';
import { isFairDay } from './fair';
import { seasonFor } from './endless';
import { holidayFor } from './calendar';
import { weatherFor, WEATHER_EFFECTS } from './weather';
import { openTabs } from './onboarding';

type Params = Record<string, number | string>;

/** Главная цель: строка, полоска 0…1 и что делать дальше (одной строкой, по нажатию на полоску). */
export interface Goal {
  id: 'debt' | 'orders' | 'level' | 'rating' | 'inspections' | 'weekly';
  icon: string;
  key: TextKey;
  params: Params;
  progress: number;
  next: TextKey;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Копить на следующее помещение (долг сначала: с долгом переезжать нельзя — expandStore). */
function levelGoal(s: StoreState): Goal | null {
  const next = nextStoreLevel(s);
  if (!next) return null;
  return {
    id: 'level',
    icon: '🏪',
    key: 'goal.level',
    params: { name: next.nameKey, n: Math.min(s.money, next.cost), cost: next.cost },
    progress: s.debt > 0 ? 0 : clamp01(s.money / next.cost),
    next: s.debt > 0 ? 'goal.next.debtFirst' : s.money >= next.cost ? 'goal.next.levelReady' : 'goal.next.level',
  };
}

/** Испытания недели: сколько из трёх уже готово (и доля пути к ближайшему). */
function weeklyGoal(s: StoreState): Goal | null {
  const list = s.weekly?.challenges ?? [];
  if (!list.length) return null;
  const done = list.filter((c) => c.done).length;
  const part = list.reduce((sum, c) => sum + (c.done ? 1 : clamp01(c.progress / Math.max(1, c.target))), 0);
  return { id: 'weekly', icon: '📅', key: 'goal.weekly', params: { n: done, total: list.length }, progress: part / list.length, next: 'goal.next.weekly' };
}

/**
 * Одна цель на экране: глава сюжета (её условие), после сюжета — следующее помещение, а когда расти
 * некуда — испытания недели. null — показывать нечего.
 */
export function mainGoal(s: StoreState): Goal | null {
  switch (CHAPTERS[s.story.chapter] ? s.story.chapter : -1) {
    case 0:
      return {
        id: 'debt',
        icon: '💳',
        key: 'goal.debt',
        params: { n: s.debt },
        progress: clamp01(1 - s.debt / Math.max(START_DEBT, s.debt)),
        next: 'goal.next.debt',
      };
    case 1: {
      const orders = Math.min(2, s.story.ordersDone);
      const staff = s.staff.length ? 1 : 0;
      return {
        id: 'orders',
        icon: '📦',
        key: 'goal.orders',
        params: { n: orders, staff: staff ? '✓' : '✗' },
        progress: (orders + staff) / 3,
        next: staff ? 'goal.next.orders' : 'goal.next.hire',
      };
    }
    case 2:
      // Сначала минимаркет, потом рейтинг 4★.
      if (s.level < 2) return levelGoal(s);
      return { id: 'rating', icon: '⭐', key: 'goal.rating', params: { r: s.rating.toFixed(1) }, progress: clamp01(s.rating / 4), next: 'goal.next.rating' };
    case 3: {
      const n = Math.min(2, s.story.inspectionsPassed);
      return { id: 'inspections', icon: '📋', key: 'goal.inspections', params: { n }, progress: n / 2, next: 'goal.next.inspections' };
    }
    default:
      return levelGoal(s) ?? weeklyGoal(s);
  }
}

// ---------- Подсказка «что дальше» ----------

/** До какого дня подсказывать: дальше игрок уже знает игру. */
export const NUDGE_LAST_DAY = 15;
/** Сколько секунд игрок бездействует, прежде чем подсказать. */
export const NUDGE_IDLE_MS = 12_000;
/** Не чаще раза в столько и не больше стольких за день. */
export const NUDGE_GAP_MS = 40_000;
export const NUDGE_PER_DAY = 3;

export type MorningNudge = 'restock' | 'grow' | 'open';
export type HallNudge = 'serve' | 'shelf';
export type NudgeKind = MorningNudge | HallNudge;

/** Что уже подсказано: за какой день, сколько раз и когда последний; каждую — раз в день. */
export interface NudgeMemo {
  day: number;
  shown: NudgeKind[];
  last: number;
}

export const freshMemo = (): NudgeMemo => ({ day: 0, shown: [], last: -Infinity });

/** Утро: что сейчас важнее всего. restock — «Закупить нужное» есть что купить (и хватает денег). */
export function morningNudge(s: StoreState, ctx: { restock: boolean }): MorningNudge | null {
  if (ctx.restock) return 'restock';
  const next = nextStoreLevel(s);
  if (next && s.debt === 0 && s.money >= next.cost) return 'grow';
  return 'open';
}

/** Зал: покупатель ждёт у кассы хозяина или опустела полка, а товар на складе есть. */
export function hallNudge(ctx: { waiting: boolean; emptyShelf: boolean }): HallNudge | null {
  if (ctx.waiting) return 'serve';
  if (ctx.emptyShelf) return 'shelf';
  return null;
}

/** Можно ли подсказать сейчас: ранние дни, игрок застыл, не та же подсказка дважды, не чаще и не больше лимита. */
export function canNudge(memo: NudgeMemo, day: number, kind: NudgeKind, now: number, idleMs: number): boolean {
  if (day > NUDGE_LAST_DAY || idleMs < NUDGE_IDLE_MS) return false;
  if (memo.day !== day) return true;
  return !memo.shown.includes(kind) && memo.shown.length < NUDGE_PER_DAY && now - memo.last >= NUDGE_GAP_MS;
}

export function noteNudge(memo: NudgeMemo, day: number, kind: NudgeKind, now: number): NudgeMemo {
  const shown = memo.day === day ? memo.shown : [];
  return { day, shown: [...shown, kind], last: now };
}

// ---------- «Завтра:» в итогах дня ----------

export interface Teaser {
  key: TextKey;
  params: Params;
}

/** Цель почти достигнута — с этой доли полоски зовём «завтра дожмёшь». */
export const TEASER_NEAR = 0.75;

/**
 * Одна строка на завтра — чтобы хотелось вернуться. s — уже утро следующего дня (после ночи):
 * глава готова к награде, цель почти взята, ярмарка, сезон, праздник, новая вкладка — иначе погода.
 */
export function tomorrowTeaser(s: StoreState): Teaser {
  const day = s.day;
  const chapter = CHAPTERS[s.story.chapter];
  if (chapter && s.story.introSeen && chapter.done(s)) return { key: 'teaser.chapter', params: { title: chapter.titleKey } };
  const goal = mainGoal(s);
  if (goal && goal.id !== 'weekly' && goal.progress >= TEASER_NEAR && goal.progress < 1) return { key: 'teaser.goal', params: { goal: goal.key, ...goal.params } };
  if (goal?.id === 'level' && goal.progress >= 1) return { key: 'teaser.levelReady', params: { name: goal.params.name } };
  const weekly = (s.weekly?.challenges ?? []).find((c) => !c.done && c.progress / Math.max(1, c.target) >= 0.8);
  if (weekly) return { key: 'teaser.weekly', params: {} };
  if (isFairDay(day)) return { key: 'teaser.fair', params: {} };
  const season = seasonFor(day);
  if (season && !seasonFor(day - 1)) return { key: 'teaser.season', params: { icon: season.icon, name: season.nameKey } };
  const holiday = holidayFor(day);
  if (holiday && holiday !== holidayFor(day - 1)) return { key: `teaser.holiday.${holiday}` as TextKey, params: {} };
  const tab = openTabs(s).opened[0];
  if (tab) return { key: 'teaser.tab', params: { tab: `tab.${tab}` } };
  const weather = weatherFor(day);
  return { key: weather === 'clear' ? 'teaser.clear' : 'teaser.weather', params: { icon: WEATHER_EFFECTS[weather].icon, name: `weather.name.${weather}` } };
}

/** Параметры, которые сами — ключи текста (название помещения, главы, погоды), переводятся при показе. */
export const TEXT_PARAMS = ['name', 'title', 'goal', 'tab'] as const;
