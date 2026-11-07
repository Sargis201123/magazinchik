// «Лавка «Своё»» — правила одного дня на ферме (вторая игра, docs/farm/LAVKA.md). Без Phaser: сцена (src/lavka)
// показывает и зовёт эти функции, тесты — tests/lavkaDay.test.ts.
//
// Работа — на ферме, касаниями: подоить корову (и подложить сено, иначе молока нет), собрать яйца (и подсыпать
// курам зерно), полить грядки, снять урожай и посадить заново, забрать мёд, яблоки и помидоры из теплицы,
// поставить сыр из молока. Собранное идёт сначала в заказы дня (Марату — яйца, кафе — молоко: набрал к сроку —
// премия), остальное — в лавку, а лавка продаёт сама, папа за прилавком. Чего нет на складе, того не купят.

export type Good = 'milk' | 'eggs' | 'veg' | 'honey' | 'cheese';
export const GOODS: Good[] = ['milk', 'eggs', 'veg', 'honey', 'cheese'];
export type From = 'road' | 'bus' | 'train';

/** День с 8:00 до 20:00 за столько секунд (×1): час — 15 секунд. */
export const DAY_SECONDS = 180;
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;
const HOUR = DAY_SECONDS / (CLOSE_HOUR - OPEN_HOUR);

export const PRICE: Record<Good, number> = { milk: 8, eggs: 3, veg: 5, honey: 18, cheese: 35 };

/** Сколько секунд корова «набирает» молоко (если сыта) и на сколько подоек хватает полной кормушки. */
export const COW_FILL = 16;
export const HAY_FULL = 8;
/** Курица несёт яйцо раз в столько секунд (если в кормушке есть зерно); зерна хватает на столько яиц. */
export const HEN_LAY = 9;
export const GRAIN_FULL = 12;
/** Сколько яиц может лежать в выгуле разом (дальше куры не несутся, пока не соберёшь). */
export const EGGS_MAX = 8;
/** Грядка: полита — растёт; сохнет за WATER_LAST секунд; созревает за GROW секунд роста; урожай — YIELD штук. */
export const WATER_LAST = 15;
export const GROW = 40;
export const YIELD = 2;
/** Ульи, яблони, теплица: через сколько секунд снова есть что снять и сколько. */
export const HIVE_FILL = 40;
export const TREE_FILL = 36;
export const TREE_YIELD = 3;
export const HOUSE_FILL = 30;
export const HOUSE_YIELD = 4;
/** Сыр: на головку уходит столько молока и столько секунд. */
export const CHEESE_MILK = 3;
export const CHEESE_TIME = 24;

export const COWS = 4;
export const HENS = 8;
export const BEDS = 9;
export const HIVES = 3;
export const TREES = 2;

/** Секунда дня → «10:40». */
export function clock(t: number): string {
  const minutes = Math.round((OPEN_HOUR * 60 + (Math.max(0, Math.min(DAY_SECONDS, t)) / HOUR) * 60) / 10) * 10;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export const atHour = (hour: number): number => (hour - OPEN_HOUR) * HOUR;

// ---------------------------------------------------------------- состояние фермы

export interface Bed {
  /** 0 — пусто (нажать — посадить), иначе растёт: 0…1 — до урожая. */
  planted: boolean;
  grow: number;
  /** Сколько ещё секунд грядка влажная. */
  water: number;
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
  /** Яйца, лежащие в выгуле (их места — номера 0…EGGS_MAX-1), и до следующего яйца. */
  eggs: number[];
  layIn: number;
  grain: number;
  beds: Bed[];
  hives: number[];
  trees: number[];
  house: number;
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
  /** Сколько раз за день ферма простаивала: корова ждала дойки, яйца лежали, грядка сохла (для совета вечером). */
  idle: { cows: number; eggs: number; dry: number };
}

const zero = (): Record<Good, number> => ({ milk: 0, eggs: 0, veg: 0, honey: 0, cheese: 0 });

/** Утро: коровы полны наполовину, в кормушках по половине, грядки засажены через одну, ульи и деревья — в начале. */
export function startDay(plan: Plan): Day {
  return {
    t: 0,
    cows: [1, 0.6, 0.3, 0.8],
    hay: HAY_FULL / 2,
    eggs: [0, 3, 5],
    layIn: HEN_LAY,
    grain: GRAIN_FULL / 2,
    beds: Array.from({ length: BEDS }, (_, i) => ({ planted: i % 3 !== 2, grow: i % 3 === 0 ? 0.85 : i % 3 === 1 ? 0.3 : 0, water: i % 2 ? 0 : 8 })),
    hives: [0.7, 0.4, 0.1],
    trees: [0.5, 0.9],
    house: 0.6,
    cheese: 0,
    stock: { milk: 2, eggs: 4, veg: 6, honey: 0, cheese: 1 },
    coins: 0,
    collected: zero(),
    sold: zero(),
    missed: zero(),
    served: 0,
    orders: plan.orders.map((o) => ({ ...o, have: 0, done: false, failed: false })),
    idle: { cows: 0, eggs: 0, dry: 0 },
  };
}

const fill = (v: number, dt: number, seconds: number): number => Math.min(1, v + dt / seconds);

/** Время идёт: коровы набирают молоко (если сыты), куры несутся (если есть зерно), грядки растут и сохнут. */
export function tick(d: Day, dt: number): Day {
  const t = Math.min(DAY_SECONDS, d.t + dt);
  const idle = { ...d.idle };
  const cows = d.cows.map((m) => {
    if (m >= 1) idle.cows += dt;
    return d.hay > 0 ? fill(m, dt, COW_FILL) : m;
  });
  let { eggs, layIn, grain } = d;
  if (eggs.length) idle.eggs += dt * Math.min(1, eggs.length / 4);
  if (grain > 0 && eggs.length < EGGS_MAX) {
    layIn -= dt * (HENS / 8);
    if (layIn <= 0) {
      layIn += HEN_LAY;
      grain -= 1;
      const free = Array.from({ length: EGGS_MAX }, (_, i) => i).filter((i) => !eggs.includes(i));
      eggs = [...eggs, free[Math.floor(((t * 7.3) % 1) * free.length)] ?? free[0]];
    }
  }
  const beds = d.beds.map((b) => {
    if (!b.planted || b.grow >= 1) return b;
    if (b.water <= 0) {
      idle.dry += dt;
      return b;
    }
    return { ...b, grow: fill(b.grow, dt, GROW), water: Math.max(0, b.water - dt) };
  });
  let { cheese } = d;
  const { stock } = d;
  if (cheese > 0) {
    cheese = Math.max(0, cheese - dt);
  }
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
    house: fill(d.house, dt, HOUSE_FILL),
    cheese,
    stock,
    idle,
  };
  if (d.cheese > 0 && cheese === 0) next = add(next, 'cheese', 1);
  next = settleOrders(next);
  return next;
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
export function milk(d: Day, cow: number): { day: Day; n: number } {
  if (d.cows[cow] < 1) return { day: d, n: 0 };
  const cows = d.cows.map((m, i) => (i === cow ? 0 : m));
  return { day: add({ ...d, cows, hay: Math.max(0, d.hay - 1) }, 'milk', 1), n: 1 };
}

export function feedHay(d: Day): { day: Day; n: number } {
  if (d.hay >= HAY_FULL) return { day: d, n: 0 };
  return { day: { ...d, hay: HAY_FULL }, n: HAY_FULL - d.hay };
}

export function pickEgg(d: Day, spot: number): { day: Day; n: number } {
  if (!d.eggs.includes(spot)) return { day: d, n: 0 };
  return { day: add({ ...d, eggs: d.eggs.filter((e) => e !== spot) }, 'eggs', 1), n: 1 };
}

export function feedGrain(d: Day): { day: Day; n: number } {
  if (d.grain >= GRAIN_FULL) return { day: d, n: 0 };
  return { day: { ...d, grain: GRAIN_FULL }, n: GRAIN_FULL - d.grain };
}

export type BedTap = 'harvest' | 'plant' | 'water' | 'growing';

/** Что сделает касание грядки: созрела — собрать, пусто — посадить, сухо — полить, иначе — растёт. */
export function bedAction(b: Bed): BedTap {
  if (b.planted && b.grow >= 1) return 'harvest';
  if (!b.planted) return 'plant';
  if (b.water <= 0) return 'water';
  return 'growing';
}

export function tapBed(d: Day, i: number): { day: Day; did: BedTap; n: number } {
  const b = d.beds[i];
  const did = bedAction(b);
  const set = (nb: Bed): Bed[] => d.beds.map((x, k) => (k === i ? nb : x));
  if (did === 'harvest') return { day: add({ ...d, beds: set({ planted: false, grow: 0, water: b.water }) }, 'veg', YIELD), did, n: YIELD };
  if (did === 'plant') return { day: { ...d, beds: set({ planted: true, grow: 0, water: b.water }) }, did, n: 0 };
  if (did === 'water') return { day: { ...d, beds: set({ ...b, water: WATER_LAST }) }, did, n: 0 };
  return { day: d, did, n: 0 };
}

export function takeHoney(d: Day, hive: number): { day: Day; n: number } {
  if (d.hives[hive] < 1) return { day: d, n: 0 };
  return { day: add({ ...d, hives: d.hives.map((h, i) => (i === hive ? 0 : h)) }, 'honey', 1), n: 1 };
}

export function shakeTree(d: Day, tree: number): { day: Day; n: number } {
  if (d.trees[tree] < 1) return { day: d, n: 0 };
  return { day: add({ ...d, trees: d.trees.map((h, i) => (i === tree ? 0 : h)) }, 'veg', TREE_YIELD), n: TREE_YIELD };
}

export function pickGreenhouse(d: Day): { day: Day; n: number } {
  if (d.house < 1) return { day: d, n: 0 };
  return { day: add({ ...d, house: 0 }, 'veg', HOUSE_YIELD), n: HOUSE_YIELD };
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
      { id: 'fair', good: 'cheese', need: 3, by: atHour(17), bonus: 60 },
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
  for (let at = 4; at < DAY_SECONDS - 10; at += 7 + r() * 4) add(at, 'road', pick(r, { milk: 3, eggs: 2.5, veg: 3, honey: 0.8, cheese: 0.8 }));
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
    ['beds', d.idle.dry / BEDS / 15],
    ['orders', (d.orders.length - ordersDone) * 1.2],
  ];
  worst.sort((a, b) => b[1] - a[1]);
  const tip: Tip = stars >= 5 || worst[0][1] < 1 ? 'good' : worst[0][0];
  return { coins: d.coins, collected: d.collected, sold: d.sold, missedTotal, served: d.served, ordersDone, ordersTotal: d.orders.length, happy, stars, tip };
}
