// Свет и цвет по часу и погоде — чистые функции (их проверяют тесты, tests/daylight.test.ts): фон карты
// освещения (сколько света на улице и в зале без ламп, scenes/light.ts) и «фильтры» цветокоррекции
// (scenes/grade.ts) — персиковое утро, чистый полдень, золотой час, синие сумерки, ночь, дождь и снег.
// Без Phaser: сцена и её карта света только берут отсюда цвета и матрицы.

import type { Weather } from '../game/weather';

/** Перемножение цветов (как тинт). */
export function mulColor(a: number, b: number): number {
  const ch = (shift: number) => Math.round((((a >> shift) & 255) * ((b >> shift) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Цвет между ключевыми точками [доля, цвет]. */
export function lerpKeys(keys: [number, number][], p: number): number {
  const i = Math.max(0, keys.findIndex(([at]) => at >= p) - 1);
  const [a, ca] = keys[i];
  const [b, cb] = keys[Math.min(i + 1, keys.length - 1)];
  const t = b === a ? 0 : Math.min(1, Math.max(0, (p - a) / (b - a)));
  const mix = (shift: number) => Math.round(((ca >> shift) & 255) + (((cb >> shift) & 255) - ((ca >> shift) & 255)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/**
 * Фон улицы по ходу дня (доля дня 0…1, 1 — конец смены): днём белый (свет не трогает картинку — цвет
 * часа делает цветокоррекция, scenes/grade.ts), на закате тёплый, к ночи синий. Ночью без фонарей
 * улица тёмная, но силуэты читаются.
 */
const OUTDOOR: [number, number][] = [
  [0, 0xffffff],
  [0.72, 0xffffff],
  [0.8, 0xffeacc],
  [0.86, 0xf2bc94],
  [0.92, 0x8e96c8],
  [0.96, 0x6a72b0],
  [1, 0x525c98],
];
/** В снег сумерки голубые, а не песочные: снег отражает небо, и ночью на улице светлее. */
const SNOW_OUTDOOR: [number, number][] = [
  [0, 0xffffff],
  [0.72, 0xffffff],
  [0.84, 0xe6ecff],
  [0.92, 0xa8b4e4],
  [1, 0x6470ac],
];
/**
 * Фон зала без ламп: днём светло из окон, к ночи чуть темнее и прохладнее. Насколько темно ночью в зале,
 * решил автор: как было до карты освещения — в среднем зал ночью такой же светлый (замер по кадру зала
 * в полночь на всех трёх уровнях графики), а лампы и подсветка полок (их свет рисуется поверх фона)
 * — тёплые акценты, углы между ними лишь чуть темнее. Темнее не делать: товар, облачка желаний и ценники
 * под картой света темнеют вместе с залом.
 */
const INDOOR: [number, number][] = [
  [0, 0xffffff],
  [0.8, 0xffffff],
  [0.9, 0xe6e4ea],
  [1, 0xc8c4d4],
];
/** Погода приглушает свет снаружи: в дождь серо-синий, в грозу темнее, в снег чуть холодный. */
const WEATHER_TINT: Record<Weather, number> = { clear: 0xffffff, heat: 0xffffff, rain: 0xc8d0de, storm: 0xb0b8d0, snow: 0xf6f8ff, leaves: 0xffffff };
/** В дождь и в зале пасмурнее — свет из окон серый. */
const WEATHER_INDOOR: Record<Weather, number> = { clear: 0xffffff, heat: 0xffffff, rain: 0xeef0f6, storm: 0xe2e6f0, snow: 0xffffff, leaves: 0xffffff };
/** Свет отключили: в зале остаётся только то, что из окон, — днём сумрак, ночью почти темно. */
const BLACKOUT_INDOOR = 0x7a7aa4;

/** Фон карты: улица и зал (цвета, на которые умножается мир без своих источников света). */
export function ambientAt(p: number, weather: Weather, blackout: boolean): { outdoor: number; indoor: number } {
  const x = Math.min(1, Math.max(0, p));
  const outdoor = mulColor(lerpKeys(weather === 'snow' ? SNOW_OUTDOOR : OUTDOOR, x), WEATHER_TINT[weather]);
  const hall = mulColor(lerpKeys(INDOOR, x), WEATHER_INDOOR[weather]);
  return { outdoor, indoor: blackout ? mulColor(hall, BLACKOUT_INDOOR) : hall };
}

/** Насколько фон тёмный (0 — белый, свет не нужен; 1 — чёрный). */
export function darkness(color: number): number {
  return 1 - Math.min((color >> 16) & 255, (color >> 8) & 255, color & 255) / 255;
}

/**
 * «Фильтр»: баланс белого (множители каналов), насыщенность и контраст (1 — как есть), подъём теней
 * (lift — доля, на которую тёмное поднимается к цвету liftColor: тени утром персиковые, ночью синие).
 */
export interface Grade {
  r: number;
  g: number;
  b: number;
  sat: number;
  con: number;
  lift: number;
  liftColor: [number, number, number];
}

const NEUTRAL: Grade = { r: 1, g: 1, b: 1, sat: 1, con: 1, lift: 0, liftColor: [0, 0, 0] };

/** Фильтры по ходу смены (доля дня: 0 — 8:00, 1 — 20:00 и ночь). */
const DAY: [number, Grade][] = [
  // Персиковое утро: тёплый свет, мягкий контраст, розоватая дымка в тенях.
  [0, { r: 1.06, g: 0.99, b: 0.9, sat: 1.0, con: 0.95, lift: 0.055, liftColor: [1, 0.8, 0.74] }],
  [0.16, { r: 1.02, g: 1.0, b: 0.97, sat: 1.03, con: 0.99, lift: 0.02, liftColor: [1, 0.86, 0.8] }],
  // Чистый полдень: без оттенка, чуть сочнее и контрастнее.
  [0.3, { r: 1.0, g: 1.0, b: 1.0, sat: 1.05, con: 1.03, lift: 0, liftColor: [0, 0, 0] }],
  [0.6, { r: 1.0, g: 1.0, b: 0.99, sat: 1.05, con: 1.03, lift: 0, liftColor: [0, 0, 0] }],
  // Золотой час: тёплый, насыщенный, тени янтарные.
  [0.8, { r: 1.06, g: 1.0, b: 0.9, sat: 1.08, con: 1.04, lift: 0.02, liftColor: [1, 0.66, 0.36] }],
  // Закат: ещё теплее, тени розовеют.
  [0.86, { r: 1.07, g: 0.98, b: 0.9, sat: 1.08, con: 1.04, lift: 0.03, liftColor: [0.9, 0.5, 0.45] }],
  // Синие сумерки: холоднее и спокойнее, тени лиловые.
  [0.92, { r: 0.98, g: 0.98, b: 1.04, sat: 0.96, con: 1.02, lift: 0.04, liftColor: [0.42, 0.36, 0.78] }],
  // Ночь: тени густо-синие, цвета тише, а светлое чуть теплее — свет ламп остаётся тёплым, темнота синей.
  [1, { r: 1.02, g: 1.0, b: 0.97, sat: 0.94, con: 1.04, lift: 0.04, liftColor: [0.2, 0.26, 0.58] }],
];

/** Погода поверх часа: свой фильтр и насколько он перекрывает фильтр часа (днём). */
const WEATHER: Record<Weather, { grade: Grade; weight: number }> = {
  clear: { grade: NEUTRAL, weight: 0 },
  // Дождь: приглушённо, прохладно, серо-голубые тени.
  rain: { grade: { r: 0.97, g: 0.99, b: 1.04, sat: 0.72, con: 0.95, lift: 0.05, liftColor: [0.48, 0.54, 0.64] }, weight: 0.85 },
  storm: { grade: { r: 0.95, g: 0.97, b: 1.04, sat: 0.74, con: 1.01, lift: 0.05, liftColor: [0.3, 0.36, 0.52] }, weight: 0.85 },
  // Снег: светло и воздушно, голубой подъём теней, цвета мягче.
  snow: { grade: { r: 0.98, g: 1.0, b: 1.04, sat: 0.86, con: 0.95, lift: 0.06, liftColor: [0.82, 0.88, 1] }, weight: 0.7 },
  heat: { grade: { r: 1.06, g: 1.0, b: 0.9, sat: 1.08, con: 1.03, lift: 0.03, liftColor: [1, 0.86, 0.6] }, weight: 0.6 },
  leaves: { grade: { r: 1.04, g: 1.0, b: 0.94, sat: 1.05, con: 1.0, lift: 0.02, liftColor: [1, 0.8, 0.5] }, weight: 0.5 },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Смесь двух фильтров (t = 0 — первый, 1 — второй). */
export function mixGrade(a: Grade, b: Grade, t: number): Grade {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
    sat: lerp(a.sat, b.sat, t),
    con: lerp(a.con, b.con, t),
    // Подъём теней смешиваем вместе с его цветом: «сколько» и «какого» — иначе цвет мигнёт, когда подъём 0.
    lift: lerp(a.lift, b.lift, t),
    liftColor: [0, 1, 2].map((i) => {
      const total = lerp(a.lift, b.lift, t);
      return total > 0 ? (lerp(a.lift * a.liftColor[i], b.lift * b.liftColor[i], t) / total) : 0;
    }) as [number, number, number],
  };
}

/** Фильтр в этот момент: час дня (0…1) и погода. Ночью погода значит меньше — ночь есть ночь. */
export function gradeAt(p: number, weather: Weather): Grade {
  const x = Math.min(1, Math.max(0, p));
  const i = Math.max(0, DAY.findIndex(([at]) => at >= x) - 1);
  const [a, ga] = DAY[i];
  const [b, gb] = DAY[Math.min(i + 1, DAY.length - 1)];
  // Переход между фильтрами — по плавной кривой: смены «щелчком» не видно.
  const t = b === a ? 0 : (x - a) / (b - a);
  const time = mixGrade(ga, gb, t * t * (3 - 2 * t));
  const night = Math.min(1, Math.max(0, (x - 0.86) / 0.14));
  const { grade, weight } = WEATHER[weather];
  return mixGrade(time, grade, weight * (1 - 0.5 * night));
}

/** Яркость цвета (доли каналов, Rec. 709). */
const LUMA = [0.2126, 0.7152, 0.0722];

/**
 * Матрица 4×5 для ColorMatrix (по строкам; пятый столбец — сдвиг в единицах 0…255, как у Phaser):
 * баланс белого → насыщенность → контраст вокруг середины → подъём теней к цвету.
 */
export function gradeMatrix(g: Grade): number[] {
  const gain = [g.r, g.g, g.b];
  const k = g.con * (1 - g.lift);
  const out: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      // Насыщенность: s·E + (1 − s)·яркость; баланс белого — до неё (умножение столбца).
      const sat = (row === col ? g.sat : 0) + (1 - g.sat) * LUMA[col];
      out.push(k * sat * gain[col]);
    }
    const offset = (1 - g.lift) * 0.5 * (1 - g.con) + g.lift * g.liftColor[row];
    out.push(0, offset * 255);
  }
  out.push(0, 0, 0, 1, 0);
  return out;
}

/** Цвет, которым тот же фильтр ложится умножением (для лёгкой графики: только баланс белого, не ярче белого). */
export function gradeTint(g: Grade): number {
  const top = Math.max(g.r, g.g, g.b);
  const ch = (v: number) => Math.round(255 * Math.min(1, v / top));
  return (ch(g.r) << 16) | (ch(g.g) << 8) | ch(g.b);
}
