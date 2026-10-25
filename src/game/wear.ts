// Потёртый пол. Где ходят покупатели, плитка за дни теряет блеск: от двери к кассе и вдоль рядов
// проступает дорожка. Шаги за день считаются по сетке зала (клетка WEAR_CELL точек мира) — по
// настоящим людям, которые шли через зал (сцена раз в полсекунды смотрит, кто где идёт). Вечером
// день прибавляет потёртость там, где ходили больше всего, — самая хоженая клетка стирается
// за неделю. Швабра и уборщик её стирают, решётка у входа задерживает уличный песок.
// Сохраняется коротко: одна буква на клетку, а пустые места — сериями. Чистые расчёты — без Phaser:
// их проверяют тесты (tests/wear.test.ts).

/** Сторона клетки сетки потёртости в точках мира. */
export const WEAR_CELL = 8;
/** Сколько ступеней потёртости хранит сохранение: одна «цифра» на клетку. */
const LEVELS = 32;
const DIGITS = '0123456789abcdefghijklmnopqrstuv';
/** Серия пустых клеток: «z» и длина двумя цифрами (до 1023). Короче трёх — просто нули. */
const RUN = 'z';
const MAX_RUN = LEVELS * LEVELS - 1;

/** Сколько потёртости за день набирает самая хоженая клетка: дорожка видна дня через два, полная — через неделю. */
export const DAY_WEAR = 0.14;
/** Самой хоженой клеткой считается та, что хоженее 90% хоженых: случайный «пятачок» эталоном не станет. */
const HOT_SHARE = 0.9;
/**
 * Эталон не ниже стольких шагов (после размазывания по соседям — это примерно десяток проходов через
 * клетку за день): в тихий день пол почти не стирается, даже на самой хоженой дорожке.
 */
const MIN_HOT_STEPS = 4;
/** Совсем бледная потёртость — уже чистый пол: не хранится и не рисуется. */
const WEAR_FLOOR = 0.05;
/** За ночь пол чуть отходит (вечерняя уборка); с уборщиком — заметно. */
const NIGHT_FADE = 0.03;
const CLEANER_FADE = 0.2;
/** Решётка и воздушная завеса у входа (оборудование «Вход») задерживают песок с улицы. */
const ENTRANCE_GRIT = [1, 0.8, 0.6];
/** Швабра: в круге такого радиуса (точки мира) потёртость уходит, в середине — до MOP_KEEP. */
export const MOP_RADIUS = 12;
const MOP_KEEP = 0.35;

/** Сохранённая потёртость пола. */
export interface FloorWear {
  /** Для какого помещения: после расширения пол новый — потёртости нет. */
  level: number;
  cols: number;
  rows: number;
  /** По букве на клетку (ряд за рядом), пустые места — сериями «z». */
  data: string;
}

/** Сетка потёртости пола: столбцы и ряды клеток. */
export interface WearGrid {
  cols: number;
  rows: number;
}

/** Сетка для пола w × h точек мира (зал без задней стены). */
export const wearGrid = (w: number, h: number): WearGrid => ({ cols: Math.max(1, Math.ceil(w / WEAR_CELL)), rows: Math.max(1, Math.ceil(h / WEAR_CELL)) });

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Потёртость из сохранения (0…1 на клетку). Другое помещение, другая сетка или испорченная строка — чистый пол. */
export function decodeWear(saved: FloorWear | undefined, level: number, grid: WearGrid): Float32Array {
  const cells = new Float32Array(grid.cols * grid.rows);
  if (!saved || saved.level !== level || saved.cols !== grid.cols || saved.rows !== grid.rows || typeof saved.data !== 'string') return cells;
  let i = 0;
  const { data } = saved;
  for (let k = 0; k < data.length && i < cells.length; k++) {
    const ch = data[k];
    if (ch === RUN) {
      const hi = DIGITS.indexOf(data[k + 1] ?? '');
      const lo = DIGITS.indexOf(data[k + 2] ?? '');
      if (hi < 0 || lo < 0) return new Float32Array(cells.length);
      i += hi * LEVELS + lo;
      k += 2;
      continue;
    }
    const v = DIGITS.indexOf(ch);
    if (v < 0) return new Float32Array(cells.length);
    cells[i++] = v / (LEVELS - 1);
  }
  return cells;
}

/** Потёртость в сохранение. Пол чистый — нечего хранить (undefined). */
export function encodeWear(cells: Float32Array, level: number, grid: WearGrid): FloorWear | undefined {
  let data = '';
  let zeros = 0;
  let any = false;
  const flush = () => {
    while (zeros > 0) {
      if (zeros < 3) {
        data += '0'.repeat(zeros);
        zeros = 0;
        break;
      }
      const n = Math.min(zeros, MAX_RUN);
      data += RUN + DIGITS[Math.floor(n / LEVELS)] + DIGITS[n % LEVELS];
      zeros -= n;
    }
  };
  for (const v of cells) {
    const q = Math.round(clamp01(v) * (LEVELS - 1));
    if (!q) {
      zeros++;
      continue;
    }
    any = true;
    flush();
    data += DIGITS[q];
  }
  // Хвост из нулей не храним: недостающие клетки при чтении и так нули.
  return any ? { level, cols: grid.cols, rows: grid.rows, data } : undefined;
}

/** Шаг человека в точке (x, y) пола (от левого верхнего угла пола, точки мира). */
export function addStep(steps: Float32Array, grid: WearGrid, x: number, y: number, weight = 1): void {
  const cx = Math.floor(x / WEAR_CELL);
  const cy = Math.floor(y / WEAR_CELL);
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return;
  steps[cy * grid.cols + cx] += weight;
}

/** Шаги, размазанные по соседним клеткам (3×3): дорожка шире следа одного человека. */
function spread(steps: Float32Array, grid: WearGrid): Float32Array {
  const { cols, rows } = grid;
  const out = new Float32Array(steps.length);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          // Своя клетка весит вдвое больше соседних.
          const k = dx || dy ? 1 : 2;
          sum += steps[yy * cols + xx] * k;
          n += k;
        }
      }
      out[y * cols + x] = sum / n;
    }
  }
  return out;
}

/**
 * Конец дня: шаги дня — в потёртость. Сколько прибавит клетка — по тому, насколько она хожена против
 * самых хоженых (в маленьком ларьке дорожка проступает так же, как в супермаркете), потом ночь:
 * пол немного отходит, с уборщиком — заметнее. entrance — модель оборудования «Вход» (0…2).
 */
export function settleWear(cells: Float32Array, steps: Float32Array, grid: WearGrid, opts: { cleaner: boolean; entrance: number }): Float32Array {
  const walked = spread(steps, grid);
  const busy = [...walked].filter((v) => v > 0).sort((a, b) => a - b);
  const hot = Math.max(MIN_HOT_STEPS, busy.length ? busy[Math.min(busy.length - 1, Math.floor(busy.length * HOT_SHARE))] : 0);
  const gain = DAY_WEAR * (ENTRANCE_GRIT[opts.entrance] ?? ENTRANCE_GRIT[ENTRANCE_GRIT.length - 1]);
  const keep = 1 - (opts.cleaner ? CLEANER_FADE : NIGHT_FADE);
  const out = new Float32Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    const day = gain * Math.min(1, (walked[i] ?? 0) / hot);
    const v = clamp01(((cells[i] ?? 0) + day) * keep);
    out[i] = v < WEAR_FLOOR ? 0 : v;
  }
  return out;
}

/** Помыли пол в точке (x, y) пола: в круге MOP_RADIUS потёртость уходит, к краю — меньше. Было что мыть — true. */
export function mopWear(cells: Float32Array, grid: WearGrid, x: number, y: number, radius = MOP_RADIUS): boolean {
  let changed = false;
  const r = Math.ceil(radius / WEAR_CELL) + 1;
  const cx = Math.floor(x / WEAR_CELL);
  const cy = Math.floor(y / WEAR_CELL);
  for (let yy = cy - r; yy <= cy + r; yy++) {
    for (let xx = cx - r; xx <= cx + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= grid.cols || yy >= grid.rows) continue;
      const d = Math.hypot((xx + 0.5) * WEAR_CELL - x, (yy + 0.5) * WEAR_CELL - y) / radius;
      if (d >= 1) continue;
      const i = yy * grid.cols + xx;
      if (!cells[i]) continue;
      cells[i] *= MOP_KEEP + (1 - MOP_KEEP) * d * d;
      // Совсем бледное — уже чисто.
      if (cells[i] < WEAR_FLOOR) cells[i] = 0;
      changed = true;
    }
  }
  return changed;
}

/**
 * Самое потёртое место пола (середина клетки, точки мира от угла пола) — если потёрто не меньше min.
 * reach — куда можно подойти (не под мебелью): недоступные клетки пропускаем.
 */
export function wornSpot(cells: Float32Array, grid: WearGrid, min = 0.3, reach?: (x: number, y: number) => boolean): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let at = min;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < at) continue;
    const spot = { x: ((i % grid.cols) + 0.5) * WEAR_CELL, y: (Math.floor(i / grid.cols) + 0.5) * WEAR_CELL };
    if (reach && !reach(spot.x, spot.y)) continue;
    at = cells[i];
    best = spot;
  }
  return best;
}
