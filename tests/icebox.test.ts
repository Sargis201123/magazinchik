import { describe, expect, it } from 'vitest';
import { iceboxRect, iceboxSpotFor, layoutFor, shelfRect } from '../src/scenes/layout';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('ларь с мороженым', () => {
  // Ларь продают с «Магазинчика» (уровень 1): в ларьке места под него нет.
  it('на любом уровне не задевает места под полки и островные витрины и стоит в зале', () => {
    for (let level = 1; level <= 4; level++) {
      const layout = layoutFor(level);
      const ice = iceboxRect(iceboxSpotFor(layout));
      for (const slot of [...layout.slots, ...layout.showcases]) expect(overlaps(ice, shelfRect(slot)), `уровень ${level}`).toBe(false);
      expect(ice.x).toBeGreaterThanOrEqual(0);
      expect(ice.x + ice.w).toBeLessThanOrEqual(layout.w);
      expect(ice.y + ice.h).toBeLessThanOrEqual(layout.h + 4);
      // И не загораживает двери во флигель.
      for (const room of [layout.warehouse, layout.bakery, layout.coffee, layout.kitchen]) {
        if (room) expect(overlaps(ice, { x: 0, y: room.doorway.y - 10, w: 24, h: 20 }), `дверь, уровень ${level}`).toBe(false);
      }
      // И не стоит в очереди к кассе.
      const q = layout.queue;
      expect(overlaps(ice, { x: q.x - 8, y: q.minY - 8, w: 16, h: q.y - q.minY + 16 }), `очередь, уровень ${level}`).toBe(false);
    }
  });
});
