// «Сценка дня» в зале (game/skits.ts, окно — ui/skits.ts). Посреди дня житель района заходит с тротуара у входа,
// подходит к кассе и просит минутку; камера подъезжает к нему, и магазин замирает: таймер дня, покупатели,
// очередь, персонал стоят, пока идёт разговор (11.11, автор: «во время спец сюжета магазин на паузе»). Дошли до
// финала — день идёт дальше, гость радуется (или вздыхает) и уходит; отданный товар уходит с полок.
// Здесь же — пауза для других разговоров посреди дня (Соня после школы, праздничный гость): talkPause.

import type { StoreScene } from './StoreScene';
import { t } from '../i18n';
import { finishSkit, skitToday, type SkitId, type SkitTone } from '../game/skits';
import { saveGame } from '../game/save';
import { track } from '../platform/analytics';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { showSkit } from '../ui/skits';
import { dialogBox } from '../ui/dialog';
import { openModal } from '../ui/dom';
import { randomLook, type Look } from './common';
import * as camera from './camera';
import * as effects from './effects';
import * as persons from './persons';
import * as visitors from './visitors';

/** На какой секунде дня заходит гость (после Сони, инспектора, праздничного гостя и жюри — 18…40 с). */
export const SKIT_AT = 48;

/** Как гость одет в зале — как на портрете (art/skits.py). */
const LOOK: Record<SkitId, () => Look> = {
  robbery: () => ({ ...randomLook(0xb55088), hair: 0xc0cbdc, style: 'bun', glasses: true, hat: 'headscarf', hatTint: 0x68386c, skin: 0xf2d3ab }),
  puppy: () => ({ ...randomLook(0xfeae34), kid: true, hair: 0xbe4a2f, style: 'short', skin: 0xf2d3ab }),
  counterfeit: () => ({ ...randomLook(0x3a4466), hair: 0x181425, style: 'short', skin: 0xeec39a }),
  pies: () => ({ ...randomLook(0xf4f4f4), hat: 'toque', hatTint: 0xffffff, hair: 0x3e2731, style: 'short', skin: 0xeec39a }),
  gift: () => ({ ...randomLook(0x3e8948), kid: true, hair: 0x4a2c1a, style: 'bun', bag: 'backpack', bagTint: 0x0099db, skin: 0xeec39a }),
  blogger: () => ({ ...randomLook(0xe43b44), hair: 0xfee761, style: 'long', prop: 'camera', propTint: 0x262b44, skin: 0xf2d3ab }),
  rain: () => ({ ...randomLook(0xfeae34), hat: 'bikehelmet', hatTint: 0x262b44, hair: 0x181425, style: 'short', back: 'cube', backTint: 0xfeae34, skin: 0xd9a066 }),
};

/** Утро: есть ли сегодня сценка (зовётся из morningFlow.prepareDay). */
export function armSkit(scene: StoreScene): void {
  const id = skitToday(scene.state);
  scene.skit = id ? { id, phase: 'pending' } : null;
}

/** Остановить магазин на время разговора и отпустить после. */
export function hold(scene: StoreScene, on: boolean): void {
  scene.running = !on;
  scene.time.paused = on;
  if (on) scene.tweens.pauseAll();
  else scene.tweens.resumeAll();
}

/**
 * Разговор посреди дня с паузой: магазин замирает, пока открыто окно с репликой героя (Соня после школы,
 * праздничный гость). «Вернуться к работе» — день идёт дальше. Если день уже не идёт (закрылись) — без окна.
 */
export function talkPause(scene: StoreScene, o: { portrait: string; name: string; text: string; pitch: number }): void {
  if (!scene.running) return;
  hold(scene, true);
  const { card, close } = openModal();
  card.append(
    dialogBox({
      portrait: o.portrait,
      name: o.name,
      text: o.text,
      pitch: o.pitch,
      nextLabel: t('skit.back'),
      onNext: () => {
        close();
        hold(scene, false);
      },
    }),
  );
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
  const id = skit.id;
  let tookGoods = false;
  showSkit(
    id,
    () => scene.state,
    (path) => {
      const result = finishSkit(scene.state, id, path);
      if (!result) return null;
      tookGoods = scene.state.shelves !== result.state.shelves || scene.state.warehouse !== result.state.warehouse;
      scene.state = result.state;
      saveGame(result.state);
      track(`skit_${id}`, scene.state.day, ['great', 'good', 'ok', 'bad'].indexOf(result.tone));
      return result;
    },
    (tone: SkitTone | null) => {
      hold(scene, false);
      skit.phase = 'done';
      camera.scheduleHome(scene, 1500);
      if (!alive()) return;
      scene.hud.update(scene.state, scene.timeLeft);
      if (tookGoods) scene.refreshShelves();
      effects.emote(scene, guest, tone === 'bad' || tone === 'ok' ? 'emo_sigh' : 'emo_heart');
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
