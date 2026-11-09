// «Закупать сам каждое утро» (02.11; раньше — улучшение «🤖 Автозаказ» за 1200 с лимитом и возвратами).
// Бесплатный переключатель с 7-го дня: каждое утро сам жмёт «Закупить нужное» (restock.ts) — тот же
// расчёт и те же цены со скидкой постоянного покупателя, только без брака. Днём, если товар разобрали
// и на складе его нет, сам вызывает небольшой подвоз: приезжает фургон, штука чуть дороже утренней
// (AUTO_TOPUP_MARKUP). Отдельного срочного заказа у игрока нет — подвозят автозакупка и менеджер (urgent.ts).

import { onShelves, sellableProducts, warehouseCapacity, warehouseCount, warehouseOf, type ProductId, type StoreState } from './economy';
import { canStock, restockPlan } from './restock';
import { ownBreadOn } from './bakery';
import { buyLine } from './reorder';
import { receiveUrgent } from './urgent';
import { listPrice, type SupplierId } from './suppliers';

/** С какого дня можно включить: первую неделю закупаешь сам — так видно, как устроен магазин. */
export const AUTO_FROM_DAY = 7;
/** Подвоз днём: наценка к самой низкой цене по прайсу, сколько штук за раз и сколько раз за день. */
export const AUTO_TOPUP_MARKUP = 1.25;
export const AUTO_TOPUP_QTY = 6;
export const AUTO_TOPUPS = 3;
/** На полке осталось столько или меньше (а на складе пусто) — пора подвезти. */
export const AUTO_TOPUP_LOW = 2;

export interface AutoLine {
  sid: SupplierId;
  pid: ProductId;
  qty: number;
  /** Сколько за строку заплачено. */
  paid: number;
}

/** Закупки за день: утром в сводке видно, что куплено и почём. */
export interface AutoDay {
  day: number;
  /** Сколько потрачено за день: утренняя закупка и подвозы. */
  spent: number;
  lines: AutoLine[];
  /** Не всё влезло: не хватило места или денег. */
  cut?: boolean;
  /** Сколько раз за день подвозил. */
  topUps: number;
  /** Подвоз оплачен, но фургон ещё едет: закрыли игру — товар кладём на склад при загрузке. */
  inbound?: { pid: ProductId; qty: number }[];
}

export interface AutoOrder {
  on: boolean;
  today?: AutoDay;
}

/** Включено: каждое утро закупает сам. */
export const autoActive = (state: StoreState): boolean => Boolean(state.autoOrder?.on);

/** Переключатель виден: с 7-го дня (или уже включён — купившим старый «Автозаказ» раньше). */
export const autoAvailable = (state: StoreState): boolean => state.day >= AUTO_FROM_DAY || autoActive(state);

/** Сегодняшняя запись (или новая). */
export function autoDay(state: StoreState): AutoDay {
  const today = state.autoOrder?.today;
  return today?.day === state.day ? today : { day: state.day, spent: 0, lines: [], topUps: 0 };
}

const withDay = (state: StoreState, today: AutoDay): StoreState => ({ ...state, autoOrder: { on: state.autoOrder?.on ?? false, today } });

/**
 * Утренняя закупка: всё, чего не хватит на день, — ровно как «Закупить нужное». Можно звать снова —
 * докупит только недостающее (например, когда переключатель включили посреди утра).
 */
export function autoMorning(state: StoreState, priceOf: (sid: SupplierId, pid: ProductId) => number | null, guests: number): StoreState {
  if (!autoActive(state)) return state;
  const today = autoDay(state);
  const plan = restockPlan(state, priceOf, guests);
  let next = state;
  let spent = today.spent;
  const lines = today.lines.map((l) => ({ ...l }));
  for (const line of plan.lines) {
    // Купленное сразу встаёт на полки: строка больше склада покупается частями (buyLine).
    const bought = buyLine(next, line);
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

/** Включить или выключить (бесплатно). */
export const autoToggle = (state: StoreState): StoreState => ({ ...state, autoOrder: { ...state.autoOrder, on: !state.autoOrder?.on } });

/** Цена штуки при подвозе днём: самая низкая по прайсу с наценкой. null — никто не продаёт. */
export function topUpPrice(pid: ProductId): number | null {
  const price = listPrice(pid);
  return price === null ? null : Math.round(price * AUTO_TOPUP_MARKUP);
}

/**
 * Подвоз днём: товар, который сегодня покупают, кончился на складе, а на полке почти пусто. Платим сразу,
 * товар едет фургоном (сцена кладёт его на склад, как срочный подвоз менеджера). null — подвозить нечего,
 * подвозы на сегодня кончились, нет места или денег.
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
  if (today.topUps >= AUTO_TOPUPS) return null;
  const pid = sellableProducts(state)
    // Хлеб при своей пекарне печёт пекарь — фургон его не везёт.
    .filter((id) => sold(id) > 0 && !busy.includes(id) && canStock(state, id) && !(id === 'bread' && ownBreadOn(state)))
    .filter((id) => warehouseOf(state, id) === 0 && onShelves(state, id) <= AUTO_TOPUP_LOW)
    .sort((a, b) => sold(b) - sold(a))[0];
  if (!pid) return null;
  const price = topUpPrice(pid);
  if (price === null) return null;
  const room = warehouseCapacity(state) - warehouseCount(state) - onTheWay;
  const qty = Math.min(AUTO_TOPUP_QTY, room, Math.floor(state.money / price));
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
 * Старые сохранения: автозаказ раньше держал свой список товаров, «Как в прошлый раз» помнило закупки
 * последних дней, а потом был лимит дня, возвраты и отмена (до 02.11). Всё это больше не нужно —
 * «включён» остаётся. Купленное улучшение «Автозаказ» убирает buyMigrate.ts (переключатель теперь бесплатный).
 */
export function migrateAutoOrder(state: StoreState): StoreState {
  const old = state as StoreState & { purchases?: unknown; autoOrder?: AutoOrder & { lines?: unknown; share?: unknown; today?: AutoDay & { base?: unknown; canceled?: unknown; skip?: unknown } } };
  const auto = old.autoOrder;
  const stale = auto && (auto.lines !== undefined || auto.share !== undefined || (auto.today && (auto.today.base !== undefined || auto.today.canceled !== undefined || auto.today.skip !== undefined)));
  if (old.purchases === undefined && !stale) return state;
  const { purchases: _purchases, ...rest } = old;
  if (!auto) return rest;
  const { lines: _lines, share: _share, today, ...kept } = auto;
  if (!today) return { ...rest, autoOrder: kept };
  const { base: _base, canceled: _canceled, skip: _skip, ...day } = today;
  return { ...rest, autoOrder: { ...kept, today: day } };
}
