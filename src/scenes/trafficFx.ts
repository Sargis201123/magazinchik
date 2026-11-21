// Поток гостей сверх зала (game/traffic.ts, 21.11): зал полон — пришедший берёт своё «на бегу» и идёт к кассам,
// которые работают без хозяина. Отдельных человечков для них не рисуем (вызовов отрисовки и так много): касса
// вздрагивает на каждом, а раз в несколько секунд над ней всплывает «+N 🛍» — сколько пробили сверх зала.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { t } from '../i18n';
import { flowArrive, flowJoin, flowNext, flowTick, flowUsed, newFlow, quickPick, type Flow } from '../game/traffic';
import { noteLost } from '../game/losses';
import { checkout, recordSale, returnToShelf } from '../game/economy';
import { bigDayExtraItems } from '../game/bigday';
import { crisisExtraItems } from '../game/crisis';
import { adExtraItems } from '../game/ads';
import { saleExtraItems } from '../game/weeks';
import { CLOSING_HURRY } from './common';
import * as effects from './effects';
import * as motion from './motion';

/** Как часто всплывает «+N 🛍» над кассой (мс); в лёгкой графике — реже. */
const POP_MS = 3000;
const LITE_POP_MS = 5000;

/** Поток сегодняшнего дня: создаётся с открытием (персонал и кассы уже выбраны утром). */
function flowOf(scene: StoreScene): Flow {
  if (!scene.flow) scene.flow = newFlow(scene.state);
  return scene.flow;
}

/**
 * Зал полон, а гость пришёл: true — он пошёл «на бегу» (кассы без хозяина есть), false — ждёт места в зале.
 * Сразу берёт своё с полок (как гость зала у полки) и встаёт к кассам; ничего не нашёл — уходит, как из зала.
 */
export function arrive(scene: StoreScene): boolean {
  if (scene.night || scene.timeLeft <= 0 || scene.blackout) return false;
  const f = flowOf(scene);
  if (!flowArrive(f)) return false;
  scene.stats.came = (scene.stats.came ?? 0) + 1;
  const s = scene.state;
  const wanted = scene.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(s.day) + crisisExtraItems(s) + adExtraItems(s, Math.random) + saleExtraItems(s, Math.random));
  const pick = quickPick(s, wanted, Math.random);
  scene.state = pick.state;
  flowJoin(f, pick);
  if (pick.cart.length) scene.refreshShelves();
  else if (pick.why) {
    scene.stats.lost++;
    noteLost(scene.stats, pick.why, pick.id);
  }
  return true;
}

/** Гостя зала пробил кассир, сменщик или киоск: время касс занято и для потока. */
export function used(scene: StoreScene): void {
  if (scene.flow && !scene.night) flowUsed(scene.flow);
}

/** Каждый кадр идущего дня: кассы пробивают ждущих, кто не дождался — оставляет корзину и уходит. */
export function tick(scene: StoreScene, dt: number): void {
  const f = scene.flow;
  if (!f || scene.night || scene.blackout || f.rate <= 0) return;
  // Закрываемся: зал идёт быстрее (CLOSING_HURRY) — и кассы потока тоже, чтобы стоящих у касс успели пробить.
  const gone = flowTick(f, scene.timeLeft <= 0 ? dt * CLOSING_HURRY : dt);
  for (const cart of gone) {
    scene.state = returnToShelf(scene.state, cart);
    scene.stats.lost++;
    noteLost(scene.stats, 'queue');
  }
  if (gone.length) scene.refreshShelves();
  for (let cart = flowNext(f); cart; cart = flowNext(f)) {
    const paid = checkout(scene.state, cart);
    scene.state = paid.state;
    f.served++;
    f.revenue += paid.total;
    scene.stats.served++;
    scene.stats.quick = (scene.stats.quick ?? 0) + 1;
    scene.stats.revenue += paid.total;
    recordSale(scene.stats, cart);
    blip(scene);
  }
  pop(scene, f);
}

/** День закрылся, а у касс ещё стоят: товар из их корзин — обратно на полки (как у тех, кто не успел зайти). */
export function close(scene: StoreScene): void {
  const f = scene.flow;
  if (!f?.carts.length) return;
  for (const cart of f.carts.splice(0)) scene.state = returnToShelf(scene.state, cart);
  scene.refreshShelves();
}

/**
 * Касса без хозяина, которая пробила гостя потока (по очереди): за которой кассир или сменщик, а без них — киоск.
 * tillsFirst — для «+N 🛍»: всплывает над кассами у выхода, а не над киоском у дальней стены.
 */
function autoTill(scene: StoreScene, tillsFirst = false): { x: number; y: number; img?: Phaser.GameObjects.Image } | null {
  const tills = scene.registers
    .filter((_, i) => {
      const op = scene.operator(i);
      return op !== null && op !== 'owner';
    })
    .map((r) => ({ x: r.counter.x, y: r.counter.y, img: r.img }));
  const kiosks = scene.kiosks.map((k) => ({ x: k.img.x, y: k.img.y, img: k.img }));
  const all = tillsFirst && tills.length ? tills : [...tills, ...kiosks];
  if (!all.length) return null;
  scene.flowTurn = (scene.flowTurn + 1) % all.length;
  return all[scene.flowTurn % all.length];
}

function blip(scene: StoreScene): void {
  const till = autoTill(scene);
  if (till?.img && !scene.lite) motion.squash(scene, till.img, 1.04, 0.94, 70);
}

/** «+N 🛍» над кассой: сколько пробили сверх зала с прошлого раза. */
function pop(scene: StoreScene, f: Flow): void {
  const fresh = f.served - scene.flowShown;
  if (fresh <= 0 || scene.time.now < scene.flowPopAt) return;
  scene.flowShown = f.served;
  scene.flowPopAt = scene.time.now + (scene.lite ? LITE_POP_MS : POP_MS);
  const till = autoTill(scene, true) ?? { x: scene.layout.door.x, y: scene.layout.door.y };
  scene.popup(till.x, till.y - 30, t('flow.pop', { n: fresh }), '#c8ffb0');
  if (!scene.lite) effects.flyCoins(scene, till.x, till.y - 16, Math.min(3, fresh));
}
