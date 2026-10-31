// Всплывающее в зале: надписи «+12 ₽» со значками (popup), летящие монетки, серия покупок, облачка и
// эмоции над головами, искры уборки, звёздная волна и конфетти рекорда, праздник расширения и переезда.
// Только картинка и звук — счёт денег и решения остаются у сцены и её модулей.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS, HYPER_LEVEL, storeLevel } from '../game/economy';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { ICON_RE, ICONS, UI_FONT } from '../ui/dom';
import {
  ART,
  FACADE_H,
  type Popup,
  POPUP,
  LIGHT_DEPTH,
  popupTextWidth,
  COMBO_COLORS,
  SHIRTS,
  type EmoteKey,
  randomLook,
  customerLook,
  GRANDMA,
} from './common';
import * as persons from './persons';
import * as building from './building';

/**
 * Расширение — событие: утреннее окно прячется, на участке леса и строители стучат молотками,
 * вспышка — и зал уже больше, летит конфетти, звучат фанфары.
 */
export async function celebrateExpansion(scene: StoreScene): Promise<void> {
  const modal = document.querySelector<HTMLElement>('.ui-modal:not(.closing)');
  if (modal) modal.style.visibility = 'hidden';
  // Пока стучат молотки, заставка успеет скачаться.
  music.prefetch('expand');
  if (scene.state.level >= HYPER_LEVEL && scene.builtLevel < HYPER_LEVEL) return celebrateMove(scene, modal);
  const { w, h } = scene.layout;
  const next = scene.next;
  const spots: { x: number; y: number }[] = [];
  if (next.w > w) spots.push({ x: w + (next.w - w) / 2, y: next.h * 0.3 }, { x: w + (next.w - w) / 2, y: next.h * 0.7 });
  if (next.h > h) spots.push({ x: w * 0.3, y: h + (next.h - h) / 2 }, { x: w * 0.7, y: h + (next.h - h) / 2 });
  const crew: Phaser.GameObjects.GameObject[] = [];
  for (const spot of spots) {
    crew.push(scene.art(spot.x, spot.y, 'scaffold').setDepth(spot.y));
    const builder = persons.makePerson(scene, spot.x + 14, spot.y + 10, { ...randomLook(0xfeae34), style: 'cap', hair: 0xfeae34, acc: 'vest' });
    scene.tweens.add({ targets: builder, scaleY: 0.92, duration: 140, yoyo: true, repeat: -1 });
    crew.push(builder);
  }
  scene.popup(next.w / 2, next.h / 2, t('popup.construction'), '#fee761');
  const hammer = scene.time.addEvent({
    delay: 260,
    loop: true,
    callback: () => {
      sound.tap();
      const spot = Phaser.Utils.Array.GetRandom(spots);
      if (spot) puff(scene, spot.x + Phaser.Math.Between(-14, 14), spot.y + Phaser.Math.Between(-10, 14));
    },
  });
  // Паузы — переживающие перестройку: эта сцена сама перестраивает зал, а окно утра надо вернуть в любом случае.
  await scene.delay(2400);
  hammer.remove();
  for (const obj of crew) obj.destroy();
  scene.cameras.main.flash(300, 255, 250, 235);
  scene.buildWorld();
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  scene.hud.update(scene.state, DAY_SECONDS);
  const confetti = scene.add.particles(scene.layout.w / 2, scene.layout.h / 2, 'confetti', {
    speed: { min: 60, max: 170 },
    angle: { min: 200, max: 340 },
    gravityY: 160,
    rotate: { min: 0, max: 360 },
    scale: 1 / ART,
    lifespan: 1800,
    tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
    emitting: false,
  });
  confetti.setDepth(LIGHT_DEPTH + 10).explode(70);
  if (!music.sting('expand')) sound.fanfare();
  haptic.success();
  scene.popup(scene.layout.w / 2, scene.layout.h / 2 - 20, t('popup.expanded', { name: t(storeLevel(scene.state).nameKey) }), '#fee761');
  await scene.delay(1600);
  confetti.destroy();
  if (modal) modal.style.visibility = '';
}

/**
 * Переезд в гипермаркет: не стройка, а новоселье. Зал меняется на большой, у входа собираются бабушка
 * и постоянные покупатели — поздравляют, над вывеской и у двери — конфетти. Камера стоит на месте.
 */
export async function celebrateMove(scene: StoreScene, modal: HTMLElement | null): Promise<void> {
  scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('hyper.title'), '#fee761');
  await scene.delay(900);
  scene.cameras.main.flash(300, 255, 250, 235);
  scene.buildWorld();
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  scene.hud.update(scene.state, DAY_SECONDS);
  const { w, h, door } = scene.layout;
  const y = h + FACADE_H + 12;
  const guests = [GRANDMA, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day), customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day)];
  const crowd = guests.map((look, i) => {
    const person = persons.makePerson(scene, door.x + [-20, 20, -38][i], y + [0, 2, 4][i], look);
    persons.setFacing(person, 'up');
    return person;
  });
  const burst = (x: number, by: number, n: number) => {
    const confetti = scene.add.particles(x, by, 'confetti', {
      speed: { min: 50, max: 150 },
      angle: { min: 200, max: 340 },
      gravityY: 160,
      rotate: { min: 0, max: 360 },
      scale: 1 / ART,
      lifespan: 1800,
      tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
      emitting: false,
    });
    confetti.setDepth(LIGHT_DEPTH + 10).explode(scene.lite ? Math.round(n / 2) : n);
    scene.time.delayedCall(2000, () => confetti.destroy());
  };
  burst(w / 2, -6, 60);
  burst(door.x, h, 40);
  if (!music.sting('expand')) sound.fanfare();
  haptic.success();
  scene.popup(w / 2, h / 2 - 20, t('popup.expanded', { name: t(storeLevel(scene.state).nameKey) }), '#fee761');
  const cheers: TextKey[] = ['hyper.cheer1', 'hyper.cheer2', 'hyper.cheer3'];
  for (const [i, person] of crowd.entries()) {
    scene.time.delayedCall(300 + i * 450, () => {
      if (!person.active) return;
      emote(scene, person, i === 0 ? 'emo_heart' : 'emo_star');
      scene.popup(person.x, person.y - 22, t(cheers[i]), '#ffffff');
    });
  }
  await scene.delay(2600);
  // Поздравили — расходятся: тают у входа (зал уже мог перестроиться — тогда их нет).
  for (const person of crowd) if (person.active) scene.tweens.add({ targets: person, alpha: 0, duration: 500, onComplete: () => person.destroy() });
  if (modal) modal.style.visibility = '';
}

/** Монетки летят от кассы к счётчику денег в углу экрана. */
export function flyCoins(scene: StoreScene, x: number, y: number, count: number): void {
  const target = scene.cameras.main.getWorldPoint(70 * scene.res, 52 * scene.res);
  for (let i = 0; i < count; i++) {
    const coin = scene.art(x + Phaser.Math.Between(-4, 4), y - 10, 'coin').setDepth(LIGHT_DEPTH + 5);
    scene.tweens.add({
      targets: coin,
      x: target.x,
      y: target.y,
      scale: 0.8 / ART,
      delay: i * 70,
      duration: 650,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        coin.destroy();
        if (i === count - 1) scene.hud.bumpMoney();
      },
    });
  }
}

/** «Серия ×3!» над кассой: крупная цифра, звёздочки, нота всё выше. */
export function celebrateCombo(scene: StoreScene, n: number): void {
  const { counter } = scene.layout;
  const color = COMBO_COLORS[Math.min(n - 2, COMBO_COLORS.length - 1)];
  const label = scene.add
    .text(counter.x - 14, counter.y - 40, t('popup.combo', { n }), {
      fontFamily: UI_FONT,
      fontSize: `${Math.min(9 + n, 15)}px`,
      fontStyle: 'bold',
      color,
      stroke: '#181425',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setResolution(scene.textRes(5))
    .setDepth(LIGHT_DEPTH + 6)
    .setScale(0.2)
    .setAngle(-8);
  scene.tweens.add({ targets: label, scale: 1, angle: 0, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 900, duration: 500, onComplete: () => label.destroy() });
  const burst = scene.add.particles(counter.x - 14, counter.y - 40, 'spark', {
    speed: { min: 20, max: 40 + n * 6 },
    lifespan: 600,
    scale: { start: 0.7, end: 0 },
    tint: [0xfee761, 0xffffff, 0xfeae34],
    quantity: 6 + n * 2,
    emitting: false,
  });
  burst.setDepth(LIGHT_DEPTH + 5).explode(6 + n * 2);
  scene.time.delayedCall(800, () => burst.destroy());
  sound.combo(n);
}

/** Облачко пыли: мусор убрали. */
export function puff(scene: StoreScene, x: number, y: number): void {
  const cloud = scene.art(x, y - 2, 'puff').setDepth(y + 5);
  scene.tweens.add({ targets: cloud, y: y - 8, scale: 0.8 / ART, alpha: 0, duration: 500, onComplete: () => cloud.destroy() });
}

/** Пузыри: туалет отмыт. */
export function bubbles(scene: StoreScene, x: number, y: number): void {
  for (let i = 0; i < 6; i++) {
    const b = scene.art(x + Phaser.Math.Between(-7, 7), y + Phaser.Math.Between(-4, 8), 'bubble_s').setDepth(y + 40);
    scene.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(10, 18), alpha: 0, delay: i * 80, duration: 700, onComplete: () => b.destroy() });
  }
}

/** Волна запаха выпечки: три тёплые точки змейкой плывут из двери пекарни в зал. */
export function aromaWisp(scene: StoreScene): void {
  const door = scene.layout.bakery.doorway;
  const wisp = scene.add.container(door.x + 2, door.y - 6).setDepth(LIGHT_DEPTH - 2);
  for (let i = 0; i < 3; i++) wisp.add(scene.add.rectangle(i * 3, Math.sin(i * 2) * 1.5, 2, 1, 0xfeae34, 0.85));
  scene.tweens.add({ targets: wisp, x: wisp.x + Phaser.Math.Between(30, 60), y: wisp.y - Phaser.Math.Between(10, 24), alpha: 0, duration: 2200, onComplete: () => wisp.destroy() });
  scene.tweens.add({ targets: wisp.list, y: '+=2', duration: 300, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
}

/** Эмоция над головой: облачко выпрыгивает над макушкой (над шляпой — повыше). Новая эмоция сменяет прежнюю. */
export function emote(scene: StoreScene, person: Phaser.GameObjects.Container, key: EmoteKey): void {
  if (!person.active) return;
  dropEmote(scene, person);
  const hat = person.list.some((o) => (o as Phaser.GameObjects.Image).texture?.key.startsWith('w_hat_'));
  const box = emoteBox(scene, key, 1).setPosition(1.5, hat ? -14 : -10.5);
  person.add(box);
  person.setData('emote', box);
}

/** Убирает облачко, которое ещё висит над человеком или зверем, вместе с его анимациями. */
export function dropEmote(scene: StoreScene, owner: Phaser.GameObjects.GameObject): void {
  const old = owner.getData('emote') as Phaser.GameObjects.Container | undefined;
  if (!old?.active) return;
  scene.tweens.killTweensOf([old, ...old.list]);
  old.destroy();
}

/**
 * Белое облачко с хвостиком (хвостик — в точке 0, 0) и значком внутри. Выпрыгивает с пружинкой,
 * значок двигается по-своему (emoteMotion), через полторы секунды облачко тает.
 */
export function emoteBox(scene: StoreScene, key: EmoteKey, scale: number): Phaser.GameObjects.Container {
  const bubble = scene.art(0, 0, 'emo_bubble').setOrigin(0.375, 1);
  const icon = scene.art(1.2, -4, key).setScale(0.85 / ART);
  const box = scene.add.container(0, 0, [bubble, icon]).setScale(0).setAngle(-10);
  scene.tweens.add({ targets: box, scale, angle: 0, duration: 220, ease: 'Back.easeOut', easeParams: [2.5] });
  scene.tweens.add({ targets: box, alpha: 0, delay: 1350, duration: 300, onComplete: () => box.destroy() });
  emoteMotion(scene, box, icon, key);
  return box;
}

/**
 * У каждой эмоции своё движение: сердечко бьётся, злость краснеет и пыхтит паром, «z» плывут
 * волной, вопрос качается маятником, звезда крутится с искрами, часы тикают, вздох оседает,
 * «дорого» подпрыгивает, «!» вздрагивает. Мини-сердечки, искры и пар — не на слабом телефоне.
 */
export function emoteMotion(scene: StoreScene, box: Phaser.GameObjects.Container, icon: Phaser.GameObjects.Image, key: EmoteKey): void {
  const { x, y } = icon;
  const s = icon.scaleX;
  const fx = !scene.lite;
  // Значок оживает, когда облачко уже выпрыгнуло.
  const delay = 200;
  switch (key) {
    case 'emo_heart':
      // Тук-тук: на каждом ударе из облачка вылетает маленькое сердечко.
      scene.tweens.add({
        targets: icon,
        scale: s * 1.3,
        delay,
        duration: 110,
        yoyo: true,
        repeat: 3,
        repeatDelay: 140,
        ease: 'Quad.easeOut',
        onYoyo: () => fx && emoteBit(scene, box, 'emo_heart', x + Phaser.Math.FloatBetween(-3, 4), y - 2),
      });
      break;
    case 'emo_angry': {
      // Облачко наливается красным, значок пыхтит, из-под облачка — клубы пара.
      const flush = scene.art(0, 0, 'emo_bubble').setOrigin(0.375, 1).setTint(0xff7070).setAlpha(0);
      box.addAt(flush, 1);
      scene.tweens.add({ targets: flush, alpha: 0.9, delay, duration: 350, ease: 'Sine.easeOut' });
      let side = 1;
      scene.tweens.add({
        targets: icon,
        scale: s * 1.18,
        delay,
        duration: 100,
        yoyo: true,
        repeat: 3,
        repeatDelay: 160,
        onYoyo: () => {
          side = -side;
          if (fx) emoteBit(scene, box, 'puff', x + side * 4.5, y - 3, side);
        },
      });
      break;
    }
    case 'emo_zzz':
      // Плывут волной: вверх-вниз и чуть вбок со сдвигом по фазе.
      scene.tweens.add({ targets: icon, y: y - 1.2, delay, duration: 300, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: icon, x: x + 0.8, angle: 8, delay: delay + 150, duration: 300, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      break;
    case 'emo_question':
      // Маятник: подвешен за макушку, качается и затихает.
      icon.setOrigin(0.5, 0).setY(y - 6 * s).setAngle(-18);
      scene.tweens.add({ targets: icon, angle: 0, delay: 100, duration: 1300, ease: (t: number) => 1 - Math.cos(Math.PI * 4 * t) * (1 - t) });
      break;
    case 'emo_star':
      // Крутится, замедляясь, а по краям облачка вспыхивают искры.
      scene.tweens.add({ targets: icon, angle: 360, delay: 120, duration: 900, ease: 'Cubic.easeOut' });
      if (fx) [[-2.5, -7.5], [5.5, -6], [-3.5, -2]].forEach(([sx, sy], i) => emoteBit(scene, box, 'spark', sx, sy, 0, delay + i * 150));
      break;
    case 'emo_clock':
      // Тик-так: качнётся и замрёт, качнётся обратно.
      scene.tweens.add({ targets: icon, angle: { from: -10, to: 10 }, delay, duration: 90, hold: 200, yoyo: true, repeat: 1, repeatDelay: 200, ease: 'Back.easeOut' });
      break;
    case 'emo_sigh':
      // Выдох: значок оседает и расплывается.
      scene.tweens.add({ targets: icon, y: y + 1, scaleX: s * 1.15, scaleY: s * 0.88, delay: delay + 100, duration: 520, hold: 200, yoyo: true, ease: 'Sine.easeInOut' });
      break;
    case 'emo_pricey':
      // Цена прыгает вверх.
      scene.tweens.add({ targets: icon, y: y - 1.3, delay, duration: 130, yoyo: true, repeat: 2, repeatDelay: 120, ease: 'Quad.easeOut' });
      break;
    case 'emo_alert':
      // Вздрагивает: вытягивается вверх.
      scene.tweens.add({ targets: icon, y: y - 0.8, scaleX: s * 0.85, scaleY: s * 1.25, delay, duration: 80, yoyo: true, repeat: 2, repeatDelay: 220 });
      break;
  }
}

/** Мелочь вокруг облачка: мини-сердечко, клуб пара (dir — в какую сторону) или искра. Живёт внутри облачка. */
export function emoteBit(scene: StoreScene, box: Phaser.GameObjects.Container, key: 'emo_heart' | 'puff' | 'spark', x: number, y: number, dir = 0, delay = 0): void {
  if (!box.active) return;
  const bit = scene.art(x, y, key).setAlpha(0);
  box.add(bit);
  const done = () => bit.destroy();
  if (key === 'emo_heart') {
    bit.setScale(0.4 / ART);
    scene.tweens.add({ targets: bit, y: y - 6, scale: 0.6 / ART, alpha: { from: 1, to: 0 }, delay, duration: 600, ease: 'Quad.easeOut', onComplete: done });
  } else if (key === 'puff') {
    bit.setScale(0.4 / ART).setFlipX(dir < 0);
    scene.tweens.add({ targets: bit, x: x + dir * 2.5, y: y - 3, scale: 0.7 / ART, alpha: { from: 1, to: 0 }, delay, duration: 450, ease: 'Sine.easeOut', onComplete: done });
  } else {
    bit.setScale(0.3 / ART);
    scene.tweens.add({ targets: bit, scale: 1 / ART, angle: 90, alpha: { from: 1, to: 0 }, delay, duration: 420, ease: 'Quad.easeOut', onComplete: done });
  }
}

/** Чисто! Звёздочки на вымытом месте и блик, пробегающий по полу. */
export function cleanSparkle(scene: StoreScene, x: number, y: number, w: number): void {
  if (scene.lite) return;
  for (let i = 0; i < 4; i++) {
    const spark = scene.art(x + Phaser.Math.Between(-w / 2, w / 2), y + Phaser.Math.Between(-4, 3), 'spark').setScale(0.2 / ART).setDepth(y + 4);
    scene.tweens.add({ targets: spark, scale: 0.8 / ART, angle: 90, alpha: 0, delay: i * 110, duration: 420, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
  }
  const glint = scene.add.rectangle(x - w / 2, y + 1, 3, 6, 0xffffff, 0.55).setAngle(25).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.58);
  scene.tweens.add({ targets: glint, x: x + w / 2, alpha: 0, duration: 380, ease: 'Sine.easeIn', onComplete: () => glint.destroy() });
}

/** Прибавилась звезда рейтинга — по залу волной бегут золотые искры; побит рекорд выручки — конфетти. */
export function cheerProgress(scene: StoreScene): void {
  const stars = Math.round(scene.state.rating);
  // Рейтинг около «x,5» качается туда-сюда — звезда считается потерянной, только когда он ушёл вниз
  // заметно: иначе волна искр и звон медали шли на каждое покачивание.
  if (scene.starsCheered < 0 || scene.state.rating < scene.starsCheered - 0.75) scene.starsCheered = stars;
  if (stars > scene.starsCheered) {
    scene.starsCheered = stars;
    starWave(scene);
  }
  const best = scene.state.records?.revenue?.n;
  if (!scene.recordCheered && scene.running && !scene.night && best && scene.stats.revenue > best) {
    scene.recordCheered = true;
    recordConfetti(scene);
  }
}

export function starWave(scene: StoreScene): void {
  sound.medal();
  if (scene.lite) return;
  const { w, h } = scene.layout;
  for (let i = 0; i < 18; i++) {
    const x = 8 + (i / 17) * (w - 16);
    const y = Phaser.Math.Between(20, h - 20);
    const spark = scene.art(x, y, 'spark').setTint(0xfee761).setScale(0).setDepth(LIGHT_DEPTH + 12).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: spark,
      scale: { from: 0.2 / ART, to: 1.1 / ART },
      y: y - 10,
      angle: 120,
      alpha: { from: 1, to: 0 },
      delay: i * 45,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }
}

export function recordConfetti(scene: StoreScene): void {
  const { w } = scene.layout;
  scene.popup(w / 2, 40, t('records.broken', { name: t('records.revenue') }), '#fee761');
  if (!music.sting('record')) sound.fanfare();
  haptic.success();
  if (scene.lite) return;
  // Короткая тёплая вспышка света — без тряски.
  scene.cameras.main.flash(220, 255, 246, 210);
  const confetti = scene.add.particles(w / 2, 10, 'confetti', {
    speed: { min: 50, max: 150 },
    angle: { min: 30, max: 150 },
    gravityY: 140,
    rotate: { min: 0, max: 360 },
    scale: 1 / ART,
    lifespan: 1700,
    tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
    emitting: false,
  });
  confetti.setDepth(LIGHT_DEPTH + 10).explode(50);
  scene.time.delayedCall(1900, () => confetti.destroy());
}

/**
 * Всплывающая надпись: жирная, на тёмной плашке-пилюле со светлой полоской сверху и хвостиком к тому,
 * над кем всплыла. Эмодзи, у которых в меню есть пиксельный значок, — тем же значком, а не эмодзи телефона.
 * Выпрыгивает из кончика хвостика, потом поднимается и тает. На слабом телефоне — без хвостика и полоски.
 */
export function popup(scene: StoreScene, x: number, y: number, text: string, color: string): void {
  scene.popups = scene.popups.filter((p) => p.box.active);
  const hold = Math.min(1800, 500 + 40 * text.length);
  // Та же фраза ещё висит — не новая надпись, а счётчик: «Ушёл без покупки! ×3».
  const same = scene.popups.find((p) => p.text === text);
  if (same) {
    same.count++;
    // Прежние выпрыгивание и таяние — прочь: иначе конец выпрыгивания запустил бы второе таяние.
    scene.tweens.killTweensOf(same.box);
    fillPopup(scene, same, `${text} ×${same.count}`);
    same.box.setAlpha(1).setY(same.y);
    scene.tweens.add({ targets: same.box, scale: { from: 1.2, to: 1 }, duration: 180, ease: 'Back.easeOut' });
    fadePopup(scene, same, hold);
    return;
  }
  // Кончик хвостика — чуть ниже точки: плашка висит над головой, хвостик указывает на макушку.
  const bg = scene.add.graphics();
  const box = scene.add.container(x, y + 4, [bg]).setDepth(1000).setScale(0.4);
  const entry: Popup = { box, bg, text, color, count: 1, x, y: box.y, w: 0, h: 0, dx: 0, tail: !scene.lite };
  fillPopup(scene, entry, text);
  // Не налезать на другие надписи: если место занято — встаём над ними. Хвостик тогда показал бы
  // на соседнюю надпись, а не на хозяина, — без него.
  let stacked = false;
  for (let i = 0; i < 6; i++) {
    const hit = scene.popups.find((p) => Phaser.Geom.Intersects.RectangleToRectangle(popupRect(entry), popupRect(p)));
    if (!hit) break;
    box.y = popupRect(hit).y - 1 + POPUP.tail;
    stacked = true;
  }
  entry.y = box.y;
  if (stacked && entry.tail) {
    entry.tail = false;
    drawPopupBg(scene, entry);
  }
  scene.popups.push(entry);
  scene.tweens.add({ targets: box, scale: 1, duration: 220, ease: 'Back.easeOut', onComplete: () => fadePopup(scene, entry, hold) });
}

/**
 * Содержимое надписи: текст кусками, а эмодзи из ICONS (ui/dom.ts) — пиксельными значками, как в меню
 * (значки меню — из атласа 'ico', монета, товары и коробка — свои картинки). Длинная фраза переносится
 * по словам, чтобы не вылезать за край магазина. Размер плашки и сдвиг от хвостика — в entry.
 */
export function fillPopup(scene: StoreScene, e: Popup, text: string): void {
  // Прежнее содержимое (при склейке «×N») — прочь, фон остаётся первым, под всем.
  for (const o of e.box.list.filter((o) => o !== e.bg)) o.destroy();
  const maxW = Math.min(110, scene.layout.w - 10);
  // Слова (с пробелом после) и значки по порядку; нечётные куски split — эмодзи из таблицы.
  type Bit = { text: string; key?: string };
  const bits: Bit[] = [];
  text.split(ICON_RE).forEach((part, i) => {
    const key = i % 2 ? ICONS[part] : undefined;
    if (key && hasIcon(scene, key)) bits.push({ text: part, key });
    else for (const word of part.match(/\S+\s*|\s+/g) ?? []) bits.push({ text: word });
  });
  const iconW = (key: string) => {
    const f = iconFrame(scene, key);
    return (f.width * POPUP.icon) / f.height + 2 * POPUP.gap;
  };
  const lines: Bit[][] = [[]];
  let lineW = 0;
  for (const bit of bits) {
    const w = bit.key ? iconW(bit.key) : popupTextWidth(bit.text);
    if (lineW > 0 && lineW + (bit.key ? w : popupTextWidth(bit.text.trimEnd())) > maxW) {
      lines.push([]);
      lineW = 0;
    }
    // Пробелы в начале строки после переноса не нужны.
    if (lineW === 0 && !bit.key && !bit.text.trim()) continue;
    lines[lines.length - 1].push(bit);
    lineW += w;
  }
  // Строка: соседние слова — одним текстом, значки — картинками; пробелы по краям строки не в счёт.
  const rows = lines.map((line) => {
    const runs: Bit[] = [];
    for (const bit of line) {
      const last = runs[runs.length - 1];
      if (!bit.key && last && !last.key) last.text += bit.text;
      else runs.push({ ...bit });
    }
    if (runs.length && !runs[0].key) runs[0].text = runs[0].text.trimStart();
    if (runs.length && !runs[runs.length - 1].key) runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd();
    const items = runs
      .filter((r) => r.key || r.text)
      .map((r) => {
        if (r.key) return popupIcon(scene, r.key);
        return scene.add.text(0, 0, r.text, { fontFamily: UI_FONT, fontSize: POPUP.font, fontStyle: 'bold', color: e.color, resolution: scene.textRes(5) }).setOrigin(0, 0.5);
      });
    const gaps = (o: Phaser.GameObjects.Image | Phaser.GameObjects.Text) => (o instanceof Phaser.GameObjects.Image ? 2 * POPUP.gap : 0);
    return {
      items,
      w: items.reduce((sum, o) => sum + o.displayWidth + gaps(o), 0),
      h: Math.max(POPUP.icon, ...items.map((o) => o.displayHeight)),
    };
  });
  e.w = Math.max(...rows.map((r) => r.w)) + 2 * POPUP.padX;
  e.h = rows.reduce((sum, r) => sum + r.h, 0) + 2 * POPUP.padY;
  // Длинная надпись не вылезает за край магазина: плашка сдвигается, хвостик остаётся над хозяином.
  const half = e.w / 2 + 2;
  e.dx = Phaser.Math.Clamp(e.x, half, Math.max(half, scene.layout.w - half)) - e.x;
  let y = -POPUP.tail - e.h + POPUP.padY;
  for (const row of rows) {
    let x = e.dx - row.w / 2;
    for (const o of row.items) {
      const gap = o instanceof Phaser.GameObjects.Image ? POPUP.gap : 0;
      // Значок чуть выше середины строки — вровень с заглавными буквами, а не с хвостиками «у» и «р».
      o.setPosition(x + gap, y + row.h / 2 - (gap ? 0.5 : 0));
      x += o.displayWidth + 2 * gap;
    }
    y += row.h;
    e.box.add(row.items);
  }
  drawPopupBg(scene, e);
}

/** Есть ли картинка для значка: значки меню — кадры атласа 'ico', остальное — отдельные текстуры. */
export function hasIcon(scene: StoreScene, key: string): boolean {
  return key.startsWith('ico_') ? scene.textures.get('ico').has(key) : scene.textures.exists(key);
}

/** Кадр значка — по его размеру строка переносится ещё до того, как значок создан. */
export function iconFrame(scene: StoreScene, key: string): Phaser.Textures.Frame {
  return key.startsWith('ico_') ? scene.textures.getFrame('ico', key) : scene.textures.getFrame(key);
}

/** Значок в надписи — высотой POPUP.icon, как в меню (там все значки в строку высотой 1,15 буквы). */
export function popupIcon(scene: StoreScene, key: string): Phaser.GameObjects.Image {
  const img = key.startsWith('ico_') ? scene.add.image(0, 0, 'ico', key) : scene.add.image(0, 0, key);
  return img.setOrigin(0, 0.5).setScale(POPUP.icon / img.height);
}

/** Фон надписи: тёмная пилюля, светлая полоска сверху — тоном надписи — и хвостик к тому, над кем всплыла. */
export function drawPopupBg(scene: StoreScene, e: Popup): void {
  const { w, h, dx } = e;
  const r = POPUP.radius;
  const left = dx - w / 2;
  const top = -POPUP.tail - h;
  const g = e.bg.clear();
  if (scene.lite) {
    g.fillStyle(0x181425, 0.85);
    fillPill(g, left, top, w, h);
    return;
  }
  // Мягкая тень на пиксель ниже — плашка чуть приподнята над полом.
  g.fillStyle(0x0b0911, 0.3);
  fillPill(g, left, top + 1, w, h);
  g.fillStyle(0x181425, 0.85);
  fillPill(g, left, top, w, h);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(e.color).color, 0.35).fillRect(left + r, top + 1, w - 2 * r, 1);
  if (!e.tail) return;
  // Хвостик — от низа плашки к точке 0, 0; если плашка прижата к стене — не на скруглении, а рядом.
  const bx = Phaser.Math.Clamp(0, left + r + 2.5, left + w - r - 2.5);
  g.fillStyle(0x181425, 0.85).fillTriangle(bx - 2.5, -POPUP.tail, bx + 2.5, -POPUP.tail, Phaser.Math.Clamp(0, bx - 2, bx + 2), 0);
}

/**
 * Плашка со ступенчатыми пиксельными углами из пяти прямоугольников без наложений (прозрачность ровная).
 * fillRoundedRect в WebGL каждый кадр заново режет 4 дуги на ~400 точек — а надписей бывает много сразу.
 */
export function fillPill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillRect(x + 2, y, w - 4, 1)
    .fillRect(x + 1, y + 1, w - 2, 1)
    .fillRect(x, y + 2, w, h - 4)
    .fillRect(x + 1, y + h - 2, w - 2, 1)
    .fillRect(x + 2, y + h - 1, w - 4, 1);
}

/** Где плашка надписи в мире — чтобы новые надписи не налезали на прежние. */
export function popupRect(p: Popup): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(p.box.x + p.dx - p.w / 2, p.box.y - POPUP.tail - p.h, p.w, p.h);
}

/** Надпись повисит и уплывёт вверх, растворяясь. */
export function fadePopup(scene: StoreScene, entry: Popup, hold: number): void {
  const { box } = entry;
  scene.tweens.add({
    targets: box,
    y: box.y - 12,
    alpha: 0,
    delay: hold,
    duration: 600,
    ease: 'Quad.easeIn',
    onComplete: () => {
      box.destroy();
      scene.popups = scene.popups.filter((p) => p !== entry);
    },
  });
}
