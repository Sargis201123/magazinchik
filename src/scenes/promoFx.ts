// Сезонная зона большого зала (10.11, третий обход): в универмаге и гипермаркете нижняя часть зала пустовала —
// теперь там «остров сезона». Зимой ёлка с подарками и огоньками, весной стойка с тюльпанами, летом поддон арбузов
// под полосатым зонтом, осенью тюки сена с тыквами. Рядом — столик дегустации с промоутером. Только оформление:
// на продажи не влияет, покупатели и продавец его обходят. Места под полки, кассы, очередь и вход не занимает —
// не нашлось свободного пола, острова в этом зале нет.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { yearTime } from '../game/calendar';
import { SHIRTS, randomLook } from './common';
import { shelfRect } from './layout';
import { propRect } from './placement';
import * as persons from './persons';

/** С какого помещения в зале есть остров сезона, и сколько пола он занимает (с местом промоутера). */
const PROMO_FROM = 4;
const SIZE = { w: 52, h: 24 };

type Draw = Phaser.GameObjects.Graphics;

/** Свободное место под остров: в нижней трети зала, ближе к левой стороне (справа — кассы и очередь). */
function promoSpot(scene: StoreScene): { x: number; y: number } | null {
  const { w, h, door, queue, slots } = scene.layout;
  const blocked = [
    ...scene.obstacles,
    ...slots.map(shelfRect),
    ...scene.propList.map(propRect),
    // Проход к двери и очередь к кассам.
    { x: door.x - 20, y: h - 96, w: 40, h: 96 },
    { x: queue.x - 16, y: queue.minY - 12, w: 32, h: h - queue.minY + 12 },
    // Двери флигеля у левой стены: вдоль неё проход.
    { x: 0, y: 0, w: 30, h },
  ];
  const pad = 8;
  const free = (x: number, y: number): boolean => {
    const r = { x: x - SIZE.w / 2, y: y - SIZE.h, w: SIZE.w, h: SIZE.h + 6 };
    if (r.x < 30 || r.x + r.w > w - 20 || r.y + r.h > h - 6) return false;
    return blocked.every((b) => r.x + r.w + pad <= b.x || b.x + b.w + pad <= r.x || r.y + r.h + pad <= b.y || b.y + b.h + pad <= r.y);
  };
  const spots: { x: number; y: number }[] = [];
  for (let y = h - 16; y >= h * 0.62; y -= 4) for (let x = 56; x <= w - 46; x += 4) if (free(x, y)) spots.push({ x, y });
  if (!spots.length) return null;
  // Ближе всего к середине свободной левой половины у входа.
  const want = { x: door.x - 62, y: h - 30 };
  return spots.sort((a, b) => Math.hypot(a.x - want.x, a.y - want.y) - Math.hypot(b.x - want.x, b.y - want.y))[0];
}

const loop = (scene: StoreScene, config: Phaser.Types.Tweens.TweenBuilderConfig): void => {
  if (!scene.lite) scene.tweens.add({ repeat: -1, ease: 'Sine.easeInOut', ...config });
};

/** Поддон: доски с тенью — на нём стоит сезонный товар. */
function pallet(g: Draw, x: number, y: number, w: number): void {
  g.fillStyle(0x181425, 0.18).fillEllipse(x, y + 1, w + 6, 5);
  g.fillStyle(0x8f563b, 1).fillRect(x - w / 2, y - 3, w, 3);
  g.fillStyle(0xc8955a, 1).fillRect(x - w / 2, y - 3, w, 1.2);
  for (let px = x - w / 2 + 1; px < x + w / 2 - 1; px += 5) g.fillStyle(0x5a3420, 1).fillRect(px, y - 1.6, 0.7, 1.6);
}

export function buildPromo(scene: StoreScene): void {
  if (scene.state.level < PROMO_FROM) return;
  const spot = promoSpot(scene);
  if (!spot) return;
  const { x, y } = spot;
  const cx = x - 8;
  const g = scene.add.graphics().setDepth(y);
  const season = yearTime(scene.state.day);
  if (season === 'winter') {
    // Ёлка в три яруса со звездой, под ней подарки; огоньки перемигиваются.
    g.fillStyle(0x181425, 0.18).fillEllipse(cx, y + 1, 30, 6);
    g.fillStyle(0x5a3420, 1).fillRect(cx - 1.5, y - 4, 3, 4);
    for (let k = 0; k < 3; k++) {
      const top = y - 30 + k * 8;
      g.fillStyle(0x265c42, 1).fillTriangle(cx, top, cx - 6 - k * 3.4, top + 12, cx + 6 + k * 3.4, top + 12);
      g.fillStyle(0x3e8948, 1).fillTriangle(cx, top + 1, cx - 4.6 - k * 3, top + 11, cx + 4.6 + k * 3, top + 11);
    }
    g.fillStyle(0xfee761, 1).fillTriangle(cx, y - 34, cx - 2.2, y - 29.5, cx + 2.2, y - 29.5).fillTriangle(cx, y - 28.4, cx - 2.2, y - 32.6, cx + 2.2, y - 32.6);
    for (const [gx, color, ribbon] of [[-11, 0xe43b44, 0xfee761], [-5, 0x5fcde4, 0xf4f8ff], [8, 0x63c74d, 0xe43b44], [13, 0xb55088, 0xfee761]] as const) {
      g.fillStyle(0x3b2a35, 1).fillRect(cx + gx - 2.9, y - 4.9, 5.8, 5.4);
      g.fillStyle(color, 1).fillRect(cx + gx - 2.5, y - 4.5, 5, 4.6);
      g.fillStyle(ribbon, 1).fillRect(cx + gx - 0.5, y - 4.5, 1, 4.6).fillRect(cx + gx - 2.5, y - 2.6, 5, 0.8);
    }
    const bulbs = [0xfee761, 0xe43b44, 0x5fcde4, 0xf4f8ff];
    for (let i = 0; i < 10; i++) {
      const k = i % 3;
      const bulb = scene.add.circle(cx - 5 - k * 2.6 + ((i * 7) % (10 + k * 6)), y - 22 + k * 8 + (i % 2) * 2, 0.9, bulbs[i % bulbs.length]).setDepth(y + 1);
      loop(scene, { targets: bulb, alpha: 0.2, duration: 420, yoyo: true, delay: (i % 5) * 110 });
    }
  } else if (season === 'spring') {
    // Стойка-пирамида с тюльпанами в вёдрах.
    pallet(g, cx, y, 30);
    for (let tier = 0; tier < 3; tier++) {
      const ty = y - 4 - tier * 6;
      const half = 13 - tier * 4;
      g.fillStyle(0xf4ecd8, 1).fillRect(cx - half, ty - 1.2, half * 2, 1.2);
      for (let bx = cx - half + 2; bx <= cx + half - 2; bx += 5) {
        g.fillStyle(0x5a6988, 1).fillRect(bx - 1.6, ty - 4.4, 3.2, 3.2);
        g.fillStyle(0x3e8948, 1).fillRect(bx - 0.3, ty - 7.6, 0.6, 3.4);
        g.fillStyle([0xe43b44, 0xfee761, 0xf6757a, 0xb55088][(bx + tier) & 3], 1).fillCircle(bx, ty - 8.2, 1.4);
      }
    }
  } else if (season === 'summer') {
    // Поддон арбузов под полосатым зонтом, один разрезан.
    pallet(g, cx, y, 30);
    for (const [wx, wy] of [[-10, -6], [-3, -6.5], [4, -6], [10, -6.5], [-6, -11.5], [1, -12], [7, -11.5]]) {
      g.fillStyle(0x265c42, 1).fillCircle(cx + wx, y + wy, 3.6);
      g.fillStyle(0x3e8948, 1).fillCircle(cx + wx, y + wy, 3.1);
      g.fillStyle(0x265c42, 1).fillRect(cx + wx - 0.4, y + wy - 3, 0.8, 6);
    }
    g.fillStyle(0x3e8948, 1).fillCircle(cx + 13, y - 2.5, 3.2);
    g.fillStyle(0xe43b44, 1).fillCircle(cx + 13, y - 2.5, 2.5);
    g.fillStyle(0x181425, 1).fillRect(cx + 12, y - 3.4, 0.7, 0.7).fillRect(cx + 13.8, y - 2.2, 0.7, 0.7);
    g.fillStyle(0x8b9bb4, 1).fillRect(cx - 0.5, y - 32, 1, 18);
    const umbrella = scene.add.graphics().setDepth(y + 1);
    for (let i = 0; i < 6; i++) umbrella.fillStyle(i % 2 ? 0xf4f8ff : 0x5fcde4, 1).fillTriangle(cx, y - 37, cx - 16.5 + i * 5.5, y - 28, cx - 11 + i * 5.5, y - 28);
    loop(scene, { targets: umbrella, y: 0.6, duration: 1500, yoyo: true });
  } else {
    // Осень: тюки сена, тыквы, корзина яблок и сноп.
    g.fillStyle(0x181425, 0.18).fillEllipse(cx, y + 1, 34, 6);
    for (const [hx, hy] of [[-9, -7], [6, -7], [-2, -14]]) {
      g.fillStyle(0xb89c3a, 1).fillRect(cx + hx - 7.4, y + hy - 0.4, 14.8, 7.8);
      g.fillStyle(0xfee761, 1).fillRect(cx + hx - 7, y + hy, 14, 7);
      g.fillStyle(0xd8b848, 1).fillRect(cx + hx - 7, y + hy + 2, 14, 0.7).fillRect(cx + hx - 7, y + hy + 4.6, 14, 0.7);
      g.fillStyle(0x8f563b, 1).fillRect(cx + hx - 3, y + hy, 0.8, 7).fillRect(cx + hx + 2.4, y + hy, 0.8, 7);
    }
    for (const [px, py, r] of [[-15, -2.5, 3], [13, -3, 3.4], [3, -2, 2.6], [-2, -17, 2.8]]) {
      g.fillStyle(0xa8491c, 1).fillCircle(cx + px, y + py, r + 0.5);
      g.fillStyle(0xf77622, 1).fillCircle(cx + px, y + py, r);
      g.fillStyle(0xfeae34, 1).fillRect(cx + px - 0.4, y + py - r, 0.8, r * 1.6);
      g.fillStyle(0x3e8948, 1).fillRect(cx + px - 0.4, y + py - r - 1.2, 0.8, 1.4);
    }
  }
  // Столик дегустации: скатерть, тарелка с пробниками, промоутер с подносом покачивается.
  const tx = x + 18;
  g.fillStyle(0x181425, 0.16).fillEllipse(tx, y + 1, 14, 4);
  g.fillStyle(0x8f563b, 1).fillRect(tx - 5, y - 2, 1, 2).fillRect(tx + 4, y - 2, 1, 2);
  g.fillStyle(0x3b2a35, 1).fillRect(tx - 6.4, y - 7.4, 12.8, 5.8);
  g.fillStyle(0xf4f8ff, 1).fillRect(tx - 6, y - 7, 12, 5);
  g.fillStyle(0xe43b44, 1).fillRect(tx - 6, y - 3.4, 12, 0.9);
  g.fillStyle(0xc0cbdc, 1).fillEllipse(tx, y - 7.6, 8, 2.2);
  for (let i = 0; i < 4; i++) g.fillStyle([0xfee761, 0xf77622, 0xf6757a, 0x63c74d][i], 1).fillRect(tx - 3 + i * 1.7, y - 8.6, 1.1, 1.1);
  const promoter = persons.makePerson(scene, tx, y - 9, { ...randomLook(Phaser.Utils.Array.GetRandom(SHIRTS)), shirt: 0xf77622 });
  scene.people.delete(promoter);
  promoter.setDepth(y - 0.5);
  loop(scene, { targets: promoter, x: tx + 1.5, duration: 900, yoyo: true, repeatDelay: 1200 });
  scene.obstacles.push({ x: x - SIZE.w / 2, y: y - SIZE.h + 6, w: SIZE.w, h: SIZE.h - 2 });
}
