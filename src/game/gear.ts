// Оборудование: у всего в магазине есть модели — от простой к современной. Сам игрок выбирает только
// четыре линейки — кассу, холодильники, склад и камеры (утром во вкладке «Развитие», новая модель
// заменяет старую на всех кассах сразу). Остальное обновляется само, когда магазин переезжает в новое
// помещение (решение автора 02.11: всё оборудование вместе давало +2% денег к 100-му дню, а в начале
// съедало кассу — docs/BALANCE.md «Оборудование: само с помещением»).
// Касса пробивает быстрее и реже заедает, бак вмещает больше мусора, кофемашина варит быстрее
// и вкуснее, печь печёт больше, плита на кухне варит быстрее и в двух кастрюлях, полка «Еда» вмещает больше
// и в холоде держит готовое до утра; холодильники не текут и дольше держат свежесть, склад вмещает
// больше, вентиляторы и кондиционер — только для вида, свет — экономия, камеры отпугивают воров,
// вход и туалет — чистота, курьер доставки пересаживается с велосипеда на мопед и фургончик.
// Указатели над рядами и солнечные панели убраны 02.11 (купленное вернули монетами — migrateGear).

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import type { UpgradeId } from './upgrades';

export type GearId =
  | 'register'
  | 'fridge'
  | 'warehouse'
  | 'bin'
  | 'coffee'
  | 'oven'
  | 'stove'
  | 'foodShelf'
  | 'climate'
  | 'lights'
  | 'cameras'
  | 'entrance'
  | 'wc'
  | 'courier'
  | 'bargain';

export interface GearModel {
  nameKey: TextKey;
  /** Цена перехода на эту модель (у начальной и у тех, что встают сами, — 0). */
  price: number;
  /** С какого уровня помещения можно поставить (у линеек, что обновляются сами, — с какого встаёт сама). */
  minLevel: number;
  /** Чем модель лучше — для подписи; у тех, что встают сами, подписи нет. */
  effectKey?: TextKey;
}

export interface Gear {
  id: GearId;
  icon: string;
  nameKey: TextKey;
  /** Без чего нет смысла улучшать (кофемашину — без кофейного уголка). */
  needs?: UpgradeId;
  /** Обновляется само с помещением (models[i].minLevel — где встаёт i-я модель); не покупается. */
  auto?: true;
  models: GearModel[];
}

const model = (nameKey: TextKey, price: number, minLevel: number, effectKey: TextKey): GearModel => ({ nameKey, price, minLevel, effectKey });
/** Модель, которая встаёт сама в помещении level (индекс STORE_LEVELS). */
const free = (nameKey: TextKey, level: number): GearModel => ({ nameKey, price: 0, minLevel: level });

export const GEAR: Record<GearId, Gear> = {
  register: {
    id: 'register',
    icon: '🧾',
    nameKey: 'gear.register',
    models: [
      model('gear.register.0', 0, 0, 'gear.register.0.fx'),
      model('gear.register.1', 500, 1, 'gear.register.1.fx'),
      model('gear.register.2', 1500, 2, 'gear.register.2.fx'),
      model('gear.register.3', 4000, 3, 'gear.register.3.fx'),
    ],
  },
  fridge: {
    id: 'fridge',
    icon: '❄️',
    nameKey: 'gear.fridge',
    models: [
      model('gear.fridge.0', 0, 0, 'gear.fridge.0.fx'),
      model('gear.fridge.1', 900, 1, 'gear.fridge.1.fx'),
      model('gear.fridge.2', 2500, 2, 'gear.fridge.2.fx'),
    ],
  },
  warehouse: {
    id: 'warehouse',
    icon: '📦',
    nameKey: 'gear.warehouse',
    models: [
      model('gear.warehouse.0', 0, 0, 'gear.warehouse.0.fx'),
      model('gear.warehouse.1', 600, 1, 'gear.warehouse.1.fx'),
      model('gear.warehouse.2', 2000, 2, 'gear.warehouse.2.fx'),
      model('gear.warehouse.3', 5000, 3, 'gear.warehouse.3.fx'),
    ],
  },
  bin: {
    id: 'bin',
    icon: '🗑',
    nameKey: 'gear.bin',
    auto: true,
    models: [
      free('gear.bin.0', 0),
      free('gear.bin.1', 1),
      free('gear.bin.2', 2),
      free('gear.bin.3', 3),
    ],
  },
  coffee: {
    id: 'coffee',
    icon: '☕',
    nameKey: 'gear.coffee',
    needs: 'coffee',
    auto: true,
    models: [
      free('gear.coffee.0', 0),
      free('gear.coffee.1', 3),
      free('gear.coffee.2', 4),
    ],
  },
  oven: {
    id: 'oven',
    icon: '🥖',
    nameKey: 'gear.oven',
    needs: 'oven',
    auto: true,
    models: [
      free('gear.oven.0', 0),
      free('gear.oven.1', 2),
      free('gear.oven.2', 3),
    ],
  },
  // Плита на кухне: варит быстрее, потом — в двух кастрюлях сразу, у плиты шефа из закладки лишняя порция (kitchen.ts).
  stove: {
    id: 'stove',
    icon: '🍳',
    nameKey: 'gear.stove',
    needs: 'kitchen',
    auto: true,
    models: [
      free('gear.stove.0', 0),
      free('gear.stove.1', 4),
      free('gear.stove.2', 5),
    ],
  },
  // Полка «Еда» у входа: больше порций, холодильник держит часть готового до утра, нарядную витрину замечают (kitchen.ts).
  foodShelf: {
    id: 'foodShelf',
    icon: '🥡',
    nameKey: 'gear.foodShelf',
    needs: 'kitchen',
    auto: true,
    models: [
      free('gear.foodShelf.0', 0),
      free('gear.foodShelf.1', 4),
      free('gear.foodShelf.2', 5),
    ],
  },
  climate: {
    id: 'climate',
    icon: '🌀',
    nameKey: 'gear.climate',
    auto: true,
    models: [
      free('gear.climate.0', 0),
      free('gear.climate.1', 1),
      free('gear.climate.2', 3),
    ],
  },
  lights: {
    id: 'lights',
    icon: '💡',
    nameKey: 'gear.lights',
    auto: true,
    models: [
      free('gear.lights.0', 0),
      free('gear.lights.1', 2),
      free('gear.lights.2', 4),
    ],
  },
  cameras: {
    id: 'cameras',
    icon: '📹',
    nameKey: 'gear.cameras',
    models: [
      model('gear.cameras.0', 0, 0, 'gear.cameras.0.fx'),
      model('gear.cameras.1', 1000, 1, 'gear.cameras.1.fx'),
      model('gear.cameras.2', 1800, 2, 'gear.cameras.2.fx'),
    ],
  },
  entrance: {
    id: 'entrance',
    icon: '🚪',
    nameKey: 'gear.entrance',
    auto: true,
    models: [
      free('gear.entrance.0', 0),
      free('gear.entrance.1', 1),
      free('gear.entrance.2', 3),
    ],
  },
  wc: {
    id: 'wc',
    icon: '🚽',
    nameKey: 'gear.wc',
    auto: true,
    models: [
      free('gear.wc.0', 0),
      free('gear.wc.1', 2),
      free('gear.wc.2', 3),
    ],
  },
  // Транспорт курьера доставки на дом (delivery.ts): велосипед, мопед, фургончик.
  courier: {
    id: 'courier',
    icon: '🚲',
    nameKey: 'gear.courier',
    needs: 'delivery',
    auto: true,
    models: [
      free('gear.courier.0', 0),
      free('gear.courier.1', 4),
      free('gear.courier.2', 5),
    ],
  },
  // Полка «Уценка» (bargain.ts): горка в два ряда, в три ряда и большая металлическая в четыре — по 6 мест в ряду.
  bargain: {
    id: 'bargain',
    icon: '🏷',
    nameKey: 'gear.bargain',
    needs: 'bargain',
    auto: true,
    models: [
      free('gear.bargain.0', 0),
      free('gear.bargain.1', 2),
      free('gear.bargain.2', 3),
    ],
  },
};


/** Порядок в списке: сначала то, что влияет на торговлю, потом удобства. */
export const GEAR_IDS: GearId[] = ['register', 'fridge', 'warehouse', 'bin', 'bargain', 'coffee', 'oven', 'stove', 'foodShelf', 'courier', 'climate', 'lights', 'cameras', 'entrance', 'wc'];
/** Что игрок выбирает сам — четыре линейки (решение автора 02.11). */
export const MANUAL_GEAR: GearId[] = GEAR_IDS.filter((id) => !GEAR[id].auto);
/** Что обновляется само с помещением. */
export const AUTO_GEAR: GearId[] = GEAR_IDS.filter((id) => GEAR[id].auto);
/** Строк в блоке «Оборудование» утром: по одной на ручную линейку и одна на всё, что само (для замеров). */
export const gearRows = (): number => MANUAL_GEAR.length + 1;

/** Какая модель стоит в помещении level у линейки, что обновляется сама (у ручных — 0). */
export const autoTier = (level: number, id: GearId): number =>
  GEAR[id].auto ? GEAR[id].models.reduce((tier, m, i) => (m.minLevel <= level ? i : tier), 0) : 0;

/**
 * Какая модель стоит сейчас (номер в списке моделей): купленная или та, что встала сама с помещением, —
 * какая лучше. Купленное раньше (до 02.11 всё покупалось) никогда не откатывается назад.
 */
export const gearTier = (state: StoreState, id: GearId): number => Math.min(Math.max(state.gear?.[id] ?? 0, autoTier(state.level, id)), GEAR[id].models.length - 1);

/** Следующая модель (null — уже лучшая). */
export const nextGear = (state: StoreState, id: GearId): GearModel | null => GEAR[id].models[gearTier(state, id) + 1] ?? null;

/** Можно ли сейчас поставить следующую модель (без учёта денег). То, что обновляется само, не покупается. */
export function gearAvailable(state: StoreState, id: GearId): boolean {
  const next = nextGear(state, id);
  const needs = GEAR[id].needs;
  return !GEAR[id].auto && Boolean(next) && state.level >= next!.minLevel && (!needs || (state.upgrades ?? []).includes(needs));
}

export function upgradeGear(state: StoreState, id: GearId): StoreState | null {
  const next = nextGear(state, id);
  if (!next || !gearAvailable(state, id) || state.money < next.price) return null;
  return { ...state, money: state.money - next.price, gear: { ...state.gear, [id]: gearTier(state, id) + 1 } };
}

/** Что встанет само при переезде в помещение level: линейки, у которых там модель лучше нынешней. */
export function gearArriving(state: StoreState, level: number): { id: GearId; model: GearModel }[] {
  return AUTO_GEAR.filter((id) => !GEAR[id].needs || (state.upgrades ?? []).includes(GEAR[id].needs!))
    .filter((id) => autoTier(level, id) > gearTier(state, id))
    .map((id) => ({ id, model: GEAR[id].models[autoTier(level, id)] }));
}

/** Убранные 02.11 линейки (указатели, солнечные панели): во сколько монет обходились купленные модели. */
const REMOVED_GEAR: Record<string, number[]> = { signage: [0, 600, 2500], solar: [0, 2500, 6000] };
/** Убранное 02.11 улучшение «Тележки» (upgrades.ts): его цена. Носить по 12 штук теперь умеет склад с рохлей. */
const REMOVED_CART = 700;

type GearSlice = Pick<StoreState, 'gear' | 'upgrades'>;

/** Одна лавка: сколько вернуть монетами и что остаётся (null — возвращать нечего). */
function stripRemoved(shop: Partial<GearSlice>): { refund: number; gear?: StoreState['gear']; upgrades?: StoreState['upgrades'] } | null {
  const gear = shop.gear as Record<string, number> | undefined;
  const upgrades = (shop.upgrades ?? []) as string[];
  const oldGear = Boolean(gear) && Object.keys(REMOVED_GEAR).some((id) => id in gear!);
  const oldCart = upgrades.includes('cart');
  if (!oldGear && !oldCart) return null;
  let refund = oldCart ? REMOVED_CART : 0;
  const rest: Record<string, number> = { ...gear };
  for (const [id, prices] of Object.entries(REMOVED_GEAR)) {
    const tier = Math.min(Math.max(0, Math.floor(Number(rest[id]) || 0)), prices.length - 1);
    refund += prices.slice(1, tier + 1).reduce((a, b) => a + b, 0);
    delete rest[id];
  }
  return {
    refund,
    gear: gear ? (rest as StoreState['gear']) : shop.gear,
    upgrades: shop.upgrades ? (upgrades.filter((id) => id !== 'cart') as StoreState['upgrades']) : shop.upgrades,
  };
}

/**
 * Старое сохранение (до 02.11): за указатели, солнечные панели и тележки — монеты назад (сумма всех
 * купленных ступеней), сами записи убираем — в обеих лавках, если открыто Заречье (у него своё оборудование,
 * zarechye.ts SHOP_KEYS). Остальное купленное остаётся как есть и считается своим (gearTier).
 * Повторно ничего не возвращает: записей уже нет.
 */
export function migrateGear(state: StoreState): StoreState {
  const here = stripRemoved(state);
  const away = state.zar ? stripRemoved(state.zar.away) : null;
  if (!here && !away) return state;
  let next: StoreState = { ...state, money: state.money + (here?.refund ?? 0) + (away?.refund ?? 0) };
  if (here) next = { ...next, gear: here.gear, upgrades: here.upgrades };
  if (away && state.zar) next = { ...next, zar: { ...state.zar, away: { ...state.zar.away, gear: away.gear, upgrades: away.upgrades } } };
  return next;
}

/** Касса: во сколько раз дольше пробивается товар (оплата — отдельно, её ускоряет терминал). */
export const REGISTER_SCAN = [1, 0.85, 0.72, 0.6];
export const registerScan = (state: StoreState): number => REGISTER_SCAN[gearTier(state, 'register')];
/** Картинка кассы для текущей модели. */
export const registerSprite = (state: StoreState): string => `counter${gearTier(state, 'register')}`;

/** Мусорка: сколько мешков-порций мусора помещается. */
export const BIN_CAPACITY = [5, 8, 12, 18];
export const binCapacity = (state: StoreState): number => BIN_CAPACITY[gearTier(state, 'bin')];

/** Кофемашина: сколько секунд варит стаканчик и почём кофе. */
export const COFFEE_BREW = [2.2, 1.6, 1.1];
export const COFFEE_PRICES = [35, 42, 50];
export const brewSeconds = (state: StoreState): number => COFFEE_BREW[gearTier(state, 'coffee')];
export const coffeePrice = (state: StoreState): number => COFFEE_PRICES[gearTier(state, 'coffee')];

/**
 * Печь: буханок в закладке и сколько секунд печётся. Мука — 12 монет на буханку: при 10 печь с маркой окупалась
 * слишком быстро, при 15 печь без марки уходила в минус (решение автора 31.10 — небольшой плюс и без марки).
 */
export const OVEN_BATCHES = [6, 9, 12];
export const OVEN_BAKES = [14, 12, 10];
export const FLOUR_PER_LOAF = 12;
export const ovenBatch = (state: StoreState): number => OVEN_BATCHES[gearTier(state, 'oven')];
export const ovenBake = (state: StoreState): number => OVEN_BAKES[gearTier(state, 'oven')];
export const ovenBatchCost = (state: StoreState): number => ovenBatch(state) * FLOUR_PER_LOAF;

/** Картинки остального оборудования: у начальной модели — прежнее имя. */
export const coffeeSprite = (state: StoreState): string => (gearTier(state, 'coffee') ? `coffee_machine${gearTier(state, 'coffee')}` : 'coffee_machine');
export const ovenSprite = (state: StoreState): string => (gearTier(state, 'oven') ? `oven${gearTier(state, 'oven')}` : 'oven');
/** Мусорка с наполнением 0–3. */
export const binSprite = (state: StoreState, fill: number): string => (gearTier(state, 'bin') ? `bin_t${gearTier(state, 'bin')}_${fill}` : `bin${fill}`);

// ---------- Поломки старых моделей ----------

/** Касса заедает: шанс на покупателя и сколько секунд её чинить. У смарт-кассы — никогда. */
export const REGISTER_JAM = [0.06, 0.03, 0.01, 0];
export const REGISTER_JAM_SECONDS = 2.5;
export const registerJam = (state: StoreState): number => REGISTER_JAM[gearTier(state, 'register')];
/** Старые холодильники иногда подтекают: шанс за день — лужа у холодильника. */
export const FRIDGE_LEAK = [0.3, 0, 0];
export const fridgeLeak = (state: StoreState): number => FRIDGE_LEAK[gearTier(state, 'fridge')];

// ---------- Холодильники ----------

/** Сколько дней свежести добавляют холодильники молочке и мясу. */
export const FRIDGE_LIFE = [0, 1, 2];
export const fridgeLife = (state: StoreState): number => FRIDGE_LIFE[gearTier(state, 'fridge')];
/** Доля счёта за свет, которую едят холодильники этой модели. */
export const FRIDGE_POWER_SHARE = [1, 0.85, 0.6];
export const fridgePower = (state: StoreState): number => FRIDGE_POWER_SHARE[gearTier(state, 'fridge')];

// ---------- Склад ----------

/** Склад вмещает больше, грузчик носит быстрее; с рохлей за раз несут вдвое больше (раньше — улучшение «Тележки»). */
export const WAREHOUSE_ROOM = [1, 1.2, 1.4, 1.6];
export const WAREHOUSE_SPEED = [1, 1.15, 1.3, 1.5];
export const warehouseRoom = (state: StoreState): number => WAREHOUSE_ROOM[gearTier(state, 'warehouse')];
export const warehouseSpeed = (state: StoreState): number => WAREHOUSE_SPEED[gearTier(state, 'warehouse')];

// ---------- Свет ----------

/** LED экономит свет в зале, неон с экраном на фасаде ещё и зазывает гостей. */
export const LIGHTS_POWER = [1, 0.7, 0.7];
export const LIGHTS_GUESTS = [1, 1, 1.05];
export const lightsPower = (state: StoreState): number => LIGHTS_POWER[gearTier(state, 'lights')];
export const lightsGuests = (state: StoreState): number => LIGHTS_GUESTS[gearTier(state, 'lights')];

// ---------- Камеры, вход, туалет ----------

/** Во сколько раз реже заходят воры. */
export const CAMERA_THEFT = [1, 0.7, 0.45];
export const cameraTheft = (state: StoreState): number => CAMERA_THEFT[gearTier(state, 'cameras')];
/** Во сколько раз меньше грязи с улицы в дождь и снег. */
export const ENTRANCE_MUD = [1, 0.5, 0.2];
export const entranceMud = (state: StoreState): number => ENTRANCE_MUD[gearTier(state, 'entrance')];
/** Во сколько раз медленнее пачкается туалет. */
export const WC_DIRT = [1, 0.6, 0.25];
export const wcDirt = (state: StoreState): number => WC_DIRT[gearTier(state, 'wc')];

// Полка «Уценка»: рядов на горке и картинка модели (art/bargain_shelf.py). Мест — по 6 в ряду (bargain.ts).
export const BARGAIN_ROWS = [2, 3, 4];
export const bargainRows = (state: StoreState): number => BARGAIN_ROWS[gearTier(state, 'bargain')];
export const bargainSprite = (state: StoreState): string => `bargain_shelf${gearTier(state, 'bargain')}`;

/** Сколько новых моделей поставил сам игрок (для достижений): только ручные линейки, «само» не в счёт. */
export const gearUpgrades = (state: StoreState): number => MANUAL_GEAR.reduce((sum, id) => sum + gearTier(state, id), 0);
/** Всё, что игрок выбирает сам, — лучших моделей. */
export const gearMaxed = (state: StoreState): boolean => MANUAL_GEAR.every((id) => !nextGear(state, id));
