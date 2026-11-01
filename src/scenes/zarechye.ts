// «Заречье» в мире (game/zarechye.ts): та же сцена и тот же buildWorld, только за дорогой — река.
// За дальним тротуаром гранитный парапет набережной, вода, на том берегу деревянные дома и ивы, слева
// мост, у нашего берега пристань; летом в дни теплохода у пристани стоит речной трамвайчик, в обычные
// дни по реке иногда проходит лодка. Соседи по улице свои: лодочная станция, кафе «Пристань», рыбная
// лавка Семёна Сома (в «Рыбный день» — флажки и сам Сом у входа, после мира — дружная вывеска), общежитие
// техникума. Улица, газон, дорога, парковка — общие (streets.ts, cars.ts).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { WING_OUTER, type Layout } from './layout';
import { ART, SIDE_SHOP_W, SIDE_SHOP_X, type Look } from './common';
import { zarBoatToday, zarBossLook } from '../game/zarechye';
import { isWet, weatherFor } from '../game/weather';
import * as streets from './streets';
import * as lighting from './lighting';
import * as persons from './persons';
import * as visitors from './visitors';

/** Река: от парапета (под дальним тротуаром) вниз на столько точек, потом тот берег. */
const RIVER_H = 150;
/** Мост — левее магазина, над водой от набережной до того берега. */
const BRIDGE_DX = -230;

/** Семён Сом у своей лавки: седые усы, кепка речника, свитер. */
const SOM_LOOK: Look = { shirt: 0x5a6988, skin: 0xe4a672, pants: 0x262b44, hair: 0xc0cbdc, style: 'cap' };

type Area = { x: number; y: number; w: number; h: number };

/**
 * Набережная, вода, мост и тот берег. Возвращает занятые места — сквер и деревья на них не встают.
 * top — верх ближнего тротуара (как в streets.buildStreet); дальний тротуар кончается на top + 88.
 */
export function buildRiver(scene: StoreScene, next: Layout, top: number, left: number, width: number): Area[] {
  const bank = top + 88;
  const water = bank + 8;
  const shore = water + RIVER_H;
  const tile = (x: number, y: number, w: number, h: number, key: string, depth: number) =>
    scene.add.tileSprite(x, y, w, h, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
  // Вода шире квартала: отдаляешь камеру — река не обрывается. Чуть ползёт вправо — течение.
  const river = tile(left - 400, water, width + 800, RIVER_H, 'zar_water', -9.5);
  if (!scene.lite) scene.tweens.add({ targets: river, tilePositionX: { from: 0, to: -64 }, duration: 16000, repeat: -1 });
  tile(left - 400, bank, width + 800, 10, 'zar_bank', -9.2);
  tile(left - 400, shore, width + 800, 12, 'zar_shore', -9.2);
  // Фонари набережной вдоль парапета: вечером горят, свет дрожит на воде.
  for (let x = left + 40; x < left + width - 20; x += 96) {
    scene.add.rectangle(x, bank - 2, 1.2, 9, 0x262b44).setDepth(bank);
    scene.add.circle(x, bank - 7, 1.6, 0xfff0c0).setDepth(bank + 0.1);
    lighting.nightGlow(scene, scene.art(x, bank - 7, 'glow').setDisplaySize(16, 14).setTint(0xffd890), 0.85, undefined, { map: { key: 'light_pool', scale: 1.3, gain: 1.1 } });
    lighting.nightGlow(scene, scene.add.rectangle(x, water + 14, 3, 18, 0xffd890), 0.25, undefined, { twinkle: x * 0.37 });
  }
  // Мост — над водой, выше парапета и берегов.
  const bx = next.w / 2 + BRIDGE_DX;
  scene.art(bx, bank - 2, 'zar_bridge').setOrigin(0.5, 0).setDepth(-8.5);
  // Пристань у нашего берега, правее входа.
  const px = next.w / 2 + 150;
  scene.art(px, water - 2, 'zar_pier').setOrigin(0.5, 0).setDepth(-8.6);
  // Теплоход у пристани — в его дни (zarBoatToday); туристы идут к нам.
  if (zarBoatToday(scene.state)) {
    const boat = scene.art(px + 40, water + 18, 'zar_tourboat').setOrigin(0.5, 0).setDepth(-8.7);
    if (!scene.lite) scene.tweens.add({ targets: boat, y: boat.y + 1, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  } else if (!scene.lite) {
    // Обычный день: по реке иногда проходит трамвайчик — в дождь не ходит.
    scene.worldTimer(45000, () => {
      if (!scene.sys.isActive() || isWet(weatherFor(scene.state.day))) return;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const from = dir > 0 ? left - 120 : left + width + 120;
      const boat = scene.art(from, water + 40 + Math.random() * 40, 'zar_tourboat').setOrigin(0.5, 0).setDepth(-8.8).setFlipX(dir < 0);
      scene.tweens.add({ targets: boat, x: from + dir * (width + 240), duration: 40000, onComplete: () => boat.destroy() });
    });
  }
  // Лодочник на вёслах — та же лодка, что в половодье (visitors.ts).
  if (!scene.lite) scene.worldTimer(30000, () => scene.sys.isActive() && Math.random() < 0.5 && visitors.rowBoat(scene, left, left + width, water + Phaser.Math.Between(50, 110)));
  // Тот берег: дома с наличниками, ивы у воды.
  const rnd = new Phaser.Math.RandomDataGenerator(['zarechye']);
  const houseY = shore + 8;
  for (let x = left + 30, i = 0; x < left + width - 30; x += rnd.between(58, 80), i++) {
    if (Math.abs(x - bx) < 34) continue;
    scene.art(x, houseY, `zar_house_${i % 3}`).setOrigin(0.5, 0).setDepth(houseY + 40);
    // Вечером в окнах свет.
    for (const dx of [-7.5, 14.5]) lighting.nightGlow(scene, scene.add.rectangle(x + dx - 3.5, houseY + 30, 5, 5, 0xffd890), 0.55, undefined, { from: Math.random() * 0.5 });
  }
  for (let x = left + 60; x < left + width - 40; x += rnd.between(110, 160)) {
    if (Math.abs(x - bx) < 40) continue;
    const willow = scene.art(x, shore + 6, 'zar_willow').setOrigin(0.5, 1).setDepth(shore + 6);
    scene.windTrees.push(willow);
  }
  // Ивы и у нашего парапета — по краям, не перед пристанью.
  for (const x of [left + 90, next.w / 2 + 300]) {
    const willow = scene.art(x, bank + 2, 'zar_willow').setOrigin(0.5, 1).setDepth(bank + 2);
    scene.windTrees.push(willow);
  }
  // Сквер, деревья и снег — не на воде.
  return [{ x: left - 400, y: bank - 4, w: width + 800, h: shore - bank + 60 }];
}

/** Соседи по улице в Заречье: лодочная станция, кафе «Пристань», рыбная лавка Сома, общежитие техникума. */
export function buildNeighbors(scene: StoreScene, next: Layout): void {
  const base = next.h + 4;
  const look = zarBossLook(scene.state);
  const som = look === 'friends' ? t('zar.n.somFriends') : t('zar.n.som');
  const neighbors = [
    { x: -136 - WING_OUTER, w: 112, h: 118, name: 'zar.n.cafe' as const, sign: 0x124e89, awning: 0x0099db, roof: 0xe8dcc0, neon: 0x8fd3ff },
    { x: -268 - WING_OUTER, w: 116, h: 128, name: 'zar.n.boats' as const, sign: 0x8f563b, awning: 0xb86f50, roof: 0xd8c4a8, neon: 0xffb860 },
    { x: next.w + SIDE_SHOP_X, w: SIDE_SHOP_W, h: 122, name: 'zar.n.som' as const, label: som, sign: 0x3a4466, awning: look === 'grumpy' ? 0x5a6988 : 0x0099db, roof: 0xc0cbdc, neon: 0x9cd8ff },
    { x: next.w + 170, w: 110, h: 150, name: 'zar.n.college' as const, sign: 0x3e8948, awning: 0x63c74d, roof: 0xe0e8d0, neon: 0x7cff8a, roofKit: 'dorm' as const },
  ];
  const rnd = new Phaser.Math.RandomDataGenerator(['zar-neighbors']);
  for (const n of neighbors) streets.drawNeighbor(scene, n, base, rnd);
  // Рыба на цепочках над дверью Сома.
  const somX = next.w + SIDE_SHOP_X + SIDE_SHOP_W / 2;
  scene.art(somX, base - 18, 'zar_fish_sign').setOrigin(0.5, 1).setDepth(base + 2);
  scene.art(-70 - WING_OUTER, scene.streetY - 4, 'bus_stop').setDepth(scene.streetY);
  if (look === 'duel') duelDay(scene, somX, base);
  else if (look === 'friends') {
    // Помирились: у лавки Сома — бочка с рыбой «для соседей» и цветы.
    scene.art(somX + 22, base + 8, 'tulips').setOrigin(0.5, 1).setDepth(base + 8);
  }
}

/** «Рыбный день»: флажки над лавкой Сома, растяжка и сам Сом у двери с рыбиной — зазывает. */
function duelDay(scene: StoreScene, x: number, base: number): void {
  const colors = [0x0099db, 0xffffff, 0xe43b44, 0xfee761];
  for (let i = 0, fx = x - SIDE_SHOP_W / 2 + 3; fx < x + SIDE_SHOP_W / 2; fx += 6, i++) {
    const flag = scene.add.triangle(fx, base - 34, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setDepth(base + 3);
    if (!scene.lite) scene.tweens.add({ targets: flag, angle: { from: -6, to: 6 }, duration: 600 + (i % 3) * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  scene.add
    .text(x, base - 42, t('zar.duel.banner'), { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#124e89', padding: { x: 3, y: 1 } })
    .setOrigin(0.5)
    .setResolution(scene.textRes(5))
    .setDepth(base + 4);
  const som = persons.makePerson(scene, x - 14, base + 10, SOM_LOOK).setDepth(base + 10);
  // Машет рыбиной, зазывая прохожих.
  const fish = scene.art(8, -8, 'zar_fish_sign').setScale(0.5 / ART);
  som.add(fish);
  if (!scene.lite) scene.tweens.add({ targets: fish, angle: { from: -20, to: 20 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}
