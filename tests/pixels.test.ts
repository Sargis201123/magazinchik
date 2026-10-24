import { describe, expect, it } from 'vitest';
import { STORE_LEVELS } from '../src/game/economy';
import { buildingSpan, layoutFor, WING_OUTER } from '../src/scenes/layout';
import { BASE_W, canvasCap, crispZoom, fitCanvas, HOME_SLACK, homeFrame, homeZoom, MIN_CANVAS_W } from '../src/scenes/pixels';

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
    // 828 пикселей: вдвое реже было бы 414 — мельче рисунка; 1:1 — тяжелее прежнего. Холст 720, растянутый.
    const fit = fitCanvas(414, 896, 2, canvasCap('lite'));
    expect(fit.width).toBe(720);
    expect(fit.density).toBeCloseTo(828 / 720, 6);
    // На странице — по-прежнему ровно в пиксели экрана.
    expect(fit.cssWidth * 2).toBeCloseTo(828, 6);
    expect(fitCanvas(360, 800, 2, canvasCap('lite')).width).toBeGreaterThanOrEqual(MIN_CANVAS_W);
  });

  it('лёгкая графика не шире 720 и на экранах 721…1079 пикселей (окно Telegram ниже 16:9, планшет)', () => {
    // Android 1080 с кнопками внизу: экран 1008 пикселей — раньше холст был бы 1008, вдвое тяжелее.
    expect(fitCanvas(411, 683, 2.625, canvasCap('lite')).width).toBeLessThanOrEqual(720);
    expect(fitCanvas(393, 657, 2.75, canvasCap('lite')).width).toBeLessThanOrEqual(720);
    for (const [w, h, dpr] of [
      [411, 683, 2.625],
      [393, 657, 2.75],
      [800, 1216, 1.5],
      [375, 667, 2],
      [393, 851, 2.75],
      [390, 844, 3],
      [360, 760, 2],
      [411, 914, 3.5],
      [480, 853, 3.2],
    ]) {
      const fit = fitCanvas(w, h, dpr, canvasCap('lite'));
      expect(fit.width).toBeLessThanOrEqual(720);
      expect(fit.width).toBeGreaterThanOrEqual(MIN_CANVAS_W);
    }
  });

  it('обычная графика на экране 1440: вдвое реже, высокая — точь-в-точь', () => {
    expect(fitCanvas(411, 914, 3.5, canvasCap('normal'))).toMatchObject({ density: 2, width: 718 });
    expect(fitCanvas(411, 914, 3.5, canvasCap('high'))).toMatchObject({ density: 1, width: 1438 });
  });

  it('обычная графика на iPhone — вдвое реже: понижение с высокой после тормозов облегчает холст', () => {
    expect(fitCanvas(390, 844, 3, canvasCap('high'))).toMatchObject({ density: 1, width: 1170 });
    expect(fitCanvas(390, 844, 3, canvasCap('normal'))).toMatchObject({ density: 2, width: 584 });
    expect(fitCanvas(440, 956, 3, canvasCap('normal'))).toMatchObject({ density: 2, width: 660 });
    // Не шире прежних 1080 (с запасом на округление) — и обычный Android по-прежнему точь-в-точь.
    expect(fitCanvas(412, 915, 2.625, canvasCap('normal'))).toMatchObject({ density: 1, width: 1080 });
    expect(fitCanvas(375, 667, 2, canvasCap('normal'))).toMatchObject({ density: 1, width: 750 });
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

  it('щипок около обычного кадра частых экранов (уровни 0–4) доходит до ровного', () => {
    // Масштаб около обычного кадра на iPhone 1170 и Android 1080 — ровный не дальше чем на 20%.
    for (const want of [5.75, 4.88, 4.47, 3.7, 5.3, 4.5, 4.13]) {
      const z = crispZoom(want, 2);
      expect(z % 2).toBe(0);
      expect(Math.abs(Math.log(z / want))).toBeLessThanOrEqual(Math.log(1.25));
    }
  });
});

describe('обычный кадр: весь магазин с флигелем', () => {
  it('самый крупный ровный не крупнее «впритык»', () => {
    expect(homeZoom(4.15, 2)).toBe(4);
    expect(homeZoom(4.5, 2)).toBe(4);
    expect(homeZoom(2.09, 2)).toBe(2);
    // 4 мельче 4,6 на 13% — ещё ровный.
    expect(homeZoom(4.6, 2)).toBe(4);
    // Ровно впритык — он и есть (запас на округление).
    expect(homeZoom(4, 2)).toBe(4);
    expect(homeZoom(5 - 1e-12, 2)).toBe(5);
  });

  it('ровного рядом нет — целый, но никогда не крупнее «впритык»', () => {
    // 4 мельче 5,32 на 25% — целый 5.
    expect(homeZoom(5.32, 2)).toBe(5);
    expect(homeZoom(3.14, 2)).toBe(3);
    expect(homeZoom(3.4, 2)).toBe(3);
    for (const fit of [1.3, 2.2, 2.9, 3.4, 3.8, 4.9, 5.7, 6.3]) expect(homeZoom(fit, 2)).toBeLessThanOrEqual(fit + 1e-9);
  });

  it('ни ровного, ни целого в пределах 15% — дробный впритык', () => {
    // 3,8: ровный 2 и целый 3 — оба мельче больше чем на 15%.
    expect(homeZoom(3.8, 2)).toBe(3.8);
    expect(homeZoom(1.57, 2)).toBe(1.57);
    expect(homeZoom(2.77, 2)).toBe(2.77);
    expect(homeZoom(0, 2)).toBe(0);
  });

  it('не мельче «впритык» больше чем на HOME_SLACK', () => {
    for (let fit = 0.5; fit < 8; fit += 0.01) {
      const z = homeZoom(fit, 2);
      expect(z).toBeLessThanOrEqual(fit + 1e-9);
      expect(z).toBeGreaterThanOrEqual(fit * HOME_SLACK - 1e-9);
    }
  });

  it('на любом уровне и телефоне в кадре весь флигель, весь зал и правая стена', () => {
    // Узкие и широкие телефоны, планшет; лёгкая, обычная и высокая графика.
    const screens: [number, number, number][] = [
      [320, 640, 2],
      [360, 800, 2],
      [375, 667, 2],
      [390, 844, 3],
      [393, 851, 2.75],
      [412, 915, 2.625],
      [430, 932, 3],
      [820, 1180, 2],
      [768, 1024, 2],
      [1280, 721, 1],
    ];
    for (const [cssW, cssH, dpr] of screens) {
      for (const tier of ['lite', 'normal', 'high'] as const) {
        const canvas = fitCanvas(cssW, cssH, dpr, canvasCap(tier));
        const res = canvas.width / BASE_W;
        for (let level = 0; level < STORE_LEVELS.length; level++) {
          const layout = layoutFor(level);
          const span = buildingSpan(layout);
          // Как в сцене (frameCamera): запас в точку по бокам, панели сверху и снизу.
          const { zoom, x } = homeFrame(canvas.width, canvas.height - 220 * res, { left: span.left - 1, right: span.right + 1 }, layout.h + 40, 2);
          const half = canvas.width / zoom / 2;
          expect(x - half).toBeLessThanOrEqual(-WING_OUTER + 1e-6);
          expect(x + half).toBeGreaterThanOrEqual(layout.w + 6 - 1e-6);
          // И не мелко: магазин занимает не меньше 85% ширины экрана.
          expect((span.right - span.left + 2) * zoom).toBeGreaterThanOrEqual(canvas.width * HOME_SLACK - 1e-6);
        }
      }
    }
  });

  it('Android 1080 и iPhone 1170: где можно — ровный или целый', () => {
    const zoomAt = (width: number, level: number) => {
      const layout = layoutFor(level);
      const span = buildingSpan(layout);
      return homeFrame(width, 10_000, { left: span.left - 1, right: span.right + 1 }, layout.h + 40, 2).zoom;
    };
    expect([0, 1, 3, 4].map((l) => zoomAt(1080, l))).toEqual([5, 4, 3, 3]);
    expect([0, 1, 2, 3, 4].map((l) => zoomAt(1170, l))).toEqual([5, 4, 4, 3, 3]);
    // Уровень 3 на 1080: ровный 2 и целый 3 — дальше 15%, дробный впритык.
    expect(Number.isInteger(zoomAt(1080, 2))).toBe(false);
  });
});
