// Гипермаркет: низ торгового зала (27.11, слабое место «в гипермаркете нижняя половина зала пустая»). Между нижним
// рядом островов и входом лежала голая плитка. Теперь там то, чем обжита зона у входа большого магазина: уголок
// аттракционов (мягкий коврик, автоматы с игрушками и капсулами, лошадка и машинка-качалки), сезонная фотозона на подиуме (зимой ёлочка с
// подарками, весной клумба, летом пляжный зонт, осенью стог с тыквами) и скамья вокруг кадки у касс.
//
// Товара на них нет: островные витрины с товаром игроки принимали за полки, с которых не покупают (buildShowcases).
// Это убранство, а не игра: оно уступает место всему, что ставит игра (полкам и местам под них, кассам с очередью,
// киоскам, ларю, полкам своей марки и 18+, уценке, вещам игрока, дверям, сотрудникам), и встаёт, только если от
// входа по-прежнему можно дойти до каждой полки, очереди, киоска и двери флигеля. Его обходят как мебель.
// Рисунок - art/hyper_hall.py.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { HYPER_LEVEL } from '../game/economy';
import { yearTime } from '../game/calendar';
import { registerSlots } from '../game/registers';
import { kioskSlots } from '../game/lanes';
import { blockedZones, standFor, tillZones } from './placement';
import { brandRect, iceboxRect, kioskSpot, licenseRect, type Point, type Room } from './layout';
import { FEET, planHyperHall } from './hyperPlan';
import type { Rect } from './paths';
import * as shelves from './shelves';
import * as building from './building';
import * as staff from './staff';
import * as food from './food';
import * as lighting from './lighting';

/** Человек (сотрудник, кот) стоит в точке p: место вокруг его ног. */
const spotRect = (p: Point): Rect => ({ x: p.x - 7, y: p.y - 10, w: 14, h: 20 });

/** Всё, что в зале занято игрой: мебель, места под полки и кассы, люди на своих местах, проходы. */
function takenRects(scene: StoreScene): Rect[] {
  const { layout, state } = scene;
  const { door, h } = layout;
  const has = (kind: string) => state.shelves.some((sh) => sh.kind === kind);
  const stands = layout.slots.map((p) => standFor(layout, p)).map((p) => ({ x: p.x - 10, y: p.y - 10, w: 20, h: 20 }));
  const homes = (['guard', 'manager', 'loader', 'cleaner'] as const).map((role) => spotRect(staff.workerHome(scene, role)));
  const clerks = scene.registers.map((r) => spotRect(r.clerk));
  const byDoor = [-46, -26, -24, 26, 46].map((dx) => ({ x: door.x + dx - 11, y: h - 22, w: 22, h: 22 }));
  const brand = has('brand') ? [brandRect(shelves.brandSpot(scene))].map((r) => ({ ...r, h: r.h + 18 })) : [];
  const license = has('license') ? [licenseRect(shelves.licenseSpot(scene))].map((r) => ({ ...r, h: r.h + 18 })) : [];
  const bargain = scene.bargainAt ? [{ x: scene.bargainAt.x - 16, y: building.bargainStand(scene, scene.bargainAt) - 10, w: 32, h: 30 }] : [];
  const meal = food.foodStand(scene);
  const cat = scene.catImg ? [spotRect(scene.catHome)] : [];
  return [
    ...scene.obstacles,
    ...tillZones(layout, registerSlots(state), kioskSlots(state)),
    ...blockedZones(layout),
    ...stands,
    ...homes,
    ...clerks,
    ...byDoor,
    // Проход от двери вглубь зала: стрелки на полу и поток покупателей.
    { x: door.x - 20, y: h - 76, w: 40, h: 76 },
    iceboxRect(shelves.iceboxSpot(scene)),
    ...brand,
    ...license,
    ...bargain,
    ...(meal ? [spotRect(meal)] : []),
    ...cat,
  ];
}

/** Куда должны доходить люди от входа: к полкам, в очередь, к киоскам, во флигель, к ведру и туалету. */
function targetPoints(scene: StoreScene): Point[] {
  const { layout } = scene;
  const rooms = [layout.warehouse, layout.bakery, layout.coffee, layout.kitchen, ...layout.tenants].filter((r): r is Room => Boolean(r));
  const kiosks = Array.from({ length: kioskSlots(scene.state) }, (_, i) => kioskSpot(layout, i)).map((k) => ({ x: k.x - 14, y: k.y }));
  return [
    ...layout.slots.map((p) => standFor(layout, p)),
    { x: layout.queue.x, y: layout.queue.y },
    ...rooms.map((r) => r.doorway),
    ...kiosks,
    building.binStand(scene),
    { x: layout.wc.x, y: layout.wc.spotY },
    ...(['guard', 'manager', 'cleaner'] as const).map((role) => staff.workerHome(scene, role)),
    ...scene.registers.map((r) => r.clerk),
  ];
}

/** Убранство низа зала гипермаркета. Зовётся последним при сборке зала - когда всё игровое уже стоит. */
export function buildHyperHall(scene: StoreScene): void {
  if (scene.state.level < HYPER_LEVEL) return;
  const season = yearTime(scene.state.day);
  const pieces = planHyperHall(scene.layout, takenRects(scene), scene.obstacles, targetPoints(scene));
  for (const piece of pieces) {
    scene.obstacles.push(piece.block);
    // Ноги человека перед вещью - ниже её переднего края: он рисуется поверх, тот, что за ней, - под ней.
    const depth = piece.y - FEET + 2;
    if (piece.id === 'kids') {
      const { x, y } = piece;
      // Коврик - на плитке, под тенями живого пола (как вставки отделов): тень автомата и машинки ложится на него.
      scene.art(x, y, 'hyper_kidsmat').setDepth(0.2);
      // Сзади - автомат с игрушками и два с капсулами; спереди - лошадка-качалка (как в детской зоне фудкорта) и
      // машинка-качалка. Низ картинки - на полу.
      const stand = (ax: number, ay: number, key: string, oy = 1) => scene.art(ax, ay, key).setOrigin(0.5, oy).setDepth(ay - FEET + 2);
      const claw = stand(x - 21, y + 2, 'hyper_claw');
      clawLights(scene, claw);
      stand(x - 6, y - 3, 'hyper_capsule');
      stand(x + 5, y - 3, 'hyper_capsule');
      stand(x - 15, y + 14, 'fc3_horse', 0.92);
      stand(x + 17, y + 15, 'hyper_ride');
    } else if (piece.id === 'season') {
      scene.art(piece.x, piece.y + 1, `hyper_season_${season}`).setOrigin(0.5, 1).setDepth(depth);
    } else {
      scene.art(piece.x, piece.y + 1, 'hyper_bench').setOrigin(0.5, 1).setDepth(depth);
    }
  }
}

/**
 * Лампочки вывески и подсветка стекла автомата с игрушками: вечером светят в карте освещения (ровно - карту ради
 * мигания не перерисовываем); не в лёгкой графике лампочки ещё и перемигиваются.
 */
function clawLights(scene: StoreScene, claw: Phaser.GameObjects.Image): void {
  const lit = scene.art(claw.x, claw.y, 'hyper_claw_lit').setOrigin(0.5, 1).setDepth(claw.depth + 0.1).setBlendMode(Phaser.BlendModes.ADD);
  if (!scene.lite) scene.tweens.add({ targets: lit, alpha: { from: 1, to: 0.35 }, duration: 640, yoyo: true, repeat: -1, ease: 'Stepped' });
  const glow = scene.light.add('glow', claw.x, claw.y - 20, 30, 26, 0xc890ff, 0).attach(claw);
  glow.sync = () => glow.set(0.55 * scene.evening * lighting.powerOn(scene, claw.y));
}
