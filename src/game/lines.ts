// Своя марка на полках: кроме выпечки «От бабушки» (brand.ts), магазин делает под своим именем ещё
// четыре линейки — варенье, соленья, пельмени ручной лепки и квас. Каждую открывают в «Развитии» и
// улучшают (ступени 1…3). Делают ночью, после закрытия: из сырья со склада (яблоки, мясо, хлеб)
// и того, что докупают по мелочи (сахар, банки, соль), — доделывают запас до нормы ступени.
// Утром банки уже на полках. Своё берут охотнее и дороже, а каждая ступень любой линейки
// прибавляет «славу марки»: вся своя продукция (и выпечка) идёт чуть лучше. Ни одна линейка не обязательна.

import { yearTime, type YearTime } from './calendar';
import { canPlace, onShift, PRODUCTS, shelfFree, warehouseCapacity, warehouseCount, type ProductId, type StoreState, type Unit } from './economy';
import { hasUpgrade } from './upgrades';
import { usualSales } from './bakery';
import type { TextKey } from '../i18n/ru';

export type LineId = 'jam' | 'pickles' | 'pelmeni' | 'kvass';
export const LINE_IDS: LineId[] = ['jam', 'pickles', 'pelmeni', 'kvass'];

export interface Line {
  /** Что получается (товар своей марки). */
  product: Extract<ProductId, 'jam' | 'pickles' | 'pelmeni' | 'kvass'>;
  icon: string;
  nameKey: TextKey;
  /** С какого помещения открывается (индекс STORE_LEVELS). */
  minLevel: number;
  /** Нужно улучшение (пельмени лепит повар на кухне). */
  needs?: 'kitchen';
  /** Сырьё со склада: какой товар и сколько его на одну штуку (0.5 — один кусок мяса на две пачки). */
  input?: { id: ProductId; per: number };
  /** Остальное на штуку: сахар и банка, рассол, мука, дрожжи. */
  extra: number;
  /** Цена ступеней 1…3. */
  costs: readonly [number, number, number];
  /** Норма запаса по ступеням: ночью доделывают до неё (что на полках и на складе). */
  stock: readonly [number, number, number];
}

/**
 * Цены и нормы подобраны симулятором (scripts/sim-features.ts, «lines»; docs/BALANCE.md «Своя марка»):
 * каждая ступень окупается за 2–4 недели, все линейки вместе — не больше +10–15% прибыли под конец игры.
 */
export const LINES: Record<LineId, Line> = {
  // Варенье: бабушка-соседка варит из яблок со склада — то, что не продали, не пропадает.
  jam: { product: 'jam', icon: '🍯', nameKey: 'lines.jam', minLevel: 2, input: { id: 'apples', per: 1 }, extra: 12, costs: [1500, 2500, 3500], stock: [6, 9, 12] },
  // Соленья: огурцы и помидоры у фермера, рассол и банки — свои. Осенью урожай: делают больше и дешевле.
  pickles: { product: 'pickles', icon: '🥒', nameKey: 'lines.pickles', minLevel: 2, extra: 24, costs: [1800, 3000, 4200], stock: [6, 9, 12] },
  // Пельмени ручной лепки: повар лепит из мяса со склада, если сегодня был на смене.
  pelmeni: { product: 'pelmeni', icon: '🥟', nameKey: 'lines.pelmeni', minLevel: 3, needs: 'kitchen', input: { id: 'meat', per: 0.5 }, extra: 12, costs: [2500, 4000, 5500], stock: [5, 8, 11] },
  // Квас: из вчерашнего хлеба, в тёплое время года (весной и летом). Зимой бочку убирают.
  kvass: { product: 'kvass', icon: '🍺', nameKey: 'lines.kvass', minLevel: 3, input: { id: 'bread', per: 0.25 }, extra: 8, costs: [1000, 1600, 2400], stock: [10, 16, 22] },
};

export const LINE_MAX = 3;
export const LINE_PRODUCTS: ProductId[] = LINE_IDS.map((id) => LINES[id].product);

/** На сколько охотнее берут товар линейки за каждую ступень сверх первой. */
export const LINE_DEMAND_STEP = 0.1;
/** «Слава марки»: каждая ступень любой линейки — на столько охотнее берут всё своё (и выпечку «От бабушки»). */
export const FAME_STEP = 0.015;
/** Осенью огурцы дешёвые: рассол и банки — те же, а сырьё почти даром. */
const HARVEST_EXTRA = 0.6;
/** Осенью солят больше: норма запаса соленьев выше. */
const HARVEST_STOCK = 1.5;

export const lineTier = (state: StoreState, id: LineId): number => Math.min(LINE_MAX, Math.max(0, state.lines?.[id] ?? 0));
/** Сколько всего ступеней открыто во всех линейках — «слава марки». */
export const brandFame = (state: StoreState): number => LINE_IDS.reduce((sum, id) => sum + lineTier(state, id), 0);
export const lineOfProduct = (id: ProductId): LineId | undefined => LINE_IDS.find((l) => LINES[l].product === id);

/** Почему линейку пока нельзя открыть: null — можно. */
export function lineLock(state: StoreState, id: LineId): 'level' | 'kitchen' | null {
  const line = LINES[id];
  if (state.level < line.minLevel) return 'level';
  if (line.needs && !hasUpgrade(state, line.needs)) return 'kitchen';
  return null;
}

export const nextLineCost = (state: StoreState, id: LineId): number | null => LINES[id].costs[lineTier(state, id)] ?? null;

/** Открыть линейку или поднять её ступень. null — нельзя или не хватает денег. */
export function buyLineTier(state: StoreState, id: LineId): StoreState | null {
  const cost = nextLineCost(state, id);
  if (cost === null || lineLock(state, id) || state.money < cost) return null;
  return { ...state, money: state.money - cost, lines: { ...state.lines, [id]: lineTier(state, id) + 1 } };
}

/** Делают ли линейку в это время года: квас — только в тепло. */
export const lineSeason = (id: LineId, day: number): boolean => id !== 'kvass' || ['spring', 'summer'].includes(yearTime(day));

/** Спрос на товар линейки по времени года: квас — летом, соленья — в холода, варенье — к зимнему чаю. */
const SEASON_DEMAND: Partial<Record<LineId, Partial<Record<YearTime, number>>>> = {
  kvass: { summer: 1.5, autumn: 0.6, winter: 0.4 },
  pickles: { autumn: 1.3, winter: 1.4, summer: 0.8 },
  jam: { winter: 1.3, summer: 0.9 },
};

/**
 * Насколько охотнее берут свой товар: ступень линейки, время года и «слава марки».
 * Слава действует на всё своё — и на выпечку «От бабушки» (own — товар своей марки).
 */
export function lineDemand(state: StoreState, id: ProductId, own: boolean): number {
  const fame = own ? 1 + FAME_STEP * brandFame(state) : 1;
  const line = lineOfProduct(id);
  if (!line) return fame;
  const tier = lineTier(state, line);
  return fame * (1 + LINE_DEMAND_STEP * Math.max(0, tier - 1)) * (SEASON_DEMAND[line]?.[yearTime(state.day)] ?? 1);
}

/** Норма запаса линейки сегодня (осенью соленьев — больше). */
export function lineStock(state: StoreState, id: LineId): number {
  const tier = lineTier(state, id);
  if (!tier) return 0;
  const base = LINES[id].stock[tier - 1];
  return id === 'pickles' && yearTime(state.day) === 'autumn' ? Math.round(base * HARVEST_STOCK) : base;
}

/** Почём остальное на штуку сегодня. */
export const lineExtra = (state: StoreState, id: LineId): number =>
  id === 'pickles' && yearTime(state.day) === 'autumn' ? Math.round(LINES[id].extra * HARVEST_EXTRA) : LINES[id].extra;

const stockOf = (state: StoreState, id: ProductId): number =>
  state.shelves.reduce((sum, s) => sum + (s.items[id]?.length ?? 0), 0) + (state.warehouse[id]?.length ?? 0);
/** Годится в сырьё: не брак, ждущий решения, и не уценка (её отдают покупателям). */
const usable = (u: Unit): boolean => !u.pending && !u.bad && !u.markdown;
/** Сколько сырья можно взять: то, что осталось к ночи на складе и на полках. */
const inputHave = (state: StoreState, id: ProductId): number =>
  (state.warehouse[id] ?? []).filter(usable).length + state.shelves.reduce((sum, s) => sum + (s.items[id] ?? []).filter(usable).length, 0);

/**
 * Линейка сегодня работает: открыта, сезон (квас — в тепло), есть полка отдела (иначе ставить некуда),
 * а для пельменей повар сегодня на смене.
 */
export function lineWorking(state: StoreState, id: LineId): boolean {
  const line = LINES[id];
  if (!lineTier(state, id) || !lineSeason(id, state.day + 1)) return false;
  if (!state.shelves.some((s) => canPlace(line.product, s))) return false;
  return line.needs !== 'kitchen' || onShift(state, 'cook');
}

/** Сколько штук линейка хочет сделать сегодня ночью (до нормы, без оглядки на сырьё и деньги). */
export const lineWants = (state: StoreState, id: LineId): number =>
  lineWorking(state, id) ? Math.max(0, lineStock(state, id) - stockOf(state, LINES[id].product)) : 0;

/**
 * Сколько сырья ночью уйдёт на линейки: «Закупить нужное» берёт его сверху (restock.ts). Утром запас
 * своего почти полный, поэтому считаем по тому, сколько обычно разбирают (без истории — полнормы).
 */
export const lineInputNeed = (state: StoreState, pid: ProductId): number =>
  LINE_IDS.reduce((sum, id) => {
    const input = LINES[id].input;
    if (input?.id !== pid || !lineWorking(state, id)) return sum;
    const usual = usualSales(state, LINES[id].product);
    return sum + Math.ceil(Math.min(lineStock(state, id), usual ?? lineStock(state, id) / 2) * input.per);
  }, 0);

export interface LineMade {
  id: LineId;
  made: number;
  /** Не хватило сырья (на складе не было яблок, мяса, хлеба). */
  short?: boolean;
}

export interface LinesNight {
  made: LineMade[];
  /** Сколько ушло денег на остальное (сахар, банки, соль). */
  spent: number;
}

/**
 * Взять n штук сырья: сначала самые старые (то, что вот-вот испортится), со склада и с полок.
 * Уценку и брак не трогаем.
 */
function takeInput(state: StoreState, id: ProductId, n: number): StoreState {
  // Все годные штуки: где лежат (-1 — склад, иначе номер полки), номер в списке и возраст.
  const all: { at: number; i: number; age: number }[] = [];
  (state.warehouse[id] ?? []).forEach((u, i) => usable(u) && all.push({ at: -1, i, age: u.age }));
  state.shelves.forEach((s, at) => (s.items[id] ?? []).forEach((u, i) => usable(u) && all.push({ at, i, age: u.age })));
  // Старое — первым; при равном возрасте — сначала со склада, чтобы полки не пустели.
  const take = all.sort((a, b) => b.age - a.age || a.at - b.at).slice(0, n);
  const taken = (at: number) => new Set(take.filter((x) => x.at === at).map((x) => x.i));
  const left = (units: Unit[] | undefined, at: number) => {
    const out = taken(at);
    return (units ?? []).filter((_, i) => !out.has(i));
  };
  return {
    ...state,
    warehouse: { ...state.warehouse, [id]: left(state.warehouse[id], -1) },
    shelves: state.shelves.map((s, at) => (taken(at).size ? { ...s, items: { ...s.items, [id]: left(s.items[id], at) } } : s)),
  };
}

/** Своё — на полки отдела, где есть место, остальное на склад (сколько влезет). */
function putMade(state: StoreState, id: ProductId, qty: number): StoreState {
  let left = qty;
  const shelves = state.shelves.map((shelf) => {
    if (!left || shelf.broken || !canPlace(id, shelf)) return shelf;
    const n = Math.min(left, Math.max(0, shelfFree(shelf)));
    if (!n) return shelf;
    left -= n;
    return { ...shelf, items: { ...shelf.items, [id]: [...(shelf.items[id] ?? []), ...Array.from({ length: n }, (): Unit => ({ age: 0 }))] } };
  });
  const warehouse = left ? { ...state.warehouse, [id]: [...(state.warehouse[id] ?? []), ...Array.from({ length: left }, (): Unit => ({ age: 0 }))] } : state.warehouse;
  return { ...state, shelves, warehouse };
}

/** Сколько своего сейчас встанет: свободные места на полках отдела и на складе. */
function room(state: StoreState, id: ProductId): number {
  const shelf = state.shelves.reduce((sum, s) => sum + (!s.broken && canPlace(id, s) ? Math.max(0, shelfFree(s)) : 0), 0);
  return shelf + Math.max(0, warehouseCapacity(state) - warehouseCount(state));
}

/**
 * Ночь: каждая открытая линейка доделывает запас до нормы — сколько хватит сырья, денег и места.
 * Зовётся из nightCycle (day.ts) до счетов: и игрой, и симулятором.
 */
export function makeLines(state: StoreState): { state: StoreState; night: LinesNight } {
  let s = state;
  const made: LineMade[] = [];
  let spent = 0;
  for (const id of LINE_IDS) {
    const want = lineWants(s, id);
    if (!want) continue;
    const line = LINES[id];
    const extra = lineExtra(s, id);
    const byInput = line.input ? Math.floor(inputHave(s, line.input.id) / line.input.per) : Infinity;
    const n = Math.max(0, Math.min(want, byInput, Math.floor(Math.max(0, s.money) / Math.max(1, extra)), room(s, line.product)));
    if (n > 0) {
      if (line.input) s = takeInput(s, line.input.id, Math.ceil(n * line.input.per));
      s = putMade({ ...s, money: s.money - n * extra }, line.product, n);
      spent += n * extra;
    }
    if (n > 0 || byInput < want) made.push({ id, made: n, ...(byInput < want ? { short: true } : {}) });
  }
  return { state: s, night: { made, spent } };
}

/** Себестоимость штуки (для подсказок): сырьё по базовой цене и остальное. */
export const lineUnitCost = (id: LineId): number => {
  const line = LINES[id];
  return Math.round(line.extra + (line.input ? PRODUCTS[line.input.id].cost * line.input.per : 0));
};

/** Сколько своего (линеек) продали за день и на сколько — для итогов дня. */
export function linesSold(state: StoreState, sold: Partial<Record<ProductId, number>>): { n: number; revenue: number } {
  let n = 0;
  let revenue = 0;
  for (const id of LINE_IDS) {
    const k = sold[LINES[id].product] ?? 0;
    n += k;
    revenue += k * state.prices[LINES[id].product];
  }
  return { n, revenue };
}
