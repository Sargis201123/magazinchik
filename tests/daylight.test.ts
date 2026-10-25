// Свет и цвет по часу и погоде (scenes/daylight.ts): фон карты освещения и фильтры цветокоррекции.
import { describe, expect, it } from 'vitest';
import { ambientAt, darkness, gradeAt, gradeMatrix, gradeTint, lerpKeys, mixGrade, mulColor, type Grade } from '../src/scenes/daylight';
import type { Weather } from '../src/game/weather';

const channels = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const luma = (c: number): number => {
  const [r, g, b] = channels(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const WEATHERS: Weather[] = ['clear', 'rain', 'storm', 'snow', 'heat', 'leaves'];

describe('цвета', () => {
  it('умножение и смесь по ключам', () => {
    expect(mulColor(0xffffff, 0x123456)).toBe(0x123456);
    expect(mulColor(0x808080, 0x808080)).toBe(0x404040);
    const keys: [number, number][] = [
      [0, 0x000000],
      [1, 0xffffff],
    ];
    expect(lerpKeys(keys, 0)).toBe(0);
    expect(lerpKeys(keys, 1)).toBe(0xffffff);
    // За краями — крайний цвет, а не «перелёт».
    expect(lerpKeys(keys, -1)).toBe(0);
    expect(lerpKeys(keys, 2)).toBe(0xffffff);
    expect(channels(lerpKeys(keys, 0.5))).toEqual([128, 128, 128]);
  });

  it('темнота фона', () => {
    expect(darkness(0xffffff)).toBe(0);
    expect(darkness(0x000000)).toBe(1);
    expect(darkness(0xff80ff)).toBeCloseTo(1 - 128 / 255);
  });
});

describe('фон карты освещения', () => {
  it('днём белый: карта не нужна (в ясную погоду)', () => {
    for (const p of [0, 0.2, 0.5, 0.7]) {
      const { outdoor, indoor } = ambientAt(p, 'clear', false);
      expect(darkness(outdoor)).toBe(0);
      expect(darkness(indoor)).toBe(0);
    }
  });

  it('к ночи темнеет плавно, без скачков', () => {
    for (const weather of WEATHERS) {
      let prev = ambientAt(0.6, weather, false);
      for (let p = 0.6; p <= 1.0001; p += 0.01) {
        const now = ambientAt(p, weather, false);
        expect(luma(now.outdoor)).toBeLessThanOrEqual(luma(prev.outdoor) + 1e-9);
        expect(Math.abs(luma(now.outdoor) - luma(prev.outdoor))).toBeLessThan(0.12);
        expect(Math.abs(luma(now.indoor) - luma(prev.indoor))).toBeLessThan(0.08);
        prev = now;
      }
    }
  });

  it('ночью темно, но читаемо: в зале без ламп светлее, чем на улице, — около половины дневного', () => {
    for (const weather of WEATHERS) {
      const { outdoor, indoor } = ambientAt(1, weather, false);
      expect(luma(indoor)).toBeGreaterThan(luma(outdoor));
      expect(luma(indoor)).toBeGreaterThan(0.4);
      expect(luma(outdoor)).toBeGreaterThan(0.25);
      // Ночь синяя, а не серая.
      const [r, , b] = channels(outdoor);
      expect(b).toBeGreaterThan(r);
    }
  });

  it('свет отключили — в зале темнее, улица та же', () => {
    for (const p of [0.3, 0.9, 1]) {
      const on = ambientAt(p, 'clear', false);
      const off = ambientAt(p, 'clear', true);
      expect(off.outdoor).toBe(on.outdoor);
      expect(luma(off.indoor)).toBeLessThan(luma(on.indoor) - 0.1);
    }
    // Днём без света полумрак, но не ночь.
    expect(luma(ambientAt(0.3, 'clear', true).indoor)).toBeGreaterThan(0.4);
  });

  it('в дождь днём пасмурно, а снежной ночью светлее, чем ясной', () => {
    expect(darkness(ambientAt(0.5, 'rain', false).outdoor)).toBeGreaterThan(0.05);
    expect(luma(ambientAt(1, 'snow', false).outdoor)).toBeGreaterThan(luma(ambientAt(1, 'clear', false).outdoor));
  });
});

describe('цветокоррекция', () => {
  const neutral: Grade = { r: 1, g: 1, b: 1, sat: 1, con: 1, lift: 0, liftColor: [0, 0, 0] };

  it('нейтральный фильтр — единичная матрица', () => {
    const m = gradeMatrix(neutral);
    expect(m).toHaveLength(20);
    const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    m.forEach((v, i) => expect(v).toBeCloseTo(identity[i], 6));
  });

  it('насыщенность не трогает серое, контраст держит середину', () => {
    const run = (grade: Grade, rgb: number[]) => {
      const m = gradeMatrix(grade);
      return [0, 1, 2].map((row) => m[row * 5] * rgb[0] + m[row * 5 + 1] * rgb[1] + m[row * 5 + 2] * rgb[2] + m[row * 5 + 4] / 255);
    };
    for (const v of run({ ...neutral, sat: 0.7, con: 1.2 }, [0.5, 0.5, 0.5])) expect(v).toBeCloseTo(0.5, 5);
    // Меньше насыщенности — красный тянется к серому.
    const [r, g] = run({ ...neutral, sat: 0.7 }, [1, 0, 0]);
    expect(r).toBeLessThan(1);
    expect(g).toBeGreaterThan(0);
    // Больше контраста — тёмное темнее, светлое светлее.
    const [dark] = run({ ...neutral, con: 1.2 }, [0.2, 0.2, 0.2]);
    const [light] = run({ ...neutral, con: 1.2 }, [0.8, 0.8, 0.8]);
    expect(dark).toBeLessThan(0.2);
    expect(light).toBeGreaterThan(0.8);
  });

  it('час дня: персиковое утро, чистый полдень, тёплый закат, синие сумерки', () => {
    const morning = gradeAt(0.02, 'clear');
    const noon = gradeAt(0.45, 'clear');
    const golden = gradeAt(0.8, 'clear');
    const dusk = gradeAt(0.91, 'clear');
    expect(morning.r).toBeGreaterThan(morning.b);
    expect(Math.abs(noon.r - 1)).toBeLessThan(0.02);
    expect(Math.abs(noon.b - 1)).toBeLessThan(0.02);
    expect(noon.lift).toBe(0);
    expect(golden.r - golden.b).toBeGreaterThan(morning.r - morning.b);
    expect(dusk.b).toBeGreaterThan(dusk.r);
  });

  it('фильтры сменяются плавно', () => {
    for (const weather of WEATHERS) {
      let prev = gradeAt(0, weather);
      for (let p = 0.005; p <= 1; p += 0.005) {
        const now = gradeAt(p, weather);
        for (const k of ['r', 'g', 'b', 'sat', 'con', 'lift'] as const) expect(Math.abs(now[k] - prev[k])).toBeLessThan(0.02);
        prev = now;
      }
    }
  });

  it('дождь приглушает цвета, снег светлый и холодный', () => {
    expect(gradeAt(0.5, 'rain').sat).toBeLessThan(gradeAt(0.5, 'clear').sat - 0.1);
    const snow = gradeAt(0.5, 'snow');
    expect(snow.b).toBeGreaterThan(snow.r);
    expect(snow.lift).toBeGreaterThan(0);
  });

  it('смесь фильтров: цвет подъёма теней не мигает, когда у одного подъём нулевой', () => {
    const blue: Grade = { ...neutral, lift: 0.1, liftColor: [0, 0, 1] };
    const mid = mixGrade(neutral, blue, 0.5);
    expect(mid.lift).toBeCloseTo(0.05);
    expect(mid.liftColor).toEqual([0, 0, 1]);
  });

  it('оттенок для лёгкой графики — не ярче белого', () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const tint = gradeTint(gradeAt(p, 'clear'));
      expect(Math.max(...channels(tint))).toBe(255);
    }
    expect(gradeTint(neutral)).toBe(0xffffff);
  });
});
