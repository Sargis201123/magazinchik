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
import { BEDS_MAX, bedLeft, bedRipe, bedsOf, bedStage, gardenLook, gardenRipe, gardenVisible, harvest, hasGarden, type Bed } from '../game/garden';
import { yearTime } from '../game/calendar';
import { inZar } from '../game/zarshop';
import { saveGame, savingPaused } from '../game/save';
import { sound } from '../platform/sound';
import { UI_FONT } from '../ui/dom';
import { ART, randomLook } from './common';
import * as persons from './persons';
import { WING_OUTER, type Layout } from './layout';
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

/** Место грядки во дворе: первая — в теплице у калитки, вторая и третья — левее, под открытым небом (art/yard.py). */
const bedSpot = (yard: { x: number; y: number; w: number; h: number }, i: number): { x: number; y: number } => ({ x: yard.x + yard.w - 24 - i * 38, y: yard.y + (i === 0 ? 40 : 44) });
/** Дорожка двора (середина по высоте) и бочка с водой — куда огородник ходит за водой. */
const PATH_Y = 53;
const BARREL = { x: 37, y: 62 };

/** Убрать прежний двор (огородник остаётся — он ходит сам по себе). */
function clearYard(scene: StoreScene): void {
  // Бабочки, воробей и значки качаются бесконечными твинами — гасим их вместе с двором.
  scene.tweens.killTweensOf(scene.gardenObjs);
  for (const obj of scene.gardenObjs) obj.destroy();
  scene.gardenObjs = [];
}

/**
 * Поставить (или перерисовать) двор: зовётся при постройке улицы и когда грядка перешла на новую стадию.
 * 11.11 (просьба автора): двор нарисован пиксельными картинками (art/yard.py) — земля с сараем, пугалом,
 * подсолнухами, тачкой, бочкой и цветником; грядки-короба своей культуры на каждой стадии; стеклянная теплица;
 * передний забор с калиткой. По двору ходит огородник: поливает, рыхлит, ходит к бочке за водой.
 */
export function buildGarden(scene: StoreScene, next: Layout, top: number): void {
  clearYard(scene);
  scene.gardenAt = { next, top };
  const now = Date.now();
  scene.builtGarden = `${gardenLook(scene.state, now)}|${gardenVisible(scene.state) ? 1 : 0}`;
  if (inZar(scene.state) || !gardenVisible(scene.state)) {
    scene.gardener?.destroy();
    scene.gardener = undefined;
    return;
  }
  const yard = yardRect(next);
  const { x, y, w, h } = yard;
  const beds = bedsOf(scene.state);
  const snow = scene.weather === 'snow' || yearTime(scene.state.day) === 'winter';
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    scene.gardenObjs.push(obj);
    return obj;
  };
  // Дорожка от калитки вдоль флигеля к улице — по ней двор и находят.
  const laneX = x + w + 1;
  keep(scene.add.tileSprite(laneX, y + h - 14, 6, top - (y + h - 14), 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(y - 2));
  // Земля двора со всем хозяйством — под всем, что во дворе; передний забор — поверх (ниже по экрану).
  keep(scene.art(x, y, snow ? 'yard_ground_snow' : 'yard_ground').setOrigin(0).setDepth(y - 1));
  keep(scene.art(x, y + h - 8, 'yard_fence').setOrigin(0).setDepth(y + h));

  if (!hasGarden(scene.state)) {
    // Двор ждёт теплицу: колышки с бечёвкой на месте грядки и табличка.
    const spot = bedSpot(yard, 0);
    keep(scene.art(spot.x, spot.y, 'yard_bed_plot').setOrigin(0.5, 1).setDepth(spot.y));
    sign(scene, x + 66, y + 30, `🌱\n${t('garden.yard')}`).forEach((o, k) => keep((o as Phaser.GameObjects.Graphics).setDepth(y + 36 + k * 0.1)));
    keep(
      scene.add
        .zone(x + w / 2, y + h / 2, w, h)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => camera.tap(scene, () => scene.popup(x + w / 2, y + 16, t('garden.empty'), '#d8f0d8'))),
    );
    scene.gardener?.destroy();
    scene.gardener = undefined;
    return;
  }

  // Грядки: первая — в теплице, остальные под открытым небом; невскопанные — колышками с бечёвкой.
  let ripeAt: { x: number; y: number } | undefined;
  for (let i = 0; i < BEDS_MAX; i++) {
    const spot = bedSpot(yard, i);
    const bed: Bed | undefined = beds[i];
    if (!bed) {
      keep(scene.art(spot.x, spot.y, 'yard_bed_plot').setOrigin(0.5, 1).setDepth(spot.y));
      continue;
    }
    const stage = bedStage(bed, now);
    const cold = snow && i > 0 ? '_snow' : '';
    keep(scene.art(spot.x, spot.y, `yard_bed_${bed.crop}_${stage}${cold}`).setOrigin(0.5, 1).setDepth(spot.y));
    const roof = i === 0 ? spot.y - 30 : spot.y - (bed.crop === 'quick' ? 14 : 22);
    if (i === 0) keep(scene.art(spot.x, spot.y + 1, 'yard_greenhouse').setOrigin(0.5, 1).setDepth(spot.y + 0.5));
    if (stage === 3) {
      ripeAt ??= { x: spot.x, y: roof };
      // Созрело: значок над грядкой покачивается — нажми и собери.
      const mark = keep(
        scene.add
          .container(spot.x, roof - 6, [
            scene.add.circle(0, 0, 4.2, 0xfee761).setStrokeStyle(0.8, 0x2b2233),
            scene.add.text(0, 0, '!', { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#2b2233' }).setOrigin(0.5).setResolution(scene.textRes(4)),
          ])
          .setDepth(y + h + 2),
      );
      if (!scene.lite) scene.tweens.add({ targets: mark, y: roof - 9, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 180 });
    }
  }
  // Табличка у калитки, над дорожкой.
  sign(scene, x + w - 15, y + h - 23, t('garden.yard')).forEach((o, k) => keep((o as Phaser.GameObjects.Graphics).setDepth(y + h - 16 + k * 0.1)));
  life(scene, yard, snow).forEach(keep);

  const tapAt = ripeAt ?? { x: bedSpot(yard, 0).x, y: y + 12 };
  keep(
    scene.add
      .zone(x + w / 2, y + h / 2 - 4, w, h + 8)
      .setInteractive({ useHandCursor: true })
      .setDepth(y + h + 1)
      .on('pointerup', () => camera.tap(scene, () => tapGarden(scene, tapAt.x, tapAt.y))),
  );
  if (!scene.lite && !scene.gardener?.active) void gardener(scene, yard);
}

/** Огородник — бабушкин сосед-пенсионер: нанимать не нужно, приходит сам. В соломенной шляпе, комбинезоне, с бородой. */
const GARDENER_LOOK = { hat: 'straw', hatTint: 0xfee761, outfit: 'overalls', outfitTint: 0x3b5dc9, face: 'beard', faceTint: 0xc0cbdc, hair: 0xc0cbdc } as const;

/**
 * Огородник ходит по двору: к грядке — поливает из лейки или рыхлит тяпкой, иногда к бочке за водой, иногда
 * отдыхает у сарая. Шагает по дорожке, как все люди. Живёт, пока стоит мир (перестройка мира его убирает).
 */
async function gardener(scene: StoreScene, yard: { x: number; y: number; w: number; h: number }): Promise<void> {
  const world = scene.worldGen;
  const man = persons.makePerson(scene, yard.x + 60, yard.y + PATH_Y, { ...randomLook(0x3e8948), ...GARDENER_LOOK });
  scene.gardener = man;
  const alive = () => man.active && scene.worldGen === world && scene.gardener === man;
  const go = async (tx: number, ty: number) => {
    // По дорожке: сначала на неё, вдоль, потом к цели.
    await persons.walkVia(scene, man, [
      { x: man.x, y: yard.y + PATH_Y },
      { x: tx, y: yard.y + PATH_Y },
      { x: tx, y: ty },
    ]);
  };
  while (alive()) {
    const beds = bedsOf(scene.state);
    const roll = Math.random();
    if (beds.length && roll < 0.7) {
      const i = Phaser.Math.Between(0, beds.length - 1);
      const spot = bedSpot(yard, i);
      // Перед грядкой; к теплице — у её двери справа.
      await go(spot.x + (i === 0 ? 18 : Phaser.Math.Between(-9, 9)), spot.y + 6);
      if (!alive()) return;
      persons.setFacing(man, i === 0 ? 'left' : 'up');
      const now = Date.now();
      if (bedRipe(beds[i], now)) {
        // Спелое не трогает — оглядывается, будто зовёт собрать.
        persons.setFacing(man, 'down');
        await scene.wait(1800);
      } else if (Math.random() < 0.6) await water(scene, man);
      else await weed(scene, man);
    } else if (roll < 0.85) {
      await go(yard.x + BARREL.x + 8, yard.y + BARREL.y);
      if (!alive()) return;
      persons.setFacing(man, 'left');
      await scene.wait(1500);
    } else {
      // Передохнуть у сарая.
      await go(yard.x + 34, yard.y + 34);
      if (!alive()) return;
      persons.setFacing(man, 'down');
      await scene.wait(3000);
    }
    if (alive()) await scene.wait(600);
  }
}

/** Полить: в руке лейка, наклон, из носика — капли. */
async function water(scene: StoreScene, man: Phaser.GameObjects.Container): Promise<void> {
  const can = scene.art(5, 1, 'yard_can');
  man.add(can);
  const spout = { x: man.x + 9, y: man.y - 1 };
  for (let k = 0; k < 6; k++) {
    const drop = scene.add.rectangle(spout.x, spout.y, 0.8, 1.4, 0x9cd8ff).setDepth(man.depth + 1);
    scene.tweens.add({ targets: drop, x: spout.x + 1.5 + (k % 3), y: spout.y + 5, alpha: { from: 0.95, to: 0 }, duration: 520, delay: k * 260, ease: 'Quad.easeIn', onComplete: () => drop.destroy() });
  }
  scene.tweens.add({ targets: can, angle: 25, duration: 300, yoyo: true, hold: 1200 });
  await scene.wait(1900);
  if (can.active) can.destroy();
}

/** Порыхлить: тяпка вверх-вниз, из-под неё — комочки земли. */
async function weed(scene: StoreScene, man: Phaser.GameObjects.Container): Promise<void> {
  const hoe = scene.art(4, -1, 'yard_hoe');
  man.add(hoe);
  scene.tweens.add({ targets: hoe, y: 1.5, angle: 12, duration: 260, yoyo: true, repeat: 3 });
  for (let k = 0; k < 4; k++) {
    const clod = scene.add.rectangle(man.x + 5, man.y + 3, 1, 1, 0x733e39).setDepth(man.depth + 1);
    scene.tweens.add({ targets: clod, x: clod.x + Phaser.Math.Between(-2, 3), y: clod.y - 2, alpha: { from: 1, to: 0 }, duration: 380, delay: 260 + k * 520, yoyo: false, onComplete: () => clod.destroy() });
  }
  await scene.wait(2200);
  if (hoe.active) hoe.destroy();
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

/** Жизнь двора: бабочки над грядками, воробей на заборе; в лёгкой графике — тихо, зимой без бабочек. */
function life(scene: StoreScene, yard: { x: number; y: number; w: number; h: number }, snow: boolean): Phaser.GameObjects.GameObject[] {
  if (scene.lite) return [];
  const out: Phaser.GameObjects.GameObject[] = [];
  const { x, y } = yard;
  if (!snow) {
    for (let i = 0; i < 3; i++) {
      const fly = scene.add.rectangle(x + 30 + i * 34, y + 26 + (i % 2) * 8, 1.6, 1.2, [0xfee761, 0xf4f8ff, 0xf6757a][i]).setDepth(y + 46);
      scene.tweens.add({ targets: fly, x: fly.x + 16 - i * 9, y: fly.y - 9, duration: 2100 + i * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: fly, scaleX: 0.3, duration: 130, yoyo: true, repeat: -1 });
      out.push(fly);
    }
  }
  // Воробей прыгает по верхней перекладине заднего забора.
  const bird = scene.add.container(x + 44, y - 0.5, [scene.add.ellipse(0, 0, 3.2, 2.4, 0x8f563b), scene.add.rectangle(1.6, -0.6, 1.2, 1.2, 0x5a3420), scene.add.rectangle(2.5, -0.4, 0.8, 0.5, 0xfeae34)]).setDepth(y + 1);
  scene.tweens.add({ targets: bird, x: x + 96, duration: 5200, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [9], hold: 900, repeatDelay: 700 });
  scene.tweens.add({ targets: bird, y: y - 2, duration: 260, yoyo: true, repeat: -1, repeatDelay: 320 });
  out.push(bird);
  return out;
}

const leftText = (ms: number): string => {
  const minutes = Math.ceil(ms / 60_000);
  return t('garden.left', { h: Math.floor(minutes / 60), m: minutes % 60 });
};

/** Нажали на двор: созрело — урожай на прилавок, нет — сколько ещё расти. */
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
  scene.refreshShelves();
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
