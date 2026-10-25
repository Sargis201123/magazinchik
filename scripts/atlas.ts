// Атлас: картинки мира, которые грузит Phaser (src/scenes/textures.ts), складываются при сборке
// в один-два больших листа. Восемь сотен отдельных текстур — это восемь сотен переключений
// видеокарты за кадр, а на телефонах Phaser рисует по одной текстуре за раз (MobilePipeline):
// каждое переключение — отдельный вызов отрисовки. С общим листом соседние спрайты рисуются
// одной пачкой. Собирает vite.config.ts (плагин atlas) — и в сборке, и в режиме разработки;
// игра раскладывает лист обратно по старым именам (BootScene), так что код сцены не меняется.

import { readdirSync, readFileSync } from 'node:fs';
import { atlasKeysFrom } from '../src/scenes/textures';
import { decodePng, encodePng, type Rgba } from './png';

/** Больше 2048 точек по стороне старые телефоны текстуру не возьмут. */
export const PAGE_MAX = 2048;
/** Ширины листа, из которых выбираем самую экономную раскладку. */
const PAGE_WIDTHS = [512, 1024, 2048];

/** Лист атласа: картинка и описание кадров в формате JSON Hash (как у ico_atlas). */
export interface AtlasPage {
  /** Имя текстуры листа и файлов: atlas0 → assets/atlas0.png и assets/atlas0.json. */
  name: string;
  png: Buffer;
  json: string;
  width: number;
  height: number;
}

export interface Atlas {
  pages: AtlasPage[];
  /** Картинки, которые в лист не влезли (больше листа): их игра грузит по одной, как раньше. */
  loose: string[];
}

interface Sprite {
  key: string;
  img: Rgba;
  x: number;
  y: number;
}

const isPow2 = (n: number): boolean => (n & (n - 1)) === 0;

/**
 * Раскладка «по линии горизонта»: каждую картинку (уже с рамкой) ставим туда, где она ляжет ниже
 * всего, при равенстве — с меньшей пустотой под ней. Возвращает места картинок или null, если
 * какая-то не влезла в высоту maxH.
 */
function skyline(sizes: { w: number; h: number }[], width: number, maxH: number): { x: number; y: number }[] | null {
  // Отрезки горизонта: [x, ширина, высота].
  let line: [number, number, number][] = [[0, width, 0]];
  const spots: { x: number; y: number }[] = [];
  for (const { w, h } of sizes) {
    let best: { i: number; y: number; waste: number } | null = null;
    for (let i = 0; i < line.length; i++) {
      if (line[i][0] + w > width) break;
      // Высота опоры под картинкой: самый высокий отрезок, на который она ляжет.
      let y = 0;
      let left = w;
      let waste = 0;
      for (let j = i; left > 0; j++) {
        y = Math.max(y, line[j][2]);
        left -= line[j][1];
      }
      if (y + h > maxH) continue;
      left = w;
      for (let j = i; left > 0; j++) {
        waste += (y - line[j][2]) * Math.min(left, line[j][1]);
        left -= line[j][1];
      }
      if (!best || y < best.y || (y === best.y && waste < best.waste)) best = { i, y, waste };
    }
    if (!best) return null;
    const x = line[best.i][0];
    spots.push({ x, y: best.y });
    // Новый отрезок поверх картинки, под ним срезаем перекрытые.
    const next: [number, number, number][] = [];
    for (const seg of line) {
      const [sx, sw, sh] = seg;
      if (sx + sw <= x || sx >= x + w) next.push(seg);
      else {
        if (sx < x) next.push([sx, x - sx, sh]);
        if (sx + sw > x + w) next.push([x + w, sx + sw - x - w, sh]);
      }
    }
    next.push([x, w, best.y + h]);
    next.sort((a, b) => a[0] - b[0]);
    // Соседние отрезки одной высоты сливаем.
    line = [];
    for (const seg of next) {
      const last = line[line.length - 1];
      if (last && last[2] === seg[2] && last[0] + last[1] === seg[0]) last[1] += seg[1];
      else line.push([...seg]);
    }
  }
  return spots;
}

/**
 * Рамка в 1 точку вокруг кадра повторяет то, что видеокарта брала за краем отдельной текстуры:
 * у текстуры со сторонами-степенями двойки Phaser включает повтор (за правым краем — левый),
 * у остальных — край тянется. Так при дробном масштабе на кромке ничего не меняется,
 * а сосед по листу не просвечивает.
 */
function blit(page: Uint8Array, pageW: number, { img, x, y }: Sprite): void {
  const { width: w, height: h, data } = img;
  const wrap = isPow2(w) && isPow2(h);
  const pick = (v: number, n: number): number => (wrap ? (v + n) % n : Math.min(n - 1, Math.max(0, v)));
  for (let dy = -1; dy <= h; dy++) {
    const sy = pick(dy, h);
    for (let dx = -1; dx <= w; dx++) {
      const sx = pick(dx, w);
      const from = (sy * w + sx) * 4;
      const to = ((y + 1 + dy) * pageW + x + 1 + dx) * 4;
      page[to] = data[from];
      page[to + 1] = data[from + 1];
      page[to + 2] = data[from + 2];
      page[to + 3] = data[from + 3];
    }
  }
}

/**
 * Что класть в атлас: спрайты из списка и семейства по именам файлов в dir (item_*, crate_*, w_*).
 * Игра собирает тот же список из своих данных (src/scenes/worldTextures.ts) — без экономики в сборке.
 */
export const atlasKeys = (dir: string): string[] => atlasKeysFrom(readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));

/** Сложить картинки dir/<key>.png в листы atlas0, atlas1… (второй — только если не влезло в один). */
export function buildAtlas(dir: string, keys: readonly string[]): Atlas {
  const loose: string[] = [];
  let rest: Sprite[] = [];
  for (const key of keys) {
    const img = decodePng(readFileSync(`${dir}/${key}.png`), `${key}.png`);
    if (img.width + 2 > PAGE_MAX || img.height + 2 > PAGE_MAX) loose.push(key);
    else rest.push({ key, img, x: 0, y: 0 });
  }
  // Высокие — первыми, при равенстве — по имени: одинаковые картинки всегда дают одинаковый лист.
  rest.sort((a, b) => b.img.height - a.img.height || b.img.width - a.img.width || (a.key < b.key ? -1 : 1));
  const pages: AtlasPage[] = [];
  while (rest.length) {
    // Пробуем ширины листа: всё влезло — берём меньшую площадь; не влезло никуда — лист 2048×2048
    // заполняем, сколько войдёт, остальное — на следующий.
    let chosen: { width: number; height: number; spots: { x: number; y: number }[]; count: number } | null = null;
    for (const width of PAGE_WIDTHS) {
      const spots = skyline(rest.map((s) => ({ w: s.img.width + 2, h: s.img.height + 2 })), width, PAGE_MAX);
      if (!spots) continue;
      const height = Math.ceil(Math.max(...spots.map((p, i) => p.y + rest[i].img.height + 2)) / 4) * 4;
      if (!chosen || width * height < chosen.width * chosen.height) chosen = { width, height, spots, count: rest.length };
    }
    if (!chosen) {
      // Жадно: сколько первых картинок помещается в полный лист.
      let lo = 1;
      let hi = rest.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (skyline(rest.slice(0, mid).map((s) => ({ w: s.img.width + 2, h: s.img.height + 2 })), PAGE_MAX, PAGE_MAX)) lo = mid;
        else hi = mid - 1;
      }
      const spots = skyline(rest.slice(0, lo).map((s) => ({ w: s.img.width + 2, h: s.img.height + 2 })), PAGE_MAX, PAGE_MAX)!;
      chosen = { width: PAGE_MAX, height: PAGE_MAX, spots, count: lo };
    }
    const placed = rest.slice(0, chosen.count);
    rest = rest.slice(chosen.count);
    placed.forEach((s, i) => Object.assign(s, chosen.spots[i]));
    const data = new Uint8Array(chosen.width * chosen.height * 4);
    for (const s of placed) blit(data, chosen.width, s);
    const name = `atlas${pages.length}`;
    // Кадры — в порядке имён: описание не зависит от порядка раскладки.
    const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
    for (const s of [...placed].sort((a, b) => (a.key < b.key ? -1 : 1))) {
      frames[s.key] = { frame: { x: s.x + 1, y: s.y + 1, w: s.img.width, h: s.img.height } };
    }
    const meta = { image: `${name}.png`, size: { w: chosen.width, h: chosen.height }, scale: '1' };
    pages.push({
      name,
      png: encodePng({ width: chosen.width, height: chosen.height, data }),
      json: JSON.stringify({ frames, meta }),
      width: chosen.width,
      height: chosen.height,
    });
  }
  return { pages, loose };
}
