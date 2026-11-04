// Пиксельные эффекты pixelfx (MIT, NOTICE.md), запечённые в кадры атласа (scripts/fx-bake.mjs, fxSheets.ts):
// рябь на лужах, светлячки, монетка и её всплеск у счётчика, конфетти, салют. Вживую pixelfx не работает —
// здесь только спрайты-анимации из того же листа атласа, что и весь мир (без лишних текстур и вызовов
// отрисовки). В лёгкой графике и при «меньше движения» в системе — не играют (calm): там прежние эффекты.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { ART, LIGHT_DEPTH } from './common';
import { FX_SHEETS, fxFrames, type FxKey } from './fxSheets';

/**
 * Свой генератор случайностей для картинки: эффекты не берут числа из общего Math.random, которым
 * живёт день (покупатели, события), — иначе лишняя рябь на луже меняла бы, кто зайдёт в магазин.
 */
const look = new Phaser.Math.RandomDataGenerator(['pixelfx']);

/** Анимация эффекта в Phaser: 'fx:<эффект>'. */
const animKey = (key: FxKey): string => `fx:${key}`;

/** Система просит меньше движения (prefers-reduced-motion). */
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Пиксельные эффекты не играют: лёгкая графика, меньше движения или кадров нет (лист не догрузился). */
export function calm(scene: StoreScene): boolean {
  return scene.lite || reducedMotion() || !scene.textures.exists(`fx_ripple_0`);
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
export function play(scene: StoreScene, key: FxKey, x: number, y: number, o: PlayOpts = {}): Phaser.GameObjects.Sprite {
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
