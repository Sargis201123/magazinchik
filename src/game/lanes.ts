// Линии касс: чем больше открытых касс, тем больше людей заходит — у магазина, где очередь
// движется, репутация «там быстро». Открытая касса — та, за которой кто-то стоит (касса хозяина
// открыта всегда, остальные — со своим кассиром), и каждая касса самообслуживания. Прибавка
// убывает: вторая касса даёт заметно, пятая — уже чуть-чуть (иначе большой магазин тонул бы в гостях).
//
// Кассы самообслуживания (киоски): ставятся у правой стены над кассами — с «Минимаркета» два места,
// дальше больше. Покупатель с небольшой корзиной пробивает себя сам. Модель общая для всех киосков:
// чем новее, тем быстрее пробивает, реже «ошибка, позовите продавца» и реже кто-то «забывает» пробить товар.

import type { TextKey } from '../i18n/ru';
import { isAbsent, type StoreState } from './economy';
import { registerCount, registerSlots, TILL_ROLES } from './registers';
import { hasUpgrade } from './upgrades';

/** Сколько максимум прибавляют кассы к гостям (+40%), и как быстро прибавка выходит на потолок. */
export const LANE_GUESTS_MAX = 0.4;
export const LANE_SCALE = 3;

export interface KioskTier {
  nameKey: TextKey;
  /** Секунд на товар и на оплату. */
  item: number;
  pay: number;
  /** С какой корзиной (штук) идут к киоску. */
  maxItems: number;
  /** Шанс «ошибки в зоне упаковки»: покупатель стоит и ждёт, пока экран не сбросится. */
  error: number;
  /** Шанс, что покупатель «забудет» пробить один товар. */
  skip: number;
  /** Сколько стоит киоск этой модели как касса (обычная касса с кассиром — 1). */
  lane: number;
  /** Цена перехода на эту модель (для всех киосков сразу) и с какого помещения. */
  price: number;
  minLevel: number;
}

export const KIOSK_TIERS: KioskTier[] = [
  { nameKey: 'kiosk.t0', item: 1.6, pay: 1.2, maxItems: 2, error: 0.12, skip: 0.05, lane: 0.6, price: 0, minLevel: 2 },
  { nameKey: 'kiosk.t1', item: 1.1, pay: 0.8, maxItems: 3, error: 0.06, skip: 0.025, lane: 0.8, price: 600, minLevel: 2 },
  { nameKey: 'kiosk.t2', item: 0.8, pay: 0.6, maxItems: 4, error: 0.02, skip: 0.008, lane: 1, price: 1100, minLevel: 3 },
];
/** Мест под киоски в помещении (у правой стены над кассами — layout.ts, kioskSpot). */
export const KIOSKS_BY_LEVEL = [0, 0, 2, 3, 4];
/** Цена первого, второго, третьего и четвёртого киоска. */
export const KIOSK_PRICES = [700, 900, 1100, 1300];
/** Сколько секунд покупатель ждёт, пока экран «ошибки» сбросится. */
export const KIOSK_ERROR_SECONDS = 3.5;
/** Без очереди к киоску идёт только каждый третий с подходящей корзиной — остальные к кассиру. */
export const KIOSK_PREFER = 0.35;

const slotsAt = (level: number): number => KIOSKS_BY_LEVEL[Math.min(level, KIOSKS_BY_LEVEL.length - 1)];

export const kioskSlots = (state: StoreState): number => slotsAt(state.level);

/**
 * Сколько киосков стоит. Раньше киоск был одним улучшением «Касса самообслуживания» — такое
 * сохранение считается одним киоском первой модели.
 */
export const kioskCount = (state: StoreState): number => {
  const legacy = hasUpgrade(state, 'selfCheckout') ? 1 : 0;
  return Math.min(Math.max(legacy, state.kiosks?.n ?? 0), Math.max(legacy, kioskSlots(state)));
};

export const kioskTierIndex = (state: StoreState): number => Math.min(KIOSK_TIERS.length - 1, Math.max(0, state.kiosks?.tier ?? 0));
export const kioskTier = (state: StoreState): KioskTier => KIOSK_TIERS[kioskTierIndex(state)];

/** Цена следующего киоска (null — мест нет или помещение мало). */
export const nextKioskPrice = (state: StoreState): number | null => {
  const n = kioskCount(state);
  return n < kioskSlots(state) ? KIOSK_PRICES[n] ?? null : null;
};

/** Поставить ещё один киоск. Первый — заодно «улучшение» selfCheckout: по нему игра узнаёт, что киоски есть. */
export function buyKiosk(state: StoreState): StoreState | null {
  const price = nextKioskPrice(state);
  if (price === null || price > state.money) return null;
  const upgrades = hasUpgrade(state, 'selfCheckout') ? state.upgrades : [...(state.upgrades ?? []), 'selfCheckout' as const];
  return { ...state, money: state.money - price, upgrades, kiosks: { n: kioskCount(state) + 1, tier: kioskTierIndex(state) } };
}

/** Следующая модель киосков (null — уже лучшая). */
export const nextKioskTier = (state: StoreState): KioskTier | null => KIOSK_TIERS[kioskTierIndex(state) + 1] ?? null;

/** Обновить все киоски до следующей модели (нужен хотя бы один киоск). */
export function upgradeKiosks(state: StoreState): StoreState | null {
  const next = nextKioskTier(state);
  if (!next || kioskCount(state) === 0 || state.level < next.minLevel || state.money < next.price) return null;
  return { ...state, money: state.money - next.price, kiosks: { n: kioskCount(state), tier: kioskTierIndex(state) + 1 } };
}

/**
 * Кассы с кассиром, кроме кассы хозяина (она открыта всегда): кассир сегодня на месте (не болеет, не на
 * выходном). Кого-то нет, а менеджер на смене — он встаёт за одну из пустых касс (как в зале).
 */
export function staffedTills(state: StoreState): number {
  const roles = TILL_ROLES.slice(0, registerCount(state) - 1);
  const here = (role: string, away: boolean) => state.staff.some((m) => m.role === role && isAbsent(state, m) === away);
  const open = roles.filter((role) => here(role, false)).length;
  const gap = roles.some((role) => here(role, true));
  const cover = gap && state.staff.some((m) => m.role === 'manager' && !isAbsent(state, m)) ? 1 : 0;
  return open + cover;
}

/** Открытых касс сверх кассы хозяина: кассы с кассиром — по одной, киоски — сколько стоит их модель. */
export const extraLanes = (state: StoreState): number => staffedTills(state) + kioskCount(state) * kioskTier(state).lane;

/** Открытых касс всего (для подсказок): касса хозяина, кассы с кассиром и киоски. */
export const openRegisters = (state: StoreState): number => 1 + staffedTills(state) + kioskCount(state);

/** Множитель гостей от касс: 1 + 0.4·(1 − e^(−L/3)) — вторая касса ≈ +11%, четыре лишних ≈ +29%. */
export const laneGuests = (state: StoreState): number => 1 + LANE_GUESTS_MAX * (1 - Math.exp(-extraLanes(state) / LANE_SCALE));

/** Магазин, где открыли ещё одну кассу с кассиром (для подсказки «+N гостей в день»); null — мест под кассы нет. */
export function withNextTill(state: StoreState): StoreState | null {
  const role = TILL_ROLES.slice(0, registerSlots(state) - 1).find((r) => !state.staff.some((m) => m.role === r));
  if (!role) return null;
  const index = TILL_ROLES.indexOf(role) + 1;
  return { ...state, registers: Math.max(registerCount(state), index + 1), staff: [...state.staff, { role, name: 0, skill: 1, wage: 0, months: 0 }] };
}
