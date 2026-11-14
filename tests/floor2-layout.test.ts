// Второй этаж (scenes/floors/secondLayout.ts, 14.11): люди ходят по проходам между мебелью и не проходят сквозь неё.
// Водим человечка между всеми точками этажа — лестница, стойки, стеллаж, окна, обувь, примерочные, зеркало, стол,
// уценка, касса — и проверяем каждую точку пути: нога не попала в место, занятое мебелью.
import { describe, expect, it } from 'vitest';
import { blocks, BOOTHS, RACKS, route, SPOTS, type Point, type Rect } from '../src/scenes/floors/secondLayout';

/** Полкорпуса человечка в стороны: плечом мебель не задевает. */
const HALF = 3;
const inside = (p: Point, r: Rect): boolean => p.x > r.x - HALF && p.x < r.x + r.w + HALF && p.y > r.y && p.y < r.y + r.h;

/** Все точки ломаной с шагом в полточки. */
function samples(from: Point, path: Point[]): Point[] {
  const out: Point[] = [];
  let at = from;
  for (const p of path) {
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    const n = Math.max(1, Math.ceil(d * 2));
    for (let i = 1; i <= n; i++) out.push({ x: at.x + ((p.x - at.x) * i) / n, y: at.y + ((p.y - at.y) * i) / n });
    at = p;
  }
  return out;
}

describe('раскладка второго этажа', () => {
  for (const racks of [4, 6]) {
    it(`между любыми точками — в обход мебели (${racks} стоек)`, () => {
      const spots: Point[] = [
        SPOTS.stairsTop,
        SPOTS.shelf,
        ...SPOTS.window,
        SPOTS.shoes,
        SPOTS.mirror,
        SPOTS.table,
        SPOTS.bin,
        SPOTS.till,
        ...BOOTHS.map((x) => SPOTS.booth(x)),
        ...RACKS.slice(0, racks).flatMap((r) => [SPOTS.rack(r, -6), SPOTS.rack(r, 6)]),
      ];
      const solid = blocks(racks);
      for (const a of spots) {
        for (const r of solid) expect(inside(a, r), `точка ${a.x},${a.y} внутри ${r.name}`).toBe(false);
        for (const b of spots) {
          for (const p of samples(a, route(a, b))) {
            const hit = solid.find((r) => inside(p, r));
            expect(hit?.name, `путь ${a.x},${a.y} → ${b.x},${b.y} через ${p.x.toFixed(1)},${p.y.toFixed(1)}`).toBeUndefined();
          }
        }
      }
    });
  }

  it('проход у стоек — сразу под ними, лестница выходит на нижний проход', () => {
    for (const r of RACKS) expect(SPOTS.rack(r).y - r.y).toBe(8);
    expect(route(SPOTS.stairsTop, SPOTS.till).at(-1)).toEqual(SPOTS.till);
  });
});
