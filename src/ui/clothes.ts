// Второй этаж — одежда в разделе «Этажи» (game/clothes.ts, 13.11): сезон и сколько дней ему осталось, стойки,
// распродажа остатков, продавец-консультант и ремонт. Всё — карточками, как подвал (ui/floors.ts): цифры прогноза
// те же, что сцена этажа покажет днём и итог вечера посчитает.
// 27.11, автор: «убрать кнопку завезти». Стойки пополняются сами каждое утро (clothesMorning), распродажа старого
// сезона идёт сама — кнопок «Завезти» и «Начать распродажу» больше нет.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { finishCost, finishFloor } from '../game/floors';
import {
  CLERK_BOOST,
  CLERK_WAGE,
  clothesMorning,
  clothesOf,
  clothesPlan,
  collectionFor,
  COLLECTION_DEFS,
  FINISH_BOOST,
  freePlaces,
  freshStock,
  oldStock,
  RACK_PLACES,
  rackPlaces,
  SALE_OFF,
  SEASON_WARN,
  seasonDaysLeft,
  setClerk,
  stockTotal,
  tagPrice,
  type Collection,
} from '../game/clothes';
import { guestsToday } from '../game/day';
import { track } from '../platform/analytics';
import { button, el } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;
type Row = (texture: string, name: string, notes: (string | HTMLElement)[], actions: HTMLElement[]) => HTMLElement;

export const collName = (c: Collection): string => t(`cl.coll.${c}` as TextKey);

/** Строки второго этажа (этаж уже открыт): row и warn — общие строки раздела «Этажи». */
export function clothesRows(state: StoreState, getState: () => StoreState, update: Update, row: Row, warn: (text: string) => HTMLElement): HTMLElement[] {
  const c = clothesOf(state);
  if (!c) return [];
  const coll = collectionFor(state.day);
  const def = COLLECTION_DEFS[coll];
  const left = seasonDaysLeft(state.day);
  const out: HTMLElement[] = [el('div', 'ui-item-sub', t('floor.second.up'))];
  // Сезон и стойки: что продаётся сейчас, сколько дней осталось; стойки пополняются сами каждое утро.
  const notes: (string | HTMLElement)[] = [t('cl.season', { icon: def.icon, name: collName(coll), n: left }), t('cl.auto', { cost: def.cost, price: tagPrice(state, coll) })];
  if (left <= SEASON_WARN) notes.push(warn(t('cl.season.soon', { n: left })));
  const plan = clothesPlan(state, guestsToday(state));
  // Новых вещей нет, хотя место есть, — утром не хватило денег сверх счетов (стойки, занятые прошлым сезоном, — не беда).
  if (!freshStock(state) && freePlaces(state) > 0) notes.push(warn(t('cl.empty')));
  else if (plan) notes.push(t('cl.today', { n: plan.sold + plan.sale, sum: plan.income - plan.wage }));
  const last = c.last;
  if (last && last.day === state.day - 1) notes.push(t('cl.last', { n: last.sold, sale: last.sale, sum: last.income - last.wage }));
  out.push(row(`fl2b_rack_${coll}`, t('cl.stock', { n: stockTotal(c), max: rackPlaces(state) }), notes, []));
  // Остатки прошлых сезонов: распродаются сами за полцены.
  const old = oldStock(state);
  if (old) out.push(row('fl2b_bin', t('cl.sale'), [t('cl.sale.note', { p: Math.round(SALE_OFF * 100) }), t('cl.stock.old', { n: old })], []));
  // Продавец-консультант: дороже, но продаж больше.
  out.push(
    row('fl2b_mirror', t('cl.clerk'), [t('cl.clerk.note', { wage: CLERK_WAGE, p: Math.round((CLERK_BOOST - 1) * 100) })], [
      button(t(c.clerk ? 'cl.clerk.fire' : 'cl.clerk.hire'), () => update(setClerk(getState(), !c.clerk)), 'ui-chip'),
    ]),
  );
  // Ремонт: свет и новые стойки — мест больше, покупают охотнее.
  const fin = finishCost(state, 'second');
  if (fin !== null) {
    out.push(
      row('fl2b_rack', t('cl.finish'), [t('cl.finish.note', { n: RACK_PLACES[RACK_PLACES.length - 1], p: Math.round((FINISH_BOOST - 1) * 100) })], [
        // Мест после ремонта больше — их заполняют сразу, как утром (clothesMorning).
        button(
          `${fin} 💰`,
          () => {
            const done = finishFloor(getState(), 'second');
            const filled = done && clothesMorning(done);
            if (done && filled && filled !== done) track('clothes_auto', filled.day, done.money - filled.money);
            update(filled, 'success');
          },
          'ui-chip',
          state.money < fin,
        ),
      ]),
    );
  }
  return out;
}
