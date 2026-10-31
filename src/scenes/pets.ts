// Питомцы магазина: кот (спит на витрине, ходит по залу, ловит мышь на складе, щурится, когда гладят) и
// пёс Бобик у входа (лежит, садится, лает). Гладят пальцем — сердечко и мурчание; испугались — убегают.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { PRODUCTS, PRODUCT_IDS } from '../game/economy';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { findPath } from './paths';
import { haptic } from '../platform/telegram';
import { UI_FONT } from '../ui/dom';
import { hasDog } from '../game/watch';
import { CAT_BEDS, catHome, fedToday } from '../game/cat';
import { note } from '../game/reviews';
import { ART, LIGHT_DEPTH, MOUSE_BITE_MS, MOUSE_STAY_MS, type EmoteKey, CAT_WALK_EVERY, CAT_SPEED, CAT_TICK, CAT_WALK } from './common';
import * as effects from './effects';
import * as liveFx from './liveFx';
import * as camera from './camera';
import * as building from './building';

// ---------- Мышь на складе ----------

/**
 * Мышь бегает по складу и раз в несколько секунд грызёт товар. Нажми на неё — убежит.
 * Сытый кот сам прибегает и ловит её.
 */
export function mouseInWarehouse(scene: StoreScene, keep: <T extends { destroy: () => void }>(obj: T) => T): void {
  const { warehouse } = scene.layout;
  const point = () => ({ x: warehouse.x + 8 + Math.random() * (warehouse.w - 16), y: warehouse.y + 16 + Math.random() * Math.max(4, warehouse.h - 24) });
  const start = point();
  const mouse = keep(scene.art(start.x, start.y, 'mouse0').setDepth(LIGHT_DEPTH - 3));
  mouse.setInteractive(new Phaser.Geom.Circle(6, 3.5, 16), Phaser.Geom.Circle.Contains).on('pointerup', () => camera.tap(scene, () => mouseGone(scene, mouse, false)));
  const run = () => {
    if (!mouse.active || mouse.getData('caught')) return;
    const p = point();
    mouse.setFlipX(p.x > mouse.x);
    scene.tweens.add({
      targets: mouse,
      x: p.x,
      y: p.y,
      duration: 500 + Math.random() * 400,
      onUpdate: () => mouse.setTexture(Math.floor(scene.time.now / 90) % 2 ? 'mouse0' : 'mouse1'),
    });
  };
  keep(scene.time.addEvent({ delay: 1100, loop: true, callback: run }));
  // Грызёт: штука товара со склада пропадает.
  keep(
    scene.time.addEvent({
      delay: MOUSE_BITE_MS,
      loop: true,
      callback: () => {
        if (!mouse.active || mouse.getData('caught')) return;
        const id = PRODUCT_IDS.find((p) => (scene.state.warehouse[p] ?? []).some((u) => !u.pending));
        if (!id) return;
        const units = scene.state.warehouse[id]!;
        const i = units.findIndex((u) => !u.pending);
        scene.state = { ...scene.state, warehouse: { ...scene.state.warehouse, [id]: units.filter((_, n) => n !== i) } };
        scene.stats.spoiled++;
        building.refreshWarehouse(scene);
        sound.tap();
        scene.popup(mouse.x, mouse.y - 8, t('popup.mouseBite', { icon: PRODUCTS[id].icon }), '#ffd0d0');
      },
    }),
  );
  keep(scene.time.delayedCall(MOUSE_STAY_MS, () => mouse.active && mouseGone(scene, mouse, false, true)));
  // Сытый кот чует мышь и прибегает.
  if (scene.catImg?.active && !scene.catOut && scene.state.cat && fedToday(scene.state)) {
    keep(scene.time.delayedCall(3000, () => mouse.active && void catHunt(scene, mouse)));
  }
}

/** Мышь убежала (прогнали или сама ушла) или её поймал кот. */
export function mouseGone(scene: StoreScene, mouse: Phaser.GameObjects.Image, caught: boolean, timeout = false): void {
  if (!mouse.active || mouse.getData('caught')) return;
  mouse.setData('caught', true);
  scene.tweens.killTweensOf(mouse);
  if (!timeout) scene.stats.mice = (scene.stats.mice ?? 0) + 1;
  if (caught) {
    sound.meow(mouse.x);
    scene.popup(mouse.x, mouse.y - 10, t('popup.mouseCaught', { name: scene.state.cat?.name ?? '' }), '#c8ffb0');
    scene.time.delayedCall(300, () => liveFx.endLiveEvent(scene));
    return;
  }
  if (!timeout) {
    sound.good();
    scene.popup(mouse.x, mouse.y - 10, t('popup.mouseScared'), '#c8ffb0');
  }
  const { x: wx, h: wh, y: wy } = scene.layout.warehouse;
  mouse.setFlipX(false);
  scene.tweens.add({ targets: mouse, x: wx + 2, y: wy + wh - 4, alpha: 0, duration: 700, onComplete: () => liveFx.endLiveEvent(scene) });
}

/** Кот бежит на склад и ловит мышь. */
export async function catHunt(scene: StoreScene, mouse: Phaser.GameObjects.Image): Promise<void> {
  const cat = scene.catImg;
  if (!cat?.active || scene.catOut) return;
  scene.catOut = true;
  scene.tweens.killTweensOf(cat);
  cat.setScale(1 / ART).setOrigin(0.5, 1).setTexture('cat_walk0');
  sound.meow(cat.x);
  const { door, h, warehouse } = scene.layout;
  const route = [{ x: door.x + 6, y: scene.catHome.y }, { x: door.x + 6, y: h - 6 }, warehouse.doorway, warehouse.inside];
  for (const p of route) {
    await catStep(scene, p.x, p.y);
    if (!cat.active) return;
  }
  if (mouse.active && !mouse.getData('caught')) {
    await catStep(scene, mouse.x, mouse.y + 4);
    if (mouse.active && !mouse.getData('caught')) {
      mouseGone(scene, mouse, true);
      heartAt(scene, cat.x, cat.y - 10);
    }
  }
  const back = [warehouse.inside, warehouse.doorway, { x: door.x + 6, y: h - 6 }, { x: door.x + 6, y: scene.catHome.y }, scene.catHome];
  for (const p of back) {
    await catStep(scene, p.x, p.y);
    if (!cat.active) return;
  }
  cat.setTexture('cat').setFlipX(false).setDepth(scene.catHome.y + 7.5);
  scene.tweens.add({ targets: cat, scaleY: 1.08 / ART, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.catOut = false;
}

// ---------- Кот ----------

/**
 * Кот у входа. Бродячий просто спит; свой — на лежанке, мурчит, если погладить,
 * и иногда заходит в зал посидеть среди покупателей. Голодный три дня — уходит гулять.
 */
export function buildCat(scene: StoreScene, x: number, y: number): void {
  scene.catImg = undefined;
  scene.catOut = false;
  scene.catSitTimer?.remove();
  scene.catSitTimer = undefined;
  const own = scene.state.cat;
  if (own && !catHome(scene.state)) return;
  scene.catHome = { x, y };
  if (own?.bed) scene.art(x, y + 1.5, CAT_BEDS[own.bed].texture).setOrigin(0.5, 1).setDepth(y + 6);
  const cat = scene.art(x, y, 'cat').setOrigin(0.5, 1).setDepth(y + 7.5);
  scene.catImg = cat;
  scene.tweens.add({ targets: cat, scaleY: 1.08 / ART, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const snore = () => {
    if (!cat.active || scene.catOut) return;
    const z = scene.add
      .text(cat.x - 3, cat.y - 6, 'z', { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#e8f0ff' })
      .setOrigin(0.5)
      .setResolution(scene.textRes(4))
      .setDepth(cat.depth + 1)
      .setScale(0.6);
    scene.tweens.add({ targets: z, x: z.x - 4, y: z.y - 9, scale: 1, alpha: 0, duration: 1800, onComplete: () => z.destroy() });
  };
  scene.critterTimers.push(scene.time.addEvent({ delay: 2600, loop: true, callback: snore }));
  // Во сне изредка дёргает кончиком хвоста: дёрг-дёрг.
  scene.critterTimers.push(
    scene.time.addEvent({
      delay: 2300,
      loop: true,
      callback: () => {
        if (scene.catOut || !cat.active || cat.texture.key !== 'cat' || Math.random() > 0.3) return;
        scene.time.addEvent({
          delay: 130,
          repeat: 3,
          callback: () => {
            if (scene.catOut || !cat.active || !['cat', 'cat_flick'].includes(cat.texture.key)) return;
            cat.setTexture(cat.texture.key === 'cat' ? 'cat_flick' : 'cat');
          },
        });
      },
    }),
  );
  // Иногда просыпается: потягивается или следит за мухой.
  scene.critterTimers.push(scene.time.addEvent({ delay: 9000, loop: true, callback: () => !scene.catOut && cat.active && catWake(scene, cat) }));
  if (!own) return;
  cat.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => petCat(scene)));
  scene.critterTimers.push(
    scene.time.addEvent({
      delay: CAT_WALK_EVERY,
      loop: true,
      callback: () => {
        if (scene.running && !scene.catOut && fedToday(scene.state) && Math.random() < 0.55) void scene.catVisit();
      },
    }),
  );
}

export function catWake(scene: StoreScene, cat: Phaser.GameObjects.Image): void {
  if (Math.random() < 0.5) {
    scene.tweens.add({ targets: cat, scaleX: 1.3 / ART, duration: 420, yoyo: true, hold: 300, ease: 'Sine.easeInOut' });
    return;
  }
  // Муха кружит над котом, кот поворачивается за ней и в конце подпрыгивает.
  petEmote(scene, cat, 'emo_question');
  const fly = scene.add.rectangle(cat.x, cat.y - 10, 1.2, 1.2, 0x181425).setDepth(cat.depth + 2);
  const t0 = scene.time.now;
  const buzz = scene.time.addEvent({
    delay: 50,
    repeat: 50,
    callback: () => {
      const k = (scene.time.now - t0) / 260;
      fly.setPosition(cat.x + Math.cos(k) * 7, cat.y - 9 + Math.sin(k * 1.7) * 3);
      cat.setFlipX(fly.x < cat.x);
    },
  });
  scene.time.delayedCall(2600, () => {
    buzz.remove();
    if (cat.active) scene.tweens.add({ targets: cat, y: cat.y - 3, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: fly, x: fly.x + 20, y: fly.y - 20, alpha: 0, duration: 500, onComplete: () => fly.destroy() });
  });
}

// ---------- Пёс Бобик ----------

/** Будка у входа, Бобик спит рядом. Погладить — сядет и повиляет хвостом. */
export function buildBobik(scene: StoreScene, x: number, y: number): void {
  scene.bobik = undefined;
  scene.bobikWag?.remove();
  if (!hasDog(scene.state)) return;
  // Бобик лежит перед будкой — слева от неё мусорный контейнер, справа ходят к двери.
  scene.art(x, y - 2, 'kennel').setOrigin(0.5, 1).setDepth(y + 4);
  const dog = scene.art(x + 1, y + 4, 'bobik_lie').setOrigin(0.5, 1).setDepth(y + 6);
  scene.bobik = dog;
  if (scene.closed) bobikSit(scene, 900);
  else bobikRest(scene);
  dog.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => petBobik(scene)));
  // Днём Бобик дремлет — иногда над ним «z-z-z».
  scene.critterTimers.push(
    scene.time.addEvent({ delay: 11000, loop: true, callback: () => !scene.closed && dog.texture.key === 'bobik_lie' && Math.random() < 0.5 && petEmote(scene, dog, 'emo_zzz') }),
  );
}

/** Бобик ложится: дышит во сне, иногда «z». */
export function bobikRest(scene: StoreScene): void {
  scene.bobikWag?.remove();
  const dog = scene.bobik;
  if (!dog?.active) return;
  scene.tweens.killTweensOf(dog);
  dog.setTexture('bobik_lie').setScale(1 / ART);
  scene.tweens.add({ targets: dog, scaleY: 1.07 / ART, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** Бобик сидит и виляет хвостом: pace — как часто машет. */
export function bobikSit(scene: StoreScene, pace: number): void {
  const dog = scene.bobik;
  if (!dog?.active) return;
  scene.tweens.killTweensOf(dog);
  scene.bobikWag?.remove();
  dog.setScale(1 / ART).setTexture('bobik_sit0');
  scene.bobikWag = scene.time.addEvent({ delay: pace, loop: true, callback: () => dog.active && dog.setTexture(dog.texture.key === 'bobik_sit0' ? 'bobik_sit1' : 'bobik_sit0') });
}

export function petBobik(scene: StoreScene): void {
  const dog = scene.bobik;
  if (!dog?.active) return;
  haptic.tap();
  bobikSit(scene, 150);
  heartAt(scene, dog.x, dog.y - 12);
  petEmote(scene, dog, 'emo_heart');
  scene.popup(dog.x, dog.y - 18, t('popup.dogWag'), '#fff3b0');
  scene.time.delayedCall(1800, () => !scene.closed && bobikRest(scene));
}

/** Гав! — на воришку. */
export function bobikBark(scene: StoreScene): void {
  const dog = scene.bobik;
  if (!dog?.active) return;
  sound.bark(dog.x);
  scene.bobikWag?.remove();
  scene.tweens.killTweensOf(dog);
  dog.setScale(1 / ART).setTexture('bobik_bark');
  petEmote(scene, dog, 'emo_alert');
  scene.tweens.add({ targets: dog, y: dog.y - 1.5, duration: 90, yoyo: true, repeat: 3 });
  scene.time.delayedCall(1400, () => !scene.closed && bobikRest(scene));
}

/** Погладили кота: мурчит, сердечко. */
export function petCat(scene: StoreScene): void {
  const cat = scene.catImg;
  if (!cat?.active || !scene.state.cat) return;
  sound.purr(cat.x);
  haptic.tap();
  heartAt(scene, cat.x, cat.y - 10);
  rub(scene, cat);
  catSlowBlink(scene);
  scene.popup(cat.x, cat.y - 16, t('popup.catPurr', { name: scene.state.cat.name }), '#fff3b0');
}

/**
 * Облачко с эмоцией над котом или Бобиком — как у людей, только поменьше. Поверх всего, кроме
 * ночного затемнения: у входа облачко иначе пряталось бы за карнизом фасада.
 */
export function petEmote(scene: StoreScene, pet: Phaser.GameObjects.Image, key: EmoteKey): void {
  if (!pet.active) return;
  effects.dropEmote(scene, pet);
  const box = effects.emoteBox(scene, key, 0.8).setPosition(pet.x + 1, pet.y - pet.displayHeight - 0.5).setDepth(LIGHT_DEPTH - 1);
  pet.setData('emote', box);
}

/** Ласкается: покачивается из стороны в сторону. */
export function rub(scene: StoreScene, pet: Phaser.GameObjects.Image): void {
  if (!pet.active) return;
  scene.tweens.add({ targets: pet, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: 2, onComplete: () => pet.setAngle(0) });
}

/** Гром: кот вздрагивает, Бобик настораживается. */
export function petsStartled(scene: StoreScene): void {
  const cat = scene.catImg;
  if (cat?.active) {
    petEmote(scene, cat, 'emo_alert');
    scene.tweens.add({ targets: cat, y: cat.y - 3, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }
  if (scene.bobik?.active) petEmote(scene, scene.bobik, 'emo_alert');
}

export function heartAt(scene: StoreScene, x: number, y: number): void {
  const heart = scene.art(x, y, 'emo_heart').setDepth(1000).setScale(0.6 / ART);
  scene.tweens.add({ targets: heart, y: y - 8, scale: 1 / ART, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Quad.easeOut', onComplete: () => heart.destroy() });
}

/** Кот идёт: перебирает лапами (4 кадра: врозь, мимо, врозь, мимо) и смотрит туда, куда идёт (спрайт смотрит влево). */
export function catStep(scene: StoreScene, x: number, y: number): Promise<void> {
  const cat = scene.catImg;
  if (!cat?.active) return Promise.resolve();
  const distance = Phaser.Math.Distance.Between(cat.x, cat.y, x, y);
  if (Math.abs(x - cat.x) > 0.5) cat.setFlipX(x > cat.x);
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: cat,
      x,
      y,
      duration: (distance / CAT_SPEED) * 1000,
      onUpdate: () => {
        cat.setDepth(cat.y);
        const frame = CAT_WALK[Math.floor(scene.time.now / 90) % CAT_WALK.length];
        if (cat.texture.key !== frame) cat.setTexture(frame);
      },
      onComplete: () => resolve(),
      onStop: () => resolve(),
    });
  });
}

/** Кот заходит в зал, садится посреди и через несколько секунд возвращается на лежанку. */
export async function catVisit(scene: StoreScene): Promise<void> {
  const cat = scene.catImg;
  if (!cat?.active) return;
  scene.catOut = true;
  scene.tweens.killTweensOf(cat);
  cat.setScale(1 / ART).setOrigin(0.5, 1).setTexture('cat_walk0');
  sound.meow(cat.x);
  const { door, h } = scene.layout;
  const spot = liveFx.freeFloorPoint(scene);
  const route = [
    { x: door.x + 6, y: scene.catHome.y },
    { x: door.x + 6, y: h - 6 },
    ...findPath({ x: door.x + 6, y: h - 6 }, { x: spot.x, y: spot.y + 8 }, scene.obstacles),
  ];
  for (const p of route) {
    await catStep(scene, p.x, p.y);
    if (!cat.active) return;
  }
  catSit(scene, cat);
  await scene.wait(Phaser.Math.Between(9000, 13000));
  if (!cat.active) return;
  catStand(scene);
  sound.meow(cat.x);
  const back = [...findPath({ x: cat.x, y: cat.y }, { x: door.x + 6, y: h - 6 }, scene.obstacles), { x: door.x + 6, y: scene.catHome.y }, scene.catHome];
  for (const p of back) {
    await catStep(scene, p.x, p.y);
    if (!cat.active) return;
  }
  cat.setTexture('cat').setFlipX(false).setDepth(scene.catHome.y + 7.5);
  scene.tweens.add({ targets: cat, scaleY: 1.08 / ART, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.catOut = false;
}

/** Покупатель проходит мимо кота в зале — гладит (сердечко, кот мурчит). Это попадёт в отзывы. */
export function petCatNearby(scene: StoreScene): void {
  const cat = scene.catImg;
  if (!scene.catOut || !cat?.active || !scene.catSitTimer) return;
  for (const c of scene.customers) {
    if (c.petted || c.gone || c.thief) continue;
    if (Math.abs(c.sprite.x - cat.x) > 14 || Math.abs(c.sprite.y + 8 - cat.y) > 10) continue;
    c.petted = true;
    note(scene.stats, 'cat');
    effects.emote(scene, c.sprite, 'emo_heart');
    heartAt(scene, cat.x, cat.y - 10);
    // Кот трётся о ноги: поворачивается к покупателю, покачивается и довольно жмурится.
    cat.setFlipX(c.sprite.x > cat.x);
    rub(scene, cat);
    catSlowBlink(scene);
    if (Math.random() < 0.5) sound.purr(cat.x);
  }
}

/**
 * Кот сидит посреди зала и живёт: лениво водит хвостом (вниз — посередине — вверх — посередине,
 * по 260 мс), раз в 3–6 с моргает, раз в 6–10 с умывается лапой. Моргание и умывание начинаются,
 * когда хвост посередине, — кадры сменяются без рывка. Всё считается в тиках таймера, поэтому
 * на ускорении ×2 кот живёт вдвое быстрее, а на паузе замирает.
 */
export function catSit(scene: StoreScene, cat: Phaser.GameObjects.Image): void {
  scene.catSitTimer?.remove();
  cat.setTexture('cat_sit1').setFlipX(false);
  const ticks = (min: number, max: number) => Math.round(Phaser.Math.Between(min, max) / CAT_TICK);
  const tail = [0, 1, 2, 1];
  let step = 1;
  let tick = 0;
  let groomLeft = 0;
  let blinkIn = ticks(3000, 6000);
  let groomIn = ticks(6000, 10000);
  scene.catBlink = 0;
  const timer = scene.time.addEvent({
    delay: CAT_TICK,
    loop: true,
    callback: () => {
      if (!cat.active) return void timer.remove();
      tick++;
      blinkIn--;
      groomIn--;
      let frame: string;
      if (scene.catBlink > 0) {
        scene.catBlink--;
        frame = 'cat_sit_blink';
      } else if (groomLeft > 0) {
        groomLeft--;
        frame = Math.floor(groomLeft / 2) % 2 ? 'cat_groom1' : 'cat_groom0';
      } else if (tail[step] === 1 && groomIn <= 0) {
        // Лижет лапу и трёт ею мордочку.
        groomLeft = ticks(1300, 1900);
        groomIn = groomLeft + ticks(6000, 10000);
        frame = 'cat_groom0';
      } else if (tail[step] === 1 && blinkIn <= 0) {
        blinkIn = ticks(3000, 6000);
        frame = 'cat_sit_blink';
      } else {
        if (tick % 2 === 0) step = (step + 1) % tail.length;
        frame = `cat_sit${tail[step]}`;
      }
      if (cat.texture.key !== frame) cat.setTexture(frame);
    },
  });
  scene.catSitTimer = timer;
}

/** Кот встаёт: хвост и моргание больше не нужны. */
export function catStand(scene: StoreScene): void {
  scene.catSitTimer?.remove();
  scene.catSitTimer = undefined;
}

/** Погладили сидящего кота — медленно и довольно жмурится. */
export function catSlowBlink(scene: StoreScene): void {
  const cat = scene.catImg;
  if (!cat?.active || !scene.catSitTimer) return;
  scene.catBlink = Math.round(600 / CAT_TICK);
  cat.setTexture('cat_sit_blink');
}
