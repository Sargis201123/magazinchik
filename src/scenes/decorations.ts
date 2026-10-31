// Убранство магазина: время года и праздники (цветущие деревья, тыквы, снеговик, гирлянда на фасаде),
// ярмарка с лотком, украшения зала и прилавка за открытки и поддержку автора, вещи у входа, кубок,
// терминал и кассы самообслуживания, радио и настроение музыки, «что вокруг» для звуков улицы и зала.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { PRODUCTS, DAY_SECONDS } from '../game/economy';
import { saveGame } from '../game/save';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { music, type MusicMood } from '../platform/music';
import { winterMusic } from '../platform/playlist';
import type { AmbLife } from '../platform/ambience';
import { realNewYear } from '../platform/ambienceLayers';
import { trustedNow } from '../platform/telegram';
import { UI_FONT } from '../ui/dom';
import { holidayFor, lateAutumn, yearTime } from '../game/calendar';
import { hasUpgrade } from '../game/upgrades';
import { kioskCount, kioskTierIndex } from '../game/lanes';
import { activeDecor } from '../game/decor';
import { hasDog } from '../game/watch';
import { contestOf, tierKey } from '../game/contest';
import { LIVE_LOOKS, liveLook } from '../game/live';
import { liveEvents, todayLocal } from '../platform/live';
import { slotRect, slotSide, overlapsRect, propFootprint, propRect, tillZones, vendingFootprint, vendingSide } from './placement';
import { iceboxRect, kioskSpot } from './layout';
import { hasRadio, nextStation, setStation, STATION_INFO, stationOf } from '../game/radio';
import { gearTier } from '../game/gear';
import { idleRegisters, registerCount, registerSlots } from '../game/registers';
import { isFairDay, STALL_EVERY_SECONDS, STALL_MAX, stallSale } from '../game/fair';
import { ART, WALL, FACADE_H, LIGHT_DEPTH, EVENING_FROM, KIOSK_GLOW, type CrownPart } from './common';
import * as lighting from './lighting';
import * as deliveries from './deliveries';
import * as food from './food';
import * as persons from './persons';
import * as camera from './camera';
import * as shelves from './shelves';
import * as building from './building';

/** До какой доли дня музыка выбирает утренний трек (дальше — дневной, с вечера — вечерний). */
const MUSIC_MORNING = 0.3;
/** Картинки киосков по модели (lanes.ts, KIOSK_TIERS), где у них экран (от центра) и чем он светится. */
const KIOSK_SPRITES = ['kiosk', 'kiosk1', 'kiosk2'];
const KIOSK_SCREEN = { x: 0, y: -5.5, w: 8, h: 5 };
/** Сколько у левой стены держим свободным у дверей флигеля (как iceboxSpotFor и roomZones). */
const WING_DOOR_CLEAR = 32;

/**
 * Ярмарка: флажки над фасадом и шарики у входа. Перерисовывается каждое утро
 * (ярмарка — один день в месяц, погода при этом может не меняться).
 */
export function applyFair(scene: StoreScene): void {
  // Флажки и шарики качаются бесконечными твинами — гасим их вместе с вещами (как и в applyWeather).
  scene.tweens.killTweensOf(scene.fairObjs);
  for (const obj of scene.fairObjs) obj.destroy();
  scene.fairObjs = [];
  scene.stall = undefined;
  if (!isFairDay(scene.state.day)) return;
  const { w, h, door } = scene.layout;
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    scene.fairObjs.push(obj);
    return obj;
  };
  // Флажки треугольниками по краю крыши.
  const colors = [0xe43b44, 0xfee761, 0x0099db, 0x63c74d, 0xf77622];
  for (let x = -WALL + 3, i = 0; x < w + WALL; x += 6, i++) {
    const flag = keep(scene.add.triangle(x, h + 3.5, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setDepth(h + 43));
    scene.tweens.add({ targets: flag, angle: { from: -6, to: 6 }, duration: 600 + (i % 3) * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  // Связка шариков по обе стороны двери.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const bx = door.x + side * (16 + k * 3);
      const by = h + 2 - k * 4;
      keep(scene.add.line(0, 0, bx, by + 4, door.x + side * 15, h + FACADE_H + 2, 0x8b9bb4).setOrigin(0).setDepth(h + 44));
      const balloon = keep(scene.add.ellipse(bx, by, 5, 6, colors[(k + (side > 0 ? 2 : 0)) % colors.length]).setDepth(h + 45));
      scene.tweens.add({ targets: balloon, y: by - 1.5, duration: 900 + k * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  // Лоток слева от входа: торгует со склада мимо кассы.
  const at = { x: door.x - 58, y: h + FACADE_H + 14 };
  scene.stall = keep(scene.art(at.x, at.y, 'fair_stall').setOrigin(0.5, 1).setDepth(at.y));
}

/** Ярмарочный день: лоток раз в несколько секунд продаёт штуку со склада с наценкой. */
export function startStall(scene: StoreScene): void {
  scene.stallTimer?.remove();
  scene.stallTimer = undefined;
  if (!isFairDay(scene.state.day)) return;
  let sold = 0;
  scene.stallTimer = scene.time.addEvent({
    delay: STALL_EVERY_SECONDS * 1000,
    loop: true,
    callback: () => {
      const stall = scene.stall;
      if (!scene.running || !stall?.active || sold >= STALL_MAX) return;
      const sale = stallSale(scene.state, Math.random);
      if (!sale) return;
      sold++;
      scene.state = sale.state;
      scene.stats.revenue += sale.price;
      building.refreshWarehouse(scene);
      sound.coin(stall.x);
      scene.tweens.add({ targets: stall, scaleY: 1.06 / ART, duration: 90, yoyo: true });
      scene.popup(stall.x, stall.y - 18, `${PRODUCTS[sale.id].icon} +${sale.price} 💰`, '#c8ffb0');
    },
  });
}

/** Гирлянда по краю фасада: лампочки мигают по очереди. */
export function garland(scene: StoreScene, colors: number[], keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
  const { w, h } = scene.layout;
  const bulbs: Phaser.GameObjects.Rectangle[] = [];
  for (let x = -WALL + 2, i = 0; x < w + WALL; x += 5, i++) {
    bulbs.push(keep(scene.add.rectangle(x, h + 1, 1.6, 1.6, colors[i % colors.length]).setDepth(h + 42)));
  }
  // Один счётчик на всю гирлянду (а не твин на лампочку — их под сотню): гаснут и загораются волной по четыре.
  const blink = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1000,
    repeat: -1,
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      bulbs.forEach((bulb, i) => (bulb.alpha = 0.25 + 0.75 * Math.abs(Math.cos((t - (i % 4) / 4) * Math.PI))));
    },
  });
  bulbs[0]?.once('destroy', () => blink.remove());
}

/**
 * Время года и праздники: весной цветут деревья и газон, летом у входа тележка с мороженым,
 * осенью желтеют деревья и лежат листья; 8 Марта — тюльпаны и розовая гирлянда,
 * Хэллоуин — тыквы со светом и летучие мыши, Новый год — снеговик и огоньки на деревьях.
 */
export function applySeason(scene: StoreScene, keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
  const day = scene.state.day;
  const time = yearTime(day);
  const holiday = holidayFor(day);
  const rnd = new Phaser.Math.RandomDataGenerator([`season${day}`]);
  const { door, h } = scene.layout;
  const front = h + FACADE_H;
  const top = scene.next.h + 4;
  // Лиственные деревья (ель осенью не желтеет и весной не цветёт).
  const trees = scene.greenery.filter((g) => ['tree', 'tree_round', 'tree_birch'].includes((g.getData('base') as string | undefined) ?? g.texture.key));
  // По всему газону вокруг: не на здании, участке «Сдаётся», соседях и улице.
  const scatter = (count: number, make: (x: number, y: number) => void) => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 5; tries++) {
      const x = -190 + rnd.frac() * (scene.next.w + 380);
      const y = -170 + rnd.frac() * (top + 330);
      if (y > top - 4 && y < top + 92) continue;
      if (x > -WALL - 4 && x < scene.next.w + 4 && y > -14 && y < top) continue;
      if ((x < -20 || x > scene.next.w + 20) && y > top - 156 && y < top) continue;
      make(x, y);
      placed++;
    }
  };
  // Пятна листвы и цвета на кронах — тысячи крошечных квадратиков. Отдельными объектами они съедали
  // кадр на телефоне, поэтому рисуем их один раз в картинку (по одной на дерево: ветер её качает с кроной).
  const spots = new Map<Phaser.GameObjects.Image, { x: number; y: number; size: number; color: number }[]>();
  const spot = (tree: Phaser.GameObjects.Image, x: number, y: number, size: number, color: number) => {
    if (!spots.has(tree)) spots.set(tree, []);
    spots.get(tree)!.push({ x, y, size, color });
  };
  // Украшение кроны (пятна, огоньки) запоминаем на дереве: windTick качает его вместе с деревом.
  for (const tree of trees) tree.setData('crown', undefined);
  const crown = (tree: Phaser.GameObjects.Image, obj: CrownPart['obj']) => {
    const list = (tree.getData('crown') as CrownPart[] | undefined) ?? [];
    list.push({ obj, dx: obj.x - tree.x, dy: obj.y - tree.y });
    tree.setData('crown', list);
  };
  if (scene.weather !== 'leaves' && scene.weather !== 'snow') {
    trees.forEach((tree, i) => {
      // Осенью кроны в рыжих и жёлтых пятнах листвы.
      if (time === 'autumn') {
        tree.setTint(i % 3 === 2 ? 0xffffff : 0xffe0a0);
        const tones = i % 3 === 2 ? [0xfeae34] : [0xf77622, 0xfeae34, 0xfee761, 0xe43b44];
        for (let n = 0; n < (i % 3 === 2 ? 5 : 22); n++) spot(tree, tree.x + rnd.between(-9, 9), tree.y - rnd.between(5, 24), 2.4, rnd.pick(tones));
      }
      // Весной кроны в розово-белом цвету.
      if (time === 'spring') {
        for (let n = 0; n < 14; n++) spot(tree, tree.x + rnd.between(-9, 9), tree.y - rnd.between(5, 24), 1.6, rnd.pick([0xffd2e2, 0xffffff, 0xf6a5c0]));
      }
    });
  }
  // Праздник по настоящему календарю (game/live.ts) — поверх времени года игры: 31 декабря Новый год
  // и в магазине, даже если в игре лето.
  const live = liveLook(liveEvents(), todayLocal());
  const look = live ? LIVE_LOOKS[live] : null;
  if (holiday === 'newyear' || look?.treeLights) {
    // Разноцветные огоньки на деревьях. Новый год по календарю длится больше месяца, а деревьев в районе
    // под полторы сотни: по 6 мигающих огоньков на каждом — 900 твинов на кадр. Поэтому мигают только
    // огоньки у магазина (что видно без прокрутки), а дальше — и в лёгкой графике везде — горят ровно,
    // нарисованные в картинку кроны вместе с пятнами листвы.
    // Мигают они все одним счётчиком: у каждого огонька своя частота и сдвиг.
    const colors = [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xffffff];
    const twinkle = (tree: Phaser.GameObjects.Image) =>
      !scene.lite && tree.x > -100 && tree.x < scene.next.w + 100 && tree.y > -100 && tree.y < top + 430;
    // Свои случайные числа: цветы и листья ниже (rnd) лежат одинаково и с огоньками, и без, и в лёгкой графике.
    const lit = new Phaser.Math.RandomDataGenerator([`lights${day}`]);
    const bulbs: { obj: Phaser.GameObjects.Rectangle; period: number; shift: number }[] = [];
    trees.forEach((tree) => {
      const near = twinkle(tree);
      for (let i = 0; i < 6; i++) {
        const x = tree.x + lit.between(-8, 8);
        const y = tree.y - lit.between(6, 22);
        const color = lit.pick(colors);
        const period = lit.between(800, 1800);
        const shift = lit.frac();
        if (!near) {
          spot(tree, x, y, 1.4, color);
          continue;
        }
        const bulb = keep(scene.add.rectangle(x, y, 1.4, 1.4, color).setDepth(tree.depth + 1));
        bulbs.push({ obj: bulb, period, shift });
        crown(tree, bulb);
      }
    });
    if (bulbs.length) {
      const blink = scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1000,
        repeat: -1,
        onUpdate: () => {
          const now = scene.time.now;
          for (const b of bulbs) b.obj.alpha = 0.6 + 0.4 * Math.cos((now / b.period + b.shift) * Math.PI * 2);
        },
      });
      // Счётчик держит не огоньки — убрали их (смена погоды утром, пересборка) — убрать и его.
      bulbs[0].obj.once('destroy', () => blink.remove());
    }
  }
  for (const [tree, list] of spots) {
    const rt = keep(lighting.bakeSpots(scene, list).setDepth(tree.depth + 0.5));
    // Ось вращения — у основания дерева, как у самой картинки дерева.
    rt.setOrigin((tree.x - rt.x) / rt.displayWidth, (tree.y - rt.y) / rt.displayHeight).setPosition(tree.x, tree.y);
    crown(tree, rt);
  }
  const flowers = [0xffffff, 0xf6757a, 0xfee761, 0xb55088, 0xe43b44, 0x2ce8f5];
  if (time === 'spring' || time === 'summer') {
    scatter(time === 'spring' ? 160 : 70, (x, y) => keep(scene.art(x, y, 'flower').setTint(rnd.pick(flowers)).setDepth(-9)));
  }
  if (time === 'spring') {
    // С цветущих деревьев облетают лепестки.
    keep(scene.add.particles(0, 0, 'leaf', {
      x: { min: -120, max: scene.next.w + 120 },
      y: -120,
      speedY: { min: 8, max: 16 },
      speedX: { min: -8, max: 8 },
      rotate: { min: 0, max: 360 },
      tint: [0xffd2e2, 0xffffff, 0xf6a5c0],
      scale: 1 / ART,
      lifespan: ((top + 200) / 12) * 1000,
      frequency: 260,
    })).setDepth(-5);
  }
  // Летом у входа — тележка с мороженым под зонтиком: справа от двери, за доской отзывов и котом
  // (слева будка Бобика и подсолнухи); в самом большом магазине — на тротуаре, как и они.
  if (time === 'summer') {
    const y = scene.next === scene.layout ? top + 8 : front + 9;
    keep(scene.art(door.x + 66, y, 'icecream').setDepth(y + 5));
  }
  if (time === 'autumn' && scene.weather !== 'snow') {
    scatter(110, (x, y) => keep(scene.art(x, y, 'leaf').setTint(rnd.pick([0xf77622, 0xfeae34, 0xb86f50, 0xe43b44])).setAngle(rnd.angle()).setDepth(-9)));
  }

  // Гирлянда на фасаде — одна: свой праздник игрового года, иначе праздник по календарю, иначе
  // новогодняя в снегопад.
  const garlandColors =
    holiday === 'march8'
      ? [0xf6757a, 0xffffff, 0xe43b44, 0xffd2e2]
      : holiday === 'halloween'
        ? [0xf77622, 0x68386c, 0xfeae34, 0x68386c]
        : (look?.garland ?? (scene.weather === 'snow' ? [0xe43b44, 0xfee761, 0x63c74d, 0x0099db] : null));
  if (garlandColors) garland(scene, garlandColors, keep);
  // Тюльпаны у входа — к 8 Марта, игровому или настоящему; там же будка Бобика — с ней без тюльпанов.
  if ((holiday === 'march8' || look?.tulips) && !hasDog(scene.state)) keep(scene.art(door.x - 26, front + 6, 'tulips').setDepth(front + 12));
  if (holiday === 'halloween') {
    for (const dx of [-20, 18]) {
      keep(scene.art(door.x + dx, front + 5, 'pumpkin').setDepth(front + 8));
      // Вечером внутри тыкв горит свет.
      keep(lighting.nightGlow(scene, scene.art(door.x + dx, front + 5, 'glow').setScale(18 / 64).setTint(0xffa040), 0.9, undefined, { map: { scale: 2.2, gain: 0.6, haze: 1 } }));
    }
    for (let i = 0; i < 4; i++) {
      const bat = keep(scene.art(door.x, -40, 'bat0').setScale(1.6 / ART).setDepth(LIGHT_DEPTH + 2));
      scene.bats.push(bat);
      const cx = scene.layout.w / 2 + rnd.between(-60, 60);
      const cy = rnd.between(-48, -30);
      const flight = scene.tweens.addCounter({
        from: 0,
        to: Math.PI * 2,
        duration: rnd.between(5000, 8000),
        repeat: -1,
        onUpdate: (tw) => {
          const a = (tw.getValue() ?? 0) + i;
          bat.setPosition(cx + Math.cos(a) * 46, cy + Math.sin(a * 2) * 10).setTexture(Math.floor(scene.time.now / 140 + i) % 2 ? 'bat0' : 'bat1');
        },
      });
      // Счётчик полёта держит не мышь, и killTweensOf его не найдёт: убрали мышь (смена погоды утром) —
      // убрать и его, иначе он тронет уничтоженную картинку и игра встанет.
      bat.once('destroy', () => flight.remove());
    }
  }
  if (holiday === 'newyear') keep(scene.art(-40, top - 190, 'snowman').setDepth(top - 180));
}

/**
 * Мелочи большого зала (когда кассы уже стоят): растения в кадках вдоль правой стены и в нижнем левом углу. Кадки — препятствия:
 * их обходят и покупатели, и продавец.
 */
export function buildHallDecor(scene: StoreScene): void {
  const { h } = scene.layout;
  if (scene.state.level < 2) return;
  const clerks = scene.registers.map((r) => r.clerk);
  const free = (x: number, y: number) =>
    scene.obstacles.every((o) => x < o.x - 10 || x > o.x + o.w + 10 || y < o.y - 12 || y > o.y + o.h + 12) &&
    clerks.every((c) => Math.hypot(c.x - x, c.y - y) > 22);
  const spots: { x: number; y: number }[] = [];
  // Вдоль правой стены растений больше нет — там автомат, касса и проход; остался угол у склада.
  const ice = shelves.iceboxSpot(scene);
  if (ice.x >= 36) spots.push({ x: 12, y: h - 14 });
  const bought = activeDecor(scene.state, 'plants')?.texture;
  spots.forEach((def, i) => {
    const id = `hall${i}`;
    const p = building.propAt(scene, id, def);
    if (p === def && !free(p.x, p.y)) return;
    const tex = bought ?? (i % 2 ? 'plant_big' : 'plant');
    scene.art(p.x, p.y + 3, 'shadow').setScale(0.7 / ART).setDepth(p.y - 1);
    scene.art(p.x, p.y, tex).setDepth(p.y + 6);
    scene.obstacles.push({ x: p.x - 7, y: p.y - 10, w: 14, h: 14 });
    building.registerProp(scene, id, p, tex, propFootprint(scene.layout, id, p.x));
  });
}

/**
 * Праздничная вещь за открытки (ёлка, парусник, мимоза — game/live.ts): у входа, рядом с витриной.
 * Её можно передвинуть при перестановке; ёлка вечером мигает огоньками.
 */
export function buildHolidayDecor(scene: StoreScene): void {
  const item = activeDecor(scene.state, 'holiday');
  if (!item?.texture) return;
  const { w, h, door } = scene.layout;
  const props = scene.propList.map(propRect);
  const free = (x: number, y: number) =>
    scene.obstacles.every((o) => x < o.x - 10 || x > o.x + o.w + 10 || y < o.y - 12 || y > o.y + o.h + 12) &&
    props.every((r) => x + 8 < r.x || x - 8 > r.x + r.w || y + 8 < r.y || y - 8 > r.y + r.h);
  const spots = [
    { x: door.x - 34, y: h - 14 },
    { x: door.x + 30, y: h - 30 },
    { x: w - 34, y: h - 14 },
  ];
  // Своё место (перестановка) — всегда; стандартное — первое свободное, а все заняты — вещи сегодня нет.
  const def = spots.find((p) => free(p.x, p.y)) ?? spots[0];
  const p = building.propAt(scene, 'holiday', def);
  if (p === def && !free(p.x, p.y)) return;
  const img = scene.art(p.x, p.y, item.texture).setDepth(p.y + 8);
  const fp = propFootprint(scene.layout, 'holiday', p.x);
  scene.obstacles.push({ x: p.x + fp.x, y: p.y + fp.y, w: fp.w, h: fp.h });
  building.registerProp(scene, 'holiday', p, item.texture, fp);
  if (item.id === 'holiday_tree' && !scene.lite) {
    // Огоньки на ёлке перемигиваются (тёплое пятно — вечером ярче).
    lighting.nightGlow(scene, scene.art(p.x, p.y - 2, 'glow').setDisplaySize(26, 22).setTint(0xffd27a), 0.5);
    const top = p.y - img.displayHeight / 2;
    [0xfee761, 0xe43b44, 0x2ce8f5].forEach((color, i) => {
      const bulb = scene.add.rectangle(p.x - 4 + i * 4, top + 8 + i * 3, 1.2, 1.2, color).setDepth(p.y + 9);
      scene.tweens.add({ targets: bulb, alpha: 0.2, duration: 600 + i * 180, yoyo: true, repeat: -1 });
    });
  }
}

/** Терминал на прилавке и кассы самообслуживания у правой стены — если куплены. */
export function buildUpgrades(scene: StoreScene): void {
  const { counter } = scene.layout;
  if (hasUpgrade(scene.state, 'terminal')) scene.art(counter.x + 3, counter.y - 4, 'card_terminal').setDepth(counter.y + 22);
  for (let i = 1; i < registerCount(scene.state); i++) building.buildRegister(scene, i);
  buildHallDecor(scene);
  buildHolidayDecor(scene);
  building.buildGearProps(scene);
  food.buildCoffee(scene);
  food.buildOven(scene);
  buildRadio(scene);
  buildCup(scene);
  deliveries.buildDelivery(scene);
  // Кассы самообслуживания — у очереди, у правой стены над кассами, одна под другой (вместе с кассой переезжают).
  scene.kiosks = [];
  const tex = KIOSK_SPRITES[kioskTierIndex(scene.state)];
  for (let i = 0; i < kioskCount(scene.state); i++) {
    const at = kioskSpot(scene.layout, i);
    const img = scene.art(at.x, at.y, tex).setDepth(at.y + 9);
    const screen = scene.add
      .rectangle(at.x + KIOSK_SCREEN.x, at.y + KIOSK_SCREEN.y, KIOSK_SCREEN.w, KIOSK_SCREEN.h, KIOSK_GLOW)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.3)
      .setDepth(at.y + 10);
    scene.light.follow(screen, { key: 'glow', w: 20, h: 18, dy: 4, power: () => screen.alpha * 0.8 * lighting.powerOn(scene) });
    scene.obstacles.push({ x: at.x - 7, y: at.y - 12, w: 14, h: 16 });
    scene.kiosks.push({ img, screen, busy: false });
  }
}

/** Кубок последнего выигранного конкурса — на прилавке, слегка поблёскивает. */
export function buildCup(scene: StoreScene): void {
  const wins = contestOf(scene.state)?.wins ?? 0;
  scene.builtCup = wins;
  if (!wins) return;
  const { counter } = scene.layout;
  const cup = scene.art(counter.x - 11, counter.y - 3, `cup_${tierKey(wins - 1)}`).setOrigin(0.5, 1).setDepth(counter.y + 22);
  const glint = scene.add.rectangle(cup.x - 2, cup.y - 9, 1, 1, 0xffffff).setDepth(cup.depth + 1).setAlpha(0);
  scene.tweens.add({ targets: glint, alpha: { from: 0, to: 1 }, scale: { from: 1, to: 2.5 }, duration: 300, yoyo: true, repeat: -1, repeatDelay: 2600 });
}

/** Радио на автомате с напитками — подальше от кассы, чтобы не задеть, пока пробиваешь. Касание переключает волну. */
export function buildRadio(scene: StoreScene): void {
  scene.radioTimer?.remove();
  scene.radioTimer = undefined;
  scene.radioX = undefined;
  if (!hasRadio(scene.state)) {
    applyRadio(scene);
    return;
  }
  // Радио стоит на автомате с напитками — и переезжает вместе с ним.
  const at = { x: scene.vendingAt.x, y: scene.vendingAt.y - 15 };
  scene.radioX = at.x;
  const radio = scene.art(at.x, at.y, 'radio').setDepth(scene.vendingAt.y + 11);
  radio.setInteractive({ useHandCursor: true }).on('pointerup', () =>
    camera.tap(scene, () => {
      const next = setStation(scene.state, nextStation(stationOf(scene.state)));
      if (!next) return;
      scene.state = next;
      saveGame(next);
      sound.tap();
      scene.tweens.add({ targets: radio, scaleX: radio.scaleX * 1.15, scaleY: radio.scaleY * 1.15, duration: 90, yoyo: true });
      scene.popup(at.x, at.y - 10, t('popup.radio', { name: t(STATION_INFO[stationOf(next)].nameKey) }), '#fee761');
      applyRadio(scene, true);
    }),
  );
  scene.radioTimer = scene.time.addEvent({
    delay: 900,
    loop: true,
    callback: () => {
      const station = stationOf(scene.state);
      if (station === 'off') return;
      const note = scene.add
        .text(at.x + Phaser.Math.Between(-3, 3), at.y - 6, Math.random() < 0.5 ? '♪' : '♫', {
          fontFamily: UI_FONT,
          fontSize: '7px',
          color: station === 'hits' ? '#f6757a' : '#fee761',
        })
        .setOrigin(0.5)
        .setResolution(scene.textRes(4))
        .setDepth(1000);
      scene.tweens.add({
        targets: note,
        y: note.y - 16,
        x: note.x + Phaser.Math.Between(-6, 6),
        alpha: 0,
        duration: station === 'hits' ? 1100 : 1700,
        onComplete: () => note.destroy(),
      });
    },
  });
  applyRadio(scene);
}

/** Волна радио — в музыку: звучит из приёмника. byHand — переключил игрок (шипение настройки и позывные). */
export function applyRadio(scene: StoreScene, byHand = false): void {
  const station = stationOf(scene.state);
  music.setRadio(station === 'off' || !hasRadio(scene.state) ? null : station, scene.radioX, byHand);
}

/**
 * Настроение музыки: титул; до открытия — утро; рабочий день — по часам смены (утро, день, вечер);
 * после закрытия — вечер; ночная смена и её итоги — ночь.
 */
export function musicMood(scene: StoreScene): MusicMood {
  if (scene.onTitle) return 'title';
  if (scene.night || scene.nightMusic) return 'night';
  if (!scene.dayOpen) return scene.closed ? 'evening' : 'morning';
  const p = 1 - scene.timeLeft / DAY_SECONDS;
  return p < MUSIC_MORNING ? 'morning' : p < EVENING_FROM ? 'day' : 'evening';
}

/** Зимняя музыка сегодня: зима в игре, новогодняя неделя или настоящие новогодние дни. */
export function isWinterMusic(scene: StoreScene): boolean {
  return winterMusic(yearTime(scene.state.day), holidayFor(scene.state.day), new Date(trustedNow()));
}

/** Салют за окном сегодня вечером: новогодняя неделя в игре или 31 декабря — 1 января по календарю. */
export function isNewYearSound(scene: StoreScene): boolean {
  return holidayFor(scene.state.day) === 'newyear' || realNewYear(new Date(trustedNow()));
}

/**
 * Что вокруг — для атмосферы: сколько покупателей (гомон), утро ли (птицы чаще), Новый год (салют),
 * поздняя осень (вороны), ночная смена, облегчённый режим и какая неоновая вывеска сейчас горит (жужжит).
 */
export function ambienceLife(scene: StoreScene): AmbLife {
  const life = scene.ambLife;
  life.customers = scene.running ? scene.customers.size : 0;
  life.morning = scene.onTitle || scene.night || scene.closed ? 0 : !scene.dayOpen ? 1 : Phaser.Math.Clamp(1 - (1 - scene.timeLeft / DAY_SECONDS) / (MUSIC_MORNING * 1.5), 0, 1);
  life.newYear = scene.newYearSound;
  life.lateAutumn = lateAutumn(scene.state.day);
  life.night = scene.night;
  life.lite = scene.lite;
  // Звук зала по размеру магазина: помещение и сколько касс работает (состояние меняется целиком — сравниваем ссылку).
  life.level = scene.state.level;
  if (scene.tillsFor !== scene.state) {
    scene.tillsFor = scene.state;
    life.tills = registerCount(scene.state) - idleRegisters(scene.state);
  }
  // Неон в зале горит весь день; вывеска на крыше — с вечера (сначала мигает). Свет отключили — молчит.
  const inside = scene.neonDecorX !== undefined;
  if (scene.blackout || scene.powerCut || (!inside && scene.evening <= 0.12)) life.neon = null;
  else {
    const spot = (life.neon ??= { x: 0, inside: false, flicker: false });
    spot.x = scene.neonDecorX ?? scene.layout.w / 2;
    spot.inside = inside;
    spot.flicker = !inside && scene.evening < 0.18;
  }
  return life;
}

export function buildDecor(scene: StoreScene): void {
  const { w, h, wallH, wc, door, slots } = scene.layout;
  // От входа вглубь зала — наклейки-стрелки на полу (только там, где не стоят полки и касса).
  const arrows = scene.add.graphics().setDepth(0.42);
  const blocked = [...slots.map((p) => slotRect(scene.layout, p)), ...tillZones(scene.layout, registerSlots(scene.state), kioskCount(scene.state))];
  for (const ay of [h - 44, h - 60]) {
    if (blocked.some((r) => overlapsRect(r, { x: door.x - 6, y: ay - 4, w: 12, h: 8 }))) continue;
    arrows.fillStyle(0x0099db, 0.32);
    arrows.fillTriangle(door.x - 5, ay + 3, door.x + 5, ay + 3, door.x, ay - 3);
    arrows.fillStyle(0xffffff, 0.35);
    arrows.fillTriangle(door.x - 2.5, ay + 2, door.x + 2.5, ay + 2, door.x, ay - 1);
  }
  // На стене по очереди плакаты и окна, между ними часы.
  // Вместо плакатов — купленная картина; вместо часов — неон «ОТКРЫТО».
  const art = activeDecor(scene.state, 'art')?.texture ?? 'poster';
  scene.sunPatches = [];
  scene.sunRays = [];
  for (let x = 30, i = 0; x < wc.x - 16; x += 64, i++) {
    // Полки стоят вплотную к стене и закрывают её: за полкой картину и окно не вешаем.
    if (shelves.behindShelf(scene, x, 10)) continue;
    scene.art(x, 9, i % 2 ? 'window' : art).setDepth(1);
    // Из окна на пол ложится солнечное пятно (updateDaylight).
    if (i % 2) {
      const patch = scene.art(x, wallH + 2, 'light_spill').setOrigin(0.5, 0).setScale(1 / ART, 1.5 / ART).setTint(0xffe9a8).setAlpha(0).setDepth(0.45);
      patch.setData('x', x);
      scene.sunPatches.push(patch);
      // От низа окна к пятну тянется столб света, в нём кружат пылинки (buildDust).
      if (!scene.lite) scene.sunRays.push({ ray: lighting.sunRay(scene, x, 14, 0xffe6a0), patch });
    }
  }
  if (62 < wc.x - 16 && !shelves.behindShelf(scene, 62, 8)) {
    if (activeDecor(scene.state, 'neon')) {
      scene.neonDecorX = 62;
      const glow = scene.art(62, 11, 'glow').setScale(46 / 64, 24 / 64).setTint(0xf6757a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      scene.tweens.add({ targets: glow, alpha: { from: 0.8, to: 0.4 }, duration: 900, yoyo: true, repeat: -1 });
      scene.art(62, 10, 'neon').setDepth(2);
      // Неон под картой освещения: ночью светит в ней сам (ровно, без пульса — карту ради него не перерисовывать).
      scene.light.follow(glow, { key: 'light_pool', w: 44, h: 26, power: () => 0.6 * scene.evening * lighting.powerOn(scene) });
    } else {
      scene.art(62, 9, 'clock_face').setDepth(1);
      scene.clockHands = scene.add.graphics({ x: 62, y: 9 }).setDepth(1.1);
    }
  }
  // Ковёр в центре зала.
  const rug = activeDecor(scene.state, 'rug');
  if (rug) scene.art(w / 2, (wallH + h) / 2 + 6, rug.texture ?? 'rug').setDepth(1);
  lighting.buildLights(scene);
  buildShowpiece(scene);
  buildCounterDecor(scene);
  buildSupportDecor(scene);
  buildOutdoorDecor(scene);
  // Стойка со сладостями у кассы, у входа — корзинки, в больших магазинах — тележки. Если справа
  // от двери у нижней стены встал ларь с мороженым (тесный зал), тележки — слева от неё (но не
  // в дверях склада), а корзинки — где осталось место: слева от двери или по ту сторону ларя.
  // Купленные тележки стоят всегда: покупатели берут их у входа (cartsAtDoor).
  const { counter } = scene.layout;
  scene.art(counter.x, counter.y + 39, 'candy_rack').setDepth(counter.y + 40);
  const ice = scene.state.shelves.some((sh) => sh.kind === 'icebox') ? iceboxRect(shelves.iceboxSpot(scene)) : null;
  const low = ice && ice.y + ice.h > h - 16 ? ice : null;
  const fits = (x: number, half: number, taken?: number) =>
    x - half > WING_DOOR_CLEAR &&
    x + half < w - 20 &&
    (!low || x + half < low.x - 2 || x - half > low.x + low.w + 2) &&
    (taken === undefined || Math.abs(x - taken) > 16);
  const beyond = (half: number) => (low ? low.x + low.w + 3 + half : -1);
  const cartsX = persons.cartsAtDoor(scene) ? ([door.x + 46, door.x - 46, door.x - 24, beyond(9)].find((x) => fits(x, 9)) ?? door.x + 46) : undefined;
  const basketsX = [door.x + 26, door.x - 26, beyond(6)].find((x) => fits(x, 6, cartsX)) ?? door.x + 26;
  if (cartsX !== undefined) scene.art(cartsX, h - 10, 'carts').setDepth(h - 4);
  // Коврик у входа и автомат с напитками у правой стены.
  scene.art(door.x, h - 7, gearTier(scene.state, 'entrance') ? 'mat_grate' : 'mat').setDepth(1);
  // Автомат: у боковой стены — боком (лицом в зал), в зале — лицом к игроку. Его можно двигать.
  const vending = building.propAt(scene, 'vending', { x: w - 8, y: wallH + 56 });
  const side = vendingSide(scene.layout, vending.x);
  const vendingTex = side ? 'vending_side' : 'vending';
  scene.art(vending.x, vending.y, vendingTex).setFlipX(side && vending.x < w / 2).setDepth(vending.y + 10);
  scene.vendingAt = vending;
  building.registerProp(scene, 'vending', vending, vendingTex, vendingFootprint(side));
  // Стекло автомата светится, на пол перед ним ложится розоватое пятно — к вечеру ярче (furnitureLight).
  // Боком у стены стекло — в торце, смотрит в зал: у левой стены картинка отражена.
  const facing = side ? (vending.x < w / 2 ? 1 : -1) : 0;
  const glass = side ? scene.add.rectangle(vending.x + facing * 2.25, vending.y - 2.5, 1.5, 11, 0xffe6e6) : scene.add.rectangle(vending.x - 1.25, vending.y - 2.5, 7.5, 13, 0xffe6e6);
  glass.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(vending.y + 10.5);
  const spill = side
    ? scene.art(vending.x + facing * 4, vending.y, 'light_spill').setOrigin(0.5, 0).setAngle(-90 * facing).setScale(0.6 / ART, 0.45 / ART)
    : scene.art(vending.x - 1, vending.y + 11, 'light_spill').setOrigin(0.5, 0).setScale(0.7 / ART, 0.45 / ART);
  spill.setTint(0xff98a8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(0.45);
  scene.vendingGlow = { glass, spill };
  // В карте освещения автомат светит розоватым на пол и на тех, кто рядом.
  scene.light.follow(spill, { scale: 1.3, power: () => spill.alpha * 1.6 });
  // Вечером из окон правой стены тянутся оранжевые лучи — кроме окон, которые загородили автомат или полка.
  scene.sideRays = [];
  const sideSlots = slots.filter((s) => slotSide(scene.layout, s) === 'right');
  for (const sun of scene.lite ? [] : scene.sideSun) {
    const blocked = [vending, ...sideSlots].some((p) => p.x > w - 24 && Math.abs(p.y - sun.y) < 30);
    if (!blocked) scene.sideRays.push(lighting.sunRay(scene, w - 1, sun.y, 0xff9a48));
  }
  scene.art(basketsX, h - 8, 'baskets').setDepth(h - 8);
  // Растения в свободных углах у правой стены — не на пути покупателей.
  // Растение у туалета убрано: угол у правой стены оставляем свободным.
  const spots = [
    // В нижнем углу у кассы — вёдра с цветами, растение туда не ставим.
    ...(scene.state.shelves.some((s) => s.kind === 'florist') ? [] : [{ x: scene.layout.counter.x + 21, y: h - 40 }]),
  ];
  spots.forEach((def, i) => {
    const id = `plant${i}`;
    const p = building.propAt(scene, id, def);
    const busy = p === def && [...slots, ...scene.layout.showcases].some((s) => Math.abs(s.x - p.x) < 28 && Math.abs(s.y - p.y) < 24);
    if (busy) return;
    const tex = activeDecor(scene.state, 'plants')?.texture ?? 'plant';
    scene.art(p.x, p.y, tex).setDepth(p.y + 6);
    building.registerProp(scene, id, p, tex, propFootprint(scene.layout, id, p.x));
  });
}

/** Вещица на прилавке (ваза, копилка): у верхнего края стойки, над лентой. */
export function buildCounterDecor(scene: StoreScene): void {
  const item = activeDecor(scene.state, 'counter');
  if (!item?.texture) return;
  const { counter } = scene.layout;
  scene.art(counter.x + 2, counter.y - 20, item.texture).setOrigin(0.5, 1).setDepth(counter.y + 21);
}

/**
 * Подарки за поддержку автора (support.ts): табличка «Спасибо!» у кассы — надпись на языке игрока —
 * и кот в цилиндре на прилавке; кот иногда моргает (в лёгкой графике сидит смирно).
 */
export function buildSupportDecor(scene: StoreScene): void {
  const { counter } = scene.layout;
  if (activeDecor(scene.state, 'plaque')) {
    // Стоит на прилавке у нижнего края, лицом к очереди.
    const x = counter.x - 1;
    const y = counter.y + 30;
    scene.art(x, y, 'thanks_plaque').setOrigin(0.5, 1).setDepth(counter.y + 22);
    scene.add
      .text(x, y - 4.5, t('support.plaque'), { fontFamily: UI_FONT, fontSize: '3.5px', fontStyle: 'bold', color: '#f7dc85' })
      .setOrigin(0.5)
      .setResolution(scene.textRes(6))
      .setDepth(counter.y + 23);
  }
  if (activeDecor(scene.state, 'mascot')) {
    const y = counter.y - 8;
    const cat = scene.art(counter.x + 3, y, 'cat_hat').setOrigin(0.5, 1).setDepth(counter.y + 22);
    if (!scene.lite) {
      scene.worldTimer(3700, () => {
        if (!cat.active) return;
        cat.setTexture('cat_hat_blink');
        scene.time.delayedCall(160, () => cat.active && cat.setTexture('cat_hat'));
      });
    }
  }
}

/**
 * Вещи у входа на тротуаре: кадки с цветами по бокам от входа или меловая доска-штендер. У самой двери
 * места заняты (урна, Бобик, подсолнухи, доска отзывов, промоутер, скамейка) — ставим чуть дальше.
 * Летом справа от двери стоит тележка с мороженым (applySeason) — правая кадка тогда за ней.
 */
export function buildOutdoorDecor(scene: StoreScene): void {
  const item = activeDecor(scene.state, 'outdoor');
  if (!item?.texture) return;
  const { door } = scene.layout;
  const top = scene.streetY - 12;
  const right = yearTime(scene.state.day) === 'summer' ? door.x + 96 : door.x + 62;
  const spots = item.id === 'out_planters' ? [door.x - 60, right] : [door.x - 50];
  for (const x of spots) scene.art(x, top + 9, item.texture).setOrigin(0.5, 1).setDepth(top + 9);
}

/** Украшение зала (аквариум, фонтан, автомат…) — в свободном месте, с маленькой анимацией. */
export function buildShowpiece(scene: StoreScene): void {
  const item = activeDecor(scene.state, 'showpiece');
  if (!item) return;
  const { w, wallH, h } = scene.layout;
  const spot = building.freeSpot(scene, [
    { x: w - 16, y: wallH + 92 },
    { x: w - 70, y: wallH + 40 },
    { x: w / 2, y: h - 30 },
  ]);
  if (!spot) return;
  const img = scene.art(spot.x, spot.y, item.texture!).setDepth(spot.y + 8);
  const top = spot.y - img.displayHeight / 2;
  if (item.id === 'lucky_cat') {
    // Кот-удача машет лапкой.
    let up = true;
    scene.tweens.add({
      targets: img,
      alpha: 1,
      duration: 450,
      repeat: -1,
      onRepeat: () => {
        up = !up;
        img.setTexture(up ? 'lucky_cat' : 'lucky_cat2');
      },
    });
  } else if (item.id === 'jukebox') {
    // Музыкальный автомат играет: из него всплывают ноты.
    const note = scene.add
      .text(spot.x + 4, top + 2, '♪', { fontFamily: UI_FONT, fontSize: '7px', color: '#fee761', stroke: '#181425', strokeThickness: 2 })
      .setOrigin(0.5)
      .setResolution(scene.textRes(4))
      .setDepth(spot.y + 9);
    scene.tweens.add({
      targets: note,
      y: top - 10,
      x: spot.x + 8,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      repeat: -1,
      repeatDelay: 500,
      onRepeat: () => note.setText(Math.random() < 0.5 ? '♪' : '♫'),
    });
  } else if (item.id === 'fountain' || item.id === 'aquarium') {
    // Блики на воде.
    const glint = scene.art(spot.x + (item.id === 'fountain' ? 0 : 6), item.id === 'fountain' ? top + 3 : spot.y - 4, 'glow')
      .setDisplaySize(10, 10)
      .setTint(0xc8fbff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(spot.y + 9);
    scene.tweens.add({ targets: glint, alpha: { from: 0.7, to: 0.15 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
