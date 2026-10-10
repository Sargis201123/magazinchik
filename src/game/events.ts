// События дня: то, что сотрудники за игрока не решат. Утром — одно решение
// (заказ, выгодная партия, сломанный холодильник…), днём — проверка и час пик.
// Всё случайное зависит от номера дня, поэтому перезапуск игры не меняет события.

import type { TextKey } from '../i18n/ru';
import {
  buyStock,
  PRODUCTS,
  sellableProducts,
  SHELF_KINDS,
  STAFF_ROLE_IDS,
  isTired,
  staffOf,
  warehouseCapacity,
  warehouseCount,
  type ProductId,
  type StaffRole,
  type StoreState,
  type Unit,
} from './economy';
import { rng } from './random';
import { SUPPLIER_IDS, SUPPLIERS, type SupplierId } from './suppliers';
import type { Quest } from './endless';
import { makeWar, WAR_CHANCE, WAR_FROM_DAY } from './war';
import { eduardWar } from './eduard';

/** Кто делает крупный заказ. */
export type ClientId = 'chef' | 'school' | 'valya';

export const CLIENTS: Record<ClientId, { nameKey: TextKey; askKey: TextKey; products: ProductId[] }> = {
  chef: { nameKey: 'client.chef', askKey: 'client.chef.ask', products: ['meat', 'potatoes', 'bread'] },
  school: { nameKey: 'client.school', askKey: 'client.school.ask', products: ['milk', 'apples', 'bread'] },
  valya: { nameKey: 'client.valya', askKey: 'client.valya.ask', products: ['potatoes', 'bread', 'apples'] },
};

/** Заказ платит дороже обычной цены. */
export const ORDER_MARKUP = 1.3;
/** Выгодная партия — за полцены. */
export const DEAL_DISCOUNT = 0.5;
export const ORDER_DONE_RATING = 0.1;
export const ORDER_FAILED_RATING = 0.3;
export const INSPECTION_PASS_RATING = 0.2;
export const INSPECTION_FAIL_RATING = 0.3;
export const RUSH_SECONDS = 20;
/** Эдуард переманивает сотрудника (+25% к зарплате) или жалуется инспектору. */
export const POACH_FROM_DAY = 15;
export const POACH_CHANCE = 0.06;
export const POACH_RAISE = 1.25;
export const SNITCH_FROM_DAY = 14;
export const SNITCH_CHANCE = 0.05;
/**
 * Неожиданный счёт: доначислила налоговая, затопили соседей снизу, штраф пожарных, сломался
 * кассовый аппарат по гарантии… Платишь сразу или берёшь в долг у соседей, как бабушка.
 * Только когда прежний долг погашен — чтобы долги не копились снежным комом.
 */
/**
 * Персонал — люди: просят выходной на завтра или отпроситься сегодня (дела дома). Уставшие
 * (без выходных неделю) просят чаще. Отказать можно — но обидятся: медленнее и могут уволиться.
 */
export const PERSONAL_FROM_DAY = 6;
export const PERSONAL_CHANCE = 0.08;
/** Сколько вариантов причин (тексты event.dayOff.reasonN / event.goHome.reasonN). */
export const DAY_OFF_REASONS = 4;
export const GO_HOME_REASONS = 3;
export const BILL_FROM_DAY = 12;
export const BILL_CHANCE = 0.05;
export type BillReason = 'tax' | 'flood' | 'fire' | 'pipes';
export const BILL_REASONS: BillReason[] = ['tax', 'flood', 'fire', 'pipes'];
/** Сумма счёта по помещению: в универмаге и счета больше. */
export const billAmount = (level: number, roll: number): number => Math.round((200 + 180 * level) * (0.8 + roll * 0.4) / 10) * 10;

export type MorningEvent =
  | { kind: 'order'; client: ClientId; product: ProductId; qty: number; pay: number }
  | { kind: 'deal'; supplier: SupplierId; product: ProductId; qty: number; price: number }
  | { kind: 'fridgeBroken'; shelf: number; cost: number }
  | { kind: 'sick'; role: StaffRole }
  | { kind: 'inspection' }
  | { kind: 'priceWar'; product: ProductId; price: number; days: number }
  | { kind: 'poach'; role: StaffRole; wage: number }
  | { kind: 'snitch' }
  | { kind: 'bill'; reason: BillReason; amount: number }
  | { kind: 'dayOff'; role: StaffRole; reason: number }
  | { kind: 'goHome'; role: StaffRole; reason: number };

/** План дня: утреннее событие и что произойдёт днём. */
export interface DayPlan {
  day: number;
  event?: MorningEvent;
  /** Игрок уже ответил на утреннее событие. */
  decided: boolean;
  /** Принятый заказ: его заберут вечером. */
  order?: Extract<MorningEvent, { kind: 'order' }>;
  /** Сегодня придёт инспектор. */
  inspection: boolean;
  /** На какой секунде дня начнётся час пик. */
  rushAt?: number;
  /** Кто сегодня заболел. */
  sick?: StaffRole;
  /** Задания дня. */
  quests: Quest[];
}

export interface EventChances {
  order: number;
  inspection: number;
}

export const fridgeRepairCost = (level: number): number => 100 + 50 * level;
export const inspectionFine = (level: number): number => 150 + 100 * level;

/**
 * Что случится в этот день. Одно утреннее событие по приоритету: сломанный холодильник,
 * больной сотрудник, проверка, заказ, выгодная партия. Первые дни — спокойные.
 */
export function planDay(state: StoreState, chances: EventChances = { order: 0.15, inspection: 0.1 }): DayPlan {
  const random = rng(state.day * 92821 + 7);
  const plan: DayPlan = { day: state.day, decided: false, inspection: false, quests: [] };
  if (state.day <= 3) return plan;

  if (random() < 0.3) plan.rushAt = 20 + Math.floor(random() * 45);

  const fridges = state.shelves.map((s, i) => ({ s, i })).filter(({ s }) => SHELF_KINDS[s.kind].fridge && !s.broken);
  const sickRoll = random();
  const inspectionRoll = random();
  const orderRoll = random();
  const dealRoll = random();

  if (fridges.length && random() < 0.04 * fridges.length) {
    const { i } = fridges[Math.floor(random() * fridges.length)];
    plan.event = { kind: 'fridgeBroken', shelf: i, cost: fridgeRepairCost(state.level) };
  } else if (state.staff.length && sickRoll < 0.07) {
    const roles = STAFF_ROLE_IDS.filter((r) => staffOf(state, r));
    plan.sick = roles[Math.floor(random() * roles.length)];
    plan.event = { kind: 'sick', role: plan.sick };
  } else if (state.day >= PERSONAL_FROM_DAY && state.staff.length && random() < PERSONAL_CHANCE * (state.staff.some(isTired) ? 2 : 1)) {
    // Уставший просит выходной первым; иначе — кто-нибудь по семейным делам.
    const tired = state.staff.filter(isTired);
    const pool = tired.length ? tired : state.staff.filter((m) => m.offDay !== state.day + 1);
    const m = pool[Math.floor(random() * pool.length)];
    if (m) {
      plan.event =
        tired.length || random() < 0.6
          ? { kind: 'dayOff', role: m.role, reason: Math.floor(random() * DAY_OFF_REASONS) }
          : { kind: 'goHome', role: m.role, reason: Math.floor(random() * GO_HOME_REASONS) };
    }
  } else if (inspectionRoll < chances.inspection) {
    plan.inspection = true;
    plan.event = { kind: 'inspection' };
  } else if (orderRoll < chances.order) {
    plan.event = makeOrder(state, random);
  } else if (dealRoll < 0.12) {
    plan.event = makeDeal(state, random);
  } else if (state.day >= WAR_FROM_DAY && !state.war && random() < WAR_CHANCE * eduardWar(state)) {
    // Эдуард через дорогу снижает цену — отвечать или нет, решает игрок (war.ts).
    const war = makeWar(state, random);
    if (war) plan.event = { kind: 'priceWar', ...war };
  } else if (state.day >= POACH_FROM_DAY && state.staff.length && random() < POACH_CHANCE) {
    // Эдуард переманивает лучшего сотрудника: перебить его предложение или отпустить.
    const best = [...state.staff].sort((a, b) => b.skill - a.skill || b.wage - a.wage)[0];
    plan.event = { kind: 'poach', role: best.role, wage: Math.round((best.wage * POACH_RAISE) / 10) * 10 };
  } else if (state.day >= SNITCH_FROM_DAY && random() < SNITCH_CHANCE) {
    // Эдуард нажаловался — сегодня внеплановая проверка.
    plan.inspection = true;
    plan.event = { kind: 'snitch' };
  } else if (state.day >= BILL_FROM_DAY && state.debt === 0 && random() < BILL_CHANCE) {
    plan.event = { kind: 'bill', reason: BILL_REASONS[Math.floor(random() * BILL_REASONS.length)], amount: billAmount(state.level, random()) };
  }
  return plan;
}

function makeOrder(state: StoreState, random: () => number): MorningEvent | undefined {
  const sellable = sellableProducts(state);
  const clients = (Object.keys(CLIENTS) as ClientId[]).filter((c) => CLIENTS[c].products.some((p) => sellable.includes(p)));
  if (!clients.length) return undefined;
  const client = clients[Math.floor(random() * clients.length)];
  const options = CLIENTS[client].products.filter((p) => sellable.includes(p));
  const product = options[Math.floor(random() * options.length)];
  const qty = 4 + Math.floor(random() * (4 + 2 * state.level));
  return { kind: 'order', client, product, qty, pay: Math.round(PRODUCTS[product].basePrice * ORDER_MARKUP) };
}

function makeDeal(state: StoreState, random: () => number): MorningEvent | undefined {
  const sellable = sellableProducts(state);
  const offers = SUPPLIER_IDS.flatMap((supplier) =>
    sellable.filter((p) => SUPPLIERS[supplier].products[p] !== undefined).map((product) => ({ supplier, product })),
  );
  if (!offers.length) return undefined;
  const { supplier, product } = offers[Math.floor(random() * offers.length)];
  const qty = 8 + Math.floor(random() * 8);
  const price = Math.max(1, Math.round(PRODUCTS[product].cost * DEAL_DISCOUNT));
  return { kind: 'deal', supplier, product, qty, price };
}

/**
 * Ответ на утреннее событие. Заказ: принять — вечером его заберут. Партия: купить
 * на склад. Холодильник: починить сейчас (или потом во вкладке «Полки»).
 * Проверка и болезнь — просто уведомления.
 */
export function answerEvent(state: StoreState, accept: boolean): StoreState | null {
  const plan = state.plan;
  const event = plan?.event;
  if (!plan || !event || plan.decided) return null;
  const decided = { ...plan, decided: true };
  switch (event.kind) {
    case 'order':
      return { ...state, plan: { ...decided, order: accept ? event : undefined } };
    case 'deal': {
      if (!accept) return { ...state, plan: decided };
      const qty = Math.min(event.qty, warehouseCapacity(state) - warehouseCount(state), Math.floor(state.money / event.price));
      const bought = qty > 0 ? buyStock(state, event.product, qty, event.price) : null;
      return bought ? { ...bought, plan: decided } : null;
    }
    case 'poach': {
      // Согласиться — поднять зарплату до предложения Эдуарда; отказать — сотрудник уходит к нему.
      if (accept) {
        const staff = state.staff.map((m) => (m.role === event.role ? { ...m, wage: Math.max(m.wage, event.wage), raiseAsk: undefined, upset: false } : m));
        return { ...state, staff, plan: decided };
      }
      return { ...state, staff: state.staff.filter((m) => m.role !== event.role), plan: decided };
    }
    case 'dayOff':
      // Отпустить завтра или отказать — тогда обида.
      return {
        ...state,
        staff: state.staff.map((m) => (m.role !== event.role ? m : accept ? { ...m, offDay: state.day + 1 } : { ...m, upset: true })),
        plan: decided,
      };
    case 'goHome':
      // Отпустить сегодня — его не будет весь день; отказать — останется, но обидится.
      if (accept) return { ...state, plan: { ...decided, sick: event.role } };
      return { ...state, staff: state.staff.map((m) => (m.role === event.role ? { ...m, upset: true } : m)), plan: decided };
    case 'bill':
      // Заплатить сразу (если хватает) или в долг: его гасят вместе со счетами, как бабушкин.
      if (accept) return state.money >= event.amount ? { ...state, money: state.money - event.amount, plan: decided } : null;
      return { ...state, debt: state.debt + event.amount, plan: decided };
    case 'fridgeBroken': {
      const broken = breakShelf(state, event.shelf);
      if (!accept) return { ...broken, plan: decided };
      const repaired = repairShelf(broken, event.shelf);
      return repaired ? { ...repaired, plan: decided } : null;
    }
    default:
      return { ...state, plan: decided };
  }
}

export function breakShelf(state: StoreState, index: number): StoreState {
  return { ...state, shelves: state.shelves.map((s, i) => (i === index ? { ...s, broken: true } : s)) };
}

export function repairShelf(state: StoreState, index: number): StoreState | null {
  const shelf = state.shelves[index];
  const cost = fridgeRepairCost(state.level);
  if (!shelf?.broken || state.money < cost) return null;
  return { ...state, money: state.money - cost, shelves: state.shelves.map((s, i) => (i === index ? { ...s, broken: false } : s)) };
}

/** В сломанном холодильнике товар портится быстрее: за ночь стареет на лишний день. */
export function warmBrokenFridges(state: StoreState): StoreState {
  if (!state.shelves.some((s) => s.broken)) return state;
  const age = (units: Unit[] = []) => units.map((u) => ({ ...u, age: u.age + 1 }));
  return {
    ...state,
    shelves: state.shelves.map((s) =>
      s.broken ? { ...s, items: Object.fromEntries(Object.entries(s.items).map(([id, units]) => [id, age(units)])) } : s,
    ),
  };
}

export interface OrderResult {
  state: StoreState;
  delivered: boolean;
  earned: number;
}

/** Вечером забирают заказ: сначала со склада, потом с полок (самое старое). Не хватило — рейтинг падает. */
export function fulfillOrder(state: StoreState): OrderResult | null {
  const order = state.plan?.order;
  if (!order) return null;
  const { product, qty } = order;
  const inWarehouse = state.warehouse[product] ?? [];
  const onShelves = state.shelves.reduce((sum, s) => sum + (s.broken ? 0 : (s.items[product]?.length ?? 0)), 0);
  if (inWarehouse.length + onShelves < qty) {
    return { state: { ...state, rating: Math.max(0, state.rating - ORDER_FAILED_RATING) }, delivered: false, earned: 0 };
  }
  let need = qty;
  const fromWarehouse = Math.min(need, inWarehouse.length);
  need -= fromWarehouse;
  const shelves = state.shelves.map((s) => {
    if (need === 0 || s.broken) return s;
    const units = s.items[product] ?? [];
    const take = Math.min(need, units.length);
    need -= take;
    return { ...s, items: { ...s.items, [product]: units.slice(take) } };
  });
  const earned = qty * order.pay;
  return {
    state: {
      ...state,
      money: state.money + earned,
      rating: Math.min(5, state.rating + ORDER_DONE_RATING),
      warehouse: { ...state.warehouse, [product]: inWarehouse.slice(fromWarehouse) },
      shelves,
    },
    delivered: true,
    earned,
  };
}

export interface InspectionResult {
  passed: boolean;
  problems: TextKey[];
  fine: number;
}

/** Проверка: мусор, туалет, брак без уценки на полках, сломанный холодильник с товаром. */
export function inspect(state: StoreState, scene: { trash: number; toiletDirt: number }): InspectionResult {
  const problems: TextKey[] = [];
  if (scene.trash >= 2) problems.push('inspection.trash');
  if (scene.toiletDirt >= 50) problems.push('inspection.toilet');
  if (state.shelves.some((s) => Object.values(s.items).some((units) => units?.some((u) => u.bad && !u.markdown))))
    problems.push('inspection.badGoods');
  if (state.shelves.some((s) => s.broken && Object.values(s.items).some((units) => units?.length))) problems.push('inspection.warmFridge');
  return { passed: problems.length === 0, problems, fine: problems.length ? inspectionFine(state.level) : 0 };
}

/** Итог проверки: штраф и минус к рейтингу или плюс к рейтингу. */
export function applyInspection(state: StoreState, result: InspectionResult): StoreState {
  if (result.passed) return { ...state, rating: Math.min(5, state.rating + INSPECTION_PASS_RATING) };
  return {
    ...state,
    money: Math.max(0, state.money - result.fine),
    debt: state.debt + Math.max(0, result.fine - Math.max(0, state.money)),
    rating: Math.max(0, state.rating - INSPECTION_FAIL_RATING),
  };
}
