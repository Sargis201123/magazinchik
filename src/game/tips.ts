// Карточки «Новое!»: при первом появлении механики утро объясняет её в двух словах.
// Каждую показываем один раз (seenTips в сохранении).

import { expiringCount, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { isFairDay } from './fair';
import { registerCount } from './registers';

export type TipId = 'promo' | 'contract' | 'markdown' | 'weekly' | 'fair' | 'cart' | 'loyalty' | 'delivery' | 'register2' | 'oven' | 'coffee' | 'nightShift';

const WHEN: [TipId, (s: StoreState) => boolean][] = [
  ['weekly', (s) => Boolean(s.weekly)],
  ['markdown', (s) => s.day >= 3 && expiringCount(s) > 0],
  ['promo', (s) => s.day >= 5],
  ['contract', (s) => s.day >= 8],
  ['fair', (s) => isFairDay(s.day)],
  ['cart', (s) => hasUpgrade(s, 'cart')],
  ['loyalty', (s) => hasUpgrade(s, 'loyalty')],
  ['delivery', (s) => hasUpgrade(s, 'delivery')],
  ['register2', (s) => registerCount(s) >= 2],
  ['oven', (s) => hasUpgrade(s, 'oven')],
  ['coffee', (s) => hasUpgrade(s, 'coffee')],
  ['nightShift', (s) => hasUpgrade(s, 'nightShift')],
];

export const TIP_ICONS: Record<TipId, string> = {
  promo: '🏷',
  contract: '📃',
  markdown: '🏷',
  weekly: '🗓',
  fair: '🎪',
  cart: '🛒',
  loyalty: '💳',
  delivery: '🚲',
  register2: '🧾',
  oven: '🥖',
  coffee: '☕',
  nightShift: '🌙',
};

/** Первая ещё не показанная подсказка, которая сейчас к месту. */
export function pendingTip(state: StoreState): TipId | null {
  const seen = new Set(state.seenTips ?? []);
  return WHEN.find(([id, when]) => !seen.has(id) && when(state))?.[0] ?? null;
}

export const seeTip = (state: StoreState, id: TipId): StoreState => ({ ...state, seenTips: [...(state.seenTips ?? []), id] });
