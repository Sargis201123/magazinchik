// Свет в зале и на улице: потолочные лампы (зажигаются с искрой, мотыльки у ламп), подсветка мебели и
// витрин, пылинки, часы на стене, солнечные лучи, премиальные бра и люстры, фонари, неон и окна вечером.
// Сама карта освещения — light.ts, время суток и цвет неба — daylight.ts; здесь — что зажечь и когда.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS, SHELF_KINDS, type Category } from '../game/economy';
import { hasHood, HOOD_SQUARE } from '../game/hood';
import { ambience } from '../platform/ambience';
import { UI_FONT } from '../ui/dom';
import { activeDecor } from '../game/decor';
import { WING_OUTER, type Layout } from './layout';
import { ambientAt, lerpKeys } from './daylight';
import { gearTier } from '../game/gear';
import {
  ART,
  LAMP_POOL_ALPHA,
  LIGHT_REACH,
  HALL_LAMP,
  HALL_WARM,
  HALL_LED,
  SHELF_WARM,
  SHELF_COLD,
  SHELF_MEAT,
  LIGHT_DEPTH,
  EVENING_FROM,
  LAMP_BLINK,
  LAMP_WARMUP,
  VENDING_BLINK,
  LOT,
  LOT_DRIVE_END,
  type GlowMap,
  type NightLight,
  type Lamp,
} from './common';

/**
 * Карта освещения под новый мир (scenes/light.ts): где есть свет (квартал вокруг магазина, за ним — фон
 * улицы) и где фон зала — сам зал и флигель. Источники вписывают в неё улица, зал и погода, пока строятся.
 */
export function resetLight(scene: StoreScene, next: Layout): void {
  const { w, h, wing } = scene.layout;
  const left = -WING_OUTER;
  // Карта — от парковки за магазином до сквера за дорогой и на квартал в стороны (докуда отводят камеру):
  // там фонари, окна соседей и фары.
  // Площадь района в парке (hood.ts) — ниже: тогда карта длиннее, чтобы фонари и подсветка памятника ложились на плитку.
  const square = HOOD_SQUARE.some((id) => hasHood(scene.state, id));
  const area = { x: -LIGHT_REACH, y: LOT.top - 80, w: next.w + 2 * LIGHT_REACH, h: next.h - LOT.top + 80 + (square ? 470 : 320) };
  const rooms = [
    { x: -3, y: -3, w: w + 6, h: h + 6 },
    { x: left - 3, y: wing.y - 4, w: -left, h: h - wing.y + 7 },
  ];
  scene.light.reset(area, rooms, LIGHT_DEPTH);
}

/** Электричество в магазине: отключили (событие дня или квартал без света) — лампы, полки и экраны гаснут. */
export function powerOn(scene: StoreScene): number {
  return scene.blackout || scene.powerCut ? 0 : 1;
}

/**
 * Свет: фонари вдоль улицы, пятно у входа, лампы во флигеле, бра на задней стене. Темноту и свет на
 * земле, полу и стенах рисует карта освещения; сами лампочки светятся поверх неё.
 */
export function buildLighting(scene: StoreScene, next: Layout): void {
  const { w, h } = scene.layout;
  scene.lampXs = [];
  const top = next.h + 4;
  for (let x = -100; x < next.w + 40; x += 72) {
    if (!lampAt(scene, x)) continue;
    // Вдоль улицы фонари загораются по очереди слева направо — как будто идёт фонарщик.
    const lamp = addLamp(scene, x, top - 19, 0.04 + scene.lampXs.length * 0.035, 0.6, true);
    scene.lampXs.push(x);
    // Под фонарём на тротуаре — тёплая лужа света.
    lampGlow(scene, lamp, scene.art(x, scene.streetY - 2, 'glow').setDisplaySize(44, 44).setTint(0xffc860), 0.7, { key: 'light_pool', w: 112, h: 58, gain: 1.25 });
  }
  // У входа на тротуар падает тёплый свет зала.
  nightGlow(scene, scene.art(scene.layout.door.x, h + 8, 'glow').setDisplaySize(40, 40).setTint(0xffd890), 0.7, undefined, { store: true, map: { key: 'light_pool', w: 56, h: 30, gain: 0.9 } });
  // Флигель: в каждой открытой комнате и на складе — свой плафон (гаснет вместе со светом в зале).
  const led = gearTier(scene.state, 'lights');
  for (const room of scene.openRooms()) {
    const lamp = scene.light.add('light_pool', room.x + room.w / 2, room.y + room.h / 2 + 4, room.w * 1.5, room.h * 1.5, led ? HALL_LED : HALL_WARM);
    lamp.sync = () => lamp.set(0.62 * powerOn(scene));
  }
  // Вечером под карнизом задней стены загораются бра: мягкие конусы света вниз по стене — над каждой
  // картиной и окном, которые не закрыты полкой (как в buildDecor), и над дверью туалета. Сама стена
  // к вечеру уходит в полумрак, под карнизом ложится тень — на ней свет и видно; картины, окна и часы
  // не темнеют (они выше). С премиальным светом (buildLights) у стены свои светильники.
  scene.wallCones = [];
  scene.wallDusk = undefined;
  scene.furnitureOn = { wall: 1, vending: 1 };
  if (!activeDecor(scene.state, 'light')) {
    const { wallH, wc } = scene.layout;
    const ink = 0x181425;
    scene.wallDusk = scene.add.graphics().setDepth(0.99).setAlpha(0);
    scene.wallDusk.fillStyle(0x3a2434, 0.24).fillRect(0, 0, w, wallH);
    scene.wallDusk.fillGradientStyle(ink, ink, ink, ink, 0.5, 0.5, 0, 0).fillRect(0, 0, w, 4);
    const spots = [wc.x];
    for (let x = 30; x < wc.x - 16; x += 64) if (!scene.behindShelf(x, 10)) spots.push(x);
    for (const x of spots) {
      const tint = led ? 0xeef4ff : 0xffd08a;
      // Конус — свет на стене: он в карте освещения (сам по себе не рисуется), сила — как у бра.
      const cone = scene.art(x, 1, 'light_cone').setOrigin(0.5, 0).setDisplaySize(26, wallH - 6).setTint(tint).setVisible(false);
      scene.light.follow(cone, { scale: 1.15, power: () => cone.alpha * 1.4 });
      // Сам светильник — яркая точка под карнизом.
      const bulb = scene.art(x, 2, 'glow').setDisplaySize(9, 5).setTint(tint);
      for (const img of [cone, bulb]) scene.wallCones.push(img.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(1.05));
    }
  }
  scene.updateLighting(scene.running ? undefined : 0);
}

/**
 * Фонарь: конус света от плафона до земли (в карте освещения — свет на тех, кто под ним, а в воздухе —
 * лёгкая дымка) и ореол вокруг лампы; горят, когда он зажёгся.
 */
export function addLamp(scene: StoreScene, x: number, y: number, from: number, cone: number, street = false): Lamp {
  const lamp: Lamp = { x, y, from, street };
  scene.lamps.push(lamp);
  lampGlow(scene, lamp, scene.art(x, y, 'light_cone').setOrigin(0.5, 0).setTint(0xffd27a), cone, { scale: 1.2, gain: 1.3, haze: 0.4 });
  lampGlow(scene, lamp, scene.art(x, y, 'glow').setScale(16 / 64).setTint(0xfff0b0), 0.9);
  return lamp;
}

/** Свет фонаря: виден, пока фонарь горит; только что зажёгшись — оранжевый, потом теплеет до своего цвета. */
export function lampGlow<T extends Phaser.GameObjects.Image>(scene: StoreScene, lamp: Lamp, img: T, alpha: number, map?: GlowMap): T {
  return nightGlow(scene, img, alpha, undefined, { lamp, tint: img.tintTopLeft, map });
}

/**
 * Фонарь зажигается, когда вечер дошёл до его очереди. Если это видно (вечер наступает при нас),
 * он пару раз мигает и над плафоном проскакивает искра; если сразу ночь — просто горит.
 */
export function igniteLamp(scene: StoreScene, lamp: Lamp, evening: number, now: number): void {
  if (evening <= lamp.from) {
    lamp.litAt = undefined;
    lamp.warm = false;
    return;
  }
  if (lamp.litAt !== undefined) return;
  const live = scene.running && !scene.night && evening - lamp.from < 0.05;
  lamp.litAt = live ? now : now - LAMP_WARMUP;
  if (live) {
    lampSpark(scene, lamp);
    // Щелчок поджига, «дзинь» плафона и короткое гудение (только если фонарь на экране).
    ambience.street('lamp', lamp.x);
  }
}

/** Яркость фонаря: не горит — 0; только что зажёгся — мигает (LAMP_BLINK); дальше ровно. */
export function lampPower(lamp: Lamp, now: number): number {
  if (lamp.litAt === undefined) return 0;
  const step = Math.floor((now - lamp.litAt) / 70);
  return step < LAMP_BLINK.length ? LAMP_BLINK[step] : 1;
}

/** Искра над плафоном зажёгшегося фонаря: вспышка сжимается и гаснет, искорка отлетает. */
export function lampSpark(scene: StoreScene, lamp: Lamp): void {
  if (scene.lite || !scene.cameras.main.worldView.contains(lamp.x, lamp.y)) return;
  const flash = scene.art(lamp.x, lamp.y - 1, 'glow').setScale(0.3).setTint(0xfff6d0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 2);
  scene.tweens.add({ targets: flash, scale: 0.1, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  const spark = scene.art(lamp.x + 1, lamp.y - 3, 'spark').setTint(0xfff6d0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 2);
  scene.tweens.add({ targets: spark, x: spark.x + 4, y: spark.y - 5, angle: 120, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
}

/** Мотыльки кружат вокруг горящих фонарей неровно, то ближе, то дальше, и часто машут крыльями. */
export function updateMoths(scene: StoreScene, evening: number, now: number): void {
  for (const moth of scene.moths) {
    const { img, lamp, phase } = moth;
    if (!img.active) continue;
    const on = scene.running && !scene.lite ? lampPower(lamp, now) * evening : 0;
    img.setAlpha(0.9 * on);
    if (on <= 0) continue;
    const t = now / 1000 + phase;
    img.setPosition(lamp.x + Math.sin(t * 2.3) * 7 + Math.sin(t * 7.1) * 1.5, lamp.y + 1 + Math.cos(t * 2.9) * 4 + Math.sin(t * 5.3) * 1.2);
    img.setFlipX(Math.cos(t * 2.3) < 0);
    img.scaleX = (0.3 + 0.7 * Math.abs(Math.sin(t * 19))) / ART;
  }
}

/** Свет мебели: бра на стене и стекло автомата (с утренним выключателем), полоски над товаром — к вечеру. */
export function furnitureLight(scene: StoreScene): void {
  const e = scene.evening;
  const power = scene.blackout || scene.powerCut ? 0 : 1;
  const wall = power * scene.furnitureOn.wall;
  // Днём бра чуть теплят стену (утром видно, как они щёлкнули), вечером светят в полную силу.
  for (const cone of scene.wallCones) if (cone.active) cone.setAlpha(wall * (0.1 + 0.7 * e));
  if (scene.wallDusk?.active) scene.wallDusk.setAlpha(e);
  for (const strip of scene.shelfStrips) if (strip.active) strip.setAlpha(scene.lite ? 0 : power * 0.55 * e);
  const vending = scene.vendingGlow;
  if (vending?.glass.active) {
    const on = power * scene.furnitureOn.vending;
    vending.glass.setAlpha(on * (0.14 + 0.24 * e));
    vending.spill.setAlpha(on * (0.08 + 0.45 * e));
  }
}

/** Тёплые пылинки медленно плывут в свете зала — уютно; в лёгкой графике их нет. */
export function buildDust(scene: StoreScene): void {
  // Прежние излучатели — в утиль (обычно их уже уничтожил disposeWorld): в списке обновления
  // они пылили бы невидимо, с каждой пересборкой — всё больше.
  scene.hallDust?.destroy();
  scene.rayDust?.destroy();
  scene.hallDust = scene.rayDust = undefined;
  if (scene.lite) return;
  const { w, h, wallH } = scene.layout;
  scene.hallDust = scene.add
    .particles(0, 0, 'glow', {
      x: { min: 8, max: w - 8 },
      y: { min: wallH + 12, max: h - 12 },
      speedX: { min: -2, max: 2 },
      speedY: { min: -3, max: -1 },
      scale: { start: 2.5 / 64, end: 1.5 / 64 },
      alpha: { start: 0.35, end: 0 },
      tint: 0xffe2a0,
      blendMode: Phaser.BlendModes.ADD,
      lifespan: 7000,
      frequency: 650,
      quantity: 1,
    })
    .setDepth(LIGHT_DEPTH - 1);
  // В солнечных лучах из окон кружат золотые пылинки: ярче, пока лучи светят (updateDaylight их включает и гасит).
  if (!scene.sunRays.length && !scene.sideRays.length) return;
  scene.rayDust = scene.add
    .particles(0, 0, 'glow', {
      emitZone: { type: 'random', source: { getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => rayPoint(scene, point) } },
      speedX: { min: -2.5, max: 2.5 },
      speedY: { min: -2, max: 2 },
      scale: { start: 2.4 / 64, end: 1.2 / 64 },
      alpha: { onEmit: () => 0, onUpdate: (_p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => 0.9 * Math.sin(Math.PI * t) * scene.rayLight },
      tint: 0xfff6d0,
      blendMode: Phaser.BlendModes.ADD,
      lifespan: 3200,
      frequency: 140,
      quantity: 1,
      emitting: scene.rayLight >= 0.05,
    })
    .setDepth(LIGHT_DEPTH - 1);
}

/**
 * Свет по ходу дня: фон карты освещения (днём белый, к ночи — синие сумерки на улице, а зал чуть темнее),
 * цветокоррекция часа и погоды, фонари, окна и неон.
 */
export function updateLighting(scene: StoreScene, progress?: number): void {
  if (!scene.light) return;
  const p = progress ?? Phaser.Math.Clamp(1 - scene.timeLeft / DAY_SECONDS, 0, 1);
  const ambient = ambientAt(p, scene.weather, scene.blackout || scene.powerCut);
  // В лёгкой графике цветокоррекции нет — оттенок часа ложится в ту же карту (поверх фона и огней).
  scene.light.ambient(ambient.outdoor, ambient.indoor, scene.grade.tint(p, scene.weather));
  // Днём светло; вечер — последняя четверть смены: фонари, неон, тёплый свет.
  const evening = Phaser.Math.Clamp((p - EVENING_FROM) / (1 - EVENING_FROM), 0, 1);
  scene.evening = evening;
  scene.grade.apply(p, scene.weather, evening);
  for (const bat of scene.bats) bat.setAlpha(Phaser.Math.Clamp(evening * 1.5, 0, 1));
  const now = scene.time.now;
  for (const lamp of scene.lamps) igniteLamp(scene, lamp, evening, now);
  for (const light of scene.nightLights) {
    let alpha = light.alpha * evening;
    // Фонарь горит, мигает и только что зажёгшись светит оранжевым, а потом теплеет до жёлтого.
    // Зажёгся — сразу заметен, даже пока ещё светло: к ночи только ярче.
    if (light.lamp) {
      alpha = light.alpha * (0.4 + 0.6 * evening) * lampPower(light.lamp, now);
      if (light.tint !== undefined && !light.lamp.warm && light.lamp.litAt !== undefined && light.obj instanceof Phaser.GameObjects.Image) {
        light.obj.setTint(lerpKeys([[0, 0xff8a5a], [1, light.tint]], Math.min(1, (now - light.lamp.litAt) / LAMP_WARMUP)));
      }
    }
    // Неон зажигается не сразу: пару секунд мигает.
    if (light.neon !== undefined && evening < 0.18) alpha *= Math.sin((now + light.neon) / 41) + Math.sin((now + light.neon) / 97) > 0 ? 1 : 0.2;
    // Окна в домах вокруг загораются по одному.
    if (light.from !== undefined) alpha *= Phaser.Math.Clamp((evening - light.from) / 0.08, 0, 1);
    // Глубокой ночью окна гаснут по одному — в том же порядке, в каком зажигались.
    if (light.from !== undefined && scene.lightsOut > light.from * 1.6) alpha = 0;
    if (light.twinkle !== undefined) alpha *= 0.55 + 0.45 * Math.sin(now / 260 + light.twinkle);
    // Кто-то щёлкнул выключателем: окно иногда гаснет на несколько секунд и загорается снова.
    if (light.from !== undefined && Math.sin(now / 5300 + light.from * 97) > 0.93) alpha = 0;
    if (light.store) alpha *= powerOn(scene);
    if (light.light) {
      light.light.set(alpha * (light.gain ?? 1));
      light.obj.setAlpha(alpha * (light.haze ?? 0));
    } else light.obj.setAlpha(alpha);
  }
  for (const lamp of scene.lamps) if (lamp.litAt !== undefined && now - lamp.litAt >= LAMP_WARMUP) lamp.warm = true;
  updateMoths(scene, evening, now);
  furnitureLight(scene);
  // Дневная живность и тени облаков к вечеру исчезают.
  for (const life of scene.dayLife) if (life.obj.active) life.obj.setAlpha(life.alpha * Phaser.Math.Clamp(1 - evening * 2.5, 0, 1));
  scene.dayProgress = p;
  updateDaylight(scene, p);
  drawClock(scene, p);
}

/** Часы на стене: часовая стрелка проходит 8:00 → 20:00, минутная крутится каждый час. */
export function drawClock(scene: StoreScene, p: number): void {
  const g = scene.clockHands;
  if (!g?.active) return;
  const hours = 8 + 12 * p;
  const hour = (hours / 12) * Math.PI * 2 - Math.PI / 2;
  const minute = (hours % 1) * Math.PI * 2 - Math.PI / 2;
  g.clear();
  g.lineStyle(0.7, 0x262b44, 1);
  g.lineBetween(0, 0, Math.cos(minute) * 2.6, Math.sin(minute) * 2.6);
  g.lineStyle(0.9, 0x181425, 1);
  g.lineBetween(0, 0, Math.cos(hour) * 1.7, Math.sin(hour) * 1.7);
  g.fillStyle(0xe43b44, 1).fillRect(-0.4, -0.4, 0.8, 0.8);
}

/**
 * Свет дня: утром из окон на пол падают солнечные пятна и ползут за солнцем, к полудню гаснут;
 * утренний туман рассеивается. Тени людей поворачиваются вслед за солнцем (lampShadow).
 */
export function updateDaylight(scene: StoreScene, p: number): void {
  const sunny = scene.weather === 'clear' || scene.weather === 'heat' || scene.weather === 'leaves';
  const sun = Phaser.Math.Clamp(1 - p / 0.55, 0, 1) * (sunny ? 1 : 0.25) * (scene.blackout || scene.powerCut ? 1 : 1);
  for (const patch of scene.sunPatches) {
    if (!patch.active) continue;
    patch.setAlpha(0.42 * sun);
    patch.x = (patch.getData('x') as number) + (p - 0.2) * 24;
    patch.setAngle(-24 + p * 50);
  }
  // Столбы света от окон «дышат» и поворачиваются вслед за пятном: луч тает в его дальнем краю.
  // Солнце поднимается — к полудню столбы гаснут раньше пятен. Игра сама перешла на лёгкую
  // графику посреди дня — лучи и пылинки гаснут сразу, не дожидаясь пересборки.
  const now = scene.time.now;
  const rays = scene.lite ? 0 : 1;
  const shaft = Phaser.Math.Clamp(1 - p / 0.36, 0, 1) * (sunny ? 1 : 0.25) * rays;
  for (const { ray, patch } of scene.sunRays) {
    if (!ray.active) continue;
    const tx = patch.x - Math.sin(patch.rotation) * 26;
    const ty = patch.y + Math.cos(patch.rotation) * 26;
    ray.setRotation(Math.atan2(ray.x - tx, ty - ray.y)).setDisplaySize(28, Math.hypot(tx - ray.x, ty - ray.y));
    ray.setAlpha(0.38 * shaft * (1 + 0.15 * Math.sin(now / 1400 + ray.x)));
  }
  // К вечеру солнце уходит на другую сторону — свет ложится из окон правой стены.
  const late = Phaser.Math.Clamp((p - 0.45) / 0.25, 0, 1) * Phaser.Math.Clamp((0.95 - p) / 0.15, 0, 1) * (sunny ? 1 : 0.25);
  for (const patch of scene.sideSun) if (patch.active) patch.setAlpha(0.3 * late);
  // Солнце садится — оранжевые лучи ложатся всё ниже и тянутся дальше по полу.
  const low = Phaser.Math.Clamp((p - 0.45) / 0.5, 0, 1);
  for (const ray of scene.sideRays) {
    if (!ray.active) continue;
    ray.setRotation(Phaser.Math.DegToRad(74 + 14 * low)).setDisplaySize(40, 40 + 16 * low);
    ray.setAlpha(0.35 * late * rays * (1 + 0.15 * Math.sin(now / 1400 + ray.y)));
  }
  // Пылинки кружат, пока в лучах есть свет.
  scene.rayLight = Math.max(scene.sunRays.length ? shaft : 0, scene.sideRays.length ? late * rays : 0);
  const dust = scene.rayDust;
  if (dust?.active) {
    if (scene.rayLight < 0.05) {
      if (dust.emitting) dust.stop();
    } else if (!dust.emitting) dust.start();
  }
  const fog = Phaser.Math.Clamp(1 - p / 0.22, 0, 1);
  for (const f of scene.fogs) if (f.active) f.setAlpha(0.7 * fog);
}

/** Столб солнечного света от окна (сверху узкий, к полу шире): поворот и длину задаёт updateDaylight. */
export function sunRay(scene: StoreScene, x: number, y: number, tint: number): Phaser.GameObjects.Image {
  return scene.art(x, y, 'sun_ray').setOrigin(0.5, 0).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(LIGHT_DEPTH - 1);
}

/** Случайная точка внутри одного из светящих лучей — там рождаются пылинки. */
export function rayPoint(scene: StoreScene, point: Phaser.Types.Math.Vector2Like): void {
  const lit = [...scene.sunRays.map((r) => r.ray), ...scene.sideRays].filter((ray) => ray.active && ray.alpha > 0.01);
  const ray = Phaser.Utils.Array.GetRandom(lit) as Phaser.GameObjects.Image | undefined;
  if (!ray) {
    point.x = point.y = -9999;
    return;
  }
  // Вдоль луча и поперёк него (он к полу шире), потом поворот вместе с лучом.
  const along = Phaser.Math.FloatBetween(0.1, 0.75);
  const across = Phaser.Math.FloatBetween(-0.4, 0.4) * ray.displayWidth * (0.5 + 0.5 * along);
  const len = along * ray.displayHeight;
  const cos = Math.cos(ray.rotation);
  const sin = Math.sin(ray.rotation);
  point.x = ray.x + across * cos - len * sin;
  point.y = ray.y + across * sin + len * cos;
}

/** Много мелких цветных квадратиков — одной картинкой (вдвое чётче мира, чтобы не мылились). */
export function bakeSpots(scene: StoreScene, list: { x: number; y: number; size: number; color: number }[]): Phaser.GameObjects.RenderTexture {
  const K = 2;
  const minX = Math.min(...list.map((p) => p.x - p.size / 2)) - 1;
  const minY = Math.min(...list.map((p) => p.y - p.size / 2)) - 1;
  const maxX = Math.max(...list.map((p) => p.x + p.size / 2)) + 1;
  const maxY = Math.max(...list.map((p) => p.y + p.size / 2)) + 1;
  const rt = scene.add.renderTexture(minX, minY, Math.ceil((maxX - minX) * K), Math.ceil((maxY - minY) * K)).setOrigin(0).setScale(1 / K);
  const draw = () => {
    const g = scene.make.graphics({}, false);
    for (const p of list) g.fillStyle(p.color, 1).fillRect((p.x - p.size / 2 - minX) * K, (p.y - p.size / 2 - minY) * K, p.size * K, p.size * K);
    rt.clear().draw(g);
    g.destroy();
  };
  draw();
  // Картинка нарисована в видеопамяти один раз: потеряет WebGL контекст — нарисуем заново (rebake).
  scene.baked.set(rt, draw);
  rt.once('destroy', () => scene.baked.delete(rt));
  return rt;
}

/**
 * WebGL вернул контекст (Telegram свернули и открыли снова — телефон мог отобрать видеопамять).
 * Картинки и надписи Phaser загрузит в видеокарту сам, а нарисованное в RenderTexture пропало.
 */
export function rebake(scene: StoreScene): void {
  for (const draw of scene.baked.values()) draw();
  scene.light.invalidate();
}

/** Фонарь не ставим на дорожку к двери и на подъезд к складу. */
export function lampAt(scene: StoreScene, x: number): boolean {
  const { door, warehouse } = scene.layout;
  // Не на въезде к парковке и не на дорожке вдоль стены.
  const lot = x > scene.next.w + 2 && x < scene.next.w + LOT_DRIVE_END + 4;
  return Math.abs(x - door.x) > 20 && Math.abs(x - (warehouse.x + warehouse.w / 2)) > 18 && !lot;
}

/**
 * Вечерний огонь: виден только вечером. Без map — светится сам поверх темноты (лампочка, неоновые буквы,
 * стекло витрины). С map — это свет на земле и стенах: он вписан в карту освещения (картинка карты —
 * эта же или map.key), а сама картинка видна разве что лёгкой дымкой (map.haze).
 */
export function nightGlow<T extends NightLight['obj']>(scene: StoreScene, obj: T, alpha: number, neon?: number, extra: Pick<NightLight, 'from' | 'twinkle' | 'lamp' | 'tint' | 'store'> & { map?: GlowMap } = {}): T {
  obj.setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 1).setAlpha(0);
  const { map, ...rest } = extra;
  const entry: NightLight = { obj, alpha, neon, ...rest };
  if (map && obj instanceof Phaser.GameObjects.Image) {
    entry.light = scene.light.follow(obj, { key: map.key, w: map.w, h: map.h, scale: map.scale, dy: map.dy }).set(0);
    entry.gain = map.gain ?? 1;
    entry.haze = map.haze ?? 0;
  }
  scene.nightLights.push(entry);
  return obj;
}

/** Вывеска-неон: ореол и светящиеся буквы поверх вечерней темноты. */
export function neonSign(scene: StoreScene, x: number, y: number, text: string, size: string, color: number, width: number, store = false): void {
  const seed = Math.random() * 1000;
  // Ореол вывески — цветной свет на стене и тротуаре вокруг неё (и лёгкая дымка в воздухе).
  nightGlow(scene, scene.art(x, y, 'glow').setDisplaySize(width * 1.5, 34).setTint(color), 0.4, seed, { store, map: { scale: 1.3, gain: 1.5, haze: 0.45 } });
  const css = `#${color.toString(16).padStart(6, '0')}`;
  nightGlow(scene, 
    scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: size, color: css }).setOrigin(0.5).setResolution(scene.textRes(4)),
    0.85,
    seed,
    { store },
  );
}

/** Толстые стены с кирпичной крышкой и фасад с витринами и дверями; в левой стене — двери во флигель. */
/**
 * Объём зала. Пол у стен и под мебелью темнее — это мягкие тени живого пола (bakeFloor), а здесь —
 * пятна света потолочных ламп.
 */
export function floorLight(scene: StoreScene, w: number, h: number, wallH: number): void {
  // Свет потолочных ламп: тёплые пятна на полу рядами — зал не плоский, а освещённый. Ночью эти же лампы
  // держат зал в карте освещения: под ними светло и тепло (LED — белее), между ними и в углах — темнее.
  // Утром они загораются ряд за рядом (lightsOn), свет отключили — гаснут.
  scene.lampPools = [];
  const color = gearTier(scene.state, 'lights') ? HALL_LED : HALL_WARM;
  for (let y = wallH + 46, row = 0; y < h - 20; y += 62, row++) {
    for (let x = 34 + ((y / 62) % 2) * 20; x < w - 20; x += 66) {
      const img = scene.add.image(x, y, 'glow').setDisplaySize(84, 46).setTint(0xfff0cf).setBlendMode(Phaser.BlendModes.ADD).setAlpha(LAMP_POOL_ALPHA).setDepth(0.45);
      scene.lampPools.push({ img, row });
      scene.light.follow(img, { key: 'light_pool', w: HALL_LAMP.w, h: HALL_LAMP.h, dy: -4, color, power: () => Math.min(1, (img.alpha / LAMP_POOL_ALPHA) * HALL_LAMP.power) * powerOn(scene) });
    }
  }
}

/** Утро: лампы в зале загораются ряд за рядом, от двери вглубь, — с коротким ярким «щелчком»; за ними бра и автомат. */
export function lightsOn(scene: StoreScene): void {
  const rows = Math.max(0, ...scene.lampPools.map((p) => p.row));
  for (const { img, row } of scene.lampPools) {
    img.setAlpha(0);
    scene.tweens.chain({
      targets: img,
      tweens: [
        { alpha: LAMP_POOL_ALPHA * 2, duration: 90, delay: 700 + (rows - row) * 260 },
        { alpha: LAMP_POOL_ALPHA, duration: 260, ease: 'Sine.easeOut' },
      ],
    });
  }
  // Бра на задней стене загораются вслед за дальним рядом ламп, а стекло автомата моргает дважды.
  const on = scene.furnitureOn;
  on.wall = 0;
  on.vending = 0;
  furnitureLight(scene);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 350,
    delay: 700 + (rows + 1) * 260,
    ease: 'Sine.easeOut',
    onUpdate: (tw) => {
      on.wall = tw.getValue() ?? 1;
      furnitureLight(scene);
    },
  });
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1100,
    delay: 450,
    ease: VENDING_BLINK,
    onUpdate: (tw) => {
      on.vending = tw.getValue() ?? 1;
      furnitureLight(scene);
    },
  });
}

/** Витрина вечером светится, и тёплый свет из неё ложится на тротуар. store — витрина своего магазина. */
export function windowLight(scene: StoreScene, x: number, glassY: number, groundY: number, up = false, from?: number, store = false): void {
  nightGlow(scene, scene.add.rectangle(x, glassY, 18, 5, 0xffc870), 0.5, undefined, { from, store });
  // У зданий за дорогой витрины смотрят вверх, на их тротуар.
  const spill = scene.art(x, groundY, 'light_spill').setOrigin(0.5, up ? 1 : 0).setFlipY(up).setTint(0xffd08a);
  nightGlow(scene, spill, 0.6, undefined, { from, store, map: { scale: 1.15, gain: 1.25, haze: 0.12 } });
}

/** Премиальный свет: бра, лампы, фонари или люстры между картинами, гирлянда — по всей стене. */
export function buildLights(scene: StoreScene): void {
  scene.hangingLamps = [];
  const light = activeDecor(scene.state, 'light');
  if (!light) return;
  const { w, wallH, wc } = scene.layout;
  const warm = 0xffd27a;
  if (light.id === 'light_garland') {
    scene.add.tileSprite(0, 0, w, 6, scene.potTile('light_garland')).setOrigin(0).setTileScale(1 / ART).setDepth(2);
    const lit = scene.add.tileSprite(0, 0, w, 6, scene.potTile('light_garland_lit')).setOrigin(0).setTileScale(1 / ART).setDepth(2);
    lit.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: lit, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Гирлянда сама рисуется под картой освещения — ночью карта приглушила бы её вместе со стеной.
    // Поэтому она светит и в карте: тёплая полоса по верху стены (пятна внахлёст — без просветов), вечером
    // ярче, свет отключили — гаснет. Ровно, без мигания огоньков: карту ради них не перерисовывать.
    for (let x = 12; x < w + 12; x += 24) {
      const strip = scene.light.add('light_pool', x, 4, 40, 18, 0xffe6b0, 0);
      strip.sync = () => strip.set(0.55 * scene.evening * powerOn(scene));
    }
    return;
  }
  // Между плакатами и окнами (над часами место занято).
  const hanging = light.id !== 'light_sconce';
  const y = hanging ? (light.id === 'light_chandelier' ? 6 : 6.5) : 10;
  // По бокам от часов и дальше — между плакатами и окнами.
  const spots = [46, 78];
  for (let x = 126; x < wc.x - 12; x += 64) spots.push(x);
  for (const x of spots.filter((sx) => sx < wc.x - 12 && !scene.behindShelf(sx, 4))) {
    const lamp = scene.art(x, y, light.texture!).setDepth(2);
    const bulb = scene.art(x + (hanging ? 0.5 : 2), hanging ? y + 3 : y - 3, 'glow')
      .setDisplaySize(light.id === 'light_chandelier' ? 30 : 18, 14)
      .setTint(warm)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setDepth(2);
    // Подвесная лампа висит на шнуре: точка подвеса — верхний край, вокруг неё она и качается.
    if (hanging) {
      lamp.setOrigin(0.5, 0).setY(y - lamp.displayHeight / 2);
      scene.hangingLamps.push({ lamp, bulb });
    }
    scene.tweens.add({ targets: bulb, alpha: { from: 0.45, to: 0.32 }, duration: 1600 + (x % 5) * 140, yoyo: true, repeat: -1 });
    // Светильник тоже под картой освещения: он и стена вокруг светятся в ней сами (свет идёт за лампочкой
    // и когда она качается), вечером ярче, без электричества гаснут.
    const big = light.id === 'light_chandelier';
    scene.light.follow(bulb, { key: 'light_pool', w: big ? 48 : 34, h: big ? 30 : 26, color: warm, power: () => 0.7 * scene.evening * powerOn(scene) });
    // Тёплое пятно на полу у стены — вечером ярче.
    nightGlow(scene, scene.art(x, wallH + 6, 'glow').setDisplaySize(52, 22).setTint(warm), 0.35, undefined, { store: true, map: { scale: 1.5, gain: 2.2, haze: 0.2 } });
    scene.add.image(x, wallH + 6, 'glow').setScale(52 / 64, 22 / 64).setTint(warm).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12).setDepth(1);
  }
}

/**
 * Свет полки в карте освещения — едет вместе с ней (перестановка, толчок): стеллаж подсвечен тёплыми
 * полосками над товаром, холодильник и ларь светятся холодным голубым (мясной — розоватым). Ночью товар
 * на полке виден и в полумраке зала; свет отключили — гаснет.
 */
export function shelfLight(scene: StoreScene, bg: Phaser.GameObjects.Image, kind: Category, w: number, h: number, dy: number): void {
  if (kind === 'florist') return;
  const cold = SHELF_KINDS[kind].fridge || kind === 'drinks';
  const color = kind === 'meat' ? SHELF_MEAT : cold ? SHELF_COLD : SHELF_WARM;
  const power = cold ? 0.6 : 0.42;
  scene.light.follow(bg, { key: 'light_pool', w, h, dy, color, power: () => power * powerOn(scene) });
}
