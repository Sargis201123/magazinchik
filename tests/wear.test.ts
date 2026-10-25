import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/economy';
import { addStep, DAY_WEAR, decodeWear, encodeWear, mopWear, settleWear, WEAR_CELL, wearGrid, wornSpot } from '../src/game/wear';

const grid = wearGrid(260, 340);

/** Дорожка: столько шагов в каждую клетку ряда y (точки мира) от x0 до x1. */
const path = (steps: Float32Array, y: number, x0: number, x1: number, n: number) => {
  for (let x = x0; x <= x1; x += WEAR_CELL) addStep(steps, grid, x, y, n);
};

describe('потёртость пола: сохранение', () => {
  it('сетка по клеткам WEAR_CELL: зал 260×340 — 33×43 клетки', () => {
    expect(grid).toEqual({ cols: 33, rows: 43 });
  });

  it('чистый пол не хранится, старое сохранение без поля — чистый пол', () => {
    const cells = new Float32Array(grid.cols * grid.rows);
    expect(encodeWear(cells, 4, grid)).toBeUndefined();
    expect(decodeWear(newGame().floorWear, 4, grid).every((v) => v === 0)).toBe(true);
    expect(decodeWear(undefined, 4, grid)).toHaveLength(grid.cols * grid.rows);
  });

  it('туда и обратно — с точностью до ступени, пустые места сжаты сериями', () => {
    const cells = new Float32Array(grid.cols * grid.rows);
    cells[5] = 0.5;
    cells[400] = 1;
    cells[401] = 0.2;
    cells[1000] = 0.03;
    const saved = encodeWear(cells, 4, grid)!;
    expect(saved).toMatchObject({ level: 4, cols: 33, rows: 43 });
    // Почти пустой пол — пара десятков знаков, а не полторы тысячи.
    expect(saved.data.length).toBeLessThan(30);
    const back = decodeWear(saved, 4, grid);
    for (let i = 0; i < cells.length; i++) expect(Math.abs(back[i] - cells[i])).toBeLessThanOrEqual(0.5 / 31 + 1e-6);
  });

  it('длинные пустые серии (больше 1023 клеток) читаются верно', () => {
    const big = wearGrid(400, 400);
    const cells = new Float32Array(big.cols * big.rows);
    cells[cells.length - 1] = 1;
    const back = decodeWear(encodeWear(cells, 1, big), 1, big);
    expect(back[cells.length - 1]).toBe(1);
    expect(back.slice(0, -1).every((v) => v === 0)).toBe(true);
  });

  it('другое помещение (расширились), другая сетка или испорченная строка — чистый пол', () => {
    const cells = new Float32Array(grid.cols * grid.rows).fill(0.6);
    const saved = encodeWear(cells, 3, grid)!;
    expect(decodeWear(saved, 4, grid).every((v) => v === 0)).toBe(true);
    expect(decodeWear(saved, 3, wearGrid(200, 280)).every((v) => v === 0)).toBe(true);
    expect(decodeWear({ ...saved, data: '!!!' }, 3, grid).every((v) => v === 0)).toBe(true);
    expect(decodeWear({ ...saved, data: 'z' }, 3, grid).every((v) => v === 0)).toBe(true);
  });
});

describe('потёртость пола: день', () => {
  it('где ходили больше всего, за день прибавляется DAY_WEAR; где не ходили — ничего', () => {
    const steps = new Float32Array(grid.cols * grid.rows);
    path(steps, 300, 20, 220, 40);
    const after = settleWear(new Float32Array(steps.length), steps, grid, { cleaner: false, entrance: 0 });
    const hot = Math.max(...after);
    expect(hot).toBeGreaterThan(DAY_WEAR * 0.9);
    expect(hot).toBeLessThanOrEqual(DAY_WEAR);
    // Далеко от дорожки — чисто.
    expect(after[2 * grid.cols + 2]).toBe(0);
  });

  it('за неделю хоженая дорожка стирается почти полностью, но не больше 1', () => {
    let cells: Float32Array = new Float32Array(grid.cols * grid.rows);
    const steps = new Float32Array(cells.length);
    path(steps, 300, 20, 220, 40);
    for (let d = 0; d < 7; d++) cells = settleWear(cells, steps, grid, { cleaner: false, entrance: 0 });
    expect(Math.max(...cells)).toBeGreaterThan(0.75);
    for (let d = 0; d < 30; d++) cells = settleWear(cells, steps, grid, { cleaner: false, entrance: 0 });
    expect(Math.max(...cells)).toBeLessThanOrEqual(1);
  });

  it('в тихий день (пара шагов) пол почти не стирается', () => {
    const steps = new Float32Array(grid.cols * grid.rows);
    addStep(steps, grid, 100, 100, 2);
    const after = settleWear(new Float32Array(steps.length), steps, grid, { cleaner: false, entrance: 0 });
    expect(Math.max(...after)).toBeLessThan(DAY_WEAR * 0.25);
  });

  it('уборщик и решётка у входа: пол стирается медленнее', () => {
    const steps = new Float32Array(grid.cols * grid.rows);
    path(steps, 300, 20, 220, 40);
    const run = (cleaner: boolean, entrance: number) => {
      let cells: Float32Array = new Float32Array(steps.length);
      for (let d = 0; d < 7; d++) cells = settleWear(cells, steps, grid, { cleaner, entrance });
      return Math.max(...cells);
    };
    const plain = run(false, 0);
    expect(run(true, 0)).toBeLessThan(plain);
    expect(run(false, 1)).toBeLessThan(plain);
    expect(run(false, 2)).toBeLessThan(run(false, 1));
  });

  it('старый пол без шагов за ночь понемногу отходит', () => {
    const cells = new Float32Array(grid.cols * grid.rows).fill(0.5);
    const after = settleWear(cells, new Float32Array(cells.length), grid, { cleaner: false, entrance: 0 });
    expect(after[0]).toBeLessThan(0.5);
    expect(after[0]).toBeGreaterThan(0.45);
  });

  it('шаги за краем пола не считаются', () => {
    const steps = new Float32Array(grid.cols * grid.rows);
    addStep(steps, grid, -5, 10);
    addStep(steps, grid, 10, 400);
    addStep(steps, grid, 300, 10);
    expect(steps.every((v) => v === 0)).toBe(true);
  });
});

describe('потёртость пола: уборка', () => {
  it('швабра стирает потёртость вокруг, дальние клетки не трогает', () => {
    const cells = new Float32Array(grid.cols * grid.rows).fill(0.8);
    const changed = mopWear(cells, grid, 100, 100);
    expect(changed).toBe(true);
    const at = (x: number, y: number) => cells[Math.floor(y / WEAR_CELL) * grid.cols + Math.floor(x / WEAR_CELL)];
    expect(at(100, 100)).toBeLessThan(0.4);
    expect(at(200, 200)).toBeCloseTo(0.8);
  });

  it('на чистом полу мыть нечего', () => {
    const cells = new Float32Array(grid.cols * grid.rows);
    expect(mopWear(cells, grid, 100, 100)).toBe(false);
  });

  it('самое потёртое место — середина самой потёртой клетки; чистый пол — null', () => {
    const cells = new Float32Array(grid.cols * grid.rows);
    expect(wornSpot(cells, grid)).toBeNull();
    cells[3 * grid.cols + 7] = 0.9;
    cells[10] = 0.5;
    expect(wornSpot(cells, grid)).toEqual({ x: 7.5 * WEAR_CELL, y: 3.5 * WEAR_CELL });
    expect(wornSpot(cells, grid, 0.95)).toBeNull();
    // Куда не подойти (под полкой) — берём следующее по потёртости.
    expect(wornSpot(cells, grid, 0.3, (_x, y) => y < 3 * WEAR_CELL)).toEqual({ x: 10.5 * WEAR_CELL, y: 0.5 * WEAR_CELL });
    expect(wornSpot(cells, grid, 0.3, () => false)).toBeNull();
  });
});
