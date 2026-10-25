// Картинки мира в меню — из листов атласа, а не отдельными файлами. Листы (atlas0, ico_atlas) Phaser
// уже скачал при загрузке; меню вырезает из них нужный кадр в маленький холст и ставит его адресом
// data:, так что вкладка оформления или оборудования не качает по сети десятки PNG по одному.
// Чего в листах нет (портреты, газеты, значки достижений) — по-прежнему файлом из assets/.

import { assetUrl, png } from '../platform/assets';

/** Кадр в листе: картинка листа и прямоугольник внутри неё. */
export interface SheetCut {
  image: CanvasImageSource;
  x: number;
  y: number;
  w: number;
  h: number;
}

let find: ((key: string) => SheetCut | null) | null = null;
const cache = new Map<string, string>();

/** Откуда брать кадры: зовёт BootScene, когда листы загружены и разложены по именам. */
export function useSheet(lookup: (key: string) => SheetCut | null): void {
  find = lookup;
}

/** Картинка мира по имени для <img>/CSS: из листа атласа, если она там есть, иначе — файл assets/<имя>.png. */
export function sheetPng(key: string): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const cut = find?.(key);
  if (!cut) return png(key);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = cut.w;
    canvas.height = cut.h;
    canvas.getContext('2d')!.drawImage(cut.image, cut.x, cut.y, cut.w, cut.h, 0, 0, cut.w, cut.h);
    const url = canvas.toDataURL('image/png');
    cache.set(key, url);
    return url;
  } catch {
    // Лист с чужого адреса (холст «испорчен») или нет памяти под холст — дальше всё файлами.
    find = null;
    return png(key);
  }
}

/** То же для пути вида 'assets/<имя>.png' (плитки и превью оформления хранят путь целиком). */
export const sheetAsset = (path: string): string => {
  const m = /^assets\/([\w-]+)\.png$/.exec(path);
  return m ? sheetPng(m[1]) : assetUrl(path);
};
