// Чистая игровая логика без Phaser: её легко тестировать и потом переиспользовать
// на сервере (проверка сохранений, расчёт дохода офлайн).

import type { TextKey } from '../i18n/ru';
import type { DayPlan } from './events';
import type { StoryState } from './story';
import { newDecor, type DecorState } from './decor';
import type { ReviewTopic, Review } from './reviews';
import type { War } from './war';
import type { ShopCat } from './cat';
import type { DayReport } from './reports';
import { afterLoanPayment, loanDue } from './bank';
import { fridgeLife, fridgePower, lightsPower, solarPower, warehouseRoom, type GearId } from './gear';

/**
 * Тип полки определяет, какой товар на неё можно ставить: мясо не кладут к хлебу.
 * Ларь с мороженым (у входа) и цветы у кассы — тоже «полки», но стоят на своих местах,
 * а не на местах под полки в зале.
 */
export type Category = 'bakery' | 'produce' | 'dairy' | 'meat' | 'drinks' | 'frozen' | 'household' | 'icebox' | 'florist';

export type ProductId =
  | 'bread'
  | 'apples'
  | 'potatoes'
  | 'milk'
  | 'meat'
  | 'icecream'
  | 'tangerines'
  | 'flowers'
  | 'water'
  | 'juice'
  | 'dumplings'
  | 'fish'
  | 'soap'
  | 'detergent'
  // Своя выпечка «От бабушки» (brand.ts): печёт пекарь, у поставщиков её нет.
  | 'pies'
  | 'buns'
  | 'honeycake';

export interface Product {
  id: ProductId;
  nameKey: TextKey;
  icon: string;
  category: Category;
  /** Базовая цена закупки за штуку (у поставщика может отличаться). */
  cost: number;
  /** «Справедливая» розничная цена: при ней спрос нормальный. */
  basePrice: number;
  /** Сколько дней товар живёт (и на складе, и на полке), потом портится. */
  shelfLife: number;
  color: number;
}

/** Срок годности у товаров, которые не портятся: вода, сок в пачках, мыло, порошок. */
const NEVER = Infinity;

export const PRODUCTS: Record<ProductId, Product> = {
  bread: { id: 'bread', nameKey: 'product.bread', icon: '🍞', category: 'bakery', cost: 25, basePrice: 40, shelfLife: 2, color: 0xd9a066 },
  apples: { id: 'apples', nameKey: 'product.apples', icon: '🍎', category: 'produce', cost: 16, basePrice: 30, shelfLife: 5, color: 0xd04648 },
  potatoes: { id: 'potatoes', nameKey: 'product.potatoes', icon: '🥔', category: 'produce', cost: 10, basePrice: 20, shelfLife: 7, color: 0xa47a52 },
  milk: { id: 'milk', nameKey: 'product.milk', icon: '🥛', category: 'dairy', cost: 36, basePrice: 60, shelfLife: 3, color: 0xeef3f7 },
  meat: { id: 'meat', nameKey: 'product.meat', icon: '🥩', category: 'meat', cost: 90, basePrice: 150, shelfLife: 2, color: 0xb83a4b },
  // Сезонные товары: продаются только в свои месяцы (см. SEASONAL).
  icecream: { id: 'icecream', nameKey: 'product.icecream', icon: '🍦', category: 'icebox', cost: 30, basePrice: 55, shelfLife: 4, color: 0xf6c6d6 },
  tangerines: { id: 'tangerines', nameKey: 'product.tangerines', icon: '🍊', category: 'produce', cost: 20, basePrice: 40, shelfLife: 6, color: 0xf77622 },
  flowers: { id: 'flowers', nameKey: 'product.flowers', icon: '💐', category: 'florist', cost: 35, basePrice: 70, shelfLife: 3, color: 0xe43b44 },
  // Новые отделы больших магазинов: напитки, заморозка, бытовая химия (полки — с уровня помещения).
  water: { id: 'water', nameKey: 'product.water', icon: '💧', category: 'drinks', cost: 12, basePrice: 25, shelfLife: NEVER, color: 0x0099db },
  juice: { id: 'juice', nameKey: 'product.juice', icon: '🧃', category: 'drinks', cost: 28, basePrice: 50, shelfLife: NEVER, color: 0xfeae34 },
  dumplings: { id: 'dumplings', nameKey: 'product.dumplings', icon: '🥟', category: 'frozen', cost: 45, basePrice: 80, shelfLife: 20, color: 0xead4aa },
  fish: { id: 'fish', nameKey: 'product.fish', icon: '🐟', category: 'frozen', cost: 60, basePrice: 110, shelfLife: 14, color: 0x8b9bb4 },
  soap: { id: 'soap', nameKey: 'product.soap', icon: '🧼', category: 'household', cost: 15, basePrice: 35, shelfLife: NEVER, color: 0xb55088 },
  detergent: { id: 'detergent', nameKey: 'product.detergent', icon: '🧴', category: 'household', cost: 55, basePrice: 99, shelfLife: NEVER, color: 0x5fcde4 },
  // Своя выпечка: cost — мука и начинка на штуку.
  pies: { id: 'pies', nameKey: 'product.pies', icon: '🥧', category: 'bakery', cost: 16, basePrice: 45, shelfLife: 2, color: 0xfeae34 },
  buns: { id: 'buns', nameKey: 'product.buns', icon: '🥐', category: 'bakery', cost: 14, basePrice: 40, shelfLife: 2, color: 0xead4aa },
  honeycake: { id: 'honeycake', nameKey: 'product.honeycake', icon: '🍰', category: 'bakery', cost: 40, basePrice: 110, shelfLife: 3, color: 0xb86f50 },
};

/** Своя выпечка по ступеням марки «От бабушки»: первая ступень — пирожки, вторая — булочки, третья — медовик. */
export const OWN_PRODUCTS: ProductId[] = ['pies', 'buns', 'honeycake'];
/** Своя выпечка открыта на этой ступени марки (обычные товары — всегда). */
export const ownProductOpen = (state: { brand?: number }, id: ProductId): boolean => {
  const i = OWN_PRODUCTS.indexOf(id);
  return i < 0 || i < (state.brand ?? 0);
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

/** Месяцев в игровом году (= YEAR_MONTHS в calendar.ts, проверяется тестом). */
const YEAR_MONTHS = 16;
/**
 * Сезонные товары: в какие месяцы игрового года (0…15) их продают.
 * Мороженое — летом, мандарины — перед Новым годом и в новогоднюю неделю, цветы — весной.
 */
export const SEASONAL: Partial<Record<ProductId, number[]>> = { tangerines: [2, 3], flowers: [4, 5, 6] };

export const monthInYear = (day: number): number => (monthOf(day) - 1) % YEAR_MONTHS;
export const productAvailable = (id: ProductId, day: number): boolean => SEASONAL[id]?.includes(monthInYear(day)) ?? true;

/** Через сколько дней начнётся сезон товара (0 — уже сезон или товар всегда в продаже). */
export function daysUntilSeason(id: ProductId, day: number): number {
  for (let n = 0; n <= YEAR_MONTHS * MONTH_DAYS; n++) if (productAvailable(id, day + n)) return n;
  return 0;
}

/** Летние месяцы (7…10) — мороженое продаётся круглый год, но летом его берут охотнее, в Новый год — реже. */
const SUMMER_MONTHS = [7, 8, 9, 10];

/** Спрос на сезонный товар: в сезон берут охотно, на 8 Марта (первые два дня весны) цветы — нарасхват. */
export function seasonalDemand(id: ProductId, day: number): number {
  if (id === 'icecream') return SUMMER_MONTHS.includes(monthInYear(day)) ? 1.5 : monthInYear(day) === 3 ? 0.6 : 1;
  if (!SEASONAL[id]) return 1;
  if (id === 'flowers' && monthInYear(day) === 4 && (day - 1) % MONTH_DAYS < 2) return 5;
  return 1.5;
}

export interface ShelfKind {
  nameKey: TextKey;
  /** Цена покупки новой полки такого типа. */
  price: number;
  /** Холодильник: каждый день тратит электричество. */
  fridge: boolean;
  /** С какого уровня помещения можно поставить (новые отделы — только в больших магазинах). */
  minLevel?: number;
  /** Стоит на своём месте (ларь у входа, цветы у кассы), а не на месте под полку; такой — один. */
  fixture?: boolean;
  /** Холодильник работает только в сезон своего товара (сейчас таких нет: мороженое — круглый год). */
  seasonal?: ProductId;
}

export const SHELF_KINDS: Record<Category, ShelfKind> = {
  bakery: { nameKey: 'shelf.bakery', price: 150, fridge: false },
  produce: { nameKey: 'shelf.produce', price: 150, fridge: false },
  dairy: { nameKey: 'shelf.dairy', price: 300, fridge: true },
  meat: { nameKey: 'shelf.meat', price: 400, fridge: true },
  drinks: { nameKey: 'shelf.drinks', price: 250, fridge: false, minLevel: 1 },
  frozen: { nameKey: 'shelf.frozen', price: 450, fridge: true, minLevel: 2 },
  household: { nameKey: 'shelf.household', price: 250, fridge: false, minLevel: 3 },
  icebox: { nameKey: 'shelf.icebox', price: 350, fridge: true, fixture: true, minLevel: 1 },
  florist: { nameKey: 'shelf.florist', price: 0, fridge: false, fixture: true },
};

/** Ларь с мороженым у входа и цветы у кассы: стоят на своих местах, мест под полки не занимают. */
export const FIXTURE_KINDS = (Object.keys(SHELF_KINDS) as Category[]).filter((k) => SHELF_KINDS[k].fixture);
export const isFixture = (shelf: Shelf): boolean => Boolean(SHELF_KINDS[shelf.kind].fixture);
export const fixtureIndex = (state: StoreState, kind: Category): number => state.shelves.findIndex((s) => s.kind === kind);
/**
 * Номер места в зале для полки state.shelves[index]: считаются только обычные полки.
 * Для ларя и цветов — −1 (у них свои места).
 */
export function slotOf(state: StoreState, index: number): number {
  if (!state.shelves[index] || isFixture(state.shelves[index])) return -1;
  return state.shelves.slice(0, index).filter((s) => !isFixture(s)).length;
}

/** Новые отделы больших магазинов: за водой, пельменями и порошком заходят отдельно. */
export const NEW_DEPARTMENTS: Category[] = ['drinks', 'frozen', 'household'];
/** Каждый открытый новый отдел приводит столько гостей сверху. */
export const DEPARTMENT_GUESTS = 0.06;
export const departmentGuests = (state: StoreState): number =>
  1 + DEPARTMENT_GUESTS * NEW_DEPARTMENTS.filter((k) => state.shelves.some((s) => s.kind === k && !s.broken)).length;

/** Можно ли поставить полку такого типа в этом помещении. */
export const shelfKindOpen = (state: StoreState, kind: Category): boolean => state.level >= (SHELF_KINDS[kind].minLevel ?? 0);

/** Проданная полка возвращает часть цены. */
export const SHELF_RESALE = 0.5;
/** Электричество одного холодильника за месяц. */
export const FRIDGE_POWER = 100;

/** Обычные полки, которые покупают на свободные места в зале. */
export const CATEGORIES = (Object.keys(SHELF_KINDS) as Category[]).filter((k) => !SHELF_KINDS[k].fixture);

/** Уровни полки: вместимость и цена улучшения до этого уровня. */
export const SHELF_LEVELS = [
  { capacity: 8, cost: 0 },
  { capacity: 12, cost: 120 },
  { capacity: 16, cost: 250 },
  { capacity: 24, cost: 500 },
] as const;

/**
 * Помещение магазина. Растёт за монеты: больше места под полки, больше склад,
 * больше гостей — но и аренда выше.
 */
export interface StoreLevel {
  nameKey: TextKey;
  /** Цена расширения до этого уровня. */
  cost: number;
  /** Сколько полок помещается. */
  slots: number;
  warehouse: number;
  /** Аренда за месяц. */
  rent: number;
  /** Коммуналка за месяц: вода, вывоз мусора. */
  utilities: number;
  /** Электричество за месяц без холодильников: свет, касса, вывеска. */
  power: number;
  /** Множитель потока гостей: большой магазин видно с улицы. */
  guests: number;
  /** Сколько покупателей одновременно бывает в зале. */
  maxCustomers: number;
}

export const STORE_LEVELS: StoreLevel[] = [
  { nameKey: 'store.l1', cost: 0, slots: 3, warehouse: 20, rent: 140, utilities: 40, power: 30, guests: 1, maxCustomers: 5 },
  { nameKey: 'store.l2', cost: 1000, slots: 7, warehouse: 35, rent: 350, utilities: 70, power: 50, guests: 1.3, maxCustomers: 7 },
  { nameKey: 'store.l3', cost: 3200, slots: 9, warehouse: 55, rent: 600, utilities: 110, power: 80, guests: 1.6, maxCustomers: 9 },
  { nameKey: 'store.l4', cost: 6500, slots: 14, warehouse: 80, rent: 1000, utilities: 160, power: 120, guests: 1.9, maxCustomers: 11 },
  { nameKey: 'store.l5', cost: 14000, slots: 17, warehouse: 110, rent: 1500, utilities: 230, power: 170, guests: 2.2, maxCustomers: 13 },
];

/**
 * Игровой месяц — 7 дней (~15–20 минут игры). В конце месяца приходят счета:
 * аренда, коммуналка, электричество, зарплаты и платёж по кредиту.
 */
/** Сколько последних дней помнить для графика выручки. */
export const HISTORY_DAYS = 14;

export const MONTH_DAYS = 7;
/** Не хватило денег на счета — недостача уходит в долг, сверху пени. */
export const LATE_PENALTY = 0.1;

/** Бабушкин кредит: платёж раз в месяц вместе со счетами, можно гасить досрочно. */
export const START_DEBT = 500;
export const DEBT_PAYMENT = 250;

export type StaffRole = 'cashier' | 'cashier2' | 'cashier3' | 'cashier4' | 'cleaner' | 'loader' | 'guard' | 'manager' | 'baker' | 'barista';

/** Сотрудники: каждый забирает у игрока одно ручное дело. Зарплата — базовая за месяц. */
export const STAFF_ROLES: Record<StaffRole, { nameKey: TextKey; descKey: TextKey; wage: number; minLevel?: number; needs?: 'oven' | 'coffee' }> = {
  cashier: { nameKey: 'staff.cashier', descKey: 'staff.cashier.desc', wage: 420 },
  cashier2: { nameKey: 'staff.cashier2', descKey: 'staff.cashier2.desc', wage: 420 },
  cashier3: { nameKey: 'staff.cashier3', descKey: 'staff.cashier3.desc', wage: 420 },
  cashier4: { nameKey: 'staff.cashier4', descKey: 'staff.cashier4.desc', wage: 420 },
  cleaner: { nameKey: 'staff.cleaner', descKey: 'staff.cleaner.desc', wage: 280 },
  loader: { nameKey: 'staff.loader', descKey: 'staff.loader.desc', wage: 350 },
  guard: { nameKey: 'staff.guard', descKey: 'staff.guard.desc', wage: 490 },
  // Менеджер зала — только в супермаркете и больше: организует работу (все быстрее), сам
  // заказывает срочный подвоз, когда товар кончился, и встаёт за кассу вместо отсутствующего.
  manager: { nameKey: 'staff.manager', descKey: 'staff.manager.desc', wage: 650, minLevel: 3 },
  // Пекарь работает в пекарне во флигеле (нужна печь), бариста — в кофейне (нужен кофейный уголок).
  baker: { nameKey: 'staff.baker', descKey: 'staff.baker.desc', wage: 380, needs: 'oven' },
  barista: { nameKey: 'staff.barista', descKey: 'staff.barista.desc', wage: 360, needs: 'coffee' },
};

/** Можно ли нанять на эту должность в этом помещении. */
export const roleOpen = (state: StoreState, role: StaffRole): boolean => {
  const { minLevel = 0, needs } = STAFF_ROLES[role];
  return state.level >= minLevel && (!needs || (state.upgrades ?? []).includes(needs));
};

export const STAFF_ROLE_IDS = Object.keys(STAFF_ROLES) as StaffRole[];

/**
 * Черта характера: трудоголик работает быстрее и просит больше, тормоз — наоборот,
 * «нечист на руку» дешёвый, но подворовывает из кассы.
 */
export type Trait = 'hardworker' | 'slowpoke' | 'sticky';

export const TRAITS: Record<Trait, { nameKey: TextKey; descKey: TextKey; speed: number; pay: number }> = {
  hardworker: { nameKey: 'trait.hardworker', descKey: 'trait.hardworker.desc', speed: 1.25, pay: 1.15 },
  slowpoke: { nameKey: 'trait.slowpoke', descKey: 'trait.slowpoke.desc', speed: 0.75, pay: 0.85 },
  sticky: { nameKey: 'trait.sticky', descKey: 'trait.sticky.desc', speed: 1, pay: 0.8 },
};

/** Навык 1–3 ★: скорость и зарплата. */
const SKILL_SPEED = [0.8, 1, 1.25];
const SKILL_PAY = [0.85, 1, 1.3];
/** «Нечист на руку» уносит такую долю дневной выручки. */
export const STICKY_SKIM = 0.04;
/** Навык растёт каждые столько месяцев работы. */
export const MONTHS_PER_SKILL = 2;
/** Сколько сотрудников помещается в помещении каждого уровня. */
export const STAFF_LIMIT = [1, 3, 5, 9, 11];

export interface StaffMember {
  role: StaffRole;
  /** Индекс имени в списке имён (имя переводится при показе). */
  name: number;
  skill: number;
  trait?: Trait;
  /** Зарплата за месяц. */
  wage: number;
  /** Сколько месяцев проработал. */
  months: number;
  /** Просит прибавку до этой суммы — ждёт ответа игрока. */
  raiseAsk?: number;
  /** Обиделся (отказали в прибавке): работает медленнее, может уволиться. */
  upset?: boolean;
  /** Сколько дней подряд вышел на работу (усталость; выходной обнуляет). */
  streak?: number;
  /** В этот день не выйдет: выходной. */
  offDay?: number;
}

export function wageFor(role: StaffRole, skill: number, trait?: Trait): number {
  const pay = SKILL_PAY[skill - 1] * (trait ? TRAITS[trait].pay : 1);
  return Math.round((STAFF_ROLES[role].wage * pay) / 10) * 10;
}

/** Множитель скорости работы: 1 — обычная. */
export const workSpeed = (m: StaffMember): number =>
  SKILL_SPEED[m.skill - 1] * (m.trait ? TRAITS[m.trait].speed : 1) * (m.upset ? UPSET_SPEED : 1) * (isTired(m) ? TIRED_SPEED : 1);

/** Без выходных столько дней подряд — устаёт и работает медленнее. */
export const TIRED_DAYS = 6;
export const TIRED_SPEED = 0.85;
export const isTired = (m: StaffMember): boolean => (m.streak ?? 0) >= TIRED_DAYS;
/** Сотрудник сегодня не на работе: заболел, отпросился или выходной. */
export const isAbsent = (state: StoreState, m: StaffMember): boolean => state.plan?.sick === m.role || m.offDay === state.day;

/** Дать выходной на завтра (сегодня он уже на работе). */
export function giveDayOff(state: StoreState, role: StaffRole): StoreState | null {
  const m = staffOf(state, role);
  if (!m || m.offDay === state.day + 1) return null;
  return { ...state, staff: state.staff.map((x) => (x.role === role ? { ...x, offDay: state.day + 1 } : x)) };
}

/** Менеджер зала на месте — все работают быстрее (и хозяин за кассой тоже). */
export const MANAGER_BOOST = 1.1;
export const managerBoost = (state: StoreState): number =>
  state.staff.some((m) => m.role === 'manager' && !isAbsent(state, m)) ? MANAGER_BOOST : 1;

/** Ночная смена выматывает: за такой день усталость растёт вдвое. */
export const NIGHT_FATIGUE = 2;
/** Столько дней без выходных — вымотался и сам не выходит завтра. */
export const EXHAUSTED_DAYS = 10;

/**
 * Конец дня: кто работал — устаёт (после ночной смены — вдвое), кто отдыхал — отдохнул.
 * Совсем вымотанный (EXHAUSTED_DAYS) берёт выходной сам — пекарня или кофейня завтра без него.
 */
export const restStaff = (state: StoreState, night = false): StoreState => ({
  ...state,
  staff: state.staff.map((m) => {
    if (isAbsent(state, m)) return { ...m, streak: 0 };
    const streak = (m.streak ?? 0) + (night ? NIGHT_FATIGUE : 1);
    return { ...m, streak, offDay: streak >= EXHAUSTED_DAYS && (m.offDay ?? 0) <= state.day ? state.day + 1 : m.offDay };
  }),
});

/** Обиженный сотрудник работает медленнее. */
export const UPSET_SPEED = 0.75;
/** Шанс, что обиженный уволится в конце месяца. */
export const UPSET_QUIT_CHANCE = 0.5;
/** Шанс, что опытный сотрудник сам попросит прибавку в конце месяца (кроме роста навыка). */
export const RAISE_ASK_CHANCE = 0.2;
/** На сколько просят прибавку, если навык не вырос. */
export const RAISE_STEP = 0.1;

export const staffOf = (state: StoreState, role: StaffRole): StaffMember | undefined => state.staff.find((m) => m.role === role);
/** Сотрудник на этой должности есть и сегодня на работе. */
export const onShift = (state: StoreState, role: StaffRole): boolean => {
  const m = staffOf(state, role);
  return Boolean(m) && !isAbsent(state, m!);
};
export const staffLimit = (state: StoreState): number => STAFF_LIMIT[state.level];

/** Нанять: одна роль — один человек, не больше лимита помещения. */
export function hire(state: StoreState, member: StaffMember): StoreState | null {
  if (staffOf(state, member.role) || state.staff.length >= staffLimit(state)) return null;
  const jobSearch = state.jobSearch && { ...state.jobSearch, candidates: state.jobSearch.candidates.filter((c) => c !== member) };
  return { ...state, staff: [...state.staff, member], jobSearch };
}

export function fire(state: StoreState, role: StaffRole): StoreState {
  return { ...state, staff: state.staff.filter((m) => m.role !== role) };
}

/**
 * Конец месяца для персонала. Обиженные могут уволиться, остальные успокаиваются.
 * Опыт растёт; раз в MONTHS_PER_SKILL месяцев растёт навык — и сотрудник просит
 * прибавку. Опытные иногда просят прибавку и просто так.
 */
export function monthForStaff(staff: StaffMember[], random: () => number): { staff: StaffMember[]; quit: StaffMember[] } {
  const quit: StaffMember[] = [];
  const kept: StaffMember[] = [];
  // За месяц о прибавке заговаривает только один: остальные (даже с выросшим навыком) — в следующие месяцы.
  let asked = staff.some((m) => m.raiseAsk);
  for (const m of staff) {
    if (m.upset && random() < UPSET_QUIT_CHANCE) {
      quit.push(m);
      continue;
    }
    const months = m.months + 1;
    const skill = months % MONTHS_PER_SKILL === 0 ? Math.min(3, m.skill + 1) : m.skill;
    let raiseAsk = m.raiseAsk;
    if (!raiseAsk && !asked) {
      // Навык вырос, а платят по-старому — просит по новому навыку; опытные иногда просят и просто так.
      if (m.wage < wageFor(m.role, skill, m.trait)) raiseAsk = wageFor(m.role, skill, m.trait);
      else if (months >= 3 && random() < RAISE_ASK_CHANCE) raiseAsk = Math.round((m.wage * (1 + RAISE_STEP)) / 10) * 10;
      asked = Boolean(raiseAsk && raiseAsk > m.wage);
    }
    kept.push({ ...m, months, skill, raiseAsk: raiseAsk && raiseAsk > m.wage ? raiseAsk : undefined, upset: false });
  }
  return { staff: kept, quit };
}

/** Ответ на просьбу о прибавке: согласиться — платить больше, отказать — обида. */
export function answerRaise(state: StoreState, role: StaffRole, accept: boolean): StoreState {
  return {
    ...state,
    staff: state.staff.map((m) =>
      m.role !== role || !m.raiseAsk
        ? m
        : accept
          ? { ...m, wage: m.raiseAsk, raiseAsk: undefined, upset: false }
          : { ...m, raiseAsk: undefined, upset: true },
    ),
  };
}

/** Сколько за день унесли из кассы сотрудники «нечист на руку». */
export const skimmedToday = (state: StoreState, revenue: number): number =>
  Math.round(revenue * STICKY_SKIM * state.staff.filter((m) => m.trait === 'sticky').length);

/** Доля покупателей-воров: в большом магазине больше. */
export const thiefChance = (level: number): number => 0.05 + 0.015 * level;
/** Шанс, что охранник поймает вора у выхода. */
export const guardCatchChance = (m: StaffMember): number => Math.min(0.95, 0.6 * workSpeed(m));

// ---------- Касса: пробивка занимает время ----------

/** Навык кассы хозяина: сколько покупателей надо обслужить для каждого уровня (★1…★5). */
export const OWNER_LEVELS = [0, 25, 70, 150, 300];
/** Секунд на один товар у хозяина по уровням навыка. */
const OWNER_SCAN = [1.0, 0.85, 0.72, 0.6, 0.48];
/** Сколько секунд кассир с обычной скоростью тратит на товар и на оплату. */
const CASHIER_SCAN = 0.7;
const CASHIER_PAY = 0.5;

export const ownerLevel = (served: number): number => OWNER_LEVELS.filter((n) => served >= n).length;

/** Сколько осталось до следующего уровня навыка кассы (null — максимум). */
export const ownerNextLevelAt = (served: number): number | null => OWNER_LEVELS[ownerLevel(served)] ?? null;

export interface ScanTiming {
  /** Секунд на один товар. */
  item: number;
  /** Секунд на оплату. */
  pay: number;
}

export function ownerScan(served: number): ScanTiming {
  const item = OWNER_SCAN[ownerLevel(served) - 1];
  return { item, pay: item * 0.7 };
}

export const cashierScan = (m: StaffMember): ScanTiming => ({ item: CASHIER_SCAN / workSpeed(m), pay: CASHIER_PAY / workSpeed(m) });

/** Средняя корзина в штуках и сколько секунд покупатель подходит к кассе и отходит. */
export const AVG_BASKET = 1.4;
export const QUEUE_STEP_SECONDS = 0.3;
/** Сколько покупателей за день успевает пробить тот, кто стоит за кассой без перерыва. */
export const servePerDay = (t: ScanTiming): number => Math.floor(DAY_SECONDS / (checkoutSeconds(t, AVG_BASKET) + QUEUE_STEP_SECONDS));

/** Сколько секунд пробивается корзина. */
export const checkoutSeconds = (t: ScanTiming, items: number): number => t.item * items + t.pay;

/** Сколько штук продавец уносит со склада за один поход. */
export const CARRY = 6;

export const PRICE_STEP = 5;
export const DAY_SECONDS = 90;

/** Уценённый товар продаётся за половину цены. */
export const MARKDOWN = 0.5;
/** Поставщик забирает бракованную партию и возвращает половину денег. */
export const RETURN_REFUND = 0.5;
/** Шанс, что покупатель пожалуется на бракованный товар без уценки. */
export const BAD_COMPLAINT_CHANCE = 0.5;

/** Одна штука товара. */
export interface Unit {
  /** Сколько дней лежит. */
  age: number;
  /** Брак: портится на день раньше, покупатели могут жаловаться. */
  bad?: boolean;
  /** Уценён: продаётся дешевле, жалоб нет. */
  markdown?: boolean;
  /** Бракованная партия, по которой игрок ещё не принял решение. */
  pending?: boolean;
}

export type Stock = Partial<Record<ProductId, Unit[]>>;

export interface Shelf {
  kind: Category;
  level: number;
  /** Товар на полке, у каждого товара самые старые штуки — в начале. */
  items: Stock;
  /** Сломанный холодильник: с него не продают и не раскладывают, товар портится быстрее. */
  broken?: boolean;
  /** Старая отметка «в первую очередь» из прежних сохранений — больше не используется. */
  priority?: boolean;
}

export interface StoreState {
  day: number;
  money: number;
  /** Уровень помещения — индекс в STORE_LEVELS. */
  level: number;
  /** Долг: пока он есть, арендодатель не даёт расширяться. */
  debt: number;
  staff: StaffMember[];
  /** Сколько покупателей хозяин обслужил сам — от этого растёт навык кассы. */
  ownerServed: number;
  /** Выручка за всё время — от неё растёт звание магазина. */
  totalRevenue: number;
  /** Редкие гости, которых уже обслужили (альбом). */
  album: string[];
  /** Сегодняшнее объявление о вакансии и кандидаты по нему. */
  jobSearch?: { day: number; role: StaffRole; candidates: StaffMember[] };
  /** Кто уволился в конце месяца (показываем утром). */
  quitNotice?: StaffMember[];
  /** План сегодняшнего дня: событие утра, проверка, час пик. */
  plan?: DayPlan;
  story: StoryState;
  /** Оформление магазина. */
  decor: DecorState;
  /** Выручка последних дней — для графика в итогах дня. */
  history: number[];
  /** Открытые достижения (id из achievements.ts). */
  achievements: string[];
  /** Счётчики за всю игру — для достижений. */
  lifetime: Lifetime;
  /** Подарок за ежедневный вход: когда забрали последний (дата YYYY-MM-DD) и какой по счёту день подряд. */
  gift: { lastDate: string; streak: number };
  /** Постоянные покупатели: доверие (0…5) и до какого дня обиделись (regulars.ts). */
  regulars?: Record<string, { loyalty: number; awayUntil: number }>;
  /** Купленные улучшения кассы (upgrades.ts). */
  upgrades?: string[];
  /** Реклама: какая и в какие дни (включительно) работает. */
  ads?: { id: 'flyers' | 'banner' | 'blogger'; from: number; until: number };
  /** Стойка со сладостями у кассы (impulse.ts). */
  rack?: { level: number; stock: number };
  /** Своё зерно магазина: от него зависит расписание особых дней (у каждого игрока своё). */
  seed?: number;
  /** Просрочку отдают в приют, а не выбрасывают: о магазине говорят хорошо (рейтинг). */
  donate?: boolean;
  /** Сколько хлеба печёт пекарь (bakery.ts): по спросу, сколько влезет или не печь хлеб. */
  bakeMode?: 'auto' | 'full' | 'off';
  /** Сколько касс куплено (registers.ts). Нет поля — старое сохранение: кассы ставились сами. */
  registers?: number;
  /** Стаканчики в кофейном уголке (coffee.ts). */
  cups?: number;
  /** Ценовая война с Эдуардом (war.ts). */
  war?: War;
  /** Кот магазина (cat.ts) и с какого дня снова предложить его оставить. */
  cat?: ShopCat;
  catAsk?: number;
  /** Отзывы за последний день (reviews.ts). */
  reviews?: Review[];
  /** Акция дня на один товар (promo.ts). */
  promo?: { day: number; product: ProductId; kind: 'discount' | 'bogo' };
  /** Договоры с поставщиками: товар приезжает каждое утро сам (contracts.ts). */
  contracts?: { sid: string; pid: ProductId; qty: number; until: number; last?: number }[];
  /** Испытания недели (weekly.ts). */
  weekly?: { month: number; challenges: { kind: string; target: number; product?: ProductId; progress: number; reward: number; done?: boolean }[] };
  /** Какие подсказки о новых механиках уже показаны (tips.ts). */
  seenTips?: string[];
  /** Навыки хозяина: ступень каждого (owner.ts). */
  skills?: Partial<Record<'hands' | 'haggle' | 'strong' | 'charm' | 'eye', number>>;
  /** Кредит в банке: сколько осталось вернуть и платёж в месяц (bank.ts). */
  loan?: { left: number; payment: number };
  /** Отчёт по дням: последние REPORT_DAYS дней (reports.ts). */
  reports?: DayReport[];
  /** Радио: какая волна играет (radio.ts); нет поля — приёмник не куплен. */
  radio?: 'off' | 'retro' | 'hits';
  /**
   * Конкурент напротив после сюжета (eduard.ts): какой по счёту, с какого дня, какую новость видели,
   * сколько вечеров подряд держим его планку рейтинга и побеждён ли он.
   */
  eduard?: { stage: number; since: number; seen: number; streak?: number; beaten?: boolean; beatenSeen?: number };
  /** Долг выше предела: банк предупредил (bankruptcy.ts). */
  debtWarning?: { seen: boolean };
  /** Бабушка уже выручила в этой игре: сколько погасила и видел ли игрок. */
  grandmaRescue?: { paid: number; seen: boolean };
  /** Магазин закрыт за долги — остаётся только начать заново. */
  bankrupt?: boolean;
  /** Сколько игр начато заново. */
  runs?: number;
  /** Сколько должна добрая бабушка, которой дали хлеба в долг (special.ts). */
  grannyOwed?: number;
  /** Договор с кафе «Пончик» по соседству (cafe.ts). */
  cafe?: import('./cafe').CafeState;
  /** Гипермаркет «Гигант» за дорогой — после сюжета (giant.ts). */
  giant?: import('./giant').GiantState;
  /** Ночная охрана: пёс Бобик, сторож и новость о ночных ворах (watch.ts). */
  security?: import('./watch').Security;
  /** Конкурсы «Лучший магазин района, города…» — финал истории и звания (contest.ts). */
  contest?: import('./contest').ContestState;
  /** Сюжет «Папа и Соня»: сколько сцен показано (drama.ts). На экономику не влияет. */
  drama?: import('./drama').DramaState;
  /** Ступень своей марки «От бабушки» (0 — нет, brand.ts). */
  brand?: number;
  /** Личные рекорды игрока (records.ts) — переживают новую игру. */
  records?: import('./records').Records;
  /** Автозаказ: сколько чего держать на складе и включён ли он (reorder.ts). */
  autoOrder?: { on: boolean; lines: { sid: string; pid: ProductId; qty: number }[] };
  /** Бабушкино обучение: false — показать (новая игра или «пройти заново»), нет поля — старое сохранение. */
  tourDone?: boolean;
  /** Модели оборудования (номер модели; нет — начальная). */
  gear?: Partial<Record<GearId, number>>;
  /** Утренние закупки последних дней — для «как в прошлый раз» (reorder.ts). */
  purchases?: { day: number; lines: { sid: string; pid: ProductId; qty: number }[] }[];
  /** 0..5 звёзд, влияет на поток покупателей. */
  rating: number;
  /** Склад рядом с магазином: сюда приезжает закупка. */
  warehouse: Stock;
  shelves: Shelf[];
  prices: Record<ProductId, number>;
}

export interface Lifetime {
  served: number;
  caught: number;
  trashCleaned: number;
  bestCombo: number;
  /** Дней без единой жалобы (и хотя бы с 10 покупателями). */
  cleanDays: number;
  /** Счётчики новых механик (для достижений; в старых сохранениях их нет). */
  coffees?: number;
  burnt?: number;
  nights?: number;
  deliveries?: number;
  mice?: number;
  fairs?: number;
  wars?: number;
}

export const newLifetime = (): Lifetime => ({ served: 0, caught: 0, trashCleaned: 0, bestCombo: 0, cleanDays: 0 });

export interface DayStats {
  revenue: number;
  served: number;
  /** Ушли без покупки: не дождались кассы или не нашли товар. */
  lost: number;
  /** Купили, но остались недовольны: грязь, туалет, брак. */
  complaints: number;
  spoiled: number;
  /** На сколько украли воры. */
  stolen: number;
  /** Сколько воров поймали. */
  caught: number;
  /** Сколько унесли из кассы сотрудники «нечист на руку». */
  skimmed: number;
  /** Продано штук каждого товара — для заданий дня. */
  sold: Partial<Record<ProductId, number>>;
  /** Сколько мусора убрали. */
  trashCleaned: number;
  /** Самая длинная серия: покупатели, обслуженные подряд без долгих пауз. */
  bestCombo: number;
  /** Что заметили покупатели — для отзывов (reviews.ts). */
  notes?: Partial<Record<ReviewTopic, number>>;
  /** Выручка ночной смены (входит в revenue). */
  nightRevenue?: number;
  /** Счётчики новых механик за день. */
  fair?: boolean;
  coffees?: number;
  burnt?: number;
  deliveries?: number;
  mice?: number;
  /** Почему ушли без покупки (losses.ts) и каких товаров не хватило или показались дорогими. */
  lostWhy?: Partial<Record<LostReason, number>>;
  missing?: Partial<Record<ProductId, number>>;
  pricey?: Partial<Record<ProductId, number>>;
}

export type LostReason = 'queue' | 'empty' | 'expensive' | 'eduard';

/** Учёт проданного (для заданий дня). */
export function recordSale(stats: DayStats, items: CartItem[]): void {
  for (const { id } of items) stats.sold[id] = (stats.sold[id] ?? 0) + 1;
}

export interface CartItem {
  id: ProductId;
  unit: Unit;
  /** Вторая штука по акции «2 по цене 1» — бесплатно. */
  free?: boolean;
}

const fresh = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));

export const newGame = (): StoreState => ({
  day: 1,
  money: 150,
  level: 0,
  debt: START_DEBT,
  staff: [],
  ownerServed: 0,
  totalRevenue: 0,
  album: [],
  story: { chapter: 0, introSeen: false, ordersDone: 0, inspectionsPassed: 0 },
  tourDone: false,
  decor: newDecor(),
  history: [],
  achievements: [],
  lifetime: newLifetime(),
  gift: { lastDate: '', streak: 0 },
  rack: { level: 0, stock: 6 },
  registers: 1,
  rating: 3,
  warehouse: { bread: fresh(4), apples: fresh(4) },
  shelves: [
    { kind: 'bakery', level: 0, items: { bread: fresh(4) } },
    { kind: 'produce', level: 0, items: { apples: fresh(3), potatoes: fresh(3) } },
    // Вёдра для цветов у кассы — с самого начала, весной в них ставят букеты.
    { kind: 'florist', level: 0, items: {} },
  ],
  prices: { bread: 40, apples: 30, potatoes: 20, milk: 60, meat: 150, icecream: 55, tangerines: 40, flowers: 70, water: 25, juice: 50, dumplings: 80, fish: 110, soap: 35, detergent: 99, pies: 45, buns: 40, honeycake: 110 },
});

export const storeLevel = (state: StoreState): StoreLevel => STORE_LEVELS[state.level];
export const nextStoreLevel = (state: StoreState): StoreLevel | undefined => STORE_LEVELS[state.level + 1];
/** Сколько мест на складе: по помещению и оборудованию склада (gear.ts). */
export const warehouseCapacity = (state: StoreState): number => Math.round(storeLevel(state).warehouse * warehouseRoom(state));
export const freeSlots = (state: StoreState): number => storeLevel(state).slots - state.shelves.filter((s) => !isFixture(s)).length;

export const emptyDayStats = (): DayStats => ({
  revenue: 0,
  served: 0,
  lost: 0,
  complaints: 0,
  spoiled: 0,
  stolen: 0,
  caught: 0,
  skimmed: 0,
  sold: {},
  trashCleaned: 0,
  bestCombo: 0,
  notes: {},
});

// ---------- Подсчёты ----------

const countStock = (stock: Stock): number => Object.values(stock).reduce((sum, units) => sum + (units?.length ?? 0), 0);

export const warehouseCount = (state: StoreState): number => countStock(state.warehouse);
export const warehouseOf = (state: StoreState, id: ProductId): number => state.warehouse[id]?.length ?? 0;
export const shelfCapacity = (shelf: Shelf): number => SHELF_LEVELS[shelf.level].capacity;
export const shelfCount = (shelf: Shelf): number => countStock(shelf.items);
export const shelfFree = (shelf: Shelf): number => shelfCapacity(shelf) - shelfCount(shelf);
export const canPlace = (id: ProductId, shelf: Shelf): boolean => PRODUCTS[id].category === shelf.kind;

/** Сколько штук товара стоит на всех полках. */
export const onShelves = (state: StoreState, id: ProductId): number =>
  state.shelves.reduce((sum, shelf) => sum + (shelf.items[id]?.length ?? 0), 0);

/** Индекс полки, куда идти за этим товаром (первая, где он есть, иначе первая подходящая). */
export function shelfFor(state: StoreState, id: ProductId): number {
  const withStock = state.shelves.findIndex((s) => !s.broken && (s.items[id]?.length ?? 0) > 0);
  return withStock >= 0 ? withStock : state.shelves.findIndex((s) => canPlace(id, s));
}

/** Товары, для которых в магазине есть подходящая полка: только их и ищут покупатели. */
export const sellableProducts = (state: StoreState): ProductId[] =>
  PRODUCT_IDS.filter((id) => productAvailable(id, state.day) && ownProductOpen(state, id) && state.shelves.some((s) => canPlace(id, s)));

// ---------- Цены и спрос ----------

/**
 * Вероятность, что покупатель возьмёт товар при такой цене.
 * Дешевле базовой — берут охотнее (в два раза дешевле → 100%).
 * Дороже — спрос падает круто: +20% → 55%, +50% → 25%, +75% и выше → почти никто.
 * Так выгоднее всего держать цену чуть выше базовой, а задирать её — себе дороже.
 */
export function buyChance(price: number, basePrice: number): number {
  const ratio = price / basePrice;
  const chance = ratio <= 1 ? 0.75 + 0.5 * (1 - ratio) : 0.75 - (ratio - 1);
  return Math.min(1, Math.max(0.02, chance));
}

/** Цена считается «дешёвой» (хвалят в отзывах), если она ниже ожидаемой хотя бы на столько. */
export const CHEAP_RATIO = 0.85;

/**
 * Слава о ценах: магазин, где в среднем дешевле обычного, зовёт больше гостей, дорогой — меньше.
 * Средняя цена на 10% ниже обычной — гостей на 6% больше; в пределах ±15%.
 */
export function priceAppeal(state: StoreState): number {
  const ids = sellableProducts(state);
  if (!ids.length) return 1;
  const avg = ids.reduce((sum, id) => sum + state.prices[id] / PRODUCTS[id].basePrice, 0) / ids.length;
  return Math.min(1.15, Math.max(0.85, 1 + (1 - avg) * 0.6));
}

/** Акция «−20%» на товар сегодня (promo.ts). */
export const PROMO_DISCOUNT = 0.8;
export const promoKind = (state: StoreState, id: ProductId): 'discount' | 'bogo' | undefined =>
  state.promo?.day === state.day && state.promo.product === id ? state.promo.kind : undefined;

export const unitSalePrice = (state: StoreState, id: ProductId, unit: Unit): number => {
  const price = promoKind(state, id) === 'discount' ? Math.max(1, Math.round(state.prices[id] * PROMO_DISCOUNT)) : state.prices[id];
  return unit.markdown ? Math.max(1, Math.round(price * MARKDOWN)) : price;
};

export function setPrice(state: StoreState, id: ProductId, price: number): StoreState {
  const clamped = Math.max(PRICE_STEP, Math.min(PRODUCTS[id].basePrice * 3, price));
  return { ...state, prices: { ...state.prices, [id]: clamped } };
}

// ---------- Закупка и склад ----------

/**
 * Покупка у поставщика: товар приезжает на склад (на полки его раскладывает shelveAll). bad — партия оказалась бракованной,
 * штуки ждут решения игрока (см. resolveBadBatch).
 * Возвращает null, если не хватает денег или места на складе.
 */
export function buyStock(state: StoreState, id: ProductId, qty: number, unitPrice: number, bad = false): StoreState | null {
  const total = qty * unitPrice;
  if (qty <= 0 || total > state.money || warehouseCount(state) + qty > warehouseCapacity(state)) return null;
  const units: Unit[] = Array.from({ length: qty }, () => (bad ? { age: 0, bad: true, pending: true } : { age: 0 }));
  return {
    ...state,
    money: state.money - total,
    warehouse: { ...state.warehouse, [id]: [...(state.warehouse[id] ?? []), ...units] },
  };
}

export type BadBatchChoice = 'shelf' | 'markdown' | 'return';

/** Решение по бракованной партии на складе: оставить как есть, уценить или вернуть поставщику. */
export function resolveBadBatch(state: StoreState, id: ProductId, choice: BadBatchChoice, unitPrice: number): StoreState {
  const units = state.warehouse[id] ?? [];
  if (choice === 'return') {
    const returned = units.filter((u) => u.pending).length;
    return {
      ...state,
      money: state.money + Math.round(returned * unitPrice * RETURN_REFUND),
      warehouse: { ...state.warehouse, [id]: units.filter((u) => !u.pending) },
    };
  }
  const resolved = units.map((u) =>
    u.pending ? { age: u.age, bad: true, ...(choice === 'markdown' ? { markdown: true } : {}) } : u,
  );
  return { ...state, warehouse: { ...state.warehouse, [id]: resolved } };
}

/**
 * Переносит товар со склада на полку: самые старые штуки, только подходящего типа,
 * не больше свободного места и не больше limit. Если товар не указан — раскладывает
 * все подходящие товары по очереди, чтобы на полке было всего понемногу.
 */
export function moveToShelf(
  state: StoreState,
  shelfIndex: number,
  id?: ProductId,
  limit = Infinity,
): { state: StoreState; moved: number } {
  const shelf = state.shelves[shelfIndex];
  if (!shelf || shelf.broken) return { state, moved: 0 };
  const candidates = (id ? [id] : PRODUCT_IDS).filter((p) => canPlace(p, shelf));
  const warehouse: Stock = { ...state.warehouse };
  const items: Stock = { ...shelf.items };
  let room = Math.min(shelfFree(shelf), limit);
  let moved = 0;

  let progress = true;
  while (room > 0 && progress) {
    progress = false;
    for (const p of candidates) {
      const [unit, ...rest] = warehouse[p] ?? [];
      if (!unit || room === 0 || unit.pending) continue;
      warehouse[p] = rest;
      items[p] = [...(items[p] ?? []), unit];
      room--;
      moved++;
      progress = true;
    }
  }
  if (moved === 0) return { state, moved };
  const shelves = state.shelves.map((s, i) => (i === shelfIndex ? { ...s, items } : s));
  return { state: { ...state, warehouse, shelves }, moved };
}

/**
 * Разложить со склада всё, что влезает на полки (самое старое — первым). Так работает
 * закупка (купленное сразу встаёт на полки, лишнее — на склад) и утро (за ночь склад
 * доливает полки). Просроченное сюда не попадает: оно списывается ночью.
 */
export function shelveAll(state: StoreState): StoreState {
  let next = state;
  next.shelves.forEach((_, i) => (next = moveToShelf(next, i).state));
  return next;
}

// ---------- Полки ----------

/** Ларь и вёдра улучшаются только раз: товар в них сезонный, больше мест не окупится. */
export const FIXTURE_MAX_LEVEL = 1;

export function upgradeCost(shelf: Shelf): number | null {
  if (SHELF_KINDS[shelf.kind].fixture && shelf.level >= FIXTURE_MAX_LEVEL) return null;
  return SHELF_LEVELS[shelf.level + 1]?.cost ?? null;
}

export function upgradeShelf(state: StoreState, shelfIndex: number): StoreState | null {
  const shelf = state.shelves[shelfIndex];
  const cost = shelf && upgradeCost(shelf);
  if (!shelf || cost === null || cost > state.money) return null;
  const shelves = state.shelves.map((s, i) => (i === shelfIndex ? { ...s, level: s.level + 1 } : s));
  return { ...state, money: state.money - cost, shelves };
}

export function buyShelf(state: StoreState, kind: Category): StoreState | null {
  const price = SHELF_KINDS[kind].price;
  // Ларь и цветы — по одному, на своём месте; обычной полке нужно свободное место в зале.
  const room = SHELF_KINDS[kind].fixture ? fixtureIndex(state, kind) < 0 : freeSlots(state) > 0;
  if (!room || price > state.money || !shelfKindOpen(state, kind)) return null;
  return { ...state, money: state.money - price, shelves: [...state.shelves, { kind, level: 0, items: {} }] };
}

/**
 * Сохранения до ларя с мороженым: мороженое стояло в молочном холодильнике, цветы — на овощном
 * прилавке. Переносим их в ларь и вёдра у кассы (что не влезло — на склад), вёдра ставим всем,
 * а тем, у кого был молочный холодильник (legacy), — ещё и ларь, чтобы летом мороженое не пропало.
 */
export function normalizeShelves(state: StoreState, legacy = false): StoreState {
  const shelves: Shelf[] = state.shelves.map((s) => ({ ...s, items: { ...s.items } }));
  if (!shelves.some((s) => s.kind === 'florist')) shelves.push({ kind: 'florist', level: 0, items: {} });
  if (legacy && !shelves.some((s) => s.kind === 'icebox') && shelves.some((s) => s.kind === 'dairy')) shelves.push({ kind: 'icebox', level: 0, items: {} });
  const warehouse: Stock = { ...state.warehouse };
  let moved = false;
  for (const shelf of shelves) {
    for (const id of PRODUCT_IDS) {
      const units = shelf.items[id];
      if (!units?.length || canPlace(id, shelf)) continue;
      moved = true;
      delete shelf.items[id];
      let left = units;
      const home = shelves.find((s) => canPlace(id, s));
      if (home) {
        const fit = left.slice(0, Math.max(0, shelfFree(home)));
        home.items[id] = [...(home.items[id] ?? []), ...fit];
        left = left.slice(fit.length);
      }
      if (left.length) warehouse[id] = [...(warehouse[id] ?? []), ...left];
    }
  }
  if (!moved && shelves.length === state.shelves.length) return state;
  return { ...state, shelves, warehouse };
}

/** Сколько вернут за полку: половина цены самой полки и её улучшений. */
export function shelfResale(shelf: Shelf): number {
  const upgrades = SHELF_LEVELS.slice(1, shelf.level + 1).reduce((sum, l) => sum + l.cost, 0);
  return Math.round((SHELF_KINDS[shelf.kind].price + upgrades) * SHELF_RESALE);
}

/** Продать полку, чтобы освободить место под другую. Товар с неё уходит на склад (что не влезло — пропадает). */
export function sellShelf(state: StoreState, shelfIndex: number): StoreState | null {
  const shelf = state.shelves[shelfIndex];
  // Вёдра для цветов у кассы бесплатные — их не продают.
  if (!shelf || (isFixture(shelf) && !SHELF_KINDS[shelf.kind].price)) return null;
  const warehouse: Stock = { ...state.warehouse };
  let room = warehouseCapacity(state) - warehouseCount(state);
  for (const id of PRODUCT_IDS) {
    const units = shelf.items[id] ?? [];
    const kept = units.slice(0, Math.max(0, room));
    room -= kept.length;
    if (kept.length) warehouse[id] = [...(warehouse[id] ?? []), ...kept];
  }
  return {
    ...state,
    money: state.money + shelfResale(shelf),
    warehouse,
    shelves: state.shelves.filter((_, i) => i !== shelfIndex),
  };
}

// ---------- Помещение и долг ----------

/** Расширение магазина. Нельзя, пока висит долг. */
export function expandStore(state: StoreState): StoreState | null {
  const next = nextStoreLevel(state);
  if (!next || state.debt > 0 || next.cost > state.money) return null;
  return { ...state, money: state.money - next.cost, level: state.level + 1 };
}

export function payDebt(state: StoreState, amount: number): StoreState | null {
  const paid = Math.min(amount, state.debt, state.money);
  if (paid <= 0) return null;
  return { ...state, money: state.money - paid, debt: state.debt - paid };
}

/** Счета за месяц. */
export interface Bill {
  rent: number;
  utilities: number;
  /** Свет помещения + холодильники. */
  power: number;
  salaries: number;
  /** Платёж по кредиту. */
  debt: number;
  /** Платёж банку (bank.ts). */
  loan?: number;
}

/** Холодильник включён: ларь с мороженым работает только летом, остальные — всегда. */
export function fridgeOn(state: StoreState, shelf: Shelf): boolean {
  const kind = SHELF_KINDS[shelf.kind];
  return kind.fridge && (!kind.seasonal || productAvailable(kind.seasonal, state.day));
}

export function monthlyBill(state: StoreState): Bill {
  const level = storeLevel(state);
  const fridges = state.shelves.filter((s) => fridgeOn(state, s)).length;
  return {
    rent: level.rent,
    utilities: level.utilities,
    // Свет в зале дешевле с LED, холодильники — с новыми моделями, всё вместе — с солнечными панелями (gear.ts).
    power: Math.round((level.power * lightsPower(state) + fridges * FRIDGE_POWER * fridgePower(state)) * solarPower(state)),
    salaries: state.staff.reduce((sum, m) => sum + m.wage, 0),
    debt: Math.min(DEBT_PAYMENT, state.debt),
    loan: loanDue(state),
  };
}

export const billTotal = (b: Bill): number => b.rent + b.utilities + b.power + b.salaries + b.debt + (b.loan ?? 0);

export const monthOf = (day: number): number => Math.ceil(day / MONTH_DAYS);
/** Сколько дней до счетов: 0 — счета придут сегодня вечером. */
export const daysUntilBill = (day: number): number => (MONTH_DAYS - (day % MONTH_DAYS)) % MONTH_DAYS;

/** Оплата счетов. Если денег не хватает, недостача с пени уходит в долг. */
export function payBill(state: StoreState): { state: StoreState; bill: Bill; shortfall: number } {
  const bill = monthlyBill(state);
  const total = billTotal(bill);
  const paid = Math.min(total, Math.max(0, state.money));
  const shortfall = total - paid;
  const penalty = Math.round(shortfall * LATE_PENALTY);
  return {
    // Платёж банку засчитан в любом случае: не хватило — недостача ушла в долг вместе со счетами.
    state: afterLoanPayment({ ...state, money: state.money - paid, debt: state.debt - bill.debt + shortfall + penalty }, bill.loan ?? 0),
    bill,
    shortfall,
  };
}

// ---------- Продажа ----------

/** Покупатель берёт с полки самую старую штуку. Возвращает null, если товара нет. */
export function takeFromShelf(
  state: StoreState,
  shelfIndex: number,
  id: ProductId,
): { state: StoreState; unit: Unit } | null {
  const shelf = state.shelves[shelfIndex];
  if (shelf?.broken) return null;
  const [unit, ...rest] = shelf?.items[id] ?? [];
  if (!unit) return null;
  const shelves = state.shelves.map((s, i) => (i === shelfIndex ? { ...s, items: { ...s.items, [id]: rest } } : s));
  return { state: { ...state, shelves }, unit };
}

/** Покупатель ушёл из очереди: товар возвращается на свою полку, а если там нет места — на склад. */
export function returnToShelf(state: StoreState, items: CartItem[]): StoreState {
  let next = state;
  for (const { id, unit } of items) {
    const index = next.shelves.findIndex((s) => canPlace(id, s) && shelfFree(s) > 0);
    if (index >= 0) {
      next = {
        ...next,
        shelves: next.shelves.map((s, i) =>
          i === index ? { ...s, items: { ...s.items, [id]: [unit, ...(s.items[id] ?? [])] } } : s,
        ),
      };
    } else {
      next = { ...next, warehouse: { ...next.warehouse, [id]: [unit, ...(next.warehouse[id] ?? [])] } };
    }
  }
  return next;
}

/** markup — ночная наценка (цена на ценнике × markup, округляя вверх). */
export function checkout(state: StoreState, items: CartItem[], markup = 1): { state: StoreState; total: number } {
  const total = items.reduce((sum, { id, unit, free }) => sum + (free ? 0 : Math.ceil(unitSalePrice(state, id, unit) * markup)), 0);
  return { state: { ...state, money: state.money + total }, total };
}

/** В корзине есть брак без уценки — покупатель может пожаловаться. */
export const hasUnmarkedBad = (items: CartItem[]): boolean => items.some(({ unit }) => unit.bad && !unit.markdown);

// ---------- Конец дня ----------

/**
 * Сколько довольных нужно, чтобы рейтинг не падал. У звёздного магазина планка выше (0,7),
 * у отстающего — ниже (0,55): иначе, раз упав, рейтинг уже не поднять (видно в симуляторе).
 */
export const ratingTarget = (rating: number): number => 0.55 + 0.03 * rating;

/** 0..1: доля довольных посетителей. Жалоба считается за «полпокупателя». */
export function satisfaction(stats: DayStats): number {
  const visitors = stats.served + stats.lost;
  if (visitors === 0) return 0.5;
  return Math.max(0, (stats.served - stats.complaints * 0.5) / visitors);
}

/**
 * Сколько дней проживёт штука: брак портится на день раньше, а молочка и мясо в хороших
 * холодильниках — дольше (fresh — сколько дней добавляют холодильники, gear.ts).
 */
export const unitLife = (id: ProductId, unit: Unit, fresh = 0): number =>
  Math.max(1, PRODUCTS[id].shelfLife + (SHELF_KINDS[PRODUCTS[id].category].fridge ? fresh : 0) - (unit.bad ? 1 : 0));

/** Сколько штук в этом запасе испортится этой ночью (и ещё не уценено). */
export const expiringIn = (state: StoreState, stock: Stock): number =>
  PRODUCT_IDS.reduce((sum, id) => sum + (stock[id] ?? []).filter((u) => !u.markdown && !u.pending && u.age + 1 >= unitLife(id, u, fridgeLife(state))).length, 0);

/** Сколько штук испортится этой ночью (и ещё не уценено). */
export function expiringCount(state: StoreState): number {
  return expiringIn(state, state.warehouse) + state.shelves.reduce((sum, s) => sum + expiringIn(state, s.items), 0);
}

/** «Уценить старое»: то, что испортится ночью, продаётся за полцены, а не выбрасывается. */
export function markdownExpiring(state: StoreState): { state: StoreState; count: number } {
  let count = 0;
  const mark = (stock: Stock): Stock => {
    const next: Stock = {};
    for (const id of PRODUCT_IDS) {
      const units = stock[id];
      if (!units) continue;
      next[id] = units.map((u) => {
        if (u.markdown || u.pending || u.age + 1 < unitLife(id, u, fridgeLife(state))) return u;
        count++;
        return { ...u, markdown: true };
      });
    }
    return next;
  };
  const next = { ...state, warehouse: mark(state.warehouse), shelves: state.shelves.map((s) => ({ ...s, items: mark(s.items) })) };
  return { state: count ? next : state, count };
}

/**
 * Электронные ценники вечером: уценить из того, что испортится ночью, только лишнее — сверх того,
 * что ещё успеют купить по полной цене (expected: сколько штук товара продадут до закрытия).
 * Покупатели берут сначала старое, поэтому первые expected штук продадутся и так.
 */
export function markdownSurplus(state: StoreState, expected: (id: ProductId) => number): { state: StoreState; count: number } {
  let count = 0;
  const fresh = fridgeLife(state);
  const expiring = (u: Unit, id: ProductId) => !u.markdown && !u.pending && u.age + 1 >= unitLife(id, u, fresh);
  // Сколько уценить по каждому товару.
  const quota: Partial<Record<ProductId, number>> = {};
  for (const id of PRODUCT_IDS) {
    const all = [...(state.warehouse[id] ?? []), ...state.shelves.flatMap((s) => s.items[id] ?? [])];
    const n = all.filter((u) => expiring(u, id)).length - Math.ceil(expected(id));
    if (n > 0) quota[id] = n;
  }
  const mark = (stock: Stock): Stock => {
    const next: Stock = {};
    for (const id of PRODUCT_IDS) {
      const units = stock[id];
      if (!units) continue;
      next[id] = units.map((u) => {
        if (!quota[id] || !expiring(u, id)) return u;
        quota[id]!--;
        count++;
        return { ...u, markdown: true };
      });
    }
    return next;
  };
  // Сначала полки (там уценку видно сразу), потом склад.
  const shelves = state.shelves.map((s) => ({ ...s, items: mark(s.items) }));
  const next = { ...state, shelves, warehouse: mark(state.warehouse) };
  return { state: count ? next : state, count };
}

function ageStock(stock: Stock, fresh: number, by: Partial<Record<ProductId, number>> = {}): { stock: Stock; spoiled: number } {
  let spoiled = 0;
  const next: Stock = {};
  for (const id of PRODUCT_IDS) {
    const units = stock[id];
    if (!units) continue;
    const aged = units.map((u) => ({ ...u, age: u.age + 1 }));
    const kept = aged.filter((u) => u.age < unitLife(id, u, fresh));
    spoiled += aged.length - kept.length;
    if (aged.length > kept.length) by[id] = (by[id] ?? 0) + aged.length - kept.length;
    next[id] = kept;
  }
  return { stock: next, spoiled };
}

export interface NightResult {
  state: StoreState;
  spoiled: number;
  /** Что именно испортилось (для отчёта). */
  spoiledBy: Partial<Record<ProductId, number>>;
  /** Счета, если сегодня конец месяца. */
  bill: Bill | null;
  /** Сколько не хватило на счета (ушло в долг с пени). */
  shortfall: number;
  /** Сколько унесли из кассы сотрудники «нечист на руку». */
  skimmed: number;
}

/** Просрочка в приют: за каждые 10 штук +0.03 к рейтингу, но не больше 0.06 за ночь. */
export const donationRating = (units: number): number => Math.min(0.06, Math.floor(units / 10) * 0.03);
export const toggleDonate = (state: StoreState): StoreState => ({ ...state, donate: !state.donate });

/**
 * Ночь: товар стареет и портится (и на складе, и на полках), рейтинг двигается
 * от довольства покупателей, в конце месяца приходят счета.
 */
export function endDay(state: StoreState, stats: DayStats, random: () => number = Math.random): NightResult {
  const spoiledBy: Partial<Record<ProductId, number>> = {};
  const warehouse = ageStock(state.warehouse, fridgeLife(state), spoiledBy);
  let spoiled = warehouse.spoiled;
  const shelves = state.shelves.map((shelf) => {
    const aged = ageStock(shelf.items, fridgeLife(state), spoiledBy);
    spoiled += aged.spoiled;
    return { ...shelf, items: aged.stock };
  });
  const donated = state.donate ? spoiled : 0;
  const rating = Math.min(5, Math.max(0, state.rating + (satisfaction(stats) - ratingTarget(state.rating)) * 0.5 + donationRating(donated)));
  const skimmed = Math.min(Math.max(0, state.money), skimmedToday(state, stats.revenue));
  const aged = {
    ...state,
    day: state.day + 1,
    money: state.money - skimmed,
    totalRevenue: state.totalRevenue + stats.revenue,
    history: [...(state.history ?? []), stats.revenue].slice(-HISTORY_DAYS),
    rating: Math.round(rating * 100) / 100,
    warehouse: warehouse.stock,
    shelves,
  };
  if (daysUntilBill(state.day) !== 0) return { state: aged, spoiled, spoiledBy, bill: null, shortfall: 0, skimmed };
  const paid = payBill(aged);
  // Зарплату выплатили — сотрудники набираются опыта, просят прибавку или увольняются.
  const month = monthForStaff(paid.state.staff, random);
  const promoted = { ...paid.state, staff: month.staff, quitNotice: month.quit.length ? month.quit : undefined };
  return { state: promoted, spoiled, spoiledBy, bill: paid.bill, shortfall: paid.shortfall, skimmed };
}

/** Гостей за день в ларьке при 3★ — с этого рейтинга начинается игра. */
export const BASE_GUESTS = 20;
/** Каждая звезда рейтинга — в e^0.46 ≈ 1.6 раза больше гостей. */
export const RATING_GUESTS = 0.46;

/**
 * Секунд между появлениями покупателей. Рейтинг решает очень многое: в ларьке при 2★ — ~12
 * гостей за день, при 3★ — 20, при 4★ — ~35, при 5★ — ~60; большой магазин привлекает больше.
 */
export const spawnInterval = (rating: number, level = 0): number =>
  DAY_SECONDS / (BASE_GUESTS * Math.exp(RATING_GUESTS * (rating - 3)) * STORE_LEVELS[level].guests);

/** Примерно столько гостей придёт за день. */
export const expectedGuests = (rating: number, level = 0): number => Math.round(DAY_SECONDS / spawnInterval(rating, level));
