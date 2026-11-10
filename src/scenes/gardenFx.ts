// «Бабушкина теплица» в мире (game/garden.ts): стеклянный домик на газоне перед магазином (а когда газона
// уже нет — в парке у аллеи). Рассада растёт по настоящему времени: ростки, кусты, спелые плоды. Созрело —
// над теплицей покачивается значок, нажатие собирает урожай на склад. Раздел «Развития» — ui/garden.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { PRODUCTS } from '../game/economy';
import { gardenLook, gardenStage, harvest } from '../game/garden';
import { saveGame } from '../game/save';
import { sound } from '../platform/sound';
import { UI_FONT } from '../ui/dom';
import { FACADE_H } from './common';
import type { Layout } from './layout';
import * as building from './building';
import * as camera from './camera';

/** Глубина участка перед магазином, при которой теплица помещается на нём (домик с крышей — 27, до забора — 12). */
const LAWN_MIN = 40;

/**
 * Где стоит теплица (низ домика). На участке перед магазином — у забора под правым краем зала: это место
 * всегда в кадре. Участка нет или он мелкий — в парке под аллеей (аллея — top + 268): правее площади и клумб,
 * левее пруда.
 */
function spot(scene: StoreScene, top: number): { x: number; y: number } {
  const { w, h, door } = scene.layout;
  return top - (h + FACADE_H) >= LAWN_MIN ? { x: w - 13, y: top - 12 } : { x: door.x - 26, y: top + 268 + 48 };
}

/** Поставить (или перерисовать) теплицу: зовётся при постройке улицы и когда урожай перешёл на новую стадию. */
export function buildGarden(scene: StoreScene, next: Layout, top: number): void {
  scene.gardenBox?.destroy();
  scene.gardenBox = undefined;
  scene.builtGarden = gardenLook(scene.state, Date.now());
  if (!scene.builtGarden) return;
  const { x, y } = spot(scene, top);
  const stage = gardenStage(scene.state, Date.now());
  const g = scene.add.graphics();
  // Тень и грядки.
  g.fillStyle(0x181425, 0.2).fillEllipse(x + 2, y + 1, 36, 6);
  g.fillStyle(0x5a3420, 1).fillRect(x - 15, y - 10, 30, 10);
  g.fillStyle(0x733e39, 1).fillRect(x - 14, y - 9, 28, 8);
  g.fillStyle(0x5a3420, 1).fillRect(x - 14, y - 5.5, 28, 0.8);
  // Рассада: два ряда по семь кустиков, с каждой стадией выше; спелые — с красными и жёлтыми плодами.
  const rnd = new Phaser.Math.RandomDataGenerator(['garden']);
  for (let i = 0; i < 14; i++) {
    const px = x - 12 + (i % 7) * 4;
    const py = y - (i < 7 ? 6 : 1.5);
    const tall = [0.8, 2.2, 3.6, 4][stage] + rnd.frac() * 0.6;
    g.fillStyle(0x3e8948, 1).fillRect(px, py - tall, 1, tall);
    if (stage >= 1) g.fillStyle(0x63c74d, 1).fillRect(px - 0.8, py - tall, 2.6, Math.min(2, tall * 0.6));
    if (stage === 3) g.fillStyle(rnd.pick([0xe43b44, 0xfeae34, 0xe43b44]), 1).fillCircle(px + 0.5, py - tall + 1.4, 0.9);
  }
  // Стеклянный домик: стены и двускатная крыша, переплёт, блик.
  const topY = y - 19;
  const ridge = y - 27;
  g.fillStyle(0xbfe8ff, 0.3).fillRect(x - 15, topY, 30, 19).fillTriangle(x - 16, topY, x, ridge, x + 16, topY);
  g.lineStyle(1, 0xf4f8ff, 1).strokeRect(x - 15, topY, 30, 19);
  g.lineBetween(x - 16, topY, x, ridge).lineBetween(x, ridge, x + 16, topY);
  g.lineStyle(0.6, 0xf4f8ff, 0.9);
  for (const dx of [-5, 5]) g.lineBetween(x + dx, topY, x + dx, y);
  g.lineBetween(x - 15, y - 10, x + 15, y - 10).lineBetween(x, ridge, x, topY);
  g.lineStyle(0.6, 0xffffff, 0.8).lineBetween(x - 12, topY + 3, x - 9, topY + 8);
  g.lineStyle(1, 0x8b9bb4, 1).lineBetween(x - 15.5, y, x + 15.5, y);
  const parts: Phaser.GameObjects.GameObject[] = [g];
  if (stage === 3) {
    // Созрело: значок над крышей покачивается — нажми и собери.
    const mark = scene.add.container(x, ridge - 6, [
      scene.add.circle(0, 0, 4.2, 0xfee761).setStrokeStyle(0.8, 0x2b2233),
      scene.add.text(0, 0, '!', { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#2b2233' }).setOrigin(0.5).setResolution(scene.textRes(4)),
    ]);
    scene.tweens.add({ targets: mark, y: ridge - 9, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    parts.push(mark);
  }
  const zone = scene.add.zone(x, y - 13, 36, 34).setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => tapGarden(scene, x, ridge)));
  parts.push(zone);
  scene.gardenBox = scene.add.container(0, 0, parts).setDepth(y);
  scene.gardenAt = { next, top };
}

/** Нажали на теплицу: созрело — урожай на склад, нет — подсказка. */
function tapGarden(scene: StoreScene, x: number, y: number): void {
  const done = harvest(scene.state, Date.now());
  if (!done) {
    scene.popup(x, y - 4, t(gardenStage(scene.state, Date.now()) === 3 ? 'garden.noRoom' : 'garden.growing'), '#d8f0d8');
    return;
  }
  scene.state = done.state;
  saveGame(scene.state);
  sound.tap();
  scene.popup(x, y - 4, t('garden.got', { list: done.got.map(({ id, qty }) => `${PRODUCTS[id].icon}×${qty}`).join(' ') }), '#d8f0d8');
  building.refreshWarehouse(scene);
  if (scene.gardenAt) buildGarden(scene, scene.gardenAt.next, scene.gardenAt.top);
}

/** Раз в несколько секунд: урожай подрос или собран из меню — перерисовать теплицу. */
export function tickGarden(scene: StoreScene): void {
  if (scene.gardenAt && gardenLook(scene.state, Date.now()) !== scene.builtGarden) buildGarden(scene, scene.gardenAt.next, scene.gardenAt.top);
}
