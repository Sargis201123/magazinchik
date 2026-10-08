// Улучшения кассы: терминал для карт (оплата быстрее) и касса самообслуживания
// (покупатели с 1–2 товарами пробивают себя сами, пока у основной кассы очередь).

import type { TextKey } from '../i18n/ru';
import type { ScanTiming, StoreState } from './economy';

export type UpgradeId = 'terminal' | 'selfCheckout';

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
  selfCheckout: { id: 'selfCheckout', icon: '🖥', nameKey: 'upgrade.selfCheckout', descKey: 'upgrade.selfCheckout.desc', price: 2500, minLevel: 2 },
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

/** Время пробивки с учётом терминала. */
export const withUpgrades = (state: StoreState, timing: ScanTiming): ScanTiming =>
  hasUpgrade(state, 'terminal') ? { ...timing, pay: timing.pay * TERMINAL_PAY } : timing;
