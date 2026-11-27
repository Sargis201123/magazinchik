// «Бабушкин двор»: теплица и до двух грядок во дворе слева от магазина, за складом.
// 27.11, просьба автора: «пусть он будет как аренда, пассивно приносить деньги - игрок не будет заходить в меню и каждый
// раз собирать». Раньше урожай рос по настоящим часам (2 / 6 / 12 ч), его собирали руками на овощной прилавок: собирать
// бросали через несколько дней, прилавок бывал полон, лишнее молча пропадало. Теперь каждая грядка каждый вечер
// приносит деньги (бабушка продаёт урожай соседям у калитки): 30 × (помещение + 1) за грядку, до счетов, как аренда
// флигеля (day.ts), строкой «🌱 Бабушкин двор» в «Прочих доходах» итогов дня. Решение у игрока одно - вскопать ещё грядку.
// Пока двор стоит, варенье своей марки - «из своих яблок» (lines.ts). Мир - scenes/gardenFx.ts, меню - ui/garden.ts.

import type { StoreState } from './economy';
import { homeLevel, inZar } from './zarshop';

/** Что растёт на грядке - только для картинки и подписи: теплица - яблоки с картошкой, вторая - яблони, третья - картошка. */
export type CropId = 'quick' | 'mix' | 'apples';
export const CROP_IDS: CropId[] = ['quick', 'mix', 'apples'];
export const BED_CROPS: CropId[] = ['mix', 'apples', 'quick'];
export const CROP_ICON: Record<CropId, string> = { quick: '🥔', mix: '🍎', apples: '🌳' };

export interface GardenState {
  /** Сколько грядок вскопано: 1…3. Нет поля - сохранение до 27.11: грядки считаются по since/more (bedCount). */
  beds?: number;
  /** Прошлый вечер: какой день и сколько принёс двор. */
  last?: { day: number; n: number };
  /** Сколько двор принёс за всё время. */
  total?: number;
  // До 27.11 (урожай по часам): первая грядка - since/crop, остальные - more; сборы, «своё варенье», поливы друзей.
  // Новый код читает их, только пока нет beds (старое сохранение). Пишутся на один выпуск (saveGarden) - для отката
  // и старого кэша клиента; crop, own и watered первый же вечер убирает.
  since?: number;
  crop?: string;
  harvests?: number;
  more?: unknown[];
  own?: number;
  watered?: number;
}

/** Рассаду бабушка присылает на третий день: первые два новичок учится торговать. */
export const GARDEN_FROM_DAY = 3;
export const GARDEN_PRICE = 150;
/** Вторая и третья грядки: цена. */
export const BED_COSTS = [600, 1500];
export const BEDS_MAX = BED_COSTS.length + 1;
/**
 * Сколько грядка приносит за вечер: столько × (помещение + 1). Универмаг - 150 за грядку, 450 за три (~1% выручки):
 * столько двор давал тому, кто собирал урожай каждый день, но теперь каждый день и без касаний. Теплица за 150
 * в «Ларьке» окупается за 5 дней, третья грядка за 1 500 в «Минимаркете» - за 17.
 */
export const YARD_PER_BED = 30;
/** Варенье своей марки «из своих яблок» берут охотнее (lines.ts) - пока стоит двор. */
export const OWN_JAM_DEMAND = 1.2;

export const hasGarden = (state: StoreState): boolean => Boolean(state.garden);
/** Раздел виден в Центре: с третьего дня или если теплица уже стоит. */
export const gardenVisible = (state: StoreState): boolean => !inZar(state) && (hasGarden(state) || state.day >= GARDEN_FROM_DAY);

/** Сколько грядок: новое поле beds, у старого сохранения - первая плюс more. Мусор из сохранения не берём. */
export function bedCount(state: StoreState): number {
  const g = state.garden;
  if (!g) return 0;
  const n = Number.isFinite(g.beds) ? Math.floor(g.beds!) : 1 + (Array.isArray(g.more) ? g.more.filter((b) => b && typeof b === 'object').length : 0);
  return Math.max(1, Math.min(BEDS_MAX, n));
}

/** Сколько приносит одна грядка за вечер (по помещению в Центре - и когда хозяин в Заречье, как аренда). */
export const bedIncome = (state: StoreState): number => YARD_PER_BED * (homeLevel(state) + 1);
/** Сколько двор принесёт сегодня вечером: грядки × ставка; двора нет - 0. */
export const yardIncome = (state: StoreState): number => bedCount(state) * bedIncome(state);

/**
 * Двор в сохранении: число грядок, вчера и всего. На один выпуск рядом - старые поля, по которым грядки считает код
 * до 27.11 (bedsOf: первая - since, остальные - more): при откате или со старым кэшем клиента игрок не теряет
 * купленные грядки и не видит NaN в таймерах (since 0 - «спело», урожай ему можно собрать). Новый код их не читает
 * (beds есть). Убрать since/harvests/more в следующем выпуске.
 */
export const saveGarden = (beds: number, last?: GardenState['last'], total?: number): GardenState => ({
  beds,
  ...(last ? { last } : {}),
  ...(total ? { total } : {}),
  since: 0,
  harvests: 0,
  ...(beds > 1 ? { more: BED_CROPS.slice(1, beds).map((crop) => ({ crop, since: 0 })) } : {}),
});

/** Поставить теплицу. null - рано, уже стоит, не хватает денег или мы в Заречье. */
export function buildGarden(state: StoreState): StoreState | null {
  if (hasGarden(state) || inZar(state) || state.day < GARDEN_FROM_DAY || state.money < GARDEN_PRICE) return null;
  return { ...state, money: state.money - GARDEN_PRICE, garden: saveGarden(1) };
}

export const nextBedCost = (state: StoreState): number | null => (hasGarden(state) ? (BED_COSTS[bedCount(state) - 1] ?? null) : null);

/** Вскопать ещё одну грядку. null - теплицы нет, грядок уже три, не хватает денег или мы в Заречье. */
export function addBed(state: StoreState): StoreState | null {
  const cost = nextBedCost(state);
  if (inZar(state) || !state.garden || cost === null || state.money < cost) return null;
  return { ...state, money: state.money - cost, garden: saveGarden(bedCount(state) + 1, state.garden.last, state.garden.total) };
}

/** Вечер: бабушка продала урожай - деньги в кассу до счетов (day.ts), как аренда; запоминаем «вчера» и «всего». */
export function yardNight(state: StoreState): { state: StoreState; income: number } {
  const income = yardIncome(state);
  if (!income || !state.garden) return { state, income: 0 };
  const garden = saveGarden(bedCount(state), { day: state.day, n: income }, (state.garden.total ?? 0) + income);
  return { state: { ...state, money: state.money + income, garden }, income };
}

/** Что принёс двор в прошлый вечер (null - вчера не платил) и всего: для карточки в «Развитии». */
export function yardLog(state: StoreState): { last: number; total: number } | null {
  const log = state.garden?.last;
  return log && log.day === state.day - 1 ? { last: log.n, total: state.garden?.total ?? log.n } : null;
}

/** Варенье своей марки варят из своих яблок (lines.ts поднимает спрос, меню об этом пишет): двор есть и линейка открыта. */
export const ownJam = (state: StoreState): boolean => hasGarden(state) && (state.lines?.jam ?? 0) > 0;

/**
 * Стадия грядок на картинке по ходу игрового дня (progress 0…1): утром ростки, днём кусты, к вечеру спело -
 * вечером бабушка собирает урожай и продаёт, наутро всё сначала.
 */
export const yardStage = (progress: number): number => 1 + Math.max(0, Math.min(2, Math.floor(progress * 3)));

/** Что видно в мире: сколько грядок и стадия. Изменилось - сцена перерисовывает двор. */
export const gardenLook = (state: StoreState, progress: number): string => (inZar(state) || !state.garden ? '' : `g${bedCount(state)}:${yardStage(progress)}`);
