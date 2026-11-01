// Своя марка на полках (game/lines.ts) в мире: на тротуаре слева от входа — табурет с тазом варенья и
// бочка солений, справа — жёлтая бочка «КВАС» (весной и летом), на кухне — доска с пельменями. Над
// тазом идёт пар (не в лёгкой графике). Перерисовывается утром и при перестройке мира, как недели
// (weeks.ts): слева на тротуаре в сезонную неделю и в день ярмарки стоят их лотки — тогда своё
// видно только на полках.

import type { StoreScene } from './StoreScene';
import type Phaser from 'phaser';
import { isFairDay } from '../game/fair';
import { weekFor } from '../game/weeks';
import { lineSeason, lineTier } from '../game/lines';
import { kitchenOpen } from '../game/kitchen';
import { FACADE_H } from './common';
import * as food from './food';

/** Как часто поднимается пар над тазом варенья (мс). */
const STEAM_EVERY = 1600;

/** Убрать вчерашнее. */
function clearLines(scene: StoreScene): void {
  for (const obj of scene.lineObjs) obj.destroy();
  scene.lineObjs = [];
  for (const stop of scene.lineTimers.splice(0)) stop();
}

/** Уголки своей марки: каждое утро, после покупки в «Развитии» и при перестройке мира (buildWorld). */
export function applyLines(scene: StoreScene): void {
  clearLines(scene);
  const state = scene.state;
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    scene.lineObjs.push(obj);
    return obj;
  };
  const { door, h } = scene.layout;
  const front = h + FACADE_H;
  // Слева от входа — когда тротуар не занят ярмаркой и лотками недели (музыканты, урожай).
  const leftFree = !isFairDay(state.day) && !weekFor(state.day);
  if (leftFree && lineTier(state, 'pickles')) {
    const at = { x: door.x - 30, y: front + 15 };
    keep(scene.art(at.x, at.y, 'line_pickles').setOrigin(0.5, 1).setDepth(at.y));
  }
  if (leftFree && lineTier(state, 'jam')) {
    const at = { x: door.x - 48, y: front + 16 };
    const stool = keep(scene.art(at.x, at.y, 'line_jam').setOrigin(0.5, 1).setDepth(at.y));
    // Пар над тазом — днём и вечером, пока магазин открыт (таз — левая часть табурета).
    if (!scene.lite) {
      scene.lineTimers.push(
        scene.worldTimer(STEAM_EVERY, () => {
          if (!scene.running || !stool.active) return;
          food.steamPuff(scene, stool.x - 2, stool.y - 12);
        }),
      );
    }
  }
  // Квас — справа от входа, только в своё время года (бочку зимой увозят).
  if (lineTier(state, 'kvass') && lineSeason('kvass', state.day)) {
    const at = { x: door.x + 74, y: front + 17 };
    keep(scene.art(at.x, at.y, 'line_kvass').setOrigin(0.5, 1).setDepth(at.y));
  }
  // Пельмени — на кухне, рядом с раздачей: доска на табурете повара.
  const kitchen = scene.layout.kitchen;
  if (kitchen && kitchenOpen(state) && lineTier(state, 'pelmeni')) {
    const at = { x: kitchen.x + 40, y: kitchen.y + 47 };
    keep(scene.art(at.x, at.y, 'line_pelmeni').setOrigin(0.5, 1).setDepth(at.y));
  }
}
