// Прокат у входа во вкладке «Уголки» (game/rental.ts, 13.11): купить стойку, что на ней сегодня и почём, сколько
// возьмут, вчера и всего. 27.11: без залога и докупки - стойка растёт с магазином сама, цена за день видна в строке.
// Прогноз дня - тот же расчёт, что вечером. Мир - scenes/rentalFx.ts (стойку ставит заново, когда меняется её вид).

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { guestsToday } from '../game/day';
import { buyStand, KIT_ICON, KIT_ITEMS, KIT_PRICE, kitToday, rentalCap, rentalDay, rentalLog, rentalOf, STAND_COST } from '../game/rental';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { setItemIcon } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Строка с картинкой: как artRow утра (morning.ts), но своя — чтобы не тянуть утро в этот модуль. */
function row(texture: string, name: string, actions: HTMLElement[], tag?: string, sub?: string): HTMLElement {
  const item = el('div', 'ui-item');
  const img = el('img', 'ui-item-art');
  setItemIcon(img, texture);
  img.alt = '';
  const body = el('div');
  const title = el('div', 'ui-item-name', name);
  if (tag !== undefined) title.append(el('span', 'ui-tag', tag));
  body.append(title);
  if (sub) body.append(el('div', 'ui-item-sub', sub));
  const right = el('div', 'ui-item-actions');
  right.append(...actions);
  item.append(img, body, right);
  return item;
}

/** Что на плитке «Уголков»: сколько стойка принесёт сегодня или цена стойки. */
export const rentalStatus = (state: StoreState): string => {
  if (!rentalOf(state)) return `${STAND_COST} 💰`;
  const plan = rentalDay(state, guestsToday(state));
  return plan ? t('rental.tile', { sum: plan.income }) : '—';
};

export function rentalBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement {
  const box = el('div', 'ui-box');
  const kit = kitToday(state);
  box.append(el('b', '', `${KIT_ICON[kit]} ${t('rental.title')}`), el('div', 'ui-muted', t('rental.note')));
  const r = rentalOf(state);
  if (!r)
    box.append(
      row('rent_stand', t('rental.stand', { n: rentalCap(state) }), [
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
      ], `${STAND_COST} 💰`),
    );
  // Что сегодня на стойке и почём за день; сколько вещей - растёт с магазином.
  const what = t(`rental.kit.${kit}` as TextKey);
  box.append(row(`rent_${KIT_ITEMS[kit][0]}`, what.charAt(0).toUpperCase() + what.slice(1), [], t('rental.perDay', { n: KIT_PRICE[kit] }), r ? t('rental.stock', { n: rentalCap(state) }) : undefined));
  if (!r) return box;
  // Прогноз дня: сколько возьмут и сколько принесёт (вечером придёт ровно столько).
  const plan = rentalDay(state, guestsToday(state));
  if (plan) box.append(el('div', 'ui-note', t('rental.today', { icon: KIT_ICON[kit], n: plan.rented, max: rentalCap(state), sum: plan.income })));
  const log = rentalLog(state);
  if (log) box.append(el('div', 'ui-muted', t('rental.yesterday', log)));
  return box;
}
