// Мини-события дня в зале (game/minievents.ts): выбило пробки (продавец идёт к щитку), прорвало трубу,
// залетел голубь, курьер с посылкой у входа; и что нужно активным моментам дня (moments.ts) от сцены:
// когда нельзя начинать, кому махать, награда за пойманный. Особые дни целиком — bigDays.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS } from '../game/economy';
import { saveGame } from '../game/save';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import type { LiveKind } from '../game/minievents';
import { momentGain, noteMoment, type MomentKind } from '../game/moments';
import { modalOpen } from '../platform/frameCap';
import { ART, LIGHT_DEPTH, LIVE_RETRY_MS, LIVE_LATEST, FIX_MS, LEAK_FIX_MS, randomLook, type Customer, discard } from './common';
import * as effects from './effects';
import * as pets from './pets';
import * as staff from './staff';
import * as persons from './persons';
import * as camera from './camera';

// ---------- Активные моменты дня (game/moments.ts, scenes/moments.ts) ----------

/**
 * Момент не начинается (и начатый ждёт), пока игроку не до него: окно поверх зала, карточка звонка
 * доставки, бабушкина стрелка или реплика, мини-событие, перестановка, вечер.
 */
export function momentBlocked(scene: StoreScene): boolean {
  return (
    !scene.running ||
    scene.night ||
    scene.arranging ||
    Boolean(scene.call) ||
    Boolean(scene.liveEvent) ||
    (scene.hallCoach && scene.coach.pointing) ||
    scene.say.visible ||
    modalOpen()
  );
}

/** Гость в зале, не в очереди и не у кассы (постоянный — первым): ему махать и за ним звёздочка. */
export function momentGuest(scene: StoreScene): Phaser.GameObjects.Container | null {
  const { wallH, h, w } = scene.layout;
  const busy = new Set<Customer>([...scene.queue, ...scene.registers.map((r) => r.customer).filter((c): c is Customer => Boolean(c))]);
  const free = [...scene.customers].filter(
    (c) => !c.gone && !c.thief && !busy.has(c) && c.sprite.active && c.sprite.visible && c.sprite.x > 12 && c.sprite.x < w - 12 && c.sprite.y > wallH + 12 && c.sprite.y < h - 8,
  );
  return (free.find((c) => c.regular) ?? free[0])?.sprite ?? null;
}

/** Поймали момент: чаевые в кассу сразу, искорка к рейтингу — вечером (day.ts), лёгкая вибрация. */
export function momentCaught(scene: StoreScene, kind: MomentKind): string {
  const gain = momentGain(kind, scene.state.level);
  noteMoment(scene.stats, true, gain.star);
  if (gain.money) scene.state = { ...scene.state, money: Math.max(0, scene.state.money + gain.money) };
  if (gain.money > 0) sound.coin();
  else sound.good();
  haptic.tap();
  return t(`moment.${kind}Got` as TextKey, { n: Math.abs(gain.money) });
}

/** Начало мини-события дня. */
/** Прошлое мини-событие ещё не кончилось — подождать; к вечеру уже не начинать. */
export function tryLiveEvent(scene: StoreScene, kind: LiveKind): void {
  if (!scene.running || scene.night || scene.timeLeft < DAY_SECONDS * LIVE_LATEST) return;
  if (scene.liveEvent) scene.time.delayedCall(LIVE_RETRY_MS, () => tryLiveEvent(scene, kind));
  else startLiveEvent(scene, kind);
}

export function startLiveEvent(scene: StoreScene, kind: LiveKind): void {
  if (scene.liveEvent) return;
  scene.liveEvent = kind;
  const { w, h } = scene.layout;
  sound.bell();
  haptic.tap();
  scene.popup(w / 2, h / 2 - 20, t(`live.${kind}` as TextKey), '#fff3b0');
  const keep = <T extends { destroy: () => void }>(obj: T): T => {
    scene.liveObjs.push(obj);
    return obj;
  };
  if (kind === 'blackout') {
    scene.blackout = true;
    scene.updateLighting();
    // Если не починить — через 20 секунд свет дадут сами.
    keep(scene.time.delayedCall(20000, () => restoreLight(scene)));
  }
  // Что-то стряслось — покупатели оглядываются, продавец настораживается.
  persons.everyoneLooks(scene, w / 2, h / 2, kind === 'pigeon' || kind === 'mouse' ? 'emo_question' : 'emo_alert', 0.3);
  if (scene.seller?.active) effects.emote(scene, scene.seller, 'emo_alert');
  if (kind === 'leak') startLeak(scene, keep);
  if (kind === 'pigeon') pigeonInside(scene, keep);
  if (kind === 'courier') void courierVisit(scene, keep);
  if (kind === 'mouse') pets.mouseInWarehouse(scene, keep);
}

export function endLiveEvent(scene: StoreScene): void {
  for (const obj of scene.liveObjs) discard(obj);
  scene.liveObjs = [];
  scene.liveEvent = null;
  if (scene.blackout) {
    scene.blackout = false;
    scene.updateLighting();
  }
}

/** Продавец идёт к щитку и включает свет. */
export function fixFuse(scene: StoreScene): void {
  if (!scene.blackout || scene.sellerBusy || scene.ownerScanning() || !scene.fuseBox) return;
  scene.carried.setTexture('wrench').setPosition(5, -1).setVisible(true);
  effects.emote(scene, scene.seller, 'emo_alert');
  void staff.doChore(scene, [
    {
      x: scene.fuseBox.x,
      y: scene.layout.wallH + 16,
      ms: FIX_MS,
      action: () => {
        scene.carried.setVisible(false).setTexture('box').setPosition(0, 3);
        restoreLight(scene);
      },
    },
  ]);
}

export function restoreLight(scene: StoreScene): void {
  if (!scene.blackout) return;
  scene.blackout = false;
  scene.liveEvent = null;
  scene.updateLighting();
  sound.good();
  scene.popup(scene.layout.w / 2, scene.layout.h / 2 - 20, t('live.lightOn'), '#c8ffb0');
}

/** Свободная точка пола посреди зала (не в мебели и не у кассы). */
export function freeFloorPoint(scene: StoreScene): { x: number; y: number } {
  const { w, h, wallH } = scene.layout;
  const tries = [
    [0.5, 0.45],
    [0.4, 0.55],
    [0.6, 0.35],
    [0.35, 0.4],
    [0.55, 0.6],
    [0.45, 0.3],
  ];
  for (const [fx, fy] of tries) {
    const x = w * fx;
    const y = wallH + (h - wallH) * fy;
    if (scene.obstacles.every((o) => x < o.x - 8 || x > o.x + o.w + 8 || y < o.y - 8 || y > o.y + o.h + 8)) return { x, y };
  }
  return { x: scene.layout.door.x, y: h - 40 };
}

/** Прорвало трубу: с потолка капает, натекают лужи. Нажми — продавец починит ключом. */
export function startLeak(scene: StoreScene, keep: <T extends { destroy: () => void }>(obj: T) => T): void {
  const at = freeFloorPoint(scene);
  const drops = keep(
    scene.add.particles(at.x, at.y - 34, 'raindrop', {
      speedY: 140,
      lifespan: 240,
      frequency: 110,
      x: { min: -3, max: 3 },
      scale: 1 / ART,
      tint: 0x9fd8ff,
    }),
  ).setDepth(LIGHT_DEPTH - 1);
  const ring = keep(scene.art(at.x, at.y, 'ripple').setTint(0x9fd8ff).setDepth(0.7));
  scene.tweens.add({ targets: ring, scale: 1.6 / ART, alpha: { from: 1, to: 0.2 }, duration: 700, repeat: -1 });
  const puddle = () => {
    const piece = staff.dropTrash(scene, at.x + Phaser.Math.Between(-8, 8), at.y - 6, 'spill');
    piece?.setTint(0xbfe4ff);
  };
  puddle();
  const more = keep(scene.time.addEvent({ delay: 7000, repeat: 2, callback: puddle }));
  const stop = () => {
    drops.destroy();
    ring.destroy();
    more.remove();
    scene.liveEvent = null;
  };
  keep(scene.time.delayedCall(40000, stop));
  const zone = keep(scene.add.zone(at.x, at.y - 10, 26, 30).setInteractive({ useHandCursor: true }).setDepth(LIGHT_DEPTH));
  zone.on('pointerup', () =>
    camera.tap(scene, () => {
      if (scene.sellerBusy || scene.ownerScanning() || !drops.active) return;
      scene.carried.setTexture('wrench').setPosition(5, -1).setVisible(true);
      void staff.doChore(scene, [
        {
          x: at.x + 9,
          y: at.y + 2,
          ms: LEAK_FIX_MS,
          action: () => {
            scene.carried.setVisible(false).setTexture('box').setPosition(0, 3);
            stop();
            zone.destroy();
            sound.good();
            scene.popup(at.x, at.y - 16, t('live.leakFixed'), '#c8ffb0');
          },
        },
      ]);
    }),
  );
}

/** В зал залетел голубь: скачет по полу и пугает покупателей. Нажми — улетит. */
export function pigeonInside(scene: StoreScene, keep: <T extends { destroy: () => void }>(obj: T) => T): void {
  const { door, h } = scene.layout;
  const bird = keep(scene.art(door.x, h + 20, 'pigeon_fly').setScale(1.6 / ART).setDepth(LIGHT_DEPTH - 1));
  const scared = new Set<Customer>();
  let done = false;
  const flyOut = () => {
    if (done || !bird.active) return;
    done = true;
    scene.liveEvent = null;
    bird.setTexture('pigeon_fly').setDepth(LIGHT_DEPTH - 1);
    scene.tweens.add({ targets: bird, x: door.x, y: h + 30, duration: 900, ease: 'Sine.easeIn', onComplete: () => bird.destroy() });
  };
  const hop = () => {
    if (done || !bird.active) return;
    const to = freeFloorPoint(scene);
    const x = to.x + Phaser.Math.Between(-40, 40);
    const y = to.y + Phaser.Math.Between(-30, 30);
    bird.setTexture('pigeon_fly').setDepth(LIGHT_DEPTH - 1).setFlipX(x < bird.x);
    scene.tweens.add({
      targets: bird,
      x,
      y,
      duration: 700,
      ease: 'Sine.easeInOut',
      onComplete: () => bird.active && bird.setTexture('pigeon0').setDepth(y),
    });
  };
  hop();
  keep(scene.time.addEvent({ delay: 2200, loop: true, callback: hop }));
  // Кто окажется рядом — пугается и уходит недовольным.
  keep(
    scene.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (done || !bird.active) return;
        for (const c of scene.customers) {
          if (scared.has(c) || c.thief || Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y + 8, bird.x, bird.y) > 14) continue;
          scared.add(c);
          c.unhappy = true;
          effects.emote(scene, c.sprite, 'emo_angry');
        }
      },
    }),
  );
  bird.setInteractive(new Phaser.Geom.Rectangle(-6, -6, 21, 19), Phaser.Geom.Rectangle.Contains).on('pointerup', () =>
    camera.tap(scene, () => {
      sound.tap();
      flyOut();
    }),
  );
  keep(scene.time.delayedCall(25000, flyOut));
}

/** Курьер с посылкой: ждёт у входа; продавец успел принять — в посылке деньги. */
export async function courierVisit(scene: StoreScene, keep: <T extends { destroy: () => void }>(obj: T) => T): Promise<void> {
  const { door } = scene.layout;
  const courier = keep(persons.makePerson(scene, door.x + 60, scene.streetY, { ...randomLook(0xe43b44), style: 'cap', hair: 0xe43b44 }));
  const parcel = scene.art(0, 3, 'box').setTint(0xc28569);
  courier.add(parcel);
  await persons.walkVia(scene, courier, [
    { x: door.x, y: scene.streetY },
    { x: door.x - 10, y: door.y - 14 },
  ]);
  if (!courier.active) return;
  let taken = false;
  const leave = async (left: boolean) => {
    if (!courier.active) return;
    scene.liveEvent = null;
    courier.disableInteractive();
    if (left) scene.popup(courier.x, courier.y - 18, t('live.courierLeft'), '#ffd0d0');
    await persons.walkVia(scene, courier, [
      { x: door.x, y: scene.streetY },
      { x: door.x - 80, y: scene.streetY },
    ]);
    courier.destroy();
  };
  courier.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () =>
    camera.tap(scene, () => {
      if (taken || scene.sellerBusy || scene.ownerScanning()) return;
      taken = true;
      void staff.doChore(scene, [
        {
          x: courier.x + 9,
          y: courier.y,
          ms: 600,
          action: () => {
            parcel.destroy();
            const gift = 40 + 40 * scene.state.level;
            scene.state = { ...scene.state, money: scene.state.money + gift };
            saveGame(scene.state);
            sound.coin(courier.x);
            scene.popup(courier.x, courier.y - 18, t('live.courierGift', { n: gift }), '#c8ffb0');
            effects.flyCoins(scene, courier.x, courier.y, 3);
            void leave(false);
          },
        },
      ]);
    }),
  );
  keep(scene.time.delayedCall(15000, () => !taken && void leave(true)));
}
