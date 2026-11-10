// «Бабушкин двор» в мире (game/garden.ts): огороженный участок слева от магазина — за флигелем, над кафе «Пончик».
// 10.11 (третий обход, просьба автора): раньше теплица стояла на газоне перед входом, а в тесных помещениях — в парке
// за дорогой, и её не находили. Теперь у неё своё место рядом с магазином: калитка, дорожка к улице вдоль флигеля,
// теплица с первой грядкой, рядом ещё две грядки под открытым небом, бочка с лейкой, пугало и подсолнухи у забора.
// Рассада растёт по настоящему времени; созрело — над грядкой покачивается значок, нажатие на двор собирает урожай.
// Камеру ко двору ведёт кнопка «🌱» слева внизу (ui/hud.ts), утренний облёт начинается над двором.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { PRODUCTS } from '../game/economy';
import { BEDS_MAX, bedLeft, bedsOf, bedStage, gardenLook, gardenRipe, gardenVisible, harvest, hasGarden, type Bed, type CropId } from '../game/garden';
import { yearTime } from '../game/calendar';
import { inZar } from '../game/zarshop';
import { saveGame, savingPaused } from '../game/save';
import { sound } from '../platform/sound';
import { UI_FONT } from '../ui/dom';
import { ART } from './common';
import { WING_OUTER, type Layout } from './layout';
import * as building from './building';
import * as camera from './camera';

/** Двор: ширина и глубина (точки мира), зазор до стены флигеля и до крыши кафе под ним. */
const YARD = { w: 138, h: 68, gap: 8, overCafe: 152 };

/** Где двор: правым краем к флигелю, низом — над крышей кафе (её верх — next.h − 144, streets.buildNeighbors). */
export function yardRect(next: Layout): { x: number; y: number; w: number; h: number } {
  const bottom = next.h - YARD.overCafe;
  return { x: -WING_OUTER - YARD.gap - YARD.w, y: bottom - YARD.h, w: YARD.w, h: YARD.h };
}

/** Куда смотреть камере, чтобы двор был в кадре вместе с краем флигеля. */
export function yardFocus(scene: StoreScene): { x: number; y: number } {
  const yard = yardRect(scene.next);
  return { x: Math.round(yard.x + yard.w / 2 + 14), y: Math.round(yard.y + yard.h / 2) };
}

type Draw = Phaser.GameObjects.Graphics;

/** Штакетник: планки с острым верхом и две перекладины. */
function picket(g: Draw, x: number, y: number, w: number): void {
  g.fillStyle(0xb8a48c, 1).fillRect(x, y - 4.2, w, 0.9).fillRect(x, y - 1.8, w, 0.9);
  for (let px = x + 0.5; px < x + w - 1; px += 3) {
    g.fillStyle(0xf4ecd8, 1).fillRect(px, y - 6, 1.8, 6);
    g.fillStyle(0xf4ecd8, 1).fillTriangle(px, y - 6, px + 0.9, y - 7.2, px + 1.8, y - 6);
    g.fillStyle(0x181425, 0.16).fillRect(px + 1.3, y - 6, 0.5, 6);
  }
}

/** Грядка под открытым небом (или внутри теплицы): земля с бороздой и рассада своей культуры на нужной стадии. */
function drawBed(g: Draw, x: number, y: number, crop: CropId, stage: number, snow: boolean, seed: string): void {
  g.fillStyle(0x5a3420, 1).fillRect(x - 15, y - 10, 30, 10);
  g.fillStyle(0x733e39, 1).fillRect(x - 14, y - 9, 28, 8);
  g.fillStyle(0x5a3420, 1).fillRect(x - 14, y - 5.5, 28, 0.8);
  if (snow) g.fillStyle(0xf4f8ff, 0.85).fillRect(x - 14, y - 9, 28, 1.6);
  const rnd = new Phaser.Math.RandomDataGenerator([seed]);
  if (crop === 'apples') {
    // Яблони: три деревца, с каждой стадией крона шире; спелые — в красных яблоках.
    for (let i = 0; i < 3; i++) {
      const px = x - 10 + i * 10;
      const tall = [3, 6, 9, 10.5][stage];
      const crown = [1.6, 3, 4.4, 5][stage];
      g.fillStyle(0x8f563b, 1).fillRect(px - 0.6, y - 2 - tall, 1.2, tall);
      g.fillStyle(0x265c42, 1).fillCircle(px, y - 2 - tall, crown + 0.5);
      g.fillStyle(0x3e8948, 1).fillCircle(px, y - 2 - tall, crown);
      g.fillStyle(0x63c74d, 1).fillCircle(px - crown * 0.3, y - 2 - tall - crown * 0.3, crown * 0.5);
      if (stage === 3) for (let k = 0; k < 4; k++) g.fillStyle(0xe43b44, 1).fillCircle(px + rnd.realInRange(-crown, crown) * 0.7, y - 2 - tall + rnd.realInRange(-crown, crown) * 0.6, 0.9);
    }
    return;
  }
  // Картошка — низкая ботва с сиреневыми цветками; «яблоки и картошка» — кустики повыше с красным и жёлтым.
  for (let i = 0; i < 14; i++) {
    const px = x - 12 + (i % 7) * 4;
    const py = y - (i < 7 ? 6 : 1.5);
    const tall = (crop === 'quick' ? [0.7, 1.6, 2.4, 2.8] : [0.8, 2.2, 3.6, 4])[stage] + rnd.frac() * 0.6;
    g.fillStyle(0x3e8948, 1).fillRect(px, py - tall, 1, tall);
    if (stage >= 1) g.fillStyle(crop === 'quick' ? 0x4fa055 : 0x63c74d, 1).fillRect(px - 0.8, py - tall, 2.6, Math.min(2, tall * 0.6));
    if (stage === 3) {
      if (crop === 'quick') g.fillStyle(rnd.pick([0xd8b4e8, 0xf4f8ff]), 1).fillRect(px, py - tall - 0.6, 1.2, 1.2);
      else g.fillStyle(rnd.pick([0xe43b44, 0xfeae34, 0xe43b44]), 1).fillCircle(px + 0.5, py - tall + 1.4, 0.9);
    }
  }
  // Спелую картошку видно: пара клубней у борозды.
  if (crop === 'quick' && stage === 3) for (const dx of [-9, -2, 6, 11]) g.fillStyle(0xc8955a, 1).fillEllipse(x + dx, y - 0.6, 2.4, 1.6);
}

/** Стеклянный домик над первой грядкой: стены и двускатная крыша, переплёт, блик. */
function glassHouse(g: Draw, x: number, y: number): number {
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
  return ridge;
}

/** Место грядки во дворе: первая — в теплице у калитки, вторая и третья — левее, под открытым небом. */
const bedSpot = (yard: { x: number; y: number; w: number; h: number }, i: number): { x: number; y: number } => ({ x: yard.x + yard.w - 24 - i * 38, y: yard.y + (i === 0 ? 40 : 44) });

/** Поставить (или перерисовать) двор: зовётся при постройке улицы и когда грядка перешла на новую стадию. */
export function buildGarden(scene: StoreScene, next: Layout, top: number): void {
  scene.gardenBox?.destroy();
  scene.gardenBox = undefined;
  scene.gardenAt = { next, top };
  const now = Date.now();
  scene.builtGarden = `${gardenLook(scene.state, now)}|${gardenVisible(scene.state) ? 1 : 0}`;
  if (inZar(scene.state) || !gardenVisible(scene.state)) return;
  const yard = yardRect(next);
  const { x, y, w, h } = yard;
  const beds = bedsOf(scene.state);
  const snow = scene.weather === 'snow' || yearTime(scene.state.day) === 'winter';
  const parts: Phaser.GameObjects.GameObject[] = [];
  // Дорожка от калитки вдоль флигеля к улице — по ней двор и находят.
  const laneX = x + w + 1;
  parts.push(scene.add.tileSprite(laneX, y + h - 14, 6, top - (y + h - 14), 'paving').setOrigin(0).setTileScale(1 / ART));
  // Земля двора: утоптанная, светлее газона, с дорожкой от калитки к грядкам.
  const ground = scene.add.graphics();
  ground.fillStyle(snow ? 0xe8eef8 : 0x8fb86a, 1).fillRoundedRect(x, y, w, h, 3);
  ground.fillStyle(snow ? 0xd8e0ee : 0x9ec57a, 1).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 2);
  ground.fillStyle(0xc8b088, 1).fillRect(x + 6, y + h - 16, w - 6, 5);
  ground.fillStyle(0xb89c74, 0.6).fillRect(x + 6, y + h - 12, w - 6, 1);
  parts.push(ground);
  // Задний забор и боковые — под всем, что во дворе; передний — поверх (ниже по экрану).
  const back = scene.add.graphics();
  picket(back, x, y + 2, w);
  back.fillStyle(0xf4ecd8, 1).fillRect(x, y - 4, 1.6, h - 2).fillRect(x + w - 1.6, y - 4, 1.6, h - 20);
  parts.push(back);
  const front = scene.add.graphics();
  picket(front, x, y + h, w - 16);
  // Столбики калитки и распахнутая створка.
  front.fillStyle(0x8f563b, 1).fillRect(x + w - 16, y + h - 9, 1.6, 9).fillRect(x + w - 1.6, y + h - 23, 1.6, 9);
  front.fillStyle(0xf4ecd8, 1).fillRect(x + w - 14, y + h - 7, 6, 1).fillRect(x + w - 14, y + h - 4, 6, 1);

  // Всё во дворе — в одном контейнере, рисуется по порядку: земля, задний забор, грядки и хозяйство, передний забор, значки.
  const g = scene.add.graphics();
  parts.push(g);
  if (!hasGarden(scene.state)) {
    // Двор ждёт теплицу: колышки с верёвкой на месте грядки, лопата и табличка.
    const spot = bedSpot(yard, 0);
    g.lineStyle(0.6, 0xf4ecd8, 0.9).strokeRect(spot.x - 15, spot.y - 10, 30, 10);
    for (const [dx, dy] of [[-15, -10], [15, -10], [-15, 0], [15, 0]]) g.fillStyle(0x8f563b, 1).fillRect(spot.x + dx - 0.6, spot.y + dy - 2.5, 1.2, 3);
    g.fillStyle(0x8f563b, 1).fillRect(spot.x - 26, spot.y - 12, 1, 11);
    g.fillStyle(0x8b9bb4, 1).fillRect(spot.x - 27.5, spot.y - 2, 4, 3.5);
    parts.push(...sign(scene, x + 22, y + 30, `🌱\n${t('garden.yard')}`), front);
    const zone = scene.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => camera.tap(scene, () => scene.popup(x + w / 2, y + 16, t('garden.empty'), '#d8f0d8')));
    parts.push(zone);
    scene.gardenBox = scene.add.container(0, 0, parts).setDepth(y + h);
    return;
  }

  // Грядки: первая — в теплице, остальные под открытым небом; некупленные — колышками.
  let ripeAt: { x: number; y: number } | undefined;
  const marks: Phaser.GameObjects.GameObject[] = [];
  for (let i = 0; i < BEDS_MAX; i++) {
    const spot = bedSpot(yard, i);
    const bed: Bed | undefined = beds[i];
    if (!bed) {
      g.lineStyle(0.5, 0xf4ecd8, 0.55).strokeRect(spot.x - 14, spot.y - 9, 28, 8);
      continue;
    }
    const stage = bedStage(bed, now);
    drawBed(g, spot.x, spot.y, bed.crop, stage, snow && i > 0, `bed${i}${bed.crop}`);
    const roof = i === 0 ? glassHouse(g, spot.x, spot.y) : spot.y - 16;
    if (stage === 3) {
      ripeAt ??= { x: spot.x, y: roof };
      // Созрело: значок над грядкой покачивается — нажми и собери.
      const mark = scene.add.container(spot.x, roof - 6, [
        scene.add.circle(0, 0, 4.2, 0xfee761).setStrokeStyle(0.8, 0x2b2233),
        scene.add.text(0, 0, '!', { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#2b2233' }).setOrigin(0.5).setResolution(scene.textRes(4)),
      ]);
      if (!scene.lite) scene.tweens.add({ targets: mark, y: roof - 9, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 180 });
      marks.push(mark);
    }
  }

  // Хозяйство: бочка с водой и лейка у калитки, пугало между грядками, тачка, подсолнухи вдоль заднего забора.
  const barrel = { x: x + w - 8, y: y + 20 };
  g.fillStyle(0x3a4466, 1).fillRect(barrel.x - 4, barrel.y - 8, 8, 9);
  g.fillStyle(0x5a6988, 1).fillRect(barrel.x - 3.5, barrel.y - 7.5, 7, 8);
  g.fillStyle(0x262b44, 1).fillRect(barrel.x - 4, barrel.y - 5, 8, 0.8).fillRect(barrel.x - 4, barrel.y - 1.5, 8, 0.8);
  g.fillStyle(snow ? 0xd8f0f8 : 0x4fa4e8, 1).fillEllipse(barrel.x, barrel.y - 7.5, 6.4, 2);
  g.fillStyle(0x8b9bb4, 1).fillRect(barrel.x - 11, barrel.y - 3, 5, 4).fillRect(barrel.x - 13, barrel.y - 2, 2.4, 0.8);
  g.lineStyle(0.6, 0x8b9bb4, 1).strokeCircle(barrel.x - 6, barrel.y - 3, 1.6);
  const scare = { x: x + 12, y: y + 34 };
  g.fillStyle(0x8f563b, 1).fillRect(scare.x - 0.6, scare.y - 14, 1.2, 14).fillRect(scare.x - 6, scare.y - 10, 12, 1.1);
  g.fillStyle(0xe43b44, 1).fillRect(scare.x - 4, scare.y - 10.5, 8, 6);
  g.fillStyle(0xfeae34, 1).fillRect(scare.x - 6.5, scare.y - 10.5, 2, 1.6).fillRect(scare.x + 4.5, scare.y - 10.5, 2, 1.6);
  g.fillStyle(0xf4d7a8, 1).fillCircle(scare.x, scare.y - 13.5, 2.6);
  g.fillStyle(0xc8955a, 1).fillRect(scare.x - 4, scare.y - 17, 8, 1.2).fillRect(scare.x - 2.4, scare.y - 19, 4.8, 2.2);
  g.fillStyle(0x262b44, 1).fillRect(scare.x - 1.2, scare.y - 14, 0.7, 0.7).fillRect(scare.x + 0.6, scare.y - 14, 0.7, 0.7);
  const barrow = { x: x + 34, y: y + h - 20 };
  g.fillStyle(0x3e8948, 1).fillRect(barrow.x - 5, barrow.y - 5, 10, 4);
  g.fillStyle(0x265c42, 1).fillRect(barrow.x - 5, barrow.y - 1.6, 10, 0.8);
  g.fillStyle(0x8f563b, 1).fillRect(barrow.x + 5, barrow.y - 4.5, 5, 0.9);
  g.fillStyle(0x262b44, 1).fillCircle(barrow.x - 4, barrow.y + 0.6, 1.8);
  g.fillStyle(0xc8955a, 1).fillEllipse(barrow.x, barrow.y - 5.4, 7, 2.2);
  if (!snow) {
    const sun = scene.add.graphics();
    for (let i = 0; i < 6; i++) {
      const sx = x + 30 + i * 13;
      const tall = 9 + (i % 3) * 2;
      sun.fillStyle(0x3e8948, 1).fillRect(sx - 0.5, y + 7 - tall, 1, tall).fillRect(sx - 2.4, y + 3 - tall / 3, 2.2, 1.1);
      sun.fillStyle(0xfee761, 1).fillCircle(sx, y + 6.5 - tall, 2.3);
      sun.fillStyle(0x733e39, 1).fillCircle(sx, y + 6.5 - tall, 1.1);
    }
    parts.push(sun);
  }
  parts.push(...sign(scene, x + w - 30, y + 12, t('garden.yard')));
  parts.push(...life(scene, yard, snow, Boolean(ripeAt)), front, ...marks);

  const tapAt = ripeAt ?? { x: bedSpot(yard, 0).x, y: y + 12 };
  const zone = scene.add
    .zone(x + w / 2, y + h / 2 - 4, w, h + 8)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => camera.tap(scene, () => tapGarden(scene, tapAt.x, tapAt.y)));
  parts.push(zone);
  scene.gardenBox = scene.add.container(0, 0, parts).setDepth(y + h);
}

/** Табличка на двух ножках с надписью. */
function sign(scene: StoreScene, x: number, y: number, label: string): Phaser.GameObjects.GameObject[] {
  const text = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: '4px', color: '#2b2233', align: 'center' }).setOrigin(0.5).setResolution(scene.textRes(8));
  const w = Math.max(18, text.width + 5);
  const hh = Math.max(7, text.height + 2.5);
  const board = scene.add.graphics();
  board.fillStyle(0x8f563b, 1).fillRect(x - w / 2 + 2, y + hh / 2, 1.2, 5).fillRect(x + w / 2 - 3.2, y + hh / 2, 1.2, 5);
  board.fillStyle(0x5a3420, 1).fillRoundedRect(x - w / 2 - 0.6, y - hh / 2 - 0.6, w + 1.2, hh + 1.2, 1.5);
  board.fillStyle(0xf4ecd8, 1).fillRoundedRect(x - w / 2, y - hh / 2, w, hh, 1.2);
  return [board, text];
}

/** Жизнь двора: бабочки над грядками, воробей на заборе, капли из лейки; в лёгкой графике и зимой — тихо. */
function life(scene: StoreScene, yard: { x: number; y: number; w: number; h: number }, snow: boolean, ripe: boolean): Phaser.GameObjects.GameObject[] {
  if (scene.lite) return [];
  const out: Phaser.GameObjects.GameObject[] = [];
  const { x, y, w } = yard;
  if (!snow) {
    for (let i = 0; i < 3; i++) {
      const fly = scene.add.rectangle(x + 30 + i * 34, y + 26 + (i % 2) * 8, 1.6, 1.2, [0xfee761, 0xf4f8ff, 0xf6757a][i]);
      scene.tweens.add({ targets: fly, x: fly.x + 16 - i * 9, y: fly.y - 9, duration: 2100 + i * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: fly, scaleX: 0.3, duration: 130, yoyo: true, repeat: -1 });
      out.push(fly);
    }
    // Лейка у бочки «поливает», пока не созрело: капли по дуге.
    if (!ripe)
      for (let i = 0; i < 3; i++) {
        const drop = scene.add.rectangle(x + w - 21, y + 18, 0.9, 1.4, 0x9cd8ff).setAlpha(0);
        scene.tweens.add({ targets: drop, x: drop.x - 5 - i * 1.5, y: drop.y + 7, alpha: { from: 0.95, to: 0 }, duration: 620, repeat: -1, delay: i * 210, repeatDelay: 1500, ease: 'Quad.easeIn' });
        out.push(drop);
      }
  }
  // Воробей прыгает по верхней перекладине заднего забора.
  const bird = scene.add.container(x + 44, y - 5.5, [scene.add.ellipse(0, 0, 3.2, 2.4, 0x8f563b), scene.add.rectangle(1.6, -0.6, 1.2, 1.2, 0x5a3420), scene.add.rectangle(2.5, -0.4, 0.8, 0.5, 0xfeae34)]);
  scene.tweens.add({ targets: bird, x: x + 96, duration: 5200, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [9], hold: 900, repeatDelay: 700 });
  scene.tweens.add({ targets: bird, y: y - 7, duration: 260, yoyo: true, repeat: -1, repeatDelay: 320 });
  out.push(bird);
  return out;
}

const leftText = (ms: number): string => {
  const minutes = Math.ceil(ms / 60_000);
  return t('garden.left', { h: Math.floor(minutes / 60), m: minutes % 60 });
};

/** Нажали на двор: созрело — урожай на склад, нет — сколько ещё расти. */
function tapGarden(scene: StoreScene, x: number, y: number): void {
  // В гостях (свой магазин не сохраняется) двор только смотрят.
  if (savingPaused()) {
    scene.popup(x, y - 4, '🌱', '#d8f0d8');
    return;
  }
  const now = Date.now();
  const done = harvest(scene.state, now);
  if (!done) {
    const beds = bedsOf(scene.state);
    scene.popup(x, y - 4, gardenRipe(scene.state, now) ? t('garden.noRoom') : leftText(Math.min(...beds.map((bed) => bedLeft(bed, now)))), '#d8f0d8');
    return;
  }
  scene.state = done.state;
  saveGame(scene.state);
  sound.tap();
  scene.popup(x, y - 4, t('garden.got', { list: done.got.map(({ id, qty }) => `${PRODUCTS[id].icon}×${qty}`).join(' ') }), '#d8f0d8');
  building.refreshWarehouse(scene);
  if (scene.gardenAt) buildGarden(scene, scene.gardenAt.next, scene.gardenAt.top);
}

/** Раз в несколько секунд: урожай подрос, собран из меню или вскопали новую грядку — перерисовать двор. */
export function tickGarden(scene: StoreScene): void {
  if (!scene.gardenAt) return;
  const look = `${gardenLook(scene.state, Date.now())}|${gardenVisible(scene.state) ? 1 : 0}`;
  if (look !== scene.builtGarden) buildGarden(scene, scene.gardenAt.next, scene.gardenAt.top);
}

/** Кнопка «🌱»: показать двор — камера плавно отходит к нему и через несколько секунд возвращается домой. */
export function showYard(scene: StoreScene): void {
  if (inZar(scene.state) || !gardenVisible(scene.state)) return;
  const cam = scene.cameras.main;
  const at = yardFocus(scene);
  scene.dragged = false;
  cam.pan(at.x, at.y, 600, 'Sine.easeInOut', true);
  cam.zoomTo(scene.baseZoom, 600, 'Sine.easeInOut', true);
  camera.scheduleHome(scene, 6000);
}
