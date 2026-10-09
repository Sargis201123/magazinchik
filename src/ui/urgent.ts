// Окно срочного подвоза днём: по строке на товар — сколько на полках и складе, цена за 6 и 12 штук.

import { t } from '../i18n';
import { onShelves, PRODUCTS, sellableProducts, warehouseOf, type ProductId, type StoreState } from '../game/economy';
import { URGENT_FEE, URGENT_QTYS, urgentCost, urgentRoom } from '../game/urgent';
import { button, el, openModal } from './dom';

export interface UrgentOptions {
  getState: () => StoreState;
  /** Сколько штук уже едет (место на складе под них занято). */
  onTheWay: () => number;
  /** Что уже едет — для строки «Едет: …». */
  onTheWayList: () => string;
  order: (id: ProductId, qty: number) => void;
}

export function showUrgent({ getState, onTheWay, onTheWayList, order }: UrgentOptions): void {
  const { card, close } = openModal();
  const render = () => {
    const state = getState();
    const room = urgentRoom(state, onTheWay());
    const rows = sellableProducts(state)
      // Сначала то, что кончается.
      .sort((a, b) => onShelves(state, a) + warehouseOf(state, a) - (onShelves(state, b) + warehouseOf(state, b)))
      .map((id) => {
        const row = el('div', 'ui-item');
        const img = el('img', 'ui-item-art');
        img.src = `assets/item_${id}.png`;
        img.alt = '';
        const body = el('div');
        body.append(
          el('div', 'ui-item-name', t(PRODUCTS[id].nameKey)),
          el('div', 'ui-item-sub', t('urgent.stock', { s: onShelves(state, id), w: warehouseOf(state, id) })),
        );
        const actions = el('div', 'ui-item-actions');
        for (const qty of URGENT_QTYS) {
          const cost = urgentCost(state, id, qty);
          if (cost === null) continue;
          actions.append(
            button(
              t('urgent.buy', { n: qty, cost }),
              () => {
                order(id, qty);
                close();
              },
              'ui-chip',
              cost > state.money || qty > room,
            ),
          );
        }
        row.append(img, body, actions);
        return row;
      });
    const onWay = onTheWayList();
    card.replaceChildren(
      el('h2', '', t('urgent.title')),
      el('div', 'ui-muted', t('urgent.note', { fee: URGENT_FEE })),
      ...(onWay ? [el('div', 'ui-note', t('urgent.onWay', { list: onWay }))] : []),
      ...(room <= 0 ? [el('div', 'ui-note', t('urgent.noRoom'))] : []),
      ...rows,
      button(t('urgent.close'), close, 'ui-btn secondary'),
    );
  };
  render();
}
