// Плитка «Фургон» во вкладке «Уголки» (game/van.ts, 13.11): купить фургон и посмотреть, как он ездит.
// 15.11, автор: «непонятно, когда он едет, сколько продаёт». Итог последнего выезда — маленькой таблицей,
// ниже — календарь ближайших выездов с тем, сколько обычно приносит каждый.
// 27.11, автор: «заходишь в уголки, собираешь фургон и отправляешь — не нужно так». Фургон ездит сам: выбирать
// событие и грузить кузов больше нечего, плитка — только посмотреть.

import { t } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import { buyVan, vanCalendar, vanCargo, vanEvents, vanFuel, vanOpen, vanTripOn, VAN_EVENTS, VAN_PRICE, type VanResult } from '../game/van';
import { track } from '../platform/analytics';
import { button, el, kvTable } from './dom';
import { sheetPng } from './sheet';
import { signed, vanEventName, vanRoadText } from './vanText';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Состояние на плитке: цена, «🏟 едет сегодня» или «—». */
export function vanStatus(state: StoreState): string {
  if (!state.van) return `${VAN_PRICE} 💰`;
  const event = vanTripOn(state);
  return event ? t('van.statusGo', { icon: VAN_EVENTS[event].icon }) : '—';
}

export function vanBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🚐 ${t('van.title')}`), el('div', 'ui-item-sub', t('van.how')), el('div', 'ui-muted', t('van.note')));
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
  // Сегодня: куда поехал сам и что повёз — или что выездов нет.
  const event = vanTripOn(state);
  if (event) {
    box.append(
      el('div', '', t('van.today', { icon: VAN_EVENTS[event].icon, name: vanEventName(state, event) })),
      el('div', 'ui-muted', t('van.terms', { list: vanCargo(state, event).map(({ id }) => PRODUCTS[id].icon).join(''), p: Math.round((VAN_EVENTS[event].markup - 1) * 100), fuel: vanFuel(state, event) })),
    );
  } else if (!vanEvents(state).length) box.append(el('div', 'ui-note', t('van.noneAtAll')));
  const last = state.van.last;
  // Итог последнего выезда — таблицей: вчерашний на виду всегда, давний — пока не было нового.
  if (last) box.append(resultTable(state, last));
  box.append(calendar(state));
  const van = state.van;
  if (van.trips) box.append(el('div', 'ui-muted', t('van.total', { n: van.trips, sum: van.earned ?? 0 })));
  return [box];
}

/** Итог выезда маленькой таблицей: продал, товар, случай в дороге, бензин, итого. */
function resultTable(state: StoreState, r: VanResult): HTMLElement {
  const where = { icon: VAN_EVENTS[r.event].icon, name: vanEventName(state, r.event) };
  const title = r.day === state.day - 1 ? t('van.res.yesterday', where) : t('van.res.day', { d: r.day, ...where });
  const rows: [string, string, boolean?][] = [[t('van.res.sold'), t('van.res.soldV', { n: r.sold, sum: r.revenue })]];
  // Выезды до 27.11 возили товар магазина — строки «Товар» у них нет.
  if (r.goods) rows.push([t('van.res.goods'), `−${r.goods} 💰`]);
  const road = vanRoadText(r);
  if (road) rows.push([t('van.res.road'), road]);
  rows.push([t('van.res.fuel'), `−${r.fuel} 💰`], [t('van.res.net'), `${signed(r.net)} 💰`, true]);
  return kvTable(title, rows);
}

/** Календарь: ближайшие выезды — когда, куда и сколько обычно приносит. */
function calendar(state: StoreState): HTMLElement {
  const plan = vanCalendar(state);
  if (!plan.length) return el('div', 'ui-muted', t('van.cal.none'));
  const when = (day: number) => (day === state.day ? t('van.cal.today') : day === state.day + 1 ? t('van.cal.tomorrow') : t('van.cal.day', { d: day }));
  return kvTable(
    t('van.cal'),
    plan.map((p) => [`${when(p.day)} · ${VAN_EVENTS[p.event].icon} ${vanEventName(state, p.event)}`, t('van.cal.gain', { n: p.gain })]),
  );
}

/** Строка утренней сводки «Сегодня»: фургон сегодня сам едет. Касаний не просит. */
export function vanLines(state: StoreState): HTMLElement[] {
  if (!state.van || !vanOpen(state)) return [];
  const event = vanTripOn(state);
  return event ? [el('div', '', t('van.today', { icon: VAN_EVENTS[event].icon, name: vanEventName(state, event) }))] : [];
}
