// Автозаказ (улучшение «🤖 Автозаказ») — закупщик, который работает сам. Каждое утро покупает то,
// что нужно на день, тем же расчётом, что и «Закупить нужное» (restock.ts), но не дороже лимита —
// доли денег на утро, которую выбирает игрок. Днём, если товар разобрали и на складе его нет, сам
// заказывает небольшой подвоз: приезжает фургон, штука чуть дороже утренней (AUTO_TOPUP_MARKUP).
// Подвоз тратит тот же лимит дня. Утром видно, что куплено и почём; строку или всё можно вернуть.

import { onShelves, sellableProducts, warehouseCapacity, warehouseCount, warehouseOf, type ProductId, type StoreState, type Unit } from './economy';
import { hasUpgrade } from './upgrades';
import { canStock, restockPlan } from './restock';
import { buyLine } from './reorder';
import { receiveUrgent } from './urgent';
import { newDeal, SUPPLIER_IDS, SUPPLIERS, unitPrice, type SupplierId } from './suppliers';

/** Лимит утра на выбор: какую долю денег автозаказ может потратить за день. */
export const AUTO_SHARES = [0.25, 0.5, 0.75, 1] as const;
export const AUTO_SHARE = 0.75;
/** Подвоз днём: наценка к самой низкой цене, сколько штук за раз и сколько раз за день. */
export const AUTO_TOPUP_MARKUP = 1.1;
export const AUTO_TOPUP_QTY = 6;
export const AUTO_TOPUPS = 3;
/** На полке осталось столько или меньше (а на складе пусто) — пора подвезти. */
export const AUTO_TOPUP_LOW = 2;

export interface AutoLine {
  sid: SupplierId;
  pid: ProductId;
  qty: number;
  /** Сколько за строку заплачено (столько и вернут, если отменить). */
  paid: number;
}

/** Закупки автозаказа за день: утром видно, что куплено, и можно вернуть. */
export interface AutoDay {
  day: number;
  /** Деньги утром до закупки — от них считается лимит. */
  base: number;
  /** Сколько потрачено за день: утренняя закупка и подвозы. */
  spent: number;
  lines: AutoLine[];
  /** Не всё влезло в лимит или на склад. */
  cut?: boolean;
  /** Игрок отменил закупку сегодня — до завтра автозаказ не докупает. */
  canceled?: boolean;
  /** Строки, которые вернули: их сегодня не докупаем. */
  skip?: ProductId[];
  /** Сколько раз за день подвозил. */
  topUps: number;
  /** Подвоз оплачен, но фургон ещё едет: закрыли игру — товар кладём на склад при загрузке. */
  inbound?: { pid: ProductId; qty: number }[];
}

export interface AutoOrder {
  on: boolean;
  /** Доля денег на утро, которую можно потратить (нет — AUTO_SHARE). */
  share?: number;
  today?: AutoDay;
}

/** Автозаказ куплен и включён. */
export const autoActive = (state: StoreState): boolean => Boolean(state.autoOrder?.on) && hasUpgrade(state, 'autoOrder');

export const autoShare = (state: StoreState): number => state.autoOrder?.share ?? AUTO_SHARE;

/** Сегодняшняя запись (или новая: лимит — от денег сейчас). */
export function autoDay(state: StoreState): AutoDay {
  const today = state.autoOrder?.today;
  return today?.day === state.day ? today : { day: state.day, base: state.money, spent: 0, lines: [], topUps: 0 };
}

/** Лимит дня в монетах. */
export const autoLimit = (state: StoreState): number => Math.floor(autoDay(state).base * autoShare(state));

const withDay = (state: StoreState, today: AutoDay): StoreState => ({ ...state, autoOrder: { on: state.autoOrder?.on ?? false, share: state.autoOrder?.share, today } });

/**
 * Утренняя закупка: всё, чего не хватит на день (как «Закупить нужное»), в пределах лимита. Можно звать
 * снова — докупит только недостающее (например, когда лимит подняли). После отмены — ничего.
 */
export function autoMorning(state: StoreState, priceOf: (sid: SupplierId, pid: ProductId) => number | null, guests: number): StoreState {
  if (!autoActive(state)) return state;
  const today = autoDay(state);
  if (today.canceled) return state;
  const left = Math.max(0, Math.floor(today.base * autoShare(state)) - today.spent);
  // Вернутое — не в плане вовсе: иначе пустой товар встал бы первым и съел лимит и место.
  const plan = restockPlan({ ...state, money: Math.min(state.money, left) }, priceOf, guests, today.skip);
  let next = state;
  let spent = today.spent;
  const lines = today.lines.map((l) => ({ ...l }));
  for (const line of plan.lines) {
    // Свои штуки помечены: вернуть можно только их (не подвоз и не подарки, даже после перезапуска днём).
    // Купленное сразу встаёт на полки: строка больше склада покупается частями (buyLine).
    const bought = buyLine(next, line, false, (u) => ({ ...u, auto: true }));
    if (!bought.qty) continue;
    const paid = next.money - bought.state.money;
    next = bought.state;
    spent += paid;
    const same = lines.find((l) => l.sid === line.sid && l.pid === line.pid);
    if (same) {
      same.qty += bought.qty;
      same.paid += paid;
    } else lines.push({ sid: line.sid, pid: line.pid, qty: bought.qty, paid });
  }
  return withDay(next, { ...today, spent, lines, cut: plan.cut });
}

/** Забрать со склада, а потом с полок до n штук, купленных автозаказом сегодня. Сколько забрали. */
function takeFresh(state: StoreState, pid: ProductId, n: number): { state: StoreState; taken: number } {
  let left = n;
  const strip = (units: Unit[] | undefined): Unit[] | undefined => {
    if (!units || left <= 0) return units;
    const out = [...units];
    for (let i = out.length - 1; i >= 0 && left > 0; i--) {
      const u = out[i];
      if (u.auto && u.age === 0 && !u.bad && !u.markdown) {
        out.splice(i, 1);
        left--;
      }
    }
    return out;
  };
  const warehouse = { ...state.warehouse, [pid]: strip(state.warehouse[pid]) };
  const shelves = state.shelves.map((sh) => (left > 0 && sh.items[pid] ? { ...sh, items: { ...sh.items, [pid]: strip(sh.items[pid]) } } : sh));
  return { state: { ...state, warehouse, shelves }, taken: n - left };
}

/** Вернуть поставщику строку утренней закупки: деньги назад, сегодня этот товар больше не докупаем. */
export function autoReturn(state: StoreState, pid: ProductId): StoreState | null {
  const today = state.autoOrder?.today;
  if (!today || today.day !== state.day) return null;
  const mine = today.lines.filter((l) => l.pid === pid);
  if (!mine.length) return null;
  let next = state;
  let refund = 0;
  for (const line of mine) {
    const back = takeFresh(next, pid, line.qty);
    next = back.state;
    refund += Math.round((line.paid * back.taken) / line.qty);
  }
  return withDay(
    { ...next, money: next.money + refund },
    { ...today, spent: Math.max(0, today.spent - refund), lines: today.lines.filter((l) => l.pid !== pid), skip: [...(today.skip ?? []), pid] },
  );
}

/** Вернуть всё, что автозаказ купил утром, и до завтра ничего не докупать. */
export function autoCancel(state: StoreState): StoreState | null {
  const today = state.autoOrder?.today;
  if (!today || today.day !== state.day) return null;
  let next: StoreState = state;
  for (const pid of new Set(today.lines.map((l) => l.pid))) next = autoReturn(next, pid) ?? next;
  return withDay(next, { ...autoDay(next), canceled: true });
}

/** Передумал отменять: сегодня снова можно закупать (и вернутые строки тоже). */
export const autoResume = (state: StoreState): StoreState => withDay(state, { ...autoDay(state), canceled: false, skip: [] });

/** Включить или выключить. */
export const autoToggle = (state: StoreState): StoreState => ({ ...state, autoOrder: { ...state.autoOrder, on: !state.autoOrder?.on } });

/** Сменить лимит. */
export const autoSetShare = (state: StoreState, share: number): StoreState => ({ ...state, autoOrder: { on: state.autoOrder?.on ?? false, ...state.autoOrder, share } });

/** Цена штуки при подвозе днём: самая низкая у поставщиков с наценкой. null — никто не продаёт. */
export function topUpPrice(pid: ProductId): number | null {
  const prices = SUPPLIER_IDS.map((sid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), pid)).filter((p): p is number => p !== null);
  return prices.length ? Math.round(Math.min(...prices) * AUTO_TOPUP_MARKUP) : null;
}

/**
 * Подвоз днём: товар, который сегодня покупают, кончился на складе, а на полке почти пусто. Платим сразу
 * (из лимита дня), товар едет фургоном (сцена кладёт его на склад, как срочный подвоз). null — подвозить
 * нечего, лимит или подвозы на сегодня кончились, нет места или денег.
 * busy — что уже едет; onTheWay — сколько штук едет (место на складе для них занято).
 */
export function autoTopUp(
  state: StoreState,
  sold: (pid: ProductId) => number,
  busy: ProductId[] = [],
  onTheWay = 0,
): { state: StoreState; pid: ProductId; qty: number; cost: number } | null {
  if (!autoActive(state)) return null;
  const today = autoDay(state);
  if (today.canceled || today.topUps >= AUTO_TOPUPS) return null;
  const pid = sellableProducts(state)
    .filter((id) => sold(id) > 0 && !busy.includes(id) && !today.skip?.includes(id) && canStock(state, id))
    .filter((id) => warehouseOf(state, id) === 0 && onShelves(state, id) <= AUTO_TOPUP_LOW)
    .sort((a, b) => sold(b) - sold(a))[0];
  if (!pid) return null;
  const price = topUpPrice(pid);
  if (price === null) return null;
  const left = Math.min(state.money, Math.floor(today.base * autoShare(state)) - today.spent);
  const room = warehouseCapacity(state) - warehouseCount(state) - onTheWay;
  const qty = Math.min(AUTO_TOPUP_QTY, room, Math.floor(left / price));
  if (qty <= 0) return null;
  const cost = qty * price;
  const inbound = [...(today.inbound ?? []), { pid, qty }];
  return { state: withDay({ ...state, money: state.money - cost }, { ...today, spent: today.spent + cost, topUps: today.topUps + 1, inbound }), pid, qty, cost };
}

/** Фургон подвоза приехал: товар на склад, из «едет» — вычеркнуть. */
export function autoArrived(state: StoreState, pid: ProductId, qty: number): StoreState {
  const today = state.autoOrder?.today;
  const next = receiveUrgent(state, pid, qty);
  const i = today?.inbound?.findIndex((o) => o.pid === pid && o.qty === qty) ?? -1;
  if (!today || i < 0) return next;
  return withDay(next, { ...today, inbound: today.inbound!.filter((_, k) => k !== i) });
}

/** При загрузке: оплаченный, но не доехавший подвоз (игру закрыли, пока ехал фургон) — сразу на склад. */
export function settleInbound(state: StoreState): StoreState {
  const today = state.autoOrder?.today;
  if (!today?.inbound?.length) return state;
  let next = state;
  for (const o of today.inbound) next = receiveUrgent(next, o.pid, o.qty);
  return withDay(next, { ...today, inbound: [] });
}

/**
 * Старые сохранения: автозаказ раньше держал свой список товаров, а «Как в прошлый раз» помнило
 * закупки последних дней. Списка больше нет (закупщик считает всё сам), «включён» — остаётся.
 */
export function migrateAutoOrder(state: StoreState): StoreState {
  const old = state as StoreState & { purchases?: unknown; autoOrder?: AutoOrder & { lines?: unknown } };
  if (old.purchases === undefined && old.autoOrder?.lines === undefined) return state;
  const { purchases: _purchases, ...rest } = old;
  if (!old.autoOrder) return rest;
  const { lines: _lines, ...auto } = old.autoOrder;
  return { ...rest, autoOrder: auto };
}
