// «Поддержать автора»: три ступени за Telegram Stars. Только спасибо и красота — никаких денег,
// скорости или покупателей в игре: табличка «Спасибо!» у кассы, кот в цилиндре на прилавке и
// золотая табличка с именем в рейтинге магазинов (её ставит сервер по платежам бота —
// api/_lib/supporters.ts). Цены и названия — и на сервере (api/_lib/telegram.ts, STARS_CATALOG;
// совпадение проверяет тест). Купленное остаётся навсегда, даже после «Начать заново».

import type { TextKey } from '../i18n/ru';
import { grantDecor, type DecorId } from './decor';
import type { StoreState } from './economy';

export interface SupportTier {
  id: string;
  stars: number;
  nameKey: TextKey;
  icon: string;
  /** Что ставится в магазин (decor.ts, support: true). */
  items: DecorId[];
  /** Золотая табличка с именем в рейтинге. */
  gold?: true;
}

export const SUPPORT_TIERS: SupportTier[] = [
  { id: 'support_25', stars: 25, nameKey: 'support.tier.25', icon: '☕', items: ['thanks_plaque'] },
  { id: 'support_100', stars: 100, nameKey: 'support.tier.100', icon: '🎩', items: ['thanks_plaque', 'cat_hat'] },
  { id: 'support_250', stars: 250, nameKey: 'support.tier.250', icon: '🏅', items: ['thanks_plaque', 'cat_hat'], gold: true },
];

export const supportTier = (id: string): SupportTier | undefined => SUPPORT_TIERS.find((s) => s.id === id);

/** Вещи за поддержку по списку покупок (данные Telegram). */
export const supportDecor = (ids: string[]): DecorId[] => [...new Set(ids.flatMap((id) => supportTier(id)?.items ?? []))];

/** Самая щедрая ступень среди покупок (звёзды) или 0. */
export const supportLevel = (ids: string[]): number => Math.max(0, ...ids.map((id) => supportTier(id)?.stars ?? 0));

/** Спасибо получено: вещи в магазин (сразу ставятся) и ступень запоминается. Ничего не меняется — то же состояние. */
export function grantSupport(state: StoreState, ids: string[], activate = true): StoreState {
  const level = supportLevel(ids);
  if (!level) return state;
  let next = grantDecor(state, supportDecor(ids), activate);
  if ((next.supporter ?? 0) < level) next = { ...next, supporter: level };
  return next;
}
