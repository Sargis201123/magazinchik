// Подвал в мире наверху (game/basement.ts, 13.11): спуск в фасаде у правого угла зала — дверь под козырьком и
// ступени, рядом табличка. К нему с улицы идут завсегдатаи автоматов (столько, сколько их сегодня посчитала игра, — не
// больше нескольких за день) и спускаются вниз. Касание спуска — камера плавно подлетает к нему, гаснет и
// открывает вид этажа (scenes/floorView.ts — отдельная сцена поверх магазина, подгружается по требованию).
// Магазин наверху всё это время работает: день идёт, покупатели ходят. Без тряски; в лёгкой графике — меньше людей.
// 14.11: главный путь на этажи теперь — переключатель слева (floors/nav.ts, ui/floorSwitch.ts); двери в фасаде
// остались и тоже ведут на этаж — через тот же nav.goFloor.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { hasFloor, type FloorId } from '../game/floors';
import { slotsPlan } from '../game/basement';
import { inZar } from '../game/zarshop';
import { SHIRTS, STREET_TAP_MS, customerLook } from './common';
import * as camera from './camera';
import * as persons from './persons';
import { goFloor } from './floors/nav';
import { hatchSpot } from './floorDoors';

/** Сколько завсегдатаев показать на улице за день (остальные пришли «за кадром») и как часто идёт следующий. */
const SHOWN_MAX = 6;
const LITE_SHOWN = 2;
const PLAYER_EVERY = 9000;

let objs: Phaser.GameObjects.GameObject[] = [];
let stops: (() => void)[] = [];
let shown = { day: 0, n: 0 };

// Где спуск и сколько тротуара он занимает — floorDoors.ts (14.11: его обходят тележка, стойка и торговец).
export { hatchSpot, lampGap } from './floorDoors';

/** Спуск и завсегдатаи: при постройке мира (streets.buildStreet), утром и когда купили подвал или автоматы. */
export function applyBasement(scene: StoreScene): void {
  for (const obj of objs) obj.destroy();
  for (const stop of stops.splice(0)) stop();
  objs = [];
  const state = scene.state;
  if (inZar(state) || !hasFloor(state, 'basement')) return;
  const { x, y } = hatchSpot(scene);
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    objs.push(obj);
    return obj;
  };
  // Дверь поверх витрины (витрины и выкладка в них — на глубине h + 2…2.2, building.ts), под общим козырьком (h + 40)
  // и ниже людей на тротуаре — они проходят перед ней.
  const hatch = keep(scene.art(x, y, 'bsm_hatch').setOrigin(0.5, 1).setDepth(scene.layout.h + 2.5));
  // Табличка на фасаде слева от двери: лестница и «Подвал» — видно, что туда можно нажать.
  const label = keep(
    scene.add
      .text(x - 7, y - 9, `🪜 ${t('floor.basement')}`, { fontFamily: UI_FONT, fontSize: '3.6px', fontStyle: 'bold', color: '#fee761', backgroundColor: '#3e2731', padding: { x: 1.2, y: 0.4 } })
      .setOrigin(1, 0.5)
      .setResolution(scene.textRes(8))
      .setDepth(scene.layout.h + 2.6),
  );
  if (label.width > 26) label.setScale(26 / label.width);
  for (const obj of [hatch, label])
    obj.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
      if (scene.arranging || p.upTime - p.downTime > STREET_TAP_MS) return;
      camera.tap(scene, () => floorDown(scene, 'basement'));
    });
  const world = scene.worldGen;
  stops.push(
    scene.worldTimer(PLAYER_EVERY, () => {
      if (!scene.sys.isActive() || !scene.running || scene.worldGen !== world || scene.night) return;
      if (shown.day !== scene.state.day) shown = { day: scene.state.day, n: 0 };
      const plan = slotsPlan(scene.state);
      if (!plan || shown.n >= Math.min(plan.players, scene.lite ? LITE_SHOWN : SHOWN_MAX)) return;
      shown.n++;
      void regular(scene, x, y);
    }),
  );
}

/** Завсегдатай: идёт по тротуару, сворачивает к двери подвала в фасаде и уходит вниз по ступеням. */
async function regular(scene: StoreScene, x: number, y: number): Promise<void> {
  const world = scene.worldGen;
  const walkY = scene.streetY + Phaser.Math.Between(-2, 2);
  const fromLeft = Math.random() < 0.4;
  const guest = persons.makePerson(scene, fromLeft ? -60 : scene.next.w + 60, walkY, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  await persons.walkVia(scene, guest, [{ x, y: walkY }, { x, y: y + 3 }]);
  if (!guest.active || scene.worldGen !== world) return;
  // Вниз по ступеням: шагает в дверь и тает в темноте.
  persons.setFacing(guest, 'up');
  scene.tweens.add({ targets: guest, y: y - 6, alpha: 0, scale: guest.scale * 0.85, duration: 1100, ease: 'Sine.easeIn', onComplete: () => guest.destroy() });
}

/**
 * На этаж через дверь в фасаде: камера плавно подлетает к двери и гаснет, сцена этажа встаёт поверх (floorView.ts).
 * Другой этаж передаёт свою дверь (второй — дверь с навесом, clothesFx.ts; фудкорт — лифт, foodcourtFx.liftSpot),
 * иначе камера летит к спуску в подвал. Как едут и как возвращаются — floors/nav.ts.
 */
export function floorDown(scene: StoreScene, id: FloorId, door?: { x: number; y: number }): void {
  goFloor(scene, id, door ?? hatchSpot(scene));
}
