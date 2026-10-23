import { describe, expect, it } from 'vitest';
import { canvasCap, crispZoom, fitCanvas, MIN_CANVAS_W } from '../src/scenes/pixels';

describe('холст по пикселям экрана', () => {
  it('iPhone 390×844 при плотности 3: холст 1170×2532, браузер его не растягивает', () => {
    const fit = fitCanvas(390, 844, 3, canvasCap('high'));
    expect(fit).toMatchObject({ width: 1170, height: 2532, density: 1, cssWidth: 390, cssHeight: 844, left: 0, top: 0 });
  });

  it('Android с дробной плотностью 2,75: холст ровно в пиксели экрана, чётный', () => {
    const fit = fitCanvas(392.7272, 850.909, 2.75, canvasCap('normal'));
    expect(fit.width).toBe(1080);
    expect(fit.height).toBe(2340);
    expect(fit.density).toBe(1);
    // Размер на странице × плотность — снова целые пиксели.
    expect(fit.cssWidth * 2.75).toBeCloseTo(1080, 6);
    expect(fit.cssHeight * 2.75).toBeCloseTo(2340, 6);
  });

  it('ширина и высота всегда чётные: середина экрана — на границе пикселей', () => {
    for (const [w, h, dpr] of [
      [393, 852, 3],
      [412, 915, 2.625],
      [360, 780, 3],
      [375, 667, 2],
      [1280, 721, 1],
    ]) {
      const fit = fitCanvas(w, h, dpr, canvasCap('high'));
      expect(fit.width % 2).toBe(0);
      expect(fit.height % 2).toBe(0);
    }
  });

  it('лёгкая графика на плотном экране — холст в целое число раз реже, а не дробно', () => {
    const fit = fitCanvas(393, 851, 2.75, canvasCap('lite'));
    expect(fit.density).toBe(2);
    expect(fit.width).toBe(540);
    // Каждый пиксель холста — ровно 2×2 пикселя экрана.
    expect((fit.cssWidth * 2.75) / fit.width).toBeCloseTo(2, 6);
  });

  it('лёгкая графика не делает холст уже MIN_CANVAS_W: иначе зал не влезет пиксель в пиксель', () => {
    // 828 пикселей: вдвое реже было бы 414 — мельче рисунка; остаётся 1:1.
    const fit = fitCanvas(414, 896, 2, canvasCap('lite'));
    expect(fit.density).toBe(1);
    expect(fit.width).toBe(828);
    expect(fitCanvas(360, 800, 2, canvasCap('lite')).width).toBeGreaterThanOrEqual(MIN_CANVAS_W);
  });

  it('обычная графика на экране 1440: вдвое реже, высокая — точь-в-точь', () => {
    expect(fitCanvas(411, 914, 3.5, canvasCap('normal'))).toMatchObject({ density: 2, width: 718 });
    expect(fitCanvas(411, 914, 3.5, canvasCap('high'))).toMatchObject({ density: 1, width: 1438 });
  });

  it('компьютер: полоса 9:16 посередине, отступ — целым числом пикселей экрана', () => {
    const fit = fitCanvas(1280, 721, 1, canvasCap('high'));
    expect(fit.height).toBe(720);
    expect(fit.width).toBe(404);
    expect(fit.left).toBe(438);
    expect(Number.isInteger(fit.left) && Number.isInteger(fit.top)).toBe(true);
    // Плотность 1,25 (масштаб Windows): отступ × плотность — целое.
    const scaled = fitCanvas(1536, 730, 1.25, canvasCap('high'));
    expect(Number.isInteger(Math.round(scaled.left * 1.25 * 1e6) / 1e6)).toBe(true);
  });

  it('слишком вытянутый телефон: холст 9:20, полосы сверху и снизу поровну', () => {
    const fit = fitCanvas(360, 900, 3, canvasCap('high'));
    expect(fit.height / fit.width).toBeCloseTo(20 / 9, 2);
    expect(fit.top).toBeGreaterThan(0);
    expect(fit.top * 2 + fit.cssHeight).toBeCloseTo(900, 0);
  });
});

describe('ровный масштаб камеры', () => {
  it('ближайший кратный рисунку: пиксель рисунка — 2 или 3 пикселя экрана', () => {
    expect(crispZoom(3.7, 2)).toBe(4);
    expect(crispZoom(5.75, 2)).toBe(6);
    expect(crispZoom(4.5, 2)).toBe(4);
    expect(crispZoom(4, 2)).toBe(4);
  });

  it('кратного рядом нет — целый (пиксели через один шире, но без ряби)', () => {
    // 3 → 2 и 4 дальше чем на 20%.
    expect(crispZoom(3, 2)).toBe(3);
    expect(crispZoom(2.75, 2)).toBe(3);
  });

  it('не дальше 20% от желаемого: ни ровного, ни целого — 0', () => {
    expect(crispZoom(1.4, 2)).toBe(0);
    expect(crispZoom(0, 2)).toBe(0);
  });

  it('не крупнее max: зал должен влезать по ширине', () => {
    // 3,41 → 4 было бы на 17% ближе, но 4 > max — тогда целый 3.
    expect(crispZoom(3.41, 2, 0, 3.9)).toBe(3);
    expect(crispZoom(1.72, 2, 0, 1.9)).toBe(0);
    expect(crispZoom(1.72, 2, 0, 2.03)).toBe(2);
  });

  it('не мельче min: щипок не уводит дальше разрешённого', () => {
    expect(crispZoom(2.3, 2, 2.1)).toBe(0);
    expect(crispZoom(2.3, 2, 2.1, 3)).toBe(0);
    expect(crispZoom(2.6, 2, 2.1)).toBe(3);
  });

  it('кадр рядом с привычным для частых экранов (уровни 0–4)', () => {
    // Желаемый масштаб на iPhone 1170 и Android 1080 — ровный не дальше чем на 20%.
    for (const want of [5.75, 4.88, 4.47, 3.7, 5.3, 4.5, 4.13]) {
      const z = crispZoom(want, 2);
      expect(z % 2).toBe(0);
      expect(Math.abs(Math.log(z / want))).toBeLessThanOrEqual(Math.log(1.25));
    }
  });
});
