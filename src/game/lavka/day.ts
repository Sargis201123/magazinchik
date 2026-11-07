// «Лавка «Своё»» — правила одного дня (вторая игра, docs/farm/mockup). Без Phaser: сцена (src/lavka) только
// показывает и зовёт эти функции, тесты — tests/lavkaDay.test.ts.
//
// Главное решение дня — утром: сколько бидонов молока пустить на сыр. Свежее молоко дешёвое и к вечеру
// скисает, зато за ним приходят дачники с электрички и заодно берут овощи. Сыр дорогой и не портится, но
// его любят туристы с автобуса в 11:00, а большая партия зреет дольше — может к автобусу не успеть.

export type Good = 'milk' | 'cheese' | 'veg' | 'bread' | 'jam';
export const GOODS: Good[] = ['milk', 'cheese', 'veg', 'bread', 'jam'];
export type From = 'road' | 'bus' | 'train';

/** День идёт с 8:00 до 20:00 за столько секунд (при скорости ×1): час — 15 секунд. */
export const DAY_SECONDS = 180;
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;
const HOUR = DAY_SECONDS / (CLOSE_HOUR - OPEN_HOUR);

/** Утренний надой, сколько бидонов на головку сыра и сколько бутылок в бидоне. */
export const CANS = 12;
export const CANS_PER_HEAD = 3;
export const BOTTLES_PER_CAN = 2;
export const PRICE: Record<Good, number> = { milk: 8, cheese: 60, veg: 6, bread: 5, jam: 12 };
/** Сколько бутылок влезает на молочную полку и головок — на витрину зала. */
export const SHELF_MILK = 6;
export const CASE_CHEESE = 4;
/** Автобус с туристами всегда в 11:00 (если он сегодня есть). */
export const BUS_AT = 45;
/** Марат допекает хлеб к обеду. */
export const BREAD_AT = 75;

/** Секунда дня → «10:40». */
export function clock(t: number): string {
  const minutes = Math.round((OPEN_HOUR * 60 + (Math.max(0, Math.min(DAY_SECONDS, t)) / HOUR) * 60) / 10) * 10;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Секунда дня, когда в сыроварне созреет партия из heads головок (больше — дольше). Нет сыра — никогда. */
export function cheeseReadyAt(heads: number): number {
  if (heads <= 0) return Infinity;
  return (1.4 + 0.7 * heads) * HOUR;
}

export interface Visitor {
  /** Когда появляется (секунды дня). */
  at: number;
  from: From;
  wants: Good;
  qty: number;
  /** Пришёл за молоком и, если взял, прихватит ещё вот это. */
  extra?: Good;
}

/** Предсказуемый генератор (как look.ts у магазина): один и тот же день — те же покупатели. */
function rng(seed: number): () => number {
  let s = (Math.imul(seed, 2654435761) ^ 0x9e3779b9) >>> 0 || 1;
  const next = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
  // Первые числа xorshift у маленьких зёрен похожи — пропускаем разгон.
  for (let i = 0; i < 12; i++) next();
  return next;
}

function pick(r: () => number, weights: Partial<Record<Good, number>>): Good {
  const entries = Object.entries(weights) as [Good, number][];
  let x = r() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [g, w] of entries) {
    x -= w;
    if (x <= 0) return g;
  }
  return entries[entries.length - 1][0];
}

export interface Arrival {
  /** Секунда дня. */
  at: number;
  people: number;
}

/** План дня — его видно утром: будет ли автобус с туристами (они за сыром) и когда электрички (дачники — за молоком). */
export interface Plan {
  /** День недели (ключ подписи: lavka.dow.<dow>). */
  dow: 'sat' | 'sun' | 'mon';
  bus: Arrival | null;
  trains: Arrival[];
}

/** Три дня подряд — три разных ответа на утренний вопрос: суббота — поровну, воскресенье — туристы, понедельник — дачники. */
export const PLANS: Plan[] = [
  { dow: 'sat', bus: { at: BUS_AT, people: 5 }, trains: [{ at: 105, people: 7 }] },
  { dow: 'sun', bus: { at: BUS_AT, people: 9 }, trains: [{ at: 135, people: 4 }] },
  { dow: 'mon', bus: null, trains: [{ at: 30, people: 6 }, { at: 150, people: 8 }] },
];

export const planFor = (dayIndex: number): Plan => PLANS[((dayIndex % PLANS.length) + PLANS.length) % PLANS.length];

/** Кто придёт за день: трасса весь день, автобус туристов, электрички с дачниками. */
export function visitors(plan: Plan = PLANS[0], seed = 1): Visitor[] {
  const r = rng(seed);
  const out: Visitor[] = [];
  const add = (at: number, from: From, wants: Good): void => {
    const v: Visitor = { at, from, wants, qty: wants === 'milk' && r() < 0.45 ? 2 : 1 };
    if (wants === 'milk' && r() < 0.5) v.extra = pick(r, { veg: 3, bread: 2, jam: 1 });
    out.push(v);
  };
  for (let at = 4; at < DAY_SECONDS - 10; at += 6 + r() * 4) {
    add(at, 'road', pick(r, { milk: 2, cheese: 0.8, veg: 3.2, bread: 2.2, jam: 1.8 }));
  }
  if (plan.bus) for (let i = 0; i < plan.bus.people; i++) add(plan.bus.at + 2 + i * 1.3, 'bus', pick(r, { cheese: 7, jam: 2, bread: 1 }));
  for (const train of plan.trains) for (let i = 0; i < train.people; i++) add(train.at + 3 + i * 1.6, 'train', pick(r, { milk: 7, veg: 2, bread: 1 }));
  return out.sort((a, b) => a.at - b.at);
}

export interface Day {
  t: number;
  /** Сколько бидонов утром пустили на сыр и сколько головок из них выйдет. */
  cheeseCans: number;
  heads: number;
  /** Молоко в бутылках: на полке зала и в леднике сыроварни. */
  milkShelf: number;
  milkIce: number;
  /** Сыр: зреет в сыроварне, готов (ждёт, пока отнесут), на витрине зала. */
  cheeseMaking: number;
  cheeseReady: number;
  cheeseCase: number;
  veg: number;
  bread: number;
  jam: number;
  breadBaked: boolean;
  coins: number;
  sold: Record<Good, number>;
  /** Хотели, а не было — по товарам; не дождались у кассы. */
  missed: Record<Good, number>;
  tired: number;
  served: number;
}

const zero = (): Record<Good, number> => ({ milk: 0, cheese: 0, veg: 0, bread: 0, jam: 0 });

/** Утро: cheeseCans бидонов — на сыр (кратно трём), остальные — в продажу; полка полная, остальное в леднике. */
export function startDay(cheeseCans: number): Day {
  const cans = Math.max(0, Math.min(CANS, Math.floor(cheeseCans / CANS_PER_HEAD) * CANS_PER_HEAD));
  const bottles = (CANS - cans) * BOTTLES_PER_CAN;
  const shelf = Math.min(SHELF_MILK, bottles);
  return {
    t: 0,
    cheeseCans: cans,
    heads: cans / CANS_PER_HEAD,
    milkShelf: shelf,
    milkIce: bottles - shelf,
    cheeseMaking: cans / CANS_PER_HEAD,
    cheeseReady: 0,
    cheeseCase: 0,
    veg: 40,
    bread: 12,
    jam: 10,
    breadBaked: false,
    coins: 0,
    sold: zero(),
    missed: zero(),
    tired: 0,
    served: 0,
  };
}

/** Время идёт: созревает сыр, Марат допекает хлеб. */
export function tick(d: Day, dt: number): Day {
  const t = Math.min(DAY_SECONDS, d.t + dt);
  let next: Day = { ...d, t };
  if (next.cheeseMaking > 0 && t >= cheeseReadyAt(d.heads)) next = { ...next, cheeseReady: next.cheeseReady + next.cheeseMaking, cheeseMaking: 0 };
  if (!next.breadBaked && t >= BREAD_AT) next = { ...next, bread: next.bread + 10, breadBaked: true };
  return next;
}

export const isOver = (d: Day): boolean => d.t >= DAY_SECONDS;

/** Долить молочную полку из ледника. Сколько перенесли — для полёта бутылок. */
export function restockMilk(d: Day): { day: Day; n: number } {
  const n = Math.min(SHELF_MILK - d.milkShelf, d.milkIce);
  if (n <= 0) return { day: d, n: 0 };
  return { day: { ...d, milkShelf: d.milkShelf + n, milkIce: d.milkIce - n }, n };
}

/** Отнести готовый сыр из сыроварни на витрину зала. */
export function carryCheese(d: Day): { day: Day; n: number } {
  const n = Math.min(CASE_CHEESE - d.cheeseCase, d.cheeseReady);
  if (n <= 0) return { day: d, n: 0 };
  return { day: { ...d, cheeseCase: d.cheeseCase + n, cheeseReady: d.cheeseReady - n }, n };
}

/** Сколько товара доступно покупателю в зале (сыр — только на витрине, молоко — только на полке). */
export function available(d: Day, g: Good): number {
  switch (g) {
    case 'milk':
      return d.milkShelf;
    case 'cheese':
      return d.cheeseCase;
    default:
      return d[g];
  }
}

/** Покупатель берёт с полки до qty штук. */
export function take(d: Day, g: Good, qty: number): { day: Day; n: number } {
  const n = Math.min(qty, available(d, g));
  if (n <= 0) return { day: d, n: 0 };
  const key = g === 'milk' ? 'milkShelf' : g === 'cheese' ? 'cheeseCase' : g;
  return { day: { ...d, [key]: d[key] - n }, n };
}

export interface Basket {
  good: Good;
  n: number;
}

/** Касса: сколько монет за корзину. */
export function pay(d: Day, basket: Basket[]): { day: Day; coins: number } {
  const coins = basket.reduce((a, b) => a + PRICE[b.good] * b.n, 0);
  const sold = { ...d.sold };
  for (const b of basket) sold[b.good] += b.n;
  return { day: { ...d, coins: d.coins + coins, sold, served: d.served + 1 }, coins };
}

/** Хотел, а не было — ушёл без покупки. */
export function miss(d: Day, g: Good): Day {
  return { ...d, missed: { ...d.missed, [g]: d.missed[g] + 1 } };
}

/** Не дождался у кассы — корзину вернул на полку (кроме сыра и молока: их кладут обратно туда же). */
export function tired(d: Day, basket: Basket[]): Day {
  let next = { ...d, tired: d.tired + 1 };
  for (const b of basket) {
    const key = b.good === 'milk' ? 'milkShelf' : b.good === 'cheese' ? 'cheeseCase' : b.good;
    next = { ...next, [key]: next[key] + b.n };
  }
  return next;
}

export type Tip = 'cheeseLate' | 'moreCheese' | 'moreMilk' | 'lessMilk' | 'faster' | 'good';

export interface Summary {
  coins: number;
  sold: Record<Good, number>;
  /** Скисло бутылок (всё непроданное молоко), осталось головок (не портятся — уйдут завтра). */
  sour: number;
  cheeseLeft: number;
  missedTotal: number;
  tired: number;
  served: number;
  /** Доля довольных: купили / все, кто пришёл в лавку. */
  happy: number;
  stars: number;
  tip: Tip;
}

export function summary(d: Day): Summary {
  const missedTotal = GOODS.reduce((a, g) => a + d.missed[g], 0);
  const came = d.served + missedTotal + d.tired;
  const happy = came ? d.served / came : 1;
  const stars = happy >= 0.85 ? 5 : happy >= 0.75 ? 4 : happy >= 0.6 ? 3 : happy >= 0.45 ? 2 : 1;
  const sour = d.milkShelf + d.milkIce;
  let tip: Tip = 'good';
  if (d.missed.cheese >= 3 && d.heads > 0 && cheeseReadyAt(d.heads) > BUS_AT) tip = 'cheeseLate';
  else if (d.missed.cheese >= 3) tip = 'moreCheese';
  else if (d.missed.milk >= 3) tip = 'moreMilk';
  else if (d.tired >= 2) tip = 'faster';
  else if (sour >= 4) tip = 'lessMilk';
  return {
    coins: d.coins,
    sold: d.sold,
    sour,
    cheeseLeft: d.cheeseMaking + d.cheeseReady + d.cheeseCase,
    missedTotal,
    tired: d.tired,
    served: d.served,
    happy,
    stars,
    tip,
  };
}
