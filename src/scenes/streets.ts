// Улица и район вокруг магазина: газон, тротуар и дорога, соседние дома (кафе с верандой, конкурент
// Эдуард, аптека), свой филиал напротив (здание «Гиганта» или старый магазин «№2»), парк с прудом, район
// (поликлиника, школа, стадион, стройки), благоустройство (game/hood.ts), пустые участки «Сдаётся»,
// живой воздух над кварталом, голуби и реклама на улице. Машины и парковка — cars.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { STORE_LEVELS } from '../game/economy';
import { branchInOldShop, branchLook, branchSignName, branchTier, branchUpgrades } from '../game/branch';
import { hasHood, HOOD_SQUARE, hoodLook, type HoodId } from '../game/hood';
import { t, type TextKey } from '../i18n';
import type { Facing } from './stride';
import { UI_FONT } from '../ui/dom';
import { giantLook } from '../game/giant';
import { isWet, weatherFor } from '../game/weather';
import { yearTime } from '../game/calendar';
import { activeAds } from '../game/ads';
import { hasUpgrade } from '../game/upgrades';
import { sunflowersPlanted } from '../game/drama';
import { duelInfo } from '../platform/multiplayer';
import { BUILDINGS, BUILDING_IDS, buildingStage, districtKey, isMatchDay, type BuildingId } from '../game/district';
import { COURIER_SPAN, freeStreetX, ICE_CART_SPAN, type StreetSpan } from './placement';
import { WING_OUTER, type Layout } from './layout';
import { lawnShade, lawnTexture } from './floor';
import { eduardLook } from '../game/eduard';
import { cleanHall } from '../game/firstday';
import {
  ART,
  WALL,
  FACADE_H,
  type Neighbor,
  RIVAL_LOOKS,
  PARK_TREES,
  RIVAL_ACROSS_H,
  LIGHT_DEPTH,
  CUSTOMER_SPEED,
  TV_SPOTS,
  TV_SPAN,
  STAR_SPOTS,
  BLOGGER_SPAN,
  COLLAB_SPAN,
  SHIRTS,
  type Look,
  randomLook,
  customerLook,
  SIDE_SHOP_X,
  SIDE_SHOP_W,
  VERANDA_D,
  discard,
  type Pigeon,
} from './common';
import * as pets from './pets';
import * as lighting from './lighting';
import * as weatherFx from './weatherFx';
import * as cars from './cars';
import * as persons from './persons';

/**
 * Реклама видна на улице, пока работает: баннер на фасаде, промоутер с листовками, блогер у входа,
 * билборд за дорогой, съёмочная группа ТВ, блогер-звезда с фанатами, флажки городской кампании.
 * Радио в эфире — его не видно. Работает несколько реклам — видны все.
 */
export function applyAds(scene: StoreScene): void {
  for (const obj of scene.adObjs) discard(obj);
  scene.adObjs = [];
  const ads = new Set(activeAds(scene.state).map((a) => a.id));
  if (!ads.size) return;
  const { door, h, w } = scene.layout;
  const top = scene.streetY - 12;
  const keep = <T extends { destroy: () => void }>(obj: T): T => {
    scene.adObjs.push(obj);
    return obj;
  };
  /** Бесконечный твин рекламы: при смене реклам без пересборки мира его надо остановить (stop снимает его с менеджера). */
  const keepTween = (tween: Phaser.Tweens.Tween) => keep({ destroy: () => void tween.stop() });
  /** Стоит у входа и не участвует в жизни покупателей. */
  const extra = (x: number, y: number, look: Look, facing: Facing) => {
    const person = keep(persons.makePerson(scene, x, y, look));
    scene.people.delete(person);
    persons.setFacing(person, facing);
    return person;
  };
  /** Блёстки вокруг человека (не в лёгком режиме). */
  const sparkle = (target: Phaser.GameObjects.Container, frequency: number) => {
    if (scene.lite) return;
    const sparkles = keep(
      scene.add.particles(0, 0, 'spark', {
        lifespan: 700,
        speed: { min: 4, max: 14 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        frequency,
        x: { min: -8, max: 8 },
        y: { min: -16, max: 2 },
      }),
    );
    sparkles.startFollow(target).setDepth(LIGHT_DEPTH - 1);
  };
  if (ads.has('banner')) {
    const banner = keep(scene.art(door.x - 44, h + 4, 'ad_banner').setDepth(h + 44));
    keepTween(scene.tweens.add({ targets: banner, angle: { from: -1.5, to: 1.5 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
  }
  if (ads.has('city')) {
    // Городская кампания: флажки во всю ширину фасада.
    keep(scene.add.tileSprite(0, h + 1, w, 5, 'ad_flags').setOrigin(0).setTileScale(1 / ART).setDepth(h + 43));
  }
  if (ads.has('billboard') || ads.has('city')) {
    // Билборд за дорогой, на дальнем тротуаре справа от перехода: его видно из магазина.
    const base = top + 87;
    keep(scene.art(door.x + 70, base, 'ad_billboard').setOrigin(0.5, 1).setDepth(base));
  }
  if (ads.has('flyers') || ads.has('city')) {
    // Промоутер в жёлтом жилете раздаёт листовки прохожим.
    const spot = { x: door.x + 24, y: scene.streetY - 3 };
    extra(spot.x, spot.y, { ...randomLook(0xfee761), acc: 'vest', accTint: 0xfee761 }, 'down');
    keep(
      scene.time.addEvent({
        delay: 2200,
        loop: true,
        callback: () => {
          // Только на своём тротуаре: покупатели филиала за дорогой листовку не ловят.
          const target = [...scene.people].find((p) => p.active && Math.abs(p.x - spot.x) < 50 && p.y > scene.layout.h + FACADE_H && p.y < scene.streetY + 40);
          if (!target) return;
          const flyer = scene.art(spot.x, spot.y - 4, 'flyer').setDepth(spot.y + 20);
          scene.tweens.add({ targets: flyer, x: target.x, y: target.y - 4, angle: 180, duration: 450, onComplete: () => flyer.destroy() });
        },
      }),
    );
  }
  // У входа свои места: курьер с велосипедом (доставка) и летом тележка с мороженым — реклама их
  // обходит; съёмочная группа и блогер с фанатами друг на друга тоже не встают.
  const taken: StreetSpan[] = [
    ...(hasUpgrade(scene.state, 'delivery') ? [COURIER_SPAN] : []),
    ...(yearTime(scene.state.day) === 'summer' ? [ICE_CART_SPAN] : []),
  ];
  const tvX = freeStreetX(TV_SPOTS, TV_SPAN, taken);
  if (ads.has('tv')) taken.push([tvX + TV_SPAN[0], tvX + TV_SPAN[1]]);
  const starSpan: StreetSpan = ads.has('collab') ? COLLAB_SPAN : BLOGGER_SPAN;
  const star = { x: door.x + freeStreetX(STAR_SPOTS, starSpan, taken), y: h + FACADE_H + 8 };
  if (ads.has('collab')) {
    // Звезда соцсетей снимает обзор у входа, вокруг — фанаты с телефонами.
    const blogger = extra(star.x, star.y, { shirt: 0xb55088, pants: 0x262b44, hair: 0xfee761, style: 'long', skin: 0xf2d3ab }, 'up');
    sparkle(blogger, 140);
    [-14, 12, -4].forEach((dx, i) => {
      const fan = extra(star.x + dx, star.y + 8 + (i % 2) * 3, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day), dx < 0 ? 'right' : 'left');
      if (scene.lite) return;
      // Фанаты подпрыгивают от восторга.
      keepTween(scene.tweens.add({ targets: fan, y: fan.y - 2, duration: 260, yoyo: true, repeat: -1, repeatDelay: 900 + i * 370, ease: 'Sine.easeOut' }));
    });
  } else if (ads.has('blogger')) {
    // Блогер снимает обзор у входа: блёстки вокруг.
    const blogger = extra(star.x, star.y, { shirt: 0xf6757a, pants: 0x262b44, hair: 0xb55088, style: 'long', skin: 0xf2d3ab }, 'up');
    sparkle(blogger, 220);
  }
  if (ads.has('tv')) {
    // Съёмочная группа ТВ: камера на штативе и ведущая с микрофоном у витрины.
    const x = door.x + tvX;
    const y = h + FACADE_H + 12;
    keep(scene.art(x + 12, y, 'film_camera').setDepth(y + 6));
    extra(x + 20, y + 1, { shirt: 0x3a4466, pants: 0x262b44, hair: 0x3b2a35, style: 'short', skin: 0xe4a672 }, 'left');
    extra(x, y - 2, { shirt: 0xe43b44, pants: 0x262b44, hair: 0x733e39, style: 'long', skin: 0xf2d3ab }, 'right');
  }
}

/**
 * Соседи по улице: слева кафе и жилой дом, справа магазин конкурента Эдуарда и аптека.
 * Крыши с кондиционерами, кирпичные фасады с витринами, вывески.
 */
export function buildNeighbors(scene: StoreScene, next: Layout): void {
  const base = next.h + 4;
  const look = eduardLook(scene.state);
  scene.builtEduard = look;
  scene.builtClean = scene.cleanKey();
  // Босс района открывается за дорогой, на месте закрытого «Гиганта»; сбоку тогда — хозтовары.
  // Сбоку, когда босс за дорогой, — магазин друга по торговой неделе (или хозтовары).
  // Пустующее помещение тоже занимает друг.
  const free = scene.rivalAcross || look === 'vacant';
  const friend = free ? duelInfo()?.rival?.name : undefined;
  scene.builtFriend = friend;
  const side: Omit<Neighbor, 'x' | 'w'> = friend
    ? { h: 125, name: 'neighbor.friend', label: t('neighbor.friend', { name: friend }), sign: 0x3e8948, awning: 0xfee761, roof: 0xe8dcc0, neon: 0xfee761 }
    : scene.rivalAcross
      ? { h: 120, name: 'neighbor.hardware', sign: 0x5a6988, awning: 0x8b9bb4, roof: 0xd6dce8, neon: 0x9cd8ff }
      : RIVAL_LOOKS[look];
  const neighbors: Neighbor[] = [
    { x: -136 - WING_OUTER, w: 112, h: 120, name: 'neighbor.cafe', sign: 0x733e39, awning: 0xb86f50, roof: 0xe8c8b0, neon: 0xffb860, back: VERANDA_D },
    { x: -268 - WING_OUTER, w: 116, h: 150, name: 'neighbor.pharmacy', sign: 0x3e8948, awning: 0x63c74d, roof: 0xd0e4d0, neon: 0x7cff8a },
    { x: next.w + SIDE_SHOP_X, w: SIDE_SHOP_W, ...side },
    { x: next.w + 170, w: 110, h: 120, name: 'neighbor.bakery', sign: 0xb55088, awning: 0xf6757a, roof: 0xf2d0dc, neon: 0xff8ad8 },
  ];
  const rnd = new Phaser.Math.RandomDataGenerator(['neighbors']);
  for (const n of neighbors) drawNeighbor(scene, n, base - (n.back ?? 0), rnd);
  // Остановка на тротуаре слева.
  // Купили остановку с навесом (hood.ts) — вместо столбика со скамейкой.
  if (hasHood(scene.state, 'bus')) scene.art(-70 - WING_OUTER, scene.streetY - 2, 'hood_bus').setOrigin(0.5, 0.75).setDepth(scene.streetY);
  else scene.art(-70 - WING_OUTER, scene.streetY - 4, 'bus_stop').setDepth(scene.streetY);
  buildVeranda(scene, neighbors[0].x, neighbors[0].w, base);
}

/**
 * Здание с крышей, витринами, дверью, навесом и вывеской. across — за дорогой: вывеска
 * на краю крыши у дороги, чтобы читалась с нашей стороны.
 */
export function drawNeighbor(scene: StoreScene, n: Neighbor, bottom: number, rnd: Phaser.Math.RandomDataGenerator, across = false): void {
  const top = bottom - n.h;
  // За дорогой витрины смотрят на дорогу: фасад сверху, крыша за ним.
  const roofY = across ? top + FACADE_H : top;
  const front = across ? top + FACADE_H : bottom;
  scene.add.tileSprite(n.x, roofY, n.w, n.h - FACADE_H, 'roof').setOrigin(0).setTileScale(1 / ART).setTint(n.roof).setDepth(-3);
  scene.add.tileSprite(n.x - 2, (across ? bottom : top) - 3, n.w + 4, 3, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(-3);
  scene.add.tileSprite(n.x, front - FACADE_H, n.w, FACADE_H, scene.potTile('facade')).setOrigin(0).setTileScale(1 / ART).setDepth(front - 5);
  dressRoof(scene, n, roofY, n.h - FACADE_H, across, rnd);
  // Витрины, дверь и навес.
  const doorX = across ? n.x + n.w / 2 : n.x + n.w * 0.62;
  scene.art(doorX, front - 5, 'door').setDepth(front - 4);
  for (let x = n.x + 14; x < n.x + n.w - 10; x += 24) {
    if (Math.abs(x - doorX) < 22) continue;
    const win = scene.art(x, front - 4.5, 'shopwin').setDepth(front - 4);
    // Пустующее помещение — тёмные витрины без света.
    if (n.dark) win.setTint(0x8b9bb4);
    else lighting.windowLight(scene, x, front - 4.5, across ? top : front, across, rnd.frac() * 0.5);
  }
  // Новые фасады (hood.ts): под окнами — ящики с цветами, вдоль фасада — флажки. Пустующему — нет.
  if (!n.dark && hasHood(scene.state, 'facades')) {
    for (let x = n.x + 14; x < n.x + n.w - 10; x += 24) if (Math.abs(x - doorX) >= 22) scene.art(x, front - 0.5, 'hood_flowerbox').setDepth(front - 3.9);
    const colors = [0xfee761, 0xe43b44, 0x63c74d, 0x0099db];
    // Флажки одной фигурой на дом — не десятки отдельных треугольников.
    const flags = scene.add.graphics().setDepth(front - 3.8);
    for (let i = 0, fx = n.x + 2; fx <= n.x + n.w - 6; fx += 7, i++) flags.fillStyle(colors[i % colors.length], 1).fillTriangle(fx, front - FACADE_H, fx + 4, front - FACADE_H, fx + 2, front - FACADE_H + 3.5);
  }
  scene.awnings.push(scene.art(doorX, front - 9, 'awning').setScale(1 / ART, 0.6 / ART).setTint(n.awning).setDepth(front + 40));
  // Вывеска на краю крыши (за дорогой — над витринами, у самой дороги).
  const signY = across ? top - 12 : bottom - FACADE_H - 8;
  if (across) scene.signsAcross.push(n.x + n.w / 2);
  const signDepth = across ? front + 41 : front - 3;
  scene.art(n.x + n.w / 2, signY, 'sign').setTint(n.sign).setDepth(signDepth);
  scene.add
    .text(n.x + n.w / 2, signY, n.label ?? t(n.name), { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(signDepth + 1);
  if (n.neon) lighting.neonSign(scene, n.x + n.w / 2, signY, n.label ?? t(n.name), '6px', n.neon, 64);
}

/**
 * Крыша сверху: тень здания на газоне, парапет по краю (светлый к солнцу, тёмный в тень)
 * и что стоит на кровле — вытяжки, кондиционеры, люки, тарелки, баки, трубы. У зданий района
 * своё: вертолётная площадка, красный крест, бельё на верёвках, солнечные панели.
 */
export function dressRoof(scene: StoreScene, n: Neighbor, y: number, h: number, across: boolean, rnd: Phaser.Math.RandomDataGenerator): void {
  const { x, w } = n;
  // Тень — вправо и (у зданий за дорогой) вниз, на газон.
  scene.add.rectangle(x + w, y + 6, 6, h + (across ? FACADE_H - 6 : -6), 0x181425, 0.16).setOrigin(0).setDepth(-9.4);
  if (across) scene.add.rectangle(x + 6, y + h, w, 6, 0x181425, 0.16).setOrigin(0).setDepth(-9.4);
  // Парапет.
  const tone = Phaser.Display.Color.ValueToColor(n.roof);
  const light = tone.clone().lighten(14).color;
  const dark = tone.clone().darken(26).color;
  const edge = (ex: number, ey: number, ew: number, eh: number, color: number) => scene.add.rectangle(ex, ey, ew, eh, color).setOrigin(0).setDepth(-2.95);
  edge(x, y, w, 3, light);
  edge(x, y, 3, h, light);
  edge(x, y + h - 3, w, 3, dark);
  edge(x + w - 3, y, 3, h, dark);
  // Снег на кровле — виден только в снегопад (applyWeather).
  scene.roofSnow.push(scene.add.rectangle(x + 3, y + 3, w - 6, h - 6, 0xf4f8ff, 0.7).setOrigin(0).setDepth(-2.97).setVisible(scene.weather === 'snow'));
  // Тень от парапета на кровле.
  scene.add.rectangle(x + 3, y + 3, w - 6, 2, 0x181425, 0.12).setOrigin(0).setDepth(-2.94);
  scene.add.rectangle(x + 3, y + 3, 2, h - 6, 0x181425, 0.12).setOrigin(0).setDepth(-2.94);
  // Особая крыша — в середине; остальное — по клеткам вокруг, без наложений.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const busy: { x: number; y: number; r: number }[] = [];
  // Кровельные предметы крупнее обычного спрайта: крыши видно с высоты, мелочь там теряется.
  const put = (px: number, py: number, key: string, r: number, scale = 1.4) => {
    scene.art(px, py, key).setScale(scale / ART).setDepth(-2);
    busy.push({ x: px, y: py, r });
    // Вечером в световых окнах кровли горит тёплый свет — внутри работают.
    if (key === 'skylight') lighting.nightGlow(scene, scene.art(px, py, 'glow').setDisplaySize(26, 20).setTint(0xffd890), 0.7);
  };
  if (n.roofKit === 'office' && w >= 70 && h >= 60) put(cx, cy, 'roof_helipad', 32, 2.6);
  if (n.roofKit === 'clinic') put(cx, cy, 'roof_cross', 26, 3);
  if (n.roofKit === 'dorm') {
    put(cx - 6, cy - 12, 'roof_laundry', 30, 1.8);
    put(x + w - 22, y + h - 24, 'roof_tank', 16, 1.6);
  }
  if (n.roofKit === 'school') {
    for (const dx of [-26, 0, 26]) put(cx + dx, cy - 8, 'roof_solar', 18, 1.6);
  }
  const kinds = ['roof_vent', 'ac_unit', 'roof_hatch', 'ac_unit', 'roof_dish', 'skylight', 'roof_vent', 'roof_pipe', 'roof_tank', 'ac_unit'];
  const count = Math.max(4, Math.round((w * h) / 1500));
  for (let i = 0, tries = 0; i < count && tries < count * 10; tries++) {
    const px = x + 14 + rnd.frac() * (w - 28);
    const py = y + 14 + rnd.frac() * (h - 28);
    if (busy.some((b) => Math.hypot(b.x - px, b.y - py) < b.r + 11)) continue;
    put(px, py, kinds[rnd.between(0, kinds.length - 1)], 10);
    i++;
  }
}

/**
 * Летняя веранда кафе «Пончик»: деревянный настил с перилами, столики под полосатыми
 * зонтиками, за ними сидят посетители. Если с кафе договор — днём от него приходит
 * официант за заказом.
 */
export function buildVeranda(scene: StoreScene, x: number, w: number, base: number): void {
  const top = base - VERANDA_D;
  scene.add.tileSprite(x, top, w, VERANDA_D, 'floor_wood').setOrigin(0).setTileScale(1 / ART).setTint(0xd8b48a).setDepth(-6);
  // Перила по краю, проход посередине — к двери кафе.
  const gap = x + w * 0.62;
  const rail = (rx: number, rw: number) => {
    scene.add.rectangle(rx, base - 2, rw, 2, 0x733e39).setOrigin(0).setDepth(base);
    for (let px = rx; px <= rx + rw; px += 8) scene.add.rectangle(px, base - 5, 1.5, 5, 0x5a3a2a).setOrigin(0).setDepth(base);
  };
  rail(x, gap - 10 - x);
  rail(gap + 10, x + w - gap - 10);
  const looks = [0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088];
  const spots = [x + 18, x + 46, x + w - 18];
  spots.forEach((tx, i) => {
    const ty = top + 15;
    scene.art(tx, ty + 2, 'cafe_table').setDepth(ty + 6);
    scene.awnings.push(scene.art(tx, ty - 3, 'umbrella').setDepth(ty + 30));
    // За столиком кто-нибудь сидит (через раз — вдвоём).
    const guest = persons.makePerson(scene, tx - 7, ty + 3, randomLook(looks[i % looks.length]));
    scene.people.delete(guest);
    guest.setDepth(ty + 5);
    if (i !== 1) {
      const second = persons.makePerson(scene, tx + 7, ty + 3, randomLook(looks[(i + 2) % looks.length]));
      scene.people.delete(second);
      second.setDepth(ty + 5);
    }
  });
}

/** Улица вокруг здания: газон с деревьями, тротуар с фонарями и скамейкой, дорога. */
export function buildStreet(scene: StoreScene, next: Layout): void {
  const { h, door } = scene.layout;
  scene.signsAcross = [];
  const tile = (x: number, y: number, w: number, hh: number, key: string) =>
    scene.add.tileSprite(x, y, w, hh, key).setOrigin(0).setTileScale(1 / ART).setDepth(-10);
  const left = -400;
  const width = next.w + 800;
  const top = next.h + 4;
  // Газон с запасом за краями квартала: когда отдаляешь камеру, мир не обрывается в темноту.
  // Плитки травы вразнобой и с отражениями (floor.ts) — повтора не видно, поверх — большие мягкие
  // пятна светлой и тёмной травы. Один газон на всё: дорожки и дома ложатся сверху. В лёгкой
  // графике — прежний газон одной плиткой, без пятен.
  const lawn = { x: left - 400, y: -800, w: width + 800, h: top + 1600 };
  tile(lawn.x, lawn.y, lawn.w, lawn.h, scene.lite ? 'grass' : lawnTexture(scene));
  if (!scene.lite) lawnShade(scene, lawn, -10);
  scene.streetY = top + 12;
  scene.lawns = [
    { x: left, y: -400, w: width, h: top + 400 },
    { x: left, y: top + 88, w: width, h: 300 },
    // Газон за краями квартала (снег зимой — и там).
    { x: left - 400, y: -800, w: width + 800, h: 400 },
    { x: left - 400, y: top + 388, w: width + 800, h: 412 },
    { x: left - 400, y: -400, w: 400, h: top + 788 },
    { x: left + width, y: -400, w: 400, h: top + 788 },
  ];
  tile(left, top, width, 22, 'paving');
  scene.add.rectangle(left, top + 22, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
  tile(left, top + 24, width, 40, 'asphalt');
  for (let x = left; x < left + width; x += 24) scene.add.rectangle(x, top + 43.5, 12, 1.5, 0xe6e1d6).setOrigin(0).setDepth(-9);
  // Дорога живая: люки, заплаты и трещины (не на переходе).
  const road = scene.add.graphics().setDepth(-9.05);
  const roadRnd = new Phaser.Math.RandomDataGenerator(['road']);
  for (let x = left + 30; x < left + width - 30; x += roadRnd.between(60, 110)) {
    if (Math.abs(x - door.x) < 22) continue;
    const ry = top + 24 + roadRnd.between(6, 34);
    const roll = roadRnd.frac();
    if (roll < 0.3) {
      road.fillStyle(0x5a6988, 1).fillCircle(x, ry, 3.2);
      road.lineStyle(0.7, 0x8b9bb4, 1).strokeCircle(x, ry, 3.2);
      road.lineStyle(0.5, 0x3a4466, 1).lineBetween(x - 2, ry, x + 2, ry).lineBetween(x, ry - 2, x, ry + 2);
    } else if (roll < 0.6) {
      road.fillStyle(0x4a4f66, 0.55).fillRect(x, ry - 3, roadRnd.between(8, 16), roadRnd.between(4, 7));
    } else {
      road.lineStyle(0.7, 0x0b0c16, 1);
      let cx = x;
      let cy = ry;
      for (let k = 0; k < 4; k++) {
        const nx = cx + roadRnd.between(2, 5);
        const ny = cy + roadRnd.between(-2, 2);
        road.lineBetween(cx, cy, nx, ny);
        cx = nx;
        cy = ny;
      }
    }
  }
  scene.add.rectangle(left, top + 64, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
  tile(left, top + 66, width, 22, 'paving');
  // Дорожка от двери до тротуара через пустой участок.
  if (top > h + FACADE_H) tile(door.x - 12, h + FACADE_H, 24, top - h - FACADE_H, 'paving');
  // Пешеходный переход напротив входа.
  for (let y = top + 26; y < top + 62; y += 5) scene.add.rectangle(door.x - 9, y, 18, 2.5, 0xe6e1d6).setOrigin(0).setDepth(-9);

  // Фонари вдоль тротуара (не на дорожке), скамейка и урна у входа.
  for (let x = -100; x < next.w + 40; x += 72) {
    if (lighting.lampAt(scene, x)) scene.art(x, top + 3, 'lamp').setOrigin(0.5, 0.95).setDepth(top + 3);
  }
  scene.art(door.x + 44, top + 7, 'bench').setDepth(top + 7);
  scene.art(door.x - 32, top + 6, 'bin').setDepth(top + 6);
  // Деревья и кусты на газоне вокруг здания.
  // Справа от зала — проезд к парковке и дорожка вдоль стены (buildParking): деревьев там нет.
  const trees: [number, number][] = [
    [-14 - WING_OUTER, next.h * 0.35],
    [-16 - WING_OUTER, next.h * 0.8],
    [next.w * 0.25, -12],
    [next.w * 0.75, -16],
  ];
  scene.greenery = [];
  // Что качает ветер (windGust): деревья отсюда и с парковки, навесы соседей (drawNeighbor) и зонтики веранды.
  scene.windTrees = [];
  scene.awnings = [];
  // Пересборка убила твин порыва (killAll не зовёт onComplete) — новые деревья не должны застыть в наклоне.
  scene.gust = { t: 0, x: 0, on: false };
  // Дерево с тенью на газоне: свет сверху слева — тень ложится вправо-вниз от ствола.
  // Летом в ясный день тень кроны пятнистая и чуть колышется на ветру.
  const dapple = !scene.lite && yearTime(scene.state.day) === 'summer' && !isWet(weatherFor(scene.state.day));
  const plant = (key: string, x: number, y: number, depth: number) => {
    scene.add.image(x + 5, y + 1, 'shadow').setScale(2.1 / ART, 1.5 / ART).setAlpha(0.75).setDepth(depth - 0.01);
    const tree = scene.art(x, y, key).setOrigin(0.5, 0.9).setDepth(depth);
    scene.greenery.push(tree);
    scene.windTrees.push(tree);
    if (!dapple || key !== 'tree') return;
    const spots = [-7, -2, 4, 9].map((dx, i) =>
      scene.add.image(dx, (i % 2 ? 3 : -2) + Phaser.Math.Between(-1, 1), 'glow').setDisplaySize(Phaser.Math.Between(6, 9), 4).setTint(0x181425).setAlpha(0.22),
    );
    const leaves = scene.add.container(x + 5, y + 1, spots).setDepth(depth - 0.009);
    scene.tweens.add({ targets: leaves, x: x + 6.5, duration: Phaser.Math.Between(1700, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  };
  for (const [x, y] of trees) plant('tree', x, y, y);
  for (let x = 10; x < next.w; x += 34) scene.greenery.push(scene.art(x, -6, 'bush').setDepth(-6));
  // Сквер за кварталом и за дорогой: деревья, кусты и клумбы — газон не пустует, когда отдаляешь камеру.
  const rnd = new Phaser.Math.RandomDataGenerator(['park']);
  // «Гигант» за дорогой: напротив входа, на месте сквера (giant.ts).
  const giant = giantLook(scene.state);
  scene.builtGiant = giant;
  const giantArea = { x: door.x - 82, y: top + 86, w: 164, h: 112 };
  // Босс района (eduard.ts) — за дорогой напротив входа, когда «Гиганта» там нет или он закрылся.
  const look = eduardLook(scene.state);
  // Купили здание под филиал (branch.ts) — босс района возвращается на своё место сбоку, рядом с магазином.
  scene.builtBranch = branchLook(scene.state);
  scene.rivalAcross = !scene.builtBranch && look !== 'vacant' && look !== 'mega' && (giant === 'none' || giant === 'closed');
  if (scene.builtBranch && branchInOldShop(scene.state)) {
    buildOldBranch(scene, door.x, top + 92);
  } else if (scene.builtBranch) {
    buildBranch(scene, door.x, top + 92);
  } else if (scene.rivalAcross) {
    const rival = RIVAL_LOOKS[look];
    const h = Math.min(rival.h, RIVAL_ACROSS_H);
    drawNeighbor(scene, { ...rival, x: door.x - 64, w: 128, h }, top + 92 + h, new Phaser.Math.RandomDataGenerator(['rival']), true);
  } else if (giant !== 'none') {
    const key = giant === 'site' ? 'giant_site' : giant === 'store' ? 'giant_store' : 'giant_closed';
    scene.art(door.x, top + 92, key).setOrigin(0.5, 0).setDepth(top + 92 + 88);
  }
  // Здания района (district.ts): стройки и готовые — на газоне за дорогой и за магазином.
  const districtAreas = [...buildDistrict(scene, next, top), ...buildPark(scene, next, top), ...cars.buildParking(scene, next, top), ...buildHood(scene, next, top)];
  const inArea = (px: number, py: number, a: { x: number; y: number; w: number; h: number }) => px > a.x - 6 && px < a.x + a.w + 6 && py > a.y - 6 && py < a.y + a.h + 14;
  const scatter = (y0: number, y1: number) => {
    for (let y = y0; y < y1; y += 40) {
      for (let x = left + 10; x < left + width - 10; x += 46) {
        const px = x + rnd.between(-14, 14);
        const py = y + rnd.between(-12, 12);
        if ((giant !== 'none' || scene.rivalAcross) && px > giantArea.x && px < giantArea.x + giantArea.w && py > giantArea.y && py < giantArea.y + giantArea.h) continue;
        if (districtAreas.some((a) => inArea(px, py, a))) continue;
        const roll = rnd.frac();
        // За зданием глубина отрицательная — держим над газоном (-10), но под крышами соседей (-3).
        const depth = py < 0 ? -9.5 + (py + 400) / 1000 : py;
        // Сквер пёстрый: липы, берёзы, ели и цветущие кусты (art/flora.py).
        if (roll < 0.34) plant(rnd.pick(PARK_TREES), px, py, depth);
        else if (roll < 0.52) scene.greenery.push(scene.art(px, py, rnd.frac() < 0.3 ? 'bush_flower' : 'bush').setDepth(depth));
        else if (roll < 0.62) scene.greenery.push(scene.art(px, py, rnd.frac() < 0.5 ? 'flower' : 'tulips').setDepth(depth));
      }
    }
  };
  scatter(-380, Math.min(-40, top - 230));
  scatter(top + 104, top + 470);
  buildAmbient(scene, next, top, left, width);
  // Газон слева и справа от магазина: полосы стриженой травы, кусты и клумбы — не пустое поле.
  const sides = [
    { x0: left + 10, x1: -WING_OUTER - 28 },
    { x0: next.w + SIDE_SHOP_X, x1: left + width - 10 },
  ];
  for (const { x0, x1 } of sides) {
    if (x1 - x0 < 20) continue;
    for (let y = -36; y < top - 160 - VERANDA_D; y += 16) {
      if ((y / 16) % 2) scene.add.rectangle(x0 - 10, y, x1 - x0 + 20, 8, 0x3e8948, 0.07).setOrigin(0).setDepth(-9.6);
    }
    // Ниже — соседние дома вдоль улицы (buildNeighbors): самый высокий с верандой — до 150 + VERANDA_D.
    for (let y = 6; y < top - 162 - VERANDA_D; y += 34) {
      for (let x = x0; x < x1; x += 38) {
        const px = x + rnd.between(-10, 10);
        const py = y + rnd.between(-8, 8);
        if (districtAreas.some((a) => inArea(px, py, a)) || trees.some(([tx, ty]) => Math.abs(tx - px) < 22 && Math.abs(ty - py) < 26)) continue;
        const roll = rnd.frac();
        if (roll < 0.22) plant(rnd.pick(PARK_TREES), px, py, py);
        else if (roll < 0.45) scene.greenery.push(scene.art(px, py, rnd.frac() < 0.4 ? 'bush_flower' : 'bush').setDepth(py));
        else if (roll < 0.62) scene.greenery.push(scene.art(px, py, rnd.frac() < 0.5 ? 'flower' : 'tulips').setDepth(py));
      }
    }
  }
  // Парк за аллеей гуще — второй проход (деревья не встают на пруд, клумбы и дорожку).
  scatter(top + 290, top + 470);
}

/**
 * Свой филиал в здании «Гиганта» (branch.ts): здание после ремонта, на вывесках — название магазина
 * с «№2» и «Филиал». Вечером горят витрины и неон (и в карте освещения), днём заходят и выходят
 * покупатели (пока магазин открыт) — по одному-два, без лишней нагрузки; в лёгкой графике двое просто стоят у входа.
 * Чем больше улучшений, тем наряднее: ремонт — цветы и фонари у входа, реклама — флажки на крыше.
 */
export function buildBranch(scene: StoreScene, x: number, y: number): void {
  const depth = y + 88;
  scene.art(x, y, 'giant_branch').setOrigin(0.5, 0).setDepth(depth);
  // Вывеска на крыше: своё название с «№2» — во всю доску, длинное сжимаем.
  const name = branchSignName(scene.state, t('branch.defaultName'));
  const signY = y + 11.5;
  const sign = scene.add.text(x, signY, name, { fontFamily: UI_FONT, fontSize: '9px', color: '#fee761' }).setOrigin(0.5).setResolution(scene.textRes(4)).setDepth(depth + 1);
  const fit = Math.min(1, 86 / Math.max(1, sign.width));
  sign.setScale(fit);
  lighting.neonSign(scene, x, signY, name, `${Math.max(4, Math.floor(9 * fit))}px`, 0xfee761, 90);
  const label = t('branch.label');
  scene.add.text(x, y + 42.5, label, { fontFamily: UI_FONT, fontSize: '6px', color: '#ffffff' }).setOrigin(0.5).setResolution(scene.textRes(4)).setDepth(depth + 1);
  lighting.neonSign(scene, x, y + 42.5, label, '6px', 0x7cff8a, 46);
  // Витрины вечером светятся тёплым, свет ложится на тротуар перед зданием.
  const glassY = y + 67.5;
  for (const dx of [-63, -50, -37, -24, 23, 36, 49, 62]) {
    lighting.nightGlow(scene, scene.add.rectangle(x + dx, glassY, 10, 15, 0xffd890), 0.45, undefined, { from: Math.random() * 0.4 });
    const spill = scene.art(x + dx, y + 84, 'light_spill').setOrigin(0.5, 0).setTint(0xffd08a).setScale(0.7 / ART);
    lighting.nightGlow(scene, spill, 0.5, undefined, { map: { scale: 0.9, gain: 1.2, haze: 0.1 } });
  }
  // Стеклянный вход — самый яркий: свет из зала на крыльцо.
  const entry = scene.art(x, y + 86, 'glow').setDisplaySize(40, 18).setTint(0xffe6b0);
  lighting.nightGlow(scene, entry, 0.5, undefined, { map: { key: 'light_pool', scale: 1.6, gain: 1.4, haze: 0.15 } });
  // Ремонт: цветы в кадках у входа, потом фонари по бокам.
  const repair = branchTier(scene.state, 'repair');
  if (repair >= 1) for (const dx of [-30, 30]) scene.art(x + dx, y + 88, 'tulips').setOrigin(0.5, 1).setDepth(depth + 0.5);
  if (repair >= 3) {
    for (const dx of [-44, 44]) {
      scene.add.rectangle(x + dx, y + 80, 1, 8, 0x262b44).setDepth(depth + 1);
      scene.add.circle(x + dx, y + 75, 1.6, 0xfff0c0).setDepth(depth + 1);
      lighting.nightGlow(scene, scene.art(x + dx, y + 75, 'glow').setDisplaySize(14, 12).setTint(0xffd890), 0.8, undefined, { map: { key: 'light_pool', scale: 1.4, gain: 1.2 } });
    }
  }
  // Реклама: флажки вдоль края крыши.
  if (branchTier(scene.state, 'ads') >= 2) {
    const colors = [0xfee761, 0xe43b44, 0x63c74d, 0xffffff];
    for (let i = 0, fx = x - 68; fx <= x + 68; fx += 8, i++) scene.add.triangle(fx, y + 2, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setOrigin(0).setDepth(depth + 1);
  }
  branchShoppers(scene, x, y + 88, depth);
}

/**
 * Филиал после переезда в гипермаркет: за дорогой — старый магазин, маленький кирпичный дом. На доске
 * своё название с «№2», над дверью — «Филиал». Вечером светятся витрины и окошко двери, днём заходят
 * покупатели (в лёгкой графике двое стоят у входа). Ремонт — цветы и фонари, реклама — флажки, как у
 * филиала в здании «Гиганта»: купленные ступени видны и здесь.
 */
export function buildOldBranch(scene: StoreScene, x: number, y: number): void {
  const depth = y + 72;
  scene.art(x, y, 'branch_old').setOrigin(0.5, 0).setDepth(depth);
  const name = branchSignName(scene.state, t('branch.defaultName'));
  const signY = y + 12;
  const sign = scene.add.text(x, signY, name, { fontFamily: UI_FONT, fontSize: '8px', color: '#fee761' }).setOrigin(0.5).setResolution(scene.textRes(4)).setDepth(depth + 1);
  const fit = Math.min(1, 64 / Math.max(1, sign.width));
  sign.setScale(fit);
  lighting.neonSign(scene, x, signY, name, `${Math.max(4, Math.floor(8 * fit))}px`, 0xfee761, 68);
  const label = t('branch.label');
  scene.add.text(x, y + 37, label, { fontFamily: UI_FONT, fontSize: '4px', color: '#3b2a35' }).setOrigin(0.5).setResolution(scene.textRes(6)).setDepth(depth + 1);
  // Витрины и окошко двери вечером светятся, свет ложится на тротуар.
  for (const dx of [-29.5, 29.5]) {
    lighting.nightGlow(scene, scene.add.rectangle(x + dx, y + 52, 31, 22, 0xffd890), 0.4, undefined, { from: Math.random() * 0.4 });
    const spill = scene.art(x + dx, y + 68, 'light_spill').setOrigin(0.5, 0).setTint(0xffd08a).setScale(0.9 / ART);
    lighting.nightGlow(scene, spill, 0.5, undefined, { map: { scale: 0.9, gain: 1.2, haze: 0.1 } });
  }
  lighting.nightGlow(scene, scene.add.rectangle(x, y + 50, 10, 8, 0xffd890), 0.45);
  const entry = scene.art(x, y + 70, 'glow').setDisplaySize(26, 14).setTint(0xffe6b0);
  lighting.nightGlow(scene, entry, 0.5, undefined, { map: { key: 'light_pool', scale: 1.2, gain: 1.3, haze: 0.15 } });
  const repair = branchTier(scene.state, 'repair');
  if (repair >= 1) for (const dx of [-24, 24]) scene.art(x + dx, y + 72, 'tulips').setOrigin(0.5, 1).setDepth(depth + 0.5);
  if (repair >= 3) {
    for (const dx of [-34, 34]) {
      scene.add.rectangle(x + dx, y + 64, 1, 8, 0x262b44).setDepth(depth + 1);
      scene.add.circle(x + dx, y + 59, 1.6, 0xfff0c0).setDepth(depth + 1);
      lighting.nightGlow(scene, scene.art(x + dx, y + 59, 'glow').setDisplaySize(14, 12).setTint(0xffd890), 0.8, undefined, { map: { key: 'light_pool', scale: 1.4, gain: 1.2 } });
    }
  }
  if (branchTier(scene.state, 'ads') >= 2) {
    const colors = [0xfee761, 0xe43b44, 0x63c74d, 0xffffff];
    for (let i = 0, fx = x - 48; fx <= x + 48; fx += 8, i++) scene.add.triangle(fx, y + 3, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setOrigin(0).setDepth(depth + 1);
  }
  branchShoppers(scene, x, y + 72, depth, 60);
}

/** Покупатели филиала: подходят к стеклянному входу и заходят, другие выходят и уходят по тротуару. */
export function branchShoppers(scene: StoreScene, x: number, ground: number, depth: number, reach = 70): void {
  const walkY = ground + 6;
  const look = () => customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day);
  if (scene.lite) {
    // Лёгкая графика: двое стоят у входа — улица не пустая, а кадр не тратится.
    for (const dx of [-14, 12]) persons.makePerson(scene, x + dx, walkY, look()).setDepth(depth + 2);
    return;
  }
  const busy = { n: 0 };
  // Чем больше ступеней куплено, тем чаще заходят (но не больше трёх человек разом).
  const every = 7000 - Math.min(3000, branchUpgrades(scene.state) * 250);
  scene.worldTimer(every, () => {
    if (!scene.running || scene.night || busy.n >= 3 || !scene.sys.isActive()) return;
    busy.n++;
    const side = Math.random() < 0.5 ? -1 : 1;
    const far = { x: x + side * Phaser.Math.Between(reach, reach + 25), y: walkY + Phaser.Math.Between(-1, 3) };
    const door = { x: x + Phaser.Math.Between(-4, 4), y: walkY - 3 };
    const coming = Math.random() < 0.55;
    const from = coming ? far : door;
    const to = coming ? door : far;
    const person = persons.makePerson(scene, from.x, from.y, look()).setDepth(depth + 2);
    if (!coming) person.setAlpha(0);
    if (!coming) scene.tweens.add({ targets: person, alpha: 1, duration: 300 });
    void persons.walk(scene, person, to.x, to.y, persons.ownPace(scene, person, CUSTOMER_SPEED * 0.7)).then(() => {
      busy.n--;
      if (!coming) return person.destroy();
      // Зашёл внутрь: тает в дверях.
      scene.tweens.add({ targets: person, alpha: 0, duration: 300, onComplete: () => person.destroy() });
    });
  });
}

/**
 * Живой воздух над кварталом: бабочки над газоном, тени облаков ползут по крышам и траве,
 * время от времени пролетает стая птиц. Всё дневное — к вечеру гаснет (updateLighting).
 * В лёгком режиме — ничего из этого.
 */
export function buildAmbient(scene: StoreScene, next: Layout, top: number, left: number, width: number): void {
  scene.dayLife = [];
  scene.flockTimer?.remove();
  scene.windTimer?.remove();
  scene.windTimer = undefined;
  if (scene.lite) return;
  // Погоду берём по дню: при сборке квартала this.weather ещё вчерашняя (applyWeather — позже).
  const weather = weatherFor(scene.state.day);
  const sunny = weather === 'clear' || weather === 'heat' || weather === 'leaves';
  // Тени облаков: мягкие тёмные пятна медленно плывут через квартал.
  if (sunny) {
    for (let k = 0; k < 3; k++) {
      const y = -260 + k * 230;
      const cloud = scene.add.image(left + k * 260, y, 'glow').setDisplaySize(240, 120).setTint(0x181425).setDepth(LIGHT_DEPTH - 3);
      scene.dayLife.push({ obj: cloud, alpha: 0.16 });
      scene.tweens.add({ targets: cloud, x: left + width + 200, duration: 110000 + k * 23000, repeat: -1, onRepeat: () => cloud.setX(left - 200) });
    }
  }
  // Бабочки над газоном у магазина: порхают и перелетают с места на место.
  if (weather === 'clear' || weather === 'heat') {
    const spots = [
      { x: -WING_OUTER - 40, y: 40 },
      { x: next.w + 40, y: 60 },
      { x: next.w + 70, y: -60 },
      { x: next.w / 2 - 70, y: -40 },
    ];
    const tints = [0xfee761, 0xf6757a, 0xffffff, 0x8fd3ff];
    spots.forEach((p, k) => {
      const fly = scene.art(p.x, p.y, 'butterfly0').setTint(tints[k % tints.length]).setDepth(top + 5);
      scene.dayLife.push({ obj: fly, alpha: 1 });
      // Взмахи крыльями — твином (его убирает пересборка мира, таймер бы копился).
      scene.tweens.add({ targets: fly, scaleX: 0.35 / ART, duration: 130 + k * 15, yoyo: true, repeat: -1 });
      const hop = () => {
        if (!fly.active) return;
        scene.tweens.add({
          targets: fly,
          x: p.x + Phaser.Math.Between(-28, 28),
          y: p.y + Phaser.Math.Between(-20, 20),
          duration: Phaser.Math.Between(1400, 2600),
          ease: 'Sine.easeInOut',
          onComplete: hop,
        });
      };
      hop();
    });
  }
  // Стая птиц клином пролетает над кварталом раз в полминуты-минуту.
  scene.flockTimer = scene.time.addEvent({
    delay: 38000,
    loop: true,
    callback: () => {
      if (scene.night || !scene.sys.isActive()) return;
      const y0 = Phaser.Math.Between(-300, top);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const x0 = dir > 0 ? left - 60 : left + width + 60;
      for (let k = 0; k < 5; k++) {
        const bird = scene.art(x0 - dir * Math.abs(k - 2) * 9, y0 + (k - 2) * 7, 'pigeon_fly').setScale(0.9 / ART).setTint(0x3a4466).setFlipX(dir < 0).setDepth(LIGHT_DEPTH - 2);
        scene.tweens.add({ targets: bird, x: bird.x + dir * (width + 120), y: bird.y - 60, duration: 16000, onComplete: () => bird.destroy() });
        scene.tweens.add({ targets: bird, scaleY: 0.6 / ART, duration: 220, yoyo: true, repeat: -1 });
      }
    },
  });
  // Ветер: раз в полминуты через квартал проходит порыв, в грозу — вдвое чаще. Погоду смотрим
  // в момент порыва: она меняется и без пересборки мира (утром, когда кончилась гроза).
  let ticks = 0;
  scene.windTimer = scene.time.addEvent({
    delay: 6000,
    loop: true,
    callback: () => {
      ticks++;
      if (ticks % (scene.weather === 'storm' && !scene.rainStopped ? 2 : 5) === 0) weatherFx.windGust(scene);
    },
  });
}

/**
 * Район растёт (district.ts): за дорогой — поликлиника, общежитие и школа слева от конкурента,
 * бизнес-центр и стадион справа. Пока строят — забор, кран и табличка «Скоро». Возвращает,
 * где стоят здания, чтобы сквер не сажал на них деревья.
 */
export function buildDistrict(scene: StoreScene, next: Layout, top: number): { x: number; y: number; w: number; h: number }[] {
  scene.builtDistrict = districtKey(scene.state);
  const d = scene.layout.door.x;
  const across = top + 92;
  // Слева от конкурента — три здания, справа — бизнес-центр и стадион; ширина — по месту.
  const leftEdge = -395;
  const w3 = Math.min(130, Math.floor((d - 88 - leftEdge - 20) / 3));
  const stadiumX = d + 222;
  const spots: Record<BuildingId, { x: number; y: number; w: number; h: number; across: boolean }> = {
    clinic: { x: leftEdge, y: across, w: w3, h: 116, across: true },
    dorm: { x: leftEdge + w3 + 10, y: across, w: w3, h: 124, across: true },
    school: { x: leftEdge + 2 * (w3 + 10), y: across, w: w3, h: 104, across: true },
    office: { x: d + 90, y: across, w: 120, h: 130, across: true },
    stadium: { x: stadiumX, y: across, w: Math.min(180, next.w + 395 - stadiumX), h: 128, across: true },
  };
  const looks: Record<Exclude<BuildingId, 'stadium'>, Omit<Neighbor, 'x' | 'w' | 'h' | 'name'>> = {
    school: { sign: 0x3b5dc9, awning: 0xfeae34, roof: 0xf2d8a0, neon: 0xffe080 },
    office: { sign: 0x262b44, awning: 0x5fcde4, roof: 0xb8c8d8, neon: 0x9cd8ff },
    dorm: { sign: 0x733e39, awning: 0xc28569, roof: 0xe0c0a8, neon: 0xffb860 },
    clinic: { sign: 0xe43b44, awning: 0xffffff, roof: 0xe8f0f0, neon: 0xff6070 },
  };
  const rnd = new Phaser.Math.RandomDataGenerator(['district']);
  const areas: { x: number; y: number; w: number; h: number }[] = [];
  for (const id of BUILDING_IDS) {
    const stage = buildingStage(scene.state, id);
    if (stage === 'none') continue;
    const spot = spots[id];
    areas.push(spot);
    const name = t(`district.${id}` as TextKey);
    if (stage === 'site') {
      buildSite(scene, spot, name);
      continue;
    }
    if (id === 'stadium') {
      buildStadium(scene, spot, name);
      continue;
    }
    drawNeighbor(scene, { ...looks[id], x: spot.x, w: spot.w, h: spot.h, name: 'district.school', label: `${BUILDINGS[id].icon} ${name}`, roofKit: id }, spot.y + spot.h, rnd, true);
    // У школы на тротуаре — флагшток.
    if (id === 'school') scene.art(spot.x + 8, spot.y + 4, 'flagpole').setOrigin(0.5, 1).setDepth(spot.y + 44);
  }
  return areas;
}

/**
 * Парк за домами напротив: аллея с фонарями и скамейками, пруд с утками и камышом, клумбы.
 * Возвращает занятые места — сквер не сажает туда деревья.
 */
export function buildPark(scene: StoreScene, next: Layout, top: number): { x: number; y: number; w: number; h: number }[] {
  const d = scene.layout.door.x;
  const areas: { x: number; y: number; w: number; h: number }[] = [];
  // Аллея поперёк парка.
  const alley = top + 268;
  scene.add.tileSprite(-560, alley, next.w + 1120, 12, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
  scene.add.rectangle(-560, alley + 12, next.w + 1120, 1, 0x181425, 0.15).setOrigin(0).setDepth(-9.45);
  areas.push({ x: -560, y: alley - 4, w: next.w + 1120, h: 20 });
  for (let x = -520, i = 0; x < next.w + 520; x += 96, i++) {
    scene.art(x, alley + 2, 'lamp').setOrigin(0.5, 0.95).setDepth(alley + 2);
    // Вечером фонари аллеи светят, как уличные, и зажигаются так же — по одному.
    lighting.addLamp(scene, x, alley - 20, 0.1 + i * 0.02, 0.5);
    scene.art(x + 40, alley + 1, 'bench').setDepth(alley + 1);
  }
  // Пруд: берег, вода, блики, камыш и утки. Всё — над снегом на газоне (-9.5).
  const px = d + 90;
  const py = alley + 70;
  // Ночью в пруду отражаются луна и звёзды (поверх воды, мерцают).
  lighting.nightGlow(scene, scene.add.ellipse(px + 34, py - 8, 16, 7, 0xf4f8ff), 0.55, undefined, { twinkle: 0.4 });
  for (let i = 0; i < 9; i++) {
    const sx = px + Phaser.Math.Between(-55, 55);
    const sy = py + Phaser.Math.Between(-18, 18);
    if (Math.hypot((sx - px) / 70, (sy - py) / 24) > 1) continue;
    lighting.nightGlow(scene, scene.add.rectangle(sx, sy, 1.2, 1.2, 0xffffff), 0.9, undefined, { twinkle: i * 1.7 });
  }
  scene.parkPond = { x: px, y: py };
  scene.add.ellipse(px, py, 172, 78, 0xd8b88a).setDepth(-9.46);
  // Зимой пруд замерзает: лёд с трещинками, уток нет.
  const frozen = scene.weather === 'snow' || yearTime(scene.state.day) === 'winter';
  scene.add.ellipse(px, py, 160, 68, frozen ? 0xa8cce4 : 0x3b8fc8).setDepth(-9.45);
  scene.add.ellipse(px - 6, py - 4, 136, 50, frozen ? 0xd8ecf8 : 0x4aa3df).setDepth(-9.44);
  for (const [bx, by, bw] of [
    [-40, -14, 22],
    [18, 6, 30],
    [-8, 14, 14],
  ] as const) {
    scene.add.rectangle(px + bx, py + by, bw, 1.5, 0xbfe8ff, 0.8).setDepth(-9.43);
  }
  for (const [rx, ry] of [
    [-74, -6],
    [-70, 6],
    [72, -10],
    [76, 2],
  ] as const) {
    for (let i = 0; i < 4; i++) scene.add.rectangle(px + rx + i * 2, py + ry - (i % 2) * 3, 1.2, 7 + (i % 2) * 3, 0x3e8948).setOrigin(0.5, 1).setDepth(py + ry);
  }
  for (const [ux, uy] of frozen ? [] : ([
    [-22, -6],
    [-12, 2],
    [30, -2],
  ] as const)) {
    const duck = scene.add.container(px + ux, py + uy).setDepth(-9.42);
    duck.add([scene.add.ellipse(0, 0, 7, 4, 0xffffff), scene.add.circle(3, -2, 1.6, 0xffffff), scene.add.rectangle(5, -2, 2, 1, 0xfeae34)]);
    scene.tweens.add({ targets: duck, x: duck.x + Phaser.Math.Between(-14, 14), duration: Phaser.Math.Between(5000, 8000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  areas.push({ x: px - 92, y: py - 44, w: 184, h: 88 });
  // Клумбы вдоль аллеи.
  const flowers = [0xffffff, 0xf6757a, 0xfee761, 0xb55088, 0xe43b44];
  const rnd = new Phaser.Math.RandomDataGenerator(['park-beds']);
  for (const bx of [d - 260, d - 120, d + 250]) {
    const by = alley + 26;
    scene.add.rectangle(bx, by, 64, 22, 0x8f563b).setOrigin(0).setDepth(-9.46);
    scene.add.rectangle(bx + 2, by + 2, 60, 18, 0x733e39).setOrigin(0).setDepth(-9.45);
    // Зимой клумбы под снегом.
    if (frozen) scene.add.rectangle(bx + 2, by + 2, 60, 18, 0xf4f8ff).setOrigin(0).setDepth(-9.44);
    for (let i = 0; i < (frozen ? 0 : 9); i++) {
      scene.art(bx + 7 + (i % 5) * 12 + rnd.between(-2, 2), by + 7 + Math.floor(i / 5) * 9, rnd.frac() < 0.6 ? 'flower' : 'tulips')
        .setTint(rnd.pick(flowers))
        .setDepth(by + 10);
    }
    areas.push({ x: bx, y: by, w: 64, h: 22 });
  }
  return areas;
}

/**
 * Благоустройство района (hood.ts): купленное стоит на улице. На том тротуаре — чугунные фонари и
 * вазоны, у остановки — велопарковка, в парке слева от пруда — площадь с лавочками, елью, ярмарочными
 * лавками, росписью и памятником бабушке, у пруда — фонтан и детская площадка. Остановка с навесом и
 * ящики с цветами у соседей — в buildNeighbors и drawNeighbor. Вечером горят фонари, гирлянда ели и
 * подсветка памятника. В лёгкой графике фонтан без брызг. Возвращает занятые места — сквер не сажает
 * туда деревья.
 */
export function buildHood(scene: StoreScene, next: Layout, top: number): { x: number; y: number; w: number; h: number }[] {
  scene.builtHood = hoodLook(scene.state);
  const areas: { x: number; y: number; w: number; h: number }[] = [];
  if (!scene.builtHood) return areas;
  const d = scene.layout.door.x;
  const has = (id: HoodId) => hasHood(scene.state, id);
  const winter = yearTime(scene.state.day) === 'winter';
  // Нижний край тротуара за дорогой: фонари стоят на нём, не мешая пешеходам.
  const far = top + 85;
  if (has('lamps')) {
    // Свои фонари — через 72 от −100; эти — между ними, за дорогой. Не на переходе, не за вывесками
    // зданий и не в рекламном щите (он у тротуара справа от входа, ads).
    for (let x = -352, i = 0; x < next.w + 340; x += 72, i++) {
      if (Math.abs(x - d) < 40 || Math.abs(x - d - 70) < 30 || scene.signsAcross.some((c) => Math.abs(x - c) < 40)) continue;
      scene.art(x, far, 'hood_lamp').setOrigin(0.5, 0.95).setDepth(far);
      const lamp = lighting.addLamp(scene, x, far - 20, 0.06 + i * 0.015, 0.4);
      for (const dx of [-3.75, 4.25]) lighting.lampGlow(scene, lamp, scene.art(x + dx, far - 20.5, 'glow').setScale(10 / 64).setTint(0xfff0b0), 0.9);
    }
  }
  if (has('beds')) {
    for (let x = -316; x < next.w + 340; x += 144) {
      if (Math.abs(x - d) < 30) continue;
      // У бордюра: ниже по тротуару висят вывески зданий района.
      scene.art(x, top + 76, winter ? 'hood_planter_winter' : 'hood_planter').setOrigin(0.5, 0.9).setDepth(top + 76);
    }
  }
  // Велопарковка — на нашем тротуаре у остановки, ближе к углу.
  if (has('bikes')) scene.art(-70 - WING_OUTER - 36, scene.streetY + 3, 'hood_bikes').setOrigin(0.5, 0.9).setDepth(scene.streetY + 3);

  // Площадь в парке слева от пруда: плитка с бордюром, по краям — кусты.
  const alley = top + 268;
  // Между клумбами аллеи (d−260 и d−120) к площади ведёт дорожка.
  const sq = { x: d - 258, y: alley + 56, w: 200, h: 100 };
  const plaza = HOOD_SQUARE.some(has);
  if (plaza) {
    scene.add.rectangle(sq.x - 2, sq.y - 2, sq.w + 4, sq.h + 4, 0xc0cbdc).setOrigin(0).setDepth(-9.47);
    scene.add.tileSprite(sq.x, sq.y, sq.w, sq.h, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
    // Дорожка от аллеи к площади.
    scene.add.tileSprite(sq.x + sq.w / 2 - 8, alley + 12, 16, sq.y - alley - 12, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
    areas.push({ x: sq.x - 8, y: alley, w: sq.w + 16, h: sq.y + sq.h - alley + 8 });
    for (const [bx, by] of [[sq.x + 6, sq.y + 8], [sq.x + sq.w - 6, sq.y + 8], [sq.x + 6, sq.y + sq.h - 2], [sq.x + sq.w - 6, sq.y + sq.h - 2]] as const) {
      scene.greenery.push(scene.art(bx, by, 'bush_flower').setDepth(by));
    }
  }
  const cx = sq.x + sq.w / 2;
  if (has('mural')) {
    // Расписанная стена у дальнего края площади: на двух столбиках.
    const my = sq.y + 26;
    for (const dx of [-17, 17]) scene.add.rectangle(cx - 60 + dx, my + 2, 2, 5, 0x3b2a35).setDepth(my);
    scene.art(cx - 60, my, 'hood_mural').setOrigin(0.5, 1).setDepth(my + 0.1);
  }
  if (has('benches')) {
    for (const bx of [cx + 22, cx + 58]) scene.art(bx, sq.y + 20, 'bench').setDepth(sq.y + 20);
    // Вечером над лавочками — два фонаря площади.
    for (const [lx, i] of [[cx + 4, 0], [cx + 82, 1]] as const) {
      scene.art(lx, sq.y + 22, 'lamp').setOrigin(0.5, 0.95).setDepth(sq.y + 22);
      lighting.addLamp(scene, lx, sq.y, 0.12 + i * 0.03, 0.45);
    }
  }
  if (has('statue')) {
    const sy = sq.y + sq.h / 2 + 22;
    scene.art(cx, sy, 'hood_statue').setOrigin(0.5, 0.97).setDepth(sy);
    scene.add
      .text(cx, sy - 11.5, t('hood.statue.plaque'), { fontFamily: UI_FONT, fontSize: '4px', color: '#3b2a35' })
      .setOrigin(0.5)
      .setResolution(scene.textRes(6))
      .setDepth(sy + 0.1);
    // Подсветка снизу: вечером бронза светится тёплым.
    lighting.nightGlow(scene, scene.art(cx, sy - 6, 'glow').setDisplaySize(34, 30).setTint(0xffd890), 0.5, undefined, { map: { key: 'light_pool', scale: 1.1, gain: 1.3, haze: 0.2 } });
  }
  if (has('fir')) {
    const fx = cx + 70;
    const fy = sq.y + sq.h - 10;
    scene.art(fx, fy, winter ? 'hood_fir_xmas' : 'hood_fir').setOrigin(0.5, 0.95).setDepth(fy);
    // Зимой ёлка наряжена: вечером мигают огоньки.
    if (winter) {
      const colors = [0xfee761, 0xe43b44, 0x2ce8f5, 0x63c74d, 0xffffff];
      for (let i = 0; i < 14; i++) {
        const k = (i + 0.5) / 14;
        const ly = fy - 36 + k * 30;
        const lx = fx + (((i * 7) % 11) / 10 - 0.5) * (6 + k * 18);
        lighting.nightGlow(scene, scene.add.rectangle(lx, ly, 1.2, 1.2, colors[i % colors.length]), 0.95, undefined, { twinkle: i * 1.3 });
      }
      lighting.nightGlow(scene, scene.art(fx, fy - 41, 'glow').setScale(12 / 64).setTint(0xfee761), 0.9, undefined, { twinkle: 0.7 });
      lighting.nightGlow(scene, scene.art(fx, fy - 18, 'glow').setDisplaySize(44, 50).setTint(0xffd890), 0.3, undefined, { map: { scale: 1, gain: 1.1, haze: 0.2 } });
    }
  }
  if (has('fair')) {
    // Три лавки у края площади и гирлянда лампочек над ними.
    const fy = sq.y + sq.h - 6;
    const xs = [cx - 78, cx - 54, cx - 30];
    xs.forEach((x, i) => scene.art(x, fy, `hood_stall_${'RUE'[i]}`).setOrigin(0.5, 0.95).setDepth(fy));
    for (let x = xs[0] - 10, i = 0; x <= xs[2] + 10; x += 5, i++) {
      const ly = fy - 23 + Math.sin(((x - xs[0] + 10) / 26) * Math.PI) * 1.5;
      lighting.nightGlow(scene, scene.add.rectangle(x, ly, 1.2, 1.2, i % 2 ? 0xfee761 : 0xffb860), 0.9, undefined, { twinkle: i * 0.9 });
    }
  }

  // Фонтан на берегу пруда, детская площадка — правее.
  const pond = scene.parkPond;
  if (has('fountain') && pond) {
    const fx = pond.x + 132;
    const fy = pond.y + 4;
    scene.art(fx, fy, 'hood_fountain').setOrigin(0.5, 0.88).setDepth(fy);
    areas.push({ x: fx - 20, y: fy - 24, w: 40, h: 28 });
    // Летом струя играет: капли разлетаются и падают в чашу. Зимой фонтан выключен, в лёгкой графике — без брызг.
    if (!scene.lite && !winter) {
      for (let i = 0; i < 4; i++) {
        const drop = scene.add.rectangle(fx, fy - 19, 1, 1, 0xbfe8ff).setDepth(fy + 0.1);
        const dir = i % 2 ? 1 : -1;
        scene.tweens.add({ targets: drop, x: fx + dir * (5 + (i >> 1) * 3), y: fy - 8, duration: 700, delay: i * 180, repeat: -1, ease: 'Quad.easeIn' });
      }
    }
    lighting.nightGlow(scene, scene.art(fx, fy - 8, 'glow').setDisplaySize(40, 18).setTint(0x9cd8ff), 0.35, undefined, { twinkle: 0.3 });
  }
  if (has('playground') && pond) {
    const px = pond.x + 210;
    const py = pond.y + 46;
    scene.art(px, py, 'hood_playground').setOrigin(0.5, 1).setDepth(py);
    areas.push({ x: px - 26, y: py - 32, w: 52, h: 34 });
  }
  return areas;
}

/** Стройка: забор, котлован, кран и табличка «Скоро: …». */
export function buildSite(scene: StoreScene, a: { x: number; y: number; w: number; h: number; across: boolean }, name: string): void {
  const base = a.y + a.h;
  scene.add.rectangle(a.x, a.y, a.w, a.h, 0x8f563b).setOrigin(0).setDepth(-8);
  for (let i = 0; i < 6; i++) scene.add.rectangle(a.x + 10 + rnd(a.w - 30), a.y + 10 + rnd(a.h - 30), 14 + rnd(10), 8 + rnd(6), 0x733e39).setOrigin(0).setDepth(-7.9);
  // Забор по краю со стороны дороги и по бокам.
  const fenceY = a.across ? a.y : base - 6;
  for (let x = a.x; x < a.x + a.w; x += 6) scene.add.rectangle(x, fenceY, 5, 6, (x / 6) % 2 ? 0xc0cbdc : 0x8b9bb4).setOrigin(0).setDepth(fenceY + 6);
  scene.add.rectangle(a.x, a.y, 3, a.h, 0x8b9bb4).setOrigin(0).setDepth(a.y + a.h);
  scene.add.rectangle(a.x + a.w - 3, a.y, 3, a.h, 0x8b9bb4).setOrigin(0).setDepth(a.y + a.h);
  // Кран: мачта, стрела и груз.
  const cx = a.x + a.w * 0.7;
  const cy = a.y + a.h * 0.75;
  scene.add.rectangle(cx, cy - 70, 4, 70, 0xfeae34).setOrigin(0).setDepth(cy + 1);
  scene.add.rectangle(cx - 46, cy - 72, 64, 4, 0xfeae34).setOrigin(0).setDepth(cy + 1);
  scene.add.rectangle(cx - 40, cy - 68, 1, 22, 0x262b44).setOrigin(0).setDepth(cy + 1);
  scene.add.rectangle(cx - 44, cy - 46, 9, 6, 0x5a6988).setOrigin(0).setDepth(cy + 1);
  // Каркас будущего здания.
  for (let i = 0; i < 3; i++) scene.add.rectangle(a.x + 16 + i * 22, a.y + a.h * 0.35, 3, a.h * 0.45, 0xc0cbdc).setOrigin(0).setDepth(a.y + a.h * 0.8);
  scene.add.rectangle(a.x + 14, a.y + a.h * 0.35, 50, 3, 0xc0cbdc).setOrigin(0).setDepth(a.y + a.h * 0.8);
  const signY = a.across ? a.y - 6 : base + 4;
  if (a.across) scene.signsAcross.push(a.x + a.w / 2);
  scene.add.rectangle(a.x + a.w / 2, signY, 70, 11, 0xfee761).setDepth(signY + 20);
  scene.add
    .text(a.x + a.w / 2, signY, t('district.soon', { name }), { fontFamily: UI_FONT, fontSize: '5px', color: '#262b44' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(signY + 21);
  function rnd(n: number): number {
    return Math.floor(Math.random() * Math.max(1, n));
  }
}

/** Стадион: трибуны, поле с разметкой, прожекторы; в день матча — болельщики на трибунах. */
export function buildStadium(scene: StoreScene, a: { x: number; y: number; w: number; h: number }, name: string): void {
  const depth = -7.5;
  scene.add.rectangle(a.x, a.y, a.w, a.h, 0x8b9bb4).setOrigin(0).setDepth(depth);
  const field = { x: a.x + 16, y: a.y + 18, w: a.w - 32, h: a.h - 36 };
  scene.add.rectangle(field.x, field.y, field.w, field.h, 0x3e8948).setOrigin(0).setDepth(depth + 0.01);
  for (let x = field.x; x < field.x + field.w; x += 16) scene.add.rectangle(x, field.y, 8, field.h, 0x4a9c52).setOrigin(0).setDepth(depth + 0.02);
  const line = (x: number, y: number, w: number, h: number) => scene.add.rectangle(x, y, w, h, 0xffffff, 0.85).setOrigin(0).setDepth(depth + 0.03);
  line(field.x + 3, field.y + 3, field.w - 6, 1);
  line(field.x + 3, field.y + field.h - 4, field.w - 6, 1);
  line(field.x + 3, field.y + 3, 1, field.h - 6);
  line(field.x + field.w - 4, field.y + 3, 1, field.h - 6);
  line(field.x + field.w / 2, field.y + 3, 1, field.h - 6);
  scene.add.circle(field.x + field.w / 2, field.y + field.h / 2, 10).setStrokeStyle(1, 0xffffff, 0.85).setDepth(depth + 0.03);
  // Трибуны рядами; в день матча на них болельщики.
  const match = isMatchDay(scene.state);
  const colors = [0xe43b44, 0x0099db, 0xfee761, 0xffffff, 0x63c74d];
  for (const [sx, sy, sw] of [
    [a.x, a.y, a.w],
    [a.x, a.y + a.h - 16, a.w],
  ] as const) {
    for (let r = 0; r < 4; r++) scene.add.rectangle(sx, sy + r * 4, sw, 3, r % 2 ? 0x5a6988 : 0x6a7898).setOrigin(0).setDepth(depth + 0.04);
    if (match) for (let i = 0; i < sw / 3; i++) scene.add.rectangle(sx + 1 + i * 3, sy + 1 + (i % 4) * 4, 2, 2, colors[i % colors.length]).setOrigin(0).setDepth(depth + 0.05);
  }
  // Прожекторы по углам.
  for (const [px, py] of [
    [a.x + 4, a.y + 2],
    [a.x + a.w - 6, a.y + 2],
  ] as const) {
    scene.add.rectangle(px, py - 26, 2, 28, 0x3a4466).setOrigin(0).setDepth(a.y + a.h);
    scene.add.rectangle(px - 3, py - 30, 8, 5, 0xe6e1d6).setOrigin(0).setDepth(a.y + a.h);
  }
  scene.art(a.x + a.w / 2, a.y - 10, 'sign').setTint(0x3e8948).setDepth(a.y + a.h + 1);
  scene.signsAcross.push(a.x + a.w / 2);
  scene.add
    .text(a.x + a.w / 2, a.y - 10, `${BUILDINGS.stadium.icon} ${name}`, { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(a.y + a.h + 2);
}

/** Кот спит на скамейке у входа, голуби клюют крошки на тротуаре. */
export function buildCritters(scene: StoreScene, next: Layout): void {
  const { door } = scene.layout;
  const top = next.h + 4;
  scene.critterTimers.forEach((timer) => timer.remove());
  scene.critterTimers = [];
  // Кот и доска отзывов — у самого входа: пока рядом пустой участок, они стоят у фасада,
  // а в самом большом магазине — на тротуаре (кот спит на скамейке).
  const atStreet = next === scene.layout;
  const front = scene.layout.h + FACADE_H;
  pets.buildCat(scene, door.x + 47, atStreet ? top + 8.5 : front + 10);
  pets.buildBobik(scene, door.x - 24, atStreet ? top + 8.5 : front + 10);
  // Подсолнухи, которые посадила Соня, — у самого входа.
  if (sunflowersPlanted(scene.state)) {
    const y = atStreet ? top + 8.5 : front + 10;
    scene.art(door.x - 11, y + 2, 'sunflowers').setOrigin(0.5, 1).setDepth(y + 3);
  }
  scene.buildReviewBoard(door.x + 28, atStreet ? top + 13 : front + 13);

  scene.pigeons = [];
  // У края газона, подальше от прохожих: пугаются только тех, кто прошёл совсем рядом.
  const spots: [number, number][] = [
    [door.x - 64, top + 5],
    [door.x - 55, top + 7],
    [door.x - 47, top + 4],
  ];
  for (const [x, y] of spots) {
    const img = scene.art(x, y, 'pigeon0').setOrigin(0.5, 1).setDepth(y).setFlipX(Math.random() < 0.5);
    const bird: Pigeon = { img, home: { x, y }, away: false };
    scene.pigeons.push(bird);
    // Клюёт: наклоняется к земле и иногда разворачивается.
    const peck = () => {
      if (bird.away || Math.random() < 0.4) return;
      img.setTexture('pigeon1');
      scene.time.delayedCall(220, () => !bird.away && img.active && img.setTexture('pigeon0'));
      if (Math.random() < 0.25) img.setFlipX(!img.flipX);
    };
    scene.critterTimers.push(scene.time.addEvent({ delay: Phaser.Math.Between(500, 900), loop: true, callback: peck }));
  }
}

/** Человек подошёл близко — голуби разлетаются и через десяток секунд возвращаются. */
export function scarePigeons(scene: StoreScene): void {
  for (const bird of scene.pigeons) {
    if (bird.away || !bird.img.active) continue;
    // Ноги человека на 8 ниже центра спрайта.
    const near = [...scene.people].some((p) => Math.abs(p.x - bird.home.x) < 12 && Math.abs(p.y + 8 - bird.home.y) < 14);
    if (!near) continue;
    bird.away = true;
    const { img, home } = bird;
    // Голуби взлетают молча: хлопанье крыльев на каждого прохожего звучало то и дело (просьба автора — убрать).
    const dir = Math.random() < 0.5 ? -1 : 1;
    img.setTexture('pigeon_fly').setFlipX(dir < 0).setDepth(LIGHT_DEPTH - 1);
    // Взмахи — повтор мира: перестроили зал посреди полёта (твин погашен) — перестают махать и они.
    const stopFlap = scene.worldTimer(110, () => img.active && img.setTexture(img.texture.key === 'pigeon_fly' ? 'pigeon0' : 'pigeon_fly'));
    scene.tweens.add({
      targets: img,
      x: home.x + dir * Phaser.Math.Between(60, 90),
      y: home.y - Phaser.Math.Between(70, 100),
      alpha: 0,
      duration: 1400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        stopFlap();
        scene.time.delayedCall(Phaser.Math.Between(5000, 8000), () => {
          if (!img.active) return;
          // Прилетает обратно сверху и садится на своё место.
          img.setPosition(home.x - dir * 50, home.y - 60).setAlpha(1).setTexture('pigeon_fly').setFlipX(dir > 0);
          scene.tweens.add({
            targets: img,
            x: home.x,
            y: home.y,
            duration: 1200,
            ease: 'Sine.easeOut',
            onComplete: () => {
              img.setTexture('pigeon0').setDepth(home.y);
              bird.away = false;
            },
          });
        });
      },
    });
  }
}

/** На пустом участке растёт бурьян и лежит всякое: кирпичи, песок, конусы, шина, лужа. */
export function scatterLot(scene: StoreScene, next: Layout): void {
  const { w, h, door } = scene.layout;
  const rnd = new Phaser.Math.RandomDataGenerator([`lot${scene.state.level}`]);
  const areas: { x: number; y: number; w: number; h: number }[] = [];
  if (next.w > w) areas.push({ x: w + WALL + 6, y: 6, w: next.w - w - WALL - 14, h: next.h - 16 });
  if (next.h > h) areas.push({ x: 8, y: h + FACADE_H + 6, w: w - 4, h: next.h - h - FACADE_H - 16 });
  for (const a of areas) {
    if (a.w < 10 || a.h < 10) continue;
    const count = 2 + Math.round((a.w * a.h) / 1400);
    for (let i = 0; i < count; i++) {
      const x = a.x + rnd.frac() * a.w;
      const y = a.y + rnd.frac() * a.h;
      // Не на дорожке к двери.
      if (Math.abs(x - door.x) < 20 && y > h) continue;
      const key = rnd.weightedPick(['weeds', 'weeds', 'weeds', 'puddle', 'tire', 'cone', 'sand', 'bricks']);
      scene.art(x, y, key).setDepth(key === 'puddle' ? -7 : y);
    }
  }
}

/** Пустая соседняя площадь «Сдаётся» за забором — туда магазин вырастет при расширении. */
export function buildForRent(scene: StoreScene, next: Layout): void {
  const { w, h, door } = scene.layout;
  const cost = STORE_LEVELS[scene.state.level + 1].cost;
  const tile = (x: number, y: number, ww: number, hh: number, key: string, depth = -5) =>
    scene.add.tileSprite(x, y, ww, hh, scene.potTile(key)).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
  if (next.w > w) tile(w + 3, 0, next.w - w - 3, next.h, 'lot', -8);
  if (next.h > h) tile(0, h + 3, w + 3, next.h - h - 3, 'lot', -8);
  scatterLot(scene, next);
  // Забор по краю участка, в нём проход к двери.
  if (next.w > w) {
    tile(w + 3, -5, next.w - w - 3, 7, 'fence_h');
    tile(next.w - 4, 0, 4, next.h, 'fence_v');
  }
  if (next.h > h) {
    tile(0, h + 3, 4, next.h - h - 3, 'fence_v');
    tile(0, next.h - 7, door.x - 12, 7, 'fence_h', next.h);
    tile(door.x + 12, next.h - 7, next.w - door.x - 12, 7, 'fence_h', next.h);
  } else if (next.w > w) {
    tile(w + 3, next.h - 7, next.w - w - 3, 7, 'fence_h', next.h);
  }
  // Табличка «Сдаётся» с ценой. Новичку первой недели — только когда денег на переезд уже хватает.
  if (cleanHall(scene.state) && scene.state.money < cost) return;
  // Табличка стоит ниже кота и доски отзывов у входа.
  const signX = next.w - w > 40 ? w + (next.w - w) / 2 : door.x + 44;
  const signY = next.w - w > 40 ? next.h / 2 : Math.max(h + (next.h - h) / 2, h + FACADE_H + 22);
  scene.art(signX, signY, 'for_rent').setDepth(signY + 8);
  scene.add
    .text(signX, signY - 2.5, `${t('store.forRent')}\n${cost} 💰`, {
      fontFamily: UI_FONT,
      fontSize: '4px',
      color: '#2b2233',
      align: 'center',
    })
    .setOrigin(0.5)
    .setResolution(scene.textRes(8))
    .setDepth(signY + 9);
}
