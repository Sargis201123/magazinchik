// Правила «Бабушкиной фермы» (docs/FARM.md) без Phaser: грядки, полив, рост, сбор, полки лавки и продажа.
// Сцена (src/farm/FarmScene.ts) только показывает это и зовёт функции; деньги и сохранение — здесь.
// Своя экономика: монеты фермы с монетами «Магазинчика» не смешиваются.

import type { Weather } from '../weather';
import { CROPS, CROP_IDS, type CropId } from './crops';

/** Сколько секунд длится день фермы (при ×1). */
export const FARM_DAY_SECONDS = 120;
/** Грядок на участке и полок в лавке (прототип). */
export const BEDS = 6;
export const SHELVES = 3;
/** С чем начинает новая ферма. */
export const START_MONEY = 24;
/** Полив держится столько секунд дня; в жару — меньше. */
export const WATER_SECONDS = 30;
export const HEAT_WATER_SECONDS = 18;
/** На сухой грядке растёт во столько раз медленнее. */
export const DRY_GROWTH = 0.3;

export interface Bed {
  crop: CropId | null;
  /** Доля роста: 0…1 (1 — созрело). */
  grow: number;
  /** Сколько секунд дня ещё влажно. */
  water: number;
}

export interface Shelf {
  crop: CropId | null;
  count: number;
}

/** Итоги текущего дня (для вечернего окна). */
export interface FarmDayStats {
  planted: number;
  harvested: number;
  sold: number;
  revenue: number;
  seeds: number;
  /** Ушли без покупки: не нашли нужного или не дождались кассы. */
  missed: number;
}

/** Подсказки бабушки, которые уже были (по одной на всю игру). */
export type FarmHint = 'plant' | 'water' | 'harvest' | 'till';

export interface FarmState {
  day: number;
  money: number;
  beds: Bed[];
  shelves: Shelf[];
  /** Урожай в ящике у лавки: не влез на полки. */
  crate: Partial<Record<CropId, number>>;
  hints: FarmHint[];
  stats: FarmDayStats;
  /** Сколько всего продано за всю игру (для титула и будущих целей). */
  soldTotal: number;
}

export const emptyStats = (): FarmDayStats => ({ planted: 0, harvested: 0, sold: 0, revenue: 0, seeds: 0, missed: 0 });

export function newFarm(): FarmState {
  return {
    day: 1,
    money: START_MONEY,
    beds: Array.from({ length: BEDS }, () => ({ crop: null, grow: 0, water: 0 })),
    shelves: Array.from({ length: SHELVES }, () => ({ crop: null, count: 0 })),
    crate: {},
    hints: [],
    stats: emptyStats(),
    soldTotal: 0,
  };
}

const replaceAt = <T>(list: T[], i: number, item: T): T[] => list.map((x, j) => (j === i ? item : x));

export const canPlant = (s: FarmState, bed: number, crop: CropId): boolean => Boolean(s.beds[bed]) && !s.beds[bed].crop && s.money >= CROPS[crop].seed;

/** Посадить на пустую грядку: семена — из кассы. Нельзя — то же состояние. */
export function plant(s: FarmState, bed: number, crop: CropId): FarmState {
  if (!canPlant(s, bed, crop)) return s;
  const seed = CROPS[crop].seed;
  return {
    ...s,
    money: s.money - seed,
    beds: replaceAt(s.beds, bed, { crop, grow: 0, water: s.beds[bed].water }),
    stats: { ...s.stats, planted: s.stats.planted + 1, seeds: s.stats.seeds + seed },
  };
}

export const isWetDay = (weather: Weather): boolean => weather === 'rain' || weather === 'storm';
export const waterSeconds = (weather: Weather): number => (weather === 'heat' ? HEAT_WATER_SECONDS : WATER_SECONDS);

/** Грядке пора пить: что-то растёт, ещё не созрело, земля сухая и дождя нет. */
export const thirsty = (b: Bed, weather: Weather): boolean => Boolean(b.crop) && b.grow < 1 && b.water <= 0 && !isWetDay(weather);

/** Полить грядку (касание): влажно на WATER_SECONDS. */
export function water(s: FarmState, bed: number, weather: Weather): FarmState {
  const b = s.beds[bed];
  if (!b) return s;
  return { ...s, beds: replaceAt(s.beds, bed, { ...b, water: waterSeconds(weather) }) };
}

/** Прошло dt секунд дня: растёт то, что посажено (в дождь всё полито само), земля сохнет. */
export function grow(s: FarmState, dt: number, weather: Weather): FarmState {
  const wet = isWetDay(weather);
  return {
    ...s,
    beds: s.beds.map((b) => {
      const water = wet ? waterSeconds(weather) : Math.max(0, b.water - dt);
      if (!b.crop || b.grow >= 1) return { ...b, water };
      const speed = wet || b.water > 0 ? 1 : DRY_GROWTH;
      return { ...b, water, grow: Math.min(1, b.grow + (dt * speed) / CROPS[b.crop].grow) };
    }),
  };
}

/** Разложить ящик по полкам: на полку своей культуры или на пустую, сколько влезет. */
export function stockShelves(s: FarmState): FarmState {
  const crate = { ...s.crate };
  const shelves = s.shelves.map((x) => ({ ...x }));
  for (const id of CROP_IDS) {
    for (const shelf of shelves) {
      if (!crate[id]) break;
      if (shelf.crop !== id) continue;
      const put = Math.min(crate[id]!, CROPS[id].shelf - shelf.count);
      shelf.count += put;
      crate[id]! -= put;
    }
  }
  // Что осталось — на пустые полки (дорогое — первым: тыква на виду продаётся лучше).
  for (const id of [...CROP_IDS].sort((a, b) => CROPS[b].price - CROPS[a].price)) {
    for (const shelf of shelves) {
      if (!crate[id]) break;
      if (shelf.crop) continue;
      const put = Math.min(crate[id]!, CROPS[id].shelf);
      shelf.crop = id;
      shelf.count = put;
      crate[id]! -= put;
    }
  }
  for (const id of CROP_IDS) if (!crate[id]) delete crate[id];
  return { ...s, shelves, crate };
}

/** Собрать созревшее: урожай — в ящик и сразу на полки. Ответ — сколько собрано (0 — не созрело). */
export function harvest(s: FarmState, bed: number): { state: FarmState; crop: CropId | null; n: number } {
  const b = s.beds[bed];
  if (!b?.crop || b.grow < 1) return { state: s, crop: null, n: 0 };
  const crop = b.crop;
  const n = CROPS[crop].yield;
  const next: FarmState = {
    ...s,
    beds: replaceAt(s.beds, bed, { crop: null, grow: 0, water: b.water }),
    crate: { ...s.crate, [crop]: (s.crate[crop] ?? 0) + n },
    stats: { ...s.stats, harvested: s.stats.harvested + n },
  };
  return { state: stockShelves(next), crop, n };
}

/** Что есть на полках (культура → штук). */
export function onShelves(s: FarmState): Partial<Record<CropId, number>> {
  const out: Partial<Record<CropId, number>> = {};
  for (const shelf of s.shelves) if (shelf.crop && shelf.count > 0) out[shelf.crop] = (out[shelf.crop] ?? 0) + shelf.count;
  return out;
}

/** Чего хочет покупатель: культура по спросу и сколько штук. random — 0…1. */
export function wish(random: () => number): { crop: CropId; qty: number } {
  const total = CROP_IDS.reduce((sum, id) => sum + CROPS[id].demand, 0);
  let roll = random() * total;
  let crop: CropId = CROP_IDS[0];
  for (const id of CROP_IDS) {
    roll -= CROPS[id].demand;
    if (roll < 0) {
      crop = id;
      break;
    }
  }
  const [lo, hi] = CROPS[crop].take;
  return { crop, qty: lo + Math.floor(random() * (hi - lo + 1)) };
}

/**
 * Покупатель снимает с полок: сколько хочет, сколько есть. Ответ — сколько взял (0 — ушёл ни с чем).
 * Пустая полка освобождается под другую культуру и добирает из ящика.
 */
export function takeFromShelves(s: FarmState, crop: CropId, qty: number): { state: FarmState; n: number } {
  let left = qty;
  const shelves = s.shelves.map((x) => ({ ...x }));
  for (const shelf of shelves) {
    if (shelf.crop !== crop || !left) continue;
    const n = Math.min(left, shelf.count);
    shelf.count -= n;
    left -= n;
    if (!shelf.count) shelf.crop = null;
  }
  const n = qty - left;
  if (!n) return { state: s, n: 0 };
  return { state: stockShelves({ ...s, shelves }), n };
}

/** Покупатель расплатился на кассе: монеты в кассу. */
export function pay(s: FarmState, crop: CropId, n: number): { state: FarmState; coins: number } {
  const coins = CROPS[crop].price * n;
  return {
    state: { ...s, money: s.money + coins, soldTotal: s.soldTotal + n, stats: { ...s.stats, sold: s.stats.sold + n, revenue: s.stats.revenue + coins } },
    coins,
  };
}

export const missed = (s: FarmState): FarmState => ({ ...s, stats: { ...s.stats, missed: s.stats.missed + 1 } });

/** Вечер: итоги — в окно, утром — новый день. Грядки и ящик остаются как были (рост продолжится завтра). */
export function nextDay(s: FarmState): FarmState {
  return { ...s, day: s.day + 1, stats: emptyStats() };
}

export const hinted = (s: FarmState, hint: FarmHint): boolean => s.hints.includes(hint);
export const markHint = (s: FarmState, hint: FarmHint): FarmState => (hinted(s, hint) ? s : { ...s, hints: [...s.hints, hint] });

/**
 * Не хватает даже на морковь, ничего не растёт и продать нечего — бабушка подкидывает на семена,
 * чтобы ферма не застряла насовсем (прототип: без банкротства).
 */
export function stuck(s: FarmState): boolean {
  const cheapest = Math.min(...CROP_IDS.map((id) => CROPS[id].seed));
  const growing = s.beds.some((b) => b.crop);
  const goods = s.shelves.some((x) => x.count > 0) || Object.values(s.crate).some((n) => (n ?? 0) > 0);
  return s.money < cheapest && !growing && !goods;
}

/** Сохранение из старой или чужой версии — приводим к нынешнему виду (лишнее отбрасываем). */
export function normalizeFarm(raw: unknown): FarmState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<FarmState>;
  const fresh = newFarm();
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const crop = (v: unknown): CropId | null => (typeof v === 'string' && (CROP_IDS as string[]).includes(v) ? (v as CropId) : null);
  const beds = fresh.beds.map((b, i) => {
    const x = r.beds?.[i];
    const c = crop(x?.crop);
    return c ? { crop: c, grow: Math.min(1, Math.max(0, num(x?.grow, 0))), water: Math.max(0, num(x?.water, 0)) } : b;
  });
  const shelves = fresh.shelves.map((sh, i) => {
    const x = r.shelves?.[i];
    const c = crop(x?.crop);
    const n = Math.max(0, Math.floor(num(x?.count, 0)));
    return c && n ? { crop: c, count: Math.min(n, CROPS[c].shelf) } : sh;
  });
  const crate: FarmState['crate'] = {};
  for (const id of CROP_IDS) {
    const n = Math.floor(num(r.crate?.[id], 0));
    if (n > 0) crate[id] = n;
  }
  const hints = (Array.isArray(r.hints) ? r.hints : []).filter((h): h is FarmHint => ['plant', 'water', 'harvest', 'till'].includes(h as string));
  return {
    day: Math.max(1, Math.floor(num(r.day, 1))),
    money: Math.max(0, Math.floor(num(r.money, START_MONEY))),
    beds,
    shelves,
    crate,
    hints,
    stats: { ...emptyStats(), ...(r.stats && typeof r.stats === 'object' ? r.stats : {}) },
    soldTotal: Math.max(0, Math.floor(num(r.soldTotal, 0))),
  };
}
