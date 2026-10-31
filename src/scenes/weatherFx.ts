// Погода на улице: дождь (капли, брызги, зонты, мокрый асфальт с отражениями), гроза, радуга после дождя,
// снег и листопад, туман, светлячки и мотыльки, порывы ветра (деревья клонятся, летят листья). Какая погода
// сегодня — game/weather.ts; здесь — как она выглядит.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS } from '../game/economy';
import { sound } from '../platform/sound';
import { isWet, weatherFor } from '../game/weather';
import { yearTime } from '../game/calendar';
import { WING_OUTER } from './layout';
import { ART, STREET_VIEW, WALL, FACADE_H, GUST_SPEED, GUST_MS, GUST_TILT, LIGHT_DEPTH, CAR_COLORS, type CrownPart } from './common';
import * as pets from './pets';
import * as lighting from './lighting';

/**
 * Погода дня: дождь с брызгами и зонтами, снег (белый газон, гирлянда на фасаде, ёлка в зале),
 * листопад (рыжие деревья). Частицы падают только снаружи: здание рисуется поверх них.
 */
export function applyWeather(scene: StoreScene): void {
  scene.cullDirty = true;
  // Бесконечные твины (мигание гирлянды и огоньков, туман, мотыльки) со своими вещами сами не
  // умирают: без этого каждая смена погоды утром оставляла их сотнями крутиться впустую до пересборки.
  scene.tweens.killTweensOf(scene.weatherObjs);
  for (const obj of scene.weatherObjs) obj.destroy();
  scene.weatherObjs = [];
  scene.nightLights = scene.nightLights.filter((light) => light.obj.active);
  scene.bats = [];
  scene.weather = weatherFor(scene.state.day);
  // Камера ещё не пересчитала видимую область — берём её с запасом от планировки.
  const area = { x: -80, y: -140, w: scene.next.w + 160, h: scene.next.h + STREET_VIEW + 220 };
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    scene.weatherObjs.push(obj);
    return obj;
  };
  const tree = scene.weather === 'leaves' ? 0xffb868 : 0xffffff;
  scene.roofSnow = scene.roofSnow.filter((r) => r.active);
  for (const r of scene.roofSnow) r.setVisible(scene.weather === 'snow');
  for (const g of scene.greenery) {
    // В снег — деревья и кусты в снежных шапках (tree_snow, bush_snow).
    const base = (g.getData('base') as string | undefined) ?? g.texture.key;
    g.setData('base', base);
    const snowy = `${base}_snow`;
    g.setTexture(scene.weather === 'snow' && scene.textures.exists(snowy) ? snowy : base).setTint(tree);
  }

  scene.rainFx = undefined;
  scene.rainStopped = false;
  if (isWet(scene.weather)) {
    const storm = scene.weather === 'storm';
    const rain = keep(scene.add.particles(0, 0, 'raindrop', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      speedY: { min: 240, max: 300 },
      speedX: storm ? -60 : -30,
      scale: 1 / ART,
      lifespan: (area.h / 260) * 1000,
      quantity: storm ? 4 : 3,
      frequency: storm ? 18 : 25,
    })).setDepth(-5);
    scene.rainFx = { rain, splash: rain, base: storm ? 18 : 25, puddles: [] };
    wetStreet(scene, keep);
    if (storm) lightning(scene, keep);
    scene.rainFx.splash = keep(scene.add.particles(0, 0, 'splash', {
      x: { min: area.x, max: area.x + area.w },
      y: { min: area.y, max: area.y + area.h },
      scale: { start: 0.3 / ART, end: 1 / ART },
      alpha: { start: 1, end: 0 },
      lifespan: 280,
      frequency: 30,
    })).setDepth(-5);
  }
  if (scene.weather === 'snow') {
    for (const lawn of scene.lawns) {
      keep(scene.add.tileSprite(lawn.x, lawn.y, lawn.w, lawn.h, 'snow_ground').setOrigin(0).setTileScale(1 / ART).setDepth(-9.5));
    }
    keep(scene.add.particles(0, 0, 'snowflake', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      speedY: { min: 14, max: 30 },
      speedX: { min: -10, max: 10 },
      scale: { min: 1.2 / ART, max: 2.2 / ART },
      lifespan: (area.h / 18) * 1000,
      quantity: 2,
      frequency: 30,
    })).setDepth(-5);
    // Гирлянда на фасаде — в applySeason (одна на все праздники); ёлка — на улице у входа,
    // чтобы не занимать место в зале.
    const { door, h } = scene.layout;
    keep(scene.art(door.x - 26, h + 12, 'xmas_tree').setDepth(h + 30));
  }
  if (scene.weather === 'leaves') {
    keep(scene.add.particles(0, 0, 'leaf', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      speedY: { min: 10, max: 22 },
      speedX: { min: -14, max: 6 },
      rotate: { min: 0, max: 360 },
      tint: [0xf77622, 0xfeae34, 0xb86f50, 0xe43b44],
      scale: 1.6 / ART,
      lifespan: (area.h / 12) * 1000,
      frequency: 150,
    })).setDepth(-5);
  }
  if (scene.weather === 'heat') {
    // Жара: над асфальтом дрожит марево.
    keep(scene.add.particles(0, 0, 'glow', {
      x: { min: area.x, max: area.x + area.w },
      y: { min: scene.layout.h + 8, max: area.y + area.h },
      speedY: { min: -9, max: -4 },
      scale: { start: 0.05, end: 0.16 },
      alpha: { start: 0.14, end: 0 },
      tint: 0xfff0b8,
      lifespan: 2400,
      frequency: 70,
      blendMode: Phaser.BlendModes.ADD,
    })).setDepth(-5);
  }
  weatherExtras(scene, keep);
  scene.applySeason(keep);
  scene.updateLighting(scene.running ? undefined : 0);
}

/**
 * Погода с настроением: в иные утра над улицей стелется туман, осенью у бордюров кучи листьев,
 * летними вечерами у пруда светлячки, весной и летом у фонарей — мотыльки.
 */
export function weatherExtras(scene: StoreScene, keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
  const { h } = scene.layout;
  const next = scene.next;
  scene.fogs = [];
  const rnd = new Phaser.Math.RandomDataGenerator([`mood${scene.state.day}`]);
  if (scene.weather !== 'heat' && scene.weather !== 'storm' && scene.state.day % 3 === 1) {
    for (let i = 0; i < 16; i++) {
      const fog = keep(scene.art(-200 + rnd.frac() * (next.w + 400), h + 20 + rnd.frac() * 320, 'glow'))
        .setDisplaySize(rnd.between(220, 340), rnd.between(70, 110))
        .setTint(0xf4f6ff)
        .setAlpha(0)
        .setDepth(LIGHT_DEPTH + 2);
      scene.tweens.add({ targets: fog, x: fog.x + rnd.between(30, 60), duration: rnd.between(14000, 22000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.fogs.push(fog);
    }
  }
  if (scene.weather === 'leaves') {
    const tones = [0xf77622, 0xfeae34, 0xb86f50, 0xe43b44];
    for (let i = 0; i < 16; i++) {
      const cx = -160 + rnd.frac() * (next.w + 320);
      const cy = rnd.pick([scene.streetY - 6, scene.streetY + 6, next.h + 4 + 88, next.h + 4 + 92]);
      for (let k = 0; k < 7; k++) {
        keep(scene.art(cx + rnd.between(-5, 5), cy + rnd.between(-2, 2), 'leaf'))
          .setScale(1.5 / ART)
          .setAngle(rnd.between(0, 359))
          .setTint(rnd.pick(tones))
          .setDepth(-8.5);
      }
    }
  }
  const pond = scene.parkPond;
  if (pond && yearTime(scene.state.day) === 'summer' && !isWet(scene.weather)) {
    for (let i = 0; i < 12; i++) {
      const fly = keep(scene.art(pond.x + rnd.between(-90, 90), pond.y + rnd.between(-50, 40), 'glow')).setScale(11 / 64).setTint(0xd8ff7a);
      lighting.nightGlow(scene, fly, 0.9, undefined, { twinkle: i * 2.3 });
      scene.tweens.add({ targets: fly, x: fly.x + rnd.between(-16, 16), y: fly.y + rnd.between(-10, 10), duration: rnd.between(2400, 4200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  // Весной и летом в сухой вечер вокруг горящих фонарей кружат мотыльки (updateMoths).
  scene.moths = [];
  const season = yearTime(scene.state.day);
  if (!scene.lite && (season === 'spring' || season === 'summer') && !isWet(scene.weather) && scene.weather !== 'snow') {
    for (const lamp of scene.lamps.filter((l) => l.street)) {
      for (let i = 0, n = rnd.between(2, 3); i < n; i++) {
        const img = keep(scene.art(lamp.x, lamp.y, 'butterfly0')).setTint(0xf4ead0).setScale(1 / ART).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 1).setAlpha(0);
        scene.moths.push({ img, lamp, phase: rnd.frac() * 100 });
      }
    }
  }
}

/** После дождя над районом на полминуты встаёт радуга. */
export function rainbow(scene: StoreScene): void {
  const cx = scene.layout.door.x;
  const cy = scene.next.h + 4 + 330;
  const g = scene.add.graphics().setDepth(LIGHT_DEPTH + 2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  [0xe43b44, 0xf77622, 0xfee761, 0x63c74d, 0x0099db, 0x68386c].forEach((color, i) => {
    g.lineStyle(5, color, 1);
    g.beginPath();
    g.arc(cx, cy, 250 - i * 5, Math.PI * 1.08, Math.PI * 1.92);
    g.strokePath();
  });
  scene.weatherObjs.push(g);
  scene.tweens.add({ targets: g, alpha: 0.32, duration: 4000, hold: 26000, yoyo: true, onComplete: () => g.destroy() });
}

/** Мокрая улица: асфальт блестит, в нём отражаются фонари, по лужам идут круги. */
export function wetStreet(scene: StoreScene, keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
  const top = scene.next.h + 4;
  const sheen = keep(scene.add.rectangle(-400, top, scene.next.w + 800, 88, 0xa8c0f0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.06).setDepth(-8.9));
  if (scene.rainFx) scene.rainFx.sheen = sheen;
  for (const lamp of scene.lamps.filter((l) => l.street)) {
    // Отражение загорается вместе со своим фонарём.
    const streak = keep(lighting.lampGlow(scene, lamp, scene.art(lamp.x, top + 34, 'glow').setDisplaySize(9, 46).setTint(0xffd27a), 0.4));
    scene.tweens.add({ targets: streak, scaleX: streak.scaleX * 0.65, duration: Phaser.Math.Between(600, 1100), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const rnd = new Phaser.Math.RandomDataGenerator([`puddles${scene.state.day}`]);
  const puddles: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const x = -120 + rnd.frac() * (scene.next.w + 240);
    if (Math.abs(x - scene.layout.door.x) < 16) continue;
    const y = rnd.pick([top + 17, top + 19, top + 74, top + 80]);
    puddles.push({ x, y });
    const puddle = keep(scene.art(x, y, 'puddle_wet').setDepth(-8.8));
    scene.rainFx?.puddles.push(puddle);
  }
  if (!puddles.length) return;
  const source = {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
      const at = Phaser.Utils.Array.GetRandom(puddles);
      point.x = (at.x ?? 0) + Phaser.Math.FloatBetween(-6, 6);
      point.y = (at.y ?? 0) + Phaser.Math.FloatBetween(-1.5, 1.5);
    },
  };
  const ripple = keep(scene.add.particles(0, 0, 'ripple', {
    emitZone: { type: 'random', source },
    scale: { start: 0.15 / ART, end: 0.9 / ART },
    alpha: { start: 0.8, end: 0 },
    lifespan: 650,
    frequency: 70,
  })).setDepth(-8.7);
  if (scene.rainFx) scene.rainFx.ripple = ripple;
}

/**
 * Дождь не включается рывком: первые секунды дня редкие капли, потом ливень. В обычный дождь
 * через день к вечеру он кончается: зонты закрываются, лужи сохнут.
 */
export function updateRain(scene: StoreScene): void {
  const fx = scene.rainFx;
  if (!fx || scene.rainStopped || !scene.running || !fx.rain.active) return;
  const p = Phaser.Math.Clamp(1 - scene.timeLeft / DAY_SECONDS, 0, 1);
  const strength = Phaser.Math.Clamp(p / 0.08, 0.12, 1);
  fx.rain.frequency = fx.base / strength;
  fx.splash.frequency = 30 / strength;
  if (scene.weather !== 'rain' || scene.state.day % 2 !== 0 || p < 0.72) return;
  scene.rainStopped = true;
  scene.time.delayedCall(2500, () => rainbow(scene));
  fx.rain.stop();
  fx.splash.stop();
  fx.ripple?.stop();
  if (fx.sheen) scene.tweens.add({ targets: fx.sheen, alpha: 0, duration: 20000 });
  for (const puddle of fx.puddles) {
    scene.tweens.add({ targets: puddle, scaleX: puddle.scaleX * 0.4, scaleY: puddle.scaleY * 0.4, alpha: 0, delay: Phaser.Math.Between(2000, 9000), duration: 15000 });
  }
}

/** Гроза: время от времени вспышка молнии на весь квартал, через миг — раскат грома. */
export function lightning(scene: StoreScene, keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
  const flash = keep(scene.add.rectangle(-1200, -1200, 4000, 4000, 0xdde6ff).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 5).setAlpha(0));
  const strike = () => {
    if (!flash.active) return;
    if (scene.running) {
      scene.tweens.chain({
        targets: flash,
        tweens: [
          { alpha: 0.26, duration: 50 },
          { alpha: 0.05, duration: 90 },
          { alpha: 0.18, duration: 45 },
          { alpha: 0, duration: 550 },
        ],
      });
      scene.time.delayedCall(Phaser.Math.Between(250, 1100), () => {
        sound.thunder();
        pets.petsStartled(scene);
      });
    }
    scene.time.delayedCall(Phaser.Math.Between(7000, 15000), strike);
  };
  scene.time.delayedCall(Phaser.Math.Between(2500, 5000), strike);
}

/** Зонт над головой: только в дождь и только на улице. */
export function addUmbrella(scene: StoreScene, person: Phaser.GameObjects.Container): void {
  if (!isWet(scene.weather) || scene.rainStopped) return;
  const umbrella = scene.art(0, -13, 'umbrella').setTint(Phaser.Utils.Array.GetRandom(CAR_COLORS));
  person.add(umbrella);
  person.setData('umbrella', umbrella);
}

/**
 * Порыв ветра: волна идёт через кадр слева направо — деревья по очереди клонятся и выпрямляются
 * (windTick), кусты приминаются, навесы соседей вздуваются, зонтики веранды вздрагивают, а с крон
 * срывает несколько листьев (весной — лепестков, с заснеженных — снега). Экран неподвижен, и трогаем
 * только то, что в кадре: за краем порыв всё равно никто не увидит.
 */
export function windGust(scene: StoreScene): void {
  if (scene.lite || !scene.sys.isActive()) return;
  const v = scene.cameras.main.worldView;
  const seen = (obj: Phaser.GameObjects.Image) =>
    obj.active && obj.x + obj.displayWidth / 2 > v.x && obj.x - obj.displayWidth / 2 < v.right && obj.y + obj.displayHeight / 2 > v.y && obj.y - obj.displayHeight < v.bottom;
  // Когда волна дойдёт до этой точки (мс от начала порыва).
  const reach = (x: number) => (Math.max(0, x - v.x) / GUST_SPEED) * 1000;
  const gust = { t: 0, x: v.x, on: true };
  scene.gust = gust;
  const span = reach(v.right) + GUST_MS;
  scene.tweens.addCounter({
    from: 0,
    to: span,
    duration: span,
    onUpdate: (tw) => {
      gust.t = tw.getValue() ?? span;
    },
    onComplete: () => {
      gust.on = false;
    },
  });
  for (const bush of scene.greenery) {
    const key = (bush.getData('base') as string | undefined) ?? bush.texture.key;
    // Прошлый порыв ещё не отпустил куст — второй твин запомнил бы его примятым навсегда.
    if (!key.startsWith('bush') || !seen(bush) || scene.tweens.isTweening(bush)) continue;
    // Куст приминает к земле: ниже и шире, чуть клонится по ветру — низ стоит на месте.
    scene.tweens.add({
      targets: bush,
      scaleX: 1.08 / ART,
      scaleY: 0.82 / ART,
      y: bush.y + bush.displayHeight * 0.09,
      angle: 4,
      duration: 260,
      delay: reach(bush.x) + 140,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }
  for (const awning of scene.awnings) {
    if (!seen(awning) || scene.tweens.isTweening(awning)) continue;
    const umbrella = awning.texture.key === 'umbrella';
    // Навес хлопает парусом дважды, зонтик вздрагивает по ветру.
    scene.tweens.add({
      targets: awning,
      ...(umbrella ? { angle: 6 } : { scaleY: 0.8 / ART }),
      duration: 190,
      delay: reach(awning.x) + 60,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeOut',
    });
  }
  // Что срывает с кроны: весной лепестки, осенью рыжие листья, с заснеженных — снег, летом — зелёные.
  const time = yearTime(scene.state.day);
  const autumn = time === 'autumn' || scene.weather === 'leaves';
  // Сквозь стены листья в зал не залетают.
  const { w, h } = scene.layout;
  const indoors = (x: number, y: number) => x > -WING_OUTER - WALL - 2 && x < w + WALL + 2 && y > -WALL - 2 && y < h + FACADE_H + 2;
  let torn = 0;
  for (const tree of scene.windTrees) {
    if (torn >= 30 || !seen(tree)) continue;
    const key = tree.texture.key;
    const snowy = key.endsWith('_snow');
    // Хвоя не облетает — с ели только снег.
    if (key.startsWith('tree_pine') && !snowy) continue;
    const look = snowy
      ? { tex: 'snowflake', tints: [0xffffff, 0xe4ecff], scale: 1.4 }
      : time === 'spring'
        ? { tex: 'leaf', tints: [0xffd2e2, 0xffffff, 0xf6a5c0], scale: 1.2 }
        : autumn
          ? { tex: 'leaf', tints: [0xf77622, 0xfeae34, 0xb86f50, 0xe43b44], scale: 1.8 }
          : { tex: 'leaf', tints: [0x265c42, 0x3e8948, 0xa8e05a], scale: 1.8 };
    // С заснеженной кроны ещё и сдувает облачко снежной пыли.
    if (snowy && !indoors(tree.x + 16, tree.y - 12)) {
      const dust = scene.art(tree.x + 2, tree.y - 18, 'glow').setScale(0.14, 0.1).setTint(0xffffff).setAlpha(0).setDepth(tree.depth + 0.6);
      scene.tweens.add({
        targets: dust,
        x: dust.x + 14,
        y: dust.y + 6,
        scaleX: 0.42,
        scaleY: 0.26,
        alpha: { value: 0.8, ease: (k: number) => Math.sin(Math.PI * k) },
        duration: 1300,
        delay: reach(tree.x) + GUST_MS * 0.15,
        ease: 'Quad.easeOut',
        onComplete: () => dust.destroy(),
      });
    }
    for (let n = Phaser.Math.Between(snowy ? 2 : 1, snowy ? 4 : 3); n > 0 && torn < 30; n--) {
      const x = tree.x + Phaser.Math.Between(-8, 8);
      const y = tree.y - Phaser.Math.Between(12, 26);
      const dx = Phaser.Math.Between(30, 60) * (snowy ? 0.4 : 1);
      const dy = Phaser.Math.Between(16, 30);
      if (indoors(x, y) || indoors(x + dx, y + dy)) continue;
      torn++;
      const leaf = scene.art(x, y, look.tex)
        .setScale(look.scale / ART)
        .setTint(Phaser.Utils.Array.GetRandom(look.tints))
        .setAngle(Phaser.Math.Between(0, 359))
        .setDepth(tree.depth + 0.6)
        .setVisible(false);
      const duration = Phaser.Math.Between(1700, 2500);
      // Ветер несёт вправо и стихает, лист падает всё быстрее и под конец тает. Снег сыплется почти отвесно.
      scene.tweens.add({
        targets: leaf,
        x: { value: x + dx, ease: 'Quad.easeOut' },
        y: { value: y + dy, ease: 'Sine.easeIn' },
        angle: leaf.angle + Phaser.Math.Between(240, 520),
        alpha: { value: 0, ease: (k: number) => Math.max(0, (k - 0.6) / 0.4) },
        duration,
        delay: reach(tree.x) + GUST_MS * 0.12 + n * 110,
        onStart: () => leaf.setVisible(true),
        onComplete: () => leaf.destroy(),
      });
    }
  }
}

/**
 * Деревья на ветру: порыв (windGust) идёт волной слева направо — каждое дерево клонится по ветру,
 * пружинит назад и выпрямляется; в грозу кроны ещё и всё время качаются. Каждый кадр, но только пока
 * дует, и только деревья в кадре. Ели жёстче — клонятся меньше.
 */
export function windTick(scene: StoreScene, deltaMs: number): void {
  const dt = deltaMs * scene.tweens.timeScale;
  scene.windClock += dt;
  const storm = !scene.lite && scene.weather === 'storm' && !scene.rainStopped;
  scene.windSway += ((storm ? 1 : 0) - scene.windSway) * Math.min(1, dt / 1500);
  if (!storm && scene.windSway < 0.02) scene.windSway = 0;
  const gusting = !scene.lite && scene.gust.on;
  if (!scene.windSway && !gusting) {
    if (!scene.windStill) for (const tree of scene.windTrees) if (tree.active) tiltTree(tree, 0);
    scene.windStill = true;
    return;
  }
  scene.windStill = false;
  const v = scene.cameras.main.worldView;
  for (const tree of scene.windTrees) {
    if (!tree.active || tree.x < v.x - 16 || tree.x > v.right + 16 || tree.y < v.y - 8 || tree.y - 32 > v.bottom) continue;
    let tilt = scene.windSway * (1.2 + Math.sin(scene.windClock / 320 - tree.x / 28) * 1.6);
    if (gusting) {
      // 0 → +4° → −1.6° → 0: резко клонится, пружинит назад и успокаивается.
      const k = (scene.gust.t - ((tree.x - scene.gust.x) / GUST_SPEED) * 1000) / GUST_MS;
      if (k > 0 && k < 1) tilt += GUST_TILT * 1.27 * Math.sin(k * Math.PI * 2) * Math.pow(1 - k, 0.83);
    }
    tiltTree(tree, tree.texture.key.startsWith('tree_pine') ? tilt * 0.6 : tilt);
  }
}

/** Дерево клонится на ветру — вместе с украшением кроны (осенние пятна, весенний цвет, огоньки). */
export function tiltTree(tree: Phaser.GameObjects.Image, angle: number): void {
  tree.setAngle(angle);
  const parts = tree.getData('crown') as CrownPart[] | undefined;
  if (!parts) return;
  const r = Phaser.Math.DegToRad(angle);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  for (const { obj, dx, dy } of parts) if (obj.active) obj.setPosition(tree.x + dx * cos - dy * sin, tree.y + dx * sin + dy * cos).setAngle(angle);
}
