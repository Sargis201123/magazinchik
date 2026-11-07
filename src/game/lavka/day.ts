// «Лавка «Своё»» — правила одного дня на ферме (вторая игра, docs/farm/LAVKA.md). Без Phaser: сцена (src/lavka)
// показывает и зовёт эти функции, тесты — tests/lavkaDay.test.ts.
//
// Работа — на ферме, касаниями, и касаний немного: огород — шесть больших грядок, на каждую сам выбираешь семена
// (укроп поспевает быстро и даёт мало, тыква — долго и много; можно засеять все пустые разом); корова одна, и все
// готовые в загоне доятся одним касанием (их станет больше); яйца копятся в гнёздах, собираются все разом; сад —
// яблони и ульи. Без сена молока нет, без зерна куры не несутся. Из молока в лавке варят сыр. Собранное идёт
// сначала в заказы дня (набрал к сроку — цена и премия), остальное — в лавку, а лавка продаёт сама, папа за
// прилавком. Чего нет на складе, того не купят.

export type Good = 'milk' | 'eggs' | 'veg' | 'honey' | 'cheese';
export const GOODS: Good[] = ['milk', 'eggs', 'veg', 'honey', 'cheese'];
export type From = 'road' | 'bus' | 'train';

/** День с 8:00 до 20:00 за столько секунд (×1): час — 20 секунд. */
export const DAY_SECONDS = 240;
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;
const HOUR = DAY_SECONDS / (CLOSE_HOUR - OPEN_HOUR);

export const PRICE: Record<Good, number> = { milk: 8, eggs: 3, veg: 5, honey: 18, cheese: 35 };

/** Семена: сколько секунд растёт и сколько овощей даёт. Чем дольше — тем больше за одно касание. */
export type Seed = 'dill' | 'carrot' | 'strawberry' | 'pumpkin';
export const SEEDS: Seed[] = ['dill', 'carrot', 'strawberry', 'pumpkin'];
export const SEED: Record<Seed, { grow: number; yield: number }> = {
  dill: { grow: 30, yield: 3 },
  carrot: { grow: 55, yield: 6 },
  strawberry: { grow: 75, yield: 8 },
  pumpkin: { grow: 110, yield: 12 },
};

/** Корова набирает молоко за столько секунд (если сыта) и даёт столько бутылок; сена хватает на HAY_FULL доек. */
export const COW_FILL = 25;
export const COW_YIELD = 2;
export const HAY_FULL = 8;
/** Куры: всё стадо несёт яйцо раз в HEN_LAY секунд (если есть зерно); зерна хватает на GRAIN_FULL яиц. */
export const HEN_LAY = 10;
export const GRAIN_FULL = 12;
/** Сколько яиц помещается в гнёздах (дальше куры не несутся, пока не соберёшь). */
export const EGGS_MAX = 6;
/** Ульи и яблони: через сколько секунд снова есть что снять и сколько. */
export const HIVE_FILL = 50;
export const TREE_FILL = 45;
export const TREE_YIELD = 4;
/** Сыр: на головку уходит столько молока и столько секунд. */
export const CHEESE_MILK = 3;
export const CHEESE_TIME = 30;

export const COWS = 1;
export const HENS = 4;
export const BEDS = 6;
export const HIVES = 2;
export const TREES = 2;

/** Секунда дня → «10:40». */
export function clock(t: number): string {
  const minutes = Math.round((OPEN_HOUR * 60 + (Math.max(0, Math.min(DAY_SECONDS, t)) / HOUR) * 60) / 10) * 10;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export const atHour = (hour: number): number => (hour - OPEN_HOUR) * HOUR;

// ---------------------------------------------------------------- состояние фермы

export interface Bed {
  /** Что посажено (null — пусто: нажать — выбрать семена) и сколько выросло: 0…1, 1 — пора собирать. */
  seed: Seed | null;
  grow: number;
}

export interface Order {
  id: 'marat' | 'cafe' | 'tourists' | 'school' | 'fair';
  good: Good;
  need: number;
  /** К какой секунде дня. */
  by: number;
  bonus: number;
  /** Сколько уже собрано в этот заказ. */
  have: number;
  done: boolean;
  failed: boolean;
}

export interface Day {
  t: number;
  /** Молоко у каждой коровы: 0…1, 1 — пора доить. */
  cows: number[];
  hay: number;
  /** Сколько яиц лежит в гнёздах и сколько секунд до следующего. */
  eggs: number;
  layIn: number;
  grain: number;
  beds: Bed[];
  hives: number[];
  trees: number[];
  /** Сыр в сыроварне: сколько секунд до готовности (0 — не варится). */
  cheese: number;
  /** Склад лавки: что собрано и ждёт покупателя. */
  stock: Record<Good, number>;
  coins: number;
  collected: Record<Good, number>;
  sold: Record<Good, number>;
  /** Хотели, а не было. */
  missed: Record<Good, number>;
  served: number;
  orders: Order[];
  /** Сколько ферма простаивала: корова ждала дойки, гнёзда были полны, грядка пустовала (для совета вечером). */
  idle: { cows: number; eggs: number; empty: number };
}

const zero = (): Record<Good, number> => ({ milk: 0, eggs: 0, veg: 0, honey: 0, cheese: 0 });

/** Утро: корова почти полна, в гнёздах пара яиц, половина огорода засажена, ульи и яблони — в начале. */
export function startDay(plan: Plan): Day {
  // Что лежит в лавке с утра, сразу откладывается в заказы дня.
  const stock: Record<Good, number> = { milk: 2, eggs: 2, veg: 4, honey: 0, cheese: 1 };
  const orders = plan.orders.map((o) => {
    const have = Math.min(o.need - 1, stock[o.good]);
    stock[o.good] -= have;
    return { ...o, have, done: false, failed: false };
  });
  return {
    t: 0,
    cows: [0.7],
    hay: 6,
    eggs: 2,
    layIn: HEN_LAY,
    grain: 8,
    beds: [
      { seed: 'carrot', grow: 0.75 },
      { seed: 'dill', grow: 0.3 },
      { seed: null, grow: 0 },
      { seed: 'strawberry', grow: 0.5 },
      { seed: null, grow: 0 },
      { seed: null, grow: 0 },
    ],
    hives: [0.6, 0.2],
    trees: [0.5, 0.85],
    cheese: 0,
    stock,
    coins: 0,
    collected: zero(),
    sold: zero(),
    missed: zero(),
    served: 0,
    orders,
    idle: { cows: 0, eggs: 0, empty: 0 },
  };
}

const fill = (v: number, dt: number, seconds: number): number => Math.min(1, v + dt / seconds);

/** Время идёт: корова набирает молоко (если сыта), куры несутся (если есть зерно и место в гнёздах), грядки растут. */
export function tick(d: Day, dt: number): Day {
  const t = Math.min(DAY_SECONDS, d.t + dt);
  const idle = { ...d.idle };
  const cows = d.cows.map((m) => {
    if (m >= 1) idle.cows += dt;
    return d.hay > 0 ? fill(m, dt, COW_FILL) : m;
  });
  let { eggs, layIn, grain } = d;
  if (eggs >= EGGS_MAX) idle.eggs += dt;
  if (grain > 0 && eggs < EGGS_MAX) {
    layIn -= dt;
    while (layIn <= 0 && grain > 0 && eggs < EGGS_MAX) {
      layIn += HEN_LAY;
      grain -= 1;
      eggs += 1;
    }
  }
  const beds = d.beds.map((b) => {
    if (!b.seed) {
      idle.empty += dt;
      return b;
    }
    return b.grow >= 1 ? b : { ...b, grow: fill(b.grow, dt, SEED[b.seed].grow) };
  });
  const cheese = d.cheese > 0 ? Math.max(0, d.cheese - dt) : 0;
  let next: Day = {
    ...d,
    t,
    cows,
    eggs,
    layIn,
    grain,
    beds,
    hives: d.hives.map((h) => fill(h, dt, HIVE_FILL)),
    trees: d.trees.map((h) => fill(h, dt, TREE_FILL)),
    cheese,
    idle,
  };
  if (d.cheese > 0 && cheese === 0) next = add(next, 'cheese', 1);
  return settleOrders(next);
}

export const isOver = (d: Day): boolean => d.t >= DAY_SECONDS;

/** Собрал n штук: сначала — в открытый заказ на этот товар (он ждёт), остальное — на склад лавки. */
const add = (d: Day, g: Good, n: number): Day => {
  let left = n;
  let coins = d.coins;
  let sold = d.sold;
  const orders = d.orders.map((o) => {
    if (o.good !== g || o.done || o.failed || left <= 0) return o;
    const put = Math.min(left, o.need - o.have);
    left -= put;
    const have = o.have + put;
    if (have < o.need) return { ...o, have };
    coins += o.need * PRICE[g] + o.bonus;
    sold = { ...sold, [g]: sold[g] + o.need };
    return { ...o, have, done: true };
  });
  return { ...d, orders, coins, sold, stock: { ...d.stock, [g]: d.stock[g] + left }, collected: { ...d.collected, [g]: d.collected[g] + n } };
};

/** Касания на ферме. Каждое возвращает новый день и сколько чего получилось (0 — нечего делать). */

/** Подоить всех полных коров в загоне разом (одно касание по любой). */
export function milkAll(d: Day): { day: Day; n: number; cows: number[] } {
  const ready = d.cows.map((m, i) => (m >= 1 ? i : -1)).filter((i) => i >= 0);
  if (!ready.length) return { day: d, n: 0, cows: [] };
  const n = ready.length * COW_YIELD;
  const cows = d.cows.map((m) => (m >= 1 ? 0 : m));
  return { day: add({ ...d, cows, hay: Math.max(0, d.hay - ready.length) }, 'milk', n), n, cows: ready };
}

export function feedHay(d: Day): { day: Day; n: number } {
  if (d.hay >= HAY_FULL) return { day: d, n: 0 };
  return { day: { ...d, hay: HAY_FULL }, n: HAY_FULL - d.hay };
}

/** Собрать все яйца из гнёзд. */
export function pickEggs(d: Day): { day: Day; n: number } {
  if (d.eggs <= 0) return { day: d, n: 0 };
  return { day: add({ ...d, eggs: 0 }, 'eggs', d.eggs), n: d.eggs };
}

export function feedGrain(d: Day): { day: Day; n: number } {
  if (d.grain >= GRAIN_FULL) return { day: d, n: 0 };
  return { day: { ...d, grain: GRAIN_FULL }, n: GRAIN_FULL - d.grain };
}

export type BedTap = 'harvest' | 'plant' | 'growing';

/** Что сделает касание грядки: пусто — выбрать семена, поспела — собрать, иначе — растёт. */
export function bedAction(b: Bed): BedTap {
  if (!b.seed) return 'plant';
  return b.grow >= 1 ? 'harvest' : 'growing';
}

/** Посадить на грядку (если пустая). */
export function plant(d: Day, i: number, seed: Seed): { day: Day; n: number } {
  if (d.beds[i]?.seed !== null) return { day: d, n: 0 };
  return { day: { ...d, beds: d.beds.map((b, k) => (k === i ? { seed, grow: 0 } : b)) }, n: 1 };
}

/** Засеять все пустые грядки одним семенем. */
export function plantAll(d: Day, seed: Seed): { day: Day; n: number; beds: number[] } {
  const empty = d.beds.map((b, i) => (b.seed ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return { day: d, n: 0, beds: [] };
  return { day: { ...d, beds: d.beds.map((b) => (b.seed ? b : { seed, grow: 0 })) }, n: empty.length, beds: empty };
}

/** Снять урожай с грядки — грядка пустеет. */
export function harvest(d: Day, i: number): { day: Day; n: number; seed: Seed | null } {
  const b = d.beds[i];
  if (!b?.seed || b.grow < 1) return { day: d, n: 0, seed: null };
  const n = SEED[b.seed].yield;
  return { day: add({ ...d, beds: d.beds.map((x, k) => (k === i ? { seed: null, grow: 0 } : x)) }, 'veg', n), n, seed: b.seed };
}

export function takeHoney(d: Day, hive: number): { day: Day; n: number } {
  if (d.hives[hive] < 1) return { day: d, n: 0 };
  return { day: add({ ...d, hives: d.hives.map((h, i) => (i === hive ? 0 : h)) }, 'honey', 1), n: 1 };
}

export function shakeTree(d: Day, tree: number): { day: Day; n: number } {
  if (d.trees[tree] < 1) return { day: d, n: 0 };
  return { day: add({ ...d, trees: d.trees.map((h, i) => (i === tree ? 0 : h)) }, 'veg', TREE_YIELD), n: TREE_YIELD };
}

/** Поставить сыр: забирает молоко со склада лавки, через CHEESE_TIME секунд — головка на складе. */
export function startCheese(d: Day): { day: Day; n: number } {
  if (d.cheese > 0 || d.stock.milk < CHEESE_MILK) return { day: d, n: 0 };
  return { day: { ...d, cheese: CHEESE_TIME, stock: { ...d.stock, milk: d.stock.milk - CHEESE_MILK } }, n: 1 };
}

// ---------------------------------------------------------------- лавка и заказы

/** Не успел к сроку — заказ сорван, собранное для него уходит на склад лавки. */
function settleOrders(d: Day): Day {
  if (!d.orders.some((o) => !o.done && !o.failed && d.t > o.by)) return d;
  let stock = d.stock;
  const orders = d.orders.map((o) => {
    if (o.done || o.failed || d.t <= o.by) return o;
    stock = { ...stock, [o.good]: stock[o.good] + o.have };
    return { ...o, failed: true };
  });
  return { ...d, orders, stock };
}

/** Покупатель у прилавка: берёт, что есть (до qty), платит. Нет ничего — ушёл ни с чем. */
export function buy(d: Day, g: Good, qty: number): { day: Day; n: number; coins: number } {
  const n = Math.min(qty, d.stock[g]);
  if (n <= 0) return { day: { ...d, missed: { ...d.missed, [g]: d.missed[g] + 1 } }, n: 0, coins: 0 };
  const coins = n * PRICE[g];
  return {
    day: { ...d, stock: { ...d.stock, [g]: d.stock[g] - n }, sold: { ...d.sold, [g]: d.sold[g] + n }, coins: d.coins + coins, served: d.served + 1 },
    n,
    coins,
  };
}

// ---------------------------------------------------------------- кто придёт

export interface Visitor {
  at: number;
  from: From;
  wants: Good;
  qty: number;
}

export interface Arrival {
  at: number;
  people: number;
}

/** План дня (виден утром): автобус с туристами (мёд и сыр), электрички с дачниками (молоко, яйца, овощи), заказы. */
export interface Plan {
  dow: 'sat' | 'sun' | 'mon';
  bus: Arrival | null;
  trains: Arrival[];
  orders: Omit<Order, 'have' | 'done' | 'failed'>[];
}

export const BUS_AT = atHour(11);

export const PLANS: Plan[] = [
  {
    dow: 'sat',
    bus: { at: BUS_AT, people: 5 },
    trains: [{ at: atHour(15), people: 7 }],
    orders: [
      { id: 'marat', good: 'eggs', need: 8, by: atHour(12), bonus: 30 },
      { id: 'cafe', good: 'milk', need: 6, by: atHour(16), bonus: 40 },
    ],
  },
  {
    dow: 'sun',
    bus: { at: BUS_AT, people: 9 },
    trains: [{ at: atHour(17), people: 4 }],
    orders: [
      { id: 'tourists', good: 'honey', need: 3, by: atHour(13), bonus: 40 },
      { id: 'fair', good: 'cheese', need: 2, by: atHour(17), bonus: 60 },
    ],
  },
  {
    dow: 'mon',
    bus: null,
    trains: [{ at: atHour(10), people: 6 }, { at: atHour(18), people: 8 }],
    orders: [
      { id: 'school', good: 'veg', need: 15, by: atHour(13), bonus: 50 },
      { id: 'marat', good: 'eggs', need: 10, by: atHour(17), bonus: 40 },
    ],
  },
];

export const planFor = (dayIndex: number): Plan => PLANS[((dayIndex % PLANS.length) + PLANS.length) % PLANS.length];

function rng(seed: number): () => number {
  let s = (Math.imul(seed, 2654435761) ^ 0x9e3779b9) >>> 0 || 1;
  const next = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
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

/** Кто придёт за день: трасса весь день, автобус туристов, электрички с дачниками. */
export function visitors(plan: Plan = PLANS[0], seed = 1): Visitor[] {
  const r = rng(seed);
  const out: Visitor[] = [];
  const add = (at: number, from: From, wants: Good): void => {
    out.push({ at, from, wants, qty: wants === 'eggs' ? 2 + Math.floor(r() * 3) : r() < 0.35 ? 2 : 1 });
  };
  for (let at = 4; at < DAY_SECONDS - 10; at += 8 + r() * 4) add(at, 'road', pick(r, { milk: 3, eggs: 2.5, veg: 3, honey: 0.8, cheese: 0.8 }));
  if (plan.bus) for (let i = 0; i < plan.bus.people; i++) add(plan.bus.at + 2 + i * 1.3, 'bus', pick(r, { honey: 4, cheese: 4, veg: 1 }));
  for (const tr of plan.trains) for (let i = 0; i < tr.people; i++) add(tr.at + 3 + i * 1.6, 'train', pick(r, { milk: 5, eggs: 3, veg: 3 }));
  return out.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------- итоги

export type Tip = 'cows' | 'eggs' | 'beds' | 'orders' | 'good';

export interface Summary {
  coins: number;
  collected: Record<Good, number>;
  sold: Record<Good, number>;
  missedTotal: number;
  served: number;
  ordersDone: number;
  ordersTotal: number;
  happy: number;
  stars: number;
  tip: Tip;
}

export function summary(d: Day): Summary {
  const missedTotal = GOODS.reduce((a, g) => a + d.missed[g], 0);
  const came = d.served + missedTotal;
  const happy = came ? d.served / came : 1;
  const ordersDone = d.orders.filter((o) => o.done).length;
  const score = happy * 0.7 + (ordersDone / Math.max(1, d.orders.length)) * 0.3;
  const stars = score >= 0.85 ? 5 : score >= 0.72 ? 4 : score >= 0.58 ? 3 : score >= 0.42 ? 2 : 1;
  // Совет — про самое большое упущение.
  const worst: [Tip, number][] = [
    ['cows', d.idle.cows / COWS / 20],
    ['eggs', d.idle.eggs / 25],
    ['beds', d.idle.empty / BEDS / 20],
    ['orders', (d.orders.length - ordersDone) * 1.2],
  ];
  worst.sort((a, b) => b[1] - a[1]);
  const tip: Tip = stars >= 5 || worst[0][1] < 1 ? 'good' : worst[0][0];
  return { coins: d.coins, collected: d.collected, sold: d.sold, missedTotal, served: d.served, ordersDone, ordersTotal: d.orders.length, happy, stars, tip };
}
