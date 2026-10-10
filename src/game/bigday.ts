// Особые дни. Бывают беды: аномальная жара (летом), лютый мороз (зимой), наводнение и
// землетрясение (весной и осенью). По новостям просят сидеть дома, и гостей совсем мало.
// Бывают и праздники на улице: карнавал (летом) и парад оркестров (весной и осенью). Тогда
// мимо магазина идёт шествие и людей вдвое больше.
//
// Главное: утром об особом дне ничего не известно. Прогноз обычный, и «сегодня придут ~N
// гостей» тоже обычное. Новость объявляют, только когда магазин открылся. Закупился на
// обычный день, а пришла беда — лишний товар пролежит и может испортиться. Закупился мало,
// а тут парад — полки опустеют к обеду.
// Как и погода, особый день зависит только от номера дня: перезапуск ничего не меняет.

import type { ProductId, Shelf, StoreState } from './economy';
import { monthInYear, yearTime } from './calendar';
import { rng } from './random';

export type BigDayId = 'heatwave' | 'frost' | 'flood' | 'quake' | 'carnival' | 'parade';

export interface BigDay {
  id: BigDayId;
  icon: string;
  /** Множитель потока гостей. */
  guests: number;
  /** Каких товаров хотят чаще или реже. */
  demand: Partial<Record<ProductId, number>>;
  /** Шествие на улице: толпа, больше гостей в зале одновременно, к очереди терпимее. */
  crowd: boolean;
}

export const BIG_DAYS: Record<BigDayId, BigDay> = {
  heatwave: {
    id: 'heatwave',
    icon: '🥵',
    guests: 0.4,
    demand: { water: 3, icecream: 3, juice: 2.2, milk: 0.7, meat: 0.4, bread: 0.6, dumplings: 0.4, fish: 0.5 },
    crowd: false,
  },
  frost: {
    id: 'frost',
    icon: '❄️',
    guests: 0.4,
    demand: { meat: 1.6, dumplings: 2, potatoes: 1.4, bread: 1.3, icecream: 0.1, water: 0.4, flowers: 0.3 },
    crowd: false,
  },
  flood: {
    id: 'flood',
    icon: '🌊',
    guests: 0.45,
    demand: { water: 3, bread: 1.6, soap: 1.5, detergent: 1.5, flowers: 0.2, icecream: 0.3 },
    crowd: false,
  },
  quake: {
    id: 'quake',
    icon: '🌋',
    guests: 0.55,
    demand: { water: 2.2, bread: 1.4 },
    crowd: false,
  },
  carnival: {
    id: 'carnival',
    icon: '🎭',
    guests: 2.2,
    demand: { water: 2.5, juice: 2.5, icecream: 2.5, flowers: 1.5, buns: 1.5, pies: 1.5 },
    crowd: true,
  },
  parade: {
    id: 'parade',
    icon: '🎺',
    guests: 1.8,
    demand: { juice: 1.8, water: 1.8, flowers: 2.5, icecream: 1.6, buns: 1.4 },
    crowd: true,
  },
};

export const BIG_DAY_IDS = Object.keys(BIG_DAYS) as BigDayId[];

/** С какого дня бывают особые дни и сколько дней минимум между ними. */
export const BIG_DAY_FROM = 10;
export const BIG_DAY_GAP = 4;
/** В толпу в зале помещается больше гостей сразу, и очередь они терпят дольше. */
export const CROWD_EXTRA_GUESTS = 3;
export const CROWD_PATIENCE = 1.2;
/** Землетрясение роняет с полок такую долю товара (бьётся, мнётся — в «Испортилось»). */
export const QUAKE_BREAK = 0.12;

/** Шанс каждого особого дня в своё время года (за один день). */
function chances(day: number): [BigDayId, number][] {
  const time = yearTime(day);
  if (time === 'summer') return [['heatwave', 0.06], ['carnival', 0.07]];
  if (time === 'winter') return [['frost', 0.15]];
  // Предзимье (последний месяц перед Новым годом) — тоже бывают морозы.
  const preWinter: [BigDayId, number][] = monthInYear(day) === 2 ? [['frost', 0.06]] : [];
  if (time === 'spring') return [['flood', 0.06], ['quake', 0.025], ['parade', 0.05]];
  return [...preWinter, ['flood', 0.04], ['quake', 0.025], ['parade', 0.05]];
}

function rawBigDay(day: number): BigDayId | null {
  let roll = rng(day * 104729 + 17)();
  for (const [id, chance] of chances(day)) {
    if (roll < chance) return id;
    roll -= chance;
  }
  return null;
}

const memo = new Map<number, BigDayId | null>();

/** Особый день (или null). Не чаще раза в BIG_DAY_GAP дней. */
export function bigDayFor(day: number): BigDayId | null {
  if (day < BIG_DAY_FROM) return null;
  const known = memo.get(day);
  if (known !== undefined) return known;
  let id = rawBigDay(day);
  for (let k = 1; id && k < BIG_DAY_GAP; k++) if (bigDayFor(day - k)) id = null;
  memo.set(day, id);
  return id;
}

/** Множитель гостей особого дня. В утренний прогноз не входит — о дне ещё никто не знает. */
export const bigDayGuests = (day: number): number => {
  const id = bigDayFor(day);
  return id ? BIG_DAYS[id].guests : 1;
};

export const bigDayDemand = (day: number, id: ProductId): number => {
  const big = bigDayFor(day);
  return big ? (BIG_DAYS[big].demand[id] ?? 1) : 1;
};

export const isCrowdDay = (day: number): boolean => {
  const id = bigDayFor(day);
  return id ? BIG_DAYS[id].crowd : false;
};

/**
 * Толчки землетрясения: с полок падает доля товара. Возвращает новое состояние и сколько
 * штук разбилось (по товарам) — для итогов дня и всплывашки.
 */
export function quakeBreak(state: StoreState, random: () => number, share = QUAKE_BREAK): { state: StoreState; broken: number } {
  let broken = 0;
  const shelves: Shelf[] = state.shelves.map((shelf) => {
    const items: Shelf['items'] = {};
    for (const [id, units] of Object.entries(shelf.items) as [ProductId, NonNullable<Shelf['items'][ProductId]>][]) {
      const keep = units.filter(() => random() >= share);
      broken += units.length - keep.length;
      items[id] = keep;
    }
    return { ...shelf, items };
  });
  return { state: { ...state, shelves }, broken };
}
