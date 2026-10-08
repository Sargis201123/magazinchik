// Обход мебели: люди идут не сквозь полки, а вокруг — по углам препятствий.
// Граф видимости: старт, цель и углы расширенных прямоугольников; кратчайший путь — Дейкстрой.
// Препятствий в зале мало (полки, касса, острова), так что считать дёшево.

import type { Point } from './layout';

/** Прямоугольник препятствия: левый верхний угол и размер. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (p: Point, r: Rect): boolean => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

/** Пересекает ли отрезок внутренность прямоугольника (касание краёв и углов — можно). */
export function crosses(a: Point, b: Point, r: Rect): boolean {
  const eps = 0.01;
  const x0 = r.x + eps;
  const x1 = r.x + r.w - eps;
  const y0 = r.y + eps;
  const y1 = r.y + r.h - eps;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Отсечение Лианга — Барски.
  for (const [p, q] of [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return t1 - t0 > 1e-6;
}

/**
 * Путь из from в to в обход препятствий. Возвращает точки после старта (последняя — to).
 * Препятствие, внутри которого стоит старт или цель, не мешает (из него можно выйти).
 * Если обойти нельзя — идём напрямик.
 */
export function findPath(from: Point, to: Point, obstacles: Rect[]): Point[] {
  const rects = obstacles.filter((r) => !inside(from, r) && !inside(to, r));
  const clear = (a: Point, b: Point) => rects.every((r) => !crosses(a, b, r));
  if (clear(from, to)) return [to];
  const pad = 0.5;
  const corners: Point[] = rects
    .flatMap((r) => [
      { x: r.x - pad, y: r.y - pad },
      { x: r.x + r.w + pad, y: r.y - pad },
      { x: r.x - pad, y: r.y + r.h + pad },
      { x: r.x + r.w + pad, y: r.y + r.h + pad },
    ])
    .filter((c) => rects.every((r) => !inside(c, r)));
  const nodes = [from, ...corners, to];
  const end = nodes.length - 1;
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === end) break;
    done[u] = true;
    for (let v = 0; v < nodes.length; v++) {
      if (done[v] || v === u) continue;
      const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y);
      if (d < dist[v] && clear(nodes[u], nodes[v])) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (dist[end] === Infinity) return [to];
  const path: Point[] = [];
  for (let i = end; i > 0; i = prev[i]) path.unshift(nodes[i]);
  return path;
}
