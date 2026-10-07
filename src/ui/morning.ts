import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import {
  buyChance,
  buyShelf,
  buyStock,
  canPlace,
  CATEGORIES,
  expectedGuests,
  MAX_SHELVES,
  moveToShelf,
  PRICE_STEP,
  PRODUCTS,
  PRODUCT_IDS,
  resolveBadBatch,
  RETURN_REFUND,
  setPrice,
  SHELF_KINDS,
  SHELF_LEVELS,
  shelfCapacity,
  shelfCount,
  shelfFree,
  upgradeCost,
  upgradeShelf,
  WAREHOUSE_CAPACITY,
  warehouseCount,
  warehouseOf,
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
import { haptic } from '../platform/telegram';
import { button, el, openModal } from './dom';

interface MorningOptions {
  getState: () => StoreState;
  setState: (s: StoreState) => void;
  onOpen: () => void;
}

type Tab = 'buy' | 'warehouse' | 'shelves' | 'prices';
const TABS: [Tab, TextKey][] = [
  ['buy', 'tab.buy'],
  ['warehouse', 'tab.warehouse'],
  ['shelves', 'tab.shelves'],
  ['prices', 'tab.prices'],
];

const productLabel = (id: ProductId) => `${PRODUCTS[id].icon} ${t(PRODUCTS[id].nameKey)}`;

/** Утро: закупка (товар едет на склад), раскладка со склада на полки, полки и цены. */
export function showMorning({ getState, setState, onOpen }: MorningOptions): void {
  const { card, close } = openModal();
  const deals = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, newDeal(SUPPLIERS[id])])) as Record<SupplierId, Deal>;
  const quotes = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, SUPPLIERS[id].lines.hello])) as Record<SupplierId, TextKey>;
  let tab: Tab = 'buy';
  /** Бракованная партия, по которой ждём решения игрока. */
  let pendingBad: { sid: SupplierId; pid: ProductId; qty: number; price: number } | null = null;

  const update = (next: StoreState | null, feedback: 'tap' | 'success' | 'error' = 'tap') => {
    if (!next) return;
    setState(next);
    haptic[feedback]();
    render();
  };

  const render = () => {
    const state = getState();
    const title = el('h2');
    title.append(el('span', '', t('morning.title', { n: state.day })), el('span', '', t('morning.money', { n: state.money })));

    if (pendingBad) {
      card.replaceChildren(title, qualityBox(pendingBad));
      return;
    }

    const tabs = el('div', 'ui-tabs');
    for (const [id, label] of TABS) {
      tabs.append(
        button(
          t(label),
          () => {
            tab = id;
            render();
          },
          `ui-tab${tab === id ? ' active' : ''}`,
        ),
      );
    }

    const body = { buy: buyTab, warehouse: warehouseTab, shelves: shelvesTab, prices: pricesTab }[tab](state);
    card.replaceChildren(
      title,
      el('div', 'ui-muted', t('morning.guests', { r: state.rating.toFixed(1), n: expectedGuests(state.rating) })),
      tabs,
      ...body,
      button(t('morning.open'), () => {
        close();
        onOpen();
      }),
    );
  };

  // ---------- Закупка ----------

  const buyTab = (state: StoreState): HTMLElement[] => [
    el('div', 'ui-note', t('buy.note')),
    el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: WAREHOUSE_CAPACITY })),
    ...SUPPLIER_IDS.map((sid) => supplierBox(sid, state)),
  ];

  const supplierBox = (sid: SupplierId, state: StoreState) => {
    const s = SUPPLIERS[sid];
    const deal = deals[sid];
    const box = el('div', 'ui-box');
    box.append(el('b', '', t(s.nameKey)), el('div', 'ui-quote', `«${t(quotes[sid])}»`));

    if (s.requires && !state.shelves.some((sh) => sh.kind === s.requires)) {
      box.append(el('div', 'ui-muted', t('buy.needShelf', { shelf: t(SHELF_KINDS[s.requires].nameKey) })));
      return box;
    }

    const free = WAREHOUSE_CAPACITY - warehouseCount(state);
    for (const pid of PRODUCT_IDS) {
      const price = unitPrice(s, deal, pid);
      if (price === null) continue;
      const row = el('div', 'ui-row');
      const info = el('span');
      info.append(
        el('span', '', `${productLabel(pid)} · ${price} 💰 `),
        el('span', 'ui-muted', t('buy.inWarehouse', { n: warehouseOf(state, pid) })),
      );
      const chips = el('div', 'ui-chips');
      for (const qty of [1, 5]) {
        chips.append(
          button(
            `+${qty}`,
            () => {
              const bad = Math.random() < s.badChance;
              const next = buyStock(getState(), pid, qty, price, bad);
              if (bad && next) pendingBad = { sid, pid, qty, price };
              update(next, bad ? 'error' : 'tap');
            },
            'ui-chip',
            qty > free || price * qty > state.money,
          ),
        );
      }
      row.append(info, chips);
      box.append(row);
    }

    const haggleRow = el('div', 'ui-chips');
    if (deal.discount > 0) {
      haggleRow.append(el('span', 'ui-muted', t('buy.discount', { p: Math.round(deal.discount * 100) })));
    } else if (deal.angry) {
      haggleRow.append(el('span', 'ui-muted', t('buy.angryNote')));
    } else {
      haggleRow.append(el('span', 'ui-muted', t('buy.haggle')));
      for (const ask of HAGGLE_ASKS) {
        haggleRow.append(
          button(
            `−${Math.round(ask * 100)}%`,
            () => {
              const result = haggle(s, deals[sid], ask, getState().rating, Math.random());
              deals[sid] = result.deal;
              quotes[sid] = result.success ? s.lines.yes : result.deal.angry ? s.lines.angry : s.lines.no;
              haptic[result.success ? 'success' : 'error']();
              render();
            },
            'ui-chip',
            !canHaggle(deal),
          ),
        );
      }
      haggleRow.append(el('span', 'ui-muted', t('buy.attempts', { n: deal.attemptsLeft })));
    }
    box.append(haggleRow);
    return box;
  };

  const qualityBox = (batch: NonNullable<typeof pendingBad>) => {
    const box = el('div', 'ui-box');
    box.append(
      el('h3', '', `⚠️ ${t('quality.title')}`),
      el('p', '', t('quality.text', { product: productLabel(batch.pid), n: batch.qty, supplier: t(SUPPLIERS[batch.sid].nameKey) })),
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
          pendingBad = null;
          update(resolveBadBatch(getState(), batch.pid, choice, batch.price));
        }),
        el('div', 'ui-muted', hint),
      );
    }
    return box;
  };

  // ---------- Склад ----------

  const warehouseTab = (state: StoreState): HTMLElement[] => {
    const out: HTMLElement[] = [
      el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: WAREHOUSE_CAPACITY })),
    ];
    const present = PRODUCT_IDS.filter((pid) => warehouseOf(state, pid) > 0);
    if (present.length === 0) {
      out.push(el('div', 'ui-note', t('warehouse.empty')));
      return out;
    }
    const box = el('div', 'ui-box');
    for (const pid of present) {
      const units = state.warehouse[pid] ?? [];
      const bad = units.filter((u) => u.bad && !u.markdown).length;
      const markdown = units.filter((u) => u.markdown).length;
      const extra = [bad ? t('warehouse.bad', { n: bad }) : '', markdown ? t('warehouse.markdown', { n: markdown }) : '']
        .filter(Boolean)
        .join(', ');

      const row = el('div', 'ui-row');
      const info = el('span');
      info.append(el('span', '', `${productLabel(pid)} ×${units.length} `), el('span', 'ui-muted', extra));

      const shelfIndex = state.shelves.findIndex((sh) => canPlace(pid, sh) && shelfFree(sh) > 0);
      const hasShelfKind = state.shelves.some((sh) => canPlace(pid, sh));
      if (!hasShelfKind) {
        row.append(info, el('span', 'ui-muted', t('warehouse.noShelf', { shelf: t(SHELF_KINDS[PRODUCTS[pid].category].nameKey) })));
      } else {
        row.append(
          info,
          button(
            shelfIndex >= 0 ? t('warehouse.toShelf') : t('warehouse.shelfFull'),
            () => update(moveToShelf(getState(), shelfIndex, pid).state),
            'ui-chip',
            shelfIndex < 0,
          ),
        );
      }
      box.append(row);
    }
    out.push(
      box,
      button(
        t('warehouse.fillAll'),
        () => {
          let next = getState();
          next.shelves.forEach((_, i) => (next = moveToShelf(next, i).state));
          update(next, 'success');
        },
        'ui-btn secondary',
      ),
    );
    return out;
  };

  // ---------- Полки ----------

  const shelvesTab = (state: StoreState): HTMLElement[] => {
    const out: HTMLElement[] = [el('div', 'ui-note', t('shelves.rule'))];
    state.shelves.forEach((shelf, i) => {
      const box = el('div', 'ui-box');
      const head = el('div', 'ui-row');
      head.append(
        el('b', '', t(SHELF_KINDS[shelf.kind].nameKey)),
        el('span', 'ui-muted', t('shelves.places', { n: shelfCount(shelf), max: shelfCapacity(shelf) })),
      );
      const allowed = PRODUCT_IDS.filter((pid) => PRODUCTS[pid].category === shelf.kind).map(productLabel).join(', ');
      box.append(head, el('div', 'ui-muted', t('shelves.only', { list: allowed })));

      const cost = upgradeCost(shelf);
      if (cost === null) {
        box.append(el('div', 'ui-muted', t('shelves.maxLevel')));
      } else {
        box.append(
          button(
            t('shelves.upgrade', { cap: SHELF_LEVELS[shelf.level + 1].capacity, cost }),
            () => update(upgradeShelf(getState(), i), 'success'),
            'ui-btn secondary',
            cost > state.money,
          ),
        );
      }
      out.push(box);
    });

    out.push(el('h3', '', t('shelves.buyTitle')));
    if (state.shelves.length >= MAX_SHELVES) {
      out.push(el('div', 'ui-muted', t('shelves.noRoom')));
    } else {
      for (const kind of CATEGORIES) {
        const { nameKey, price } = SHELF_KINDS[kind];
        out.push(
          button(
            t('shelves.buy', { name: t(nameKey), cost: price }),
            () => update(buyShelf(getState(), kind), 'success'),
            'ui-btn secondary',
            price > state.money,
          ),
        );
      }
    }
    return out;
  };

  // ---------- Цены ----------

  const pricesTab = (state: StoreState): HTMLElement[] =>
    PRODUCT_IDS.map((pid) => {
      const price = state.prices[pid];
      const row = el('div', 'ui-row');
      const change = (delta: number) => () => update(setPrice(getState(), pid, getState().prices[pid] + delta));
      const chips = el('div', 'ui-chips');
      chips.append(
        button('−', change(-PRICE_STEP), 'ui-chip'),
        el('b', '', `${price} 💰`),
        button('+', change(PRICE_STEP), 'ui-chip'),
      );
      const label = el('span');
      label.append(
        el('span', '', `${productLabel(pid)} `),
        el('span', 'ui-muted', t('prices.demand', { p: Math.round(buyChance(price, PRODUCTS[pid].basePrice) * 100) })),
      );
      row.append(label, chips);
      return row;
    });

  render();
}
