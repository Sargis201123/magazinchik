// Ровные пиксели. Холст — ровно по пикселям экрана (в лёгкой и обычной графике на плотном экране —
// в целое число раз реже), а камера в покое стоит так, что пиксель рисунка — целое число пикселей холста
// (1, 2, 3…). Тогда все пиксели одной ширины и картинка не рябит, когда люди ходят и камера едет.
// Чистые расчёты — без Phaser и без окна: их проверяют тесты (tests/pixels.test.ts).

/** «Базовая» ширина холста: от неё считаются размеры на холсте под интерфейсом (res в сцене). */
export const BASE_W = 720;
/** Холст от 9:16 до 9:20: на вытянутых телефонах — во весь экран, на планшете и компьютере — полоса посередине. */
export const MIN_ASPECT = 16 / 9;
export const MAX_ASPECT = 20 / 9;
/**
 * Уже этого холст в целое число раз реже не делаем: зал старшего уровня (260 точек мира, 520 пикселей
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
  /**
   * Сколько пикселей экрана по стороне в одном пикселе холста: 1 — точь-в-точь, 2 — вдвое реже.
   * Дробное — только когда ровно не выходит (скажем, лёгкая графика на экране 721…1079 пикселей): холст растянут.
   */
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
 * растянут в дробное число раз — тогда пиксели разной ширины. Если так выходит уже MIN_CANVAS_W (скажем,
 * экран 721…1079 пикселей при пределе 720), холст ровно в предел, растянутый дробно, — как было раньше:
 * пиксели чуть разной ширины, зато мелкие детали на месте, а лёгкая графика не тяжелее прежней.
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
  const cap = Math.max(2, maxWidth);
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  let density = Math.max(1, Math.ceil(deviceW / cap - 1e-9));
  let width = even(deviceW / density);
  // Реже на раз — уже шире предела (density — наименьшее, при котором влезает): берём сам предел.
  if (density > 1 && deviceW / density < MIN_CANVAS_W) {
    width = even(cap);
    density = deviceW / width;
  }
  const height = even(deviceH / density);
  // Растянутый дробно холст — тоже в целые пиксели экрана.
  const cssWidth = Math.round(width * density) / ratio;
  const cssHeight = Math.round(height * density) / ratio;
  // Отступ — целым числом пикселей экрана: иначе браузер сдвинет холст на полпикселя и размоет.
  const snap = (gap: number) => Math.max(0, Math.round((gap / 2) * ratio)) / ratio;
  return { width, height, density, cssWidth, cssHeight, left: snap(w - cssWidth), top: snap(h - cssHeight) };
}

/** Сколько пикселей экрана по ширине тянет каждый уровень графики (больше — холст в 2, 3… раза реже). */
export function canvasCap(tier: 'lite' | 'normal' | 'high'): number {
  // Лёгкая — как раньше, не плотнее 720 точек; обычная — как раньше, не плотнее 1080 (1100 — запас на
  // округление): обычный Android точь-в-точь, а iPhone (1125–1320) и экран 1440 — вдвое реже, иначе
  // понижение с высокой после тормозов холст бы не облегчило; высокая — точь-в-точь до 1600 (сильные
  // телефоны и любой iPhone: им по силам).
  return tier === 'lite' ? 720 : tier === 'normal' ? 1100 : 1600;
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
  if (!(zoom > 0)) return 0;
  const fits = (z: number) => z > 0 && z >= min - 1e-9 && z <= max + 1e-9 && z / zoom >= ZOOM_OUT - 1e-9 && z / zoom <= ZOOM_IN + 1e-9;
  for (const step of [art, 1]) {
    let best = 0;
    for (const z of [Math.floor(zoom / step) * step, Math.ceil(zoom / step) * step]) {
      if (fits(z) && (!best || Math.abs(Math.log(z / zoom)) < Math.abs(Math.log(best / zoom)))) best = z;
    }
    if (best) return best;
  }
  return 0;
}

/**
 * Насколько обычный кадр может быть мельче «впритык» ради ровного масштаба: на 15%. Дальше по бокам
 * уже широкие полосы газона, а люди и товар заметно мельче — тогда лучше дробный масштаб впритык.
 */
export const HOME_SLACK = 0.85;

/**
 * Масштаб обычного кадра. fit — «впритык»: крупнее нельзя, иначе за край экрана уйдёт флигель слева
 * (склад, пекарня, кофейня, кухня с табличками) или правая стена. Берём самый крупный ровный (кратный art)
 * не крупнее fit; нет такого — самый крупный целый; но не мельче fit больше чем на HOME_SLACK. Ни того
 * ни другого — сам fit, дробный: весь магазин в кадре важнее ровных пикселей.
 */
export function homeZoom(fit: number, art: number): number {
  if (!(fit > 0)) return 0;
  for (const step of [art, 1]) {
    // Запас на округление: fit бывает «ровно 5» с хвостом 4,999999…
    const z = Math.floor(fit / step + 1e-9) * step;
    if (z > 0 && z >= fit * HOME_SLACK - 1e-9) return z;
  }
  return fit;
}

/**
 * Обычный кадр: по ширине целиком отрезок мира span (здание с флигелем и запасом по бокам), по высоте —
 * viewH точек мира в availH пикселях холста (между верхней и нижней панелями). Масштаб — homeZoom,
 * середина по ширине — посередине отрезка, на целой точке мира (камера в покое не сдвинута на полпикселя).
 */
export function homeFrame(width: number, availH: number, span: { left: number; right: number }, viewH: number, art: number): { zoom: number; x: number } {
  const fit = Math.min(width / (span.right - span.left), availH / viewH);
  return { zoom: homeZoom(fit, art), x: Math.round((span.left + span.right) / 2) };
}
