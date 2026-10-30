// Подсказка «что дальше» и тексты цели: общий счётчик подсказок на день (утро и зал вместе) и перевод
// параметров-ключей (название помещения, главы, вкладки) из game/nudge.ts.

import { t, type TextKey } from '../i18n';
import { canNudge, freshMemo, noteNudge, TEXT_PARAMS, type Goal, type NudgeKind, type Teaser } from '../game/nudge';

let memo = freshMemo();

/** Подсказать сейчас? Да — и запомнить: эта подсказка сегодня больше не повторится, общий лимит дня меньше. */
export function tryNudge(day: number, kind: NudgeKind, idleMs: number, now = Date.now()): boolean {
  if (!canNudge(memo, day, kind, now, idleMs)) return false;
  memo = noteNudge(memo, day, kind, now);
  return true;
}

/** Текст с параметрами, часть которых — сами ключи текста (переводятся с теми же параметрами). */
export function textOf(key: TextKey, params: Record<string, number | string>): string {
  const out: Record<string, number | string> = { ...params };
  for (const name of TEXT_PARAMS) {
    const v = params[name];
    if (typeof v === 'string') out[name] = t(v as TextKey, params);
  }
  return t(key, out);
}

export const goalText = (goal: Goal): string => textOf(goal.key, goal.params);
export const teaserText = (teaser: Teaser): string => textOf(teaser.key, teaser.params);
