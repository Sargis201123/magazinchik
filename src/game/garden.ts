// «Бабушкина теплица»: растёт по настоящему времени — и пока игрока нет в игре. Вернулся — урожай созрел:
// яблоки и картофель бесплатно на склад, и рассада сразу посажена заново. Это повод зайти ещё раз сегодня или
// завтра, который видно в мире (scenes/gardenFx.ts), в «Главном на сегодня» и в «Развитии» (ui/garden.ts).
// Время приходит снаружи (now): правила не читают часы сами — так их можно проверить тестом.
//
// 10.11 (третий обход): теплица стоит во дворе слева от магазина, за складом, — раньше в тесных помещениях она
// уезжала в парк за дорогой, и её не находили. Во дворе до трёх грядок, у каждой своя культура и свои часы:
// картошка поспевает за два часа, яблоки с картошкой — за шесть, яблони — за двенадцать (больше всего за раз).
// Друг в гостях может полить — урожай на час ближе. Варенье своей марки пару дней варят «из своих яблок».

import { buyStock, sellableProducts, warehouseCapacity, warehouseCount, type ProductId, type StoreState } from './economy';
import { inZar } from './zarshop';

export type CropId = 'quick' | 'mix' | 'apples';
export const CROP_IDS: CropId[] = ['quick', 'mix', 'apples'];

export interface Crop {
  icon: string;
  /** Сколько зреет, часов настоящего времени. */
  hours: number;
  /** Что даёт и сколько: base + perLevel × уровень помещения — каждого вида. */
  gives: ProductId[];
  base: number;
  perLevel: number;
}

/**
 * Культуры. За час все дают примерно поровну; короткая — тому, кто заглядывает часто, длинная — тому, кто заходит
 * раз в день: за один заход с неё больше всего. Товары — те, что на овощном прилавке с первого дня.
 */
export const CROPS: Record<CropId, Crop> = {
  quick: { icon: '🥔', hours: 2, gives: ['potatoes'], base: 4, perLevel: 2 },
  mix: { icon: '🍎', hours: 6, gives: ['apples', 'potatoes'], base: 6, perLevel: 3 },
  apples: { icon: '🌳', hours: 12, gives: ['apples'], base: 14, perLevel: 7 },
};

export interface Bed {
  crop: CropId;
  /** Когда посажена нынешняя рассада (мс по часам игрока). */
  since: number;
}

export interface GardenState {
  /** Первая грядка: когда посажена (мс по часам игрока) и что на ней (нет — «яблоки и картошка», как было). */
  since: number;
  crop?: CropId;
  /** Сколько урожаев собрано за всё время. */
  harvests: number;
  /** Вторая и третья грядки. */
  more?: Bed[];
  /** До какого игрового дня варенье своей марки — «из своих яблок» (после сбора яблок). */
  own?: number;
  /** Сколько раз друзья полили теплицу. */
  watered?: number;
}

/** Рассаду бабушка присылает на третий день: первые два новичок учится торговать. */
export const GARDEN_FROM_DAY = 3;
export const GARDEN_PRICE = 150;
/** Урожай «как раньше» зреет шесть часов: успевает и к вечеру того же дня, и к завтрашнему утру. */
export const GROW_MS = 6 * 3600_000;
/** Что растёт на грядке по умолчанию: то, что есть на овощном прилавке с первого дня. */
export const GARDEN_CROPS: ProductId[] = CROPS.mix.gives;
/** Вторая и третья грядки: цена. */
export const BED_COSTS = [600, 1500];
export const BEDS_MAX = BED_COSTS.length + 1;
/** Полив друга: урожай на столько ближе. */
export const WATER_MS = 3600_000;
/** Сколько игровых дней после сбора яблок варенье — «из своих яблок», и на сколько охотнее его берут (lines.ts). */
export const OWN_JAM_DAYS = 2;
export const OWN_JAM_DEMAND = 1.2;

export const hasGarden = (state: StoreState): boolean => Boolean(state.garden);
/** Раздел виден в Центре: с третьего дня или если теплица уже стоит. */
export const gardenVisible = (state: StoreState): boolean => !inZar(state) && (hasGarden(state) || state.day >= GARDEN_FROM_DAY);

const isCrop = (id: unknown): id is CropId => typeof id === 'string' && id in CROPS;

/** Грядки по порядку: первая — из старых полей (since, crop), остальные — more. Мусор из сохранения не берём. */
export function bedsOf(state: StoreState): Bed[] {
  const g = state.garden;
  if (!g) return [];
  const more = (Array.isArray(g.more) ? g.more : []).filter((b) => b && isCrop(b.crop) && Number.isFinite(b.since)).slice(0, BEDS_MAX - 1);
  return [{ crop: isCrop(g.crop) ? g.crop : 'mix', since: g.since }, ...more];
}

const withBeds = (g: GardenState, beds: Bed[]): GardenState => {
  const [first, ...more] = beds;
  const next: GardenState = { ...g, since: first.since };
  if (first.crop === 'mix') delete next.crop;
  else next.crop = first.crop;
  if (more.length) next.more = more;
  else delete next.more;
  return next;
};

export const growMs = (crop: CropId): number => CROPS[crop].hours * 3600_000;

/** Поставить теплицу. null — рано, уже стоит, не хватает денег или мы в Заречье. */
export function buildGarden(state: StoreState, now: number): StoreState | null {
  if (hasGarden(state) || inZar(state) || state.day < GARDEN_FROM_DAY || state.money < GARDEN_PRICE) return null;
  return { ...state, money: state.money - GARDEN_PRICE, garden: { since: now, harvests: 0 } };
}

/** Насколько выросла грядка: 0…1. Часы перевели назад — рост не уходит в минус. */
export const bedProgress = (bed: Bed, now: number): number => Math.min(1, Math.max(0, (now - bed.since) / growMs(bed.crop)));
export const bedRipe = (bed: Bed, now: number): boolean => bedProgress(bed, now) >= 1;
/** Стадия для картинки: 0 — только посадили, 1 — ростки, 2 — кусты, 3 — созрело. */
export const bedStage = (bed: Bed, now: number): number => (bedRipe(bed, now) ? 3 : Math.min(2, Math.floor(bedProgress(bed, now) * 3)));
export const bedLeft = (bed: Bed, now: number): number => Math.max(0, bed.since + growMs(bed.crop) - now);

/** Самая спелая грядка — по ней значок в мире и строка в меню. */
export const gardenProgress = (state: StoreState, now: number): number => bedsOf(state).reduce((best, bed) => Math.max(best, bedProgress(bed, now)), 0);
/** Есть что собрать: созрела хотя бы одна грядка. */
export const gardenRipe = (state: StoreState, now: number): boolean => bedsOf(state).some((bed) => bedRipe(bed, now));
export const gardenStage = (state: StoreState, now: number): number => bedsOf(state).reduce((best, bed) => Math.max(best, bedStage(bed, now)), 0);
/** Сколько осталось до ближайшего урожая, мс (0 — уже созрел или теплицы нет). */
export const gardenLeft = (state: StoreState, now: number): number => {
  const beds = bedsOf(state);
  return beds.length ? Math.min(...beds.map((bed) => bedLeft(bed, now))) : 0;
};
/** Когда поспеет ближайшая грядка (мс по часам игрока; уже спелая — её время): для напоминания бота. 0 — теплицы нет. */
export const gardenRipeAt = (state: StoreState): number => {
  const beds = bedsOf(state);
  return beds.length ? Math.min(...beds.map((bed) => bed.since + growMs(bed.crop))) : 0;
};

/** Урожай с грядки каждого вида: в большом магазине теплица больше. */
export const cropQty = (state: StoreState, crop: CropId = 'mix'): number => CROPS[crop].base + CROPS[crop].perLevel * state.level;

/** Сменить культуру на грядке: рассада сажается заново. null — нет такой грядки или культура та же. */
export function plant(state: StoreState, index: number, crop: CropId, now: number): StoreState | null {
  const beds = bedsOf(state);
  if (inZar(state) || !state.garden || !beds[index] || beds[index].crop === crop) return null;
  return { ...state, garden: withBeds(state.garden, beds.map((bed, i) => (i === index ? { crop, since: now } : bed))) };
}

export const nextBedCost = (state: StoreState): number | null => (hasGarden(state) ? (BED_COSTS[bedsOf(state).length - 1] ?? null) : null);

/** Вскопать ещё одну грядку. null — теплицы нет, грядок уже три или не хватает денег. */
export function addBed(state: StoreState, now: number): StoreState | null {
  const cost = nextBedCost(state);
  if (inZar(state) || !state.garden || cost === null || state.money < cost) return null;
  return { ...state, money: state.money - cost, garden: withBeds(state.garden, [...bedsOf(state), { crop: 'quick', since: now }]) };
}

/** Друг полил: все грядки, что ещё растут, на час ближе к урожаю. null — поливать нечего. */
export function water(state: StoreState, now: number, times = 1): StoreState | null {
  if (!state.garden || times <= 0) return null;
  const beds = bedsOf(state);
  if (beds.every((bed) => bedRipe(bed, now))) return null;
  const next = beds.map((bed) => (bedRipe(bed, now) ? bed : { ...bed, since: bed.since - WATER_MS * times }));
  return { ...state, garden: { ...withBeds(state.garden, next), watered: (state.garden.watered ?? 0) + times } };
}

/** Варенье своей марки сейчас варят из своих яблок (lines.ts поднимает спрос, меню об этом пишет). */
export const ownJam = (state: StoreState): boolean => (state.garden?.own ?? 0) >= state.day && (state.lines?.jam ?? 0) > 0;

/**
 * Собрать урожай со всех спелых грядок: сколько влезет на склад, бесплатно; рассада сажается заново.
 * null — ничего не созрело, мы в Заречье или на складе нет ни одного места (урожай подождёт).
 */
export function harvest(state: StoreState, now: number): { state: StoreState; got: { id: ProductId; qty: number }[] } | null {
  if (inZar(state) || !state.garden || !gardenRipe(state, now)) return null;
  const sell = sellableProducts(state);
  let next = state;
  const got: { id: ProductId; qty: number }[] = [];
  const beds = bedsOf(state).map((bed) => {
    if (!bedRipe(bed, now)) return bed;
    let took = false;
    for (const id of CROPS[bed.crop].gives.filter((crop) => sell.includes(crop))) {
      const qty = Math.min(cropQty(state, bed.crop), warehouseCapacity(next) - warehouseCount(next));
      const stocked = qty > 0 ? buyStock(next, id, qty, 0) : null;
      if (!stocked) continue;
      next = stocked;
      took = true;
      const same = got.find((g) => g.id === id);
      if (same) same.qty += qty;
      else got.push({ id, qty });
    }
    return took ? { ...bed, since: now } : bed;
  });
  if (!got.length) return null;
  const garden: GardenState = { ...withBeds(state.garden, beds), harvests: state.garden.harvests + 1 };
  if (got.some((g) => g.id === 'apples')) garden.own = state.day + OWN_JAM_DAYS - 1;
  return { state: { ...next, garden }, got };
}

/** Что видно в мире: грядки, их культуры и стадии. Изменилось — сцена перерисовывает двор. */
export const gardenLook = (state: StoreState, now: number): string =>
  inZar(state) || !state.garden
    ? ''
    : `g${bedsOf(state)
        .map((bed) => `${bed.crop[0]}${bedStage(bed, now)}`)
        .join('')}`;
