#!/usr/bin/env node
// Запекание пиксельных эффектов pixelfx (https://github.com/patch-gg/pixelfx, MIT) в кадры атласа.
//
//   node scripts/fx-bake.mjs            кадры → public/assets/fx_*.png, описание → src/scenes/fxSheets.ts
//   node scripts/fx-bake.mjs --preview  ещё и листы-превью (увеличенные, на тёмном фоне) → promo/pixelfx-pilot/sheets/
//
// В игре pixelfx не работает вживую: его живой режим собирает весь кадр попиксельно на процессоре —
// слабым Android в Telegram это не по силам. Здесь эффект один раз проигрывается в Node, кадры
// приводятся к нашей сетке (одна точка эффекта — одна точка рисунка, ART = 2, или крупнее, если
// эффект велик для магазина), каждая точка перекрашивается в палитру Endesga 32 (PALETTE в
// art/sprites.py), а мягкий свет pixelfx ложится ступенями прозрачности. Кадры — обычные картинки
// public/assets: их складывает в лист сборка атласа (scripts/atlas.ts), Phaser играет их анимацией.
//
// pixelfx берётся из кэша вне src (node_modules/.cache/pixelfx, в репозиторий не попадает) на
// закреплённом коммите PIN; нет кэша — клонируется. Шрифт Patch Pixel (gallery/fonts) не MIT — не берём.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN = 'a841596';
const REPO = 'https://github.com/patch-gg/pixelfx.git';
const CACHE = process.env.PIXELFX_DIR ?? join(ROOT, 'node_modules', '.cache', 'pixelfx');
const ASSETS = join(ROOT, 'public', 'assets');
const PREVIEW = join(ROOT, 'promo', 'pixelfx-pilot', 'sheets');
const PREFIX = 'fx_';

// ---------- pixelfx на закреплённом коммите ----------

function ensurePixelfx() {
  const git = (...a) => execFileSync('git', ['-C', CACHE, ...a], { encoding: 'utf8' }).trim();
  if (!existsSync(join(CACHE, '.git'))) {
    mkdirSync(dirname(CACHE), { recursive: true });
    execFileSync('git', ['clone', '--quiet', REPO, CACHE], { stdio: 'inherit' });
  }
  if (!git('rev-parse', 'HEAD').startsWith(PIN)) {
    try {
      git('checkout', '--quiet', PIN);
    } catch {
      git('fetch', '--quiet', 'origin');
      git('checkout', '--quiet', PIN);
    }
  }
}

// ---------- палитра Endesga 32 из art/sprites.py ----------

function palette() {
  const src = readFileSync(join(ROOT, 'art', 'sprites.py'), 'utf8');
  const block = /^PALETTE = \{([\s\S]*?)^\}/m.exec(src)?.[1] ?? '';
  const list = [...new Set([...block.matchAll(/"#([0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase()))];
  if (list.length < 20) throw new Error(`палитра в art/sprites.py не нашлась (${list.length} цветов)`);
  return list.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
}

/** Ступени цвета Endesga 32 от тёмного к светлому — палитры эффектов (opts.palette у pixelfx). */
const RAMP = {
  gold: ['#3b2a35', '#733e39', '#8f563b', '#f77622', '#feae34', '#fee761', '#f8ebcf', '#ffffff'],
  water: ['#181425', '#262b44', '#3a4466', '#5a6988', '#8b9bb4', '#c0cbdc', '#ffffff'],
  firefly: ['#265c42', '#3e8948', '#63c74d', '#98c95a', '#fee761', '#ffffff'],
  // Салют печётся светлым: цвет каждому залпу даёт игра (tint) — один набор кадров на все цвета.
  white: ['#3a4466', '#5a6988', '#8b9bb4', '#c0cbdc', '#ffffff', '#ffffff', '#ffffff'],
  confetti: ['#e43b44', '#f77622', '#fee761', '#63c74d', '#0099db', '#b55088', '#2ce8f5'],
};

// ---------- что печём ----------

/**
 * Эффекты пилота. id — эффект pixelfx (или custom — свой маленький модуль на основе кода pixelfx),
 * fps — частота кадров в игре, down — во сколько раз крупнее точка эффекта точки рисунка (1 — ровно
 * в сетку ART), from/to — кусок по времени, front — без заднего слоя (тени), light — сколько света
 * pixelfx оставить (0…1), blend — как игра его рисует (add — светом поверх ночи).
 */
const EFFECTS = [
  // Рябь на луже: тёмную воду под кольцами pixelfx не берём (minLuma) — у нас своя лужа (puddle_wet); кольца
  // обрезаны по её овалу (clip — полуоси в точках эффекта).
  { key: 'ripple', id: 'water/ripples', fps: 15, down: 1, opts: { palette: RAMP.water }, light: 0.6, alphaMin: 0.3, minLuma: 0.45, only: RAMP.water, clip: [17, 5.5] },
  { key: 'firefly', custom: 'firefly', fps: 15, down: 1, opts: { palette: RAMP.firefly }, light: 1.6, alphaMin: 0.1, blend: 'add', only: RAMP.firefly },
  { key: 'coin', id: 'pickups/coin-spin', fps: 15, down: 1, front: true, opts: { palette: RAMP.gold }, light: 0.25, only: RAMP.gold },
  { key: 'coinpop', id: 'pickups/collect-burst', fps: 15, down: 2, opts: { palette: RAMP.gold }, light: 0.8, only: RAMP.gold },
  // Конфетти без хлопушек (mask — конусы у пола): в зале они стояли бы посреди плитки.
  { key: 'confetti', id: 'ui/confetti', fps: 12, down: 1, to: 2.4, opts: { palette: RAMP.confetti }, light: 0.3, mask: [[-74, -1, -0.95], [74, -1, -2.19]] },
  { key: 'firework', id: 'explosions/firework-burst', fps: 12, down: 2, from: 0.3, opts: { palette: RAMP.white, core: RAMP.white }, light: 1, blend: 'add' },
];

/**
 * Свой модуль: светлячок pixelfx (weather/fireflies, «близкий»: тёмное тельце, крылышки, фонарик на хвосте,
 * свет вокруг) — один, на месте, на один цикл свечения. Летает его по газону уже игра (твинами):
 * весь луг с травой в 320×180 точек нам не нужен. Рисунок — по firefly() из fireflies.js
 * (адаптация Sprite Fusion, Hugo Duprez, MIT).
 */
function customFirefly(core) {
  const { fit, mix, WHITE } = core;
  const D = 2;
  const pulse = (v) => (v < 0.06 ? v / 0.06 : v < 0.14 ? 1 : v < 0.4 ? 1 - (v - 0.14) / 0.26 : 0);
  return {
    meta: { name: 'Firefly', size: [24, 20], origin: [12, 10], duration: D, loop: true, fps: 30, options: { palette: RAMP.firefly } },
    draw(p, t, o) {
      const C = fit(o.palette, 6);
      const u = t / D;
      // Вспыхивает дважды за цикл, как у pixelfx «некоторые мигают дважды».
      const g = Math.max(pulse(u), pulse(u - 0.22) * 0.8);
      const beat = Math.floor(t * 30) % 2;
      const X = 0;
      const Y = 0;
      const dir = 1;
      p.px(X + dir, Y, C[0]);
      p.px(X + dir * 2, Y, C[0]);
      p.dot(X, Y - 1 - beat, mix(C[1], WHITE, 0.4), 0.7);
      p.dot(X + dir, Y - 1 - beat, mix(C[1], WHITE, 0.4), 0.7);
      p.px(X, Y, g > 0.3 ? C[5] : C[1]);
      p.px(X - dir, Y, g > 0.5 ? C[4] : g > 0.15 ? C[3] : C[1]);
      if (g > 0.6) p.px(X - dir, Y + 1, C[3]);
      if (g > 0.7) for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) p.dot(X - dir + dx, Y + dy, C[3], (g - 0.7) * 3);
      // Свет вокруг — поменьше, чем на лугу pixelfx: у нас светлячок — точка над газоном.
      p.glow(X, Y, 9, C[2], 0.45 * g);
      p.glow(X, Y, 4, C[4], 0.5 * g);
    },
  };
}

// ---------- кадры ----------

/** Уменьшить в k раз: среднее по квадрату k×k с учётом прозрачности. */
function downsample(rgba, w, h, k) {
  if (k === 1) return { data: rgba, w, h };
  const W = Math.ceil(w / k);
  const H = Math.ceil(h / k);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = Y * k; y < Math.min(h, Y * k + k); y++) {
        for (let x = X * k; x < Math.min(w, X * k + k); x++) {
          const i = (y * w + x) * 4;
          const pa = rgba[i + 3] / 255;
          r += rgba[i] * pa;
          g += rgba[i + 1] * pa;
          b += rgba[i + 2] * pa;
          a += pa;
          n++;
        }
      }
      // Точка из k×k: цвет — средний по закрашенным, прозрачность — по самой плотной доле (тонкая
      // искра в одну точку не должна исчезнуть при уменьшении).
      const j = (Y * W + X) * 4;
      if (a > 0) {
        out[j] = r / a;
        out[j + 1] = g / a;
        out[j + 2] = b / a;
        out[j + 3] = Math.min(255, (a / n) * 255 * Math.min(2, k / 1.5));
      }
    }
  }
  return { data: out, w: W, h: H };
}

/** Порядок 4×4 (Байер): мягкий свет становится ступенями и «шахматкой», как его рисуют руками. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Каждую точку — в ближайший цвет палитры; прозрачность — в 4 ступени с дизерингом, бледное — прочь. */
function remap(img, PAL, alphaMin, minLuma = 0) {
  const { data, w, h } = img;
  const cache = new Map();
  const near = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let hit = cache.get(key);
    if (hit) return hit;
    let best = PAL[0];
    let bd = Infinity;
    for (const c of PAL) {
      // Взвешенное расстояние (≈ восприятие): зелёный важнее, синий — меньше.
      const rm = (r + c[0]) / 2;
      const dr = r - c[0];
      const dg = g - c[1];
      const db = b - c[2];
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) (bd = d), (best = c);
    }
    cache.set(key, best);
    return best;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let a = data[i + 3] / 255;
      if (a < alphaMin || (minLuma && (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255 < minLuma)) {
        data[i + 3] = 0;
        continue;
      }
      const steps = 4;
      const q = Math.min(steps, Math.floor(a * steps + BAYER[(y & 3) * 4 + (x & 3)]));
      a = q / steps;
      if (a <= 0) {
        data[i + 3] = 0;
        continue;
      }
      const [r, g, b] = near(data[i], data[i + 1], data[i + 2]);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.round(a * 255);
    }
  }
  return img;
}

/** Общая рамка всех кадров: пустые края срезаются, точка отсчёта эффекта сдвигается вместе с ними. */
function trimAll(frames, w, h) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (const f of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (f[(y * w + x) * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  if (x1 < 0) return { frames, x: 0, y: 0, w, h };
  const W = x1 - x0 + 1;
  const H = y1 - y0 + 1;
  return {
    frames: frames.map((f) => {
      const out = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) out.set(f.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + W) * 4), y * W * 4);
      return out;
    }),
    x: x0,
    y: y0,
    w: W,
    h: H,
  };
}

async function bake(e, lib, core, PAL, encodePNG) {
  let fx;
  if (e.custom) {
    const mod = { ...customFirefly(core) };
    fx = { id: `custom/${e.custom}`, mod: { ...mod, meta: { bg: 'none', tags: [], ...mod.meta } }, meta: mod.meta };
  } else {
    fx = await lib.loadEffect(e.id);
    if (e.front) fx = { ...fx, mod: { ...fx.mod, drawBack: undefined } };
  }
  // Кадры по 1/fps игры; свет pixelfx — сколько велено (light), поверх прозрачности (как его «clear»).
  const r = lib.renderFrames(fx, { fps: e.fps, bg: 'none', actor: false, options: { ...(e.opts ?? {}), light: e.light ?? 1 } });
  const from = Math.round((e.from ?? 0) * e.fps);
  const to = e.to !== undefined ? Math.round(e.to * e.fps) : r.n;
  const [ox, oy] = fx.meta.origin;
  const picked = r.frames.slice(from, to).map((f) => {
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    core.composite({ w: r.w, h: r.h, color: f.raw, light: lightScaled(f.light, e.light ?? 1) }, out, null);
    if (e.clip) {
      const [rx, ry] = e.clip;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (((x - ox) / rx) ** 2 + ((y - oy) / ry) ** 2 > 1) out[(y * r.w + x) * 4 + 3] = 0;
    }
    // Маска: [x, y, угол] — конус хлопушки длиной 12 от точки (x, y) в координатах эффекта, стирается.
    for (const [mx, my, ang] of e.mask ?? []) {
      for (let k = 0; k <= 12; k++) {
        const cx = ox + mx + Math.cos(ang) * k;
        const cy = oy + my + Math.sin(ang) * k;
        for (let y = Math.floor(cy - 4); y <= cy + 4; y++) {
          for (let x = Math.floor(cx - 4); x <= cx + 4; x++) if (x >= 0 && y >= 0 && x < r.w && y < r.h && Math.hypot(x - cx, y - cy) <= 3.2) out[(y * r.w + x) * 4 + 3] = 0;
        }
      }
    }
    return out;
  });
  const pal = e.only ? e.only.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]) : PAL;
  const small = picked.map((f) => remap(downsample(f, r.w, r.h, e.down), pal, e.alphaMin ?? 0.2, e.minLuma));
  const W = small[0].w;
  const H = small[0].h;
  const trimmed = trimAll(
    small.map((s) => s.data),
    W,
    H,
  );
  // Каждая точка — цвет палитры игры (перекраска выше это и делает; здесь — сторож).
  const inPal = new Set(PAL.map(([r, g, b]) => (r << 16) | (g << 8) | b));
  for (const data of trimmed.frames) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] && !inPal.has((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])) throw new Error(`${e.key}: цвет не из палитры`);
    }
  }
  const keys = trimmed.frames.map((data, i) => {
    const key = `${PREFIX}${e.key}_${i}`;
    writeFileSync(join(ASSETS, `${key}.png`), encodePNG(trimmed.w, trimmed.h, data));
    return key;
  });
  return {
    key: e.key,
    source: e.id ?? `custom:${e.custom}`,
    frames: keys.length,
    fps: e.fps,
    loop: !!fx.meta.loop && e.from === undefined && e.to === undefined,
    w: trimmed.w,
    h: trimmed.h,
    // Точка эффекта (meta.origin pixelfx) внутри кадра, доля ширины и высоты — origin спрайта в Phaser.
    ox: +((ox / e.down - trimmed.x) / trimmed.w).toFixed(4),
    oy: +((oy / e.down - trimmed.y) / trimmed.h).toFixed(4),
    down: e.down,
    blend: e.blend ?? 'normal',
    images: trimmed.frames,
  };
}

/** Свет pixelfx с множителем k (light в описании эффекта). */
function lightScaled(L, k) {
  if (k === 1) return L;
  const out = new Uint32Array(L.length);
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (!(l & 0xffffff)) continue;
    out[i] = (l & 0xff000000) | Math.round((l & 255) * k) | (Math.round(((l >>> 8) & 255) * k) << 8) | (Math.round(((l >>> 16) & 255) * k) << 16);
  }
  return out;
}

/** Лист-превью для глаз: все кадры подряд, увеличенные в z раз, на тёмном и на светлом фоне. */
function preview(s, encodePNG) {
  const z = Math.max(2, Math.min(6, Math.floor(240 / Math.max(s.w, s.h))));
  const cols = Math.min(s.frames, Math.max(1, Math.floor(1600 / (s.w * z + 4))));
  const rows = Math.ceil(s.frames / cols);
  const cw = s.w * z + 4;
  const ch = s.h * z + 4;
  const W = cols * cw;
  const H = rows * ch * 2;
  const out = new Uint8ClampedArray(W * H * 4);
  const bgs = [
    [24, 20, 37],
    [90, 105, 136],
  ];
  for (let half = 0; half < 2; half++) {
    for (let y = half * rows * ch; y < (half + 1) * rows * ch; y++) for (let x = 0; x < W; x++) out.set([...bgs[half], 255], (y * W + x) * 4);
    s.images.forEach((img, n) => {
      const bx = (n % cols) * cw + 2;
      const by = half * rows * ch + Math.floor(n / cols) * ch + 2;
      for (let y = 0; y < s.h * z; y++) {
        for (let x = 0; x < s.w * z; x++) {
          const i = (Math.floor(y / z) * s.w + Math.floor(x / z)) * 4;
          const a = img[i + 3] / 255;
          if (!a) continue;
          const j = ((by + y) * W + bx + x) * 4;
          for (let c = 0; c < 3; c++) out[j + c] = s.blend === 'add' ? Math.min(255, out[j + c] + img[i + c] * a) : out[j + c] * (1 - a) + img[i + c] * a;
        }
      }
    });
  }
  return encodePNG(W, H, out);
}

async function main() {
  ensurePixelfx();
  const lib = await import(pathToFileURL(join(CACHE, 'tools', 'lib', 'fxlib.mjs')).href);
  const core = await import(pathToFileURL(join(CACHE, 'src', 'core', 'index.js')).href);
  const { encodePNG } = await import(pathToFileURL(join(CACHE, 'tools', 'lib', 'png.mjs')).href);
  const PAL = palette();
  // Ступени RAMP — только цвета палитры игры.
  const inPal = new Set(PAL.map((c) => c.map((v) => v.toString(16).padStart(2, '0')).join('')));
  for (const [name, ramp] of Object.entries(RAMP)) for (const h of ramp) if (!inPal.has(h.slice(1))) throw new Error(`RAMP.${name}: ${h} не из палитры Endesga 32`);
  // Старые кадры — прочь: число кадров могло уменьшиться.
  for (const f of readdirSync(ASSETS)) if (f.startsWith(PREFIX) && f.endsWith('.png')) rmSync(join(ASSETS, f));
  const sheets = [];
  for (const e of EFFECTS) {
    const s = await bake(e, lib, core, PAL, encodePNG);
    sheets.push(s);
    console.log(`${e.key.padEnd(9)} ${s.source.padEnd(26)} ${s.frames} кадров ${s.w}×${s.h} = ${s.frames * s.w * s.h} точек атласа`);
    if (process.argv.includes('--preview')) {
      mkdirSync(PREVIEW, { recursive: true });
      writeFileSync(join(PREVIEW, `${e.key}.png`), preview(s, encodePNG));
    }
  }
  console.log(`всего ${sheets.reduce((n, s) => n + s.frames * s.w * s.h, 0)} точек атласа`);
  const rows = sheets.map(({ images: _, ...s }) => `  ${s.key}: ${JSON.stringify(s)},`).join('\n');
  writeFileSync(
    join(ROOT, 'src', 'scenes', 'fxSheets.ts'),
    `// Создано scripts/fx-bake.mjs из pixelfx ${PIN} (MIT, NOTICE.md) — не править руками: поменять эффект там и перезапечь.
// Кадры лежат в public/assets/${PREFIX}<эффект>_<номер>.png и попадают в лист атласа (семейство ${PREFIX} в textures.ts).

export interface FxSheet {
  key: string;
  source: string;
  frames: number;
  fps: number;
  loop: boolean;
  w: number;
  h: number;
  /** Точка эффекта в кадре (доли ширины и высоты) — origin спрайта. */
  ox: number;
  oy: number;
  /** Во сколько раз точка эффекта крупнее точки рисунка: спрайт рисуется в масштабе down / ART. */
  down: number;
  blend: 'normal' | 'add';
}

export const FX_SHEETS = {
${rows}
} as const satisfies Record<string, FxSheet>;

export type FxKey = keyof typeof FX_SHEETS;

/** Имена кадров эффекта в атласе. */
export const fxFrames = (key: FxKey): string[] => Array.from({ length: FX_SHEETS[key].frames }, (_, i) => \`${PREFIX}\${key}_\${i}\`);

/** Все кадры всех эффектов — для списка картинок мира (worldTextures.ts). */
export const FX_TEXTURES: string[] = (Object.keys(FX_SHEETS) as FxKey[]).flatMap(fxFrames);
`,
  );
}

await main();
