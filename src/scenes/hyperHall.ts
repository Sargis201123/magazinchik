// Гипермаркет: низ торгового зала (27.11, слабое место «в гипермаркете нижняя половина зала пустая»). Между нижним
// рядом островов и входом лежала голая плитка. Теперь там то, чем обжита зона у входа большого магазина: уголок
// аттракционов (резиновый коврик с дорогой, автоматы с игрушками и капсулами, ракета и машинка-качалки - не мягкий
// пазл детской зоны фудкорта), сезонная фотозона на подиуме (зимой ёлочка с подарками, а если у входа уже стоит
// новогодняя ёлка из украшений - снеговик с санками; весной клумба, летом пляжный зонт, осенью стог с тыквами) и
// скамья вокруг кадки у касс. Выше, над нижним рядом островов, через весь зал к кассам идёт главный проход - полоса
// терракотовой плитки в полу со стрелками к кассам (лежит в полу: ни обходить, ни нажимать).
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
import { activeDecor } from '../game/decor';
import { blockedZones, standFor, tillZones } from './placement';
import { brandRect, iceboxRect, kioskSpot, licenseRect, type Point, type Room } from './layout';
import { AISLE_H, FEET, planAisle, planHyperHall } from './hyperPlan';
import type { Rect } from './paths';
import { ART } from './common';
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
  buildAisle(scene);
  const season = yearTime(scene.state.day);
  // Новогодняя ёлка из украшений уже стоит у входа - зимой на подиуме снеговик с санками, а не вторая ёлка.
  const treeByDoor = activeDecor(scene.state, 'holiday')?.id === 'holiday_tree';
  const seasonKey = season === 'winter' && treeByDoor ? 'hyper_season_snow' : `hyper_season_${season}`;
  const pieces = planHyperHall(scene.layout, takenRects(scene), scene.obstacles, targetPoints(scene));
  for (const piece of pieces) {
    scene.obstacles.push(piece.block);
    // Ноги человека перед вещью - ниже её переднего края: он рисуется поверх, тот, что за ней, - под ней.
    const depth = piece.y - FEET + 2;
    if (piece.id === 'kids') {
      buildKids(scene, piece.x, piece.y, piece.small === true);
    } else if (piece.id === 'season') {
      // Подиум - на 1.5 точки выше низа картинки (под ним контур и тень на полу).
      scene.art(piece.x, piece.y + 2.5, seasonKey).setOrigin(0.5, 1).setDepth(depth);
    } else {
      scene.art(piece.x, piece.y + 1, 'hyper_bench').setOrigin(0.5, 1).setDepth(depth);
    }
  }
}

/**
 * Уголок аттракционов на коврике с серединой в (x, y). Коврик - на плитке, под тенями живого пола (как вставки
 * отделов): тени автоматов ложатся на него. Сзади - автомат с игрушками, капсулы и ракета на пружине, спереди
 * справа - машинка-качалка; спереди слева видна «зебра» на дороге коврика. Маленький - без машинки и вторых капсул.
 */
function buildKids(scene: StoreScene, x: number, y: number, small: boolean): void {
  scene.art(x, y, small ? 'hyper_kidsmat_s' : 'hyper_kidsmat').setDepth(0.2);
  // Низ картинки - на полу; глубина - по ногам, как у людей.
  const stand = (ax: number, ay: number, key: string) => scene.art(ax, ay, key).setOrigin(0.5, 1).setDepth(ay - FEET + 2);
  if (small) {
    clawLights(scene, stand(x - 12, y + 2, 'hyper_claw'));
    stand(x + 2, y - 1, 'hyper_capsule');
    stand(x + 14, y + 4, 'hyper_rocket');
    return;
  }
  clawLights(scene, stand(x - 21, y + 1, 'hyper_claw'));
  stand(x - 6, y - 3, 'hyper_capsule');
  stand(x + 5, y - 3, 'hyper_capsule');
  stand(x + 24, y - 1, 'hyper_rocket');
  stand(x + 5, y + 15, 'hyper_ride');
}

/**
 * Главный проход к кассам: полоса терракотовой плитки в полу от левой стены до касс со стрелками к ним
 * (art/hyper_hall.py aisle). Ниже вставок отделов и коврика (0.19): полка, переставленная на проход, и её вставка -
 * поверх полосы. Не препятствие и не кнопка.
 */
function buildAisle(scene: StoreScene): void {
  const { layout, state } = scene;
  const fixtures = [
    ...(state.shelves.some((sh) => sh.kind === 'icebox') ? [iceboxRect(shelves.iceboxSpot(scene))] : []),
    ...(state.shelves.some((sh) => sh.kind === 'brand') ? [brandRect(shelves.brandSpot(scene))] : []),
    ...(state.shelves.some((sh) => sh.kind === 'license') ? [licenseRect(shelves.licenseSpot(scene))] : []),
  ];
  const aisle = planAisle(layout, [...tillZones(layout, registerSlots(state), kioskSlots(state)), ...blockedZones(layout), ...fixtures]);
  if (!aisle) return;
  const { x0, x1, y } = aisle;
  const DEPTH = 0.19;
  scene.add.tileSprite(x0 + 2, y, x1 - x0 - 4, AISLE_H, building.potTile(scene, 'hyper_aisle')).setOrigin(0).setTileScale(1 / ART).setDepth(DEPTH);
  scene.art(x0, y, 'hyper_aisle_l').setOrigin(0).setDepth(DEPTH);
  scene.art(x1, y, 'hyper_aisle_r').setOrigin(1, 0).setDepth(DEPTH);
}

/**
 * Лампочки вывески и подсветка стекла автомата с игрушками. Вечером автомат светит в карте освещения (ровно - карту
 * ради мигания не перерисовываем), а в зале под лампами этого не видно - поверх карты над ним ещё сиреневый ореол
 * (как огоньки новогодней ёлки). Не в лёгкой графике лампочки перемигиваются, и ореол есть только там.
 */
function clawLights(scene: StoreScene, claw: Phaser.GameObjects.Image): void {
  const lit = scene.art(claw.x, claw.y, 'hyper_claw_lit').setOrigin(0.5, 1).setDepth(claw.depth + 0.1).setBlendMode(Phaser.BlendModes.ADD);
  const glass = claw.y - 16;
  const glow = scene.light.add('glow', claw.x, glass, 40, 34, 0xc890ff, 0).attach(claw);
  glow.sync = () => glow.set(0.9 * scene.evening * lighting.powerOn(scene, claw.y));
  if (scene.lite) return;
  scene.tweens.add({ targets: lit, alpha: { from: 1, to: 0.35 }, duration: 640, yoyo: true, repeat: -1, ease: 'Stepped' });
  lighting.nightGlow(scene, scene.art(claw.x, glass, 'glow').setDisplaySize(36, 32).setTint(0xc890ff), 0.6, undefined, { store: true });
}
