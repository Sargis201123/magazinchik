// Живые этажи (15.11, автор: «подвал и второй этаж — больше трафика из людей закинь туда, прям пусто — они просто
// есть сейчас, я бы хотел эти части тоже активными сделать»). Здесь — чистые правила:
//  · сколько людей одновременно на этаже (от чисел дня, но не меньше разумного минимума — открытый этаж не пустует);
//  · моменты этажей: короткие дела «нажми», как моменты зала (moments.ts). Второй этаж — покупателю нужен другой
//    размер, очередь у кассы, воришка у стойки; подвал — просят разменять на жетоны, автомат заело, буянит гость.
//    Каждый — по желанию: не успел — просто нет маленькой награды, штрафа нет. Они занимают место в общем бюджете
//    внимания дня (attention.ts): этажи не добавляют просьб сверх пяти, а делят их с залом.
// Какой момент, когда и сколько он даёт — только от зерна магазина и номера дня (как находки кота, cat.ts):
// перезапуск дня ничего не перекатывает. Сохранять нечего: учёт — в статистике дня (DayStats), строкой в итогах.

import { DAY_SECONDS, type DayStats, type StoreState } from './economy';
import { slotsPlan } from './basement';
import { clothesOf, freshStock, stockTotal } from './clothes';
import { momentTip } from './moments';

/** Этажи, где бывают моменты: фудкорт и так живой (автор: «третий этаж — хорошо»). */
export type LifeFloor = 'basement' | 'second';
export const LIFE_FLOORS: LifeFloor[] = ['second', 'basement'];

export type FloorMomentKind = 'size' | 'queue' | 'thief' | 'change' | 'jam' | 'rowdy';
export const FLOOR_MOMENT_KINDS: Record<LifeFloor, FloorMomentKind[]> = {
  second: ['size', 'queue', 'thief'],
  basement: ['change', 'jam', 'rowdy'],
};

/** Значок момента: в строке у кнопки этажа и в итогах (одинаков во всех языках — поэтому здесь, а не в текстах). */
export const FLOOR_MOMENT_ICONS: Record<FloorMomentKind, string> = {
  size: '👗',
  queue: '🛍',
  thief: '🕵',
  change: '🪙',
  jam: '🔧',
  rowdy: '😤',
};

export interface FloorMoment {
  floor: LifeFloor;
  kind: FloorMomentKind;
  /** Секунда дня, когда начинается. */
  at: number;
}

/** Где в дне бывают моменты этажей (доли дня): не в первые секунды и не под закрытие. */
export const FLOOR_SPAN: readonly [number, number] = [0.15, 0.75];
/** Между моментами двух этажей — не меньше стольких долей дня: два сразу не зовут. */
export const FLOOR_GAP = 0.3;
/** Сколько секунд дня момент ждёт игрока: успеть заметить свечение кнопки и доехать. */
export const FLOOR_MOMENT_WAIT = 25;
/** Моментов этажей за день — не больше стольких (их место — в бюджете внимания). */
export const FLOOR_MOMENTS_MAX = 2;

/** Случайность этажей: зерно магазина, день и «соль» (как у подвала и одежды). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 2246822519 + salt * 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** На этаже сегодня есть жизнь, ради которой стоит звать: автоматы стоят, вещи висят. */
export function floorAlive(state: StoreState, floor: LifeFloor): boolean {
  if (floor === 'basement') return slotsPlan(state) !== null;
  return stockTotal(clothesOf(state)) > 0;
}

/** Какие моменты возможны на этаже сегодня: «размер» — только когда есть вещи сезона (примерять нечего — некого звать). */
export function floorKinds(state: StoreState, floor: LifeFloor): FloorMomentKind[] {
  if (!floorAlive(state, floor)) return [];
  if (floor === 'second' && !freshStock(state)) return FLOOR_MOMENT_KINDS.second.filter((k) => k !== 'size');
  return FLOOR_MOMENT_KINDS[floor];
}

/**
 * Моменты этажей на сегодня (не больше одного на этаж), по времени. Сколько из них правда случится — решает бюджет
 * внимания дня (attention.ts); лишние просто не происходят.
 */
export function floorMomentsFor(state: StoreState): FloorMoment[] {
  const out: FloorMoment[] = [];
  const floors = LIFE_FLOORS.filter((f) => floorKinds(state, f).length > 0);
  if (!floors.length) return out;
  const [from, to] = FLOOR_SPAN;
  // Первый — в первой части окна, второй — через FLOOR_GAP; кто первым — тоже от дня.
  const first = from + (to - from - FLOOR_GAP) * roll(state, 41);
  const order = roll(state, 42) < 0.5 ? floors : [...floors].reverse();
  order.forEach((floor, i) => {
    const kinds = floorKinds(state, floor);
    const kind = kinds[Math.floor(roll(state, 43 + i) * kinds.length) % kinds.length];
    out.push({ floor, kind, at: Math.round((first + i * FLOOR_GAP) * DAY_SECONDS) });
  });
  return out.slice(0, FLOOR_MOMENTS_MAX);
}

/**
 * Что даёт пойманный момент: деньги сразу (как чаевые момента зала, momentTip — растут с помещением) или искорка
 * к рейтингу вечером. Размер подошёл — докупили вещь; вора поймали и автомат починили — спасли вдвое больше;
 * буяна вывели — завсегдатаи довольны (искорка, денег нет).
 */
export function floorMomentGain(kind: FloorMomentKind, level: number): { money: number; star: boolean } {
  const tip = momentTip(level);
  switch (kind) {
    case 'size':
    case 'thief':
    case 'jam':
      return { money: tip * 2, star: false };
    case 'queue':
    case 'change':
      return { money: tip, star: false };
    case 'rowdy':
      return { money: 0, star: true };
  }
}

/** Учёт в статистике дня: показали, поймали, сколько денег. Искорка идёт к искоркам моментов зала (тот же предел). */
export function noteFloorMoment(stats: DayStats, caught: boolean, gain: { money: number; star: boolean } = { money: 0, star: false }): void {
  stats.floorShown = (stats.floorShown ?? 0) + 1;
  if (!caught) return;
  stats.floorCaught = (stats.floorCaught ?? 0) + 1;
  stats.floorMoney = (stats.floorMoney ?? 0) + gain.money;
  if (gain.star) stats.momentStars = (stats.momentStars ?? 0) + 1;
}

/** Поймали момент: деньги в кассу (никогда не в минус) и учёт. */
export function catchFloorMoment(state: StoreState, stats: DayStats, kind: FloorMomentKind): { state: StoreState; gain: { money: number; star: boolean } } {
  const gain = floorMomentGain(kind, state.level);
  noteFloorMoment(stats, true, gain);
  return { state: gain.money ? { ...state, money: Math.max(0, state.money + gain.money) } : state, gain };
}

/**
 * Сколько людей одновременно на этаже, пока он открыт. Подвал — от завсегдатаев дня (slotsPlan), второй этаж — от
 * гостей магазина за день. Не меньше минимума: открытый этаж не стоит пустым (автор, 15.11); в лёгкой графике —
 * вдвое меньше, но хоть кто-то есть.
 */
export function floorCrowd(floor: LifeFloor, base: number, lite: boolean): number {
  const n = floor === 'basement' ? Math.round(Math.max(0, base) * 0.7) : Math.round(Math.max(0, base) * 0.03);
  const min = floor === 'basement' ? 4 : 3;
  const max = floor === 'basement' ? 9 : 7;
  const full = Math.max(min, Math.min(max, n));
  return lite ? Math.max(2, Math.ceil(full / 2)) : full;
}
