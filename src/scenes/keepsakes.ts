// Памятные вещи первых дней новичка (game/firstday.ts): первая выручка в рамке на стене и бабушкина
// шкатулка за прилавком — со второго утра заперта с запиской, на четвёртое утро открывается.
// Здесь — как они выглядят и что делают по касанию; правила и награда — в firstday.ts.

import type { StoreScene } from './StoreScene';
import { saveGame } from '../game/save';
import { BOX_COINS, BOX_OPENS_DAY, firstCoin, grannyBox, openGrannyBox } from '../game/firstday';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { track } from '../platform/analytics';
import { grannyBoxCard } from '../ui/onboarding';
import { activeDecor } from '../game/decor';
import { LIGHT_DEPTH } from './common';
import * as camera from './camera';
import * as shelves from './shelves';
import * as effects from './effects';
import * as pixelFx from './pixelFx';

/** Полуширина рамки на стене (в мире) и высота её середины — чуть выше плакатов: щиток висит ниже. */
const FRAME_HALF = 5;
const FRAME_Y = 8;
/** Полуширина плаката и окна на стене (окно 14 точек в мире), часов и неона. */
const POSTER_HALF = 7;

/**
 * Место на задней стене: рядом с плакатом или окном (они через 64 точки с x = 30) или между ними,
 * не за полкой, не на часах и не на двери туалета; из подходящих — ближе к кассе. Нет места — null.
 */
export function frameSpot(scene: StoreScene): number | null {
  const { wc, counter } = scene.layout;
  // Доска почёта шире плаката: пока она есть, держимся от всех мест плакатов подальше.
  const posterHalf = scene.state.career?.plaques?.length ? 13 : POSTER_HALF;
  const clockHalf = activeDecor(scene.state, 'neon') ? 15 : 4;
  const clear = (x: number): boolean => {
    if (x - FRAME_HALF < 4 || x + FRAME_HALF > wc.x - 10) return false;
    if (shelves.behindShelf(scene, x, FRAME_HALF)) return false;
    if (Math.abs(x - 62) < FRAME_HALF + clockHalf + 1) return false;
    for (let p = 30; p < wc.x; p += 64) if (Math.abs(x - p) < FRAME_HALF + posterHalf + 1) return false;
    return true;
  };
  const spots: number[] = [];
  for (let p = 30; p < wc.x; p += 64) spots.push(p - 13, p + 13, p + 32);
  return spots.filter(clear).sort((a, b) => Math.abs(a - counter.x) - Math.abs(b - counter.x))[0] ?? null;
}

/** Шкатулка стоит на полу у стены, под рамкой — «уголок памяти»; рамки нет — у двери туалета. */
function boxSpot(scene: StoreScene): { x: number; y: number } {
  const { wc, wallH } = scene.layout;
  return { x: frameSpot(scene) ?? wc.x - 20, y: wallH + 9 };
}

/** Рамка с монетой: касание — когда и сколько. */
function hangFrame(scene: StoreScene, x: number, sum: number): Phaser.GameObjects.Image {
  const frame = scene.art(x, FRAME_Y, 'coin_frame').setDepth(1);
  frame.setInteractive({ useHandCursor: true }).on('pointerup', () =>
    camera.tap(scene, () => {
      haptic.tap();
      scene.popup(x, FRAME_Y + 12, t('keep.frame', { n: sum }), '#fee761');
    }),
  );
  return frame;
}

/** Шкатулка: заперта — записка; пора — открыть. */
function placeBox(scene: StoreScene, state: 'locked' | 'ready'): void {
  const { x, y } = boxSpot(scene);
  const box = scene.art(x, y, 'granny_box').setOrigin(0.5, 1).setDepth(y);
  box.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => tapBox(scene, box)));
  scene.keepBox = box;
  if (state !== 'ready' || pixelFx.calm(scene)) return;
  // Пора открывать: шкатулка подпрыгивает и поблёскивает, пока её не откроют.
  scene.tweens.add({ targets: box, y: y - 2, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1400, ease: 'Quad.easeOut' });
  const glint = scene.time.addEvent({
    delay: 1640,
    loop: true,
    callback: () => {
      if (box.active && grannyBox(scene.state) === 'ready') pixelFx.burst(scene, 'star', x, y - 10, { zoom: 0.6, fade: 200 });
    },
  });
  box.once('destroy', () => glint.remove());
}

function tapBox(scene: StoreScene, box: Phaser.GameObjects.Image): void {
  const state = grannyBox(scene.state);
  if (state === 'locked') {
    haptic.tap();
    sound.tap();
    if (!scene.lite) scene.tweens.add({ targets: box, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => box.setAngle(0) });
    scene.popup(box.x, box.y - 16, t('keep.boxLocked', { day: BOX_OPENS_DAY }), '#ffe6a0');
    return;
  }
  if (state !== 'ready') return;
  scene.state = openGrannyBox(scene.state);
  saveGame(scene.state);
  track('onb_box', scene.state.day, scene.sincePlay());
  scene.tweens.killTweensOf(box);
  box.setTexture('granny_box_open').setY(boxSpot(scene).y);
  haptic.success();
  sound.fanfare();
  if (!pixelFx.calm(scene)) {
    pixelFx.burst(scene, 'star', box.x, box.y - 10, { zoom: 1, fade: 300 });
    pixelFx.play(scene, 'coinpop', box.x, box.y - 8, { depth: LIGHT_DEPTH + 6 });
  }
  effects.flyCoins(scene, box.x, box.y - 6, 6);
  scene.hud.update(scene.state, scene.timeLeft);
  // Посреди дня окно держит время: покупатели не уходят, пока читаешь записку.
  const wasPaused = scene.time.paused;
  scene.time.paused = true;
  grannyBoxCard(BOX_COINS, () => {
    scene.time.paused = wasPaused;
  });
}

/** Поставить памятные вещи заново (после перестройки зала и утром: шкатулка появилась, открылась, убрана). */
export function buildKeepsakes(scene: StoreScene): void {
  scene.keepsakeObjs.forEach((o) => o.destroy());
  scene.keepsakeObjs = [];
  scene.keepBox = undefined;
  const sum = firstCoin(scene.state);
  const x = sum ? frameSpot(scene) : null;
  if (sum && x !== null) scene.keepsakeObjs.push(hangFrame(scene, x, sum));
  const box = grannyBox(scene.state);
  if (box) {
    placeBox(scene, box);
    if (scene.keepBox) scene.keepsakeObjs.push(scene.keepBox);
  }
}

/**
 * Первая продажа: монета летит с кассы на стену и встаёт в рамку. В лёгкой графике — рамка просто появляется.
 * Вызывается, когда сумма уже записана (firstday.ts frameFirstCoin).
 */
export function hangFirstCoin(scene: StoreScene, fromX: number, fromY: number): void {
  const sum = firstCoin(scene.state);
  const x = sum ? frameSpot(scene) : null;
  if (!sum || x === null) return;
  const frame = hangFrame(scene, x, sum);
  scene.keepsakeObjs.push(frame);
  if (pixelFx.calm(scene)) return;
  const scale = frame.scaleX;
  frame.setScale(0);
  const coin = scene.art(fromX, fromY - 10, 'coin').setDepth(LIGHT_DEPTH + 6);
  scene.tweens.add({
    targets: coin,
    x,
    y: FRAME_Y,
    // После печати «Первая выручка» (она гаснет через 2,6 с), чтобы не наслаивались.
    delay: 2500,
    duration: 800,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      coin.destroy();
      if (!frame.active) return;
      scene.tweens.add({ targets: frame, scale, duration: 320, ease: 'Back.easeOut' });
      pixelFx.burst(scene, 'star', x, FRAME_Y, { zoom: 0.8, fade: 250 });
      scene.popup(x, FRAME_Y + 12, t('keep.frameNew'), '#fee761');
    },
  });
}
