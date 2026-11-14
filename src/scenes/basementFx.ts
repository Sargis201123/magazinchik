// Подвал в мире наверху (game/basement.ts, 13.11): спуск в фасаде у правого угла зала — дверь под козырьком и
// ступени, рядом табличка. К нему с улицы идут завсегдатаи автоматов (столько, сколько их сегодня посчитала игра, — не
// больше нескольких за день) и спускаются вниз. Касание спуска — камера плавно подлетает к нему, гаснет и
// открывает вид этажа (scenes/floorView.ts — отдельная сцена поверх магазина, подгружается по требованию).
// Магазин наверху всё это время работает: день идёт, покупатели ходят. Без тряски; в лёгкой графике — меньше людей.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { hasFloor, type FloorId } from '../game/floors';
import { slotsPlan } from '../game/basement';
import { inZar } from '../game/zarshop';
import { lazy } from '../platform/lazy';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { track } from '../platform/analytics';
import { FACADE_H, SHIRTS, STREET_TAP_MS, customerLook } from './common';
import * as camera from './camera';
import * as persons from './persons';

const floorView = lazy('floorView', () => import('./floorView'));

/** Сколько завсегдатаев показать на улице за день (остальные пришли «за кадром») и как часто идёт следующий. */
const SHOWN_MAX = 6;
const LITE_SHOWN = 2;
const PLAYER_EVERY = 9000;
/** Подлёт к спуску и затемнение перед видом этажа (мс). */
const DIVE_MS = 650;
const FADE_MS = 320;

let objs: Phaser.GameObjects.GameObject[] = [];
let stops: (() => void)[] = [];
let shown = { day: 0, n: 0 };
/** Камера ушла на этаж (или летит туда): второе касание не считается. */
let away = false;
/**
 * Кадр до спуска и кадр, где камера погасла у двери. 13.11, ревью: этаж закрывается и сам — когда день встал на
 * паузу (сценка, ночная смена, итоги). Тот, кто остановил день, мог уже навести камеру магазина (сценка — на гостя);
 * тогда при возврате не уводим её — только возвращаем прежний масштаб.
 */
let before = { x: 0, y: 0, zoom: 1 };
let dived = { x: 0, y: 0 };

/** Насколько точка фасада далеко от фонаря на тротуаре (фонари — через 72 от −100, tenantsFx.nearLamp). Её же берёт лифт фудкорта. */
export const lampGap = (x: number): number => {
  const m = (((x + 100) % 72) + 72) % 72;
  return Math.min(m, 72 - m);
};

/**
 * Где спуск: дверь в фасаде у правого угла зала (низ — у тротуара). 13.11: сначала стоял снаружи у правой стены, но
 * тротуар там в четыре точки — приямок налезал на дорогу. Место — первое у угла, где не мешает фонарь и далеко до входа.
 */
export function hatchSpot(scene: StoreScene): { x: number; y: number } {
  const { w, h, door } = scene.layout;
  const x = [w - 14, w - 24, w - 34, w - 44].find((cx) => lampGap(cx) >= 10 && Math.abs(cx - door.x) > 30) ?? w - 14;
  return { x, y: h + FACADE_H + 4 };
}

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
 * Вниз на этаж: камера плавно подлетает к спуску и гаснет, сцена этажа встаёт поверх (floorView.ts). Касания
 * магазина на это время выключены — палец не пробьёт покупку и не сдвинет камеру наверху. Другой этаж передаёт свою
 * дверь (фудкорт — лифт слева, foodcourtFx.liftSpot), иначе камера летит к спуску в подвал.
 */
export function floorDown(scene: StoreScene, id: FloorId, door?: { x: number; y: number }): void {
  if (away || !scene.running || !hasFloor(scene.state, id)) return;
  away = true;
  haptic.tap();
  sound.tap();
  track('floor_view', scene.state.day, 0);
  const cam = scene.cameras.main;
  scene.homeTimer?.remove();
  scene.input.enabled = false;
  const at = door ?? hatchSpot(scene);
  const mod = floorView.load();
  before = { x: cam.midPoint.x, y: cam.midPoint.y, zoom: cam.zoom };
  cam.panEffect.reset();
  cam.zoomEffect.reset();
  cam.pan(at.x, at.y - 10, DIVE_MS, 'Sine.easeInOut', true);
  cam.zoomTo(Math.min(cam.zoom * 2, scene.baseZoom * 2.4), DIVE_MS, 'Sine.easeIn', true);
  scene.time.delayedCall(DIVE_MS - FADE_MS, () => {
    cam.fadeOut(FADE_MS, 24, 20, 37);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      dived = { x: cam.midPoint.x, y: cam.midPoint.y };
      mod.then(
        (m) => {
          // Этаж не открылся — магазин не должен остаться тёмным и глухим к касаниям.
          try {
            m.openFloor(scene, id);
          } catch (error) {
            floorUp(scene);
            throw error;
          }
        },
        () => floorUp(scene),
      );
    });
  });
}

/**
 * Наверх: этаж закрылся — магазин снова рисуется (пока смотрели этаж, его не рисовали — floorView.create), камера
 * светлеет. Куда смотреть: камеру навёл кто-то другой (сценка — на гостя) — остаёмся там, только прежний масштаб;
 * день идёт — в обычный кадр; день встал (итоги, ночная смена) — туда, где игрок смотрел до спуска.
 */
export function floorUp(scene: StoreScene): void {
  away = false;
  scene.scene.setVisible(true);
  if (!scene.sys.isActive()) return;
  scene.input.enabled = true;
  scene.dragged = false;
  const cam = scene.cameras.main;
  cam.resetFX();
  cam.fadeIn(FADE_MS, 24, 20, 37);
  const steered = cam.panEffect.isRunning || Math.hypot(cam.midPoint.x - dived.x, cam.midPoint.y - dived.y) > 3;
  const home = scene.rushView ?? { x: scene.home.x, y: scene.home.y, zoom: scene.baseZoom };
  const view = steered ? { x: cam.midPoint.x, y: cam.midPoint.y, zoom: before.zoom } : scene.running ? home : before;
  if (!steered) cam.pan(view.x, view.y, DIVE_MS + 200, 'Sine.easeInOut', true);
  cam.zoomTo(view.zoom, DIVE_MS + 200, 'Sine.easeOut', true);
}
