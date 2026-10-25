// Живой пол. Мягкие тени у стен и под мебелью — как в жизни, пол уходит под шкаф и темнеет в углах;
// они запекаются в одну картинку при сборке зала и заново — только когда мебель переставили. В ту же
// картинку ложится потёртость пола (game/wear.ts): дорожки от двери к кассе по настоящим шагам
// покупателей. И газон без повтора: плитки травы вразнобой и с отражениями, поверх — большие мягкие
// пятна светлой и тёмной травы. Всё рисуется один раз: за кадр здесь ничего не считается.
// Модуль без Phaser во время выполнения (только типы) — расчёты проверяют тесты (tests/floor.test.ts).

import type Phaser from 'phaser';
import { WEAR_CELL } from '../game/wear';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Что запекать: всё в точках мира. */
export interface FloorPlan {
  /** Область картинки: зал и флигель. */
  area: Rect;
  /** Пол: зал, комнаты флигеля, проёмы дверей. Всё остальное в области — стены. */
  floors: Rect[];
  /** Проёмы наружу — за краем области там не стена, а улица (входная дверь). */
  openings: Rect[];
  /** Мебель: её пятно на полу. */
  casters: Rect[];
}

/** Тени пола: прозрачность тени на каждый пиксель картинки (0…255); NOT_FLOOR — не пол, там пусто. */
export interface ShadeMap {
  width: number;
  height: number;
  /** Пикселей картинки на точку мира. */
  scale: number;
  alpha: Uint8Array;
}

/** Потёртость для картинки пола: клетки (0…1) и где лежит сетка (левый верхний угол пола, точки мира). */
export interface WearLayer {
  cells: Float32Array;
  cols: number;
  rows: number;
  x: number;
  y: number;
}

export const NOT_FLOOR = 255;

/** Запас за краем области: тень от стены за краем тоже ложится на пол. */
const PAD = 8;
/** Контактная тень — у самой стены и мебели (полуширина размытия в точках мира) и её сила. */
const TIGHT = 10;
const TIGHT_ALPHA = 0.3;
/** Широкая тень от стен: пол у стен и в углах темнее, к середине зала светлеет. */
const BROAD = 16;
const BROAD_ALPHA = 0.16;
/** Свет сверху слева: тень мебели сдвинута вправо и вниз. */
const SHIFT_X = 0.5;
const SHIFT_Y = 1.5;
/** Передняя стенка мебели над полом (точки мира): пятно на полу — то, что ниже. */
const FACE = 10;
/** Шаг ступеней тени (из 255): тень ложится пиксельными ступенями с узором, а не гладкой заливкой. */
const STEP = 6;
/** Цвет тени — фиолетово-чернильный, как контур в рисунке (тени уходят в холодное). */
const INK = [32, 24, 52];
/**
 * Потёртость: тёплая серая матовость (плитка теряет блеск) — дорожка с мягкими краями, едва заметная,
 * и редкие короткие царапинки от подошв посреди самых хоженых мест. Тихо: пол живой, а не грязный.
 */
const WEAR_TONE = [122, 112, 106];
const WEAR_ALPHA = 0.24;
/** Матовость проступает с этой потёртости и набирает силу к полной: бледные краешки дорожки не рябят. */
const WEAR_FROM = 0.08;
const SCUFF_TONE = [104, 90, 82];
const SCUFF_ALPHA = 0.3;
/** Царапинки: с какой потёртости появляются и какая доля клеточек пола с царапинкой на самой хоженой дорожке. */
const SCUFF_FROM = 0.4;
const SCUFF_SHARE = 0.28;
/** Порядок Байера 4×4: ступени тени и потёртости — равномерным узором. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Мебель, которая отбрасывает тень на пол, — по имени картинки: полки, холодильники, кассы, ларь,
 * автомат, мебель флигеля (плита, печь, стойка, столики), растения, ведро, витрины-украшения.
 * Висящее на стене и стоящее на прилавке — нет.
 */
const FURNITURE =
  /^(?:(?:shelf|stand|fridge|drinks|chem)(?:_side)?|counter\d|icebox(?:_closed)?|florist|vending(?:_side)?|kiosk|coffee_bar|cafe_table|baker_table|bread_rack|oven\d?|stove\d|ktable|kshowcase|kcrate|plant(?:_big)?|bin\d|bin_t\d_\d|bargain_shelf\d|candy_rack|carts|baskets|fountain|jukebox|aquarium|gumball|lucky_cat2?|rack|autostore|pallet_jack|forklift|cat_house|cat_basket|flour_sacks)$/;

export const castsShadow = (key: string): boolean => FURNITURE.test(key);

/** Пятно мебели на полу по её картинке (рамка в мире): без передней стенки, со сдвигом от света. */
export function footprint(b: Rect): Rect {
  const face = Math.min(FACE, b.h * 0.35);
  return { x: b.x + 0.5 + SHIFT_X, y: b.y + face + SHIFT_Y, w: Math.max(1, b.w - 1), h: Math.max(1, b.h - face - 0.5) };
}

/** Пятна мебели на полу — по картинкам сцены (верхнего уровня, видимым). */
export function furnitureCasters(objects: readonly Phaser.GameObjects.GameObject[]): Rect[] {
  const out: Rect[] = [];
  for (const obj of objects) {
    if (obj.type !== 'Image') continue;
    const img = obj as Phaser.GameObjects.Image;
    if (!img.active || !img.visible || img.alpha < 0.5 || img.parentContainer || !castsShadow(img.texture.key)) continue;
    const b = img.getBounds();
    out.push(footprint({ x: b.x, y: b.y, w: b.width, h: b.height }));
  }
  return out;
}

/** Размытие «бегущим окном» по строкам или столбцам: радиус r пикселей, за краем — краевое значение. */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, vertical: boolean): void {
  const n = vertical ? h : w;
  const lines = vertical ? w : h;
  const step = vertical ? w : 1;
  const k = 1 / (2 * r + 1);
  const last = n - 1;
  for (let line = 0; line < lines; line++) {
    const base = vertical ? line : line * w;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[base + (i < 0 ? 0 : i > last ? last : i) * step];
    for (let i = 0; i < n; i++) {
      dst[base + i * step] = sum * k;
      const add = i + r + 1;
      const sub = i - r;
      sum += src[base + (add > last ? last : add) * step] - src[base + (sub < 0 ? 0 : sub) * step];
    }
  }
}

/** Мягкое размытие: три прохода окна по строкам и столбцам — почти как по Гауссу. halfWidth — докуда хватает (пиксели). */
export function blur(src: Float32Array, w: number, h: number, halfWidth: number): Float32Array {
  const r = Math.max(1, Math.round(halfWidth / 3));
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    boxPass(a, b, w, h, r, false);
    [a, b] = [b, a];
    boxPass(a, b, w, h, r, true);
    [a, b] = [b, a];
  }
  return a;
}

/** Ступенька с узором: значение 0…255 — к ближайшей ступени STEP, порог — по Байеру. */
const dither = (v: number, x: number, y: number): number => {
  const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  return Math.min(254, Math.floor(v / STEP + t) * STEP);
};

/** Насколько тень сильна по степени закрытости (у прямой стены 0,5, в углу — больше). */
const occlusion = (v: number): number => Math.min(1.5, Math.pow(Math.max(0, v) * 2, 1.25));
/** Та же сила тени заранее, по 1/1024 закрытости: в запекании — без степеней на каждый пиксель. */
const OCCLUSION = Float32Array.from({ length: 1025 }, (_, i) => occlusion(i / 1024));
const occlusionAt = (v: number): number => OCCLUSION[v <= 0 ? 0 : v >= 1 ? 1024 : Math.round(v * 1024)];

/** Закрасить прямоугольник мира r в сетке w × h (scale отсчётов на точку мира, запас pad отсчётов, начало — area). */
function fillRect(grid: Float32Array | Uint8Array, w: number, h: number, area: Rect, scale: number, pad: number, r: Rect, v: number): void {
  const x0 = Math.max(0, Math.round((r.x - area.x) * scale) + pad);
  const y0 = Math.max(0, Math.round((r.y - area.y) * scale) + pad);
  const x1 = Math.min(w, Math.round((r.x + r.w - area.x) * scale) + pad);
  const y1 = Math.min(h, Math.round((r.y + r.h - area.y) * scale) + pad);
  for (let y = y0; y < y1; y++) grid.fill(v, y * w + x0, y * w + Math.max(x0, x1));
}

/**
 * Тени пола: где пол, где стены, где мебель — и насколько каждый пиксель пола закрыт от света.
 * Две тени: широкая от стен (углы темнее) и контактная у стен и под мебелью. Края стен и мебели —
 * по пикселям картинки, а мягкие тени считаются по сетке в точку мира (они размыты на десяток
 * точек — подробнее не нужно) и берутся с неё плавно: в четыре раза меньше счёта при запекании.
 */
export function shadeMap(plan: FloorPlan, scale: number): ShadeMap {
  const { area } = plan;
  const width = Math.max(1, Math.round(area.w * scale));
  const height = Math.max(1, Math.round(area.h * scale));
  // Пол и мебель по пикселям картинки: 1 — пол (мебель), 0 — нет.
  const floor = new Uint8Array(width * height);
  const solid = new Uint8Array(width * height);
  for (const r of [...plan.floors, ...plan.openings]) fillRect(floor, width, height, area, scale, 0, r, 1);
  for (const r of plan.casters) fillRect(solid, width, height, area, scale, 0, r, 1);
  // Сетка теней — точка мира на отсчёт, с запасом за краем: 1 — закрыто (стена, мебель), 0 — открытый пол.
  const gw = Math.ceil(area.w) + 2 * PAD;
  const gh = Math.ceil(area.h) + 2 * PAD;
  const walls = new Float32Array(gw * gh).fill(1);
  for (const r of [...plan.floors, ...plan.openings]) fillRect(walls, gw, gh, area, 1, PAD, r, 0);
  const closed = Float32Array.from(walls);
  for (const r of plan.casters) fillRect(closed, gw, gh, area, 1, PAD, r, 1);
  const broad = blur(walls, gw, gh, BROAD);
  const tight = blur(closed, gw, gh, TIGHT);
  // Где на сетке теней каждый столбец картинки: два соседних отсчёта и доля между ними.
  const gx0 = new Int32Array(width);
  const gtx = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const g = Math.min(gw - 1.001, Math.max(0, (x + 0.5) / scale - 0.5 + PAD));
    gx0[x] = Math.floor(g);
    gtx[x] = g - gx0[x];
  }
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const g = Math.min(gh - 1.001, Math.max(0, (y + 0.5) / scale - 0.5 + PAD));
    const top = Math.floor(g) * gw;
    const bottom = top + gw;
    const ty = g - Math.floor(g);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!floor[i]) {
        alpha[i] = NOT_FLOOR;
        continue;
      }
      const a0 = top + gx0[x];
      const b0 = bottom + gx0[x];
      const tx = gtx[x];
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      const wide = broad[a0] * w00 + broad[a0 + 1] * w10 + broad[b0] * w01 + broad[b0 + 1] * w11;
      const near = solid[i] ? 0 : tight[a0] * w00 + tight[a0 + 1] * w10 + tight[b0] * w01 + tight[b0 + 1] * w11;
      const a = BROAD_ALPHA * occlusionAt(wide) + TIGHT_ALPHA * (solid[i] ? 1.2 : occlusionAt(near));
      alpha[i] = dither(a * 255, x, y);
    }
  }
  return { width, height, scale, alpha };
}

/** Простое «случайное» число 0…1 по двум целым: царапинки на одних и тех же местах при каждой перерисовке. */
const hash = (x: number, y: number, salt: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Потёртость в точке мира (x, y): между серединами клеток — плавно. */
export function wearAt(wear: WearLayer, x: number, y: number): number {
  const fx = (x - wear.x) / WEAR_CELL - 0.5;
  const fy = (y - wear.y) / WEAR_CELL - 0.5;
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  const tx = fx - cx;
  const ty = fy - cy;
  const at = (i: number, j: number) => {
    const xx = Math.min(wear.cols - 1, Math.max(0, i));
    const yy = Math.min(wear.rows - 1, Math.max(0, j));
    return wear.cells[yy * wear.cols + xx];
  };
  // За краем сетки (стены, флигель) — нет потёртости.
  if (x < wear.x || y < wear.y || x >= wear.x + wear.cols * WEAR_CELL || y >= wear.y + wear.rows * WEAR_CELL) return 0;
  const top = at(cx, cy) * (1 - tx) + at(cx + 1, cy) * tx;
  const bottom = at(cx, cy + 1) * (1 - tx) + at(cx + 1, cy + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Плавная ступенька 0…1 между a и b. */
const smooth = (v: number, a: number, b: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Царапинка от подошвы в пикселе (px, py): пол поделён на клеточки, в редких из них — своя короткая
 * чёрточка (вдоль хода или чуть наискосок), и она проступает, когда потёртость выше её порога. Чем пол
 * потёртее, тем царапинок больше (но не больше SCUFF_SHARE клеточек), а старые остаются на своих местах.
 */
export function scuffAt(px: number, py: number, scale: number, wear: number): boolean {
  if (wear <= SCUFF_FROM) return false;
  const size = scale >= 2 ? 7 : 4;
  const bx = Math.floor(px / size);
  const by = Math.floor(py / size);
  if (hash(bx, by, 1) >= SCUFF_SHARE * smooth(wear, SCUFF_FROM, 1)) return false;
  const len = scale >= 2 ? 2 + Math.floor(hash(bx, by, 2) * 2) : 1 + Math.floor(hash(bx, by, 2) * 2);
  const dir = hash(bx, by, 3);
  const dy = dir < 0.7 ? 0 : dir < 0.85 ? 1 : -1;
  const sx = Math.floor(hash(bx, by, 4) * (size - len + 1));
  const sy = 1 + Math.floor(hash(bx, by, 5) * (size - 2));
  const lx = px - bx * size - sx;
  const ly = py - by * size;
  return lx >= 0 && lx < len && ly === sy + dy * lx;
}

/**
 * Пиксели картинки пола в прямоугольнике [x0, x1) × [y0, y1) (пиксели картинки) — в data (RGBA, ширина
 * прямоугольника): потёртость снизу, тень поверх.
 */
export function paintFloor(map: ShadeMap, area: Rect, wear: WearLayer | null, data: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number): void {
  const w = x1 - x0;
  const s = map.scale;
  // Чистый пол (новый магазин, всё отмыто) рисуется без потёртости — быстрее.
  const worn = wear && wear.cells.some((v) => v > 0.02) ? wear : null;
  // Потёртость между клетками — плавно, как wearAt, но разом: для каждого столбца картинки заранее две
  // соседние клетки сетки и доля между ними (-1 — столбец за краем сетки), для строки — так же.
  const clamp = (v: number, n: number) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
  const c0 = new Int32Array(w).fill(-1);
  const c1 = new Int32Array(w);
  const ct = new Float32Array(w);
  if (worn) {
    for (let x = x0; x < x1; x++) {
      const wx = area.x + (x + 0.5) / s;
      if (wx < worn.x || wx >= worn.x + worn.cols * WEAR_CELL) continue;
      const fx = (wx - worn.x) / WEAR_CELL - 0.5;
      const c = Math.floor(fx);
      c0[x - x0] = clamp(c, worn.cols);
      c1[x - x0] = clamp(c + 1, worn.cols);
      ct[x - x0] = fx - c;
    }
  }
  for (let y = y0; y < y1; y++) {
    let r0 = -1;
    let r1 = 0;
    let ty = 0;
    if (worn) {
      const wy = area.y + (y + 0.5) / s;
      if (wy >= worn.y && wy < worn.y + worn.rows * WEAR_CELL) {
        const fy = (wy - worn.y) / WEAR_CELL - 0.5;
        const r = Math.floor(fy);
        r0 = clamp(r, worn.rows) * worn.cols;
        r1 = clamp(r + 1, worn.rows) * worn.cols;
        ty = fy - r;
      }
    }
    for (let x = x0; x < x1; x++) {
      const o = ((y - y0) * w + (x - x0)) * 4;
      const shade = map.alpha[y * map.width + x];
      if (shade === NOT_FLOOR) {
        data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
        continue;
      }
      let aw = 0;
      let tone = WEAR_TONE;
      const k = x - x0;
      if (worn && r0 >= 0 && c0[k] >= 0) {
        const cells = worn.cells;
        const t = ct[k];
        const v = (cells[r0 + c0[k]] * (1 - t) + cells[r0 + c1[k]] * t) * (1 - ty) + (cells[r1 + c0[k]] * (1 - t) + cells[r1 + c1[k]] * t) * ty;
        if (v > 0.02) {
          if (scuffAt(x, y, s, v)) {
            aw = SCUFF_ALPHA * Math.min(1, v);
            tone = SCUFF_TONE;
          } else aw = dither(WEAR_ALPHA * smooth(v, WEAR_FROM, 1) * 255, x, y) / 255;
        }
      }
      const as = shade / 255;
      const a = as + aw * (1 - as);
      if (a <= 0) {
        data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
        continue;
      }
      // Тень поверх потёртости (обычное наложение двух полупрозрачных слоёв).
      const kw = (aw * (1 - as)) / a;
      const ks = as / a;
      data[o] = INK[0] * ks + tone[0] * kw;
      data[o + 1] = INK[1] * ks + tone[1] * kw;
      data[o + 2] = INK[2] * ks + tone[2] * kw;
      data[o + 3] = a * 255;
    }
  }
}

/** Подпись расстановки: та же — тени пересчитывать не нужно. */
const signature = (plan: FloorPlan, scale: number): string =>
  JSON.stringify([scale, plan.area, plan.floors, plan.openings, plan.casters.map((r) => [r.x, r.y, r.w, r.h].map((v) => Math.round(v * 2)))]);

/**
 * Картинка пола поверх плитки (под мебелью и людьми): тени и потёртость. Своя текстура-холст на всю
 * игру — после пересборки зала картинка создаётся заново, а тени пересчитываются, только если
 * расстановка другая. Холст живёт в памяти, поэтому после потери WebGL картинка восстанавливается сама.
 */
export class FloorShade {
  private map: ShadeMap | null = null;
  private area: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private image?: Phaser.GameObjects.Image;
  private wear: WearLayer | null = null;
  private sig = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly key = 'floor_shade',
  ) {}

  /** Картинка пола есть в этом мире (после пересборки зала — ещё нет, пока не запекли). */
  ready(): boolean {
    return Boolean(this.image?.active);
  }

  /** Спрятать (перестановка: мебель — призраки, старые тени только путали бы). Запекание показывает снова. */
  hide(): void {
    if (this.image?.active) this.image.setVisible(false);
  }

  /** Запечь тени по расстановке (та же — взять готовые) и показать картинку на глубине depth. */
  bake(plan: FloorPlan, scale: number, depth: number, wear: WearLayer | null): void {
    const sig = signature(plan, scale);
    const fresh = sig !== this.sig || !this.map || !this.scene.textures.exists(this.key);
    this.wear = wear;
    if (fresh) {
      this.sig = sig;
      this.area = { ...plan.area };
      this.map = shadeMap(plan, scale);
    }
    const map = this.map!;
    let tex = this.scene.textures.exists(this.key) ? (this.scene.textures.get(this.key) as Phaser.Textures.CanvasTexture) : null;
    if (tex && (tex.width !== map.width || tex.height !== map.height)) {
      if (this.image?.active) this.image.destroy();
      this.scene.textures.remove(this.key);
      tex = null;
    }
    tex ??= this.scene.textures.createCanvas(this.key, map.width, map.height);
    if (!tex) return;
    this.paint();
    if (!this.image?.active) this.image = this.scene.add.image(this.area.x, this.area.y, this.key).setOrigin(0).setScale(1 / map.scale);
    this.image.setPosition(this.area.x, this.area.y).setDepth(depth).setVisible(true);
  }

  /** Потёртость поменялась (конец дня, помыли пол): перерисовать её — весь пол или только around (точки мира). */
  setWear(wear: WearLayer | null, around?: Rect): void {
    this.wear = wear;
    if (!this.map || !this.scene.textures.exists(this.key)) return;
    this.paint(around);
  }

  private paint(around?: Rect): void {
    const map = this.map;
    if (!map) return;
    const tex = this.scene.textures.get(this.key) as Phaser.Textures.CanvasTexture;
    const s = map.scale;
    const x0 = around ? Math.max(0, Math.floor((around.x - this.area.x) * s)) : 0;
    const y0 = around ? Math.max(0, Math.floor((around.y - this.area.y) * s)) : 0;
    const x1 = around ? Math.min(map.width, Math.ceil((around.x + around.w - this.area.x) * s)) : map.width;
    const y1 = around ? Math.min(map.height, Math.ceil((around.y + around.h - this.area.y) * s)) : map.height;
    if (x1 <= x0 || y1 <= y0) return;
    const img = tex.context.createImageData(x1 - x0, y1 - y0);
    paintFloor(map, this.area, this.wear, img.data, x0, y0, x1, y1);
    tex.context.putImageData(img, x0, y0);
    tex.refresh();
  }
}

// ---------- Газон ----------

/** Сторона плитки газона в полосе grass_set (пиксели рисунка) и сколько плиток в большой текстуре по стороне. */
const LAWN_TILE = 64;
const LAWN_VARIANTS = 4;
const LAWN_GRID = 8;

/** Короткий честный генератор случайных чисел (mulberry32): газон одинаковый от запуска к запуску. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Раскладка газона: для каждой плитки — вид (0…3) и отражения. Соседние плитки (слева, справа, сверху,
 * снизу, в том числе через край — текстура повторяется) — разных видов: одна и та же плитка рядом, даже
 * отражённая, сложилась бы в заметный «узор в зеркале». Сначала вразнобой, потом несколько проходов
 * починки: плитке, у которой сосед того же вида, — вид, которого нет у соседей.
 */
export function lawnLayout(seed: number, grid = LAWN_GRID): { v: number; fx: boolean; fy: boolean }[] {
  const next = rng(seed);
  const out = Array.from({ length: grid * grid }, () => ({ v: Math.floor(next() * LAWN_VARIANTS), fx: next() < 0.5, fy: next() < 0.5 }));
  const at = (x: number, y: number) => out[((y + grid) % grid) * grid + ((x + grid) % grid)];
  const near = (i: number) => {
    const x = i % grid;
    const y = Math.floor(i / grid);
    return [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].map((n) => n.v);
  };
  for (let pass = 0; pass < 16; pass++) {
    let clash = false;
    out.forEach((cell, i) => {
      const used = near(i);
      if (!used.includes(cell.v)) return;
      clash = true;
      const free = [0, 1, 2, 3].filter((v) => !used.includes(v));
      if (free.length) cell.v = free[Math.floor(next() * free.length)];
      else cell.v = Math.floor(next() * LAWN_VARIANTS);
    });
    if (!clash) break;
  }
  return out;
}

/**
 * Большая текстура газона (512×512, в мире 256×256) из четырёх плиток grass_set вразнобой и с
 * отражениями. Края у плиток — ровная трава, поэтому стыков не видно, а повтор — раз в 256 точек.
 * Без полосы плиток (не догрузилась) — прежний газон.
 */
export function lawnTexture(scene: Phaser.Scene, key = 'lawn_mix'): string {
  if (scene.textures.exists(key)) return key;
  const frame = scene.textures.getFrame('grass_set');
  if (!frame || frame.cutWidth < LAWN_TILE * LAWN_VARIANTS) return 'grass';
  const size = LAWN_TILE * LAWN_GRID;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) return 'grass';
  const ctx = canvas.context;
  ctx.imageSmoothingEnabled = false;
  const source = frame.source.image as CanvasImageSource;
  lawnLayout(20261025).forEach(({ v, fx, fy }, i) => {
    const x = (i % LAWN_GRID) * LAWN_TILE;
    const y = Math.floor(i / LAWN_GRID) * LAWN_TILE;
    ctx.setTransform(fx ? -1 : 1, 0, 0, fy ? -1 : 1, x + (fx ? LAWN_TILE : 0), y + (fy ? LAWN_TILE : 0));
    ctx.drawImage(source, frame.cutX + v * LAWN_TILE, frame.cutY, LAWN_TILE, LAWN_TILE, 0, 0, LAWN_TILE, LAWN_TILE);
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.refresh();
  return key;
}

/** Размер клетки мягких пятен газона в точках мира: пятна крупные, видны издалека. */
const PATCH = 16;
/** Тёмная и светлая трава в пятнах и насколько они заметны. */
const PATCH_DARK = [66, 122, 44];
const PATCH_DARK_ALPHA = 0.1;
const PATCH_LIGHT = [214, 236, 128];
const PATCH_LIGHT_ALPHA = 0.09;

/** Плавный шум 0…1 по решётке шага cell (клетки), значения в узлах — свои для каждого seed. */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const tx = sm(fx - cx);
  const ty = sm(fy - cy);
  const top = hash(cx, cy, seed) * (1 - tx) + hash(cx + 1, cy, seed) * tx;
  const bottom = hash(cx, cy + 1, seed) * (1 - tx) + hash(cx + 1, cy + 1, seed) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Пятна газона: RGBA холста cols × rows клеток (по PATCH точек мира). Без повтора — шум не периодичен. */
export function lawnPatches(cols: number, rows: number, seed: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(cols * rows * 4);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = 0.62 * valueNoise(x, y, 7, seed) + 0.38 * valueNoise(x, y, 3, seed + 1);
      const o = (y * cols + x) * 4;
      if (v < 0.42) {
        data.set(PATCH_DARK, o);
        data[o + 3] = ((0.42 - v) / 0.42) * PATCH_DARK_ALPHA * 255 * 1.6;
      } else if (v > 0.6) {
        data.set(PATCH_LIGHT, o);
        data[o + 3] = ((v - 0.6) / 0.4) * PATCH_LIGHT_ALPHA * 255 * 1.6;
      }
    }
  }
  return data;
}

/**
 * Мягкие пятна светлой и тёмной травы поверх газона на всю область rect (точки мира): одна маленькая
 * текстура с плавным (не пиксельным) растяжением. Ставится сразу после газона — под дорожками и домами.
 */
export function lawnShade(scene: Phaser.Scene, rect: Rect, depth: number, key = 'lawn_shade'): Phaser.GameObjects.Image | null {
  const cols = Math.ceil(rect.w / PATCH) + 1;
  const rows = Math.ceil(rect.h / PATCH) + 1;
  let tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : null;
  if (tex && (tex.width !== cols || tex.height !== rows)) {
    scene.textures.remove(key);
    tex = null;
  }
  if (!tex) {
    tex = scene.textures.createCanvas(key, cols, rows);
    if (!tex) return null;
    const img = tex.context.createImageData(cols, rows);
    img.data.set(lawnPatches(cols, rows, 11));
    tex.context.putImageData(img, 0, 0);
    tex.refresh();
    // Плавное растяжение: пятна без ступенек (0 — LINEAR в Phaser.Textures.FilterMode).
    tex.setFilter(0);
  }
  return scene.add.image(rect.x - PATCH / 2, rect.y - PATCH / 2, key).setOrigin(0).setScale(PATCH).setDepth(depth);
}
