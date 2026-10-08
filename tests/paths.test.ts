import { describe, expect, it } from 'vitest';
import { crosses, findPath, type Rect } from '../src/scenes/paths';

const box: Rect = { x: 10, y: 10, w: 20, h: 10 };

describe('paths', () => {
  it('отрезок сквозь прямоугольник пересекает, мимо и по краю — нет', () => {
    expect(crosses({ x: 0, y: 15 }, { x: 40, y: 15 }, box)).toBe(true);
    expect(crosses({ x: 0, y: 5 }, { x: 40, y: 5 }, box)).toBe(false);
    expect(crosses({ x: 0, y: 10 }, { x: 40, y: 10 }, box)).toBe(false);
  });

  it('свободный путь — сразу к цели', () => {
    expect(findPath({ x: 0, y: 0 }, { x: 5, y: 30 }, [box])).toEqual([{ x: 5, y: 30 }]);
  });

  it('обходит препятствие через углы, и каждый отрезок свободен', () => {
    const from = { x: 20, y: 0 };
    const to = { x: 20, y: 30 };
    const path = findPath(from, to, [box]);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(to);
    let a = from;
    for (const b of path) {
      expect(crosses(a, b, box)).toBe(false);
      a = b;
    }
  });

  it('из препятствия можно выйти, а замурованная цель — напрямик', () => {
    expect(findPath({ x: 20, y: 15 }, { x: 20, y: 40 }, [box])).toEqual([{ x: 20, y: 40 }]);
    const walls: Rect[] = [
      { x: -10, y: -10, w: 60, h: 5 },
      { x: -10, y: 35, w: 60, h: 5 },
      { x: -10, y: -10, w: 5, h: 50 },
      { x: 45, y: -10, w: 5, h: 50 },
    ];
    expect(findPath({ x: 100, y: 100 }, { x: 20, y: 25 }, walls)).toEqual([{ x: 20, y: 25 }]);
  });
});
