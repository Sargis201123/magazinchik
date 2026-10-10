import { describe, expect, it } from 'vitest';
import { newGame, roleOpen, STORE_LEVELS, type StaffMember, type StoreState } from '../src/game/economy';
import { bakerShouldBake, bakeryWorking, breadShelfRoom } from '../src/game/bakery';
import { coffeeWorking } from '../src/game/coffee';
import { doorY, layoutFor, shelfRect } from '../src/scenes/layout';

const baker: StaffMember = { role: 'baker', name: 0, skill: 2, wage: 380, months: 0 };
const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, level: 2, ...patch });

describe('флигель: склад, пекарня, кофейня', () => {
  it('у каждой комнаты дверь в зал там, где её не загораживают полки', () => {
    STORE_LEVELS.forEach((_, level) => {
      const L = layoutFor(level);
      expect(L.slots).toHaveLength(STORE_LEVELS[level].slots);
      // Кофейня открывается с 3-го помещения — в ларьке ей двери не нужно.
      const rooms = level >= 2 ? [L.warehouse, L.bakery, L.coffee] : [L.warehouse, L.bakery];
      for (const room of rooms) {
        expect(doorY(room, L.slots, room.doorway.y)).toBe(room.doorway.y);
        expect(room.doorway.y).toBeGreaterThan(room.y);
        expect(room.doorway.y).toBeLessThan(room.y + room.h);
      }
      // Комнаты флигеля — слева от зала и не налезают друг на друга.
      expect(L.coffee.y + L.coffee.h).toBeLessThanOrEqual(L.bakery.y);
      expect(L.bakery.y + L.bakery.h).toBeLessThanOrEqual(L.warehouse.y);
      expect(L.warehouse.x + L.warehouse.w).toBeLessThan(0);
      // Полки не налезают друг на друга.
      const rects = L.slots.map(shelfRect);
      rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(a.x + a.w <= b.x + 4 || b.x + b.w <= a.x + 4 || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true)));
    });
  });

  it('пекарь и бариста нанимаются только при открытой пекарне и кофейне', () => {
    expect(roleOpen(shop(), 'baker')).toBe(false);
    expect(roleOpen(shop({ upgrades: ['oven'] }), 'baker')).toBe(true);
    expect(roleOpen(shop(), 'barista')).toBe(false);
    expect(roleOpen(shop({ upgrades: ['coffee'] }), 'barista')).toBe(true);
  });

  it('пекарня работает с пекарем на смене; печёт, когда на хлебных полках есть место', () => {
    const s = shop({ upgrades: ['oven'], shelves: [{ kind: 'bakery', level: 1, items: {} }] });
    expect(bakeryWorking(s)).toBe(false);
    const withBaker = { ...s, staff: [baker] };
    expect(bakeryWorking(withBaker)).toBe(true);
    expect(breadShelfRoom(withBaker)).toBeGreaterThan(0);
    expect(bakerShouldBake(withBaker)).toBe(true);
    // Выходной — пекарня стоит.
    expect(bakeryWorking({ ...withBaker, staff: [{ ...baker, offDay: 20 }] })).toBe(false);
    // Полки с хлебом полны — новую закладку не ставит.
    const full = { ...withBaker, shelves: [{ kind: 'bakery' as const, level: 1, items: { bread: Array.from({ length: 99 }, () => ({ age: 0 })) } }] };
    expect(bakerShouldBake(full)).toBe(false);
    expect(coffeeWorking(withBaker)).toBe(false);
  });
});
