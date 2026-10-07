import { t } from '../i18n';
import {
  buyChance,
  buyStock,
  expectedGuests,
  PRICE_STEP,
  PRODUCTS,
  PRODUCT_IDS,
  RETURN_REFUND,
  SHELF_CAPACITY,
  resolveBadBatch,
  setPrice,
  stockCount,
  type BadBatchChoice,
  type ProductId,
  type StoreState,
} from '../game/economy';
import {
  canHaggle,
  haggle,
  HAGGLE_ASKS,
  newDeal,
  SUPPLIER_IDS,
  SUPPLIERS,
  unitPrice,
  type Deal,
  type SupplierId,
} from '../game/suppliers';
import type { TextKey } from '../i18n/ru';
import { haptic } from '../platform/telegram';
import { button, el, openModal } from './dom';

interface MorningOptions {
  getState: () => StoreState;
  setState: (s: StoreState) => void;
  onOpen: () => void;
}

/** Утренний экран: закупка у поставщиков, торг и цены на полке. */
export function showMorning({ getState, setState, onOpen }: MorningOptions): void {
  const { card, close } = openModal();
  const deals = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, newDeal(SUPPLIERS[id])])) as Record<SupplierId, Deal>;
  const quotes = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, SUPPLIERS[id].lines.hello])) as Record<SupplierId, TextKey>;
  /** Бракованная партия, по которой ждём решения игрока. */
  let pendingBad: { sid: SupplierId; pid: ProductId; qty: number; price: number } | null = null;

  const render = () => {
    const state = getState();
    const title = el('h2');
    title.append(el('span', '', t('morning.title', { n: state.day })), el('span', '', t('morning.money', { n: state.money })));
    if (pendingBad) {
      card.replaceChildren(title, qualityBox(pendingBad));
      return;
    }
    card.replaceChildren(
      title,
      el('div', 'ui-muted', t('morning.guests', { r: state.rating.toFixed(1), n: expectedGuests(state.rating) })),
      el('h3', '', t('morning.suppliers')),
    );

    for (const sid of SUPPLIER_IDS) card.append(supplierBox(sid, state));

    card.append(el('h3', '', t('morning.prices')));
    for (const pid of PRODUCT_IDS) card.append(priceRow(pid, state));

    card.append(
      button(t('morning.open'), () => {
        close();
        onOpen();
      }),
    );
  };

  const supplierBox = (sid: SupplierId, state: StoreState) => {
    const s = SUPPLIERS[sid];
    const deal = deals[sid];
    const box = el('div', 'ui-box');
    box.append(el('b', '', t(s.nameKey)), el('div', 'ui-quote', `«${t(quotes[sid])}»`));

    for (const pid of PRODUCT_IDS) {
      const price = unitPrice(s, deal, pid);
      if (price === null) continue;
      const count = stockCount(state, pid);
      const row = el('div', 'ui-row');
      const info = el('span');
      info.append(
        el('span', '', `${t(PRODUCTS[pid].nameKey)} · ${price} 💰 `),
        el('span', 'ui-muted', shelfInfo(state, pid)),
      );
      const chips = el('div', 'ui-chips');
      for (const qty of [1, 5]) {
        const canBuy = count + qty <= SHELF_CAPACITY && price * qty <= state.money;
        chips.append(
          button(
            `+${qty}`,
            () => {
              const bad = Math.random() < s.badChance;
              const next = buyStock(getState(), pid, qty, price, bad);
              if (!next) return;
              setState(next);
              if (bad) {
                pendingBad = { sid, pid, qty, price };
                haptic.error();
              } else {
                haptic.tap();
              }
              render();
            },
            'ui-chip',
            !canBuy,
          ),
        );
      }
      row.append(info, chips);
      box.append(row);
    }

    const haggleRow = el('div', 'ui-chips');
    if (deal.discount > 0) {
      haggleRow.append(el('span', 'ui-muted', t('morning.discount', { p: Math.round(deal.discount * 100) })));
    } else if (deal.angry) {
      haggleRow.append(el('span', 'ui-muted', t('morning.angryNote')));
    } else {
      haggleRow.append(el('span', 'ui-muted', t('morning.haggle')));
      for (const ask of HAGGLE_ASKS) {
        haggleRow.append(
          button(
            `−${Math.round(ask * 100)}%`,
            () => {
              const result = haggle(s, deals[sid], ask, getState().rating, Math.random());
              deals[sid] = result.deal;
              quotes[sid] = result.success ? s.lines.yes : result.deal.angry ? s.lines.angry : s.lines.no;
              if (result.success) haptic.success();
              else haptic.error();
              render();
            },
            'ui-chip',
            !canHaggle(deal),
          ),
        );
      }
      haggleRow.append(el('span', 'ui-muted', t('morning.attempts', { n: deal.attemptsLeft })));
    }
    box.append(haggleRow);
    return box;
  };

  const qualityBox = (batch: NonNullable<typeof pendingBad>) => {
    const box = el('div', 'ui-box');
    box.append(
      el('h3', '', `⚠️ ${t('quality.title')}`),
      el(
        'p',
        '',
        t('quality.text', { product: t(PRODUCTS[batch.pid].nameKey), n: batch.qty, supplier: t(SUPPLIERS[batch.sid].nameKey) }),
      ),
    );
    const refund = Math.round(batch.qty * batch.price * RETURN_REFUND);
    const options: [BadBatchChoice, TextKey, string][] = [
      ['shelf', 'quality.shelf', t('quality.shelfHint')],
      ['markdown', 'quality.markdown', t('quality.markdownHint')],
      ['return', 'quality.return', t('quality.returnHint', { n: refund })],
    ];
    for (const [choice, label, hint] of options) {
      box.append(
        button(t(label), () => {
          setState(resolveBadBatch(getState(), batch.pid, choice, batch.price));
          pendingBad = null;
          haptic.tap();
          render();
        }),
        el('div', 'ui-muted', hint),
      );
    }
    return box;
  };

  const priceRow = (pid: ProductId, state: StoreState) => {
    const price = state.prices[pid];
    const row = el('div', 'ui-row');
    const change = (delta: number) => () => {
      setState(setPrice(getState(), pid, getState().prices[pid] + delta));
      render();
    };
    const chips = el('div', 'ui-chips');
    chips.append(
      button('−', change(-PRICE_STEP), 'ui-chip'),
      el('b', '', `${price} 💰`),
      button('+', change(PRICE_STEP), 'ui-chip'),
    );
    const label = el('span');
    label.append(
      el('span', '', `${t(PRODUCTS[pid].nameKey)} `),
      el('span', 'ui-muted', t('morning.demand', { p: Math.round(buyChance(price, PRODUCTS[pid].basePrice) * 100) })),
    );
    row.append(label, chips);
    return row;
  };

  render();
}

function shelfInfo(state: StoreState, pid: ProductId): string {
  const units = state.stock[pid];
  const parts = [t('morning.shelf', { n: units.length, max: SHELF_CAPACITY })];
  const bad = units.filter((u) => u.bad && !u.markdown).length;
  const markdown = units.filter((u) => u.markdown).length;
  if (bad) parts.push(t('morning.badStock', { n: bad }));
  if (markdown) parts.push(t('morning.markdownStock', { n: markdown }));
  return parts.join(', ');
}
