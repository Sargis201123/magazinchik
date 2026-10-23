// Ровные пиксели. Холст — ровно по пикселям экрана (в лёгкой графике на плотном экране — в целое
// число раз реже), а камера в покое стоит так, что пиксель рисунка — целое число пикселей холста
// (1, 2, 3…). Тогда все пиксели одной ширины и картинка не рябит, когда люди ходят и камера едет.
// Чистые расчёты — без Phaser и без окна: их проверяют тесты (tests/pixels.test.ts).

/** «Базовая» ширина холста: от неё считаются размеры на холсте под интерфейсом (res в сцене). */
export const BASE_W = 720;
/** Холст от 9:16 до 9:20: на вытянутых телефонах — во весь экран, на планшете и компьютере — полоса посередине. */
export const MIN_ASPECT = 16 / 9;
export const MAX_ASPECT = 20 / 9;
/**
 * Уже этого холст не делаем, даже в лёгкой графике: зал старшего уровня (260 точек мира, 520 пикселей
 * рисунка) должен влезать с пикселем рисунка в пиксель холста — иначе мелкие детали пропадают.
 */
export const MIN_CANVAS_W = 540;

/** Насколько ровный масштаб может быть мельче желаемого (на 20%) и крупнее (на 20%). */
const ZOOM_OUT = 0.8;
const ZOOM_IN = 1.2;

export interface CanvasFit {
  /** Размер холста в его пикселях — всегда чётный: середина экрана ложится на границу пикселей. */
  width: number;
  height: number;
  /** Сколько пикселей экрана по стороне в одном пикселе холста: 1 — точь-в-точь, 2 — вдвое реже. */
  density: number;
  /** Размер холста на странице и отступ слева и сверху — в точках CSS, ровно по пикселям экрана. */
  cssWidth: number;
  cssHeight: number;
  left: number;
  top: number;
}

/**
 * Холст под область parentW × parentH (точки CSS) при плотности экрана dpr. Не шире maxWidth пикселей:
 * если экран плотнее, холст в целое число раз реже (каждый его пиксель — 2×2 пикселя экрана), а не
 * растянут в дробное число раз — тогда пиксели разной ширины. Но и не уже MIN_CANVAS_W, если экран
 * позволяет: лучше чуть тяжелее, чем каша из пропавших пикселей.
 */
export function fitCanvas(parentW: number, parentH: number, dpr: number, maxWidth: number): CanvasFit {
  const w = Math.max(1, parentW);
  const h = Math.max(1, parentH);
  const ratio = dpr > 0 ? dpr : 1;
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, h / w));
  const cssW = Math.min(w, h / aspect);
  const cssH = Math.min(h, cssW * aspect);
  // Пиксели экрана; запас на дробную плотность (2,625 × 411,43 = 1079,99…).
  const deviceW = Math.max(2, Math.floor(cssW * ratio + 0.01));
  const deviceH = Math.max(2, Math.floor(cssH * ratio + 0.01));
  let density = Math.max(1, Math.ceil(deviceW / Math.max(2, maxWidth) - 1e-9));
  while (density > 1 && deviceW / density < MIN_CANVAS_W) density--;
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const width = even(deviceW / density);
  const height = even(deviceH / density);
  const cssWidth = (width * density) / ratio;
  const cssHeight = (height * density) / ratio;
  // Отступ — целым числом пикселей экрана: иначе браузер сдвинет холст на полпикселя и размоет.
  const snap = (gap: number) => Math.max(0, Math.round((gap / 2) * ratio)) / ratio;
  return { width, height, density, cssWidth, cssHeight, left: snap(w - cssWidth), top: snap(h - cssHeight) };
}

/** Сколько пикселей экрана по ширине тянет каждый уровень графики (больше — холст в 2, 3… раза реже). */
export function canvasCap(tier: 'lite' | 'normal' | 'high'): number {
  // Лёгкая — как раньше, не плотнее 720 точек; обычная — точь-в-точь любой iPhone (до 1320) и обычный
  // Android (1080), а экран 1440 — вдвое реже; высокая — и 1440 (сильные телефоны: им по силам).
  return tier === 'lite' ? 720 : tier === 'normal' ? 1340 : 1600;
}

/**
 * Масштаб камеры рядом с желаемым zoom (пикселей холста на точку мира), не мельче min и не крупнее max.
 * Пиксель рисунка — 1/art точки мира. По порядку:
 * • ровный — пиксель рисунка ровно в 1, 2, 3… пикселя холста (zoom кратен art): все пиксели одной ширины;
 * • целый — точка мира в целое число пикселей (zoom 3 при art 2): пиксели рисунка через один шире
 *   (1 и 2), но узор не меняется, когда человек идёт или камера едет, — без ряби.
 * Берём ближайший по отношению, не дальше чем на 20% в любую сторону. Ни того ни другого рядом нет — 0
 * (что тогда делать, решает тот, кто спрашивает).
 */
export function crispZoom(zoom: number, art: number, min = 0, max = Infinity): number {
  const fits = (z: number) => z > 0 && z >= min - 1e-9 && z <= max + 1e-9 && z / zoom >= ZOOM_OUT - 1e-9 && z / zoom <= ZOOM_IN + 1e-9;
  const nearest = (step: number): number => {
    let best = 0;
    for (const z of [Math.floor(zoom / step) * step, Math.ceil(zoom / step) * step]) {
      if (fits(z) && (!best || Math.abs(Math.log(z / zoom)) < Math.abs(Math.log(best / zoom)))) best = z;
    }
    return best;
  };
  return zoom > 0 ? nearest(art) || nearest(1) : 0;
}
