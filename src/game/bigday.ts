// Особые дни. Беды: аномальная жара, лютый мороз, наводнение, землетрясение, блэкаут на весь
// район, опасная болезнь. По новостям просят сидеть дома, и гостей мало (а в болезнь кто
// пришёл — скупает впрок мыло и пельмени). Праздники на улице: карнавал, парад оркестров,
// марафон — мимо магазина идёт шествие, людей почти вдвое больше. И просто необычные дни:
// у магазина снимают кино, приезжает автобус туристов, ночью звездопад, в зал летят голуби,
// перед входом ремонтируют дорогу, по району ходит санэпидстанция, по соседству свадьба
// с большим заказом к вечеру.
//
// Главное: утром об особом дне ничего не известно. Прогноз обычный, и «сегодня придут ~N
// гостей» тоже обычное. Новость объявляют, только когда магазин открылся. Закупился на
// обычный день, а пришла беда — лишний товар пролежит и может испортиться. Закупился мало,
// а тут парад — полки опустеют к обеду. Многодневные (ремонт дороги, болезнь) со второго
// дня уже известны: их видно утром и они входят в прогноз гостей.
// Как и погода, особый день зависит только от номера дня: перезапуск ничего не меняет.

import { PRODUCTS, SHELF_KINDS, sellableProducts, type ProductId, type Shelf, type StoreState } from './economy';
import { monthInYear, yearTime } from './calendar';
import { rng } from './random';
import { adPlanned, grantAd } from './ads';

export type BigDayId =
  | 'heatwave'
  | 'frost'
  | 'flood'
  | 'robbery'
  | 'quake'
  | 'carnival'
  | 'parade'
  | 'blackout'
  | 'filming'
  | 'marathon'
  | 'tourbus'
  | 'starfall'
  | 'pigeons'
  | 'roadworks'
  | 'sanitary'
  | 'wedding'
  | 'epidemic';

export interface BigDay {
  id: BigDayId;
  icon: string;
  /** Множитель потока гостей. */
  guests: number;
  /** Каких товаров хотят чаще или реже. */
  demand: Partial<Record<ProductId, number>>;
  /** Шествие на улице: толпа, больше гостей в зале одновременно, к очереди терпимее. */
  crowd: boolean;
  /** Сколько дней длится (по умолчанию один). */
  days?: number;
  /** Во столько раз больше гостей в ночную смену. */
  night?: number;
  /** Сколько товаров каждый берёт сверх обычного (скупают впрок). */
  extraItems?: number;
  /** Покупатели в медицинских масках. */
  masks?: boolean;
}

export const BIG_DAYS: Record<BigDayId, BigDay> = {
  heatwave: {
    id: 'heatwave',
    icon: '🥵',
    guests: 0.4,
    demand: { water: 3, icecream: 3, juice: 2.2, milk: 0.7, meat: 0.4, bread: 0.6, dumplings: 0.4, fish: 0.5 },
    crowd: false,
  },
  frost: {
    id: 'frost',
    icon: '❄️',
    guests: 0.4,
    demand: { meat: 1.6, dumplings: 2, potatoes: 1.4, bread: 1.3, icecream: 0.1, water: 0.4, flowers: 0.3 },
    crowd: false,
  },
  flood: {
    id: 'flood',
    icon: '🌊',
    guests: 0.45,
    demand: { water: 3, bread: 1.6, soap: 1.5, detergent: 1.5, flowers: 0.2, icecream: 0.3 },
    crowd: false,
  },
  // Ограбление с заложниками: магазин полдня стоит, вокруг полиция; после штурма — сочувствие района.
  robbery: { id: 'robbery', icon: '🚨', guests: 0.7, demand: {}, crowd: false },
  quake: { id: 'quake', icon: '🌋', guests: 0.55, demand: { water: 2.2, bread: 1.4 }, crowd: false },
  carnival: {
    id: 'carnival',
    icon: '🎭',
    guests: 2.2,
    demand: { water: 2.5, juice: 2.5, icecream: 2.5, flowers: 1.5, buns: 1.5, pies: 1.5 },
    crowd: true,
  },
  parade: {
    id: 'parade',
    icon: '🎺',
    guests: 1.8,
    demand: { juice: 1.8, water: 1.8, flowers: 2.5, icecream: 1.6, buns: 1.4 },
    crowd: true,
  },
  blackout: {
    id: 'blackout',
    icon: '🕯️',
    guests: 0.8,
    demand: { water: 1.6, bread: 1.4, buns: 1.3, icecream: 0.4, dumplings: 0.5, fish: 0.5, meat: 0.7 },
    crowd: false,
  },
  filming: { id: 'filming', icon: '🎬', guests: 1.4, demand: { water: 1.6, juice: 1.6, buns: 1.4, pies: 1.4 }, crowd: false },
  marathon: {
    id: 'marathon',
    icon: '🏃',
    guests: 1.5,
    demand: { water: 3.5, juice: 2.5, buns: 1.4, icecream: 1.3, apples: 1.4 },
    crowd: true,
  },
  tourbus: {
    id: 'tourbus',
    icon: '🚌',
    guests: 1,
    demand: { icecream: 1.8, water: 1.8, juice: 1.6, honeycake: 1.6, flowers: 1.3, buns: 1.3 },
    crowd: false,
  },
  starfall: { id: 'starfall', icon: '🌠', guests: 1.15, demand: { juice: 1.3, icecream: 1.3, buns: 1.2 }, crowd: false, night: 2 },
  pigeons: { id: 'pigeons', icon: '🐦', guests: 1, demand: { bread: 1.3 }, crowd: false },
  roadworks: {
    id: 'roadworks',
    icon: '🚧',
    guests: 0.75,
    demand: { bread: 1.6, dumplings: 1.5, water: 1.6, pies: 1.6, buns: 1.5, meat: 0.8, flowers: 0.6 },
    crowd: false,
    days: 5,
  },
  sanitary: { id: 'sanitary', icon: '🧪', guests: 1, demand: {}, crowd: false },
  wedding: { id: 'wedding', icon: '💒', guests: 1.1, demand: { flowers: 1.6, juice: 1.3 }, crowd: false },
  epidemic: {
    id: 'epidemic',
    icon: '🦠',
    guests: 0.65,
    demand: { soap: 3.5, detergent: 3, water: 2, dumplings: 2, potatoes: 1.6, bread: 1.4, fish: 1.4, flowers: 0.3, icecream: 0.5 },
    crowd: false,
    days: 3,
    extraItems: 2,
    masks: true,
  },
};

export const BIG_DAY_IDS = Object.keys(BIG_DAYS) as BigDayId[];

/** С какого дня бывают особые дни и сколько дней минимум между ними (после конца прошлого). */
export const BIG_DAY_FROM = 10;
export const BIG_DAY_GAP = 3;
/** В толпу в зале помещается больше гостей сразу, и очередь они терпят дольше. */
export const CROWD_EXTRA_GUESTS = 3;
export const CROWD_PATIENCE = 1.2;
/** Землетрясение роняет с полок такую долю товара (бьётся, мнётся — в «Испортилось»). */
export const QUAKE_BREAK = 0.12;
/** Блэкаут: света нет до этой доли дня, касса считает вручную медленнее. */
export const BLACKOUT_UNTIL = 0.45;
export const BLACKOUT_CHECKOUT = 1.35;
/** Свадьба: за заказ платят дороже обычной цены, за весь заказ целиком — ещё и рейтинг. */
export const WEDDING_MARKUP = 1.6;
export const WEDDING_RATING = 0.15;
/** Автобус туристов: сколько их выходит разом. */
export const TOURISTS = 12;
/** Ремонт дороги: какая доля покупателей — рабочие в касках. */
export const ROADWORKERS = 0.3;
/** Болезнь: какая доля покупателей в масках. */
export const MASKS = 0.8;

const days = (id: BigDayId): number => BIG_DAYS[id].days ?? 1;

/** Шанс начала каждого особого дня в своё время года (за один день). */
function chances(day: number): [BigDayId, number][] {
  // Ограбление — редкость и только в опытном магазине (не раньше ROBBERY_FROM).
  const robbery: [BigDayId, number][] = day >= ROBBERY_FROM ? [['robbery', 0.006]] : [];
  return [...seasonChances(day), ...robbery];
}

/** С какого дня возможно ограбление. */
export const ROBBERY_FROM = 30;
/** Ограбление по долям дня: захват, освобождение троих, штурм. */
export const ROBBERY_AT = 0.15;
export const ROBBERY_RELEASE = 0.42;
export const ROBBERY_STORM = 0.8;
/** После штурма о магазине говорит весь район — рейтинг немного растёт. */
export const ROBBERY_RATING = 0.1;

function seasonChances(day: number): [BigDayId, number][] {
  const time = yearTime(day);
  if (time === 'summer')
    return [
      ['heatwave', 0.025],
      ['carnival', 0.025],
      ['marathon', 0.015],
      ['tourbus', 0.02],
      ['starfall', 0.015],
      ['pigeons', 0.01],
      ['roadworks', 0.01],
      ['wedding', 0.015],
      ['sanitary', 0.008],
      ['blackout', 0.008],
      ['filming', 0.01],
    ];
  if (time === 'winter') return [['frost', 0.1], ['blackout', 0.03], ['epidemic', 0.03], ['sanitary', 0.01]];
  if (time === 'spring')
    return [
      ['flood', 0.02],
      ['quake', 0.01],
      ['parade', 0.02],
      ['marathon', 0.015],
      ['tourbus', 0.01],
      ['pigeons', 0.015],
      ['roadworks', 0.015],
      ['wedding', 0.015],
      ['sanitary', 0.01],
      ['blackout', 0.01],
      ['filming', 0.015],
      ['epidemic', 0.008],
    ];
  // Осень; в предзимье (последний месяц перед Новым годом) бывают и морозы.
  const preWinter: [BigDayId, number][] = monthInYear(day) === 2 ? [['frost', 0.03]] : [];
  return [
    ...preWinter,
    ['flood', 0.015],
    ['quake', 0.01],
    ['parade', 0.02],
    ['marathon', 0.01],
    ['starfall', 0.01],
    ['pigeons', 0.01],
    ['roadworks', 0.01],
    ['wedding', 0.015],
    ['sanitary', 0.012],
    ['blackout', 0.012],
    ['filming', 0.012],
    ['epidemic', 0.02],
  ];
}

/** Особые дни бывают чаще обычного в столько раз (раньше шли раз в ~9 дней — игроки скучали). */
export const BIG_DAY_RATE = 1.6;

/**
 * Зерно расписания особых дней: у каждого магазина своё (state.seed), поэтому у разных игроков
 * и в новой игре события идут в разные дни, а не «у всех землетрясение на 10-й день».
 */
let seed = 0;
export function setBigDaySeed(value: number): void {
  if (value === seed) return;
  seed = value;
  starts.clear();
}

function rawStart(day: number): BigDayId | null {
  let roll = rng(day * 104729 + 17 + seed * 7919)();
  for (const [id, chance] of chances(day)) {
    if (roll < chance * BIG_DAY_RATE) return id;
    roll -= chance * BIG_DAY_RATE;
  }
  return null;
}

const MAX_DAYS = Math.max(...BIG_DAY_IDS.map(days));
const starts = new Map<number, BigDayId | null>();

/** Что начинается в этот день (или null): только если перед ним BIG_DAY_GAP спокойных дней. */
function startAt(day: number): BigDayId | null {
  if (day < BIG_DAY_FROM) return null;
  const known = starts.get(day);
  if (known !== undefined) return known;
  let id = rawStart(day);
  for (let k = 1; id && k <= BIG_DAY_GAP; k++) if (bigDayFor(day - k)) id = null;
  starts.set(day, id);
  return id;
}

/** С какого дня идёт сегодняшний особый день (или null). */
export function bigDayStart(day: number): number | null {
  for (let k = 0; k < MAX_DAYS; k++) {
    const id = startAt(day - k);
    if (id) return days(id) > k ? day - k : null;
  }
  return null;
}

/** Особый день (или null). Многодневные — несколько дней подряд. */
export function bigDayFor(day: number): BigDayId | null {
  const start = bigDayStart(day);
  return start === null ? null : startAt(start);
}

/** Какой это день многодневного события (1 — первый) и сколько всего. */
export function bigDayProgress(day: number): { n: number; of: number } | null {
  const start = bigDayStart(day);
  const id = bigDayFor(day);
  return start === null || !id ? null : { n: day - start + 1, of: days(id) };
}

/** Утром уже известно (идёт второй и дальше день многодневного события). */
export const bigDayKnown = (day: number): boolean => (bigDayProgress(day)?.n ?? 1) > 1;

/** Множитель гостей особого дня. */
export const bigDayGuests = (day: number): number => {
  const id = bigDayFor(day);
  if (!id) return 1;
  // Событий стало больше — провалы мягче: в плохой день гостей меньше, но не втрое.
  const g = BIG_DAYS[id].guests;
  return g < 1 ? 1 - (1 - g) * BAD_DAY_SOFTEN : g;
};
/** Насколько смягчён провал гостей в плохой особый день (1 — как раньше). */
export const BAD_DAY_SOFTEN = 0.5;

/** Гости особого дня, о котором утром уже знают, — входят в утренний прогноз. */
export const knownBigDayGuests = (day: number): number => (bigDayKnown(day) ? bigDayGuests(day) : 1);
/** Гости особого дня, о котором утром ещё не знают, — только в настоящий поток. */
export const hiddenBigDayGuests = (day: number): number => (bigDayKnown(day) ? 1 : bigDayGuests(day));

export const bigDayDemand = (day: number, id: ProductId): number => {
  const big = bigDayFor(day);
  return big ? (BIG_DAYS[big].demand[id] ?? 1) : 1;
};

export const isCrowdDay = (day: number): boolean => {
  const id = bigDayFor(day);
  return id ? BIG_DAYS[id].crowd : false;
};

export const bigDayNightGuests = (day: number): number => {
  const id = bigDayFor(day);
  return id ? (BIG_DAYS[id].night ?? 1) : 1;
};

export const bigDayExtraItems = (day: number): number => {
  const id = bigDayFor(day);
  return id ? (BIG_DAYS[id].extraItems ?? 0) : 0;
};

/**
 * Толчки землетрясения: с полок падает доля товара. Возвращает новое состояние и сколько
 * штук разбилось — для итогов дня и всплывашки.
 */
export function quakeBreak(state: StoreState, random: () => number, share = QUAKE_BREAK): { state: StoreState; broken: number } {
  let broken = 0;
  const shelves: Shelf[] = state.shelves.map((shelf) => {
    const items: Shelf['items'] = {};
    for (const [id, units] of Object.entries(shelf.items) as [ProductId, NonNullable<Shelf['items'][ProductId]>][]) {
      const keep = units.filter(() => random() >= share);
      broken += units.length - keep.length;
      items[id] = keep;
    }
    return { ...shelf, items };
  });
  return { state: { ...state, shelves }, broken };
}

/** Блэкаут: пока не было света, холодильники грелись — товар в них постарел на день. */
export function blackoutWarm(state: StoreState): { state: StoreState; aged: number } {
  let aged = 0;
  const shelves = state.shelves.map((shelf) => {
    if (!SHELF_KINDS[shelf.kind].fridge) return shelf;
    const items: Shelf['items'] = {};
    for (const [id, units] of Object.entries(shelf.items) as [ProductId, NonNullable<Shelf['items'][ProductId]>][]) {
      aged += units.length;
      items[id] = units.map((u) => ({ ...u, age: u.age + 1 }));
    }
    return { ...shelf, items };
  });
  return { state: { ...state, shelves }, aged };
}

/** Кино сняли — магазин попал в кадр: завтра бесплатная реклама (если своя не куплена). */
export function filmingReward(state: StoreState): StoreState {
  const tomorrow = state.day + 1;
  if (adPlanned(state, tomorrow)) return state;
  return grantAd(state, 'blogger', tomorrow);
}

export interface WeddingOrder {
  items: { product: ProductId; qty: number }[];
}

/** Свадебный заказ к вечеру: цветы (или фрукты), напитки и торт (или выпечка) — что продаётся в магазине. */
export function weddingOrder(state: StoreState): WeddingOrder {
  const sellable = sellableProducts(state);
  const pick = (options: ProductId[]) => options.find((id) => sellable.includes(id));
  const level = state.level;
  const items: WeddingOrder['items'] = [];
  // Цветы на столы, а если их не продают — фрукты к столу.
  const flowers = pick(['flowers', 'tangerines', 'apples']);
  if (flowers) items.push({ product: flowers, qty: 6 + 2 * level });
  const drink = pick(['juice', 'water', 'milk']);
  if (drink) items.push({ product: drink, qty: 8 + 2 * level });
  const cake = pick(['honeycake', 'pies', 'buns', 'bread']);
  if (cake) items.push({ product: cake, qty: 4 + level });
  return { items };
}

/**
 * Вечером за заказом приходят: забирают, что есть (со склада, потом с полок), платят
 * с наценкой. Всё целиком — ещё и рейтинг.
 */
export function fulfillWedding(state: StoreState, order: WeddingOrder): { state: StoreState; earned: number; complete: boolean } {
  let s = state;
  let earned = 0;
  let complete = true;
  for (const { product, qty } of order.items) {
    const fromWarehouse = Math.min(qty, (s.warehouse[product] ?? []).filter((u) => !u.pending).length);
    let need = qty - fromWarehouse;
    let toTake = fromWarehouse;
    const warehouse = (s.warehouse[product] ?? []).filter((u) => {
      if (u.pending || toTake === 0) return true;
      toTake--;
      return false;
    });
    const shelves = s.shelves.map((shelf) => {
      if (need === 0 || shelf.broken) return shelf;
      const units = shelf.items[product] ?? [];
      const take = Math.min(need, units.length);
      need -= take;
      return take ? { ...shelf, items: { ...shelf.items, [product]: units.slice(take) } } : shelf;
    });
    const got = qty - need;
    if (need > 0) complete = false;
    earned += Math.round(got * s.prices[product] * WEDDING_MARKUP);
    s = { ...s, warehouse: { ...s.warehouse, [product]: warehouse }, shelves };
  }
  s = { ...s, money: s.money + earned, rating: Math.min(5, s.rating + (complete ? WEDDING_RATING : 0)) };
  return { state: s, earned, complete };
}

/** Иконки заказа для подсказки в новостях: «💐×8 🧃×10 🍰×5». */
export const weddingText = (order: WeddingOrder): string =>
  order.items.map(({ product, qty }) => `${PRODUCTS[product].icon}×${qty}`).join('  ');
