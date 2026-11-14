// Раздел «Улица» во вкладке «Развитие» (game/estate.ts): помещения на первых этажах домов за магазином — купить и
// пустить арендатора, сменить его; и утренняя история, когда вся улица выкуплена. Файл — в сборке утреннего окна.

import { t } from '../i18n';
import { storeLevel, type StoreState } from '../game/economy';
import {
  buyLock,
  buyLot,
  estateGuests,
  estateNews,
  estateOpen,
  estateRent,
  lease,
  leaseLock,
  LOT_PRICES,
  LOTS,
  NAMED_GUESTS,
  OPEN_DAYS,
  opensIn,
  ownedLots,
  seeEstate,
  shopDesc,
  shopIn,
  shopName,
  SHOPS,
  SHOP_KINDS,
  shopWorks,
  streetNamed,
  SWAP_DAYS,
  vacate,
  lotOf,
  type ShopKind,
} from '../game/estate';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Номер дома на табличке: дома за магазином — чётная сторона, от парковки наружу. */
export const lotNumber = (i: number): number => 2 * (i + 1);

/** Название магазина для таблички на столбе. */
export const streetTitle = (state: StoreState): string => state.shopName?.trim() || t(storeLevel(state).nameKey);

/** У каких помещений раскрыт список кандидатов (смена арендатора): живёт, пока открыто утро. */
const picking = new Set<number>();

const effect = (kind: ShopKind): string => t('estate.effect', { n: SHOPS[kind].rent, g: Math.round(SHOPS[kind].guests * 100) });

const icon = (text: string, dim = false): HTMLElement => {
  const box = el('div', '', text);
  box.style.cssText = `width: 34px; font-size: 24px; text-align: center;${dim ? ' filter: grayscale(0.8) opacity(0.6);' : ''}`;
  return box;
};

const chips = (): HTMLElement => {
  const row = el('div', 'ui-chips');
  row.style.marginTop = '6px';
  return row;
};

/** Кандидаты в помещение i: кто, что даёт и кнопка «Пустить» (кто уже на улице — без кнопки). */
function candidates(state: StoreState, i: number, getState: () => StoreState, update: Update): HTMLElement[] {
  const swap = Boolean(shopIn(state, i));
  return SHOP_KINDS.filter((k) => leaseLock(state, i, k) !== 'here').map((kind) => {
    const lock = leaseLock(state, i, kind);
    const row = el('div', 'ui-item');
    const body = el('div');
    body.append(el('div', 'ui-item-name', t(shopName(kind))), el('div', 'ui-item-sub', t(shopDesc(kind))), el('div', 'ui-item-sub', effect(kind)));
    const actions = chips();
    if (lock === 'taken') actions.append(el('span', 'ui-tag', t('estate.taken')));
    else
      actions.append(
        button(
          t('estate.lease'),
          () => {
            const next = lease(getState(), i, kind);
            if (!next) return;
            picking.delete(i);
            track('estate_lease', next.day, SHOP_KINDS.indexOf(kind));
            toast('assets/ico_shop.png', t('estate.leased'), t('estate.leasedText', { name: t(shopName(kind)), n: swap ? SWAP_DAYS : OPEN_DAYS }));
            update(next, 'success');
          },
          'ui-chip hood-buy',
        ),
      );
    body.append(actions);
    row.append(icon(SHOPS[kind].icon, lock === 'taken'), body, el('div'));
    return row;
  });
}

/** Раздел «Улица»: пока улицу не продают и ничего не куплено — его нет. */
export function estateBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const owned = ownedLots(state);
  if (!estateOpen(state) && !owned) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🏠 ${t('estate.title')}`), el('div', 'ui-muted', t('estate.note')), el('div', '', t('estate.count', { n: owned, max: LOTS })));
  const rent = estateRent(state);
  if (rent) box.append(el('div', '', t('estate.total', { n: rent, g: Math.round((estateGuests(state) - 1) * 100) })));
  box.append(
    streetNamed(state)
      ? el('div', 'ui-note', t('estate.namedLine', { name: streetTitle(state), g: Math.round(NAMED_GUESTS * 100) }))
      : el('div', 'ui-muted', t('estate.goal')),
  );
  for (let i = 0; i < LOTS; i++) {
    const lot = lotOf(state, i);
    const kind = shopIn(state, i);
    const row = el('div', 'ui-item');
    const body = el('div');
    const actions = chips();
    const name = t('estate.lot', { n: lotNumber(i) });
    if (!lot) {
      // Не наше: табличка «Продаётся» и цена.
      const lock = buyLock(state, i);
      body.append(el('div', 'ui-item-name', name), el('div', 'ui-item-sub', t('estate.forSale')));
      actions.append(
        button(
          t('estate.buy', { n: `${LOT_PRICES[i]} 💰` }),
          () => {
            const next = buyLot(getState(), i);
            if (!next) return;
            track('estate_buy', next.day, LOT_PRICES[i]);
            picking.add(i);
            toast('assets/ico_shop.png', t('estate.bought'), t('estate.boughtText', { n: lotNumber(i) }));
            update(next, 'success');
          },
          'ui-chip hood-buy',
          lock !== null,
        ),
      );
      body.append(actions);
      row.append(icon('🏚'), body, el('div'));
      box.append(row);
      continue;
    }
    if (kind) {
      const wait = opensIn(state, i);
      body.append(
        el('div', 'ui-item-name', `${name} · ${t(shopName(kind))}`),
        el('div', 'ui-item-sub', effect(kind)),
        el('div', shopWorks(state, i) ? 'ui-item-sub' : 'ui-note', shopWorks(state, i) ? t('estate.works') : t('estate.opens', { n: wait })),
      );
      actions.append(
        button(
          t('estate.change'),
          () => {
            if (picking.has(i)) picking.delete(i);
            else picking.add(i);
            update(getState(), 'tap');
          },
          'ui-chip',
        ),
        button(
          t('estate.vacate'),
          () => {
            toast('assets/ico_shop.png', t('estate.title'), t('estate.left', { name: t(shopName(kind)) }));
            update(vacate(getState(), i), 'tap');
          },
          'ui-chip',
        ),
      );
    } else body.append(el('div', 'ui-item-name', name), el('div', 'ui-note', t('estate.empty')));
    body.append(actions);
    row.append(icon(kind ? SHOPS[kind].icon : '🔑'), body, el('div'));
    box.append(row);
    // Пустое помещение — сразу кандидаты; занятое — по кнопке «Сменить» (с паузой: новый въедет не сразу).
    if (!kind || picking.has(i)) {
      if (kind) box.append(el('div', 'ui-muted', t('estate.swapNote', { n: SWAP_DAYS })));
      box.append(...candidates(state, i, getState, update));
    }
  }
  return [box];
}

/** Сводка для свёрнутого раздела. */
export const estateSummary = (state: StoreState): string => t('estate.count', { n: ownedLots(state), max: LOTS });

/** Утренняя история: вся улица наша — табличка с названием магазина на столбе. */
export function estateNewsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  if (!estateNews(state)) return [];
  const box = el('div', 'ui-box ui-tale');
  const name = streetTitle(state);
  box.append(
    el('b', '', `🪧 ${t('estate.named.title')}`),
    el('p', '', t('estate.named.text', { name })),
    el('div', 'ui-note', t('estate.named.note', { g: Math.round(NAMED_GUESTS * 100) })),
    button(t('estate.named.ok'), () => update(seeEstate(getState()), 'success')),
  );
  return [box];
}
