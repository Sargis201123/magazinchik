// Дегустация у полки «От бабушки» (10.11 — «остров сезона» посреди большого зала; 11.11, решение автора 1а: сезонная
// выкладка переехала в витрины у входа (building.ts, art/pitch.py vitrine), а промоутер со столиком встал рядом с
// бабушкиной полкой и угощает её вареньем и соленьями). Только оформление: на продажи не влияет, покупатели и
// продавец столик обходят. Нет места рядом с полкой — столика нет.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { SHIRTS, randomLook } from './common';
import { brandRect, shelfRect } from './layout';
import { propRect } from './placement';
import { brandSpot } from './shelves';
import * as persons from './persons';

/** С какого помещения у полки своей марки стоит дегустация, и сколько пола занимает столик с промоутером. */
const PROMO_FROM = 4;
const SIZE = { w: 18, h: 20 };
/** Чем угощает: варенье, огурчик, пельмень, квас — по очереди над подносом. */
const TASTES = ['🍓', '🥒', '🥟', '🍯'];

/** Место столика: справа от полки, иначе слева; не на полках, кассах, проходе к двери и очереди. */
function tasteSpot(scene: StoreScene, stand: { x: number; y: number }): { x: number; y: number } | null {
  const { w, h, door, queue, slots } = scene.layout;
  const blocked = [
    ...scene.obstacles,
    ...slots.map(shelfRect),
    ...scene.propList.map(propRect),
    brandRect(stand),
    { x: door.x - 14, y: h - 40, w: 28, h: 40 },
    { x: queue.x - 16, y: queue.minY - 12, w: 32, h: h - queue.minY + 12 },
    // Двери во флигель у левой стены — к ним ходят.
    ...[scene.layout.warehouse, scene.layout.bakery, scene.layout.coffee, scene.layout.kitchen].flatMap((r) => (r ? [{ x: -2, y: r.doorway.y - 16, w: 34, h: 32 }] : [])),
  ];
  const free = (x: number, y: number): boolean => {
    const r = { x: x - SIZE.w / 2, y: y - SIZE.h, w: SIZE.w, h: SIZE.h + 4 };
    if (r.x < 2 || r.x + r.w > w - 2 || r.y + r.h > h - 2) return false;
    return blocked.every((b) => r.x + r.w + 1 <= b.x || b.x + b.w + 1 <= r.x || r.y + r.h + 1 <= b.y || b.y + b.h + 1 <= r.y);
  };
  for (const dx of [27, 31, -27, -31]) {
    const at = { x: stand.x + dx, y: stand.y + 10 };
    if (free(at.x, at.y)) return at;
  }
  return null;
}

const loop = (scene: StoreScene, config: Phaser.Types.Tweens.TweenBuilderConfig): void => {
  if (!scene.lite) scene.tweens.add({ repeat: -1, ease: 'Sine.easeInOut', ...config });
};

export function buildPromo(scene: StoreScene): void {
  if (scene.state.level < PROMO_FROM || !scene.state.shelves.some((shelf) => shelf.kind === 'brand')) return;
  const spot = tasteSpot(scene, brandSpot(scene));
  if (!spot) return;
  const { x: tx, y } = spot;
  // Столик: скатерть в клетку, тарелка с пробниками (банка варенья, огурчики), за ним — промоутер с подносом.
  const g = scene.add.graphics().setDepth(y);
  g.fillStyle(0x181425, 0.16).fillEllipse(tx, y + 1, 14, 4);
  g.fillStyle(0x8f563b, 1).fillRect(tx - 5, y - 2, 1, 2).fillRect(tx + 4, y - 2, 1, 2);
  g.fillStyle(0x3b2a35, 1).fillRect(tx - 6.4, y - 7.4, 12.8, 5.8);
  g.fillStyle(0xf4f8ff, 1).fillRect(tx - 6, y - 7, 12, 5);
  for (let i = 0; i < 6; i++) g.fillStyle(0xe43b44, 1).fillRect(tx - 6 + i * 2, y - 3.4 + (i % 2) * 0.9, 1, 0.9);
  g.fillStyle(0xc0cbdc, 1).fillEllipse(tx + 1.5, y - 7.6, 7, 2.2);
  for (let i = 0; i < 3; i++) g.fillStyle([0xe43b44, 0x63c74d, 0xfee761][i], 1).fillRect(tx - 0.5 + i * 1.7, y - 8.6, 1.1, 1.1);
  g.fillStyle(0xbe4a2f, 1).fillRect(tx - 5, y - 10, 3, 3);
  g.fillStyle(0xfeae34, 1).fillRect(tx - 5, y - 10.6, 3, 0.8);
  const promoter = persons.makePerson(scene, tx, y - 9, { ...randomLook(Phaser.Utils.Array.GetRandom(SHIRTS)), shirt: 0xe43b44 });
  scene.people.delete(promoter);
  promoter.setDepth(y - 0.5);
  loop(scene, { targets: promoter, x: tx + 1.5, duration: 900, yoyo: true, repeatDelay: 1200 });
  // Время от времени над подносом — чем угощают.
  if (!scene.lite) {
    let k = 0;
    scene.worldTimer(5200, () => {
      if (!scene.sys.isActive() || !scene.running || !promoter.active) return;
      scene.popup(tx, y - 24, TASTES[k++ % TASTES.length], '#fff3b0');
    });
  }
  scene.obstacles.push({ x: tx - SIZE.w / 2, y: y - SIZE.h + 6, w: SIZE.w, h: SIZE.h - 2 });
}
