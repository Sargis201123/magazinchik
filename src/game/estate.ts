// Скупать улицу (13.11, автор: «дома и помещения на улице можно покупать»). На задней улице за магазином, напротив
// домов жителей (residents.ts), стоят четыре дома с пустыми первыми этажами — на них таблички «Продаётся». Помещение
// дорогое (середина–конец игры), зато после покупки его сдаёшь одному из кандидатов: аптеке, бару, детскому клубу,
// спортзалу, цветочному или ремонту обуви. Как во флигеле (tenants.ts), арендатор работает сам и каждый вечер платит
// аренду, но здесь у каждого своя публика и свой спрос: из аптеки в зал идут пожилые, из детского клуба — мамы с
// колясками за соком и булочками, из бара — вечерние гости за пивом; бар к тому же шумит (доброе имя, goodwill.ts) и
// отпугивает семьи, а детский клуб и аптека их чуть привлекают (жители, residents.ts addResidents).
// Арендатора можно сменить — новый въезжает через несколько дней, всё это время помещение пустует. Выкупил всю
// улицу — утром история, на столбе у входа табличка «улица <название магазина>» и навсегда чуть больше гостей.
// Всё детерминированно: шум бара — от зерна магазина и дня (как находка кота, cat.ts).
// В мире — scenes/estateFx.ts (фасады и таблички), в утре — ui/estate.ts (раздел «Улица» в «Развитии»).

import type { ProductId, StoreState } from './economy';
import { addGoodwill, goodwillOf } from './goodwill';
import { addResidents } from './residents';
import { homeLevel, inZar } from './zarshop';

export type ShopKind = 'pharmacy' | 'bar' | 'kids' | 'gym' | 'florist' | 'shoes';
export const SHOP_KINDS: ShopKind[] = ['pharmacy', 'bar', 'kids', 'gym', 'florist', 'shoes'];

export interface StreetShop {
  icon: string;
  /** Аренда за день — приходит вечером до счетов. */
  rent: number;
  /** Прибавка к потоку гостей зала (0.02 = +2%). */
  guests: number;
  /** Доля гостей зала, что приходят от него (свой образ и свой список); бар — только к вечеру. */
  share: number;
  /** Образы из scenes/archetypes.ts; 'stroller' — мама с коляской. */
  looks: string[];
  /** Что берут его гости. */
  wants: ProductId[];
  /** Спрос по товарам, пока он работает. */
  demand: Partial<Record<ProductId, number>>;
  /** Семей в районе при первом открытии на улице: +1 — тянет семьи, −1 — отпугивает. */
  families: number;
  /** Гости — вечером (бар). */
  evening?: boolean;
}

/**
 * Аренда — чтобы помещение окупалось за два-три месяца одной арендой (с гостями и спросом — быстрее): это
 * вложение на долгую игру, а не быстрые деньги. Бар платит больше всех, но шумит; ремонт обуви — тихий и дешёвый.
 * Цветочный уводит часть спроса на наши цветы (свои букеты дешевле), зато к нему идут за тортом к празднику.
 */
export const SHOPS: Record<ShopKind, StreetShop> = {
  pharmacy: {
    icon: '💊',
    rent: 420,
    guests: 0.02,
    share: 0.05,
    looks: ['pensioner', 'babushka'],
    wants: ['milk', 'bread', 'apples', 'water', 'juice'],
    demand: { milk: 1.08, apples: 1.1, water: 1.05 },
    families: 1,
  },
  bar: {
    icon: '🍺',
    rent: 620,
    guests: 0.02,
    share: 0.14,
    looks: ['hipster', 'musician', 'punk'],
    wants: ['beer', 'cigarettes', 'fish', 'pickles', 'kvass', 'water'],
    demand: { beer: 1.25, cigarettes: 1.15, fish: 1.1, pickles: 1.15, kvass: 1.1 },
    families: -1,
    evening: true,
  },
  kids: {
    icon: '🧸',
    rent: 360,
    guests: 0.025,
    share: 0.06,
    looks: ['stroller'],
    wants: ['juice', 'icecream', 'buns', 'honeycake', 'milk', 'apples'],
    demand: { juice: 1.12, icecream: 1.15, buns: 1.12, honeycake: 1.12 },
    families: 1,
  },
  gym: {
    icon: '🏋',
    rent: 400,
    guests: 0.02,
    share: 0.05,
    looks: ['jogger', 'yogi'],
    wants: ['water', 'juice', 'milk', 'apples', 'meat'],
    demand: { water: 1.15, juice: 1.08, meat: 1.05 },
    families: 0,
  },
  florist: {
    icon: '💐',
    rent: 330,
    guests: 0.02,
    share: 0.04,
    looks: ['florist', 'artist'],
    wants: ['honeycake', 'juice', 'tangerines', 'icecream'],
    demand: { honeycake: 1.12, flowers: 0.85 },
    families: 0,
  },
  shoes: {
    icon: '👞',
    rent: 250,
    guests: 0.01,
    share: 0.03,
    looks: ['pensioner', 'builder', 'office'],
    wants: ['bread', 'milk', 'water', 'pies'],
    demand: { bread: 1.05, pies: 1.05 },
    families: 0,
  },
};

/**
 * Помещений на улице и их цены: дома вдоль задней улицы слева направо (номера 2, 4, 6, 8). Цены растут: первое —
 * по силам «Супермаркету» за пару недель, последнее — уже к «Универмагу» (симулятор: прибыль 3–9 тыс. в день).
 */
export const LOT_PRICES = [25000, 35000, 45000, 60000];
export const LOTS = LOT_PRICES.length;
/** С какого помещения магазина улицу продают: «Супермаркет» — середина игры. */
export const ESTATE_LEVEL = 3;
/** Первый арендатор открывается назавтра (отделка за ночь); новый вместо старого — через столько дней. */
export const OPEN_DAYS = 1;
export const SWAP_DAYS = 3;
/** Бар шумит ночью с таким шансом (−1 к доброму имени), но ниже BAR_FLOOR сам имя не роняет: «немного шума». */
export const BAR_NOISE = 0.5;
export const BAR_FLOOR = -10;
/** Вся улица наша: гостей навсегда на столько больше (табличка с названием магазина на столбе). */
export const NAMED_GUESTS = 0.03;

export interface EstateLot {
  /** Кого пустили (или кто въезжает). Нет — помещение куплено, но пустует. */
  kind?: ShopKind;
  /** С какого дня он работает (до того — отделка или переезд). */
  from?: number;
  /**
   * День, когда съехал последний работавший арендатор. Пауза на смену считается от него, а не от того, занято ли
   * помещение сейчас (13.11, ревью: «Выселить» и сразу «Пустить» обходили паузу, а замена так и не открывшегося — зря
   * ждала три дня). Нет — работавших здесь ещё не было.
   */
  left?: number;
}

export interface EstateState {
  /** Помещения по номерам (LOT_PRICES); null — ещё не куплено. */
  lots: (EstateLot | null)[];
  /** Кто уже открывался на улице: семьи (residents.ts) приезжают или уезжают от него один раз, а не при каждой смене. */
  met?: ShopKind[];
  /** Вся улица выкуплена в этот день; seen — утренняя история прочитана. */
  named?: number;
  seen?: boolean;
}

const isKind = (k: unknown): k is ShopKind => typeof k === 'string' && k in SHOPS;

/** Помещение i: куплено ли и кто в нём (кривое из сохранения — как не купленное). */
export function lotOf(state: StoreState, i: number): EstateLot | null {
  const lot = state.estate?.lots?.[i];
  if (!lot || typeof lot !== 'object' || i < 0 || i >= LOTS) return null;
  const left = typeof lot.left === 'number' ? { left: lot.left } : {};
  return isKind(lot.kind) ? { kind: lot.kind, from: typeof lot.from === 'number' ? lot.from : 0, ...left } : left;
}

export const ownedLots = (state: StoreState): number => LOT_PRICES.filter((_, i) => lotOf(state, i)).length;

/** Улицу продают: в Центре, с «Супермаркета». Купленное остаётся купленным и в Заречье (платит, как флигель). */
export const estateOpen = (state: StoreState): boolean => !inZar(state) && homeLevel(state) >= ESTATE_LEVEL;

/** Почему нельзя купить: уже наше, рано или не хватает денег. null — можно. */
export function buyLock(state: StoreState, i: number): 'owned' | 'closed' | 'money' | null {
  if (lotOf(state, i)) return 'owned';
  if (!estateOpen(state) || i < 0 || i >= LOTS) return 'closed';
  return state.money < LOT_PRICES[i] ? 'money' : null;
}

const withLots = (state: StoreState, lots: (EstateLot | null)[], extra: Partial<EstateState> = {}): StoreState => ({
  ...state,
  estate: { ...state.estate, ...extra, lots: LOT_PRICES.map((_, i) => lots[i] ?? null) },
});

const lotsOf = (state: StoreState): (EstateLot | null)[] => LOT_PRICES.map((_, i) => lotOf(state, i));

/** Купить помещение. Последнее купленное — вся улица наша: утром история и табличка на столбе. null — нельзя. */
export function buyLot(state: StoreState, i: number): StoreState | null {
  if (buyLock(state, i)) return null;
  const lots = lotsOf(state);
  lots[i] = {};
  const all = lots.every(Boolean);
  return withLots({ ...state, money: state.money - LOT_PRICES[i] }, lots, all ? { named: state.day } : {});
}

/** Кто в помещении (работает или въезжает). */
export const shopIn = (state: StoreState, i: number): ShopKind | null => lotOf(state, i)?.kind ?? null;
/** Работает ли он сегодня. */
export const shopWorks = (state: StoreState, i: number): boolean => {
  const lot = lotOf(state, i);
  return Boolean(lot?.kind && state.day >= (lot.from ?? 0));
};
/** Через сколько дней откроется (0 — работает, или пусто). */
export const opensIn = (state: StoreState, i: number): number => {
  const lot = lotOf(state, i);
  return lot?.kind ? Math.max(0, (lot.from ?? 0) - state.day) : 0;
};

/** Кто сегодня работает на улице. */
export const openShops = (state: StoreState): ShopKind[] => LOT_PRICES.map((_, i) => (shopWorks(state, i) ? shopIn(state, i) : null)).filter(isKind);

/** Почему нельзя пустить: помещение не наше, он уже здесь или на улице в другом помещении. null — можно. */
export function leaseLock(state: StoreState, i: number, kind: ShopKind): 'notOwned' | 'here' | 'taken' | null {
  if (!lotOf(state, i)) return 'notOwned';
  if (shopIn(state, i) === kind) return 'here';
  return LOT_PRICES.some((_, j) => j !== i && shopIn(state, j) === kind) ? 'taken' : null;
}

/** Когда съехал (или съедет сегодня, если его сменить) последний работавший здесь арендатор. */
function leftDay(state: StoreState, lot: EstateLot): number | undefined {
  return lot.kind && state.day >= (lot.from ?? 0) ? state.day : lot.left;
}

/**
 * Через сколько дней откроется новый арендатор, если пустить его сегодня: назавтра (OPEN_DAYS), но не раньше чем
 * через SWAP_DAYS после того, как съехал прежний работавший. Так «Выселить» и «Пустить» не короче «Сменить», а кто
 * передумал до открытия — ждёт, как с первым арендатором.
 */
export function leaseWait(state: StoreState, i: number): number {
  const lot = lotOf(state, i);
  const left = lot ? leftDay(state, lot) : undefined;
  return Math.max(OPEN_DAYS, left === undefined ? 0 : left + SWAP_DAYS - state.day);
}

/**
 * Пустить арендатора (откроется через leaseWait): прежний съезжает сразу, и до открытия нового аренды нет.
 * Отделку делает сам арендатор — хозяин не платит.
 */
export function lease(state: StoreState, i: number, kind: ShopKind): StoreState | null {
  if (inZar(state) || leaseLock(state, i, kind)) return null;
  const lots = lotsOf(state);
  const left = leftDay(state, lots[i] ?? {});
  lots[i] = { kind, from: state.day + leaseWait(state, i), ...(left === undefined ? {} : { left }) };
  return withLots(state, lots);
}

/** Освободить помещение: арендатор съезжает сразу, помещение остаётся нашим (и помнит, когда съехал работавший). */
export function vacate(state: StoreState, i: number): StoreState {
  const lot = lotOf(state, i);
  if (!lot?.kind) return state;
  const lots = lotsOf(state);
  const left = leftDay(state, lot);
  lots[i] = left === undefined ? {} : { left };
  return withLots(state, lots);
}

// ---------- Вся улица ----------

/** Вся улица наша (табличка на столбе и постоянный бонус). */
export const streetNamed = (state: StoreState): boolean => ownedLots(state) === LOTS;

/** Утренняя история «улица вашего имени»: ждёт, пока не прочитают (не в Заречье). */
export const estateNews = (state: StoreState): boolean => streetNamed(state) && !state.estate?.seen && !inZar(state);

export const seeEstate = (state: StoreState): StoreState => (state.estate && !state.estate.seen ? { ...state, estate: { ...state.estate, seen: true } } : state);

// ---------- День и ночь ----------

/** Аренда за день со всех работающих помещений. */
export const estateRent = (state: StoreState): number => openShops(state).reduce((sum, k) => sum + SHOPS[k].rent, 0);

/** Множитель гостей зала (в Центре: day.ts homeOnly). */
export const estateGuests = (state: StoreState): number =>
  1 + openShops(state).reduce((sum, k) => sum + SHOPS[k].guests, 0) + (streetNamed(state) ? NAMED_GUESTS : 0);

/** Множитель спроса на товар от лавок улицы (в Центре: demand.ts). */
export function estateDemand(state: StoreState, id: ProductId): number {
  let k = 1;
  for (const kind of openShops(state)) k *= SHOPS[kind].demand[id] ?? 1;
  return k;
}

/**
 * Гость зала пришёл из лавки на улице? Тогда — её образ и что он берёт. evening — последняя треть смены или ночь:
 * гости бара идут только тогда (и тогда их доля выше), остальные — весь день. Случайность — сцены (Math.random):
 * на деньги она не влияет, гостей и спрос уже посчитали estateGuests и estateDemand.
 */
export function estateGuest(state: StoreState, random: () => number, evening: boolean): { kind: ShopKind; look: string; wants: ProductId[] } | null {
  if (inZar(state)) return null;
  let roll = random();
  for (const kind of openShops(state)) {
    const shop = SHOPS[kind];
    if (shop.evening && !evening) continue;
    if (roll >= shop.share) {
      roll -= shop.share;
      continue;
    }
    return { kind, look: shop.looks[Math.floor(random() * shop.looks.length)], wants: shop.wants };
  }
  return null;
}

/** Детерминированное 0…1 от зерна магазина и дня (salt — какой вопрос). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2246822519 + state.day * 69069 + salt * 40503 + 7) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2654435761) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 10000) / 10000;
}

/** Бар шумел этой ночью (детерминированно от зерна и дня). */
export const barNoise = (state: StoreState): boolean => openShops(state).includes('bar') && roll(state, 1) < BAR_NOISE;

/**
 * Вечер (day.ts, до счетов): лавки платят аренду; бар иногда шумит — доброе имя −1, но сам ниже BAR_FLOOR его
 * не роняет. Платят и когда хозяин в Заречье: помещения — в Центре, а аренда идёт сама.
 */
export function estateNight(state: StoreState): { state: StoreState; income: number } {
  const income = estateRent(state);
  let s = income ? { ...state, money: state.money + income } : state;
  if (barNoise(s) && goodwillOf(s) > BAR_FLOOR) s = addGoodwill(s, -1);
  return { state: s, income };
}

/**
 * Утро (day.ts, после смены дня): кто сегодня открылся на улице впервые — от того в районе прибавляется или убавляется
 * семья (residents.ts). Один раз на вид лавки: менять арендаторов ради семей бесполезно.
 */
export function estateMorning(state: StoreState): StoreState {
  if (!state.estate) return state;
  const met = state.estate.met ?? [];
  const fresh = openShops(state).filter((k) => !met.includes(k));
  if (!fresh.length) return state;
  let s: StoreState = { ...state, estate: { ...state.estate, met: [...met, ...fresh] } };
  for (const k of fresh) if (SHOPS[k].families) s = addResidents(s, SHOPS[k].families);
  return s;
}

/** Что видно на улице: кто где, кто ещё въезжает, вся ли улица наша. Изменилось — сцена перестраивает дома. */
export const estateLook = (state: StoreState): string =>
  state.estate && !inZar(state)
    ? `${LOT_PRICES.map((_, i) => {
        const lot = lotOf(state, i);
        return lot ? (lot.kind ? `${lot.kind}${shopWorks(state, i) ? '' : '~'}` : 'o') : '-';
      }).join(',')}|${streetNamed(state) ? state.shopName ?? '' : ''}`
    : '';

export const shopName = (kind: ShopKind): `estate.${ShopKind}.name` => `estate.${kind}.name`;
export const shopDesc = (kind: ShopKind): `estate.${ShopKind}.desc` => `estate.${kind}.desc`;
/** Короткая надпись на вывеске (капсом, как у флигеля). */
export const shopSign = (kind: ShopKind): `estate.${ShopKind}.sign` => `estate.${kind}.sign`;
