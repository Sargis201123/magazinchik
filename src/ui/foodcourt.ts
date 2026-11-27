// Плитка «Фудкорт» во вкладке «Уголки» (game/foodcourt.ts, 13.11): точки еды третьего этажа — открыть или убрать, —
// а сверху то, что ждёт решения сегодня: день рождения (заказ торта и напитков). Открыть сам этаж и отделать его —
// в «Развитии», раздел «Этажи» (ui/floors.ts).
//
// 27.11, автор: «сдать или вести самим? и сотрудника туда нанимать?» Выбора больше нет: у свободного места одна кнопка
// «Открыть» и сколько точка даст каждый вечер — до оплаты. Точки ведёт кто выгоднее (game/foodcourt.ts foodRun), и
// одна строка в шапке говорит, кто ведёт сейчас и как заработать больше — с цифрами и где это купить или нанять.
// Жалоба в санинспекцию решается сама: точка закрыта на вечер — строкой у точки и в итогах дня, без вопроса и без
// красной точки на «Уголках».

import { t, type TextKey } from '../i18n';
import { PRODUCTS, STAFF_ROLES, type ProductId, type StoreState } from '../game/economy';
import { UPGRADES } from '../game/upgrades';
import {
  answerParty,
  closeStall,
  foodcourtGuests,
  floorEstimate,
  foodcourtOf,
  foodPlan,
  foodRun,
  isFoodWeekend,
  openStall,
  partyAnswer,
  partyToday,
  stallEstimate,
  stallLock,
  stallPlaces,
  stallsOf,
  STALL_IDS,
  STALLS,
  type FoodRun,
  type StallId,
  type StallPlan,
} from '../game/foodcourt';
import { inZar } from '../game/zarshop';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { row, warn } from './floors';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

export const stallName = (id: StallId): string => t(`fc.stall.${id}` as TextKey);

/** Статус плитки: сколько точек стоит из скольких мест. */
export const foodcourtStatus = (state: StoreState): string => `${stallsOf(state).length}/${stallPlaces(state)}`;

/** Плитка зовёт: сегодня ждёт ответа праздник (жалоба решается сама — о ней не зовём). */
export const foodcourtAlert = (state: StoreState): boolean => partyToday(state) !== null && partyAnswer(state) === null;

const itemsLine = (items: Partial<Record<ProductId, number>>): string =>
  Object.entries(items)
    .map(([id, n]) => `${PRODUCTS[id as ProductId].icon} ${t(PRODUCTS[id as ProductId].nameKey)} ×${n}`)
    .join(', ');

/** Кто ведёт точки и как заработать больше — с цифрами сегодняшнего вечера и где купить Кухню или нанять повара. */
function runLine(state: StoreState): string | null {
  const run = foodRun(state);
  // Пустой этаж без Кухни: сразу видно, сколько дадут все места сданными, с Кухней и с поваром (в среднем за вечер).
  if (!foodPlan(state)) {
    if (run !== 'rent' || inZar(state)) return null;
    const all = (r: FoodRun) => floorEstimate(state, r);
    return t('fc.run.empty', { rent: all('rent'), cost: UPGRADES.kitchen.price, own: all('kitchen'), cook: all('cook') });
  }
  const sum = (r: 'kitchen' | 'cook') => foodPlan(state, r)?.income ?? 0;
  if (run === 'rent') return t('fc.run.rent', { cost: UPGRADES.kitchen.price, own: sum('kitchen'), cook: sum('cook') });
  if (run === 'kitchen') return t('fc.run.kitchen', { wage: STAFF_ROLES.cook.wage, cook: sum('cook') });
  return t('fc.run.cook');
}

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

  const box = el('div', 'ui-box');
  box.append(el('b', '', `🍕 ${t('floor.third')} · ${t('fc.places', { n: stallsOf(state).length, max: stallPlaces(state) })}`));
  const plan = foodPlan(state);
  if (plan) box.append(el('div', 'ui-item-sub', t('fc.today', { n: plan.eaters, sum: plan.income })));
  const run = runLine(state);
  if (run) box.append(el('div', 'ui-item-sub', run));
  // Ответ на «сотрудника туда нанимать?» — прямо и на виду (не под «❔»).
  box.append(el('div', 'ui-item-sub', t('fc.note')));
  if (plan) {
    box.append(el('div', 'ui-item-sub', t('fc.guests', { p: Math.round((foodcourtGuests(state) - 1) * 1000) / 10 })));
    if (isFoodWeekend(state)) box.append(el('div', 'ui-item-sub', t('fc.weekend')));
  }
  const last = fc.last;
  if (last && last.day === state.day - 1) box.append(el('div', 'ui-item-sub', t('fc.last', { n: last.eaters, sum: last.income })));
  const here = stallsOf(state);
  const full = here.length >= stallPlaces(state);
  // «Убрать» — только когда есть кого пустить вместо: места заняты, а какой-то точки нет (до ремонта). Иначе убирать
  // незачем — вечер только станет беднее, а лишняя кнопка у каждой точки — шум.
  const swap = full && here.length < STALL_IDS.length;
  for (const id of STALL_IDS) {
    const p = plan?.stalls.find((s) => s.id === id);
    if (here.includes(id) && p) box.append(stallRow(id, p, swap, getState, update));
  }
  // Свободные места: кого ещё можно пустить.
  if (swap) box.append(el('div', 'ui-muted', t('fc.full')));
  if (!full) for (const id of STALL_IDS) if (!here.includes(id)) box.append(newRow(state, id, getState, update));
  out.push(box);
  return out;
}

/** Точка уже стоит: сколько даст вечером (или почему сегодня закрыта) и, если есть кого пустить вместо, «Убрать». */
function stallRow(id: StallId, plan: StallPlan, swap: boolean, getState: () => StoreState, update: Update): HTMLElement {
  // Закрыта по жалобе — просто строка, не красным: делать ничего не надо, завтра снова работает.
  const note = plan.closed ? t('fc.closedToday') : t('fc.income', { sum: plan.income });
  if (!swap) return row(`fc_${id}`, stallName(id), [note], []);
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
  return row(`fc_${id}`, stallName(id), [note, chips([close])], []);
}

/** Кнопки — строкой под описанием (как у сезонного торговца, ui/tenants.ts): справа они сжимали текст в столбик. */
function chips(actions: HTMLElement[]): HTMLElement {
  const line = el('div', 'ui-chips');
  line.style.marginTop = '6px';
  line.append(...actions);
  return line;
}

/** Свободное место: сколько точка даст каждый вечер — до оплаты, и одна кнопка «Открыть». */
function newRow(state: StoreState, id: StallId, getState: () => StoreState, update: Update): HTMLElement {
  const cost = STALLS[id].setup;
  const open = button(
    t('fc.open', { cost }),
    () => {
      const next = openStall(getState(), id);
      if (!next) return;
      track('fc_stall', next.day, cost);
      toast('assets/ico_shop.png', stallName(id), t('fc.opened'));
      update(next, 'success');
    },
    'ui-chip',
    stallLock(state, id) !== null,
  );
  return row(`fc_${id}`, stallName(id), [t('fc.setup', { sum: stallEstimate(state, id) }), chips([open])], []);
}
