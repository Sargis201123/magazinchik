// Прокат у входа во вкладке «Уголки» (game/rental.ts, 13.11): купить стойку, докупить пропавшие вещи, выбрать залог.
// Прогноз дня — тот же расчёт, что вечером (без потерь он точный): сменил залог — сразу видно, сколько возьмут.
// Мир — scenes/rentalFx.ts (стойку ставит заново, когда меняется rental в сохранении).

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { guestsToday } from '../game/day';
import {
  buyStand,
  DEPOSIT_IDS,
  DEPOSITS,
  ITEM_COST,
  KIT_ICON,
  KIT_ITEMS,
  RENTAL_CAP,
  rentalDay,
  kitToday,
  rentalOf,
  restockRental,
  setDeposit,
  STAND_COST,
} from '../game/rental';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { setItemIcon } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Строка с картинкой: как artRow утра (morning.ts), но своя — чтобы не тянуть утро в этот модуль. */
function row(texture: string, name: string, actions: HTMLElement[], price?: number): HTMLElement {
  const item = el('div', 'ui-item');
  const img = el('img', 'ui-item-art');
  setItemIcon(img, texture);
  img.alt = '';
  const body = el('div');
  const title = el('div', 'ui-item-name', name);
  if (price !== undefined) title.append(el('span', 'ui-tag', `${price} 💰`));
  body.append(title);
  const right = el('div', 'ui-item-actions');
  right.append(...actions);
  item.append(img, body, right);
  return item;
}

/** Что на плитке «Уголков»: вещей на стойке или цена стойки. */
export const rentalStatus = (state: StoreState): string => {
  const r = rentalOf(state);
  return r ? `${KIT_ICON[kitToday(state)]} ${r.stock}/${RENTAL_CAP}` : `${STAND_COST} 💰`;
};
/** Плитка горит, когда половины вещей уже нет. */
export const rentalAlert = (state: StoreState): boolean => (rentalOf(state)?.stock ?? RENTAL_CAP) <= RENTAL_CAP / 2;

/** Докупить всё пропавшее (сколько хватит денег): для карточки и «Главного на сегодня». */
export function restockButton(state: StoreState, getState: () => StoreState, update: Update): HTMLElement | null {
  const r = rentalOf(state);
  const missing = r ? RENTAL_CAP - r.stock : 0;
  if (!missing) return null;
  return button(t('rack.refill', { n: missing, cost: missing * ITEM_COST }), () => update(restockRental(getState(), missing), 'success'), 'ui-chip', state.money < ITEM_COST);
}

export function rentalBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement {
  const box = el('div', 'ui-box');
  const kit = kitToday(state);
  box.append(el('b', '', `${KIT_ICON[kit]} ${t('rental.title')}`), el('div', 'ui-muted', t('rental.note')));
  const r = rentalOf(state);
  if (!r) {
    box.append(
      row('rent_stand', t('rental.stand', { n: RENTAL_CAP }), [
        button(
          t('upgrade.buy'),
          () => {
            const next = buyStand(getState());
            if (!next) return;
            track('rental_buy', next.day, STAND_COST);
            toast('assets/ico_shop.png', t('rental.title'), t('rental.bought'));
            update(next, 'success');
          },
          'ui-chip',
          state.money < STAND_COST,
        ),
      ], STAND_COST),
    );
    return box;
  }
  // Прогноз дня: что на стойке, сколько возьмут и сколько принесёт (без пропаж — их не угадать).
  const plan = rentalDay(state, guestsToday(state));
  if (plan) box.append(el('div', 'ui-note', t('rental.today', { icon: KIT_ICON[kit], what: t(`rental.kit.${kit}` as TextKey), n: plan.rented, sum: plan.income })));
  const restock = restockButton(state, getState, update);
  box.append(row(`rent_${KIT_ITEMS[kit][0]}`, t('rental.stock', { n: r.stock, max: RENTAL_CAP }), restock ? [restock] : [el('span', 'ui-tag', t('rack.full'))]));
  if (r.stock < RENTAL_CAP) box.append(el('div', 'ui-item-sub', t('rental.itemCost', { cost: ITEM_COST })));
  // Залог: три кнопки и что он значит.
  const chips = el('div', 'ui-chips');
  for (const id of DEPOSIT_IDS) {
    chips.append(button(`${t(`rental.dep.${id}` as TextKey)} · ${DEPOSITS[id].sum} 💰`, () => update(setDeposit(getState(), id)), `ui-chip${r.deposit === id ? ' active' : ''}`));
  }
  box.append(el('h3', '', t('rental.deposit')), chips, el('div', 'ui-muted', t(`rental.dep.${r.deposit}.note` as TextKey)));
  const last = r.last;
  if (last && last.day === state.day - 1) {
    const lost = last.lost ? ` · ${t('rental.summaryLost', { n: last.lost, kept: last.kept })}` : '';
    box.append(el('div', 'ui-item-sub', `${t('rental.yesterday', { icon: KIT_ICON[last.kit], n: last.rented, sum: last.income })}${lost}`));
  }
  return box;
}
