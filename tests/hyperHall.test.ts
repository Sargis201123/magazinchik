import { describe, expect, it } from 'vitest';
import { HYPER_LEVEL } from '../src/game/economy';
import { brandRect, brandSpotFor, iceboxRect, iceboxSpotFor, kioskSpot, layoutFor, licenseRect, licenseSpotFor, registerSpot, type Point, type Room } from '../src/scenes/layout';
import { blockedZones, overlapsRect, standFor, tillZones } from '../src/scenes/placement';
import { planHyperHall, reachableTargets, type HyperPiece } from '../src/scenes/hyperPlan';
import type { Rect } from '../src/scenes/paths';

// Низ зала гипермаркета (scenes/hyperHall.ts, 27.11): уголок аттракционов, сезонная фотозона и скамья встают в пустую
// полосу между нижним рядом островов и входом, уступают место всему игровому и не отрезают проходы.

const L = layoutFor(HYPER_LEVEL);
const REGISTERS = 5;
const KIOSKS = 4;
const furniture = ({ x, y }: Point): Rect => ({ x: x - 25, y: y - 16, w: 50, h: 24 });
/** Препятствия, как их собирает сцена (building.buildShowcases и др.): места под полки, кассы, киоски, ларь, ведро. */
const obstacles: Rect[] = [
  ...L.slots.map(furniture),
  { x: L.counter.x - 13, y: L.counter.y - 30, w: 26, h: 54 },
  ...[1, 2, 3, 4].map((i) => registerSpot(L, i)).map((r) => ({ x: r.x - 13, y: r.y - 30, w: 26, h: 54 })),
  ...Array.from({ length: KIOSKS }, (_, i) => kioskSpot(L, i)).map((k) => ({ x: k.x - 7, y: k.y - 12, w: 14, h: 16 })),
  (({ x, y }) => ({ x: x - 16, y: y - 10, w: 32, h: 18 }))(iceboxSpotFor(L, REGISTERS, [], KIOSKS)),
  { x: L.w - 18, y: L.h - 24, w: 16, h: 14 },
];
const stands = L.slots.map((p) => standFor(L, p));
const { door, h } = L;
const taken: Rect[] = [
  ...obstacles,
  ...tillZones(L, REGISTERS, KIOSKS),
  ...blockedZones(L),
  ...stands.map((p) => ({ x: p.x - 10, y: p.y - 10, w: 20, h: 20 })),
  { x: door.x - 20, y: h - 76, w: 40, h: 76 },
  ...[-46, -26, 26, 46].map((dx) => ({ x: door.x + dx - 11, y: h - 22, w: 22, h: 22 })),
  iceboxRect(iceboxSpotFor(L, REGISTERS, [], KIOSKS)),
];
const rooms = [L.warehouse, L.bakery, L.coffee, L.kitchen].filter((r): r is Room => Boolean(r));
const targets: Point[] = [
  ...stands,
  { x: L.queue.x, y: L.queue.y },
  ...rooms.map((r) => r.doorway),
  ...Array.from({ length: KIOSKS }, (_, i) => kioskSpot(L, i)).map((k) => ({ x: k.x - 14, y: k.y })),
];
const entry = { x: door.x, y: h - 8 };
const blocks = (pieces: HyperPiece[]) => pieces.map((p) => p.block);

describe('низ зала гипермаркета', () => {
  const pieces = planHyperHall(L, taken, obstacles, targets);

  it('в пустой полосе у входа встают все три вещи', () => {
    expect(pieces.map((p) => p.id)).toEqual(['kids', 'season', 'bench']);
  });

  it('ни одна вещь не на месте под полку, не у касс, не в проходе к двери и не друг на друге', () => {
    for (const p of pieces) {
      expect(taken.some((r) => overlapsRect(p.body, r))).toBe(false);
      for (const q of pieces) if (q !== p) expect(overlapsRect(p.body, q.body)).toBe(false);
      // Ниже нижнего ряда островов вместе с местом покупателя у полки.
      expect(p.block.y).toBeGreaterThan(Math.max(...stands.map((s) => s.y)) + 6);
    }
  });

  it('от входа по-прежнему дойти до каждой полки, очереди, киоска и двери флигеля', () => {
    const before = reachableTargets(L, obstacles, entry, targets);
    expect(before.every(Boolean)).toBe(true);
    expect(reachableTargets(L, [...obstacles, ...blocks(pieces)], entry, targets).every(Boolean)).toBe(true);
  });

  it('полку переставили вниз зала - вещь уступает ей место и не встаёт на неё', () => {
    const kids = pieces.find((p) => p.id === 'kids')!;
    const shelf = furniture({ x: kids.x, y: kids.y });
    const moved = planHyperHall(L, [...taken, shelf], [...obstacles, shelf], targets);
    for (const p of moved) expect(overlapsRect(p.body, shelf)).toBe(false);
  });

  it('полка своей марки и витрина 18+ встают на свои места, а убранство - где осталось', () => {
    const ice = [iceboxRect(iceboxSpotFor(L, REGISTERS, [], KIOSKS))];
    const brand = brandRect(brandSpotFor(L, REGISTERS, ice, KIOSKS));
    const license = licenseRect(licenseSpotFor(L, REGISTERS, [...ice, brand], KIOSKS));
    const fixtures = [brand, license].map((r) => ({ ...r, h: r.h + 18 }));
    const plan = planHyperHall(L, [...taken, ...fixtures], obstacles, targets);
    for (const p of plan) for (const r of fixtures) expect(overlapsRect(p.body, r)).toBe(false);
    // Уголку слева места нет (там полка своей марки), скамье у касс - тоже (витрина 18+): обе находят другое место.
    expect(plan.map((p) => p.id)).toEqual(['season', 'bench']);
    expect(reachableTargets(L, [...obstacles, ...blocks(plan)], entry, targets).every(Boolean)).toBe(true);
  });

  it('вещь, которая закрыла бы последний проход, не ставится', () => {
    // Стена поперёк зала с одной щелью - ровно посреди уголка аттракционов: путь вглубь зала только через неё.
    const kids = pieces.find((p) => p.id === 'kids')!;
    const wall = [
      { x: -10, y: kids.y - 2, w: kids.x - 6 + 10, h: 4 },
      { x: kids.x + 6, y: kids.y - 2, w: L.w - kids.x + 4, h: 4 },
    ];
    const deep = [{ x: kids.x, y: L.wallH + 60 }];
    expect(reachableTargets(L, wall, entry, deep)).toEqual([true]);
    const plan = planHyperHall(L, [], wall, deep);
    expect(plan.some((p) => p.id === 'kids' && overlapsRect(p.body, { x: kids.x - 6, y: kids.y - 2, w: 12, h: 4 }))).toBe(false);
    expect(reachableTargets(L, [...wall, ...blocks(plan)], entry, deep)).toEqual([true]);
  });
});
