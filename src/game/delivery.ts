// Доставка на дом: днём звонит телефон у кассы — заказ на пару товаров. Внизу экрана карточка:
// кто звонит, что просит, сколько заплатит; «Принять» — товар сразу откладывают (со склада, а не
// хватит — с полок), хозяин, менеджер или грузчик собирает коробку и выносит курьеру, курьер
// отвозит и привозит деньги с наценкой за доставку, а за быструю доставку — ещё и чаевые.
// Не ответил вовремя — заказ ушёл к конкуренту, и рейтинг доставки падает: звонят реже.
// Курьер пересаживается с велосипеда на мопед и фургон (оборудование «Транспорт курьера»).

import { DAY_SECONDS, onShelves, sellableProducts, warehouseOf, type ProductId, type StoreState } from './economy';
import { gearTier } from './gear';

/**
 * Через сколько секунд звонят (случайно в этих пределах; транспорт и рейтинг — чаще) и сколько ждут ответа.
 * Звонок — редкий и крупный: один-два за день, а не каждые двадцать секунд (день спокойнее, доход тот же).
 */
export const ORDER_EVERY: [number, number] = [40, 70];
export const ORDER_TIMEOUT = 15;
/** Наценка за доставку (заказ крупный — и наценка за него больше). */
export const DELIVERY_FEE = 130;

/** Кто звонит: портреты assets/portrait_caller<N>.png (art/delivery.py) и имена delivery.caller<N>. */
export const CALLERS = 6;

export interface HomeOrder {
  items: { id: ProductId; qty: number }[];
  /** Сколько заплатят: товар по ценам на полке плюс наценка за доставку (без чаевых). */
  pay: number;
  /** Кто звонит (номер портрета и имени); в старых тестах может не быть. */
  caller?: number;
}

export type VehicleId = 'bike' | 'scooter' | 'van';

/** Транспорт курьера: модель оборудования «courier» (gear.ts) — велосипед, мопед, фургончик. */
export interface Vehicle {
  id: VehicleId;
  icon: string;
  /** Сколько секунд курьер за краем улицы: до клиента и обратно. */
  away: number;
  /** Скорость по улице, точек мира в секунду. */
  speed: number;
  /** Сколько заказов увозит за одну поездку. */
  carry: number;
  /** Сколько принятых заказов могут ждать курьера, пока он в пути. */
  queue: number;
  /** Во сколько раз чаще звонят: на мопеде и фургоне берут заказы дальше по району. */
  calls: number;
}

export const VEHICLES: Vehicle[] = [
  { id: 'bike', icon: '🚲', away: 4, speed: 70, carry: 1, queue: 1, calls: 1 },
  { id: 'scooter', icon: '🛵', away: 2.5, speed: 120, carry: 1, queue: 2, calls: 1.2 },
  { id: 'van', icon: '🚐', away: 3, speed: 130, carry: 3, queue: 3, calls: 1.45 },
];

export const vehicleOf = (state: StoreState): Vehicle => VEHICLES[Math.min(gearTier(state, 'courier'), VEHICLES.length - 1)];

// ---------- Рейтинг доставки ----------

/** Рейтинг доставки 1..5: с ним звонят чаще или реже. В старых сохранениях его нет — 4 звезды. */
export const DELIVERY_RATING_START = 4;
export const DELIVERY_RATING_MIN = 1;
export const DELIVERY_RATING_MAX = 5;
export const deliveryRating = (state: StoreState): number => state.deliveryRating ?? DELIVERY_RATING_START;

/** Чем кончился заказ: привезли быстро, привезли, отказались, не ответили, не хватило товара. */
export type DeliveryOutcome = 'fast' | 'delivered' | 'declined' | 'missed' | 'noStock';
/**
 * Как меняется рейтинг. Не ответить — хуже, чем вежливо отказаться: человек ждал у телефона.
 * Пропущенный звонок отнимает больше, чем даёт привезённый заказ, — ради рейтинга телефон надо брать.
 */
export const RATING_STEP: Record<DeliveryOutcome, number> = { fast: 0.15, delivered: 0.08, declined: -0.1, missed: -0.3, noStock: -0.2 };

export function rateDelivery(state: StoreState, outcome: DeliveryOutcome): StoreState {
  const next = Math.min(DELIVERY_RATING_MAX, Math.max(DELIVERY_RATING_MIN, deliveryRating(state) + RATING_STEP[outcome]));
  return { ...state, deliveryRating: Math.round(next * 100) / 100 };
}

/** Во сколько раз чаще звонят при этом рейтинге: 4★ — как обычно, 5★ — чуть чаще, 1★ — заметно реже. */
export const ratingCalls = (state: StoreState): number => 0.7 + 0.075 * deliveryRating(state);

/** Через сколько секунд следующий звонок. */
export function nextCallIn(state: StoreState, random: () => number): number {
  const [lo, hi] = ORDER_EVERY;
  return (lo + random() * (hi - lo)) / (vehicleOf(state).calls * ratingCalls(state));
}

/**
 * Сколько звонков вообще может успеть за день (для бюджета внимания, attention.ts): второй — только если
 * даже при самых частых звонках он приходится раньше, чем телефон перестаёт звонить к закрытию.
 */
export function callsPossible(state: StoreState, max: number): number {
  const fastest = ORDER_EVERY[0] / (vehicleOf(state).calls * ratingCalls(state));
  const last = DAY_SECONDS - ORDER_TIMEOUT - 3;
  return Math.max(0, Math.min(max, Math.floor(last / fastest)));
}

// ---------- Чаевые ----------

/** Чаевые за скорость: от звонка до двери клиента не дольше стольких секунд — столько монет. */
export const TIPS: [number, number][] = [
  [20, 40],
  [30, 20],
];
export const deliveryTip = (seconds: number): number => TIPS.find(([limit]) => seconds <= limit)?.[1] ?? 0;
/** Быстрая доставка (с чаевыми) поднимает рейтинг сильнее. */
export const outcomeFor = (tip: number): DeliveryOutcome => (tip > 0 ? 'fast' : 'delivered');

// ---------- Заказ ----------

const inStock = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/**
 * Заказ из того, что есть в магазине: 2–3 товара по 2–5 штук (не больше, чем есть: звонят «по наличию»).
 * Звонят редко, зато берут на всю семью — как раньше два-три маленьких заказа вместе.
 */
export function makeHomeOrder(state: StoreState, random: () => number): HomeOrder | null {
  const options = sellableProducts(state).filter((id) => inStock(state, id) > 0);
  if (!options.length) return null;
  const items: HomeOrder['items'] = [];
  const kinds = Math.min(options.length, random() < 0.5 ? 2 : 3);
  while (items.length < kinds) {
    const id = options.splice(Math.floor(random() * options.length), 1)[0];
    items.push({ id, qty: Math.min(inStock(state, id), 2 + Math.floor(random() * 4)) });
  }
  const pay = items.reduce((sum, { id, qty }) => sum + state.prices[id] * qty, 0) + DELIVERY_FEE;
  return { items, pay, caller: Math.floor(random() * CALLERS) };
}

export const canFulfill = (state: StoreState, order: HomeOrder): boolean => order.items.every(({ id, qty }) => inStock(state, id) >= qty);

/** Сколько штук в заказе (столько раз упаковщик кладёт товар в коробку). */
export const orderUnits = (order: HomeOrder): number => order.items.reduce((sum, { qty }) => sum + qty, 0);

/** Собрать заказ: сначала со склада (самое старое), потом с полок. null — не хватает товара. */
export function packHomeOrder(state: StoreState, order: HomeOrder): StoreState | null {
  if (!canFulfill(state, order)) return null;
  let warehouse = { ...state.warehouse };
  let shelves = state.shelves;
  for (const { id, qty } of order.items) {
    let need = qty;
    const fromWarehouse = Math.min(need, (warehouse[id] ?? []).filter((u) => !u.pending).length);
    warehouse = { ...warehouse, [id]: (warehouse[id] ?? []).filter((u, i, all) => u.pending || all.slice(0, i + 1).filter((x) => !x.pending).length > fromWarehouse) };
    need -= fromWarehouse;
    shelves = shelves.map((s) => {
      if (need === 0 || s.broken) return s;
      const units = s.items[id] ?? [];
      const take = Math.min(need, units.length);
      need -= take;
      return take ? { ...s, items: { ...s.items, [id]: units.slice(take) } } : s;
    });
  }
  return { ...state, warehouse, shelves };
}

// ---------- День доставки для симулятора ----------

/** Сколько секунд в среднем от звонка до двери клиента у игрока: ответить, собрать, доехать. */
export const SIM_DELIVERY_SECONDS = 18;

export interface DeliveryDay {
  state: StoreState;
  delivered: number;
  missed: number;
  /** Деньги за привезённые заказы, вместе с чаевыми. */
  pay: number;
  tips: number;
  /** Сколько штук товара увезли. */
  units: number;
}

/**
 * День доставки «разумного игрока» (simulate.ts): звонки по расписанию, на часть он не успевает
 * ответить; принятый заказ собирают и привозят, деньги и рейтинг — как в игре. Время ответа и
 * сборки — в среднем, без беготни по залу.
 */
export function deliveryDay(state: StoreState, random: () => number, answer = 0.85): DeliveryDay {
  let s = state;
  const day: Omit<DeliveryDay, 'state'> = { delivered: 0, missed: 0, pay: 0, tips: 0, units: 0 };
  for (let t = nextCallIn(s, random); t < DAY_SECONDS - ORDER_TIMEOUT; t += nextCallIn(s, random)) {
    const order = makeHomeOrder(s, random);
    if (!order) continue;
    if (random() >= answer) {
      s = rateDelivery(s, 'missed');
      day.missed++;
      continue;
    }
    const packed = packHomeOrder(s, order);
    if (!packed) {
      s = rateDelivery(s, 'noStock');
      continue;
    }
    const tip = deliveryTip(SIM_DELIVERY_SECONDS * (0.7 + random()));
    s = rateDelivery({ ...packed, money: packed.money + order.pay + tip }, outcomeFor(tip));
    day.delivered++;
    day.pay += order.pay + tip;
    day.tips += tip;
    day.units += orderUnits(order);
  }
  return { state: s, ...day };
}
