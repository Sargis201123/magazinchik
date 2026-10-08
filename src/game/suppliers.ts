import type { TextKey } from '../i18n/ru';
import { PRODUCTS, type Category, type ProductId } from './economy';

export type SupplierId = 'farmer' | 'dairy' | 'butcher' | 'wholesale';

export interface Supplier {
  id: SupplierId;
  nameKey: TextKey;
  /** Реплики: приветствие, согласие, отказ, обида. */
  lines: { hello: TextKey; yes: TextKey; no: TextKey; angry: TextKey };
  /** Что продаёт и с какой наценкой к базовой цене закупки. */
  products: Partial<Record<ProductId, number>>;
  /** 0..1: насколько легко уступает в цене. */
  flexibility: number;
  /** Сколько неудачных попыток торга вытерпит за день. */
  patience: number;
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
    lines: { hello: 'supplier.farmer.hello', yes: 'supplier.farmer.yes', no: 'supplier.farmer.no', angry: 'supplier.farmer.angry' },
    products: { bread: 1, apples: 0.9, potatoes: 1, tangerines: 1, flowers: 1.1 },
    flexibility: 0.9,
    patience: 3,
    badChance: 0.12,
    color: 0x6abe30,
  },
  dairy: {
    id: 'dairy',
    nameKey: 'supplier.dairy',
    lines: { hello: 'supplier.dairy.hello', yes: 'supplier.dairy.yes', no: 'supplier.dairy.no', angry: 'supplier.dairy.angry' },
    products: { milk: 1, bread: 1.15, icecream: 1 },
    flexibility: 0.6,
    patience: 2,
    badChance: 0.05,
    color: 0x5b6ee1,
  },
  butcher: {
    id: 'butcher',
    nameKey: 'supplier.butcher',
    lines: { hello: 'supplier.butcher.hello', yes: 'supplier.butcher.yes', no: 'supplier.butcher.no', angry: 'supplier.butcher.angry' },
    products: { meat: 1 },
    flexibility: 0.7,
    patience: 2,
    badChance: 0.1,
    requires: 'meat',
    color: 0xb83a4b,
  },
  // Оптовик: напитки, заморозка и бытовая химия для новых отделов — дёшево, но торгуется туго.
  wholesale: {
    id: 'wholesale',
    nameKey: 'supplier.wholesale',
    lines: { hello: 'supplier.wholesale.hello', yes: 'supplier.wholesale.yes', no: 'supplier.wholesale.no', angry: 'supplier.wholesale.angry' },
    products: { water: 1, juice: 1, dumplings: 1, fish: 1, soap: 1, detergent: 1 },
    flexibility: 0.5,
    patience: 2,
    badChance: 0.06,
    requires: ['drinks', 'frozen', 'household'],
    color: 0x3a4466,
  },
};

/** Есть ли полка, без которой у поставщика нечего брать. */
export const supplierOpen = (s: Supplier, shelves: { kind: Category }[]): boolean =>
  !s.requires || (Array.isArray(s.requires) ? s.requires : [s.requires]).some((k) => shelves.some((sh) => sh.kind === k));

export const SUPPLIER_IDS = Object.keys(SUPPLIERS) as SupplierId[];

export const HAGGLE_ASKS = [0.05, 0.1, 0.2] as const;
/** Обиженный поставщик поднимает цену на сегодня. */
export const ANGRY_MARKUP = 0.1;

/** Итог торга с поставщиком за сегодняшний день. */
export interface Deal {
  discount: number;
  attemptsLeft: number;
  angry: boolean;
}

export const newDeal = (s: Supplier): Deal => ({ discount: 0, attemptsLeft: s.patience, angry: false });

export const canHaggle = (deal: Deal): boolean => deal.discount === 0 && !deal.angry && deal.attemptsLeft > 0;

/** Чем больше просишь, тем меньше шанс. Рейтинг магазина немного помогает. */
export function haggleChance(s: Supplier, ask: number, rating: number): number {
  return Math.min(0.95, Math.max(0.05, s.flexibility - ask * 2 + (rating - 3) * 0.03));
}

/** roll — случайное число 0..1 (передаётся снаружи, чтобы торг можно было тестировать). */
export function haggle(s: Supplier, deal: Deal, ask: number, rating: number, roll: number): { deal: Deal; success: boolean } {
  if (!canHaggle(deal)) return { deal, success: false };
  if (roll < haggleChance(s, ask, rating)) return { deal: { ...deal, discount: ask }, success: true };
  const attemptsLeft = deal.attemptsLeft - 1;
  return { deal: { ...deal, attemptsLeft, angry: attemptsLeft === 0 }, success: false };
}

export function unitPrice(s: Supplier, deal: Deal, id: ProductId): number | null {
  const markup = s.products[id];
  if (markup === undefined) return null;
  const mood = deal.angry ? 1 + ANGRY_MARKUP : 1 - deal.discount;
  return Math.max(1, Math.round(PRODUCTS[id].cost * markup * mood));
}
