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
  onShelves,
  freeSlots,
  moveToShelf,
  nextStoreLevel,
  payDebt,
  PRICE_STEP,
  PRODUCTS,
  PRODUCT_IDS,
  resolveBadBatch,
  RETURN_REFUND,
  sellableProducts,
  setPrice,
  SHELF_KINDS,
  SHELF_LEVELS,
  sellShelf,
  shelfCapacity,
  shelfCount,
  shelfFree,
  shelfResale,
  storeLevel,
  STORE_LEVELS,
  productAvailable,
  upgradeCost,
  upgradeShelf,
  warehouseCapacity,
  warehouseCount,
  warehouseOf,
  answerRaise,
  cashierScan,
  servePerDay,
  fire,
  ownerLevel,
  ownerNextLevelAt,
  ownerScan,
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
import { guestsToday } from '../game/day';
import {
  ALBUM_REWARD,
  ALL_QUESTS_RATING,
  QUEST_TEXT,
  RANK_GUESTS,
  rankName,
  rankOf,
  rankThreshold,
  RARE_GUESTS,
  seasonFor,
  type Quest,
} from '../game/endless';
import { answerEvent, CLIENTS, fridgeRepairCost, repairShelf, type ClientId, type MorningEvent } from '../game/events';
import { applyReorder, autoOrderPlan, recordPurchase, rememberAutoOrder, reorderPlan, toggleAutoOrder } from '../game/reorder';
import { activePromo, setPromo, type PromoKind } from '../game/promo';
import { cancelContract, CONTRACT_QTYS, contractOf, contractPrice, deliverContracts, signContract, type Delivery } from '../game/contracts';
import { daysToFair, isFairDay } from '../game/fair';
import { WEEKLY_TEXT, weeklyUntil, type Challenge } from '../game/weekly';
import { pendingTip, seeTip, TIP_ICONS } from '../game/tips';
import { expiringCount, markdownExpiring } from '../game/economy';
import { currentCandidates, JOB_AD_COST, startJobSearch, train, trainingCost } from '../game/staff';
import { CHARACTERS, currentChapter, finishChapter, finishIntro, pendingStory, type Chapter, type CharacterId } from '../game/story';
import { sound } from '../platform/sound';
import { WEATHER_EFFECTS, weatherDemand, weatherFor } from '../game/weather';
import { CANDY_COST, CANDY_PRICE, nextRack, rackCapacity, rackOf, refillRack, upgradeRack } from '../game/impulse';
import { buyCups, COFFEE_CHANCE, CUP_COST, cupsOf, CUPS_MAX } from '../game/coffee';
import { coffeePrice, coffeeSprite, GEAR, GEAR_IDS, gearAvailable, gearTier, nextGear, ovenBake, ovenBatch, ovenBatchCost, ovenSprite, upgradeGear, type GearId } from '../game/gear';
import { isCashierRole, nextRegisterCount, registerCount, registerOfRole } from '../game/registers';
import { activeWar, answerWar } from '../game/war';
import {
  adoptCat,
  buyBed,
  CAT_BASE_LUCK,
  CAT_BED_IDS,
  CAT_BEDS,
  CAT_FROM_DAY,
  CAT_NAME_MAX,
  catAway,
  catOffer,
  declineCat,
  FEED_COST,
  feedCat,
  fedToday,
  setBed,
} from '../game/cat';
import { holidayFor } from '../game/calendar';
import { dialogBox } from './dialog';
import { achievementsButton } from './achievements';
import { activeAd, AD_IDS, ADS, adPrice, buyAd } from '../game/ads';
import { buyUpgrade, hasUpgrade, UPGRADE_IDS, UPGRADES, withUpgrades } from '../game/upgrades';
import { MAX_LOYALTY, met, REGULARS, regularState } from '../game/regulars';

/** Высота «голоса» героев в диалогах. */
const VOICE: Record<CharacterId, number> = { grandma: 620, valya: 700, marat: 330, eduard: 240, inspector: 420 };
import { buyDecor, DECOR, DECOR_KINDS, setDecor, type DecorItem, type DecorKind } from '../game/decor';
import { haptic } from '../platform/telegram';
import { button, el, openModal, who } from './dom';

/** Портрет заказчика: шеф — это Марат. */
const CLIENT_PORTRAIT: Record<ClientId, string> = { chef: 'marat', school: 'school', valya: 'valya' };

interface MorningOptions {
  getState: () => StoreState;
  setState: (s: StoreState) => void;
  onOpen: () => void;
}

type Tab = 'buy' | 'warehouse' | 'shelves' | 'extras' | 'staff' | 'store';
const TABS: [Tab, TextKey][] = [
  ['buy', 'tab.buy'],
  ['warehouse', 'tab.warehouse'],
  ['shelves', 'tab.shelves'],
  ['extras', 'tab.extras'],
  ['staff', 'tab.staff'],
  ['store', 'tab.store'],
];

/**
 * Бабушкино обучение в первое утро: по шагу на каждую часть утреннего окна. Подсвечивается то,
 * о чём она говорит (вкладка открывается сама), реплика — внизу экрана.
 */
type TourFocus = 'none' | 'title' | 'today' | 'tab' | 'open';
const TOUR: { key: TextKey; focus: TourFocus; tab?: Tab; mood?: 'happy' | 'sad' }[] = [
  { key: 'tour.hello', focus: 'none', mood: 'happy' },
  { key: 'tour.top', focus: 'title' },
  { key: 'tour.today', focus: 'today' },
  { key: 'tour.buy', focus: 'tab', tab: 'buy' },
  { key: 'tour.warehouse', focus: 'tab', tab: 'warehouse' },
  { key: 'tour.shelves', focus: 'tab', tab: 'shelves' },
  { key: 'tour.extras', focus: 'tab', tab: 'extras' },
  { key: 'tour.staff', focus: 'tab', tab: 'staff' },
  { key: 'tour.store', focus: 'tab', tab: 'store' },
  { key: 'tour.open', focus: 'open' },
  { key: 'tour.hall', focus: 'open', mood: 'happy' },
];

const productLabel = (id: ProductId) => `${PRODUCTS[id].icon} ${t(PRODUCTS[id].nameKey)}`;

/** Строка товара: крупная пиксельная иконка, название (и ценник), подпись и кнопки справа. */
function itemRow(pid: ProductId, opts: { price?: number; sub?: string; actions: HTMLElement[]; name?: string }): HTMLElement {
  const row = el('div', 'ui-item');
  const icon = el('img', 'ui-item-icon');
  icon.src = `assets/item_${pid}_0.png`;
  icon.alt = '';
  const body = el('div');
  const name = el('div', 'ui-item-name', opts.name ?? t(PRODUCTS[pid].nameKey));
  if (opts.price !== undefined) name.append(el('span', 'ui-tag', `${opts.price} 💰`));
  body.append(name);
  if (opts.sub) body.append(el('div', 'ui-item-sub', opts.sub));
  const actions = el('div', 'ui-item-actions');
  actions.append(...opts.actions);
  row.append(icon, body, actions);
  return row;
}

/** Строка с картинкой из игры (стойка, кофемашина, лежанка): название, ценник, подпись, кнопки. */
function artRow(texture: string, opts: { name: string; price?: number; sub?: string; actions: HTMLElement[] }): HTMLElement {
  const row = el('div', 'ui-item');
  const img = el('img', 'ui-item-art');
  img.src = `assets/${texture}.png`;
  img.alt = '';
  const body = el('div');
  const name = el('div', 'ui-item-name', opts.name);
  if (opts.price !== undefined) name.append(el('span', 'ui-tag', `${opts.price} 💰`));
  body.append(name);
  if (opts.sub) body.append(el('div', 'ui-item-sub', opts.sub));
  const actions = el('div', 'ui-item-actions');
  actions.append(...opts.actions);
  row.append(img, body, actions);
  return row;
}

/** «+10%» / «−20%» для множителя. */
const percent = (k: number): string => `${k >= 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%`;

/** Утро: закупка (товар едет на склад), раскладка со склада на полки, полки и цены. */
export function showMorning({ getState, setState, onOpen }: MorningOptions): void {
  const { card, close } = openModal();
  const deals = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, newDeal(SUPPLIERS[id])])) as Record<SupplierId, Deal>;
  const quotes = Object.fromEntries(SUPPLIER_IDS.map((id) => [id, SUPPLIERS[id].lines.hello])) as Record<SupplierId, TextKey>;
  let tab: Tab = 'buy';
  /** Вкладку только что переключили — содержимое въезжает сбоку (при покупках не дёргается). */
  let slideTab = false;
  /** Какая реплика сюжетного диалога сейчас на экране. */
  let storyLine = 0;
  /** Шаг бабушкиного обучения и его реплика внизу экрана (пока идёт обучение). */
  let tourStep = 0;
  let tourEl: HTMLElement | null = null;
  const endTour = () => {
    tourEl?.remove();
    tourEl = null;
    card.classList.remove('touring');
  };
  /** Бракованная партия, по которой ждём решения игрока. */
  let pendingBad: { sid: SupplierId; pid: ProductId; qty: number; price: number } | null = null;
  /** Утром по договорам приехал товар — показать строкой в сводке. */
  const morningDelivery = deliverContracts(getState(), (sid, pid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), pid));
  const delivered: Delivery[] = morningDelivery.deliveries;
  if (morningDelivery.deliveries.length) setState(morningDelivery.state);
  /** Автозаказ: утром склад сам пополняется до списка (по обычной цене, без брака). */
  const autoPlan = autoOrderPlan(getState(), (sid, pid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), pid));
  if (autoPlan?.lines.length) setState(applyReorder(getState(), autoPlan, () => false).state);
  /** Какой товар выбран для нового договора у каждого поставщика. */
  const contractPick: Partial<Record<SupplierId, ProductId>> = {};

  const update = (next: StoreState | null, feedback: 'tap' | 'success' | 'error' = 'tap') => {
    if (!next) return;
    setState(next);
    haptic[feedback]();
    sound[feedback === 'tap' ? 'tap' : feedback === 'success' ? 'coin' : 'bad']();
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
    const story = pendingStory(state);
    if (story) {
      card.replaceChildren(storyBox(state, story.kind, story.chapter));
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
    if (catOffer(state)) {
      card.replaceChildren(title, catOfferBox(state));
      return;
    }
    if (state.plan?.event && !state.plan.decided) {
      card.replaceChildren(title, eventBox(state, state.plan.event));
      return;
    }

    const touring = state.tourDone === false;
    const step = touring ? TOUR[Math.min(tourStep, TOUR.length - 1)] : null;
    if (step?.tab) tab = step.tab;

    const tabs = el('div', 'ui-tabs');
    for (const [id, label] of TABS) {
      tabs.append(
        button(
          t(label),
          () => {
            tab = id;
            slideTab = true;
            render();
          },
          `ui-tab${tab === id ? ' active' : ''}`,
        ),
      );
    }

    const body = el('div', slideTab ? 'ui-enter' : '');
    body.append(...{ buy: buyTab, warehouse: warehouseTab, shelves: shelvesTab, extras: extrasTab, staff: staffTab, store: storeTab }[tab](state));
    slideTab = false;
    const today = todoBox(state);
    const info = infos(
      ...deliveryLine(),
      ...fairLine(state),
      ...promoLine(state),
      goalLine(state),
      ...seasonLine(state),
      ...weatherLine(state),
      ...warLine(state),
      ...holidayLine(state),
      el('div', 'ui-muted', t('morning.guests', { r: state.rating.toFixed(1), n: guestsToday(state) })),
      billForecast(state),
    );
    const openButton = button(t('morning.open'), () => {
      endTour();
      close();
      onOpen();
    });
    card.replaceChildren(
      title,
      ...(touring ? [] : tipBox(state)),
      today,
      info,
      questsBox(state),
      ...weeklyBox(state),
      tabs,
      body,
      openButton,
    );
    if (!step) {
      endTour();
      return;
    }
    const focus = {
      none: null,
      title,
      today,
      tab: tabs.querySelector<HTMLElement>('.ui-tab.active'),
      open: openButton,
    }[step.focus];
    focus?.classList.add('ui-tour-focus');
    // То, о чём рассказывают вместе с подсвеченным: содержимое вкладки, сводка дня.
    const lit = { none: null, title: null, today: info, tab: body, open: null }[step.focus];
    lit?.classList.add('ui-tour-lit');
    showTour(step);
    if (focus) requestAnimationFrame(() => focus.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    else card.scrollTo({ top: 0 });
  };

  /** Реплика бабушки внизу экрана: «Дальше» — следующий шаг, «Пропустить» — сразу к делу. */
  const showTour = (step: (typeof TOUR)[number]) => {
    card.classList.add('touring');
    tourEl?.remove();
    tourEl = el('div', 'ui-tour');
    const last = tourStep >= TOUR.length - 1;
    const finish = () => {
      tourStep = 0;
      endTour();
      update({ ...getState(), tourDone: true }, last ? 'success' : 'tap');
    };
    const skip = button(t('tour.skip'), finish, 'ui-tour-skip');
    tourEl.append(
      el('div', 'ui-tour-head', t('tour.title', { n: tourStep + 1, total: TOUR.length })),
      dialogBox({
        portrait: `portrait_grandma${step.mood ? `_${step.mood}` : ''}`,
        name: t(CHARACTERS.grandma.nameKey),
        text: t(step.key),
        pitch: VOICE.grandma,
        nextLabel: last ? t('tour.done') : t('tour.next'),
        onNext: () => {
          if (last) {
            finish();
            return;
          }
          tourStep++;
          slideTab = true;
          render();
        },
      }),
    );
    if (!last) tourEl.append(skip);
    document.body.append(tourEl);
  };

  // ---------- Закупка ----------

  /** «Как в прошлый раз»: последняя закупка одной кнопкой, по сегодняшним ценам. */
  const reorderBox = (state: StoreState): HTMLElement[] => {
    const plan = reorderPlan(state, (sid, pid) => unitPrice(SUPPLIERS[sid], deals[sid], pid));
    const last = (state.purchases ?? []).filter((d) => d.day < state.day && d.lines.length).pop();
    if (!plan || !last) return [];
    const box = el('div', 'ui-box');
    const list = last.lines.map((l) => `${PRODUCTS[l.pid].icon}×${l.qty}`).join(' ');
    box.append(el('b', '', t('reorder.title')), el('div', 'ui-muted', t('reorder.text', { day: last.day, list })));
    if (!plan.lines.length) {
      box.append(el('div', 'ui-note', t('reorder.empty')));
      return [box];
    }
    if (plan.cut) box.append(el('div', 'ui-note', t('reorder.cut')));
    box.append(
      button(t('reorder.buy', { n: plan.total }), () => {
        const fresh = reorderPlan(getState(), (sid, pid) => unitPrice(SUPPLIERS[sid], deals[sid], pid));
        if (!fresh?.lines.length) return;
        const result = applyReorder(getState(), fresh, (line) => Math.random() < SUPPLIERS[line.sid].badChance);
        if (result.badLine) pendingBad = { sid: result.badLine.sid, pid: result.badLine.pid, qty: result.badLine.qty, price: result.badLine.price };
        update(result.state, result.badLine ? 'error' : 'success');
      }),
    );
    return [box];
  };

  /** Автозаказ (если куплен): список, вкл/выкл и «запомнить закупку». */
  const autoOrderBox = (state: StoreState): HTMLElement[] => {
    if (!hasUpgrade(state, 'autoOrder')) return [];
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('auto.title')));
    const auto = state.autoOrder;
    const list = auto?.lines.map((l) => `${PRODUCTS[l.pid].icon}×${l.qty}`).join(' ') ?? '';
    box.append(el('div', 'ui-muted', !auto ? t('auto.none') : auto.on ? t('auto.on', { list }) : t('auto.off', { list })));
    const chips = el('div', 'ui-chips');
    const canRemember = Boolean(rememberAutoOrder(state));
    chips.append(button(t('auto.remember'), () => update(rememberAutoOrder(getState()), 'success'), 'ui-chip', !canRemember));
    if (auto) chips.append(button(auto.on ? t('auto.disable') : t('auto.enable'), () => update(toggleAutoOrder(getState())), 'ui-chip'));
    box.append(chips);
    return [box];
  };

  const buyTab = (state: StoreState): HTMLElement[] => [
    el('div', 'ui-note', t('buy.note')),
    el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: warehouseCapacity(state) })),
    ...autoOrderBox(state),
    ...reorderBox(state),
    ...SUPPLIER_IDS.map((sid) => supplierBox(sid, state)),
    el('h3', '', t('tab.prices')),
    ...pricesTab(state),
  ];

  const supplierBox = (sid: SupplierId, state: StoreState) => {
    const s = SUPPLIERS[sid];
    const deal = deals[sid];
    const box = el('div', 'ui-box');
    box.append(who(sid, el('b', '', t(s.nameKey))), el('div', 'ui-quote', `«${t(quotes[sid])}»`));

    if (s.requires && !state.shelves.some((sh) => sh.kind === s.requires)) {
      box.append(el('div', 'ui-muted', t('buy.needShelf', { shelf: t(SHELF_KINDS[s.requires].nameKey) })));
      return box;
    }

    const free = warehouseCapacity(state) - warehouseCount(state);
    for (const pid of PRODUCT_IDS) {
      const price = unitPrice(s, deal, pid);
      if (price === null || !productAvailable(pid, state.day)) continue;
      const chips: HTMLElement[] = [];
      for (const qty of [1, 5]) {
        chips.push(
          button(
            `+${qty}`,
            () => {
              const bad = Math.random() < s.badChance;
              const bought = buyStock(getState(), pid, qty, price, bad);
              const next = bought && recordPurchase(bought, sid, pid, qty);
              if (bad && next) pendingBad = { sid, pid, qty, price };
              update(next, bad ? 'error' : 'tap');
            },
            // В первые дни кнопка «+5» у первого поставщика пульсирует — подсказка, с чего начать.
            state.day <= 2 && sid === SUPPLIER_IDS[0] && qty === 5 && pid === 'bread' ? 'ui-chip ui-pulse' : 'ui-chip',
            qty > free || price * qty > state.money,
          ),
        );
      }
      box.append(itemRow(pid, { price, sub: t('buy.inWarehouse', { n: warehouseOf(state, pid) }), actions: chips }));
    }

    box.append(contractRow(sid, state));
    const haggleRow = el('div', 'ui-haggle');
    if (deal.discount > 0) {
      haggleRow.append(el('b', '', t('buy.discount', { p: Math.round(deal.discount * 100) })));
    } else if (deal.angry) {
      haggleRow.append(el('span', '', t('buy.angryNote')));
    } else {
      haggleRow.append(el('b', '', t('buy.haggle')));
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

  /** Договор на неделю с этим поставщиком: что везут, или выбрать товар и сколько в день. */
  const contractRow = (sid: SupplierId, state: StoreState) => {
    const s = SUPPLIERS[sid];
    const box = el('div', 'ui-contract');
    box.append(el('b', '', t('contract.title')));
    const current = contractOf(state, sid);
    if (current) {
      const price = contractPrice(unitPrice(s, newDeal(s), current.pid) ?? 0);
      box.append(
        el('div', 'ui-muted', t('contract.active', { product: productLabel(current.pid), qty: current.qty, price, until: current.until })),
        button(t('contract.cancel'), () => update(cancelContract(getState(), sid)), 'ui-chip'),
      );
      return box;
    }
    box.append(el('div', 'ui-muted', t('contract.note')));
    const products = PRODUCT_IDS.filter((pid) => unitPrice(s, newDeal(s), pid) !== null && productAvailable(pid, state.day));
    const pick = contractPick[sid] ?? products[0];
    const chips = el('div', 'ui-chips');
    for (const pid of products) {
      chips.append(button(PRODUCTS[pid].icon, () => ((contractPick[sid] = pid), render()), `ui-chip${pid === pick ? ' active' : ''}`));
    }
    const qtys = el('div', 'ui-chips');
    for (const qty of CONTRACT_QTYS) {
      const price = contractPrice(unitPrice(s, newDeal(s), pick) ?? 0);
      qtys.append(button(`${t('contract.sign')} ×${qty} · ${qty * price} 💰`, () => update(signContract(getState(), sid, pick, qty), 'success'), 'ui-chip'));
    }
    box.append(chips, qtys);
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
    const expiring = expiringCount(state);
    if (expiring) {
      const box = el('div', 'ui-box');
      box.append(
        el('div', 'ui-note', t('markdown.note', { n: expiring })),
        button(t('markdown.button', { n: expiring }), () => update(markdownExpiring(getState()).state, 'success'), 'ui-chip'),
      );
      out.push(box);
    }
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

      const shelfIndex = state.shelves.findIndex((sh) => canPlace(pid, sh) && shelfFree(sh) > 0);
      const hasShelfKind = state.shelves.some((sh) => canPlace(pid, sh));
      const sub = [t('buy.inWarehouse', { n: units.length }), extra].filter(Boolean).join(' · ');
      const action = hasShelfKind
        ? button(
            shelfIndex >= 0 ? t('warehouse.toShelf') : t('warehouse.shelfFull'),
            () => update(moveToShelf(getState(), shelfIndex, pid).state),
            'ui-chip',
            shelfIndex < 0,
          )
        : el('span', 'ui-muted', t('warehouse.noShelf', { shelf: t(SHELF_KINDS[PRODUCTS[pid].category].nameKey) }));
      box.append(itemRow(pid, { sub, actions: [action] }));
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
      // Звёздочка: грузчик пополняет такие полки в первую очередь.
      box.append(
        button(
          shelf.priority ? t('shelf.priorityOn') : t('shelf.priority'),
          () => update({ ...getState(), shelves: getState().shelves.map((sh, j) => (j === i ? { ...sh, priority: !sh.priority } : sh)) }),
          `ui-chip${shelf.priority ? ' active' : ''}`,
        ),
      );
      if (shelf.broken) {
        const cost = fridgeRepairCost(state.level);
        box.append(
          el('div', 'ui-note', `🔧 ${t('shelves.broken')}`),
          button(t('shelves.repair', { cost }), () => update(repairShelf(getState(), i), 'success'), 'ui-btn', state.money < cost),
        );
      }

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

  // ---------- Бесконечная игра: сезон, задания, звание, альбом ----------

  /** Погода дня — только если не ясно. */
  const holidayLine = (state: StoreState): HTMLElement[] => {
    const holiday = holidayFor(state.day);
    return holiday === 'march8' || holiday === 'halloween' ? [el('div', 'ui-muted', t(`holiday.${holiday}`))] : [];
  };

  /** Прогноз: что сегодня берут чаще и реже, сколько гостей; и погода на завтра. */
  const weatherLine = (state: StoreState): HTMLElement[] => {
    const weather = weatherFor(state.day);
    const effect = WEATHER_EFFECTS[weather];
    const sellable = sellableProducts(state);
    const icons = (keep: (k: number) => boolean) =>
      sellable
        .filter((id) => keep(weatherDemand(weather, id)))
        .map((id) => PRODUCTS[id].icon)
        .join('');
    const parts = [t('forecast.today', { icon: effect.icon, name: t(`weather.name.${weather}`) })];
    const more = icons((k) => k > 1);
    const less = icons((k) => k < 1);
    if (more) parts.push(t('forecast.more', { list: more }));
    if (less) parts.push(t('forecast.less', { list: less }));
    if (effect.guests !== 1) parts.push(t('forecast.guests', { n: percent(effect.guests) }));
    if (hasUpgrade(state, 'coffee') && effect.coffee !== 1) parts.push(t('forecast.coffee', { n: percent(effect.coffee) }));
    const tomorrow = weatherFor(state.day + 1);
    parts.push(t('forecast.tomorrow', { icon: WEATHER_EFFECTS[tomorrow].icon, name: t(`weather.name.${tomorrow}`) }));
    return [el('div', 'ui-muted', parts.join(' · '))];
  };

  /** Идёт ценовая война: какой товар, почём у Эдуарда и чья берёт. */
  const warLine = (state: StoreState): HTMLElement[] => {
    const war = activeWar(state);
    if (!war) return [];
    const ours = state.prices[war.product] <= war.price;
    const line = el(
      'div',
      'ui-muted',
      `${t('war.line', { product: productLabel(war.product), price: war.price, n: war.until - state.day + 1 })} — ${t(ours ? 'war.win' : 'war.lose')}`,
    );
    if (!ours) line.style.color = '#b13e53';
    return [line];
  };


  const seasonLine = (state: StoreState): HTMLElement[] => {
    const season = seasonFor(state.day);
    if (season) {
      return [el('div', 'ui-note', t('season.banner', { icon: season.icon, name: t(season.nameKey), desc: t(season.descKey) }))];
    }
    for (let d = 1; d <= 3; d++) {
      const next = seasonFor(state.day + d);
      if (next) return [el('div', 'ui-muted', t('season.soon', { n: d, icon: next.icon, name: t(next.nameKey) }))];
    }
    return [];
  };

  const questText = (q: Quest) =>
    t(QUEST_TEXT[q.kind], { n: q.target, product: q.product ? productLabel(q.product) : '' });

  const questsBox = (state: StoreState) => {
    const quests = state.plan?.quests ?? [];
    const box = el('div', 'ui-box');
    if (!quests.length) return el('div');
    box.append(el('b', '', t('quest.title')));
    for (const q of quests) {
      const r = el('div', 'ui-row');
      r.append(el('span', '', `• ${questText(q)}`), el('span', 'ui-muted', t('quest.reward', { n: q.reward })));
      box.append(r);
    }
    box.append(el('div', 'ui-muted', t('quest.allBonus', { r: ALL_QUESTS_RATING })));
    return box;
  };

  const rankBox = (state: StoreState) => {
    const n = rankOf(state.totalRevenue);
    const box = el('div', 'ui-box');
    box.append(
      el('b', '', t('rank.title', { name: rankName(n, t) })),
      el(
        'div',
        'ui-muted',
        t('rank.progress', { n: state.totalRevenue, next: rankThreshold(n + 1), bonus: Math.round(n * RANK_GUESTS * 100) }),
      ),
    );
    return box;
  };

  /** Оформление: по каждому виду — «как было», купленное (переставить) и что можно купить. */
  /** Постоянные покупатели: любимый товар, привычка и доверие сердечками. */
  const regularsBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('regular.title')), el('div', 'ui-muted', t('regular.note')));
    for (const r of REGULARS) {
      const known = met(state, r);
      const { loyalty, awayUntil } = regularState(state, r.id);
      const sub = !known ? t('regular.unknown') : awayUntil >= state.day ? t('regular.away', { n: awayUntil + 1 }) : t(r.habitKey);
      const hearts = known ? el('span', 'ui-hearts', '❤'.repeat(loyalty) + '♡'.repeat(MAX_LOYALTY - loyalty)) : el('span');
      box.append(itemRow(r.favorite, { sub, actions: [hearts], name: known ? t(r.nameKey) : '???' }));
    }
    return box;
  };

  // ---------- Уголки: сладости, кофе, печь, кот и улучшения ----------

  const extrasTab = (state: StoreState): HTMLElement[] => [rackBox(state), coffeeBox(state), ovenBox(state), catBox(state), upgradesBox(state)];

  const rackBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const rack = rackOf(state);
    const cap = rackCapacity(state);
    const free = cap - rack.stock;
    box.append(el('b', '', t('rack.title')), el('div', 'ui-muted', t('rack.note', { price: CANDY_PRICE, cost: CANDY_COST })));
    const amounts = [...new Set([Math.min(6, free), free])].filter((n) => n > 0);
    const actions: HTMLElement[] = amounts.map((n) =>
      button(t('rack.refill', { n, cost: n * CANDY_COST }), () => update(refillRack(getState(), n), 'success'), 'ui-chip', state.money < n * CANDY_COST),
    );
    if (!free) actions.push(el('span', 'ui-tag', t('rack.full')));
    box.append(artRow('candy_rack', { name: t('rack.stock', { n: rack.stock, max: cap }), actions }));
    const next = nextRack(state);
    if (next) {
      box.append(
        artRow('candy', {
          name: t('rack.upgrade', { cap: next.capacity, p: Math.round(next.chance * 100) }),
          price: next.cost,
          actions: [button(t('rack.buy'), () => update(upgradeRack(getState()), 'success'), 'ui-chip', state.money < next.cost)],
        }),
      );
    } else box.append(el('div', 'ui-muted', t('rack.max')));
    return box;
  };

  const coffeeBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('coffee.title')));
    if (!hasUpgrade(state, 'coffee')) {
      box.append(el('div', 'ui-muted', t('coffee.locked')));
      return box;
    }
    const chance = Math.min(0.6, COFFEE_CHANCE * WEATHER_EFFECTS[weatherFor(state.day)].coffee);
    box.append(el('div', 'ui-muted', t('coffee.note', { price: coffeePrice(state), cost: CUP_COST, n: Math.max(2, Math.round(1 / chance)) })));
    const free = CUPS_MAX - cupsOf(state);
    const amounts = [...new Set([Math.min(10, free), free])].filter((n) => n > 0);
    const actions = amounts.map((n) =>
      button(t('coffee.buy', { n, cost: n * CUP_COST }), () => update(buyCups(getState(), n), 'success'), 'ui-chip', state.money < n * CUP_COST),
    );
    box.append(artRow(coffeeSprite(state), { name: t('coffee.cups', { n: cupsOf(state), max: CUPS_MAX }), actions }));
    return box;
  };

  const ovenBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('oven.title')));
    box.append(
      el('div', 'ui-muted', hasUpgrade(state, 'oven') ? t('oven.note', { n: ovenBatch(state), cost: ovenBatchCost(state), s: ovenBake(state) }) : t('oven.locked')),
    );
    return box;
  };

  /** Кот: сытость, удача, кормление и лежанки. */
  const catBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const cat = state.cat;
    if (!cat) {
      box.append(el('b', '', '🐱'), el('div', 'ui-muted', state.day < CAT_FROM_DAY ? t('cat.none', { n: CAT_FROM_DAY }) : t('cat.later')));
      return box;
    }
    const luck = Math.round((cat.bed ? CAT_BEDS[cat.bed].luck : CAT_BASE_LUCK) * 100);
    const status = catAway(state) ? t('cat.away') : fedToday(state) ? t('cat.fed', { n: luck }) : t('cat.hungry', { n: Math.round(luck / 2) });
    const fed = fedToday(state);
    box.append(
      artRow(catAway(state) ? 'cat' : 'cat_sit', {
        name: `🐱 ${cat.name}`,
        sub: status,
        actions: [button(fed ? t('cat.fedDone') : t('cat.feed', { n: FEED_COST }), () => update(feedCat(getState()), 'success'), 'ui-chip', fed || state.money < FEED_COST)],
      }),
      el('div', 'ui-decor-kind', t('cat.bed.title')),
    );
    for (const id of CAT_BED_IDS) {
      const bed = CAT_BEDS[id];
      const owned = cat.beds.includes(id);
      const active = cat.bed === id;
      const action = active
        ? el('span', 'ui-tag', '✓')
        : owned
          ? button(t('decor.put'), () => update(setBed(getState(), id)), 'ui-chip')
          : button(t('upgrade.buy'), () => update(buyBed(getState(), id), 'success'), 'ui-chip', state.money < bed.price);
      box.append(
        artRow(bed.texture, {
          name: t(bed.nameKey),
          price: owned ? undefined : bed.price,
          sub: t('cat.bed.luck', { n: Math.round(bed.luck * 100) }),
          actions: [action],
        }),
      );
    }
    box.append(el('div', 'ui-muted', t('cat.starsSoon')));
    return box;
  };

  /** Рыжий кот у входа: оставить и назвать или отказаться (спросит через неделю). */
  const catOfferBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    const names = t('cat.names').split(',');
    const input = el('input', 'ui-input');
    input.value = names[state.day % names.length];
    input.maxLength = CAT_NAME_MAX;
    const art = el('img', 'ui-item-art');
    art.src = 'assets/cat_sit.png';
    art.alt = '';
    art.style.cssText = 'width:64px;height:72px;display:block;margin:4px auto';
    box.append(
      el('h3', '', t('cat.offer.title')),
      art,
      el('p', '', t('cat.offer.text')),
      el('div', 'ui-muted', t('cat.offer.note', { n: FEED_COST })),
      el('b', '', t('cat.offer.name')),
      input,
      button(t('cat.offer.yes'), () => update(adoptCat(getState(), input.value || names[0]), 'success')),
      button(t('cat.offer.no'), () => update(declineCat(getState())), 'ui-btn secondary'),
    );
    return box;
  };

  /** Улучшения магазина: касса, кофемашина, печь, ночная смена. */
  const upgradesBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('upgrade.title')));
    for (const id of UPGRADE_IDS) {
      const up = UPGRADES[id];
      const owned = hasUpgrade(state, id);
      const row = el('div', 'ui-item');
      row.append(el('div', 'ui-ad-icon', up.icon));
      const body = el('div');
      const name = el('div', 'ui-item-name', t(up.nameKey));
      if (!owned) name.append(el('span', 'ui-tag', `${up.price} 💰`));
      const sub = state.level < up.minLevel ? t('upgrade.needLevel', { name: t(STORE_LEVELS[up.minLevel].nameKey) }) : t(up.descKey);
      body.append(name, el('div', 'ui-item-sub', sub));
      const actions = el('div', 'ui-item-actions');
      actions.append(
        owned
          ? el('span', 'ui-tag', '✓')
          : button(t('upgrade.buy'), () => update(buyUpgrade(getState(), id), 'success'), 'ui-chip', state.level < up.minLevel || state.money < up.price),
      );
      row.append(body, actions);
      box.append(row);
    }
    return box;
  };

  /** Картинка модели в списке оборудования (у кого нет своей картинки — значок). */
  const gearArt = (state: StoreState, id: GearId, tier: number): string | null => {
    // Кассу показываем крупным планом: сам стол слишком длинный для строки.
    const at = { ...state, gear: { ...state.gear, [id]: tier } };
    const art: Partial<Record<GearId, string>> = {
      register: `counter_icon${tier}`,
      bin: tier ? `bin_t${tier}_0` : 'bin0',
      coffee: coffeeSprite(at),
      oven: ovenSprite(at),
    };
    return art[id] ?? null;
  };

  /** Оборудование: по строке на каждую линейку — что стоит, на что поменять, что это даст. */
  const gearBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('gear.title')), el('div', 'ui-muted', t('gear.note')));
    for (const id of GEAR_IDS) {
      const gear = GEAR[id];
      const tier = gearTier(state, id);
      const now = gear.models[tier];
      const next = nextGear(state, id);
      const needs = gear.needs && !hasUpgrade(state, gear.needs);
      const row = el('div', 'ui-item');
      const texture = gearArt(state, id, next && !needs ? tier + 1 : tier);
      if (texture) {
        const img = el('img', 'ui-item-art');
        img.src = `assets/${texture}.png`;
        img.alt = '';
        row.append(img);
      } else row.append(el('div', 'ui-ad-icon', gear.icon));
      const body = el('div');
      const name = el('div', 'ui-item-name', t(gear.nameKey));
      const actions = el('div', 'ui-item-actions');
      if (needs) {
        body.append(name, el('div', 'ui-item-sub', t(`gear.needs.${gear.needs}` as TextKey)));
      } else if (!next) {
        body.append(name, el('div', 'ui-item-sub', `${t(now.nameKey)} — ${t(now.effectKey)}`));
        actions.append(el('span', 'ui-tag', t('gear.max')));
      } else {
        name.append(el('span', 'ui-tag', `${next.price} 💰`));
        const locked = state.level < next.minLevel;
        body.append(
          name,
          el('div', 'ui-item-sub', t('gear.upgrade', { from: t(now.nameKey), to: t(next.nameKey) })),
          el('div', 'ui-item-sub', locked ? t('upgrade.needLevel', { name: t(STORE_LEVELS[next.minLevel].nameKey) }) : t(next.effectKey)),
        );
        actions.append(
          button(t('gear.buy'), () => update(upgradeGear(getState(), id), 'success'), 'ui-chip', !gearAvailable(state, id) || state.money < next.price),
        );
      }
      row.append(body, actions);
      box.append(row);
    }
    return box;
  };

  /** Реклама: карточка на каждый вид — иконка, что даёт, цена и кнопка. */
  const adsBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('ads.title')), el('div', 'ui-muted', t('ads.note')));
    const running = activeAd(state);
    for (const id of AD_IDS) {
      const ad = ADS[id];
      const row = el('div', 'ui-item');
      row.append(el('div', 'ui-ad-icon', ad.icon));
      const body = el('div');
      const name = el('div', 'ui-item-name', t(ad.nameKey));
      name.append(el('span', 'ui-tag', `${adPrice(state, id)} 💰`));
      body.append(name, el('div', 'ui-item-sub', running?.id === id ? t('ads.active', { n: state.ads?.until ?? state.day }) : t(ad.descKey)));
      const action = button(
        running?.id === id ? '✓' : t('ads.order'),
        () => update(buyAd(getState(), id), 'success'),
        'ui-chip',
        Boolean(running) || state.money < adPrice(state, id),
      );
      const actions = el('div', 'ui-item-actions');
      actions.append(action);
      row.append(body, actions);
      box.append(row);
    }
    return box;
  };

  const decorBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('decor.title')), el('div', 'ui-muted', t('decor.note')));
    for (const kind of DECOR_KINDS) {
      box.append(el('div', 'ui-decor-kind', t(`decor.kind.${kind}` as TextKey)));
      const grid = el('div', 'ui-decor-grid');
      grid.append(decorCard(state, kind, null));
      for (const item of DECOR.filter((d) => d.kind === kind)) grid.append(decorCard(state, kind, item));
      box.append(grid);
    }
    return box;
  };

  /** Карточка оформления: превью, название и что будет по нажатию (купить, поставить, уже стоит). */
  const decorCard = (state: StoreState, kind: DecorKind, item: DecorItem | null) => {
    const owned = !item || state.decor.owned.includes(item.id);
    const active = item ? state.decor.active[kind] === item.id : !state.decor.active[kind];
    const premium = Boolean(item && item.price === undefined);
    const canBuy = item?.price !== undefined && state.money >= item.price;
    const card = button(
      '',
      () => {
        if (active) return;
        if (owned) update(setDecor(getState(), kind, item?.id ?? null));
        else if (item) update(buyDecor(getState(), item.id), 'success');
      },
      `ui-decor${active ? ' active' : ''}${premium ? ' premium' : ''}`,
      !owned && (premium || !canBuy),
    );
    const preview = el('div', 'ui-decor-preview');
    if (!item) preview.textContent = '↺';
    else if (item.color !== undefined) {
      const hex = `#${item.color.toString(16).padStart(6, '0')}`;
      preview.style.background = `url(assets/wall.png) 0 0 / 32px 32px, ${hex}`;
      preview.style.backgroundBlendMode = 'multiply';
    } else if (kind === 'floor') preview.style.backgroundImage = `url(assets/${item.texture}.png)`;
    else {
      const img = el('img');
      img.src = `assets/${item.texture}.png`;
      img.alt = '';
      preview.append(img);
    }
    const status = active
      ? `✓ ${t('decor.on')}`
      : owned
        ? t('decor.put')
        : item?.price !== undefined
          ? `${item.price} 💰`
          : t('decor.starsSoon', { n: item?.stars ?? 0 });
    card.append(preview, el('div', 'ui-decor-name', item ? t(item.nameKey) : t('decor.none')), el('div', 'ui-decor-status', status));
    return card;
  };


  const albumBox = (state: StoreState) => {
    const box = el('div', 'ui-box');
    box.append(
      el('b', '', t('album.title', { n: state.album.length, max: RARE_GUESTS.length })),
      el('div', 'ui-muted', t('album.note', { money: ALBUM_REWARD.money, r: ALBUM_REWARD.rating })),
    );
    const grid = el('div', 'ui-chips');
    for (const g of RARE_GUESTS) {
      const got = state.album.includes(g.id);
      grid.append(el('span', got ? 'ui-chip' : 'ui-chip ui-chip-off', got ? `${g.icon} ${t(g.nameKey)}` : `❔ ${t('album.unknown')}`));
    }
    box.append(grid);
    return box;
  };

  // ---------- Сюжет и события ----------

  /** Сводка утра одной аккуратной плашкой. */
  const infos = (...lines: HTMLElement[]) => {
    const box = el('div', 'ui-infos');
    box.append(...lines);
    return box;
  };

  /** Карточка «Новое»: одна механика за раз, показывается один раз. */
  const tipBox = (state: StoreState): HTMLElement[] => {
    const tip = pendingTip(state);
    if (!tip) return [];
    const box = el('div', 'ui-box ui-tip');
    box.append(
      el('b', '', `${t('tip.new')}: ${TIP_ICONS[tip]} ${t(`tip.${tip}.title` as TextKey)}`),
      el('div', '', t(`tip.${tip}.text` as TextKey)),
      button(t('tip.ok'), () => update(seeTip(getState(), tip)), 'ui-chip'),
    );
    return [box];
  };

  /** «Главное на сегодня»: что нужно сделать утром — с кнопкой прямо в строке. */
  const todoBox = (state: StoreState) => {
    const box = el('div', 'ui-box ui-todo');
    box.append(el('b', '', t('todo.title')));
    const row = (text: string, action?: HTMLElement) => {
      const r = el('div', 'ui-todo-row');
      r.append(el('span', '', text));
      if (action) r.append(action);
      box.append(r);
    };
    const sellable = sellableProducts(state);
    // Пустые полки, когда на складе есть их товар.
    const emptyWithStock = sellable.filter((id) => onShelves(state, id) === 0 && warehouseOf(state, id) > 0 && state.shelves.some((sh) => canPlace(id, sh) && shelfFree(sh) > 0));
    if (emptyWithStock.length) {
      row(
        t('todo.stock', { list: emptyWithStock.map((id) => PRODUCTS[id].icon).join('') }),
        button(t('todo.stockBtn'), () => {
          let next = getState();
          next.shelves.forEach((_, i) => (next = moveToShelf(next, i).state));
          update(next, 'success');
        }, 'ui-chip'),
      );
    }
    // Мало товара на сегодня: меньше, чем примерно разберут за день.
    const perProduct = (guestsToday(state) * 1.5) / Math.max(1, sellable.length);
    const low = sellable.filter((id) => onShelves(state, id) + warehouseOf(state, id) < perProduct * 0.6);
    if (low.length) {
      row(
        t('todo.low', { list: low.map((id) => PRODUCTS[id].icon).join('') }),
        button(t('todo.lowBtn'), () => {
          tab = 'buy';
          slideTab = true;
          render();
        }, 'ui-chip'),
      );
    }
    const expiring = expiringCount(state);
    if (expiring) row(t('todo.expiring', { n: expiring }), button(t('todo.expiringBtn'), () => update(markdownExpiring(getState()).state, 'success'), 'ui-chip'));
    state.shelves.forEach((sh, i) => {
      if (!sh.broken) return;
      const cost = fridgeRepairCost(state.level);
      row(t('todo.fridge', { shelf: t(SHELF_KINDS[sh.kind].nameKey) }), button(t('todo.fridgeBtn', { n: cost }), () => update(repairShelf(getState(), i), 'success'), 'ui-chip', state.money < cost));
    });
    if (state.cat && !fedToday(state)) {
      row(t('todo.cat', { name: state.cat.name }), button(t('todo.catBtn', { n: FEED_COST }), () => update(feedCat(getState()), 'success'), 'ui-chip', state.money < FEED_COST));
    }
    const rack = rackOf(state);
    const rackFree = rackCapacity(state) - rack.stock;
    if (rack.stock <= rackCapacity(state) / 3 && rackFree > 0) {
      row(t('todo.rack', { n: rack.stock }), button(t('todo.rackBtn', { n: rackFree * CANDY_COST }), () => update(refillRack(getState(), rackFree), 'success'), 'ui-chip', state.money < rackFree * CANDY_COST));
    }
    if (hasUpgrade(state, 'coffee') && cupsOf(state) < 8) {
      const n = CUPS_MAX - cupsOf(state);
      row(t('todo.cups', { n: cupsOf(state) }), button(t('todo.cupsBtn', { n, cost: n * CUP_COST }), () => update(buyCups(getState(), n), 'success'), 'ui-chip', state.money < n * CUP_COST));
    }
    if (box.children.length === 1) box.append(el('div', 'ui-muted', t('todo.done')));
    return box;
  };

  const deliveryLine = (): HTMLElement[] => {
    if (!delivered.length) return autoLine();
    const got = delivered.filter((d) => d.qty > 0);
    const lines: HTMLElement[] = [];
    if (got.length) {
      lines.push(
        el('div', 'ui-muted', t('contract.delivered', { list: got.map((d) => `${PRODUCTS[d.pid].icon}×${d.qty}`).join(' '), cost: got.reduce((sum, d) => sum + d.cost, 0) })),
      );
    }
    if (delivered.some((d) => d.skipped)) lines.push(el('div', 'ui-note', t('contract.skipped')));
    return [...lines, ...autoLine()];
  };

  const autoLine = (): HTMLElement[] => {
    if (!autoPlan) return [];
    const lines: HTMLElement[] = [];
    if (autoPlan.lines.length)
      lines.push(el('div', 'ui-muted', t('auto.delivered', { list: autoPlan.lines.map((l) => `${PRODUCTS[l.pid].icon}×${l.qty}`).join(' '), cost: autoPlan.total })));
    if (autoPlan.cut) lines.push(el('div', 'ui-note', t('auto.cut')));
    return lines;
  };

  const fairLine = (state: StoreState): HTMLElement[] => {
    if (isFairDay(state.day)) return [el('div', 'ui-note', t('fair.today'))];
    const n = daysToFair(state.day);
    return n > 0 && n <= 2 ? [el('div', 'ui-muted', t('fair.soon', { n }))] : [];
  };

  const promoLine = (state: StoreState): HTMLElement[] => {
    const promo = activePromo(state);
    return promo ? [el('div', 'ui-muted', t('promo.active', { product: productLabel(promo.product), kind: t(`promo.kind.${promo.kind}` as TextKey) }))] : [];
  };

  /** Испытания недели: прогресс каждой цели и награда. */
  const weeklyBox = (state: StoreState): HTMLElement[] => {
    const weekly = state.weekly;
    if (!weekly) return [];
    const box = el('div', 'ui-box');
    box.append(el('b', '', t('weekly.title', { day: weeklyUntil(state) })));
    for (const c of weekly.challenges as Challenge[]) {
      const r = el('div', 'ui-row');
      const text = t(WEEKLY_TEXT[c.kind], { n: c.target, product: c.product ? productLabel(c.product) : '' });
      r.append(el('span', '', `${c.done ? '✅' : '•'} ${text}`), el('span', 'ui-muted', c.done ? `+${c.reward} 💰` : `${c.progress}/${c.target} · +${c.reward} 💰`));
      box.append(r);
    }
    return [box];
  };

  const goalLine = (state: StoreState) => {
    const chapter = currentChapter(state);
    const text = chapter
      ? t('story.goalLine', { title: t(chapter.titleKey), goal: t(chapter.goalKey, chapter.progress(state)) })
      : t('story.free');
    return el('div', 'ui-note', text);
  };

  const storyBox = (state: StoreState, kind: 'intro' | 'outro', chapter: Chapter) => {
    const lines = kind === 'intro' ? chapter.intro : chapter.outro;
    const current = lines[Math.min(storyLine, lines.length - 1)];
    const speaker = CHARACTERS[current.who];
    const last = storyLine >= lines.length - 1;
    const after: HTMLElement[] = [];
    if (last && kind === 'intro') after.push(el('div', 'ui-note', `🎯 ${t(chapter.goalKey, chapter.progress(state))}`));
    if (last && kind === 'outro') {
      const reward = [
        chapter.reward.money ? `+${chapter.reward.money} 💰` : '',
        chapter.reward.rating ? `+${chapter.reward.rating}★` : '',
      ]
        .filter(Boolean)
        .join(' ');
      after.push(el('div', 'ui-note', t('story.reward', { reward })));
    }
    // Картинка — на первой реплике главы и на последней реплике финала.
    const art = kind === 'intro' ? (storyLine === 0 ? chapter.introArt : undefined) : last ? chapter.outroArt : undefined;
    return dialogBox({
      caption: t('story.chapter', { n: state.story.chapter + 1, title: t(chapter.titleKey) }),
      art,
      portrait: `portrait_${current.who}${current.mood ? `_${current.mood}` : ''}`,
      name: t(speaker.nameKey),
      text: `«${t(current.key)}»`,
      pitch: VOICE[current.who],
      after,
      nextLabel: t('story.next'),
      onNext: () => {
        if (!last) {
          storyLine++;
          render();
          return;
        }
        storyLine = 0;
        update(kind === 'intro' ? finishIntro(getState()) : finishChapter(getState()), kind === 'outro' ? 'success' : 'tap');
      },
    });
  };

  const eventBox = (state: StoreState, event: MorningEvent) => {
    const box = el('div', 'ui-box');
    const answer = (accept: boolean) => update(answerEvent(getState(), accept), accept ? 'success' : 'tap');
    switch (event.kind) {
      case 'order': {
        const client = CLIENTS[event.client];
        const have = warehouseOf(state, event.product) + onShelves(state, event.product);
        box.append(
          el('h3', '', `🍽 ${t('event.order.title')}`),
          who(CLIENT_PORTRAIT[event.client], el('b', '', t(client.nameKey))),
          el('p', '', `«${t(client.askKey, { qty: event.qty, product: productLabel(event.product), pay: event.pay })}»`),
          el('div', 'ui-muted', `${t('buy.inWarehouse', { n: have })} · ${t('event.order.note')}`),
          button(t('event.order.accept'), () => answer(true)),
          button(t('event.order.decline'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'deal': {
        const free = warehouseCapacity(state) - warehouseCount(state);
        box.append(
          el('h3', '', `💸 ${t('event.deal.title')}`),
          el(
            'p',
            '',
            t('event.deal.text', {
              supplier: t(SUPPLIERS[event.supplier].nameKey),
              qty: event.qty,
              product: productLabel(event.product),
              price: event.price,
            }),
          ),
          el('div', 'ui-muted', t('warehouse.capacity', { n: warehouseCount(state), max: warehouseCapacity(state) })),
          button(t('event.deal.accept'), () => answer(true), 'ui-btn', free <= 0 || state.money < event.price),
          button(t('event.deal.decline'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'fridgeBroken':
        box.append(
          el('h3', '', `🔧 ${t('event.fridge.title')}`),
          el('p', '', t('event.fridge.text', { shelf: t(SHELF_KINDS[state.shelves[event.shelf].kind].nameKey) })),
          button(t('event.fridge.repair', { cost: event.cost }), () => answer(true), 'ui-btn', state.money < event.cost),
          button(t('event.fridge.later'), () => answer(false), 'ui-btn secondary'),
          el('div', 'ui-muted', t('event.fridge.laterNote')),
        );
        break;
      case 'sick': {
        const m = staffOf(state, event.role);
        box.append(
          el('h3', '', `🤒 ${t('event.sick.title')}`),
          el('p', '', t('event.sick.text', { name: m ? staffName(m.name) : '', role: t(STAFF_ROLES[event.role].nameKey) })),
          button(t('event.ok'), () => answer(true)),
        );
        break;
      }
      case 'priceWar': {
        const running = Boolean(activeAd(state));
        const adCost = adPrice(state, 'banner');
        const reply = (answer: 'match' | 'ad' | 'wait') => update(answerWar(getState(), event, answer), answer === 'wait' ? 'tap' : 'success');
        box.append(
          el('h3', '', `⚔️ ${t('event.war.title')}`),
          who('eduard_angry', el('b', '', t(CHARACTERS.eduard.nameKey))),
          el('p', '', t('event.war.text', { product: productLabel(event.product), price: event.price })),
          el('div', 'ui-muted', t('event.war.note', { n: event.days, mine: state.prices[event.product] })),
          button(t('event.war.match', { price: event.price }), () => reply('match')),
          el('div', 'ui-muted', t('event.war.matchHint')),
          button(running ? t('event.war.adRunning') : t('event.war.ad', { price: adCost }), () => reply('ad'), 'ui-btn', !running && state.money < adCost),
          el('div', 'ui-muted', t('event.war.adHint')),
          button(t('event.war.wait'), () => reply('wait'), 'ui-btn secondary'),
          el('div', 'ui-muted', t('event.war.waitHint')),
        );
        break;
      }
      case 'poach': {
        const m = staffOf(state, event.role);
        const name = m ? staffName(m.name) : '';
        box.append(
          el('h3', '', `🕴️ ${t('event.poach.title')}`),
          who('eduard_happy', el('b', '', t(CHARACTERS.eduard.nameKey))),
          el('p', '', t('event.poach.text', { name, wage: event.wage })),
          el('div', 'ui-muted', t('event.poach.note', { name, role: t(STAFF_ROLES[event.role].nameKey), now: m?.wage ?? 0 })),
          button(t('event.poach.keep', { wage: event.wage }), () => answer(true)),
          button(t('event.poach.let'), () => answer(false), 'ui-btn secondary'),
        );
        break;
      }
      case 'snitch':
        box.append(
          el('h3', '', `📮 ${t('event.snitch.title')}`),
          who('eduard_angry', el('b', '', t(CHARACTERS.eduard.nameKey))),
          el('p', '', t('event.snitch.text')),
          button(t('event.ok'), () => answer(true)),
        );
        break;
      case 'inspection':
        box.append(
          el('h3', '', `📋 ${t('event.inspection.title')}`),
          el('p', '', t('event.inspection.text')),
          button(t('event.ok'), () => answer(true)),
        );
        break;
    }
    return box;
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

  /** Кассир: сколько покупателей в день пробьёт (с терминалом — быстрее). */
  const isCashier = (m: StaffMember) => isCashierRole(m.role);
  const perDay = (state: StoreState, m: StaffMember) => servePerDay(withUpgrades(state, cashierScan(m)));
  const traitLine = (m: StaffMember) => {
    const stars = '★'.repeat(m.skill).padEnd(3, '☆');
    const trait = m.trait ? ` · ${t(TRAITS[m.trait].nameKey)}: ${t(TRAITS[m.trait].descKey)}` : '';
    const speed = isCashier(m) ? ` · ${t('staffTab.perDay', { n: perDay(getState(), m) })}` : '';
    return `${stars}${speed}${trait}`;
  };

  const staffTab = (state: StoreState): HTMLElement[] => {
    const limit = staffLimit(state);
    const lvl = ownerLevel(state.ownerServed);
    const next = ownerNextLevelAt(state.ownerServed);
    const scan = ownerScan(state.ownerServed);
    const skill = el('div', 'ui-box');
    skill.append(
      el('b', '', `${t('staffTab.ownerSkill')} ${'★'.repeat(lvl).padEnd(5, '☆')}`),
      el(
        'div',
        'ui-muted',
        next === null
          ? t('staffTab.ownerSkillMax', { s: scan.item.toFixed(2) })
          : t('staffTab.ownerSkillNext', { n: state.ownerServed, next, s: scan.item.toFixed(2) }),
      ),
      el('div', 'ui-muted', t('staffTab.ownerPerDay', { n: servePerDay(withUpgrades(state, scan)) })),
    );
    const out: HTMLElement[] = [
      skill,
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
      // «Тормоз» за кассой упирает весь магазин в потолок — предупредить и предложить курсы.
      if (isCashier(m) && m.trait === 'slowpoke') {
        const warn = el('div', 'ui-note', t('staffTab.slowWarn', { n: perDay(state, m) }));
        warn.style.color = '#b13e53';
        box.append(warn);
      }
      const cost = trainingCost(m);
      if (cost !== null) {
        box.append(
          button(
            m.skill < 3 ? t('staffTab.train', { n: cost }) : t('staffTab.fixSlow', { n: cost }),
            () => update(train(getState(), m.role), 'success'),
            'ui-chip',
            state.money < cost,
          ),
        );
      }
      out.push(box);
    }

    const full = state.staff.length >= limit;
    out.push(el('h3', '', t('staffTab.search')), el('div', 'ui-muted', t('staffTab.searchNote', { cost: JOB_AD_COST })));
    const roles = el('div', 'ui-chips');
    for (const role of STAFF_ROLE_IDS) {
      // Кассир на кассу, которой ещё нет в помещении, — не показываем.
      if (isCashierRole(role) && registerOfRole(role) >= registerCount(state)) continue;
      const searched = state.jobSearch?.day === state.day && state.jobSearch.role === role;
      roles.append(
        button(
          t(STAFF_ROLES[role].nameKey),
          () => update(startJobSearch(getState(), role)),
          `ui-chip${searched ? ' active' : ''}`,
          Boolean(staffOf(state, role)) || full || (!searched && state.money < JOB_AD_COST)
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
    const replay = el('div', 'ui-box');
    replay.append(
      el('div', 'ui-muted', t('tour.replayNote')),
      button(`👵 ${t('tour.replay')}`, () => {
        tourStep = 0;
        update({ ...getState(), tourDone: false });
      }, 'ui-btn secondary'),
    );
    const out: HTMLElement[] = [
      achievementsButton(state),
      replay,
      regularsBox(state),
      adsBox(state),
      rankBox(state),
      albumBox(state),
      decorBox(state),
    ];

    const current = el('div', 'ui-box');
    current.append(
      el('b', '', t('store.current', { name: t(level.nameKey) })),
      el('div', 'ui-muted', t('store.stats', { slots: level.slots, wh: level.warehouse, r: registerCount(state), g: level.guests })),
    );
    out.push(current, gearBox(state));

    const grow = el('div', 'ui-box');
    if (!next) {
      grow.append(el('div', 'ui-muted', t('store.max')));
    } else {
      grow.append(
        el('b', '', t('store.next', { name: t(next.nameKey) })),
        el('div', 'ui-muted', t('store.nextStats', { slots: next.slots, wh: next.warehouse, r: Math.max(registerCount(state), nextRegisterCount(state) ?? 0), g: next.guests, rent: next.rent })),
      );
      if (state.debt > 0) grow.append(el('div', 'ui-note', t('store.needNoDebt')));
      // После стройки может не хватить на счета по новой аренде — предупредить заранее.
      const billAfter = billTotal(monthlyBill({ ...state, level: state.level + 1 }));
      if (state.debt === 0 && state.money >= next.cost && state.money - next.cost < billAfter) {
        const warn = el('div', 'ui-note', t('store.billWarn', { left: state.money - next.cost, bill: billAfter, n: daysUntilBill(state.day) }));
        warn.style.color = '#b13e53';
        grow.append(warn);
      }
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
      .filter((r) => !isCashierRole(r) || registerOfRole(r) < registerCount(state))
      .map((r) => `${t(STAFF_ROLES[r].nameKey)} ${STAFF_ROLES[r].wage}`)
      .join(', ');
    costs.append(el('div', 'ui-muted', t('bills.staffPreview', { list: wages })));
    out.push(costs);
    return out;
  };

  // ---------- Цены ----------

  /** Карточки цен: открытые товары — с ценой и полоской спроса, закрытые — серые, с подсказкой, как открыть. */
  const pricesTab = (state: StoreState): HTMLElement[] => {
    const sellable = sellableProducts(state);
    return PRODUCT_IDS.map((pid) => {
      const product = PRODUCTS[pid];
      const card = el('div', 'ui-price');
      const icon = el('img', 'ui-price-icon');
      icon.src = `assets/item_${pid}.png`;
      icon.alt = '';
      const info = el('div', 'ui-price-info');
      info.append(el('b', '', t(product.nameKey)));
      if (!sellable.includes(pid)) {
        card.classList.add('ui-price-locked');
        // Сезонный товар вне сезона — «только летом», иначе — какая полка нужна.
        const why = productAvailable(pid, state.day)
          ? t('prices.locked', { shelf: t(SHELF_KINDS[product.category].nameKey) })
          : t(`prices.season.${pid}` as TextKey);
        info.append(el('div', 'ui-muted', `🔒 ${why}`));
        card.append(icon, info);
        return card;
      }
      const price = state.prices[pid];
      const demand = buyChance(price, product.basePrice);
      const bar = el('div', 'ui-bar');
      const fill = el('div', 'ui-bar-fill');
      fill.style.width = `${Math.min(100, Math.round(demand * 80))}%`;
      fill.style.background = demand >= 0.7 ? '#63c74d' : demand >= 0.4 ? '#feae34' : '#e43b44';
      bar.append(fill);
      info.append(
        bar,
        el('div', 'ui-muted', `${t('prices.demand', { p: Math.round(demand * 100) })} · ${t('prices.base', { n: product.basePrice })}`),
      );
      // Акция дня: −20% или «2 по цене 1» (одна на день; повторное нажатие отменяет).
      const promo = activePromo(state);
      const promoRow = el('div', 'ui-chips ui-promo');
      for (const kind of ['discount', 'bogo'] as PromoKind[]) {
        const on = promo?.product === pid && promo.kind === kind;
        promoRow.append(button(`🏷 ${t(`promo.${kind}` as TextKey)}`, () => update(setPromo(getState(), pid, kind)), `ui-chip${on ? ' active' : ''}`));
      }
      info.append(promoRow);
      const change = (delta: number) => () => update(setPrice(getState(), pid, getState().prices[pid] + delta));
      const chips = el('div', 'ui-chips');
      chips.append(button('−', change(-PRICE_STEP), 'ui-chip'), el('b', 'ui-price-value', `${price} 💰`), button('+', change(PRICE_STEP), 'ui-chip'));
      card.append(icon, info, chips);
      return card;
    });
  };

  render();
}
