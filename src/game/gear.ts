// Оборудование: у всего в магазине есть модели — от простой к современной. Новую модель покупают
// утром во вкладке «Магазин»; она заменяет старую (на всех кассах сразу).
// Касса пробивает быстрее и реже заедает, бак вмещает больше мусора, кофемашина варит быстрее
// и вкуснее, печь печёт больше; холодильники не текут и дольше держат свежесть, склад вмещает
// больше, климат и свет — уют и экономия, камеры отпугивают воров, вход и туалет — чистота.

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
  | 'climate'
  | 'lights'
  | 'cameras'
  | 'entrance'
  | 'wc';

export interface GearModel {
  nameKey: TextKey;
  /** Цена перехода на эту модель (у начальной — 0). */
  price: number;
  /** С какого уровня помещения можно поставить. */
  minLevel: number;
  /** Чем модель лучше — для подписи (подставляется в effectKey). */
  effectKey: TextKey;
}

export interface Gear {
  id: GearId;
  icon: string;
  nameKey: TextKey;
  /** Без чего нет смысла улучшать (кофемашину — без кофейного уголка). */
  needs?: UpgradeId;
  models: GearModel[];
}

const model = (nameKey: TextKey, price: number, minLevel: number, effectKey: TextKey): GearModel => ({ nameKey, price, minLevel, effectKey });

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
    models: [
      model('gear.bin.0', 0, 0, 'gear.bin.0.fx'),
      model('gear.bin.1', 250, 0, 'gear.bin.1.fx'),
      model('gear.bin.2', 800, 1, 'gear.bin.2.fx'),
      model('gear.bin.3', 2000, 2, 'gear.bin.3.fx'),
    ],
  },
  coffee: {
    id: 'coffee',
    icon: '☕',
    nameKey: 'gear.coffee',
    needs: 'coffee',
    models: [
      model('gear.coffee.0', 0, 0, 'gear.coffee.0.fx'),
      model('gear.coffee.1', 1200, 2, 'gear.coffee.1.fx'),
      model('gear.coffee.2', 3000, 3, 'gear.coffee.2.fx'),
    ],
  },
  oven: {
    id: 'oven',
    icon: '🥖',
    nameKey: 'gear.oven',
    needs: 'oven',
    models: [
      model('gear.oven.0', 0, 0, 'gear.oven.0.fx'),
      model('gear.oven.1', 1400, 1, 'gear.oven.1.fx'),
      model('gear.oven.2', 3500, 3, 'gear.oven.2.fx'),
    ],
  },
  climate: {
    id: 'climate',
    icon: '🌀',
    nameKey: 'gear.climate',
    models: [
      model('gear.climate.0', 0, 0, 'gear.climate.0.fx'),
      model('gear.climate.1', 400, 0, 'gear.climate.1.fx'),
      model('gear.climate.2', 2000, 2, 'gear.climate.2.fx'),
    ],
  },
  lights: {
    id: 'lights',
    icon: '💡',
    nameKey: 'gear.lights',
    models: [
      model('gear.lights.0', 0, 0, 'gear.lights.0.fx'),
      model('gear.lights.1', 600, 1, 'gear.lights.1.fx'),
      model('gear.lights.2', 3000, 3, 'gear.lights.2.fx'),
    ],
  },
  cameras: {
    id: 'cameras',
    icon: '📹',
    nameKey: 'gear.cameras',
    models: [
      model('gear.cameras.0', 0, 0, 'gear.cameras.0.fx'),
      model('gear.cameras.1', 500, 1, 'gear.cameras.1.fx'),
      model('gear.cameras.2', 1800, 2, 'gear.cameras.2.fx'),
    ],
  },
  entrance: {
    id: 'entrance',
    icon: '🚪',
    nameKey: 'gear.entrance',
    models: [
      model('gear.entrance.0', 0, 0, 'gear.entrance.0.fx'),
      model('gear.entrance.1', 300, 0, 'gear.entrance.1.fx'),
      model('gear.entrance.2', 1500, 2, 'gear.entrance.2.fx'),
    ],
  },
  wc: {
    id: 'wc',
    icon: '🚽',
    nameKey: 'gear.wc',
    models: [
      model('gear.wc.0', 0, 0, 'gear.wc.0.fx'),
      model('gear.wc.1', 500, 1, 'gear.wc.1.fx'),
      model('gear.wc.2', 2000, 2, 'gear.wc.2.fx'),
    ],
  },
};


/** Порядок в списке: сначала то, что влияет на торговлю, потом удобства. */
export const GEAR_IDS: GearId[] = ['register', 'fridge', 'warehouse', 'bin', 'coffee', 'oven', 'climate', 'lights', 'cameras', 'entrance', 'wc'];

/** Какая модель стоит сейчас (номер в списке моделей). */
export const gearTier = (state: StoreState, id: GearId): number => Math.min(state.gear?.[id] ?? 0, GEAR[id].models.length - 1);

/** Следующая модель (null — уже лучшая). */
export const nextGear = (state: StoreState, id: GearId): GearModel | null => GEAR[id].models[gearTier(state, id) + 1] ?? null;

/** Можно ли сейчас поставить следующую модель (без учёта денег). */
export function gearAvailable(state: StoreState, id: GearId): boolean {
  const next = nextGear(state, id);
  const needs = GEAR[id].needs;
  return Boolean(next) && state.level >= next!.minLevel && (!needs || (state.upgrades ?? []).includes(needs));
}

export function upgradeGear(state: StoreState, id: GearId): StoreState | null {
  const next = nextGear(state, id);
  if (!next || !gearAvailable(state, id) || state.money < next.price) return null;
  return { ...state, money: state.money - next.price, gear: { ...state.gear, [id]: gearTier(state, id) + 1 } };
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

/** Печь: буханок в закладке и сколько секунд печётся. Мука — 10 монет на буханку. */
export const OVEN_BATCHES = [6, 9, 12];
export const OVEN_BAKES = [14, 12, 10];
export const FLOUR_PER_LOAF = 10;
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

/** Склад вмещает больше, грузчик носит быстрее. */
export const WAREHOUSE_ROOM = [1, 1.2, 1.4, 1.6];
export const WAREHOUSE_SPEED = [1, 1.15, 1.3, 1.5];
export const warehouseRoom = (state: StoreState): number => WAREHOUSE_ROOM[gearTier(state, 'warehouse')];
export const warehouseSpeed = (state: StoreState): number => WAREHOUSE_SPEED[gearTier(state, 'warehouse')];

// ---------- Климат ----------

/**
 * Насколько дольше ждут в очереди. Без ничего в жару и мороз ждут меньше; вентиляторы спасают
 * от жары, но не от холода; кондиционер с обогревом — всегда уютно.
 */
export function climatePatience(state: StoreState, weather: string): number {
  const extreme = weather === 'heat' ? 'heat' : weather === 'snow' ? 'cold' : null;
  switch (gearTier(state, 'climate')) {
    case 0:
      return extreme ? 0.75 : 1;
    case 1:
      return extreme === 'cold' ? 0.75 : 1;
    default:
      return 1.1;
  }
}

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

/** Сколько всего новых моделей поставлено (для достижений). */
export const gearUpgrades = (state: StoreState): number => GEAR_IDS.reduce((sum, id) => sum + gearTier(state, id), 0);
/** Всё оборудование — лучших моделей. */
export const gearMaxed = (state: StoreState): boolean => GEAR_IDS.every((id) => !nextGear(state, id));
