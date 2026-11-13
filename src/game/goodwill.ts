// Доброе имя района (13.11, автор: «район помнит»): одно число от −100 до 100 — что район думает о магазине.
// Растёт от добрых дел (в беду держал цены, раздавал воду старикам), падает, если нажился на чужой беде.
// Помнит неделями: каждое утро — на шаг ближе к нулю. От него — гости, щедрость и терпение постоянных,
// отзывы. Это общий API: первым его двигает беда района (crisis.ts); дальше — жители, которые приезжают
// и уезжают, эхо решений. Модуль без зависимостей: его можно звать откуда угодно, не боясь круговых импортов.

import type { StoreState } from './economy';

export const GOODWILL_MAX = 100;
/** Каждое утро доброе имя на столько ближе к нулю (дурное — через утро): −30 после жадной беды забывают за два месяца. */
export const GOODWILL_FADE = 1;
/**
 * Гости: каждая единица — 0,15% (на +100 гостей на 15% больше, на −100 — на 15% меньше). После жадной беды
 * (≈ −30) первые недели гостей на ~4% меньше — заметнее, чем выручка от наценки за 3–4 дня (симулятор).
 */
export const GOODWILL_GUESTS = 0.0015;
/** Чаевые постоянных: на +100 — вдвое щедрее, на −100 — ни монеты. */
export const GOODWILL_TIPS = 0.01;
/** С такого доброго имени (по модулю) его замечают: пишут в отзывах, постоянные прощают или злятся сильнее. */
export const GOODWILL_KNOWN = 15;

export type GoodwillTier = 'bad' | 'cold' | 'plain' | 'warm' | 'good';

export const goodwillOf = (state: Pick<StoreState, 'goodwill'>): number => state.goodwill ?? 0;

const clamp = (n: number): number => Math.max(-GOODWILL_MAX, Math.min(GOODWILL_MAX, Math.round(n)));

/** Поменять доброе имя (delta может быть дробной — округляем). Ноль — поля нет: старое сохранение не меняется. */
export function addGoodwill(state: StoreState, delta: number): StoreState {
  const next = clamp(goodwillOf(state) + delta);
  if (next === goodwillOf(state)) return state;
  if (next === 0) {
    const { goodwill: _gone, ...rest } = state;
    return rest;
  }
  return { ...state, goodwill: next };
}

/**
 * Утро: район понемногу забывает — и хорошее, и плохое. Дурное помнят вдвое дольше (шаг через день):
 * так нажиться на беде — деньги сейчас, а косые взгляды — месяца на два (13.11, автор: «район помнит»).
 */
export function fadeGoodwill(state: StoreState): StoreState {
  const g = goodwillOf(state);
  if (!g || (g < 0 && state.day % 2)) return state;
  return addGoodwill(state, -Math.sign(g) * Math.min(GOODWILL_FADE, Math.abs(g)));
}

/** Как о магазине говорят: для строки утра. */
export function goodwillTier(state: Pick<StoreState, 'goodwill'>): GoodwillTier {
  const g = goodwillOf(state);
  if (g <= -40) return 'bad';
  if (g <= -GOODWILL_KNOWN) return 'cold';
  if (g < GOODWILL_KNOWN) return 'plain';
  return g < 40 ? 'warm' : 'good';
}

/** Множитель гостей от доброго имени. */
export const goodwillGuests = (state: Pick<StoreState, 'goodwill'>): number => 1 + goodwillOf(state) * GOODWILL_GUESTS;

/** Множитель чаевых постоянных. */
export const goodwillTips = (state: Pick<StoreState, 'goodwill'>): number => Math.max(0, 1 + goodwillOf(state) * GOODWILL_TIPS);

/**
 * На сколько падает доверие постоянного, не нашедшего своё: с добрым именем он прощает (−1 вместо −2),
 * с дурным — обижается сильнее (−3).
 */
export function goodwillGrudge(state: Pick<StoreState, 'goodwill'>): number {
  const g = goodwillOf(state);
  return g >= GOODWILL_KNOWN ? 1 : g <= -GOODWILL_KNOWN ? 3 : 2;
}

/**
 * Вспомнят ли сегодня в отзывах доброе (kind) или дурное (greedy) — чем громче имя, тем чаще.
 * Зависит только от дня и самого числа: перезапуск отзывов не меняет.
 */
export function goodwillReview(goodwill: number, day: number): 'kind' | 'greedy' | null {
  if (Math.abs(goodwill) < GOODWILL_KNOWN) return null;
  let h = (day * 2654435761 + 977) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  return (h % 1000) / 1000 < Math.min(0.8, Math.abs(goodwill) / 50) ? (goodwill > 0 ? 'kind' : 'greedy') : null;
}
