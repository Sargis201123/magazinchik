// Сезонные недели в мире (game/weeks.ts): лотки урожая с фермером и тыквами, стол конкурса пирогов,
// баннер «−20%» и вечерняя распродажа, бумажные фонарики, уличные музыканты и салют в последний вечер
// фестиваля. Перерисовывается каждое утро (неделя начинается и кончается без смены погоды) — как
// ярмарка в decorations.ts applyFair. В лёгкой графике всё стоит неподвижно: без качания, нот и салюта.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS } from '../game/economy';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { track } from '../platform/analytics';
import { isFairDay } from '../game/fair';
import { FIREWORKS_DAY, PIE_CONTEST_DAY, SALE_CROWD, SALE_EVENING, saleOn, startSale, WEEKS, weekFor, type WeekId } from '../game/weeks';
import { UI_FONT } from '../ui/dom';
import { FACADE_H, LIGHT_DEPTH, randomLook, type Look } from './common';
import * as lighting from './lighting';
import * as persons from './persons';

/** Цвета бумажных фонариков фестиваля. */
const LANTERN_COLORS = [0xe43b44, 0xfeae34, 0xfee761, 0x63c74d, 0x2ce8f5, 0xf6757a];
/** Реплики фермера у лотка и сколько их (week.farmer.N). */
const FARMER_LINES = 4;

/** Сегодня последний вечер фестиваля — салют (и его звук за окном, decorations.isNewYearSound). */
export const fireworksToday = (day: number): boolean => {
  const w = weekFor(day);
  return w?.id === 'summer' && w.n === FIREWORKS_DAY;
};

/** Убрать вчерашнее: картинки, людей у лотков, их повторы. */
function clearWeek(scene: StoreScene): void {
  scene.tweens.killTweensOf(scene.weekObjs);
  for (const obj of scene.weekObjs) obj.destroy();
  scene.weekObjs = [];
  for (const stop of scene.weekTimers.splice(0)) stop();
  scene.weekSign = undefined;
  // Огни уничтоженных вещей больше не зажигаем.
  scene.nightLights = scene.nightLights.filter((light) => light.obj.active);
}

/** Украшения недели: каждое утро и при перестройке мира (buildWorld). */
export function applyWeek(scene: StoreScene): void {
  clearWeek(scene);
  const w = weekFor(scene.state.day);
  if (!w) return;
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    scene.weekObjs.push(obj);
    return obj;
  };
  if (w.id === 'harvest') harvest(scene, w.n, keep);
  else if (w.id === 'sale') sale(scene, keep);
  else summer(scene, w.n, keep);
}

type Keep = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

/** Повтор, который умрёт и с утренней сменой недели, и с перестройкой мира. */
function every(scene: StoreScene, delay: number, callback: () => void): void {
  scene.weekTimers.push(scene.worldTimer(delay, callback));
}

/** Человечек-декорация у лотка или на тротуаре: стоит, слегка покачивается (не в лёгкой графике). */
function standing(scene: StoreScene, x: number, y: number, look: Look, keep: Keep, facing: 'left' | 'right' | 'down' = 'down'): Phaser.GameObjects.Container {
  const who = keep(persons.makePerson(scene, x, y, look).setDepth(y + 6));
  if (facing !== 'down') persons.setFacing(who, facing);
  if (!scene.lite) scene.tweens.add({ targets: who, y: y - 0.6, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return who;
}

/** Тёплый свет вечером (на земле — через карту освещения). */
function warmLight(scene: StoreScene, x: number, y: number, size: number, tint: number, keep: Keep): void {
  keep(lighting.nightGlow(scene, scene.art(x, y, 'glow').setScale(size / 64).setTint(tint), 0.8, undefined, { map: { scale: 2.2, gain: 0.7, haze: 0.6 } }));
}

/**
 * «Ярмарка урожая»: два лотка с тыквами и яблоками по сторонам от входа, сено и тыквы у двери,
 * фермер за левым лотком приговаривает. На четвёртый день — стол конкурса пирогов.
 */
function harvest(scene: StoreScene, n: number, keep: Keep): void {
  const { door, h } = scene.layout;
  const front = h + FACADE_H;
  // В день обычной ярмарки слева стоит её лоток — тогда наш только справа.
  const sides = isFairDay(scene.state.day) ? [1] : [-1, 1];
  for (const side of sides) {
    const at = { x: door.x + side * 60, y: front + 14 };
    keep(scene.art(at.x, at.y, 'week_stall').setOrigin(0.5, 1).setFlipX(side > 0).setDepth(at.y));
    warmLight(scene, at.x, at.y - 14, 26, 0xffc070, keep);
  }
  for (const dx of [-21, 19]) keep(scene.art(door.x + dx, front + 5, 'pumpkin').setDepth(front + 8));
  keep(scene.art(door.x - 33, front + 9, 'week_hay').setDepth(front + 9));
  // Фермер — сбоку от своего лотка, со стороны двери (за навесом его было бы не видно): слева,
  // а в день ярмарки — у правого.
  const side = sides[0];
  const farmer = standing(scene, door.x + side * 46, front + 8, { ...randomLook(0x6abe30), hat: 'straw', hatTint: 0xfee761, outfit: 'overalls', outfitTint: 0x3b5dc9, prop: 'basket', propTint: 0xb86f50, hair: 0x8f563b }, keep, side < 0 ? 'right' : 'left');
  if (!scene.lite) {
    let line = Math.floor(Math.random() * FARMER_LINES);
    every(scene, 9000, () => {
      if (!scene.running || scene.night || !farmer.active) return;
      line = (line + 1) % FARMER_LINES;
      scene.popup(farmer.x, farmer.y - 20, t(`week.farmer.${line + 1}` as TextKey), '#fee761');
    });
  }
  if (n === PIE_CONTEST_DAY) {
    // Справа от правого лотка: слева у большого магазина стоит мусорный бак.
    const at = { x: door.x + 96, y: front + 16 };
    keep(scene.art(at.x, at.y, 'week_pietable').setOrigin(0.5, 1).setDepth(at.y));
    keep(scene.add.text(at.x, at.y - 22, t('week.pieContest'), { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761', stroke: '#181425', strokeThickness: 2 }).setOrigin(0.5).setResolution(scene.textRes(4)).setDepth(at.y + 1));
    warmLight(scene, at.x, at.y - 8, 22, 0xffd27a, keep);
  }
}

/** «Ночь распродаж»: баннер «−20%» над витриной; вечером он светится неоном. */
function sale(scene: StoreScene, keep: Keep): void {
  const { door, h } = scene.layout;
  const at = { x: door.x - 46, y: h + FACADE_H / 2 + 1 };
  keep(scene.art(at.x, at.y, 'week_sale_banner').setDepth(h + 44));
  // Неоновая надпись — поверх темноты вечером (сама картинка днём — красный баннер).
  const glow = keep(lighting.nightGlow(scene, scene.art(at.x, at.y, 'glow').setDisplaySize(52, 22).setTint(0xff4060), 0.5, Math.random() * 1000, { map: { scale: 1.2, gain: 1.2, haze: 0.4 } }));
  scene.weekSign = glow;
  // Флажки-ценники по краю крыши.
  const colors = [0xe43b44, 0xffffff, 0xfee761];
  const { w } = scene.layout;
  for (let x = -6, i = 0; x < w + 6; x += 9, i++) {
    const tag = keep(scene.add.rectangle(x, h + 3.5, 4, 3, colors[i % colors.length]).setDepth(h + 43));
    if (!scene.lite) scene.tweens.add({ targets: tag, angle: { from: -8, to: 8 }, duration: 700 + (i % 3) * 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

/**
 * «Летний фестиваль»: гирлянда бумажных фонариков над тротуаром, музыканты слева от входа (ноты над
 * ними), в последний вечер — салют над крышей.
 */
function summer(scene: StoreScene, n: number, keep: Keep): void {
  const { door, h, w } = scene.layout;
  const front = h + FACADE_H;
  let i = 0;
  for (let x = -14; x <= w + 14; x += 14, i++) {
    const y = front + 2 + (i % 2);
    const color = LANTERN_COLORS[i % LANTERN_COLORS.length];
    const lantern = keep(scene.art(x, y, 'week_lantern').setTint(color).setOrigin(0.5, 0).setDepth(front + 40));
    if (!scene.lite) scene.tweens.add({ targets: lantern, angle: { from: -5, to: 5 }, duration: 900 + (i % 4) * 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Свет — у каждого второго: и так светло, а огней на кадр меньше.
    if (i % 2 === 0) keep(lighting.nightGlow(scene, scene.art(x, y + 4, 'glow').setScale(14 / 64).setTint(color), 0.7, undefined, { twinkle: scene.lite ? undefined : i }));
  }
  // Музыканты — на тротуаре слева от входа, смотрят на улицу.
  const y = front + 12;
  const players: Look[] = [
    { ...randomLook(0xe43b44), back: 'guitar', backTint: 0x8f563b, hat: 'beret', hatTint: 0x262b44 },
    { ...randomLook(0xfee761), prop: 'trumpet', propTint: 0xfeae34, hat: 'sunhat', hatTint: 0xf6757a },
    { ...randomLook(0x0099db), prop: 'drum', propTint: 0xe43b44 },
  ];
  const band = players.map((look, k) => standing(scene, door.x - 30 - k * 11, y + (k % 2) * 2, look, keep));
  if (!scene.lite) {
    every(scene, 1700, () => {
      if (!scene.running) return;
      const who = Phaser.Utils.Array.GetRandom(band);
      if (!who?.active) return;
      // Нота живёт полторы секунды и убирает себя сама — в список вещей недели её не кладём.
      const note = scene.add.text(who.x + 3, who.y - 16, Phaser.Utils.Array.GetRandom(['♪', '♫']), { fontFamily: UI_FONT, fontSize: '8px', color: '#fee761', stroke: '#181425', strokeThickness: 2 }).setOrigin(0.5).setResolution(scene.textRes(4)).setDepth(LIGHT_DEPTH + 3);
      scene.tweens.add({ targets: note, y: note.y - 10, x: note.x + 4, alpha: 0, duration: 1400, onComplete: () => note.destroy() });
    });
  }
  if (n === FIREWORKS_DAY && !scene.lite) {
    every(scene, 1100, () => {
      // Салют — когда стемнеет (последняя четверть дня) и в ночную смену.
      if (!scene.running || (scene.evening < 0.3 && !scene.night)) return;
      // Над улицей перед магазином: в домашнем кадре её видно целиком, и HUD её не закрывает.
      burst(scene, Phaser.Math.Between(10, w - 10), Phaser.Math.Between(front + 24, Math.max(front + 30, scene.streetY + 24)));
    });
  }
}

/** Залп салюта: искры разлетаются кругом и гаснут (своё облако частиц, через секунду убираем). */
function burst(scene: StoreScene, x: number, y: number): void {
  const tint = Phaser.Utils.Array.GetRandom(LANTERN_COLORS);
  const sparks = scene.add.particles(x, y, 'spark', {
    speed: { min: 26, max: 52 },
    lifespan: 1000,
    gravityY: 18,
    scale: { start: 1, end: 0 },
    tint: [tint, 0xffffff],
    quantity: 22,
    emitting: false,
    blendMode: Phaser.BlendModes.ADD,
  });
  sparks.setDepth(LIGHT_DEPTH + 4).explode(22);
  scene.time.delayedCall(1200, () => sparks.destroy());
}

// ---------------------------------------------------------------- день

/** Утром: надпись недели над залом и событие в аналитику. */
export function morning(scene: StoreScene): void {
  const w = weekFor(scene.state.day);
  if (!w) return;
  const week = WEEKS[w.id];
  track('week_day', scene.state.day, w.n + 10 * idIndex(w.id));
  // Ярмарка и сезон говорят в 600 мс — неделя чуть позже, чтобы надписи не легли друг на друга.
  scene.time.delayedCall(1800, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2, `${week.icon} ${t(week.nameKey)} · ${t('week.dayOf', { n: w.n, total: 7 })}`, '#fee761'));
  if (w.id === 'harvest' && w.n === PIE_CONTEST_DAY) scene.time.delayedCall(3000, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2 + 14, t('week.pieToday'), '#fee761'));
  if (w.id === 'summer' && w.n === FIREWORKS_DAY) scene.time.delayedCall(3000, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2 + 14, t('week.fireworksToday'), '#fee761'));
}

const idIndex = (id: WeekId): number => ['sale', 'summer', 'harvest'].indexOf(id);

/** Каждый кадр смены: на распродаже с вечера — «−20%» на всё (один раз за день). */
export function tick(scene: StoreScene): void {
  if (scene.night || weekFor(scene.state.day)?.id !== 'sale' || saleOn(scene.state)) return;
  if (scene.timeLeft > DAY_SECONDS * SALE_EVENING) return;
  scene.state = startSale(scene.state);
  track('week_sale', scene.state.day);
  haptic.tap();
  sound.bell(scene.layout.door.x);
  scene.popup(scene.layout.door.x, scene.layout.door.y - 30, t('week.saleStart'), '#ff8aa0');
  // Баннер «−20%» вспыхивает (вечером он и так светится — тут ещё и подмигивает).
  const sign = scene.weekSign;
  if (sign?.active && !scene.lite) scene.tweens.add({ targets: sign, scaleX: sign.scaleX * 1.15, scaleY: sign.scaleY * 1.15, duration: 220, yoyo: true, repeat: 3 });
}

/** Во сколько раз чаще заходят гости: вечером распродажи сбегаются на скидки. */
export const crowd = (scene: StoreScene): number => (!scene.night && saleOn(scene.state) ? SALE_CROWD : 1);

/** Сколько ещё гостей может быть в зале одновременно вечером распродажи. */
export const crowdExtra = (scene: StoreScene): number => (crowd(scene) > 1 ? 2 : 0);
