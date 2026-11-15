// Двери этажей в фасаде (13.11): спуск в подвал (basementFx.ts), дверь «Одежды» (clothesFx.ts), лифт фудкорта
// (foodcourtFx.ts) — где они стоят и сколько тротуара перед собой занимают.
//
// 14.11, аудит: тележка Кости (dreamsFx.ts), стойка проката (rentalFx.ts) и торговец сезона (tenantsFx.pitchSpot)
// выбирали место у входа, не зная о дверях этажей, — тележка вставала ровно на табличку «🪜 Подвал» и забирала
// касания, стойка закрывала низ двери «Одежды». Теперь они обходят floorDoorSpans. Модуль без сцен и Phaser: его
// читают и сами двери, и всё, что встаёт на тротуар (без кругов импорта через camera/nav).

import type { StoreScene } from './StoreScene';
import { hasFloor } from '../game/floors';
import { inZar } from '../game/zarshop';
import { FACADE_H } from './common';

/** Насколько точка фасада далеко от фонаря на тротуаре (фонари — через 72 от −100, tenantsFx.nearLamp). */
export const lampGap = (x: number): number => {
  const m = (((x + 100) % 72) + 72) % 72;
  return Math.min(m, 72 - m);
};

/** Зелёный мусорный контейнер на тротуаре у левого угла (building.dumpSpot): середина и полуширина картинки. */
export const DUMP_X = 18;
const DUMP_HALF = 12;
/** Полуширина лифта фудкорта (fc_lift — 12 точек). */
const LIFT_HALF = 6;

/**
 * Где спуск: дверь в фасаде у правого угла зала (низ — у тротуара). 13.11: сначала стоял снаружи у правой стены, но
 * тротуар там в четыре точки — приямок налезал на дорогу. Место — первое у угла, где не мешает фонарь и далеко до входа.
 */
export function hatchSpot(scene: StoreScene): { x: number; y: number } {
  const { w, h, door } = scene.layout;
  const x = [w - 14, w - 24, w - 34, w - 44].find((cx) => lampGap(cx) >= 10 && Math.abs(cx - door.x) > 30) ?? w - 14;
  return { x, y: h + FACADE_H + 4 };
}

/**
 * Где дверь наверх: в фасаде левее входа в магазин — подальше от фонаря, самого входа и спуска в подвал.
 * 13.11: сперва стояла у самого угла (x = 24), но там на тротуаре мусорный бак, а табличку резал фонарь.
 * 14.11: первой пробуем 64 — тогда между контейнером и этой дверью помещается лифт фудкорта (liftSpot).
 */
export function stairsSpot(scene: StoreScene): { x: number; y: number } {
  const { h, door } = scene.layout;
  const hatch = hatchSpot(scene).x;
  const x = [64, 62, 58, 66, 24].find((cx) => lampGap(cx) >= 12 && Math.abs(cx - door.x) > 36 && Math.abs(cx - hatch) > 30) ?? 62;
  return { x, y: h + FACADE_H + 4 };
}

/**
 * Где лифт фудкорта: в фасаде у левого угла зала, без фонаря, подальше от входа и от двери второго этажа (вплотную
 * их не различить). 14.11, аудит: стоял на x = 14 — прямо за мусорным контейнером (6…30), и едоки шли к лифту
 * сквозь бак. Теперь места за контейнером пропускаем: лифт — правее него, едоки обходят бак.
 */
export function liftSpot(scene: StoreScene): { x: number; y: number } {
  const { h, door } = scene.layout;
  const stairs = hasFloor(scene.state, 'second') ? stairsSpot(scene).x : null;
  const clearOfDump = (cx: number): boolean => cx - LIFT_HALF >= DUMP_X + DUMP_HALF - 2;
  const ok = (cx: number): boolean => lampGap(cx) >= 10 && Math.abs(cx - door.x) > 30 && (stairs === null || Math.abs(cx - stairs) > 28);
  const x = [34, 54, 58, 78, 84, 94].find((cx) => clearOfDump(cx) && ok(cx)) ?? [14, 24, 34, 44].find(ok) ?? 14;
  return { x, y: h + FACADE_H + 4 };
}

/**
 * Что двери этажей занимают на тротуаре (x от входа в магазин, как entranceBusy в tenantsFx.ts): спуск в подвал с
 * табличкой слева от него (до 26 точек и отступ 7), дверь «Одежды» и лифт с табличками над ними (до 26 точек).
 * Тележка Кости, торговец сезона и стойка проката на эти места не встают. В Заречье этажей нет — и мест тоже.
 */
export function floorDoorSpans(scene: StoreScene): [number, number][] {
  const state = scene.state;
  if (inZar(state)) return [];
  const d = scene.layout.door.x;
  const spans: [number, number][] = [];
  if (hasFloor(state, 'basement')) {
    const x = hatchSpot(scene).x - d;
    spans.push([x - 35, x + 8]);
  }
  if (hasFloor(state, 'second')) {
    const x = stairsSpot(scene).x - d;
    spans.push([x - 14, x + 14]);
  }
  if (hasFloor(state, 'third')) {
    const x = liftSpot(scene).x - d;
    spans.push([x - 14, x + 14]);
  }
  return spans;
}
