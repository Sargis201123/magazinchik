// Улучшения магазина: терминал для карт (оплата быстрее), касса самообслуживания
// (покупатели с 1–2 товарами пробивают себя сами, пока у основной кассы очередь),
// кофейный уголок, своя печь и ночная смена.

import type { TextKey } from '../i18n/ru';
import { CARRY, type ScanTiming, type StoreState } from './economy';
import { registerScan } from './gear';

export type UpgradeId = 'terminal' | 'selfCheckout' | 'cart' | 'loyalty' | 'delivery' | 'coffee' | 'oven' | 'nightShift';

export interface Upgrade {
  id: UpgradeId;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
  price: number;
  /** С какого уровня помещения можно поставить. */
  minLevel: number;
}

export const UPGRADES: Record<UpgradeId, Upgrade> = {
  terminal: { id: 'terminal', icon: '💳', nameKey: 'upgrade.terminal', descKey: 'upgrade.terminal.desc', price: 600, minLevel: 1 },
  cart: { id: 'cart', icon: '🛒', nameKey: 'upgrade.cart', descKey: 'upgrade.cart.desc', price: 700, minLevel: 1 },
  loyalty: { id: 'loyalty', icon: '💳', nameKey: 'upgrade.loyalty', descKey: 'upgrade.loyalty.desc', price: 900, minLevel: 1 },
  delivery: { id: 'delivery', icon: '🚲', nameKey: 'upgrade.delivery', descKey: 'upgrade.delivery.desc', price: 1500, minLevel: 1 },
  selfCheckout: { id: 'selfCheckout', icon: '🖥', nameKey: 'upgrade.selfCheckout', descKey: 'upgrade.selfCheckout.desc', price: 2500, minLevel: 2 },
  coffee: { id: 'coffee', icon: '☕', nameKey: 'upgrade.coffee', descKey: 'upgrade.coffee.desc', price: 1500, minLevel: 2 },
  oven: { id: 'oven', icon: '🥖', nameKey: 'upgrade.oven', descKey: 'upgrade.oven.desc', price: 1800, minLevel: 1 },
  nightShift: { id: 'nightShift', icon: '🌙', nameKey: 'upgrade.nightShift', descKey: 'upgrade.nightShift.desc', price: 3500, minLevel: 3 },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

/** С терминалом оплата занимает столько от прежнего времени. */
export const TERMINAL_PAY = 0.4;
/** Касса самообслуживания: сколько товаров максимум и сколько секунд на товар и оплату. */
export const KIOSK_MAX_ITEMS = 2;
export const KIOSK_ITEM_SECONDS = 1.6;
export const KIOSK_PAY_SECONDS = 1.2;

export const hasUpgrade = (state: StoreState, id: UpgradeId): boolean => (state.upgrades ?? []).includes(id);

export function buyUpgrade(state: StoreState, id: UpgradeId): StoreState | null {
  const up = UPGRADES[id];
  if (hasUpgrade(state, id) || state.level < up.minLevel || state.money < up.price) return null;
  return { ...state, money: state.money - up.price, upgrades: [...(state.upgrades ?? []), id] };
}

/** Время пробивки с учётом модели кассы и терминала. */
export const withUpgrades = (state: StoreState, timing: ScanTiming): ScanTiming => ({
  item: timing.item * registerScan(state),
  pay: hasUpgrade(state, 'terminal') ? timing.pay * TERMINAL_PAY : timing.pay,
});

/** Тележка: за один поход со склада несут вдвое больше. */
export const CART_CARRY = 12;
export const carryOf = (state: StoreState): number => (hasUpgrade(state, 'cart') ? CART_CARRY : CARRY);

/**
 * Карта лояльности: «свои» покупатели меньше придираются к ценам — берут то, что раньше
 * сочли бы дорогим. Не «больше гостей» и не «больше в корзину»: касса и полки и так узкое
 * место, лишние гости уходили злыми, а лишний товар портился (видно в симуляторе).
 */
export const LOYALTY_TOLERANCE = 1.1;
export const loyaltyTolerance = (state: StoreState): number => (hasUpgrade(state, 'loyalty') ? LOYALTY_TOLERANCE : 1);
