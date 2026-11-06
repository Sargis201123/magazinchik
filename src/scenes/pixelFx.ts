// Пиксельные эффекты pixelfx (MIT, NOTICE.md), запечённые в кадры атласа (scripts/fx-bake.mjs, fxSheets.ts):
// рябь на лужах, светлячки, монетка и её всплеск у счётчика, конфетти, салют. Вживую pixelfx не работает —
// здесь только спрайты-анимации из того же листа атласа, что и весь мир (без лишних текстур и вызовов
// отрисовки). В лёгкой графике и при «меньше движения» в системе — не играют (calm): там прежние эффекты.

import Phaser from 'phaser';
import atlas from 'virtual:atlas';
import { assetUrl, png } from '../platform/assets';
import { spreadSheet } from './sheetFrames';
import type { StoreScene } from './StoreScene';
import { ART, LIGHT_DEPTH } from './common';
import { FX_SHEETS, fxFrames, type FxKey } from './fxSheets';

/**
 * Свой генератор случайностей для картинки: эффекты не берут числа из общего Math.random, которым
 * живёт день (покупатели, события), — иначе лишняя рябь на луже меняла бы, кто зайдёт в магазин.
 */
const look = new Phaser.Math.RandomDataGenerator(['pixelfx']);

/**
 * Чему можно сыграть эффект: любой сцене с лёгкой графикой и скоростью дня — магазину и ферме
 * (src/farm/FarmScene.ts). Магазин подходит целиком.
 */
export type FxScene = Phaser.Scene & { lite: boolean; speed: number };

/** Анимация эффекта в Phaser: 'fx:<эффект>'. */
const animKey = (key: FxKey): string => `fx:${key}`;

/** Система просит меньше движения (prefers-reduced-motion). */
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Пиксельные эффекты не играют: лёгкая графика, меньше движения или кадров нет (лист не догрузился). */
export function calm(scene: FxScene): boolean {
  if (scene.lite || reducedMotion()) return true;
  // Лист эффектов ещё не просили (графику переключили с лёгкой на полную) — попросить.
  if (!sheets) void loadSheets(scene);
  return !scene.textures.exists(`fx_ripple_0`);
}

let sheets: Promise<void> | null = null;

/**
 * Докачать листы эффектов (fx0…, scripts/atlas.ts — lazy): на заставке они не нужны, первая загрузка
 * без них легче. Пока лист в пути (или не дошёл), calm() — и всё играет по-старому. Один раз на игру;
 * ответ — обещание (e2e ждёт его, чтобы кадры не зависели от скорости сети).
 */
export function loadSheets(scene: Phaser.Scene): Promise<void> {
  if (sheets) return sheets;
  const lazy = atlas.pages.filter((p) => p.lazy && !scene.textures.exists(p.name));
  sheets = new Promise<void>((done) => {
    if (!lazy.length) return done();
    for (const page of lazy) scene.load.atlas(page.name, png(page.name), assetUrl(`assets/${page.name}.json`));
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const page of lazy) if (scene.textures.exists(page.name)) spreadSheet(scene.textures, page.name);
      done();
    });
    scene.load.start();
  });
  (window as unknown as { fxSheets?: Promise<void> }).fxSheets = sheets;
  return sheets;
}

/** Анимации эффектов — один раз на игру (общий менеджер анимаций). */
function ensureAnims(scene: Phaser.Scene): void {
  for (const key of Object.keys(FX_SHEETS) as FxKey[]) {
    if (scene.anims.exists(animKey(key))) continue;
    const s = FX_SHEETS[key];
    scene.anims.create({ key: animKey(key), frames: fxFrames(key).map((frame) => ({ key: frame })), frameRate: s.fps, repeat: s.loop ? -1 : 0 });
  }
}

interface PlayOpts {
  depth?: number;
  tint?: number;
  /** Петля начинается со случайного кадра: соседние светлячки и лужи не вспыхивают разом. */
  random?: boolean;
  flip?: boolean;
  /** Во сколько раз крупнее сетки рисунка (целое: точки остаются квадратиками ровной сетки). */
  zoom?: number;
}

/**
 * Эффект в точке мира: спрайт в сетке рисунка (точка эффекта — down точек рисунка, ART точек на точку мира).
 * Разовый эффект убирает себя сам по концу анимации; петлю — тот, кто её завёл.
 */
export function play(scene: FxScene, key: FxKey, x: number, y: number, o: PlayOpts = {}): Phaser.GameObjects.Sprite {
  ensureAnims(scene);
  const s = FX_SHEETS[key];
  const sprite = scene.add
    .sprite(x, y, `fx_${key}_0`)
    .setOrigin(s.ox, s.oy)
    .setScale((s.down * (o.zoom ?? 1)) / ART)
    .setFlipX(!!o.flip)
    .setDepth(o.depth ?? LIGHT_DEPTH + 5);
  if (s.blend === 'add') sprite.setBlendMode(Phaser.BlendModes.ADD);
  if (o.tint !== undefined) sprite.setTint(o.tint);
  sprite.play({ key: animKey(key), startFrame: o.random ? look.between(0, s.frames - 1) : 0 });
  // На ×2 твины и таймеры сцены идут вдвое быстрее (setSpeed) — кадры эффекта тоже, иначе конфетти
  // растает раньше, чем доиграет.
  sprite.anims.timeScale = scene.speed;
  if (!s.loop) sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  return sprite;
}

/** Цвета залпов салюта — из палитры игры (кадры салюта светлые, цвет даёт tint). */
const FIREWORK_TINTS = [0xe43b44, 0xfee761, 0x63c74d, 0x2ce8f5, 0xf6757a, 0xfeae34, 0xb55088, 0xffffff];

/**
 * Салют над улицей и кварталом напротив: в праздник (decorations.isNewYearSound — Новый год и последний
 * вечер летнего фестиваля), как стемнеет, и всю ночную смену — тогда же, когда его слышно (ambienceLayers.fireworksOn).
 * Залп раз в пару секунд, не больше трёх в небе разом. Без тряски камеры.
 */
export function updateFireworks(scene: StoreScene): void {
  const on = scene.newYearSound && scene.running && (scene.evening >= 0.35 || scene.night) && !calm(scene);
  const now = scene.time.now;
  if (!on) {
    scene.fireworkAt = 0;
    return;
  }
  scene.fireworks = scene.fireworks.filter((f) => f.active);
  if (!scene.fireworkAt) scene.fireworkAt = now + look.between(400, 1500);
  if (now < scene.fireworkAt || scene.fireworks.length >= 3) return;
  scene.fireworkAt = now + look.between(1300, 3600);
  const top = scene.next.h + 4;
  const x = look.between(-40, scene.next.w + 40);
  // Над дорогой и над кварталом за ней: там тёмное «небо» сверху вниз, не над залом.
  const y = look.between(top + 70, top + 260);
  const burst = play(scene, 'firework', x, y, { depth: LIGHT_DEPTH + 3, tint: look.pick(FIREWORK_TINTS) });
  scene.fireworks.push(burst);
}

/**
 * Разовый эффект награды в точке мира (поверх зала, без тряски камеры), вдвое крупнее сетки рисунка. fade — через сколько мс начать
 * гасить: у кусков петли (звезда, луч) нет своего конца. Ответ — сыграл ли (в лёгкой графике — нет).
 */
export function burst(scene: FxScene, key: FxKey, x: number, y: number, o: PlayOpts & { fade?: number } = {}): boolean {
  if (calm(scene)) return false;
  // Вдвое крупнее сетки рисунка, как конфетти: в сетку 1:1 награда на телефоне — пара точек (монетки пилота).
  const sprite = play(scene, key, x, y, { depth: LIGHT_DEPTH + 8, zoom: 2, ...o });
  if (o.fade !== undefined) scene.tweens.add({ targets: sprite, alpha: 0, delay: o.fade, duration: 300 });
  return true;
}

/** Что показать, когда магазин откроется: утро решает (гостинец, покупка за звёзды), а видно — уже в зале. */
export type OpenFx = 'chest' | 'beam';

/**
 * Утренние награды — в зале, когда камера подлетела (startDay → flyIn, 1,6 с): сундук бабушкиного
 * гостинца у входа (монеты рассыпаются по полу) и фиолетовый луч над хозяином за кассой — вещь за звёзды.
 */
export function openMoments(scene: StoreScene): void {
  const list = scene.openFx;
  scene.openFx = [];
  const { w, h, sellerHome } = scene.layout;
  list.forEach((fx, i) =>
    scene.time.delayedCall(1800 + i * 1400, () => {
      if (!scene.running) return;
      if (fx === 'chest') burst(scene, 'chest', w / 2, h - 30);
      else burst(scene, 'beam', sellerHome.x, sellerHome.y + 2, { fade: 900 });
    }),
  );
}
