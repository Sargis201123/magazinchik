// Этажи здания (13.11, автор: «нужен подпольный этаж со своей экосистемой; потом второй этаж — магазин одежды —
// и третий — фудкорт»). Здесь — общая основа, которую переиспользуют все этажи: какие открыты (state.floors),
// с какого помещения и за сколько открываются, уровень отделки. Что живёт на этаже — в его модуле (подвал —
// basement.ts). Вид этажа в мире — scenes/floorView.ts, раздел «Этажи» в «Развитии» — ui/floors.ts.
//
// Нет поля floors (старое сохранение) — этажей нет, всё как раньше. Этаж принадлежит зданию в Центре: в Заречье
// (zarshop.ts) его не видно и не купить — как ломбард в подсобке.

import type { StoreState } from './economy';
import { homeLevel, inZar } from './zarshop';

/** Этажи здания. Второй этаж и третий допишутся сюда же (тип, FLOORS, вид в floorView). */
export type FloorId = 'basement' | 'second';
export const FLOOR_IDS: FloorId[] = ['basement', 'second'];

export interface FloorDef {
  /** С какого помещения (индекс STORE_LEVELS) этаж можно открыть. */
  minLevel: number;
  /** Цена открытия (расчистить, провести свет, поставить дверь). */
  cost: number;
  /** Цены следующих ступеней отделки: finish[0] — до первой, finish[1] — до второй… */
  finish: number[];
  /** Значок в меню и над дверью этажа в мире. */
  icon: string;
}

/**
 * Подвал — с «Минимаркета» (там же подсобка с ломбардом): у ларька и «Магазинчика» под полом только погреб.
 * Цена — как год-полтора выручки ларька, но для «Минимаркета» (≈ 4 тыс. в день) — неделя-две: доступно, но не даром.
 */
export const FLOORS: Record<FloorId, FloorDef> = {
  basement: { minLevel: 2, cost: 3000, finish: [2500], icon: '🪜' },
  // Второй этаж — магазин одежды (clothes.ts, 13.11): с «Супермаркета». У него ≈ 130 гостей в день — наверх
  // поднимаются 3–4 покупателя, этаж окупается примерно за месяц, если вовремя завозить партии по сезону.
  second: { minLevel: 3, cost: 8000, finish: [6000], icon: '👗' },
};

/** Этаж в сохранении: с какого дня открыт и ступень отделки (0 — голые стены). */
export interface Floor {
  since: number;
  finish: number;
}

export type FloorsState = Partial<Record<FloorId, Floor>>;

const known = (id: unknown): id is FloorId => typeof id === 'string' && id in FLOORS;

/** Этаж открыт (в Центре). Кривое поле из старого сохранения — как будто этажа нет. */
export function floorOf(state: StoreState, id: FloorId): Floor | null {
  const f = state.floors?.[id];
  if (!f || typeof f !== 'object' || inZar(state)) return null;
  const finish = Math.max(0, Math.min(FLOORS[id].finish.length, Math.floor(Number(f.finish) || 0)));
  return finish === f.finish ? f : { ...f, finish };
}

export const hasFloor = (state: StoreState, id: FloorId): boolean => floorOf(state, id) !== null;

/** Открытые этажи по порядку. */
export const openFloors = (state: StoreState): FloorId[] => FLOOR_IDS.filter((id) => hasFloor(state, id));

/** Почему этаж ещё нельзя открыть: Заречье, мало помещение или уже открыт; null — можно (если хватает денег). */
export function floorLock(state: StoreState, id: FloorId): 'zar' | 'level' | 'open' | null {
  if (inZar(state)) return 'zar';
  if (state.floors?.[id]) return 'open';
  return homeLevel(state) < FLOORS[id].minLevel ? 'level' : null;
}

/** Этаж уже можно открыть (помещение позволяет), но ещё не открыли — для подсказки и меню. */
export const floorAvailable = (state: StoreState, id: FloorId): boolean => floorLock(state, id) === null;

export function buyFloor(state: StoreState, id: FloorId): StoreState | null {
  if (!known(id) || floorLock(state, id) || state.money < FLOORS[id].cost) return null;
  return { ...state, money: state.money - FLOORS[id].cost, floors: { ...state.floors, [id]: { since: state.day, finish: 0 } } };
}

/** Цена следующей ступени отделки (null — этажа нет или отделан до конца). */
export function finishCost(state: StoreState, id: FloorId): number | null {
  const f = floorOf(state, id);
  return f ? (FLOORS[id].finish[f.finish] ?? null) : null;
}

export function finishFloor(state: StoreState, id: FloorId): StoreState | null {
  const f = floorOf(state, id);
  const cost = finishCost(state, id);
  if (!f || cost === null || state.money < cost) return null;
  return { ...state, money: state.money - cost, floors: { ...state.floors, [id]: { ...f, finish: f.finish + 1 } } };
}
