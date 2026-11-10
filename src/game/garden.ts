// «Бабушкина теплица»: растёт по настоящему времени — и пока игрока нет в игре. Вернулся — урожай созрел:
// яблоки и картофель бесплатно на склад, и рассада сразу посажена заново. Это повод зайти ещё раз сегодня или
// завтра, который видно в мире (scenes/gardenFx.ts), в «Главном на сегодня» и в «Развитии» (ui/garden.ts).
// Время приходит снаружи (now): правила не читают часы сами — так их можно проверить тестом.

import { buyStock, sellableProducts, warehouseCapacity, warehouseCount, type ProductId, type StoreState } from './economy';
import { inZar } from './zarshop';

export interface GardenState {
  /** Когда посажена нынешняя рассада (мс по часам игрока). */
  since: number;
  /** Сколько урожаев собрано за всё время. */
  harvests: number;
}

/** Рассаду бабушка присылает на третий день: первые два новичок учится торговать. */
export const GARDEN_FROM_DAY = 3;
export const GARDEN_PRICE = 150;
/** Урожай зреет шесть часов: успевает и к вечеру того же дня, и к завтрашнему утру. */
export const GROW_MS = 6 * 3600_000;
/** Что растёт: то, что есть на овощном прилавке с первого дня. */
export const GARDEN_CROPS: ProductId[] = ['apples', 'potatoes'];

export const hasGarden = (state: StoreState): boolean => Boolean(state.garden);
/** Раздел виден в Центре: с третьего дня или если теплица уже стоит. */
export const gardenVisible = (state: StoreState): boolean => !inZar(state) && (hasGarden(state) || state.day >= GARDEN_FROM_DAY);

/** Поставить теплицу. null — рано, уже стоит, не хватает денег или мы в Заречье. */
export function buildGarden(state: StoreState, now: number): StoreState | null {
  if (hasGarden(state) || inZar(state) || state.day < GARDEN_FROM_DAY || state.money < GARDEN_PRICE) return null;
  return { ...state, money: state.money - GARDEN_PRICE, garden: { since: now, harvests: 0 } };
}

/** Насколько вырос урожай: 0…1. Часы перевели назад — рост не уходит в минус. */
export const gardenProgress = (state: StoreState, now: number): number => (state.garden ? Math.min(1, Math.max(0, (now - state.garden.since) / GROW_MS)) : 0);
export const gardenRipe = (state: StoreState, now: number): boolean => hasGarden(state) && gardenProgress(state, now) >= 1;
/** Стадия для картинки: 0 — только посадили, 1 — ростки, 2 — кусты, 3 — созрело. */
export const gardenStage = (state: StoreState, now: number): number => (gardenRipe(state, now) ? 3 : Math.min(2, Math.floor(gardenProgress(state, now) * 3)));
/** Сколько осталось до урожая, мс (0 — созрел или теплицы нет). */
export const gardenLeft = (state: StoreState, now: number): number => (state.garden ? Math.max(0, state.garden.since + GROW_MS - now) : 0);

/** Урожай с грядки каждого вида: в большом магазине теплица больше. */
export const cropQty = (state: StoreState): number => 6 + 3 * state.level;

/**
 * Собрать урожай: по cropQty каждого вида — сколько влезет на склад, бесплатно; рассада сажается заново.
 * null — не созрел, мы в Заречье или на складе нет ни одного места (урожай подождёт).
 */
export function harvest(state: StoreState, now: number): { state: StoreState; got: { id: ProductId; qty: number }[] } | null {
  if (inZar(state) || !state.garden || !gardenRipe(state, now)) return null;
  const sell = sellableProducts(state);
  let next = state;
  const got: { id: ProductId; qty: number }[] = [];
  for (const id of GARDEN_CROPS.filter((crop) => sell.includes(crop))) {
    const qty = Math.min(cropQty(state), warehouseCapacity(next) - warehouseCount(next));
    const stocked = qty > 0 ? buyStock(next, id, qty, 0) : null;
    if (!stocked) continue;
    next = stocked;
    got.push({ id, qty });
  }
  if (!got.length) return null;
  return { state: { ...next, garden: { since: now, harvests: state.garden.harvests + 1 } }, got };
}

/** Что видно в мире: стоит ли теплица и на какой стадии. Изменилось — сцена перерисовывает её. */
export const gardenLook = (state: StoreState, now: number): string => (inZar(state) || !state.garden ? '' : `g${gardenStage(state, now)}`);
