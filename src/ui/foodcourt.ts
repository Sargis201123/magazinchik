// Плитка «Фудкорт» во вкладке «Уголки» (game/foodcourt.ts, 13.11): точки еды третьего этажа — обустроить, сдать или
// вести самим, — а сверху то, что ждёт решения сегодня: день рождения (заказ торта и напитков) или жалоба в
// санинспекцию. Открыть сам этаж и отделать его — в «Развитии», раздел «Этажи» (ui/floors.ts).

import { t, type TextKey } from '../i18n';
import { PRODUCTS, type ProductId, type StoreState } from '../game/economy';
import { kitchenWorking } from '../game/kitchen';
import {
  answerInspection,
  answerParty,
  closeStall,
  foodcourtGuests,
  foodcourtOf,
  foodPlan,
  inspectAnswer,
  inspectionToday,
  isFoodWeekend,
  openStall,
  ownAllowed,
  partyAnswer,
  partyToday,
  setStallMode,
  stallLock,
  stallMode,
  stallPlaces,
  stallRent,
  stallsOf,
  STALL_IDS,
  STALLS,
  type StallId,
} from '../game/foodcourt';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { row, warn } from './floors';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

export const stallName = (id: StallId): string => t(`fc.stall.${id}` as TextKey);

/** Статус плитки: сколько точек стоит из скольких мест. */
export const foodcourtStatus = (state: StoreState): string => `${stallsOf(state).length}/${stallPlaces(state)}`;

/** Плитка зовёт: сегодня ждёт ответа праздник или жалоба. */
export const foodcourtAlert = (state: StoreState): boolean =>
  (partyToday(state) !== null && partyAnswer(state) === null) || (inspectionToday(state) !== null && inspectAnswer(state) === null);

const itemsLine = (items: Partial<Record<ProductId, number>>): string =>
  Object.entries(items)
    .map(([id, n]) => `${PRODUCTS[id as ProductId].icon} ${t(PRODUCTS[id as ProductId].nameKey)} ×${n}`)
    .join(', ');

export function foodcourtBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const fc = foodcourtOf(state);
  if (!fc) return [];
  const out: HTMLElement[] = [];
  // Сначала — то, что ждёт решения сегодня.
  const party = partyToday(state);
  if (party) {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('fc.party.title')));
    const answer = partyAnswer(state);
    if (answer === null) {
      box.append(el('div', '', t('fc.party.text', { items: itemsLine(party.items), sum: party.pay })));
      if (!party.ready) box.append(warn(t('fc.party.short')));
      const chips = el('div', 'ui-chips');
      chips.append(
        button(
          t('fc.party.ok'),
          () => {
            const next = answerParty(getState(), true);
            if (next) track('fc_party', next.day, party.pay);
            update(next, 'success');
          },
          'ui-chip hood-buy',
          !party.ready,
        ),
        button(t('fc.party.no'), () => update(answerParty(getState(), false)), 'ui-chip'),
      );
      box.append(chips);
    } else box.append(el('div', 'ui-muted', t(answer ? 'fc.party.done' : 'fc.party.skipped')));
    out.push(box);
  }
  const ins = inspectionToday(state);
  if (ins) {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('fc.inspect.title')));
    const answer = inspectAnswer(state);
    if (answer === null) {
      box.append(el('div', '', t('fc.inspect.text', { name: stallName(ins.stall), sum: ins.fix })));
      if (stallMode(state, ins.stall) === 'rent') box.append(el('div', 'ui-muted', t('fc.inspect.half')));
      const chips = el('div', 'ui-chips');
      chips.append(
        button(t('fc.inspect.fix', { sum: ins.fix }), () => update(answerInspection(getState(), true), 'success'), 'ui-chip hood-buy', state.money < ins.fix),
        button(t('fc.inspect.close'), () => update(answerInspection(getState(), false)), 'ui-chip'),
      );
      box.append(chips);
    } else box.append(el('div', 'ui-muted', answer ? t('fc.inspect.fixed') : t('fc.inspect.closed', { name: stallName(ins.stall) })));
    out.push(box);
  }

  const box = el('div', 'ui-box');
  box.append(el('b', '', `🍕 ${t('floor.third')} · ${t('fc.places', { n: stallsOf(state).length, max: stallPlaces(state) })}`), el('div', 'ui-muted', t('fc.note')));
  const plan = foodPlan(state);
  if (plan) {
    box.append(el('div', 'ui-item-sub', t('fc.today', { n: plan.eaters, sum: plan.income })));
    box.append(el('div', 'ui-item-sub', t('fc.guests', { p: Math.round((foodcourtGuests(state) - 1) * 1000) / 10 })));
    if (isFoodWeekend(state)) box.append(el('div', 'ui-item-sub', t('fc.weekend')));
  }
  const last = fc.last;
  if (last && last.day === state.day - 1) box.append(el('div', 'ui-item-sub', t('fc.last', { n: last.eaters, sum: last.income })));
  if (!ownAllowed(state)) box.append(el('div', 'ui-item-sub', t('fc.ownLock')));
  else if (!kitchenWorking(state)) box.append(warn(t('fc.ownNoCook')));
  const here = stallsOf(state);
  for (const id of STALL_IDS) if (here.includes(id)) box.append(stallRow(state, id, plan?.stalls.find((p) => p.id === id)?.income ?? 0, getState, update));
  // Свободные места: кого ещё можно пустить.
  const full = here.length >= stallPlaces(state);
  if (full && here.length < STALL_IDS.length) box.append(el('div', 'ui-muted', t('fc.full')));
  if (!full) for (const id of STALL_IDS) if (!here.includes(id)) box.append(newRow(state, id, getState, update));
  out.push(box);
  return out;
}

/** Точка уже стоит: как работает, сколько даст вечером, переключить «сдать / своя», убрать. */
function stallRow(state: StoreState, id: StallId, income: number, getState: () => StoreState, update: Update): HTMLElement {
  const mode = stallMode(state, id)!;
  const notes = [mode === 'own' ? t('fc.own', { sum: income }) : t('fc.rent', { sum: income })];
  const actions: HTMLElement[] = [];
  if (mode === 'own') actions.push(button(t('fc.toRent'), () => update(setStallMode(getState(), id, 'rent')), 'ui-chip'));
  else if (ownAllowed(state)) actions.push(button(t('fc.toOwn'), () => update(setStallMode(getState(), id, 'own')), 'ui-chip'));
  // Убрать — со второго касания: обустройство не возвращают, случайный тап стоил бы тысяч.
  let sure = false;
  const close = button(
    t('fc.close'),
    () => {
      if (sure) return update(closeStall(getState(), id));
      sure = true;
      close.textContent = t('fc.closeSure');
    },
    'ui-chip',
  );
  actions.push(close);
  return row(`fc_${id}`, stallName(id), [...notes, chips(actions)], []);
}

/** Кнопки — строкой под описанием (как у сезонного торговца, ui/tenants.ts): справа они сжимали текст в столбик. */
function chips(actions: HTMLElement[]): HTMLElement {
  const line = el('div', 'ui-chips');
  line.style.marginTop = '6px';
  line.append(...actions);
  return line;
}

/** Свободное место: обустроить точку — и сразу сдать или вести самим (со своей кухней). */
function newRow(state: StoreState, id: StallId, getState: () => StoreState, update: Update): HTMLElement {
  const cost = STALLS[id].setup;
  const locked = stallLock(state, id) !== null;
  const open = (mode: 'rent' | 'own') => () => {
    const next = openStall(getState(), id, mode);
    if (!next) return;
    track('fc_stall', next.day, cost);
    toast('assets/ico_shop.png', stallName(id), t(mode === 'own' ? 'fc.opened.own' : 'fc.opened.rent'));
    update(next, 'success');
  };
  const actions = [button(t('fc.open.rent', { cost }), open('rent'), 'ui-chip', locked)];
  if (ownAllowed(state)) actions.push(button(t('fc.open.own', { cost }), open('own'), 'ui-chip', locked));
  return row(`fc_${id}`, stallName(id), [t('fc.setup', { rent: stallRent(state, id) }), chips(actions)], []);
}
