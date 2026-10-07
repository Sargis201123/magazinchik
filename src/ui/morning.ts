import { staffName, t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import {
  buyChance,
  buyShelf,
  buyStock,
  canPlace,
  CATEGORIES,
  billTotal,
  daysUntilBill,
  DEBT_PAYMENT,
  monthlyBill,
  monthOf,
  STAFF_ROLES,
  expandStore,
  expectedGuests,
  freeSlots,
  moveToShelf,
  nextStoreLevel,
  payDebt,
  PRICE_STEP,
  PRODUCTS,
  PRODUCT_IDS,
  resolveBadBatch,
  RETURN_REFUND,
  setPrice,
  SHELF_KINDS,
  SHELF_LEVELS,
  sellShelf,
  shelfCapacity,
  shelfCount,
  shelfFree,
  shelfResale,
  storeLevel,
  upgradeCost,
  upgradeShelf,
  warehouseCapacity,
  warehouseCount,
  warehouseOf,
  answerRaise,
  fire,
  hire,
  STAFF_ROLE_IDS,
  staffLimit,
  staffOf,
  TRAITS,
  type StaffMember,
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
import { currentCandidates, JOB_AD_COST, startJobSearch } from '../game/staff';
import { haptic } from '../platform/telegram';
import { button, el, openModal } from './dom';

interface MorningOptions {
  getState: () => StoreState;
  setState: (s: StoreState) => void;
  onOpen: () => void;
}

type Tab = 'buy' | 'warehouse' | 'shelves' | 'staff' | 'store';
const TABS: [Tab, TextKey][] = [
  ['buy', 'tab.buy'],
  ['warehouse', 'tab.warehouse'],
  ['shelves', 'tab.shelves'],
  ['staff', 'tab.staff'],
  ['store', 'tab.store'],
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
    if (state.quitNotice?.length) {
      card.replaceChildren(title, quitBox(state.quitNotice));
      return;
    }
    const asking = state.staff.find((m) => m.raiseAsk);
    if (asking) {
      card.replaceChildren(title, raiseBox(asking));
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

    const body = { buy: buyTab, warehouse: warehouseTab, shelves: shelvesTab, staff: staffTab, store: storeTab }[tab](state);
    card.replaceChildren(
      title,
      el('div', 'ui-muted', t('morning.guests', { r: state.rating.toFixed(1), n: expectedGuests(state.rating, state.level) })),
      billForecast(state),
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
    el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: warehouseCapacity(state) })),
    ...SUPPLIER_IDS.map((sid) => supplierBox(sid, state)),
    el('h3', '', t('tab.prices')),
    ...pricesTab(state),
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

    const free = warehouseCapacity(state) - warehouseCount(state);
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
      el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: warehouseCapacity(state) })),
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
    const slots = storeLevel(state).slots;
    const out: HTMLElement[] = [
      el('div', 'ui-note', t('shelves.rule')),
      el('div', 'ui-muted', t('shelves.slots', { n: state.shelves.length, max: slots })),
    ];
    state.shelves.forEach((shelf, i) => {
      const box = el('div', 'ui-box');
      const head = el('div', 'ui-row');
      const title = el('span');
      title.append(
        el('b', '', `${t(SHELF_KINDS[shelf.kind].nameKey)} `),
        el('span', 'ui-muted', t('shelves.places', { n: shelfCount(shelf), max: shelfCapacity(shelf) })),
      );
      head.append(
        title,
        button(t('shelves.sell', { n: shelfResale(shelf) }), () => update(sellShelf(getState(), i)), 'ui-chip'),
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
    if (freeSlots(state) <= 0) {
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

  // ---------- Персонал ----------

  const quitBox = (quit: StaffMember[]) => {
    const box = el('div', 'ui-box');
    box.append(el('h3', '', `😤 ${t('staffTab.quitTitle')}`));
    for (const m of quit) box.append(el('p', '', t('staffTab.quitText', { name: staffName(m.name), role: t(STAFF_ROLES[m.role].nameKey) })));
    box.append(button(t('staffTab.ok'), () => update({ ...getState(), quitNotice: undefined })));
    return box;
  };

  const raiseBox = (m: StaffMember) => {
    const box = el('div', 'ui-box');
    box.append(
      el('h3', '', `💬 ${t('staffTab.raiseTitle')}`),
      el(
        'p',
        '',
        t('staffTab.raiseText', {
          name: staffName(m.name),
          role: t(STAFF_ROLES[m.role].nameKey),
          from: m.wage,
          to: m.raiseAsk ?? m.wage,
        }),
      ),
      el('div', 'ui-muted', `${'★'.repeat(m.skill).padEnd(3, '☆')} · ${t('staffTab.months', { n: m.months })}`),
      button(t('staffTab.raiseYes', { n: m.raiseAsk ?? m.wage }), () => update(answerRaise(getState(), m.role, true), 'success')),
      el('div', 'ui-muted', t('staffTab.raiseYesHint')),
      button(t('staffTab.raiseNo'), () => update(answerRaise(getState(), m.role, false), 'error'), 'ui-btn secondary'),
      el('div', 'ui-muted', t('staffTab.raiseNoHint')),
    );
    return box;
  };

  const traitLine = (m: StaffMember) => {
    const stars = '★'.repeat(m.skill).padEnd(3, '☆');
    const trait = m.trait ? ` · ${t(TRAITS[m.trait].nameKey)}: ${t(TRAITS[m.trait].descKey)}` : '';
    return `${stars}${trait}`;
  };

  const staffTab = (state: StoreState): HTMLElement[] => {
    const limit = staffLimit(state);
    const out: HTMLElement[] = [
      el('div', 'ui-muted', t('staffTab.count', { n: state.staff.length, max: limit })),
      el('div', 'ui-note', t('staffTab.wageNote')),
    ];
    if (state.staff.length === 0) out.push(el('div', 'ui-note', t('staffTab.none')));
    for (const m of state.staff) {
      const box = el('div', 'ui-box');
      const head = el('div', 'ui-row');
      const title = el('span');
      title.append(el('b', '', `${staffName(m.name)} — ${t(STAFF_ROLES[m.role].nameKey)} `));
      head.append(title, button(t('staffTab.fire'), () => update(fire(getState(), m.role)), 'ui-chip'));
      box.append(
        head,
        el('div', 'ui-muted', t(STAFF_ROLES[m.role].descKey)),
        el('div', 'ui-muted', traitLine(m)),
        el(
          'div',
          'ui-muted',
          `${t('staffTab.wage', { n: m.wage })} · ${m.months ? t('staffTab.months', { n: m.months }) : t('staffTab.new')}`,
        ),
      );
      if (m.upset) box.append(el('div', 'ui-note', t('staffTab.upset')));
      out.push(box);
    }

    const full = state.staff.length >= limit;
    out.push(el('h3', '', t('staffTab.search')), el('div', 'ui-muted', t('staffTab.searchNote', { cost: JOB_AD_COST })));
    const roles = el('div', 'ui-chips');
    for (const role of STAFF_ROLE_IDS) {
      const searched = state.jobSearch?.day === state.day && state.jobSearch.role === role;
      roles.append(
        button(
          t(STAFF_ROLES[role].nameKey),
          () => update(startJobSearch(getState(), role)),
          `ui-chip${searched ? ' active' : ''}`,
          Boolean(staffOf(state, role)) || full || (!searched && state.money < JOB_AD_COST),
        ),
      );
    }
    out.push(roles);

    const candidates = currentCandidates(state);
    if (state.jobSearch?.day === state.day) {
      out.push(el('h3', '', t('staffTab.candidates', { role: t(STAFF_ROLES[state.jobSearch.role].nameKey) })));
      if (candidates.length === 0) out.push(el('div', 'ui-note', t('staffTab.noCandidates')));
    }
    for (const c of candidates) {
      const box = el('div', 'ui-box');
      const head = el('div', 'ui-row');
      const taken = Boolean(staffOf(state, c.role));
      head.append(
        el('b', '', staffName(c.name)),
        button(
          taken ? t('staffTab.roleTaken') : full ? t('staffTab.full') : t('staffTab.hire'),
          () => update(hire(getState(), c), 'success'),
          'ui-chip',
          taken || full,
        ),
      );
      box.append(head, el('div', 'ui-muted', traitLine(c)), el('div', '', t('staffTab.wage', { n: c.wage })));
      out.push(box);
    }
    return out;
  };

  // ---------- Магазин: помещение, кредит, счета ----------

  /** Строка под заголовком: когда счета и сколько примерно. */
  const billForecast = (state: StoreState) => {
    const daysLeft = daysUntilBill(state.day);
    const sum = billTotal(monthlyBill(state));
    const text = daysLeft === 0 ? t('morning.billsTonight', { sum }) : t('morning.bills', { n: daysLeft, sum });
    const line = el('div', 'ui-muted', text);
    if (daysLeft <= 1 && state.money < sum) line.style.color = '#b13e53';
    return line;
  };

  // ---------- Магазин: помещение, долг, расходы ----------

  const storeTab = (state: StoreState): HTMLElement[] => {
    const level = storeLevel(state);
    const next = nextStoreLevel(state);
    const out: HTMLElement[] = [];

    const current = el('div', 'ui-box');
    current.append(
      el('b', '', t('store.current', { name: t(level.nameKey) })),
      el('div', 'ui-muted', t('store.stats', { slots: level.slots, wh: level.warehouse, g: level.guests })),
    );
    out.push(current);

    const grow = el('div', 'ui-box');
    if (!next) {
      grow.append(el('div', 'ui-muted', t('store.max')));
    } else {
      grow.append(
        el('b', '', t('store.next', { name: t(next.nameKey) })),
        el('div', 'ui-muted', t('store.nextStats', { slots: next.slots, wh: next.warehouse, g: next.guests, rent: next.rent })),
      );
      if (state.debt > 0) grow.append(el('div', 'ui-note', t('store.needNoDebt')));
      grow.append(
        button(
          t('store.expand', { cost: next.cost }),
          () => update(expandStore(getState()), 'success'),
          'ui-btn secondary',
          state.debt > 0 || next.cost > state.money,
        ),
      );
    }
    out.push(grow);

    const debt = el('div', 'ui-box');
    if (state.debt > 0) {
      debt.append(el('b', '', t('debt.title', { n: state.debt })), el('div', 'ui-muted', t('debt.note', { p: DEBT_PAYMENT })));
      const chips = el('div', 'ui-chips');
      for (const amount of [100, state.debt]) {
        if (amount === 100 && state.debt <= 100) continue;
        chips.append(
          button(t('debt.pay', { n: amount }), () => update(payDebt(getState(), amount), 'success'), 'ui-chip', state.money < amount),
        );
      }
      debt.append(chips);
    } else {
      debt.append(el('b', '', t('debt.none')));
    }
    out.push(debt);

    const bill = monthlyBill(state);
    const daysLeft = daysUntilBill(state.day);
    const costs = el('div', 'ui-box');
    costs.append(
      el('b', '', t('bills.title')),
      el(
        'div',
        'ui-muted',
        daysLeft === 0 ? t('bills.tonight', { m: monthOf(state.day) }) : t('bills.when', { m: monthOf(state.day), n: daysLeft }),
      ),
    );
    const row = (label: string, value: number | string) => {
      const r = el('div', 'ui-row');
      r.append(el('span', '', label), el('span', '', typeof value === 'number' ? `${value} 💰` : value));
      costs.append(r);
    };
    row(t('bills.rent'), bill.rent);
    row(t('bills.utilities'), bill.utilities);
    row(t('bills.power'), bill.power);
    row(t('bills.salaries'), state.staff.length ? bill.salaries : t('bills.noStaff'));
    if (bill.debt) row(t('bills.debt'), bill.debt);
    row(t('bills.total'), billTotal(bill));
    const wages = (Object.keys(STAFF_ROLES) as (keyof typeof STAFF_ROLES)[])
      .map((r) => `${t(STAFF_ROLES[r].nameKey)} ${STAFF_ROLES[r].wage}`)
      .join(', ');
    costs.append(el('div', 'ui-muted', t('bills.staffPreview', { list: wages })));
    out.push(costs);
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
