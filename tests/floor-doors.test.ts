import { describe, expect, it, vi } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { FLOORS, type FloorId } from '../src/game/floors';
import { layoutFor } from '../src/scenes/layout';
import type { StoreScene } from '../src/scenes/StoreScene';

// Phaser в тестах не нужен: двери этажей считаются из планировки и состояния (floorDoors.ts — без сцен).
vi.mock('phaser', () => ({ default: {} }));
const { DUMP_X, floorDoorSpans, hatchSpot, liftSpot, stairsSpot } = await import('../src/scenes/floorDoors');

// 14.11, аудит: двери этажей в фасаде — лифт фудкорта не за мусорным контейнером, двери не друг на друге, а места
// перед ними (floorDoorSpans) закрывают и сами двери, и таблички — их обходят тележка Кости, стойка и торговец.

const withFloors = (level: number): StoreState => {
  const s = newGame();
  const floors = Object.fromEntries((Object.keys(FLOORS) as FloorId[]).filter((id) => FLOORS[id].minLevel <= level).map((id) => [id, { since: 1, finish: 0 }]));
  return { ...s, level, day: 60, floors };
};
const sceneAt = (level: number): StoreScene => ({ layout: layoutFor(level), state: withFloors(level) }) as unknown as StoreScene;

describe('двери этажей в фасаде', () => {
  const levels = STORE_LEVELS.map((_, i) => i).filter((i) => i >= FLOORS.basement.minLevel);

  it('лифт фудкорта — не за мусорным контейнером: едоки идут к нему мимо бака', () => {
    for (const level of levels.filter((i) => i >= FLOORS.third.minLevel)) {
      const lift = liftSpot(sceneAt(level)).x;
      // Контейнер — 24 точки шириной, лифт — 12: между ними не меньше пары точек.
      expect(lift - 6, `уровень ${level}`).toBeGreaterThanOrEqual(DUMP_X + 12 - 2);
    }
  });

  it('двери не стоят друг на друге и не у самого входа', () => {
    for (const level of levels) {
      const scene = sceneAt(level);
      const door = scene.layout.door.x;
      const xs = [hatchSpot(scene).x, ...(level >= FLOORS.second.minLevel ? [stairsSpot(scene).x] : []), ...(level >= FLOORS.third.minLevel ? [liftSpot(scene).x] : [])];
      for (const x of xs) expect(Math.abs(x - door), `уровень ${level}`).toBeGreaterThan(28);
      for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) expect(Math.abs(xs[i] - xs[j]), `уровень ${level}`).toBeGreaterThan(28);
    }
  });

  it('места перед дверями закрывают двери и таблички; в Заречье их нет', () => {
    for (const level of levels) {
      const scene = sceneAt(level);
      const d = scene.layout.door.x;
      const spans = floorDoorSpans(scene);
      const covered = (a: number, b: number) => spans.some(([x0, x1]) => x0 <= a - d && x1 >= b - d);
      const hatch = hatchSpot(scene).x;
      // Спуск ±6 и табличка слева от него (до 26 точек, отступ 7).
      expect(covered(hatch - 33, hatch + 6), `уровень ${level}`).toBe(true);
      if (level >= FLOORS.second.minLevel) expect(covered(stairsSpot(scene).x - 13, stairsSpot(scene).x + 13)).toBe(true);
      if (level >= FLOORS.third.minLevel) expect(covered(liftSpot(scene).x - 13, liftSpot(scene).x + 13)).toBe(true);
    }
    const zar = { layout: layoutFor(4), state: { ...withFloors(4), zar: { at: 'zar' } } } as unknown as StoreScene;
    expect(floorDoorSpans(zar)).toEqual([]);
  });
});
