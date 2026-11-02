// События дня: то, что сотрудники за игрока не решат. Утром — одно решение
// (ход Эдуарда), днём — проверка и час пик. Крупный заказ клиента — не событие, а строка доски
// «Заказы» (orders.ts) рядом с кафе и соседями.
// Всё случайное зависит от номера дня, поэтому перезапуск игры не меняет события.
// 02.11 убраны наказания без выбора: поломка холодильника, болезнь сотрудника, «отпроситься»,
// неожиданный счёт и переманивание — они стоили игроку внимания и денег, а решать там было нечего.

import type { TextKey } from '../i18n/ru';
import {
  PRODUCTS,
  sellableProducts,
  type ProductId,
  type StoreState,
} from './economy';
import { rng } from './random';
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
export const ORDER_DONE_RATING = 0.1;
export const ORDER_FAILED_RATING = 0.3;
export const INSPECTION_PASS_RATING = 0.2;
/** Провал проверки СЭС: −0,15 рейтинга (было −0,3 — самое тяжёлое наказание за одну гнилую бумажку). */
export const INSPECTION_FAIL_RATING = 0.15;
export const RUSH_SECONDS = 20;
/** Эдуард жалуется инспектору — внеплановая проверка. */
export const SNITCH_FROM_DAY = 14;
export const SNITCH_CHANCE = 0.05;
/** Крупный заказ клиента: заберут вечером и заплатят дороже (доска «Заказы», orders.ts). */
export interface ClientOrder {
  kind: 'order';
  client: ClientId;
  product: ProductId;
  qty: number;
  pay: number;
}

export type MorningEvent =
  | { kind: 'inspection' }
  | { kind: 'priceWar'; product: ProductId; price: number; days: number }
  | { kind: 'snitch' };

/** Виды утренних событий, которые ещё бывают: у старого сохранения в плане может лежать убранное (save.ts). */
export const EVENT_KINDS: ReadonlySet<string> = new Set<MorningEvent['kind']>(['inspection', 'priceWar', 'snitch']);

/** План дня: утреннее событие и что произойдёт днём. */
export interface DayPlan {
  day: number;
  event?: MorningEvent;
  /** Игрок уже ответил на утреннее событие. */
  decided: boolean;
  /** Заказ клиента ждёт ответа на доске «Заказы» (orders.ts). */
  offer?: ClientOrder;
  /** Принятый заказ: его заберут вечером. */
  order?: ClientOrder;
  /** Сегодня придёт инспектор. */
  inspection: boolean;
  /** На какой секунде дня начнётся час пик. */
  rushAt?: number;
  /** Задания дня. */
  quests: Quest[];
  /** Шаг дорожки сезонной недели на сегодня (weeks.ts); цель запоминается утром, чтобы вечером не уехала. */
  week?: import('./weeks').WeekGoalToday | null;
}

export interface EventChances {
  order: number;
  inspection: number;
}

export const inspectionFine = (level: number): number => 150 + 100 * level;

/**
 * Что случится в этот день. Одно утреннее событие по приоритету: проверка, ходы Эдуарда; заказ
 * клиента — на доску «Заказы», не в новости. Первые дни — спокойные.
 */
export function planDay(state: StoreState, chances: EventChances = { order: 0.15, inspection: 0.1 }): DayPlan {
  // Эдуард (война цен, жалоба) — сосед Центра; в Заречье его нет (zarechye.ts).
  const home = state.zar?.at !== 'zar';
  const random = rng(state.day * 92821 + 7);
  const plan: DayPlan = { day: state.day, decided: false, inspection: false, quests: [] };
  if (state.day <= 3) return plan;

  if (random() < 0.3) plan.rushAt = 20 + Math.floor(random() * 45);

  // Бросок болезни сотрудника (её больше нет) оставлен, чтобы проверки и заказы выпадали в те же дни, что раньше.
  random();
  const inspectionRoll = random();
  const orderRoll = random();
  // «Выгодной партии» больше нет (02.11), но её случайное число тянем: ряд событий по дням не сдвигается.
  const dealRoll = random();

  if (inspectionRoll < chances.inspection) {
    plan.inspection = true;
    plan.event = { kind: 'inspection' };
  } else if (orderRoll < chances.order) {
    plan.offer = makeOrder(state, random);
  } else if (dealRoll < 0.12 && state.day >= 6) {
    // Раньше здесь была «выгодная партия»: в этот день просто тихо (и Эдуард не приходит — как и раньше).
  } else if (home && state.day >= WAR_FROM_DAY && !state.war && random() < WAR_CHANCE * eduardWar(state)) {
    // Эдуард через дорогу снижает цену — отвечать или нет, решает игрок (war.ts).
    const war = makeWar(state, random);
    if (war) plan.event = { kind: 'priceWar', ...war };
  } else if (home && state.day >= SNITCH_FROM_DAY && random() < SNITCH_CHANCE) {
    // Эдуард нажаловался — сегодня внеплановая проверка.
    plan.inspection = true;
    plan.event = { kind: 'snitch' };
  }
  return plan;
}

function makeOrder(state: StoreState, random: () => number): ClientOrder | undefined {
  const sellable = sellableProducts(state);
  const clients = (Object.keys(CLIENTS) as ClientId[]).filter((c) => CLIENTS[c].products.some((p) => sellable.includes(p)));
  if (!clients.length) return undefined;
  const client = clients[Math.floor(random() * clients.length)];
  const options = CLIENTS[client].products.filter((p) => sellable.includes(p));
  const product = options[Math.floor(random() * options.length)];
  const qty = 4 + Math.floor(random() * (4 + 2 * state.level));
  return { kind: 'order', client, product, qty, pay: Math.round(PRODUCTS[product].basePrice * ORDER_MARKUP) };
}

/**
 * Ответ на утреннее событие. Проверка — просто уведомление.
 */
export function answerEvent(state: StoreState, _accept: boolean): StoreState | null {
  const plan = state.plan;
  const event = plan?.event;
  if (!plan || !event || plan.decided) return null;
  return { ...state, plan: { ...plan, decided: true } };
}

/** Ответ на заказ клиента с доски «Заказы»: принять — вечером заберут, отказать — заказ уходит. */
export function answerOrder(state: StoreState, accept: boolean): StoreState | null {
  const offer = state.plan?.offer;
  if (!state.plan || !offer) return null;
  return { ...state, plan: { ...state.plan, offer: undefined, order: accept ? offer : state.plan.order } };
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
  const onShelves = state.shelves.reduce((sum, s) => sum + (s.items[product]?.length ?? 0), 0);
  if (inWarehouse.length + onShelves < qty) {
    return { state: { ...state, rating: Math.max(0, state.rating - ORDER_FAILED_RATING) }, delivered: false, earned: 0 };
  }
  let need = qty;
  const fromWarehouse = Math.min(need, inWarehouse.length);
  need -= fromWarehouse;
  const shelves = state.shelves.map((s) => {
    if (need === 0) return s;
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

/** Проверка: мусор, туалет, брак без уценки на полках. */
export function inspect(state: StoreState, scene: { trash: number; toiletDirt: number }): InspectionResult {
  const problems: TextKey[] = [];
  if (scene.trash >= 2) problems.push('inspection.trash');
  if (scene.toiletDirt >= 50) problems.push('inspection.toilet');
  if (state.shelves.some((s) => Object.values(s.items).some((units) => units?.some((u) => u.bad && !u.markdown))))
    problems.push('inspection.badGoods');
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
