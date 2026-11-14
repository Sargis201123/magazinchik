// Этажи здания (13.11, автор: «нужен подпольный этаж со своей экосистемой; потом второй этаж — магазин одежды —
// и третий — фудкорт»). Здесь — общая основа, которую переиспользуют все этажи: какие открыты (state.floors),
// с какого помещения и за сколько открываются, уровень отделки. Что живёт на этаже — в его модуле (подвал —
// basement.ts). Вид этажа в мире — scenes/floorView.ts, раздел «Этажи» в «Развитии» — ui/floors.ts.
//
// Нет поля floors (старое сохранение) — этажей нет, всё как раньше. Этаж принадлежит зданию в Центре: в Заречье
// (zarshop.ts) его не видно и не купить — как ломбард в подсобке.

import { FOOD_UPS } from './foodcourtUps';
import type { StoreState } from './economy';
import { homeLevel, inZar } from './zarshop';

/** Этажи здания: подвал, второй (одежда, clothes.ts), третий (фудкорт, foodcourt.ts). Новый этаж — тип, FLOORS, модуль вида в scenes/floors/ и строка BUILD в floorView. */
export type FloorId = 'basement' | 'second' | 'third';
export const FLOOR_IDS: FloorId[] = ['basement', 'second', 'third'];

export interface FloorDef {
  /** С какого помещения (индекс STORE_LEVELS) этаж можно открыть. */
  minLevel: number;
  /** Цена открытия (расчистить, провести свет, поставить дверь). */
  cost: number;
  /** Цены следующих ступеней отделки: finish[0] — до первой, finish[1] — до второй… */
  finish: number[];
  /** Значок в меню и над дверью этажа в мире. */
  icon: string;
  /**
   * Какой этаж должен быть открыт раньше (третий — над вторым). Этажа с таким id нет в FLOORS (старая сборка) —
   * условие не действует (floorLock).
   */
  needs?: string;
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
  // Третий этаж — фудкорт (foodcourt.ts, 13.11): с «Универмага», дорого — как неделя выручки большого магазина.
  // Ремонт (витражи, свет) — четвёртое место под точку еды и зал наряднее.
  third: { minLevel: 4, cost: 30000, finish: [18000], icon: '🍕', needs: 'second' },
};

/** Этаж в сохранении: с какого дня открыт, ступень отделки (0 — голые стены) и купленные улучшения этажа. */
export interface Floor {
  since: number;
  finish: number;
  /** Улучшения этажа (FLOOR_UPGRADES, 14.11): id купленных. Нет поля (старое сохранение) — ничего не куплено. */
  up?: string[];
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

/**
 * Почему этаж ещё нельзя открыть: Заречье, мало помещение, не открыт этаж ниже или уже открыт; null — можно (если
 * хватает денег). Этажа ниже нет в FLOORS (старая сборка без второго этажа) — это условие пропускаем.
 */
export function floorLock(state: StoreState, id: FloorId): 'zar' | 'level' | 'below' | 'open' | null {
  if (inZar(state)) return 'zar';
  if (state.floors?.[id]) return 'open';
  if (homeLevel(state) < FLOORS[id].minLevel) return 'level';
  const below = FLOORS[id].needs;
  return below && known(below) && !hasFloor(state, below) ? 'below' : null;
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

// ---------------------------------------------------------------- переключатель этажей
//
// 14.11, автор: «в левой части экрана должно появиться переключение между этажами — нажимать в углу магазина на
// подвал не очень удобно». Какие остановки показывает лифт (ui/floorSwitch.ts, scenes/floors/nav.ts) — решает игра:
// открытые этажи, зал и один серый — следующий этаж, до которого игрок может дорасти. Чистая функция от состояния.

/** Остановка лифта: этаж здания или зал магазина. */
export type FloorStop = FloorId | 'hall';
/** Остановки сверху вниз — как кнопки в лифте: третий, второй, зал, подвал. */
export const STOP_ORDER: FloorStop[] = ['third', 'second', 'hall', 'basement'];
/** Высота остановки: подвал −1, зал 0, второй 1, третий 2 — куда ехать, вверх или вниз (переход в виде этажа). */
export const stopLevel = (stop: FloorStop): number => (stop === 'basement' ? -1 : stop === 'hall' ? 0 : stop === 'second' ? 1 : 2);

export interface StopInfo {
  id: FloorStop;
  /** Можно поехать: зал или открытый этаж. Нет — серая кнопка с замком (почему — lock). */
  open: boolean;
  /** Почему этаж закрыт (floorLock): null — можно открыть в «Развитии» хоть сейчас, если хватает денег. */
  lock?: ReturnType<typeof floorLock>;
}

/**
 * Кнопки лифта сверху вниз. Пусто — переключателя нет: Заречье, или ни один этаж не открыт и открыть пока нечего
 * (до «Минимаркета» — меньше шума на экране новичка). Серый — только ближайший неоткрытый этаж (по порядку подвал →
 * второй → третий): показать, к чему расти, а не весь список замков.
 */
export function floorStops(state: StoreState): StopInfo[] {
  if (inZar(state)) return [];
  const open = new Set(openFloors(state));
  const next = FLOOR_IDS.find((id) => !open.has(id));
  const nextLock = next ? floorLock(state, next) : 'open';
  if (!open.size && nextLock !== null) return [];
  return STOP_ORDER.flatMap((id): StopInfo[] => {
    if (id === 'hall' || open.has(id)) return [{ id, open: true }];
    return id === next && nextLock !== 'open' && nextLock !== 'zar' ? [{ id, open: false, lock: nextLock }] : [];
  });
}

// ---------------------------------------------------------------- улучшения этажей
//
// 14.11: общая основа улучшений для всех этажей — как оборудование основного зала (gear.ts): ступени с ценой и
// условием, купленное меняет вид этажа и даёт числа, которые модуль этажа читает сам (floorBonus). Списки по
// этажам заполняют их модули; здесь — только правила: сохранение (state.floors[id].up), условия, покупка.

export interface FloorUpgrade {
  id: string;
  /** Значок в меню и в подписи на этаже. */
  icon: string;
  /** Картинка строки в меню (кадр атласа); нет — картинка этажа. */
  art?: string;
  price: number;
  /** С какого помещения (индекс STORE_LEVELS); нет — с любого, где открыт этаж. */
  minLevel?: number;
  /** Какая ступень отделки этажа нужна (FLOORS[id].finish); нет — и на голых стенах. */
  finish?: number;
  /** Какое улучшение этого же этажа нужно раньше (ступени одной линейки). */
  needs?: string;
  /**
   * Что даёт: числа по именам, которые читает модуль этажа (floorBonus): { guests: 0.1 } — гостей этажа +10%.
   * Имена — договорённость модуля этажа; одинаковые у нескольких улучшений складываются.
   */
  effect?: Readonly<Record<string, number>>;
}

/** Улучшения по этажам (порядок — как в меню). Пусто — у этажа их пока нет. Заполняют модули этажей. */
export const FLOOR_UPGRADES: Record<FloorId, FloorUpgrade[]> = { basement: [], second: [], third: [] };

const upgradeDef = (id: FloorId, up: string): FloorUpgrade | undefined => FLOOR_UPGRADES[id].find((u) => u.id === up);
// Третий этаж — фудкорт: дизайн зала, детская зона, сцена (foodcourtUps.ts, 14.11).
FLOOR_UPGRADES.third.push(...FOOD_UPS);

/** Купленные улучшения этажа (только известные этой сборке; кривое поле старого сохранения — как пусто). */
export function floorUps(state: StoreState, id: FloorId): string[] {
  const up = floorOf(state, id)?.up;
  return Array.isArray(up) ? up.filter((u): u is string => typeof u === 'string' && Boolean(upgradeDef(id, u))) : [];
}

export const hasFloorUp = (state: StoreState, id: FloorId, up: string): boolean => floorUps(state, id).includes(up);

/**
 * Почему улучшение нельзя купить: этаж не открыт, нет такого, уже есть, мало помещение, мало отделки, нет ступени
 * раньше; null — можно (если хватает денег).
 */
export function floorUpLock(state: StoreState, id: FloorId, up: string): 'closed' | 'unknown' | 'owned' | 'level' | 'finish' | 'needs' | null {
  const f = floorOf(state, id);
  if (!f) return 'closed';
  const def = upgradeDef(id, up);
  if (!def) return 'unknown';
  if (hasFloorUp(state, id, up)) return 'owned';
  if (def.minLevel !== undefined && homeLevel(state) < def.minLevel) return 'level';
  if (def.finish !== undefined && f.finish < def.finish) return 'finish';
  return def.needs && !hasFloorUp(state, id, def.needs) ? 'needs' : null;
}

export function buyFloorUp(state: StoreState, id: FloorId, up: string): StoreState | null {
  const def = upgradeDef(id, up);
  const f = floorOf(state, id);
  if (!def || !f || floorUpLock(state, id, up) || state.money < def.price) return null;
  return { ...state, money: state.money - def.price, floors: { ...state.floors, [id]: { ...f, up: [...floorUps(state, id), up] } } };
}

/** Сумма чисел key по купленным улучшениям этажа (0 — ничего не куплено или этажа нет). */
export function floorBonus(state: StoreState, id: FloorId, key: string): number {
  return floorUps(state, id).reduce((sum, up) => sum + (upgradeDef(id, up)?.effect?.[key] ?? 0), 0);
}
