import { describe, expect, it } from 'vitest';
import { blur, castsShadow, footprint, lawnLayout, lawnPatches, NOT_FLOOR, paintFloor, scuffAt, shadeMap, wearAt, type FloorPlan, type WearLayer } from '../src/scenes/floor';
import { TEXTURES } from '../src/scenes/textures';

/** Зал 100×80 (пол — от 20 до 80 по высоте), вход внизу посередине. */
const hall: FloorPlan = {
  area: { x: 0, y: 0, w: 100, h: 80 },
  floors: [{ x: 0, y: 20, w: 100, h: 60 }],
  openings: [{ x: 40, y: 80, w: 20, h: 10 }],
  casters: [],
};
const SCALE = 2;
/** Тень в точке мира (x, y) — среднее по клетке 2×2 вокруг (узор ступеней сглаживаем). */
const shadeAt = (map: ReturnType<typeof shadeMap>, x: number, y: number) => {
  let sum = 0;
  for (let dy = -2; dy < 2; dy++) for (let dx = -2; dx < 2; dx++) sum += map.alpha[(Math.round(y * SCALE) + dy) * map.width + Math.round(x * SCALE) + dx];
  return sum / 16;
};

describe('живой пол: тени', () => {
  const map = shadeMap(hall, SCALE);

  it('стена — не пол: там картинка пустая', () => {
    expect(map.width).toBe(200);
    expect(map.height).toBe(160);
    expect(map.alpha[10 * SCALE * map.width + 50 * SCALE]).toBe(NOT_FLOOR);
  });

  it('у стены пол темнее, к середине зала тень сходит на нет', () => {
    const atWall = shadeAt(map, 50, 21);
    const mid = shadeAt(map, 50, 50);
    expect(atWall).toBeGreaterThan(40);
    expect(mid).toBeLessThan(6);
  });

  it('в углу темнее, чем у прямой стены', () => {
    expect(shadeAt(map, 2, 22)).toBeGreaterThan(shadeAt(map, 50, 22));
  });

  it('у входной двери пол не темнеет, как у стены рядом', () => {
    expect(shadeAt(map, 50, 78)).toBeLessThan(shadeAt(map, 20, 78) * 0.6);
  });

  it('мебель отбрасывает тень на пол вокруг себя', () => {
    const withShelf = shadeMap({ ...hall, casters: [{ x: 40, y: 40, w: 20, h: 10 }] }, SCALE);
    expect(shadeAt(withShelf, 50, 52)).toBeGreaterThan(shadeAt(map, 50, 52) + 15);
    // Далеко от полки — как без неё.
    expect(Math.abs(shadeAt(withShelf, 10, 70) - shadeAt(map, 10, 70))).toBeLessThan(3);
  });

  it('пятно мебели на полу: без передней стенки и чуть сдвинуто от света', () => {
    const fp = footprint({ x: 10, y: 10, w: 40, h: 32 });
    expect(fp.x).toBeGreaterThan(10);
    expect(fp.y).toBeGreaterThan(10 + 9);
    // Низ пятна — у нижнего края картинки, чуть ниже (тень ложится вперёд, от света сверху).
    expect(fp.y + fp.h).toBeGreaterThanOrEqual(42);
    expect(fp.y + fp.h).toBeLessThanOrEqual(43.5);
    expect(fp.w).toBe(39);
  });

  it('тень бросает мебель на полу, а не полоски света, кромки и висящее на стене', () => {
    for (const key of ['shelf', 'fridge_side', 'counter2', 'icebox', 'vending_side', 'stove1', 'plant_big', 'bin_t2_3', 'oven2', 'rack']) expect(castsShadow(key)).toBe(true);
    for (const key of ['shelf_front', 'glow', 'clock', 'coffee_machine', 'oven_bread', 'ac_wall', 'item_bread', 'p_shirt']) expect(castsShadow(key)).toBe(false);
  });

  it('все картинки мебели из списка теней правда есть в игре', () => {
    const missing = ['shelf', 'counter0', 'icebox', 'kshowcase', 'ktable', 'stove0', 'bargain_bin', 'candy_rack'].filter((k) => !TEXTURES.includes(k));
    expect(missing).toEqual([]);
  });

  it('размытие сохраняет сумму и не выходит за 0…1', () => {
    const src = new Float32Array(30 * 30);
    for (let i = 0; i < 30; i++) src[i * 30 + 15] = 1;
    const out = blur(src, 30, 30, 6);
    expect(Math.max(...out)).toBeLessThanOrEqual(1);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    // Середина далеко от краёв: сумма по строке почти та же.
    let row = 0;
    for (let x = 0; x < 30; x++) row += out[15 * 30 + x];
    expect(row).toBeCloseTo(1, 1);
  });
});

describe('живой пол: потёртость', () => {
  /** Сетка 4×3 клетки по 8: потёрт только второй столбец. */
  const wear: WearLayer = { cells: Float32Array.from([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]), cols: 4, rows: 3, x: 10, y: 20 };

  it('потёртость между клетками плавная, за краем сетки — нет', () => {
    expect(wearAt(wear, 10 + 12, 20 + 12)).toBeCloseTo(1);
    expect(wearAt(wear, 10 + 16, 20 + 12)).toBeCloseTo(0.5);
    expect(wearAt(wear, 10 + 28, 20 + 12)).toBeCloseTo(0);
    expect(wearAt(wear, 5, 25)).toBe(0);
    expect(wearAt(wear, 20, 50)).toBe(0);
  });

  it('царапинок тем больше, чем пол потёртее; на чистом — нет, и места их не меняются', () => {
    const count = (v: number) => {
      let n = 0;
      for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) if (scuffAt(x, y, 2, v)) n++;
      return n;
    };
    expect(count(0)).toBe(0);
    expect(count(0.5)).toBeGreaterThan(0);
    expect(count(1)).toBeGreaterThan(count(0.5));
    // Подпись по месту, а не случайная: одно и то же при каждой перерисовке.
    expect(scuffAt(37, 41, 2, 0.9)).toBe(scuffAt(37, 41, 2, 0.9));
  });

  it('картинка пола: стена прозрачная, потёртый пол — заметнее чистого', () => {
    const map = shadeMap(hall, 1);
    const worn: WearLayer = { cells: new Float32Array(100 * 60).fill(1), cols: 13, rows: 8, x: 0, y: 20 };
    const clean = new Uint8ClampedArray(100 * 80 * 4);
    const dirty = new Uint8ClampedArray(100 * 80 * 4);
    paintFloor(map, hall.area, null, clean, 0, 0, 100, 80);
    paintFloor(map, hall.area, worn, dirty, 0, 0, 100, 80);
    const alphaAt = (data: Uint8ClampedArray, x: number, y: number) => data[(y * 100 + x) * 4 + 3];
    expect(alphaAt(clean, 50, 5)).toBe(0);
    expect(alphaAt(dirty, 50, 5)).toBe(0);
    let a = 0;
    let b = 0;
    for (let y = 40; y < 60; y++) {
      for (let x = 30; x < 70; x++) {
        a += alphaAt(clean, x, y);
        b += alphaAt(dirty, x, y);
      }
    }
    expect(b).toBeGreaterThan(a + 800 * 10);
    // Тихо и красиво: даже совсем стёртый пол лишь слегка матовый, а не грязный.
    expect(b / 800).toBeLessThan(0.3 * 255);
  });
});

describe('газон без повтора', () => {
  it('раскладка одна и та же от запуска к запуску, все четыре плитки в деле', () => {
    const a = lawnLayout(5);
    expect(lawnLayout(5)).toEqual(a);
    expect(new Set(a.map((c) => c.v)).size).toBe(4);
    expect(a.some((c) => c.fx) && a.some((c) => c.fy)).toBe(true);
  });

  it('соседние плитки — разных видов, и через край текстуры тоже (даже отражённая, та же плитка рядом видна)', () => {
    const grid = 8;
    for (const seed of [5, 20261025, 1, 77, 123456]) {
      const cells = lawnLayout(seed, grid);
      const v = (x: number, y: number) => cells[((y + grid) % grid) * grid + ((x + grid) % grid)].v;
      let same = 0;
      for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) if (v(x, y) === v(x - 1, y) || v(x, y) === v(x, y - 1)) same++;
      expect(same).toBe(0);
    }
  });

  it('пятна газона: прозрачные и спокойные, без повтора по сетке', () => {
    const cols = 64;
    const rows = 64;
    const data = lawnPatches(cols, rows, 11);
    let maxA = 0;
    for (let i = 3; i < data.length; i += 4) maxA = Math.max(maxA, data[i]);
    expect(maxA).toBeGreaterThan(10);
    expect(maxA).toBeLessThan(80);
    // Две области в разных местах не повторяют друг друга.
    const region = (x0: number, y0: number) => Array.from({ length: 64 }, (_, k) => data[((y0 + (k >> 3)) * cols + x0 + (k & 7)) * 4 + 3]);
    expect(region(0, 0)).not.toEqual(region(32, 32));
  });
});
