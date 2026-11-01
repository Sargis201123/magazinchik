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
import { COURIER_SPAN, freeStreetX, ICE_CART_SPAN, type StreetSpan } from './placement';
import { activeDecor } from '../game/decor';
import { hasUpgrade } from '../game/upgrades';
import { yearTime } from '../game/calendar';
import { hasDog } from '../game/watch';
import { sunflowersPlanted } from '../game/drama';
import type { StoreState } from '../game/economy';
import * as food from './food';

/** Как часто поднимается пар над тазом варенья (мс). */
const STEAM_EVERY = 1600;
/** Табурет с вареньем (17 точек шириной) и бочка солений (13) — слева от входа, где свободно. */
const JAM_SPAN: StreetSpan = [-9, 9];
const JAM_SPOTS = [-78, -46, -96, -114];
const PICKLES_SPAN: StreetSpan = [-7, 7];
const PICKLES_SPOTS = [-38, -62, -88, -120];
/** Бочка кваса (26 точек шириной) — справа, за тележкой мороженого и кадкой. */
const KVASS_SPAN: StreetSpan = [-14, 14];
const KVASS_SPOTS = [114, 142, -140];

/**
 * Где у входа стоят уголки своей марки (x от двери): не на местах курьера, летней тележки с мороженым и
 * уличного украшения (кадки, доска-штендер). Слева от входа — только когда тротуар не занят ярмаркой и
 * лотками недели. Свободного места нет — уголок не ставят. Реклама у входа (streets.ts) их места обходит.
 */
export function lineStreetSpots(state: StoreState, doorX: number): { jam: number | null; pickles: number | null; kvass: number | null; spans: StreetSpan[] } {
  // Зелёный контейнер для мусора стоит на тротуаре у левого угла (building.dumpSpot, x = 18).
  const dump = 18 - doorX;
  const taken: StreetSpan[] = [
    [dump - 9, dump + 9],
    // Будка Бобика и подсолнухи Сони — у самой двери (streets.ts).
    ...(hasDog(state) ? [[-33, -15] as StreetSpan] : []),
    ...(sunflowersPlanted(state) ? [[-18, -4] as StreetSpan] : []),...(hasUpgrade(state, 'delivery') ? [COURIER_SPAN] : []), ...(yearTime(state.day) === 'summer' ? [ICE_CART_SPAN] : [])];
  const outdoor = activeDecor(state, 'outdoor');
  if (outdoor?.texture) {
    const right = yearTime(state.day) === 'summer' ? 96 : 62;
    for (const x of outdoor.id === 'out_planters' ? [-60, right] : [-50]) taken.push([x - 6, x + 6]);
  }
  const spans: StreetSpan[] = [];
  // Всё занято — не ставим вовсе (своё и так видно на полках), а не друг на друга.
  const place = (spots: number[], span: StreetSpan): number | null => {
    const busy = [...taken, ...spans];
    const x = freeStreetX(spots, span, busy);
    if (busy.some(([from, to]) => x + span[1] > from && x + span[0] < to)) return null;
    spans.push([x + span[0], x + span[1]]);
    return x;
  };
  const leftFree = !isFairDay(state.day) && !weekFor(state.day);
  // Бочка кваса — первой: её место справа; табурет и бочка солений — слева, где свободно.
  const kvass = lineTier(state, 'kvass') && lineSeason('kvass', state.day) ? place(KVASS_SPOTS, KVASS_SPAN) : null;
  const jam = leftFree && lineTier(state, 'jam') ? place(JAM_SPOTS, JAM_SPAN) : null;
  const pickles = leftFree && lineTier(state, 'pickles') ? place(PICKLES_SPOTS, PICKLES_SPAN) : null;
  return { jam, pickles, kvass, spans };
}

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
  const spots = lineStreetSpots(state, door.x);
  if (spots.pickles !== null) {
    const at = { x: door.x + spots.pickles, y: front + 15 };
    keep(scene.art(at.x, at.y, 'line_pickles').setOrigin(0.5, 1).setDepth(at.y));
  }
  if (spots.jam !== null) {
    const at = { x: door.x + spots.jam, y: front + 16 };
    const stool = keep(scene.art(at.x, at.y, 'line_jam').setOrigin(0.5, 1).setDepth(at.y));
    // Пар над тазом — пока магазин открыт (таз — левая часть табурета); в лёгкой графике — без пара.
    if (!scene.lite) {
      scene.lineTimers.push(
        scene.worldTimer(STEAM_EVERY, () => {
          if (!scene.running || !stool.active) return;
          food.steamPuff(scene, stool.x - 2, stool.y - 12);
        }),
      );
    }
  }
  // Квас — только в своё время года (бочку зимой увозят).
  if (spots.kvass !== null) {
    const at = { x: door.x + spots.kvass, y: front + 17 };
    keep(scene.art(at.x, at.y, 'line_kvass').setOrigin(0.5, 1).setDepth(at.y));
  }
  // Пельмени — на кухне, рядом с раздачей: доска на табурете повара.
  const kitchen = scene.layout.kitchen;
  if (kitchen && kitchenOpen(state) && lineTier(state, 'pelmeni')) {
    const at = { x: kitchen.x + 40, y: kitchen.y + 47 };
    keep(scene.art(at.x, at.y, 'line_pelmeni').setOrigin(0.5, 1).setDepth(at.y));
  }
}
