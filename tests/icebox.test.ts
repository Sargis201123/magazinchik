import { describe, expect, it } from 'vitest';
import { REGISTERS_BY_LEVEL } from '../src/game/registers';
import { iceboxRect, iceboxSpotFor, layoutFor, shelfRect } from '../src/scenes/layout';
import { iceboxFits, tillMinDx, tillZones, withTill } from '../src/scenes/placement';

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('ларь с мороженым', () => {
  // Ларь продают с «Магазинчика» (уровень 1): в ларьке места под него нет.
  it('на любом уровне не задевает места под полки и островные витрины и стоит в зале', () => {
    for (let level = 1; level <= 4; level++) {
      const layout = layoutFor(level);
      const ice = iceboxRect(iceboxSpotFor(layout, REGISTERS_BY_LEVEL[level]));
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

  it('стоит у кассы вплотную к стене: не на кассах, не у входа, все кассы помещения на месте', () => {
    for (let level = 1; level <= 4; level++) {
      const layout = layoutFor(level);
      const registers = REGISTERS_BY_LEVEL[level];
      const spot = iceboxSpotFor(layout, registers);
      const ice = iceboxRect(spot);
      // Ни на одной кассе (и тех, что ещё можно купить), ни на кассе самообслуживания, ни на цветах.
      for (const zone of tillZones(layout, registers)) expect(overlaps(ice, zone), `касса, уровень ${level}`).toBe(false);
      // Не у двери: проход ко входу свободен.
      expect(overlaps(ice, { x: layout.door.x - 16, y: layout.h - 34, w: 32, h: 34 }), `вход, уровень ${level}`).toBe(false);
      // Вплотную к стене — правой или нижней (а не посреди пола), со стороны кассы от входа.
      const flush = spot.x === layout.w - 17 || spot.y === layout.h - 12;
      expect(flush, `у стены, уровень ${level}`).toBe(true);
      expect(spot.x, `у кассы, уровень ${level}`).toBeGreaterThan(layout.door.x + 16);
    }
    // С «Минимаркета» места хватает у правой стены, рядом с очередью.
    for (let level = 2; level <= 4; level++) expect(iceboxSpotFor(layoutFor(level), REGISTERS_BY_LEVEL[level]).x, `уровень ${level}`).toBe(layoutFor(level).w - 17);
  });

  it('обходит вещи, которые игрок поставил на его место (автомат у правой стены)', () => {
    for (let level = 2; level <= 4; level++) {
      const layout = layoutFor(level);
      const registers = REGISTERS_BY_LEVEL[level];
      const spot = iceboxSpotFor(layout, registers);
      const vending = { x: spot.x - 5, y: spot.y - 16, w: 10, h: 30 };
      const moved = iceboxRect(iceboxSpotFor(layout, registers, [vending]));
      expect(overlaps(moved, vending), `уровень ${level}`).toBe(false);
      expect(iceboxFits(layout, layout.slots, registers, [vending]), `уровень ${level}`).toBe(true);
    }
  });

  it('находит место и после переноса кассы и короткой очереди', () => {
    for (let level = 2; level <= 4; level++) {
      const plain = layoutFor(level);
      const registers = REGISTERS_BY_LEVEL[level];
      for (const till of [{ level, dx: tillMinDx(plain, registers) }, { level, dx: 0, short: true }]) {
        const layout = withTill(plain, till, level);
        expect(iceboxFits(layout, layout.slots, registers), `уровень ${level}, ${JSON.stringify(till)}`).toBe(true);
        const ice = iceboxRect(iceboxSpotFor(layout, registers));
        for (const zone of tillZones(layout, registers)) expect(overlaps(ice, zone), `касса, уровень ${level}`).toBe(false);
      }
    }
  });
});
