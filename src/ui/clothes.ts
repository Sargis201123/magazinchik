// Второй этаж — одежда в разделе «Этажи» (game/clothes.ts, 13.11): сезон и сколько дней ему осталось, стойки,
// закупка партии, распродажа остатков, продавец-консультант и ремонт. Всё — карточками, как подвал (ui/floors.ts):
// цифры прогноза те же, что сцена этажа покажет днём и итог вечера посчитает.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { finishCost, finishFloor } from '../game/floors';
import {
  BATCH,
  batchCost,
  batchSize,
  buyBatch,
  CLERK_BOOST,
  CLERK_WAGE,
  clothesOf,
  clothesPlan,
  collectionFor,
  COLLECTION_DEFS,
  FINISH_BOOST,
  freshStock,
  oldStock,
  RACK_PLACES,
  rackPlaces,
  SALE_OFF,
  SEASON_WARN,
  seasonDaysLeft,
  setClerk,
  setSale,
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
  // Сезон и стойки: что продаётся сейчас, сколько дней осталось, что пылится.
  const notes: (string | HTMLElement)[] = [t('cl.season', { icon: def.icon, name: collName(coll), n: left }), t('cl.batch.note', { n: BATCH, cost: def.cost, price: tagPrice(state, coll) })];
  if (left <= SEASON_WARN) notes.push(warn(t('cl.season.soon', { n: left })));
  const plan = clothesPlan(state, guestsToday(state));
  if (plan) notes.push(freshStock(state) ? t('cl.today', { n: plan.sold + plan.sale, sum: plan.income - plan.wage }) : warn(t('cl.empty')));
  else notes.push(warn(t('cl.empty')));
  const last = c.last;
  if (last && last.day === state.day - 1) notes.push(t('cl.last', { n: last.sold, sale: last.sale, sum: last.income - last.wage }));
  const n = batchSize(state);
  const cost = batchCost(state);
  const buy = n
    ? button(
        t('cl.batch', { cost }),
        () => {
          const next = buyBatch(getState());
          if (next) track('clothes_batch', next.day, cost);
          update(next, 'success');
        },
        'ui-chip',
        state.money < cost,
      )
    : el('span', 'ui-tag', t('cl.full'));
  out.push(row(`fl2b_rack_${coll}`, t('cl.stock', { n: stockTotal(c), max: rackPlaces(state) }), notes, [buy]));
  // Остатки прошлых сезонов: распродать за полцены или пусть пылятся (и занимают места).
  const old = oldStock(state);
  if (old || c.sale) {
    const saleNotes: (string | HTMLElement)[] = [t('cl.sale.note', { p: Math.round(SALE_OFF * 100) })];
    if (old && !c.sale) saleNotes.push(warn(t('cl.stock.old', { n: old })));
    out.push(
      row('fl2b_bin', t('cl.sale'), saleNotes, [
        button(t(c.sale ? 'cl.sale.off' : 'cl.sale.on'), () => update(setSale(getState(), !c.sale)), 'ui-chip'),
      ]),
    );
  }
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
        button(`${fin} 💰`, () => update(finishFloor(getState(), 'second'), 'success'), 'ui-chip', state.money < fin),
      ]),
    );
  }
  return out;
}
