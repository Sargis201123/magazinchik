// Стойка со сладостями у кассы: пока покупатель стоит в очереди, он может схватить шоколадку.
// Чем длиннее очередь, тем чаще берут. У стойки свой запас: пополняется утром, стойку можно
// поменять на большую — больше места и заметнее.

import type { StoreState } from './economy';

export interface RackLevel {
  /** Сколько шоколадок помещается. */
  capacity: number;
  /** Шанс, что стоящий в очереди возьмёт шоколадку. */
  chance: number;
  /** Цена стойки этого уровня. */
  cost: number;
}

export const RACK_LEVELS: RackLevel[] = [
  { capacity: 12, chance: 0.08, cost: 0 },
  { capacity: 24, chance: 0.13, cost: 400 },
  { capacity: 40, chance: 0.18, cost: 1200 },
];

/** Закупочная цена и цена продажи одной шоколадки. */
export const CANDY_COST = 9;
export const CANDY_PRICE = 15;
/** За каждого стоящего впереди шанс растёт: заскучал — потянулся к полке. */
export const QUEUE_BONUS = 0.05;
export const MAX_IMPULSE = 0.8;

export interface Rack {
  level: number;
  stock: number;
}

export const rackOf = (state: StoreState): Rack => state.rack ?? { level: 0, stock: 0 };
export const rackCapacity = (state: StoreState): number => RACK_LEVELS[rackOf(state).level].capacity;

/** Шанс взять шоколадку, когда впереди в очереди ahead человек. */
export function impulseChance(state: StoreState, ahead: number): number {
  const rack = rackOf(state);
  if (rack.stock <= 0) return 0;
  return Math.min(MAX_IMPULSE, RACK_LEVELS[rack.level].chance + QUEUE_BONUS * ahead);
}

/** Пополнить стойку до qty штук сверху (сколько влезет и на сколько хватит денег). */
export function refillRack(state: StoreState, qty: number): StoreState | null {
  const rack = rackOf(state);
  const n = Math.min(qty, rackCapacity(state) - rack.stock, Math.floor(state.money / CANDY_COST));
  if (n <= 0) return null;
  return { ...state, money: state.money - n * CANDY_COST, rack: { ...rack, stock: rack.stock + n } };
}

export const nextRack = (state: StoreState): RackLevel | undefined => RACK_LEVELS[rackOf(state).level + 1];

export function upgradeRack(state: StoreState): StoreState | null {
  const next = nextRack(state);
  if (!next || state.money < next.cost) return null;
  const rack = rackOf(state);
  return { ...state, money: state.money - next.cost, rack: { ...rack, level: rack.level + 1 } };
}

/** Покупатель взял шоколадку со стойки (null — стойка пустая). */
export function takeCandy(state: StoreState): StoreState | null {
  const rack = rackOf(state);
  if (rack.stock <= 0) return null;
  return { ...state, rack: { ...rack, stock: rack.stock - 1 } };
}

/** Передумал (ушёл из очереди) — шоколадка возвращается на стойку. */
export function returnCandy(state: StoreState): StoreState {
  const rack = rackOf(state);
  return { ...state, rack: { ...rack, stock: Math.min(rackCapacity(state), rack.stock + 1) } };
}
