import { describe, expect, it } from 'vitest';
import { HYPER_LEVEL, newGame, type StoreState } from '../src/game/economy';
import { yearTime } from '../src/game/calendar';
import { brandRect, brandSpotFor, iceboxRect, iceboxSpotFor, kioskSpot, layoutFor, licenseRect, licenseSpotFor, registerSpot, type Point, type Room } from '../src/scenes/layout';
import { blockedZones, overlapsRect, standFor, tillZones } from '../src/scenes/placement';
import { AISLE_H, hyperLook, planAisle, planHyperHall, reachableTargets, seasonArt, type HyperPiece } from '../src/scenes/hyperPlan';
import type { Rect } from '../src/scenes/paths';

// Низ зала гипермаркета (scenes/hyperHall.ts, 27.11): уголок аттракционов, сезонная фотозона и скамья встают в пустую
// полосу между нижним рядом островов и входом, уступают место всему игровому и не отрезают проходы; главный проход к
// кассам ложится в пол над нижним рядом островов.

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
  // Места охранника, менеджера, грузчика и уборщицы (staff.workerHome): вокруг ног человека.
  ...[
    { x: door.x + 22, y: door.y - 14 },
    { x: door.x - 24, y: door.y - 30 },
    { x: L.warehouse.doorway.x + 6, y: L.warehouse.doorway.y - 18 },
    { x: L.wc.x - 18, y: L.wc.spotY + 8 },
  ].map((p) => ({ x: p.x - 7, y: p.y - 10, w: 14, h: 20 })),
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

  const ice = [iceboxRect(iceboxSpotFor(L, REGISTERS, [], KIOSKS))];
  const brand = brandRect(brandSpotFor(L, REGISTERS, ice, KIOSKS));
  /** Полка своей марки и витрина 18+ на полу вместе с местом покупателя перед ними. */
  const withStand = (r: Rect): Rect => ({ ...r, h: r.h + 18 });
  const planWith = (fixtures: Rect[]) => {
    const plan = planHyperHall(L, [...taken, ...fixtures], obstacles, targets);
    for (const p of plan) {
      for (const r of fixtures) expect(overlapsRect(p.body, r)).toBe(false);
      expect(taken.some((r) => overlapsRect(p.body, r))).toBe(false);
    }
    expect(reachableTargets(L, [...obstacles, ...blocks(plan)], entry, targets).every(Boolean)).toBe(true);
    return plan;
  };

  /** Столик дегустации у полки своей марки (promoFx.tasteSpot): справа от неё. */
  const tasting = { x: brand.x + 16 + 27 - 9, y: brand.y + 22 + 10 - 14, w: 18, h: 18 };

  it('полка своей марки слева у входа - уголок поменьше между ней и проходом к двери, остальное на местах', () => {
    const plan = planWith([withStand(brand), tasting]);
    expect(plan.map((p) => [p.id, p.small === true])).toEqual([
      ['kids', true],
      ['season', false],
      ['bench', false],
    ]);
  });

  it('витрина 18+ у касс без полки своей марки - скамья у левой стены, все три вещи на месте', () => {
    const license = licenseRect(licenseSpotFor(L, REGISTERS, ice, KIOSKS));
    const plan = planWith([withStand(license)]);
    expect(plan.map((p) => p.id)).toEqual(['kids', 'season', 'bench']);
    const bench = plan.find((p) => p.id === 'bench')!;
    expect(bench.x).toBeLessThan(L.door.x);
  });

  it('полка своей марки и витрина 18+ встают на свои места, а убранство - где осталось', () => {
    const license = licenseRect(licenseSpotFor(L, REGISTERS, [...ice, brand], KIOSKS));
    const plan = planWith([...[brand, license].map(withStand), tasting]);
    // Уголок - поменьше (слева полка своей марки), скамье у касс места нет (витрина 18+), у левой стены - тоже.
    expect(plan.map((p) => p.id)).toEqual(['kids', 'season']);
    expect(plan[0].small).toBe(true);
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

describe('главный проход к кассам', () => {
  const keep = [...tillZones(L, REGISTERS, KIOSKS), ...blockedZones(L)];
  /** Место под полку на полу: полка, вставка отдела и разметка «+». */
  const spot = (p: Point): Rect => ({ x: p.x - 20, y: p.y - 16, w: 40, h: 36 });

  it('ложится в проход над нижним рядом островов, от левой стены почти до касс', () => {
    const aisle = planAisle(L, keep)!;
    expect(aisle).not.toBeNull();
    const band = { x: aisle.x0, y: aisle.y, w: aisle.x1 - aisle.x0, h: AISLE_H };
    const rows = [...new Set(L.slots.map((p) => p.y))].sort((a, b) => a - b);
    // Между двумя нижними рядами островов.
    expect(aisle.y).toBeGreaterThan(rows[rows.length - 2]);
    expect(aisle.y + AISLE_H).toBeLessThan(rows[rows.length - 1]);
    expect(aisle.x0).toBeLessThanOrEqual(4);
    // Правее нижнего ряда островов - к кассам.
    const bottom = L.slots.filter((p) => p.y === rows[rows.length - 1]);
    expect(aisle.x1).toBeGreaterThan(Math.max(...bottom.map((p) => p.x)) + 20);
    for (const p of L.slots) expect(overlapsRect(band, spot(p))).toBe(false);
    for (const r of keep) expect(overlapsRect(band, r)).toBe(false);
  });

  it('полки переставили поперёк прохода - полосы нет', () => {
    const across = { ...L, slots: [...L.slots, ...[30, 80, 130, 180].map((x) => ({ x, y: 272 }))] };
    expect(planAisle(across, keep)).toBeNull();
  });

  it('в проходе стоит витрина - полоса кончается перед ней, а слишком короткой не бывает', () => {
    const showcase = (x: number) => ({ x, y: 262, w: 32, h: 36 });
    const aisle = planAisle(L, [...keep, showcase(150)])!;
    expect(aisle).not.toBeNull();
    expect(aisle.x1).toBeLessThanOrEqual(150 - 4);
    expect(planAisle(L, [...keep, showcase(60)])).toBeNull();
  });
});

// 27.11, ревью: полку своей марки и витрину 18+ покупают утром без перестройки зала - без этой отметки новая полка
// вставала на скамью у касс или на коврик уголка; сезон фотозоны меняется за ночь - осенний стог стоял бы до перезапуска.
describe('отметка низа зала гипермаркета (hyperLook)', () => {
  const hyper = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), level: HYPER_LEVEL, ...patch });
  const withShelf = (s: StoreState, kind: string): StoreState => ({ ...s, shelves: [...s.shelves, { kind, level: 0, items: {} } as StoreState['shelves'][number]] });

  it('ниже гипермаркета - пустая: покупки в маленьком магазине зал не перестраивают', () => {
    const small = { ...newGame(), level: HYPER_LEVEL - 1 };
    expect(hyperLook(small)).toBe('');
    expect(hyperLook(withShelf(small, 'license'))).toBe('');
  });

  it('купили витрину 18+ или первую линию своей марки - отметка другая (зал перестроится)', () => {
    const base = hyper();
    expect(hyperLook(withShelf(base, 'license'))).not.toBe(hyperLook(base));
    expect(hyperLook(withShelf(base, 'brand'))).not.toBe(hyperLook(base));
    expect(hyperLook(withShelf(withShelf(base, 'brand'), 'license'))).not.toBe(hyperLook(withShelf(base, 'brand')));
  });

  it('сменился сезон - другая фотозона и другая отметка; внутри сезона - та же', () => {
    let day = 1;
    while (yearTime(day + 1) === yearTime(day)) day++;
    // day - последний день сезона, day + 1 - первый день следующего.
    expect(seasonArt(hyper({ day: day + 1 }))).not.toBe(seasonArt(hyper({ day })));
    expect(hyperLook(hyper({ day: day + 1 }))).not.toBe(hyperLook(hyper({ day })));
    expect(hyperLook(hyper({ day: day - 1 }))).toBe(hyperLook(hyper({ day })));
  });
});
