// «Сценка дня» в зале (game/skits.ts, окно — ui/skits.ts). Посреди дня житель района заходит с улицы, подходит к
// кассе и просит минутку; камера подъезжает к нему, и магазин замирает: таймер дня, покупатели, очередь, персонал
// стоят, пока идёт разговор (11.11, автор: «во время спец сюжета магазин на паузе»). Ответил — день идёт дальше,
// гость радуется (или грустит) и уходит; отданный товар уходит с полок.

import type { StoreScene } from './StoreScene';
import { t } from '../i18n';
import { answerSkit, skitToday, SKITS, type SkitId } from '../game/skits';
import { saveGame } from '../game/save';
import { track } from '../platform/analytics';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { showSkit } from '../ui/skits';
import { randomLook, type Look } from './common';
import * as camera from './camera';
import * as effects from './effects';
import * as persons from './persons';
import * as visitors from './visitors';

/** На какой секунде дня заходит гость (после Сони, инспектора, праздничного гостя и жюри — 18…40 с). */
export const SKIT_AT = 48;

/** Как гость одет в зале — как на портрете (art/skits.py). */
const LOOK: Record<SkitId, () => Look> = {
  puppy: () => ({ ...randomLook(0xfeae34), kid: true, hair: 0xbe4a2f, style: 'short', skin: 0xf2d3ab }),
  wallet: () => ({ ...randomLook(0x5a6988), hair: 0xc0cbdc, style: 'bald', hat: 'flatcap', hatTint: 0xc0cbdc, face: 'beard', faceTint: 0xc0cbdc, glasses: true, skin: 0xe4a672 }),
  pies: () => ({ ...randomLook(0xf4f4f4), hat: 'toque', hatTint: 0xffffff, hair: 0x3e2731, style: 'short', skin: 0xeec39a }),
  gift: () => ({ ...randomLook(0x3e8948), kid: true, hair: 0x4a2c1a, style: 'bun', bag: 'backpack', bagTint: 0x0099db, skin: 0xeec39a }),
  blogger: () => ({ ...randomLook(0xe43b44), hair: 0xfee761, style: 'long', prop: 'camera', propTint: 0x262b44, skin: 0xf2d3ab }),
  rain: () => ({ ...randomLook(0xfeae34), hat: 'bikehelmet', hatTint: 0x262b44, hair: 0x181425, style: 'short', back: 'cube', backTint: 0xfeae34, skin: 0xd9a066 }),
};

/** Утро: есть ли сегодня сценка (зовётся из morningFlow.prepareDay). */
export function armSkit(scene: StoreScene): void {
  const today = skitToday(scene.state);
  scene.skit = today ? { ...today, phase: 'pending' } : null;
}

/** Остановить магазин на время разговора и отпустить после. */
function hold(scene: StoreScene, on: boolean): void {
  scene.running = !on;
  scene.time.paused = on;
  if (on) scene.tweens.pauseAll();
  else scene.tweens.resumeAll();
}

export async function runSkit(scene: StoreScene): Promise<void> {
  const skit = scene.skit;
  if (!skit || skit.phase !== 'pending') return;
  skit.phase = 'here';
  const world = scene.worldGen;
  const { door, queue } = scene.layout;
  // С тротуара у самого входа: от края улицы гость шёл бы полдня.
  const side = Math.random() < 0.5 ? -1 : 1;
  const guest = persons.makePerson(scene, door.x + side * 70, scene.streetY, LOOK[skit.id]());
  const alive = () => guest.active && scene.worldGen === world;
  sound.bell(door.x);
  await persons.walkVia(
    scene,
    guest,
    [
      { x: door.x, y: scene.streetY },
      { x: door.x, y: door.y - 10 },
      // У кассы, сбоку от очереди — как праздничный гость.
      { x: queue.x - 14, y: queue.y + 10 },
    ],
    34,
  );
  if (!alive() || !scene.running) {
    skit.phase = 'done';
    if (guest.active) guest.destroy();
    return;
  }
  persons.setFacing(guest, 'up');
  effects.emote(scene, guest, 'emo_alert');
  scene.speak(guest, 20, t('skit.hello'));
  haptic.tap();
  // Камера — к гостю: разговор происходит здесь.
  scene.cameras.main.pan(guest.x, guest.y - 10, 500, 'Sine.easeInOut', true);
  await scene.wait(1100);
  if (!alive() || !scene.running) {
    skit.phase = 'done';
    return;
  }
  hold(scene, true);
  const { id, ep } = skit;
  showSkit(
    id,
    ep,
    () => scene.state,
    (index) => {
      const next = answerSkit(scene.state, id, ep, index);
      if (!next) return null;
      scene.state = next;
      saveGame(next);
      track(`skit_${id}`, scene.state.day, ep * 10 + index);
      return next;
    },
    (index) => {
      hold(scene, false);
      skit.phase = 'done';
      camera.scheduleHome(scene, 1500);
      if (!alive()) return;
      scene.hud.update(scene.state, scene.timeLeft);
      if (SKITS[id].episodes[ep].choices[index ?? 0].effect.take) scene.refreshShelves();
      const mood = index === null ? null : SKITS[id].episodes[ep].choices[index].mood;
      effects.emote(scene, guest, mood === 'sad' ? 'emo_sigh' : 'emo_heart');
      void leave(scene, guest);
    },
  );
}

async function leave(scene: StoreScene, guest: Phaser.GameObjects.Container): Promise<void> {
  const world = scene.worldGen;
  await scene.wait(900);
  if (!guest.active || scene.worldGen !== world) return;
  const { door, h } = scene.layout;
  await persons.walkVia(scene, guest, [{ x: door.x, y: door.y - 10 }, { x: door.x, y: h + 16 }], 34);
  if (guest.active && scene.worldGen === world) void visitors.strollAway(scene, guest);
}
