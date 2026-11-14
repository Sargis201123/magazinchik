// Фудкорт в мире наверху (game/foodcourt.ts, 13.11): вход на третий этаж — стеклянный лифт в фасаде у левого угла
// зала (подвал — у правого, basementFx.ts; дверь второго этажа — правее лифта, clothesFx.ts), над ним табличка «🍕 Фудкорт». С улицы к лифту идут едоки, к вечеру — чаще
// (вечерний наплыв), а кто-то выходит из лифта и сворачивает в магазин: «спустились за продуктами». Касание лифта —
// камера подлетает к нему и открывает вид этажа (scenes/floorView.ts) — тот же путь, что у подвала. Без тряски;
// в лёгкой графике людей меньше.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { foodPlan } from '../game/foodcourt';
import { hasFloor } from '../game/floors';
import { inZar } from '../game/zarshop';
import { FACADE_H, SHIRTS, STREET_TAP_MS, customerLook } from './common';
import { floorDown, lampGap } from './basementFx';
import { stairsSpot } from './clothesFx';
import * as camera from './camera';
import * as persons from './persons';

/** Сколько едоков показать на улице за день (остальные — «за кадром») и как часто проверяем, не пора ли следующему. */
const SHOWN_MAX = 10;
const LITE_SHOWN = 3;
const TICK = 4000;
/** С какой доли дня начинается вечерний наплыв: тогда идут каждый тик, днём — через раз. */
const EVENING = 0.6;
/** Каждый который едок не идёт наверх, а выходит из лифта и сворачивает в магазин. */
const DOWN_EVERY = 3;

let objs: Phaser.GameObjects.GameObject[] = [];
let stops: (() => void)[] = [];
let shown = { day: 0, n: 0, tick: 0 };

/**
 * Где лифт: в фасаде у левого угла зала, на месте без фонаря и подальше от входа (как спуск в подвал справа) и от
 * двери второго этажа — та тоже слева (clothesFx.stairsSpot), вплотную их не различить.
 */
export function liftSpot(scene: StoreScene): { x: number; y: number } {
  const { h, door } = scene.layout;
  const stairs = hasFloor(scene.state, 'second') ? stairsSpot(scene).x : null;
  const x = [14, 24, 34, 44].find((cx) => lampGap(cx) >= 10 && Math.abs(cx - door.x) > 30 && (stairs === null || Math.abs(cx - stairs) > 28)) ?? 14;
  return { x, y: h + FACADE_H + 4 };
}

/** Лифт и едоки: при постройке мира (streets.buildStreet), утром и когда открыли этаж или поставили точку. */
export function applyFoodcourt(scene: StoreScene): void {
  for (const obj of objs) obj.destroy();
  for (const stop of stops.splice(0)) stop();
  objs = [];
  const state = scene.state;
  if (inZar(state) || !hasFloor(state, 'third')) return;
  const at = liftSpot(scene);
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    objs.push(obj);
    return obj;
  };
  // Лифт — поверх витрины, под общим козырьком, ниже людей на тротуаре (как спуск в подвал).
  const lift = keep(scene.art(at.x, at.y, 'fc_lift').setOrigin(0.5, 1).setDepth(scene.layout.h + 2.5));
  const label = keep(
    scene.add
      // Над лифтом, как табличка второго этажа: сбоку она ложилась на фонарь и упиралась в дверь «Одежды».
      .text(at.x, at.y - 15, `🍕 ${t('floor.third')}`, { fontFamily: UI_FONT, fontSize: '3.6px', fontStyle: 'bold', color: '#fee761', backgroundColor: '#a22633', padding: { x: 1.2, y: 0.4 } })
      .setOrigin(0.5, 1)
      .setResolution(scene.textRes(8))
      .setDepth(scene.layout.h + 2.6),
  );
  if (label.width > 26) label.setScale(26 / label.width);
  for (const obj of [lift, label])
    obj.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
      if (scene.arranging || p.upTime - p.downTime > STREET_TAP_MS) return;
      camera.tap(scene, () => floorDown(scene, 'third', liftSpot(scene)));
    });
  const world = scene.worldGen;
  stops.push(
    scene.worldTimer(TICK, () => {
      if (!scene.sys.isActive() || !scene.running || scene.worldGen !== world || scene.night) return;
      if (shown.day !== scene.state.day) shown = { day: scene.state.day, n: 0, tick: 0 };
      shown.tick++;
      // Днём — через тик, вечером — каждый: к ужину у лифта людно.
      if (scene.dayProgress < EVENING && shown.tick % 2) return;
      const plan = foodPlan(scene.state);
      if (!plan || shown.n >= Math.min(Math.ceil(plan.eaters / 4), scene.lite ? LITE_SHOWN : SHOWN_MAX)) return;
      shown.n++;
      void (shown.n % DOWN_EVERY === 0 ? shopper(scene, at) : diner(scene, at));
    }),
  );
}

/** Едок: идёт по тротуару, сворачивает к лифту и уезжает наверх (тает за стеклом). */
async function diner(scene: StoreScene, at: { x: number; y: number }): Promise<void> {
  const world = scene.worldGen;
  const walkY = scene.streetY + Phaser.Math.Between(-2, 2);
  const fromLeft = Math.random() < 0.6;
  const guest = persons.makePerson(scene, fromLeft ? -60 : scene.next.w + 60, walkY, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  await persons.walkVia(scene, guest, [{ x: at.x, y: walkY }, { x: at.x, y: at.y + 3 }]);
  if (!guest.active || scene.worldGen !== world) return;
  persons.setFacing(guest, 'up');
  scene.tweens.add({ targets: guest, y: at.y - 2, alpha: 0, duration: 800, ease: 'Sine.easeIn', onComplete: () => guest.destroy() });
}

/** Спустился за продуктами: выходит из лифта и идёт в магазин — у входа тает (дальше он обычный покупатель). */
async function shopper(scene: StoreScene, at: { x: number; y: number }): Promise<void> {
  const world = scene.worldGen;
  const guest = persons.makePerson(scene, at.x, at.y + 1, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  guest.setAlpha(0);
  persons.setFacing(guest, 'down');
  scene.tweens.add({ targets: guest, alpha: 1, duration: 400 });
  const door = scene.layout.door;
  const walkY = scene.streetY - 1;
  await persons.walkVia(scene, guest, [{ x: at.x, y: walkY }, { x: door.x, y: walkY }, { x: door.x, y: at.y + 2 }]);
  if (!guest.active || scene.worldGen !== world) return;
  persons.setFacing(guest, 'up');
  scene.tweens.add({ targets: guest, y: at.y - 2, alpha: 0, duration: 600, ease: 'Sine.easeIn', onComplete: () => guest.destroy() });
}
