import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/scenes/layout';
import { keepPlaces, slotIssues, withSlots } from '../src/scenes/placement';
import { newGame, placeStored, storeShelf, type Shelf, type StoreState } from '../src/game/economy';

describe('своя расстановка полок', () => {
  it('стандартная расстановка на всех уровнях правильная', () => {
    for (let level = 0; level <= 4; level++) {
      const layout = layoutFor(level);
      expect([...slotIssues(layout, layout.slots)], `уровень ${level}`).toEqual([]);
    }
  });

  it('полку можно поставить вплотную к соседней сбоку', () => {
    const layout = layoutFor(2);
    const slots = layout.slots.map((s) => ({ ...s }));
    // Последнюю полку — вплотную справа к предпоследней (ширина мебели 44).
    const a = slots[slots.length - 2];
    slots[slots.length - 1] = { x: a.x + 44, y: a.y };
    expect(slotIssues(layout, slots).has(slots.length - 1)).toBe(false);
  });

  it('друг на друга и за стену — нельзя', () => {
    const layout = layoutFor(2);
    const slots = layout.slots.map((s) => ({ ...s }));
    slots[1] = { ...slots[0] };
    expect(slotIssues(layout, slots).has(1)).toBe(true);
    const out = layout.slots.map((s) => ({ ...s }));
    out[2] = { x: -10, y: out[2].y };
    expect(slotIssues(layout, out).has(2)).toBe(true);
  });

  it('прямо перед другой полкой — нельзя: к ней не подойти', () => {
    const layout = layoutFor(2);
    const slots = layout.slots.map((s) => ({ ...s }));
    const target = slots[3];
    const last = slots.length - 1;
    // Ставим полку туда, где покупатель стоит у полки 3 — закрываем ей фронт.
    slots[last] = { x: target.x, y: target.y + 26 };
    const bad = slotIssues(layout, slots);
    expect(bad.size).toBeGreaterThan(0);
  });

  it('в проходе к кассе и у двери — нельзя', () => {
    const layout = layoutFor(2);
    const slots = layout.slots.map((s) => ({ ...s }));
    slots[0] = { x: layout.door.x, y: layout.h - 20 };
    expect(slotIssues(layout, slots).has(0)).toBe(true);
    slots[0] = { x: layout.counter.x, y: layout.counter.y };
    expect(slotIssues(layout, slots).has(0)).toBe(true);
  });

  it('своя расстановка применяется только к своему помещению', () => {
    const layout = layoutFor(1);
    const at = layout.slots.map((s) => ({ x: s.x + 4, y: s.y }));
    expect(withSlots(layout, { level: 1, at }, 1).slots[0].x).toBe(layout.slots[0].x + 4);
    // После расширения — снова стандартная.
    expect(withSlots(layoutFor(2), { level: 1, at }, 2).slots).toEqual(layoutFor(2).slots);
  });
});

describe('запас полок', () => {
  const lvl1 = (): StoreState => ({
    ...newGame(),
    level: 1,
    shelves: [
      { kind: 'bakery', level: 0, items: { bread: [{ age: 0 }] } as Shelf['items'] },
      { kind: 'produce', level: 1, items: {} },
      { kind: 'dairy', level: 0, items: {} },
    ],
  });

  it('полку убирают в запас: товар на склад, остальные полки остаются на своих местах', () => {
    const s = lvl1();
    const spots = layoutFor(1).slots;
    const next = keepPlaces(s, storeShelf(s, 0), 0)!;
    expect(next.shelves.map((sh) => sh.kind)).toEqual(['produce', 'dairy']);
    expect(next.storedShelves).toEqual([{ kind: 'bakery', level: 0, items: {} }]);
    expect(next.warehouse.bread?.length).toBe((s.warehouse.bread?.length ?? 0) + 1);
    const places = withSlots(layoutFor(1), next.slotPos, 1).slots;
    expect(places[0]).toEqual(spots[1]);
    expect(places[1]).toEqual(spots[2]);
    // Освободилось место первой полки — следующая встанет туда.
    expect(places[2]).toEqual(spots[0]);
    const back = placeStored(next, 0)!;
    expect(back.storedShelves).toBeUndefined();
    expect(withSlots(layoutFor(1), back.slotPos, 1).slots[2]).toEqual(spots[0]);
  });

  it('товар не влезает на склад — убрать нельзя; ларь не убирают', () => {
    const s = lvl1();
    expect(storeShelf({ ...s, warehouse: { bread: Array.from({ length: 200 }, () => ({ age: 0 })) } as StoreState['warehouse'] }, 0)).toBeNull();
    expect(storeShelf({ ...s, shelves: [...s.shelves, { kind: 'icebox', level: 0, items: {} }] }, 3)).toBeNull();
  });
});
