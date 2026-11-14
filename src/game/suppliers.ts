import type { TextKey } from '../i18n/ru';
import { PRODUCTS, type Category, type ProductId, type StoreState } from './economy';
import { haggleBonus } from './owner';
import { breadCut } from './dreams';
import { apprSupplies } from './apprentice';

export type SupplierId = 'farmer' | 'dairy' | 'butcher' | 'wholesale';

export interface Supplier {
  id: SupplierId;
  nameKey: TextKey;
  /** Приветствие в списке поставщиков. */
  hello: TextKey;
  /** Что продаёт и с какой наценкой к базовой цене закупки. */
  products: Partial<Record<ProductId, number>>;
  /** Шанс, что партия окажется бракованной (редкое событие). */
  badChance: number;
  /** Без полки этого типа закупать нечего (мясо без холодильника не продать). Список — хватит любой. */
  requires?: Category | Category[];
  color: number;
}

export const SUPPLIERS: Record<SupplierId, Supplier> = {
  farmer: {
    id: 'farmer',
    nameKey: 'supplier.farmer',
    hello: 'supplier.farmer.hello',
    products: { bread: 1, apples: 0.9, potatoes: 1, tangerines: 1, flowers: 1.1, pumpkins: 1, watermelons: 1 },
    badChance: 0.03,
    color: 0x6abe30,
  },
  dairy: {
    id: 'dairy',
    nameKey: 'supplier.dairy',
    hello: 'supplier.dairy.hello',
    products: { milk: 1, icecream: 1 },
    badChance: 0.025,
    color: 0x5b6ee1,
  },
  butcher: {
    id: 'butcher',
    nameKey: 'supplier.butcher',
    hello: 'supplier.butcher.hello',
    products: { meat: 1 },
    badChance: 0.05,
    requires: 'meat',
    color: 0xb83a4b,
  },
  // Оптовик: напитки, заморозка и бытовая химия для новых отделов; с лицензией (license.ts) — пиво и сигареты.
  // Без «Витрины 18+» их у него не видно: закупка показывает только то, чему есть полка (restock.ts canStock).
  wholesale: {
    id: 'wholesale',
    nameKey: 'supplier.wholesale',
    hello: 'supplier.wholesale.hello',
    products: { water: 1, juice: 1, dumplings: 1, fish: 1, soap: 1, detergent: 1, beer: 1, cigarettes: 1 },
    badChance: 0.03,
    requires: ['drinks', 'frozen', 'household', 'license'],
    color: 0x3a4466,
  },
};

/** Есть ли полка, без которой у поставщика нечего брать. */
export const supplierOpen = (s: Supplier, shelves: { kind: Category }[]): boolean =>
  !s.requires || (Array.isArray(s.requires) ? s.requires : [s.requires]).some((k) => shelves.some((sh) => sh.kind === k));

export const SUPPLIER_IDS = Object.keys(SUPPLIERS) as SupplierId[];

/**
 * Скидка постоянного покупателя (02.11, вместо утреннего торга: 4 поставщика × до 3 нажатий каждое утро).
 * Поставщики уступают сами — тем больше, чем лучше рейтинг магазина и чем опытнее хозяин (owner.ts).
 * Откалибровано симулятором так, чтобы обычный игрок получал примерно то, что раньше давал торг «иногда»
 * (одна просьба о −5% у каждого поставщика), а не максимальный торг. Одна функция — на неё смотрят
 * закупка, автозаказ, симулятор и опыт хозяина (owner.ts) — менять только здесь.
 */
export const DISCOUNT_BASE = 0.02;
/** За каждую звезду рейтинга выше трёх (ниже — меньше, но не меньше нуля). */
export const DISCOUNT_PER_STAR = 0.01;
/** Плюс опыт хозяина (owner.ts haggleBonus, растёт сам с 02.11): на последнем уровне +6%, как прежний «Торгаш». */
export const DISCOUNT_MAX = 0.12;

export function supplierDiscount(state: StoreState): number {
  const d = DISCOUNT_BASE + (state.rating - 3) * DISCOUNT_PER_STAR + haggleBonus(state);
  // Лавка бывшего ученика со склада берёт товар вскладчину с нами (apprentice.ts) — сверх обычного предела.
  return Math.min(DISCOUNT_MAX, Math.max(0, d)) + apprSupplies(state);
}

/** Первые дни поставщики брака не привозят: новичку и так хватает решений (окно «Брак» — с 4-го утра). */
export const CLEAN_BATCH_DAYS = 3;
/** Партия бракованная? roll — случайное число 0…1 (его тянут всегда — ряд случайных чисел не сдвигается). */
export const badBatch = (sid: SupplierId, day: number, roll: number): boolean => roll < SUPPLIERS[sid].badChance && day > CLEAN_BATCH_DAYS;

/** Цена штуки у поставщика со скидкой discount (0 — по прайсу). null — у него такого нет. */
export function unitPrice(s: Supplier, id: ProductId, discount = 0): number | null {
  const markup = s.products[id];
  if (markup === undefined) return null;
  return Math.max(1, Math.round(PRODUCTS[id].cost * markup * (1 - discount)));
}

/** Цены сегодня для этого магазина — со скидкой постоянного покупателя (закупка, автозаказ, подвоз). */
export const priceFor = (state: StoreState) => {
  const discount = supplierDiscount(state);
  // Хлеб от Аниной пекарни (dreams.ts) — ещё дешевле: и руками, и автозаказом, и в симуляторе.
  const bread = breadCut(state);
  return (sid: SupplierId, pid: ProductId): number | null => {
    const price = unitPrice(SUPPLIERS[sid], pid, discount);
    return price !== null && bread && pid === 'bread' ? Math.max(1, Math.round(price * (1 - bread))) : price;
  };
};

/** Самая низкая цена товара по прайсу (без скидки) у всех поставщиков. null — никто не продаёт. */
export function listPrice(pid: ProductId): number | null {
  const prices = SUPPLIER_IDS.map((sid) => unitPrice(SUPPLIERS[sid], pid)).filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices) : null;
}
