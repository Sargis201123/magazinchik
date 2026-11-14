// Второй этаж в мире наверху (game/clothes.ts, 13.11): в фасаде левее входа — витрина с платьем и стеклянная
// дверь, за ней лестница наверх, над ними розовый козырёк и табличка «Одежда». К двери с тротуара идут покупатели
// этажа (сколько их сегодня посчитала игра — не больше нескольких за день), а кто купил — выходит с розовым пакетом.
// Касание двери или таблички — камера подлетает к ней и открывает вид этажа (basementFx.floorDown → floorView.ts).
// Без тряски; в лёгкой графике — меньше людей.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { hasFloor } from '../game/floors';
import { clothesPlan } from '../game/clothes';
import { guestsToday } from '../game/day';
import { inZar } from '../game/zarshop';
import { FACADE_H, SHIRTS, STREET_TAP_MS, customerLook } from './common';
import * as camera from './camera';
import * as persons from './persons';
import { floorDown, hatchSpot } from './basementFx';

/** Сколько покупателей этажа показать на улице за день и как часто идёт следующий. */
const SHOWN_MAX = 5;
const LITE_SHOWN = 2;
const EVERY = 10000;

let objs: Phaser.GameObjects.GameObject[] = [];
let stops: (() => void)[] = [];
let shown = { day: 0, n: 0 };

/** Насколько точка фасада далеко от фонаря (фонари — через 72 от −100, как у спуска в подвал). */
const lampGap = (x: number): number => {
  const m = (((x + 100) % 72) + 72) % 72;
  return Math.min(m, 72 - m);
};

/** Где дверь наверх: в фасаде левее входа в магазин — подальше от фонаря, самого входа и спуска в подвал. */
export function stairsSpot(scene: StoreScene): { x: number; y: number } {
  const { h, door } = scene.layout;
  const hatch = hatchSpot(scene).x;
  // 13.11: сперва стояла у самого угла (x = 24), но там на тротуаре мусорный бак, а табличку резал фонарь.
  const x = [62, 58, 66, 24].find((cx) => lampGap(cx) >= 12 && Math.abs(cx - door.x) > 36 && Math.abs(cx - hatch) > 30) ?? 62;
  return { x, y: h + FACADE_H + 4 };
}

/** Дверь и покупатели: при постройке мира (streets.buildStreet), утром и когда открыли этаж или завезли одежду. */
export function applyClothes(scene: StoreScene): void {
  for (const obj of objs) obj.destroy();
  for (const stop of stops.splice(0)) stop();
  objs = [];
  const state = scene.state;
  if (inZar(state) || !hasFloor(state, 'second')) return;
  const at = stairsSpot(scene);
  const { x, y } = at;
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    objs.push(obj);
    return obj;
  };
  // Поверх витрин фасада (h + 2…2.2, building.ts), под общим козырьком и ниже людей на тротуаре. Табличка — над
  // козырьком двери: сбоку её закрывали урна у входа, спящий Бобик и фонарь.
  const door = keep(scene.art(x, y, 'fl2_front').setOrigin(0.5, 1).setDepth(scene.layout.h + 2.5));
  const label = keep(
    scene.add
      .text(x, y - 15, `👗 ${t('floor.second.sign')}`, { fontFamily: UI_FONT, fontSize: '3.6px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#b55088', padding: { x: 1.2, y: 0.4 } })
      .setOrigin(0.5, 1)
      .setResolution(scene.textRes(8))
      .setDepth(scene.layout.h + 2.6),
  );
  if (label.width > 26) label.setScale(26 / label.width);
  for (const obj of [door, label])
    obj.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
      if (scene.arranging || p.upTime - p.downTime > STREET_TAP_MS) return;
      camera.tap(scene, () => floorDown(scene, 'second', at));
    });
  const world = scene.worldGen;
  stops.push(
    scene.worldTimer(EVERY, () => {
      if (!scene.sys.isActive() || !scene.running || scene.worldGen !== world || scene.night) return;
      if (shown.day !== scene.state.day) shown = { day: scene.state.day, n: 0 };
      const plan = clothesPlan(scene.state, guestsToday(scene.state));
      if (!plan || shown.n >= Math.min(plan.sold + plan.sale, scene.lite ? LITE_SHOWN : SHOWN_MAX)) return;
      // Через раз: один поднимается наверх, другой спускается с покупкой.
      void (shown.n++ % 2 === 0 ? goUp(scene, x, y) : comeDown(scene, x, y));
    }),
  );
}

const shopper = (scene: StoreScene, x: number, y: number): Phaser.GameObjects.Container =>
  persons.makePerson(scene, x, y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));

/** Идёт по тротуару, сворачивает к двери и поднимается по лестнице — тает в проёме. */
async function goUp(scene: StoreScene, x: number, y: number): Promise<void> {
  const world = scene.worldGen;
  const walkY = scene.streetY + Phaser.Math.Between(-2, 2);
  const guest = shopper(scene, Math.random() < 0.5 ? -60 : scene.next.w + 60, walkY);
  await persons.walkVia(scene, guest, [{ x, y: walkY }, { x: x + 5, y: y + 3 }]);
  if (!guest.active || scene.worldGen !== world) return;
  persons.setFacing(guest, 'up');
  scene.tweens.add({ targets: guest, y: y - 5, alpha: 0, duration: 900, ease: 'Sine.easeIn', onComplete: () => guest.destroy() });
}

/** Выходит из двери с розовым пакетом и уходит по тротуару. */
async function comeDown(scene: StoreScene, x: number, y: number): Promise<void> {
  const world = scene.worldGen;
  const guest = shopper(scene, x + 5, y - 3);
  guest.add(scene.art(4, 3, 'fl2_bag'));
  guest.setAlpha(0);
  persons.setFacing(guest, 'down');
  scene.tweens.add({ targets: guest, alpha: 1, duration: 400 });
  const walkY = scene.streetY + Phaser.Math.Between(-2, 2);
  await persons.walkVia(scene, guest, [{ x: x + 5, y: walkY }, { x: Math.random() < 0.5 ? -60 : scene.next.w + 60, y: walkY }]);
  if (scene.worldGen === world) guest.destroy();
}
