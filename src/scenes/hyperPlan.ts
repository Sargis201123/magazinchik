// Расстановка низа зала гипермаркета (scenes/hyperHall.ts): где встают уголок аттракционов, сезонная фотозона и
// скамья, и что от этого проходы не закрываются. Без Phaser - расчёты проверяют тесты (tests/hyperHall.test.ts).

import { HYPER_LEVEL, type StoreState } from '../game/economy';
import { yearTime } from '../game/calendar';
import { activeDecor } from '../game/decor';
import { overlapsRect, slotSide } from './placement';
import type { Layout, Point } from './layout';
import type { Rect } from './paths';

/** Что стоит внизу зала: уголок аттракционов, сезонная фотозона, скамья у касс. */
export type HyperPieceId = 'kids' | 'season' | 'bench';

export interface HyperPiece {
  id: HyperPieceId;
  /** Уголок аттракционов поменьше (коврик 44×28, без машинки): слева у входа стоит полка своей марки. */
  small?: boolean;
  /** Середина низа (точки мира): коврика - его середина, остального - низ подиума или скамьи. */
  x: number;
  y: number;
  /** Препятствие для обхода (в координатах человека, как scene.obstacles). */
  block: Rect;
  /** Сколько занимает на полу на вид - с ним не должно пересекаться ничто из игры. */
  body: Rect;
}

/**
 * Размеры на полу (точки мира). Человек стоит ногами на 8.5 точки ниже своей точки (persons.makePerson): препятствие
 * в его координатах - от «за предметом» (ноги на заднем крае) до «перед ним» (ноги на переднем).
 */
export const FEET = 8.5;
/**
 * Коврик уголка: 64×34 (автоматы с игрушками и капсулами и ракета - сзади, машинка-качалка - спереди справа) или,
 * когда места меньше, 44×28 (автомат с игрушками, капсулы и ракета).
 */
const MAT = { w: 64, h: 34 };
const MAT_SMALL = { w: 44, h: 28 };
/** Подиум фотозоны: 38 в ширину, на полу - 16 в глубину (картинка выше: ёлка, зонт). */
const PODIUM = { w: 38, d: 16 };
/** Скамья с кадкой: 34 в ширину, на полу - 14 в глубину (деревце выше). */
const BENCH = { w: 34, d: 14 };
/** Зазор до чужого: до мебели и мест игры, чтобы не стоять впритык. */
const PAD = 3;

/**
 * Места-кандидаты по порядку: первое свободное. Всё - в полосе между местами покупателей у нижнего ряда островов и
 * входом (там стоят ещё менеджер и охранник, тележки и корзинки). Уголок - слева от прохода к двери, фотозона - справа
 * от него, ближе к двери; скамья - выше фотозоны, у касс (вплотную к кассиру не встаёт). Слева у входа полка своей
 * марки - уголок поменьше, между ней и проходом к двери. Нет места у касс (витрина 18+, касса сдвинута) - скамья у
 * левой стены, между дверями пекарни и склада (уголок для этого чуть правее), или слева от прохода к двери.
 */
function candidates(layout: Layout, id: HyperPieceId, small = false): Point[] {
  const { door, h, w } = layout;
  const grid = (xs: number[], ys: number[]): Point[] => ys.flatMap((y) => xs.map((x) => ({ x, y })));
  // Маленький - над столиком дегустации у полки своей марки и над менеджером у входа.
  if (id === 'kids' && small) return grid([92, 90, 94, 88, 96], [h - 61, h - 60, h - 62, h - 58, h - 56, h - 54]);
  // Правее всего - вплотную к месту менеджера у входа: слева остаётся место скамье у стены.
  if (id === 'kids') return grid([72, 70, 74, 66, 78, 62, 86, 94], [h - 58, h - 56, h - 54, h - 60]);
  if (id === 'season') return grid([door.x + 42, door.x + 46, door.x + 50, door.x + 54], [h - 34, h - 38, h - 32, h - 42]);
  return [
    ...grid([w - 102, w - 104, w - 100, w - 106], [h - 64, h - 66, h - 62]),
    // Выше грузчика у двери склада и ниже двери пекарни.
    ...grid([20, 22], [h - 44, h - 42, h - 40, h - 46]),
    ...grid([92, 88, 96], [h - 60, h - 58]),
    ...grid([24, 28], [h - 38, h - 42]),
  ];
}

/** Как вещь лежит на полу и как её обходят, если поставить её в at. */
export function pieceAt(id: HyperPieceId, at: Point, small = false): HyperPiece {
  if (id === 'kids') {
    const mat = small ? MAT_SMALL : MAT;
    const body = { x: at.x - mat.w / 2, y: at.y - mat.h / 2, w: mat.w, h: mat.h };
    // По коврику не ходят: ноги не заходят ни на одну его клетку.
    return { id, ...at, ...(small ? { small } : {}), body, block: { x: body.x - 2, y: body.y - FEET - 1, w: body.w + 4, h: body.h + 2 } };
  }
  const size = id === 'season' ? PODIUM : BENCH;
  const body = { x: at.x - size.w / 2, y: at.y - size.d, w: size.w, h: size.d };
  return { id, ...at, body, block: { x: body.x - 2, y: body.y - FEET - 1, w: body.w + 4, h: body.h + 2 } };
}

/** Шаг сетки проверки проходов и запас вокруг препятствий (человек не протискивается вплотную). */
const CELL = 2;
const GROW = 3;
/** Насколько близко к цели достаточно подойти (клеток сетки). */
const NEAR = 3;

/**
 * Куда можно дойти от входа: заливка по сетке зала (клетки внутри препятствий, расширенных на GROW, закрыты).
 * Возвращает, для каких целей путь есть. Сетка грубее точного обхода (paths.ts) и строже его - ей можно верить.
 */
export function reachableTargets(layout: Layout, blockers: Rect[], from: Point, targets: Point[]): boolean[] {
  const { w, h, wallH } = layout;
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil((h - wallH) / CELL);
  const shut = new Uint8Array(cols * rows);
  for (const r of blockers) {
    const x0 = Math.max(0, Math.floor((r.x - GROW) / CELL));
    const x1 = Math.min(cols - 1, Math.ceil((r.x + r.w + GROW) / CELL) - 1);
    const y0 = Math.max(0, Math.floor((r.y - GROW - wallH) / CELL));
    const y1 = Math.min(rows - 1, Math.ceil((r.y + r.h + GROW - wallH) / CELL) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) shut[y * cols + x] = 1;
  }
  const seen = new Uint8Array(cols * rows);
  const sx = Math.floor(from.x / CELL);
  const sy = Math.floor((from.y - wallH) / CELL);
  const start = sx >= 0 && sx < cols && sy >= 0 && sy < rows ? sy * cols + sx : -1;
  if (start < 0 || shut[start]) return targets.map(() => false);
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % cols;
    const near = [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols];
    for (const j of near) {
      if (j < 0 || j >= seen.length || seen[j] || shut[j]) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  // Цель у самой мебели (начало очереди у стола кассы, место у полки) может попасть в закрытую клетку: дойти до неё -
  // значит дойти до любой открытой клетки рядом (в пределах NEAR клеток).
  return targets.map((p) => {
    const cx = Math.floor(p.x / CELL);
    const cy = Math.floor((p.y - wallH) / CELL);
    for (let dy = -NEAR; dy <= NEAR; dy++) {
      for (let dx = -NEAR; dx <= NEAR; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < cols && y >= 0 && y < rows && seen[y * cols + x]) return true;
      }
    }
    return false;
  });
}

/**
 * Расстановка низа зала: для каждой вещи - первое место из кандидатов, где она не задевает занятое (taken: всё, что
 * поставила игра, с местами людей) и не отрезает от входа ни одну цель, до которой путь был (blockers - препятствия
 * сцены). Нет такого места - вещи сегодня нет.
 */
export function planHyperHall(layout: Layout, taken: Rect[], blockers: Rect[], targets: Point[]): HyperPiece[] {
  const entry = { x: layout.door.x, y: layout.h - 8 };
  const before = reachableTargets(layout, blockers, entry, targets);
  const placed: HyperPiece[] = [];
  const inside = (r: Rect) => r.x >= 2 && r.x + r.w <= layout.w - 2 && r.y >= layout.wallH + 40 && r.y + r.h <= layout.h - 6;
  const options: [HyperPieceId, boolean][] = [['kids', false], ['kids', true], ['season', false], ['bench', false]];
  for (const [id, small] of options) {
    if (placed.some((p) => p.id === id)) continue;
    const fits = candidates(layout, id, small).map((at) => pieceAt(id, at, small)).find((piece) => {
      const area = { x: piece.body.x - PAD, y: piece.block.y - PAD, w: piece.body.w + 2 * PAD, h: piece.body.y + piece.body.h - piece.block.y + 2 * PAD };
      if (!inside(piece.body)) return false;
      if ([...taken, ...placed.map((p) => p.body)].some((r) => overlapsRect(area, r))) return false;
      const after = reachableTargets(layout, [...blockers, ...placed.map((p) => p.block), piece.block], entry, targets);
      return before.every((ok, i) => !ok || after[i]);
    });
    if (fits) placed.push(fits);
  }
  return placed;
}

/** Главный проход к кассам: полоса терракотовой плитки в полу (scenes/hyperHall.ts buildAisle). */
export interface HyperAisle {
  /** Левый и правый край полосы и её верх (точки мира). */
  x0: number;
  x1: number;
  y: number;
}

/** Высота полосы на полу и самая короткая полоса, которую стоит класть. */
export const AISLE_H = 24;
const AISLE_MIN = 140;

/**
 * Где лечь главному проходу: в проходе над нижним рядом островов (в стандартной расстановке - между четвёртым и
 * пятым рядом), от левой стены до касс. Полоса лежит в полу и никому не мешает (по ней ходят), но не заходит ни на
 * место под полку с её вставкой отдела и разметкой «+», ни к кассам и киоскам, ни к дверям флигеля и к витринам
 * (keep). Полки переставлены так, что ровного прохода у низа зала нет, - полосы нет.
 */
export function planAisle(layout: Layout, keep: Rect[]): HyperAisle | null {
  const { h } = layout;
  // Место под полку на полу: шапка, вставка отдела перед ней (до 19 точек ниже середины) и разметка «+»; у полки
  // боком у стены - длинная полка и вставка сбоку от неё (30×50).
  const spots = layout.slots.map((p) => (slotSide(layout, p) ? { x: p.x - 24, y: p.y - 28, w: 48, h: 56 } : { x: p.x - 22, y: p.y - 18, w: 44, h: 40 }));
  const blockers = [...spots, ...keep];
  for (const dy of [152, 148, 156, 144, 160, 140, 164]) {
    const y = h - dy - AISLE_H / 2;
    const band = (x: number, w: number): Rect => ({ x, y: y - 2, w, h: AISLE_H + 4 });
    const x0 = 2;
    if (blockers.some((r) => overlapsRect(band(x0, 8), r))) continue;
    // Вправо от стены - до первого, что на пути.
    let x1 = layout.w - 2;
    for (const r of blockers) if (overlapsRect(band(x0, layout.w), r) && r.x > x0) x1 = Math.min(x1, r.x - 4);
    if (x1 - x0 >= AISLE_MIN) return { x0, x1: Math.floor(x1), y };
  }
  return null;
}

/** Картинка сезонной фотозоны на сегодня. */
export function seasonArt(state: StoreState): string {
  const season = yearTime(state.day);
  // Новогодняя ёлка из украшений уже стоит у входа - зимой на подиуме снеговик с санками, а не вторая ёлка.
  const treeByDoor = activeDecor(state, 'holiday')?.id === 'holiday_tree';
  return season === 'winter' && treeByDoor ? 'hyper_season_snow' : `hyper_season_${season}`;
}

/**
 * От чего зависит низ зала гипермаркета помимо того, что и так перестраивает зал: полка своей марки и витрина 18+
 * (их покупают утром без перестройки, а встают они на места у входа и касс) и сезон фотозоны (сменился за ночь).
 * Изменилось - morningFlow перестраивает зал, иначе новая полка встала бы на скамью или коврик, а осенний стог
 * простоял бы до перезапуска всю новогоднюю неделю.
 */
export function hyperLook(state: StoreState): string {
  if (state.level < HYPER_LEVEL) return '';
  const has = (kind: string) => (state.shelves.some((sh) => sh.kind === kind) ? 1 : 0);
  return `${has('brand')}${has('license')}${seasonArt(state)}`;
}
