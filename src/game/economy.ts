// Чистая игровая логика без Phaser: её легко тестировать и потом переиспользовать
// на сервере (проверка сохранений, расчёт дохода офлайн).

import type { TextKey } from '../i18n/ru';
import type { DayPlan } from './events';
import type { StoryState } from './story';
import { newDecor, type DecorState } from './decor';
import type { ReviewTopic, Review } from './reviews';
import type { War } from './war';
import type { ShopCat } from './cat';
import type { GearId } from './gear';

/** Тип полки определяет, какой товар на неё можно ставить: мясо не кладут к хлебу. */
export type Category = 'bakery' | 'produce' | 'dairy' | 'meat';

export type ProductId = 'bread' | 'apples' | 'potatoes' | 'milk' | 'meat' | 'icecream' | 'tangerines' | 'flowers';

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

export const PRODUCTS: Record<ProductId, Product> = {
  bread: { id: 'bread', nameKey: 'product.bread', icon: '🍞', category: 'bakery', cost: 25, basePrice: 40, shelfLife: 2, color: 0xd9a066 },
  apples: { id: 'apples', nameKey: 'product.apples', icon: '🍎', category: 'produce', cost: 16, basePrice: 30, shelfLife: 5, color: 0xd04648 },
  potatoes: { id: 'potatoes', nameKey: 'product.potatoes', icon: '🥔', category: 'produce', cost: 10, basePrice: 20, shelfLife: 7, color: 0xa47a52 },
  milk: { id: 'milk', nameKey: 'product.milk', icon: '🥛', category: 'dairy', cost: 36, basePrice: 60, shelfLife: 3, color: 0xeef3f7 },
  meat: { id: 'meat', nameKey: 'product.meat', icon: '🥩', category: 'meat', cost: 90, basePrice: 150, shelfLife: 2, color: 0xb83a4b },
  // Сезонные товары: продаются только в свои месяцы (см. SEASONAL).
  icecream: { id: 'icecream', nameKey: 'product.icecream', icon: '🍦', category: 'dairy', cost: 30, basePrice: 55, shelfLife: 4, color: 0xf6c6d6 },
  tangerines: { id: 'tangerines', nameKey: 'product.tangerines', icon: '🍊', category: 'produce', cost: 20, basePrice: 40, shelfLife: 6, color: 0xf77622 },
  flowers: { id: 'flowers', nameKey: 'product.flowers', icon: '💐', category: 'produce', cost: 35, basePrice: 70, shelfLife: 3, color: 0xe43b44 },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

/** Месяцев в игровом году (= YEAR_MONTHS в calendar.ts, проверяется тестом). */
const YEAR_MONTHS = 16;
/**
 * Сезонные товары: в какие месяцы игрового года (0…15) их продают.
 * Мороженое — летом, мандарины — перед Новым годом и в новогоднюю неделю, цветы — весной.
 */
export const SEASONAL: Partial<Record<ProductId, number[]>> = { icecream: [7, 8, 9, 10], tangerines: [2, 3], flowers: [4, 5, 6] };

export const monthInYear = (day: number): number => (monthOf(day) - 1) % YEAR_MONTHS;
export const productAvailable = (id: ProductId, day: number): boolean => SEASONAL[id]?.includes(monthInYear(day)) ?? true;

/** Спрос на сезонный товар: в сезон берут охотно, на 8 Марта (первые два дня весны) цветы — нарасхват. */
export function seasonalDemand(id: ProductId, day: number): number {
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
}

export const SHELF_KINDS: Record<Category, ShelfKind> = {
  bakery: { nameKey: 'shelf.bakery', price: 150, fridge: false },
  produce: { nameKey: 'shelf.produce', price: 150, fridge: false },
  dairy: { nameKey: 'shelf.dairy', price: 300, fridge: true },
  meat: { nameKey: 'shelf.meat', price: 400, fridge: true },
};

/** Проданная полка возвращает часть цены. */
export const SHELF_RESALE = 0.5;
/** Электричество одного холодильника за месяц. */
export const FRIDGE_POWER = 100;

export const CATEGORIES = Object.keys(SHELF_KINDS) as Category[];

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
  { nameKey: 'store.l1', cost: 0, slots: 2, warehouse: 20, rent: 140, utilities: 40, power: 30, guests: 1, maxCustomers: 5 },
  { nameKey: 'store.l2', cost: 1000, slots: 4, warehouse: 35, rent: 350, utilities: 70, power: 50, guests: 1.3, maxCustomers: 7 },
  { nameKey: 'store.l3', cost: 2500, slots: 6, warehouse: 55, rent: 600, utilities: 110, power: 80, guests: 1.6, maxCustomers: 9 },
  { nameKey: 'store.l4', cost: 6500, slots: 8, warehouse: 80, rent: 1000, utilities: 160, power: 120, guests: 1.9, maxCustomers: 11 },
  { nameKey: 'store.l5', cost: 14000, slots: 10, warehouse: 110, rent: 1500, utilities: 230, power: 170, guests: 2.2, maxCustomers: 13 },
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

export type StaffRole = 'cashier' | 'cashier2' | 'cashier3' | 'cashier4' | 'cleaner' | 'loader' | 'guard';

/** Сотрудники: каждый забирает у игрока одно ручное дело. Зарплата — базовая за месяц. */
export const STAFF_ROLES: Record<StaffRole, { nameKey: TextKey; descKey: TextKey; wage: number }> = {
  cashier: { nameKey: 'staff.cashier', descKey: 'staff.cashier.desc', wage: 420 },
  cashier2: { nameKey: 'staff.cashier2', descKey: 'staff.cashier2.desc', wage: 420 },
  cashier3: { nameKey: 'staff.cashier3', descKey: 'staff.cashier3.desc', wage: 420 },
  cashier4: { nameKey: 'staff.cashier4', descKey: 'staff.cashier4.desc', wage: 420 },
  cleaner: { nameKey: 'staff.cleaner', descKey: 'staff.cleaner.desc', wage: 280 },
  loader: { nameKey: 'staff.loader', descKey: 'staff.loader.desc', wage: 350 },
  guard: { nameKey: 'staff.guard', descKey: 'staff.guard.desc', wage: 490 },
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
export const STAFF_LIMIT = [1, 2, 4, 6, 7];

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
}

export function wageFor(role: StaffRole, skill: number, trait?: Trait): number {
  const pay = SKILL_PAY[skill - 1] * (trait ? TRAITS[trait].pay : 1);
  return Math.round((STAFF_ROLES[role].wage * pay) / 10) * 10;
}

/** Множитель скорости работы: 1 — обычная. */
export const workSpeed = (m: StaffMember): number =>
  SKILL_SPEED[m.skill - 1] * (m.trait ? TRAITS[m.trait].speed : 1) * (m.upset ? UPSET_SPEED : 1);

/** Обиженный сотрудник работает медленнее. */
export const UPSET_SPEED = 0.75;
/** Шанс, что обиженный уволится в конце месяца. */
export const UPSET_QUIT_CHANCE = 0.5;
/** Шанс, что опытный сотрудник сам попросит прибавку в конце месяца (кроме роста навыка). */
export const RAISE_ASK_CHANCE = 0.2;
/** На сколько просят прибавку, если навык не вырос. */
export const RAISE_STEP = 0.1;

export const staffOf = (state: StoreState, role: StaffRole): StaffMember | undefined => state.staff.find((m) => m.role === role);
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
  for (const m of staff) {
    if (m.upset && random() < UPSET_QUIT_CHANCE) {
      quit.push(m);
      continue;
    }
    const months = m.months + 1;
    const skill = months % MONTHS_PER_SKILL === 0 ? Math.min(3, m.skill + 1) : m.skill;
    let raiseAsk = m.raiseAsk;
    if (skill > m.skill) raiseAsk = Math.max(m.wage, wageFor(m.role, skill, m.trait));
    else if (!raiseAsk && months >= 3 && random() < RAISE_ASK_CHANCE) raiseAsk = Math.round((m.wage * (1 + RAISE_STEP)) / 10) * 10;
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
  /** «В первую очередь»: грузчик пополняет такие полки раньше остальных. */
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
  decor: newDecor(),
  history: [],
  achievements: [],
  lifetime: newLifetime(),
  gift: { lastDate: '', streak: 0 },
  rack: { level: 0, stock: 6 },
  rating: 3,
  warehouse: { bread: fresh(4), apples: fresh(4) },
  shelves: [
    { kind: 'bakery', level: 0, items: { bread: fresh(4) } },
    { kind: 'produce', level: 0, items: { apples: fresh(3), potatoes: fresh(3) } },
  ],
  prices: { bread: 40, apples: 30, potatoes: 20, milk: 60, meat: 150, icecream: 55, tangerines: 40, flowers: 70 },
});

export const storeLevel = (state: StoreState): StoreLevel => STORE_LEVELS[state.level];
export const nextStoreLevel = (state: StoreState): StoreLevel | undefined => STORE_LEVELS[state.level + 1];
export const warehouseCapacity = (state: StoreState): number => storeLevel(state).warehouse;
export const freeSlots = (state: StoreState): number => storeLevel(state).slots - state.shelves.length;

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
  PRODUCT_IDS.filter((id) => productAvailable(id, state.day) && state.shelves.some((s) => canPlace(id, s)));

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

/** Сколько реально заплатит покупатель за эту штуку. */
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
 * Покупка у поставщика: товар приезжает на склад. bad — партия оказалась бракованной,
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

// ---------- Полки ----------

export function upgradeCost(shelf: Shelf): number | null {
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
  if (freeSlots(state) <= 0 || price > state.money) return null;
  return { ...state, money: state.money - price, shelves: [...state.shelves, { kind, level: 0, items: {} }] };
}

/** Сколько вернут за полку: половина цены самой полки и её улучшений. */
export function shelfResale(shelf: Shelf): number {
  const upgrades = SHELF_LEVELS.slice(1, shelf.level + 1).reduce((sum, l) => sum + l.cost, 0);
  return Math.round((SHELF_KINDS[shelf.kind].price + upgrades) * SHELF_RESALE);
}

/** Продать полку, чтобы освободить место под другую. Товар с неё уходит на склад (что не влезло — пропадает). */
export function sellShelf(state: StoreState, shelfIndex: number): StoreState | null {
  const shelf = state.shelves[shelfIndex];
  if (!shelf) return null;
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
}

export function monthlyBill(state: StoreState): Bill {
  const level = storeLevel(state);
  const fridges = state.shelves.filter((s) => SHELF_KINDS[s.kind].fridge).length;
  return {
    rent: level.rent,
    utilities: level.utilities,
    power: level.power + fridges * FRIDGE_POWER,
    salaries: state.staff.reduce((sum, m) => sum + m.wage, 0),
    debt: Math.min(DEBT_PAYMENT, state.debt),
  };
}

export const billTotal = (b: Bill): number => b.rent + b.utilities + b.power + b.salaries + b.debt;

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
    state: { ...state, money: state.money - paid, debt: state.debt - bill.debt + shortfall + penalty },
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

/** Сколько дней проживёт штука: брак портится на день раньше. */
export const unitLife = (id: ProductId, unit: Unit): number => Math.max(1, PRODUCTS[id].shelfLife - (unit.bad ? 1 : 0));

/** Сколько штук испортится этой ночью (и ещё не уценено). */
export function expiringCount(state: StoreState): number {
  const count = (stock: Stock) =>
    PRODUCT_IDS.reduce((sum, id) => sum + (stock[id] ?? []).filter((u) => !u.markdown && !u.pending && u.age + 1 >= unitLife(id, u)).length, 0);
  return count(state.warehouse) + state.shelves.reduce((sum, s) => sum + count(s.items), 0);
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
        if (u.markdown || u.pending || u.age + 1 < unitLife(id, u)) return u;
        count++;
        return { ...u, markdown: true };
      });
    }
    return next;
  };
  const next = { ...state, warehouse: mark(state.warehouse), shelves: state.shelves.map((s) => ({ ...s, items: mark(s.items) })) };
  return { state: count ? next : state, count };
}

function ageStock(stock: Stock): { stock: Stock; spoiled: number } {
  let spoiled = 0;
  const next: Stock = {};
  for (const id of PRODUCT_IDS) {
    const units = stock[id];
    if (!units) continue;
    const aged = units.map((u) => ({ ...u, age: u.age + 1 }));
    const kept = aged.filter((u) => u.age < unitLife(id, u));
    spoiled += aged.length - kept.length;
    next[id] = kept;
  }
  return { stock: next, spoiled };
}

export interface NightResult {
  state: StoreState;
  spoiled: number;
  /** Счета, если сегодня конец месяца. */
  bill: Bill | null;
  /** Сколько не хватило на счета (ушло в долг с пени). */
  shortfall: number;
  /** Сколько унесли из кассы сотрудники «нечист на руку». */
  skimmed: number;
}

/**
 * Ночь: товар стареет и портится (и на складе, и на полках), рейтинг двигается
 * от довольства покупателей, в конце месяца приходят счета.
 */
export function endDay(state: StoreState, stats: DayStats, random: () => number = Math.random): NightResult {
  const warehouse = ageStock(state.warehouse);
  let spoiled = warehouse.spoiled;
  const shelves = state.shelves.map((shelf) => {
    const aged = ageStock(shelf.items);
    spoiled += aged.spoiled;
    return { ...shelf, items: aged.stock };
  });
  const rating = Math.min(5, Math.max(0, state.rating + (satisfaction(stats) - ratingTarget(state.rating)) * 0.5));
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
  if (daysUntilBill(state.day) !== 0) return { state: aged, spoiled, bill: null, shortfall: 0, skimmed };
  const paid = payBill(aged);
  // Зарплату выплатили — сотрудники набираются опыта, просят прибавку или увольняются.
  const month = monthForStaff(paid.state.staff, random);
  const promoted = { ...paid.state, staff: month.staff, quitNotice: month.quit.length ? month.quit : undefined };
  return { state: promoted, spoiled, bill: paid.bill, shortfall: paid.shortfall, skimmed };
}

/**
 * Секунд между появлениями покупателей. Рейтинг сильно влияет на поток
 * (в ларьке: 0★ — раз в 7.5 с, 3★ — раз в 4.2 с, 5★ — раз в 2 с),
 * большой магазин привлекает больше гостей.
 */
export const spawnInterval = (rating: number, level = 0): number => (7.5 - rating * 1.1) / STORE_LEVELS[level].guests;

/** Примерно столько гостей придёт за день. */
export const expectedGuests = (rating: number, level = 0): number => Math.round(DAY_SECONDS / spawnInterval(rating, level));
