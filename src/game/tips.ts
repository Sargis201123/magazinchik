// Карточки «Новое!»: при первом появлении механики утро объясняет её в двух словах.
// Каждую показываем один раз (seenTips в сохранении).

import { expiringCount, onShelves, PRODUCT_IDS, STORE_LEVELS, warehouseOf, type StoreState } from './economy';
import { hasUpgrade } from './upgrades';
import { isFairDay } from './fair';
import { registerCount } from './registers';

export type TipId = 'broke' | 'ownerTill' | 'alone' | 'promo' | 'contract' | 'markdown' | 'weekly' | 'fair' | 'cart' | 'loyalty' | 'delivery' | 'register2' | 'oven' | 'coffee' | 'nightShift';

/** Касса пуста и товара нет: без закупки не будет и выручки — подсказать про кредит. */
export const isBroke = (s: StoreState): boolean =>
  s.money < 100 && !s.loan && PRODUCT_IDS.every((id) => warehouseOf(s, id) + onShelves(s, id) === 0);

/**
 * Есть ли кто-то в зале, кроме хозяина: кассир, грузчик, уборщица или менеджер. Пекарь, бариста и повар
 * работают в пристройках, сторож ловит воров — касса, полки и склад от них остаются на хозяине.
 */
export const hasFloorStaff = (s: StoreState): boolean =>
  s.staff.some((m) => m.role.startsWith('cashier') || m.role === 'loader' || m.role === 'cleaner' || m.role === 'manager');

/**
 * Расширяться дальше третьего помещения без персонала — ловушка: касса, полки и склад на одном хозяине,
 * гости уходят, а аренда растёт. В симуляторе (12 прогонов × 150 дней) одиночка на универмаге к 150-му
 * дню копит ~13 тыс. при прибыли ~110 в день, а оставшись в третьем помещении — ~97 тыс. и ~650 в день.
 * Друзья, пришедшие на подмогу на день (help.ts), — не персонал: их в state.staff нет.
 */
export const soloExpandRisk = (s: StoreState): boolean => !hasFloorStaff(s) && s.level >= 2 && s.level + 1 < STORE_LEVELS.length;

const WHEN: [TipId, (s: StoreState) => boolean][] = [
  ['broke', isBroke],
  // Касса — хозяина, пробивать можно и касанием улицы: со второго утра (в новом начале об этом
  // уже сказала бабушка в первый день — там карточка отмечена прочитанной). Старым игрокам — в
  // первое же утро после обновления: так они узнают, куда встал их кассир.
  ['ownerTill', (s) => s.day >= 2],
  // Без персонала магазин выше второго помещения не тянет (в симуляторе: рейтинг 2,8, прибыль ~0).
  // Раньше 20-го дня карточку показывает вкладка «Развитие» — у кнопки расширения (soloExpandRisk).
  ['alone', (s) => s.level >= 2 && s.day >= 20 && !hasFloorStaff(s)],
  ['weekly', (s) => Boolean(s.weekly)],
  ['markdown', (s) => s.day >= 3 && expiringCount(s) > 0],
  ['promo', (s) => s.day >= 5],
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
  broke: '🏦',
  ownerTill: '👆',
  alone: '🧑‍🤝‍🧑',
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
