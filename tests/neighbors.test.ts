import { describe, expect, it } from 'vitest';
import { isClash, isPair, nextTo, shelfLinks } from '../src/game/neighbors';
import { gearAvailable, upgradeGear, bargainSprite } from '../src/game/gear';
import { bargainCapacity, bargainCount, fillBargain, takeBargain } from '../src/game/bargain';
import { emptyDayStats, endDay, newGame, PRODUCTS, type Category, type StoreState } from '../src/game/economy';
import { layoutFor } from '../src/scenes/layout';
import { canShortenQueue, slotIssues, slotRect, tillZones, withTill } from '../src/scenes/placement';

describe('соседство отделов', () => {
  it('пары и химия рядом с едой', () => {
    expect(isPair('bakery', 'dairy')).toBe(true);
    expect(isPair('dairy', 'bakery')).toBe(true);
    expect(isPair('bakery', 'bakery')).toBe(false);
    expect(isClash('household', 'meat')).toBe(true);
    expect(isClash('household', 'drinks')).toBe(false);
  });

  it('связи — только между полками рядом: у стены вплотную и через проход у островов', () => {
    const l = layoutFor(4);
    const boxes = l.slots.map((p) => slotRect(l, p));
    expect(nextTo(boxes[0], boxes[1])).toBe(true);
    // Островные полки одного ряда — соседи, полка у стены и остров — нет.
    const island = l.slots.findIndex((p) => p.y > l.wallH + 40);
    expect(nextTo(boxes[island], boxes[island + 1])).toBe(true);
    expect(nextTo(boxes[0], boxes[island])).toBe(false);
    const kinds: (Category | undefined)[] = l.slots.map(() => undefined);
    kinds[0] = 'bakery';
    kinds[1] = 'dairy';
    kinds[2] = 'household';
    kinds[3] = 'meat';
    expect(shelfLinks(boxes, kinds)).toEqual([
      { a: 0, b: 1, kind: 'pair' },
      // Химия рядом и с молоком, и с мясом.
      { a: 1, b: 2, kind: 'clash' },
      { a: 2, b: 3, kind: 'clash' },
    ]);
  });
});

describe('полка «Уценка»', () => {
  // n штук хлеба на первой полке; ahead — сколько дней им ещё жить после этой ночи.
  const withBread = (ahead: number, n: number): StoreState => {
    const s = newGame();
    const life = PRODUCTS.bread.shelfLife;
    return { ...s, upgrades: ['bargain'], shelves: s.shelves.map((sh, i) => (i === 0 ? { ...sh, items: { bread: Array.from({ length: n }, () => ({ age: life - 1 - ahead })) } } : sh)) };
  };

  it('без полки ничего не переносим; с полкой — то, что испортится ночью, уценённым', () => {
    const s = withBread(0, 3);
    expect(fillBargain({ ...s, upgrades: [] }).count).toBe(0);
    const moved = fillBargain(s);
    expect(moved.count).toBe(3);
    expect(bargainCount(moved.state)).toBe(3);
    expect(moved.state.bargain?.bread?.every((u) => u.markdown)).toBe(true);
    expect(moved.state.shelves[0].items.bread).toEqual([]);
    // Свежее остаётся на полке.
    expect(fillBargain(withBread(1, 3)).count).toBe(0);
  });

  it('вмещает не больше bargainCapacity (12 мест), берут по одной штуке, ночью не купленное портится', () => {
    const BARGAIN_CAPACITY = bargainCapacity(withBread(0, 0));
    expect(BARGAIN_CAPACITY).toBe(12);
    const moved = fillBargain(withBread(0, BARGAIN_CAPACITY + 5));
    expect(moved.count).toBe(BARGAIN_CAPACITY);
    const taken = takeBargain(moved.state, () => 0);
    expect(taken?.id).toBe('bread');
    expect(bargainCount(taken!.state)).toBe(BARGAIN_CAPACITY - 1);
    const night = endDay(taken!.state, emptyDayStats());
    expect(bargainCount(night.state)).toBe(0);
    expect(night.spoiled).toBeGreaterThanOrEqual(BARGAIN_CAPACITY - 1);
  });

  it('модели полки прибавляют мест: 12 → 18 → 24; без полки улучшать нечего', () => {
    const s = { ...withBread(0, 30), money: 10_000, level: 2 };
    expect(gearAvailable({ ...s, upgrades: [] }, 'bargain')).toBe(false);
    const one = upgradeGear(s, 'bargain')!;
    expect(bargainCapacity(one)).toBe(18);
    expect(bargainSprite(one)).toBe('bargain_shelf1');
    const two = upgradeGear(one, 'bargain')!;
    expect(bargainCapacity(two)).toBe(24);
    expect(upgradeGear(two, 'bargain')).toBeNull();
    expect(fillBargain(two).count).toBe(24);
    // Старые сохранения без модели — начальная горка на 12.
    expect(bargainCapacity({ ...s, gear: undefined })).toBe(12);
  });
});

describe('короткая очередь', () => {
  it('в большом зале освобождает верх у кассы, стандартная расстановка остаётся правильной', () => {
    const l = layoutFor(4);
    expect(canShortenQueue(l)).toBe(true);
    const short = withTill(l, { level: 4, dx: 0, short: true }, 4);
    expect(short.queue.minY).toBeGreaterThan(l.queue.minY);
    const q = (lay: typeof l) => tillZones(lay, 4)[1];
    expect(q(short).h).toBeLessThan(q(l).h);
    expect([...slotIssues(short, short.slots, short.slots, 4)]).toEqual([]);
    // В ларьке укорачивать нечего.
    expect(canShortenQueue(layoutFor(0))).toBe(false);
  });
});
