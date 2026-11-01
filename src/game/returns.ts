// «Повод вернуться завтра»: что копится, пока игрока нет, и открывается маленьким ритуалом утром.
//
// Сундучок выручки — не новые деньги, а упаковка уже существующих: торговля кассира без хозяина
// (away.ts) и доход филиала (branch.ts branchAway). Деньги из них не сразу в кассу, а в сундучок —
// игрок открывает его касанием, монеты сыплются. Пока не открыт, копится дальше (не теряется).
//
// Письмо или открытка — от бабушки, соседки Валентины, Сони или постоянного покупателя. Отправитель
// выбирается вечером (бот назовёт его в напоминании), а приходит письмо только на следующий
// настоящий день — повод заглянуть завтра. Награда маленькая: бабушка вкладывает немного денег,
// постоянный покупатель доверяет чуть больше.
//
// Заказ соседа на завтра: вечером постоянный покупатель просит отложить свой любимый товар —
// это видно в «Завтра:» итогов дня. Утром он приходит, как обещал: есть товар — забирает и платит
// чуть сверх цены; нет — зайдёт к закрытию, а не дождался — без обид.

import { onShelves, PRODUCTS, sellableProducts, warehouseOf, type ProductId, type StoreState } from './economy';
import { MAX_LOYALTY, regularState, REGULARS, type RegularId } from './regulars';
import { homeLevel } from './zarshop';
import { awayTrade, AWAY_MAX_HOURS } from './away';
import { branchAway, BRANCH_AWAY_MAX_HOURS } from './branch';
import { take } from './tales';
import { takeFarewellLetter, type Farewell } from './career';
import type { TextKey } from '../i18n/ru';

export interface Chest {
  /** Сколько денег внутри. */
  sum: number;
  /** Из них — торговля кассира и доход филиала. */
  cashier: number;
  branch: number;
  /** Сколько часов копилось и сколько штук продал кассир. */
  hours: number;
  units: number;
}

export type LetterFrom = 'grandma' | 'valya' | 'sonya' | 'staff' | RegularId;

export interface Letter {
  from: LetterFrom;
  /** Номер текста (letter.<кто>.<n>). */
  n: number;
  /** Местная дата, когда письмо «отправили»: придёт на следующий день или позже. */
  date: string;
  /** Прощальное письмо сотрудника, ушедшего по своим делам (career.ts): кто и сколько проработал. */
  farewell?: Farewell;
}

export interface NeighbourOrder {
  who: RegularId;
  pid: ProductId;
  qty: number;
  /** Игровой день, на который обещан. */
  day: number;
}

export interface ReturnState {
  chest?: Chest;
  letter?: Letter;
  order?: NeighbourOrder;
  /** Последний местный день, когда игра открывалась (аналитика возвращений). */
  seen?: string;
}

// ---------- Сундучок выручки ----------

/**
 * Положить заработанное без игрока в сундучок: деньги, которые awayTrade и branchAway уже добавили
 * к state.money, переезжают в сундучок (ничего не начисляется дважды): part — сколько начислили.
 */
export function stashAway(after: StoreState, part: { cashier: number; branch: number; hours: number; units: number }): StoreState {
  const sum = part.cashier + part.branch;
  if (sum <= 0) return after;
  const old = after.ret?.chest;
  const chest: Chest = {
    sum: (old?.sum ?? 0) + sum,
    cashier: (old?.cashier ?? 0) + part.cashier,
    branch: (old?.branch ?? 0) + part.branch,
    hours: (old?.hours ?? 0) + part.hours,
    units: (old?.units ?? 0) + part.units,
  };
  return { ...after, money: after.money - sum, ret: { ...after.ret, chest } };
}

/** Открыть сундучок: деньги — в кассу. null — сундучка нет. */
export function openChest(state: StoreState): { state: StoreState; chest: Chest } | null {
  const chest = state.ret?.chest;
  if (!chest) return null;
  const ret: ReturnState = { ...state.ret };
  delete ret.chest;
  return { state: { ...state, money: state.money + chest.sum, ret }, chest };
}

/** Сколько примерно будет в сундучке, если игрок не зайдёт до конца: для бота («около 1 200»). */
export function chestEstimate(state: StoreState): number {
  const hours = Math.max(AWAY_MAX_HOURS, BRANCH_AWAY_MAX_HOURS);
  const cashier = awayTrade(state, hours * 3_600_000)?.revenue ?? 0;
  const branch = branchAway(state, hours * 3_600_000)?.income ?? 0;
  return (state.ret?.chest?.sum ?? 0) + cashier + branch;
}

/** Круглое число для бота: до сотен, крупное — до тысяч. */
export const roundSum = (n: number): number => (n >= 10_000 ? Math.round(n / 1000) * 1000 : n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

// ---------- Письма ----------

/** Сколько вариантов текста у каждого отправителя (letter.<кто>.<n>, n с 1). */
export const LETTER_VARIANTS = { grandma: 8, valya: 6, sonya: 6, regular: 8, staff: 4 } as const;
/** Соня пишет с этого дня (до того игрок её ещё толком не знает). */
export const SONYA_LETTERS_FROM = 5;
/** Бабушка вкладывает в письмо немного денег: столько + столько за каждое помещение. */
export const letterCoins = (state: StoreState): number => 15 + 15 * homeLevel(state);

export const letterGroup = (from: LetterFrom): keyof typeof LETTER_VARIANTS =>
  from === 'grandma' || from === 'valya' || from === 'sonya' || from === 'staff' ? from : 'regular';

export const letterKey = (l: Pick<Letter, 'from' | 'n'>): TextKey => `letter.${letterGroup(l.from)}.${l.n}` as TextKey;

/** Кто может написать: бабушка и Валентина всегда, Соня — с пятого дня, постоянные — кто уже знаком. */
export function letterSenders(state: StoreState): LetterFrom[] {
  const out: LetterFrom[] = ['grandma', 'valya'];
  if (state.day >= SONYA_LETTERS_FROM) out.push('sonya');
  // В Заречье постоянные свои (zarechye.ts): письма от соседей Центра — когда игрок дома.
  if (state.zar?.at !== 'zar') for (const r of REGULARS) if (state.day >= r.from && regularState(state, r.id).awayUntil < state.day) out.push(r.id);
  return out;
}

/** Вечером: написать письмо на завтра, если ещё не ждёт. today — местная дата. */
export function planLetter(state: StoreState, today: string, random: () => number): StoreState {
  if (state.ret?.letter || state.bankrupt) return state;
  // Ушёл давний сотрудник — его прощальное письмо идёт первым (career.ts).
  const farewell = takeFarewellLetter(state);
  if (farewell) return { ...farewell.state, ret: { ...farewell.state.ret, letter: { from: 'staff', n: farewell.farewell.why, date: today, farewell: farewell.farewell } } };
  const senders = letterSenders(state);
  // Бабушка — чаще остальных: она пишет внуку каждый день.
  const from = random() < 0.35 ? 'grandma' : senders[Math.floor(random() * senders.length)];
  const n = 1 + Math.floor(random() * LETTER_VARIANTS[letterGroup(from)]);
  return { ...state, ret: { ...state.ret, letter: { from, n, date: today } } };
}

export interface LetterGift {
  letter: Letter;
  /** Бабушка вложила денег. */
  money?: number;
  /** Постоянный покупатель стал доверять больше. */
  loyalty?: RegularId;
}

/** Утром: письмо пришло, если с вечера сменился настоящий день. */
export function takeLetter(state: StoreState, today: string): { state: StoreState; gift: LetterGift } | null {
  const letter = state.ret?.letter;
  if (!letter || !(today > letter.date)) return null;
  const ret: ReturnState = { ...state.ret };
  delete ret.letter;
  let next: StoreState = { ...state, ret };
  const gift: LetterGift = { letter };
  if (letter.from === 'grandma') {
    gift.money = letterCoins(state);
    next = { ...next, money: next.money + gift.money };
  } else if (letterGroup(letter.from) === 'regular') {
    const id = letter.from as RegularId;
    const cur = regularState(next, id);
    if (cur.loyalty < MAX_LOYALTY) {
      gift.loyalty = id;
      next = { ...next, regulars: { ...next.regulars, [id]: { ...cur, loyalty: cur.loyalty + 1 } } };
    }
  }
  return { state: next, gift };
}

// ---------- Заказ соседа на завтра ----------

/** С какого дня соседи просят отложить. */
export const ORDER_FROM_DAY = 3;
/** Как часто: доля вечеров. */
export const ORDER_CHANCE = 0.5;
/** Платит за штуку чуть больше своей цены магазина — за то, что отложили. */
export const ORDER_MARKUP = 1.2;

export const orderQty = (state: StoreState): number => Math.min(8, 3 + state.level);

/**
 * После ночи (state — уже утро нового игрового дня, его и обещаем): постоянный покупатель просит
 * отложить свой любимый товар. Только знакомые, не в обиде, и товар здесь продаётся.
 */
export function planOrder(state: StoreState, random: () => number): StoreState {
  // В Заречье соседи свои (zarechye.ts) — заказ «отложи мне» просят только в Центре.
  if (state.ret?.order || state.bankrupt || state.zar?.at === 'zar' || state.day < ORDER_FROM_DAY || random() >= ORDER_CHANCE) return state;
  const sellable = sellableProducts(state);
  const who = REGULARS.filter((r) => state.day >= r.from && regularState(state, r.id).awayUntil < state.day && sellable.includes(r.favorite));
  if (!who.length) return state;
  const r = who[Math.floor(random() * who.length)];
  return { ...state, ret: { ...state.ret, order: { who: r.id, pid: r.favorite, qty: orderQty(state), day: state.day } } };
}

export const orderPay = (state: StoreState, o: NeighbourOrder): number => Math.round(state.prices[o.pid] * ORDER_MARKUP) * o.qty;

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

export type OrderResult = { state: StoreState; order: NeighbourOrder; paid: number } | { state: StoreState; order: NeighbourOrder; paid: 0; waiting: true };

/**
 * Сосед пришёл за заказом (утром — сразу, вечером — повторно). Товар есть — забирает и платит;
 * нет — ждёт закрытия (waiting). Заказ не на сегодня — null. Устаревший (день прошёл) убирается.
 */
export function collectOrder(state: StoreState): OrderResult | null {
  const o = state.ret?.order;
  if (!o) return null;
  if (o.day < state.day) return { state: dropOrder(state), order: o, paid: 0, waiting: true };
  if (o.day > state.day) return null;
  if (stockOf(state, o.pid) < o.qty) return { state, order: o, paid: 0, waiting: true };
  const paid = orderPay(state, o);
  const taken = take(state, o.pid, o.qty);
  return { state: { ...dropOrder(taken), money: taken.money + paid }, order: o, paid };
}

/** Забыть заказ (выдали или сосед не дождался). */
export function dropOrder(state: StoreState): StoreState {
  if (!state.ret?.order) return state;
  const ret: ReturnState = { ...state.ret };
  delete ret.order;
  return { ...state, ret };
}

/** Строка в «Завтра:» итогов дня: кто и за чем придёт. */
export function orderTeaser(state: StoreState): { key: TextKey; params: Record<string, string | number> } | null {
  const o = state.ret?.order;
  if (!o || o.day !== state.day) return null;
  const r = REGULARS.find((x) => x.id === o.who)!;
  return { key: 'ret.order.teaser', params: { name: r.nameKey, qty: o.qty, icon: PRODUCTS[o.pid].icon, pay: orderPay(state, o) } };
}

// ---------- Для бота и аналитики ----------

/** Что ждёт игрока — для напоминания бота (api/_lib/remind.ts): сумма, отправитель письма, заказ. */
export interface Waiting {
  chest: number;
  letter: string;
  order: string;
  qty: number;
}

export function waitingHooks(state: StoreState): Waiting {
  const o = state.ret?.order;
  return {
    chest: roundSum(chestEstimate(state)),
    letter: state.ret?.letter?.from ?? '',
    order: o ? `${o.who}:${o.pid}` : '',
    qty: o?.qty ?? 0,
  };
}

/** Дней между двумя местными датами «ГГГГ-ММ-ДД» (b позже — плюс). */
export function daysApart(a: string, b: string): number {
  const at = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  return Math.round(at(b) - at(a));
}

/** Игра открылась сегодня: через сколько дней после прошлого раза (0 — в тот же день, null — впервые). */
export function noteSeen(state: StoreState, today: string): { state: StoreState; gap: number | null } {
  const seen = state.ret?.seen;
  const gap = seen && /^\d{4}-\d{2}-\d{2}$/.test(seen) ? daysApart(seen, today) : null;
  if (seen === today) return { state, gap };
  return { state: { ...state, ret: { ...state.ret, seen: today } }, gap };
}
