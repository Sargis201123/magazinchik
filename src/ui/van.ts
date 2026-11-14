// Плитка «Фургон» во вкладке «Уголки» (game/van.ts, 13.11): купить фургон, выбрать, куда едем сегодня,
// и что грузить. Грузят из магазина — сначала склад, потом полки; кнопка «Загрузить под событие»
// берёт каждого товара столько, сколько там обычно разбирают. Итог вчерашнего выезда — строкой сверху.

import { t, type TextKey } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import {
  autoLoad,
  buyVan,
  inStore,
  loadedOf,
  loadVan,
  nextVanEvent,
  planTrip,
  skipTrip,
  tripToday,
  unloadVan,
  vanEvents,
  vanFuel,
  vanGoods,
  vanIdle,
  vanLoaded,
  vanNews,
  vanOpen,
  vanTakeable,
  vanWant,
  vanWanted,
  seeVanNews,
  VAN_CAP,
  VAN_EVENTS,
  VAN_PRICE,
  type VanEventId,
} from '../game/van';
import { track } from '../platform/analytics';
import { button, el } from './dom';
import { setItemIcon, sheetPng } from './sheet';
import { vanEventName, vanResultText } from './vanText';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Состояние на плитке: «—», «🏟 ждёт груза» или «🏟 18/24». */
export function vanStatus(state: StoreState): string {
  if (!state.van) return `${VAN_PRICE} 💰`;
  const trip = tripToday(state);
  const [event] = vanEvents(state);
  if (trip && vanLoaded(state)) return t('van.statusLoaded', { icon: VAN_EVENTS[trip.event].icon, n: vanLoaded(state), max: VAN_CAP });
  // Сказал «Не едем» — на плитке так и написано, не «ждёт груза».
  if (state.van.skip === state.day) return t('van.stay');
  return event ? t('van.statusWait', { icon: VAN_EVENTS[event].icon }) : '—';
}

// Плитка просит внимания по vanIdle (game/van.ts): после «Не едем» и при пустом магазине — молчит.
export { vanIdle };

/** Первое событие сегодня (для строки «Главное на сегодня»). */
export const vanToday = (state: StoreState): VanEventId | null => (vanOpen(state) && state.van ? (vanEvents(state)[0] ?? null) : null);

export function vanBox(state: StoreState, getState: () => StoreState, update: Update, toBuy: () => void): HTMLElement[] {
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🚐 ${t('van.title')}`), el('div', 'ui-muted', t('van.note')));
  const art = el('img', 'ui-item-art');
  art.src = sheetPng('shop_van');
  art.alt = '';
  art.style.cssText = 'width:72px;height:36px;display:block;margin:4px auto';
  box.append(art);
  if (!state.van) {
    box.append(
      button(
        `${t('van.buy')} · ${VAN_PRICE} 💰`,
        () => {
          const next = buyVan(getState());
          if (next) track('van_buy', next.day);
          update(next, next ? 'success' : 'error');
        },
        'ui-btn',
        state.money < VAN_PRICE,
      ),
    );
    return [box];
  }
  const last = state.van.last;
  if (last && last.day === state.day - 1) box.append(el('div', 'ui-note', t('van.yesterday', { text: vanResultText(last) })));
  const events = vanEvents(state);
  if (!events.length) {
    const next = nextVanEvent(state);
    box.append(el('div', 'ui-note', next ? t('van.none', { icon: VAN_EVENTS[next.id].icon, name: vanEventName(state, next.id), n: next.days }) : t('van.noneAtAll')));
    return done(box, state);
  }
  // Куда едем: события дня кнопками, «Не едем» — кузов на склад.
  const trip = tripToday(state);
  const chips = el('div', 'ui-chips');
  for (const id of events)
    chips.append(button(`${VAN_EVENTS[id].icon} ${vanEventName(state, id)}`, () => update(planTrip(getState(), id)), `ui-chip${trip?.event === id ? ' active' : ''}`));
  chips.append(button(t('van.stay'), () => update(skipTrip(getState())), `ui-chip${trip ? '' : ' active'}`));
  box.append(el('h3', '', t('van.where')), chips);
  if (!trip) return done(box, state);
  const event = VAN_EVENTS[trip.event];
  box.append(
    el('div', 'ui-muted', t('van.terms', { list: vanWanted(state, trip.event).map((id) => PRODUCTS[id].icon).join(''), p: Math.round((event.markup - 1) * 100), fuel: vanFuel(state, trip.event) })),
    el('div', 'ui-item-name', t('van.cargo', { n: vanLoaded(state), max: VAN_CAP })),
  );
  const goods = vanGoods(state, trip.event);
  if (!goods.length) {
    box.append(el('div', 'ui-note', t('van.nothing')), button(t('van.toBuy'), toBuy, 'ui-chip'));
    return done(box, state);
  }
  const full = vanLoaded(state) >= VAN_CAP;
  // Товар есть только на полках, а склад полон: кузов держит места на складе — с полок не берём (economy.ts warehouseCount).
  let blocked = false;
  for (const id of goods) {
    const takeable = vanTakeable(state, id);
    if (!takeable && inStore(state, id)) blocked = true;
    const row = el('div', 'ui-item');
    const icon = el('img', 'ui-item-icon');
    setItemIcon(icon, `item_${id}_0`);
    icon.alt = '';
    const body = el('div');
    body.append(
      el('div', 'ui-item-name', `${PRODUCTS[id].icon} ${t(PRODUCTS[id].nameKey)}`),
      el('div', 'ui-item-sub', t('van.row', { n: loadedOf(state, id), have: inStore(state, id), want: vanWant(state, trip.event, id) })),
    );
    const actions = el('div', 'ui-item-actions');
    actions.append(
      button('−', () => update(unloadVan(getState(), id, 1)), 'ui-chip secondary', !loadedOf(state, id)),
      button('+5', () => update(loadVan(getState(), id, 5)), 'ui-chip', full || !takeable),
    );
    row.append(icon, body, actions);
    box.append(row);
  }
  const row = el('div', 'ui-chips');
  row.append(
    button(t('van.auto'), () => update(autoLoad(getState()), 'success'), 'ui-chip', full),
    button(t('van.unload'), () => update(unloadVan(getState())), 'ui-chip secondary', !vanLoaded(state)),
  );
  box.append(row);
  if (blocked && !full) box.append(el('div', 'ui-note', t('van.roomFull')));
  box.append(el('div', 'ui-muted', t('van.cold')));
  return done(box, state);
}

/** Внизу карточки — сколько выездов и сколько заработано за всё время. */
function done(box: HTMLElement, state: StoreState): HTMLElement[] {
  const van = state.van;
  if (van?.trips) box.append(el('div', 'ui-muted', t('van.total', { n: van.trips, sum: van.earned ?? 0 })));
  return [box];
}

/** Новость утра (headlines.ts, 'van'): что вчера случилось в дороге — и итог выезда строкой. */
export function vanNewsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const last = vanNews(state);
  if (!last?.incident) return [];
  const box = el('div', 'ui-box ui-tale');
  box.append(
    el('b', '', t('van.news.title')),
    el('p', '', t(`van.story.${last.incident}` as TextKey, { n: Math.abs(last.extra) })),
    el('div', 'ui-muted', vanResultText(last, false)),
    button(t('van.news.ok'), () => update(seeVanNews(getState())), 'ui-btn'),
  );
  return [box];
}
