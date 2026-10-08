// Оборудование: у кассы, мусорки, кофемашины и печи есть модели — от простой к современной.
// Новую модель покупают утром во вкладке «Магазин»; она заменяет старую (на всех кассах сразу).
// Касса пробивает быстрее, бак вмещает больше мусора, кофемашина варит быстрее и вкуснее
// (кофе дороже), печь печёт больше и быстрее.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import type { UpgradeId } from './upgrades';

export type GearId = 'register' | 'bin' | 'coffee' | 'oven';

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
      model('gear.register.1', 700, 1, 'gear.register.1.fx'),
      model('gear.register.2', 2200, 2, 'gear.register.2.fx'),
      model('gear.register.3', 5500, 3, 'gear.register.3.fx'),
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
};

export const GEAR_IDS = Object.keys(GEAR) as GearId[];

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
