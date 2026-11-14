// Переключатель этажей слева (14.11): какие кнопки показать (floorStops), куда ехать (stopLevel), и общая основа
// улучшений этажей (FLOOR_UPGRADES, state.floors[id].up) — её заполнят модули этажей.
import { afterEach, describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  buyFloorUp,
  FLOOR_UPGRADES,
  FLOORS,
  floorBonus,
  floorStops,
  floorUpLock,
  floorUps,
  hasFloorUp,
  STOP_ORDER,
  stopLevel,
  type FloorsState,
} from '../src/game/floors';

const shop = (level: number, floors?: FloorsState, over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level, money: 50000, debt: 0, seed: 7, floors, ...over });
const ids = (s: StoreState) => floorStops(s).map((x) => `${x.id}${x.open ? '' : `🔒${x.lock ?? ''}`}`);

describe('кнопки переключателя', () => {
  it('сверху вниз — как в лифте: третий, второй, зал, подвал', () => {
    expect(STOP_ORDER).toEqual(['third', 'second', 'hall', 'basement']);
    expect(STOP_ORDER.map(stopLevel)).toEqual([2, 1, 0, -1]);
  });

  it('до «Минимаркета» и без этажей — переключателя нет', () => {
    expect(floorStops(shop(0))).toEqual([]);
    expect(floorStops(shop(FLOORS.basement.minLevel - 1))).toEqual([]);
  });

  it('подвал уже можно открыть — зал и серый подвал (подсказка: где открыть)', () => {
    expect(ids(shop(FLOORS.basement.minLevel))).toEqual(['hall', 'basement🔒']);
  });

  it('подвал открыт — зал, подвал и серый второй этаж (замок до «Супермаркета»)', () => {
    expect(ids(shop(2, { basement: { since: 1, finish: 0 } }))).toEqual(['second🔒level', 'hall', 'basement']);
  });

  it('открыты два этажа — серый только третий; все три — без серых', () => {
    const two = shop(4, { basement: { since: 1, finish: 0 }, second: { since: 2, finish: 0 } });
    expect(ids(two)).toEqual(['third🔒', 'second', 'hall', 'basement']);
    const all = shop(4, { basement: { since: 1, finish: 0 }, second: { since: 2, finish: 0 }, third: { since: 3, finish: 0 } });
    expect(ids(all)).toEqual(['third', 'second', 'hall', 'basement']);
  });

  it('второй открыт без подвала — серый подвал внизу, третьего не видно', () => {
    expect(ids(shop(3, { second: { since: 2, finish: 0 } }))).toEqual(['second', 'hall', 'basement🔒']);
  });

  it('в Заречье переключателя нет', () => {
    expect(floorStops(shop(4, { basement: { since: 1, finish: 0 } }, { zar: { at: 'zar' } as StoreState['zar'] }))).toEqual([]);
  });
});

describe('улучшения этажей', () => {
  const before = FLOOR_UPGRADES.second.slice();
  afterEach(() => {
    FLOOR_UPGRADES.second.splice(0, FLOOR_UPGRADES.second.length, ...before);
  });
  const withUps = (): void => {
    FLOOR_UPGRADES.second.push(
      { id: 'lamps', icon: '💡', price: 1000, effect: { guests: 0.1 } },
      { id: 'chandelier', icon: '💡', price: 3000, needs: 'lamps', finish: 1, effect: { guests: 0.15, mood: 1 } },
      { id: 'escalator', icon: '🛗', price: 9000, minLevel: 5 },
    );
  };
  const open = (finish = 0, up?: string[], level = 4): StoreState => shop(level, { second: { since: 1, finish, ...(up ? { up } : {}) } });

  it('старое сохранение — ничего не куплено, бонус ноль', () => {
    withUps();
    expect(floorUps(open(), 'second')).toEqual([]);
    expect(floorBonus(open(), 'second', 'guests')).toBe(0);
  });

  it('кривое поле и чужие id не считаются', () => {
    withUps();
    expect(floorUps(shop(4, { second: { since: 1, finish: 0, up: 'lamps' as unknown as string[] } }), 'second')).toEqual([]);
    expect(floorUps(open(0, ['lamps', 'ghost', 7 as unknown as string]), 'second')).toEqual(['lamps']);
  });

  it('условия: этаж открыт, помещение, отделка, ступень раньше', () => {
    withUps();
    expect(floorUpLock(shop(4), 'second', 'lamps')).toBe('closed');
    expect(floorUpLock(open(), 'second', 'nope')).toBe('unknown');
    expect(floorUpLock(open(), 'second', 'lamps')).toBeNull();
    expect(floorUpLock(open(), 'second', 'chandelier')).toBe('finish');
    expect(floorUpLock(open(1), 'second', 'chandelier')).toBe('needs');
    expect(floorUpLock(open(1, ['lamps']), 'second', 'chandelier')).toBeNull();
    expect(floorUpLock(open(1, ['lamps']), 'second', 'lamps')).toBe('owned');
    expect(floorUpLock(open(), 'second', 'escalator')).toBe('level');
    expect(floorUpLock(open(0, [], 5), 'second', 'escalator')).toBeNull();
  });

  it('покупка: деньги списаны, улучшение в сохранении, бонусы складываются', () => {
    withUps();
    const a = buyFloorUp(open(1), 'second', 'lamps')!;
    expect(a.money).toBe(50000 - 1000);
    expect(hasFloorUp(a, 'second', 'lamps')).toBe(true);
    expect(a.floors?.second?.since).toBe(1);
    expect(a.floors?.second?.finish).toBe(1);
    const b = buyFloorUp(a, 'second', 'chandelier')!;
    expect(floorUps(b, 'second')).toEqual(['lamps', 'chandelier']);
    expect(floorBonus(b, 'second', 'guests')).toBeCloseTo(0.25);
    expect(floorBonus(b, 'second', 'mood')).toBe(1);
    expect(floorBonus(b, 'basement', 'guests')).toBe(0);
    expect(buyFloorUp(b, 'second', 'lamps')).toBeNull();
    expect(buyFloorUp({ ...open(), money: 999 }, 'second', 'lamps')).toBeNull();
  });
});
