// Питомцы за звёзды (game/pets.ts) в зале: в мире живёт один — выбранный. Попугай на жёрдочке у касс
// (иногда «говорит» словечко), хомяк в клетке рядом (бегает в колесе), корги у входа (спит и виляет, когда
// заходят гости), черепаха у стены (ночью медленно идёт через зал), крольчиха в углу, енот выглядывает
// со склада. Утром здороваются, в рекордный день радуются, когда магазин закрыт — спят. Погладить —
// сердечко, голосок (канал мира) и лёгкая вибрация. Никаких денег и гостей — только для души.
// Кот и Бобик — соседний модуль pets.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { activePet, petDefaultKey, PETS, type PetId, type PetSpot } from '../game/pets';
import type { Layout } from './layout';
import * as pets from './pets';
import * as camera from './camera';

/** Питомец живёт тиками: кадры, мелкие дела. В лёгкой графике — вдвое реже. */
const TICK_MS = 420;
/** Сколько держится реакция (ласка, приветствие, гость в дверях). */
const REACT_MS = 1600;
/** Черепаха ночью идёт через зал: точек в секунду. */
const TURTLE_SPEED = 3;

/** Кадры: покой (по очереди), сон, радость; у хомяка ещё бег в колесе, у корги — виляние, у черепахи — шаг. */
const FRAMES: Record<PetId, { idle: string[]; sleep: string; happy: string[]; move?: string[] }> = {
  parrot: { idle: ['pet_parrot_0', 'pet_parrot_1'], sleep: 'pet_parrot_sleep', happy: ['pet_parrot_happy', 'pet_parrot_talk'] },
  hamster: { idle: ['pet_hamster_0'], sleep: 'pet_hamster_sleep', happy: ['pet_hamster_run0', 'pet_hamster_run1', 'pet_hamster_run2'], move: ['pet_hamster_run0', 'pet_hamster_run1', 'pet_hamster_run2'] },
  corgi: { idle: ['pet_corgi_0', 'pet_corgi_1'], sleep: 'pet_corgi_0', happy: ['pet_corgi_wag0', 'pet_corgi_wag1'] },
  turtle: { idle: ['pet_turtle_0'], sleep: 'pet_turtle_sleep', happy: ['pet_turtle_0'], move: ['pet_turtle_walk0', 'pet_turtle_walk1'] },
  bunny: { idle: ['pet_bunny_0', 'pet_bunny_1'], sleep: 'pet_bunny_sleep', happy: ['pet_bunny_hop', 'pet_bunny_0'] },
  raccoon: { idle: ['pet_raccoon_0', 'pet_raccoon_0', 'pet_raccoon_1'], sleep: 'pet_raccoon_sleep', happy: ['pet_raccoon_wave', 'pet_raccoon_0'] },
};

/** Голосок на ласку (sound.pet). */
const VOICE: Record<PetId, Parameters<typeof sound.pet>[0]> = {
  parrot: 'chirp',
  hamster: 'squeak',
  corgi: 'yip',
  turtle: 'hum',
  bunny: 'sniff',
  raccoon: 'chitter',
};

/** Где живёт питомец (низ картинки): у касс, у стены, у входа, в углу, у двери склада. */
export function petSpot(layout: Layout, spot: PetSpot): { x: number; y: number } {
  const { queue, counter, door, h, w, wallH, warehouse } = layout;
  switch (spot) {
    case 'perch':
      return { x: queue.x - 24, y: counter.y + 4 };
    case 'counter':
      return { x: queue.x - 24, y: counter.y + 2 };
    case 'door':
      return { x: door.x - 28, y: h - 8 };
    case 'wall':
      // Справа от входа, за тележками: ночью идёт отсюда влево через зал.
      return { x: Math.min(w - 30, door.x + 68), y: h - 7 };
    case 'corner':
      // Левый верхний угол зала, под полками у стены.
      return { x: 14, y: wallH + 44 };
    case 'storage':
      // В самом проёме двери склада (растение у двери — правее).
      return { x: warehouse.doorway.x - 1, y: warehouse.doorway.y + 4 };
  }
}

/** Имя питомца: данное игроком или по умолчанию. */
const petName = (scene: StoreScene, id: PetId): string => activePet(scene.state)?.name ?? t(petDefaultKey(id));

/** Спит: магазин закрыт; в ночную смену спят все, кроме черепахи (она как раз идёт гулять) и енота. */
const asleep = (scene: StoreScene, id: PetId): boolean => scene.closed || (scene.night && id !== 'turtle' && id !== 'raccoon');

/** Питомец в зал: при каждой перестройке мира (buildWorld) — заново. */
export function buildStarPet(scene: StoreScene): void {
  scene.starPet = undefined;
  scene.starPetBusy = 0;
  scene.starPetGuests = scene.customers.size;
  const pet = activePet(scene.state);
  if (!pet) return;
  const id = pet.id;
  const home = petSpot(scene.layout, PETS[id].spot);
  const img = scene.art(home.x, home.y, FRAMES[id].idle[0]).setOrigin(0.5, 1).setDepth(home.y + 2);
  img.setData('pet', id);
  scene.starPet = img;
  // Пальцем по маленькой картинке попасть трудно — зона касания шире на 6 точек картинки с каждой стороны.
  img
    .setInteractive(new Phaser.Geom.Rectangle(-6, -6, img.width + 12, img.height + 12), Phaser.Geom.Rectangle.Contains)
    .on('pointerup', () => camera.tap(scene, () => petStarPet(scene)));
  let n = 0;
  const lite = scene.lite;
  scene.worldTimer(lite ? TICK_MS * 2 : TICK_MS, () => {
    if (!img.active) return;
    n++;
    tick(scene, img, id, n, home);
  });
}

/** Тик питомца: кадр по тому, что сейчас (сон, реакция, дело), и мелкие события. */
function tick(scene: StoreScene, img: Phaser.GameObjects.Image, id: PetId, n: number, home: { x: number; y: number }): void {
  const frames = FRAMES[id];
  const now = scene.time.now;
  // Гость зашёл — корги просыпается и виляет попой.
  const guests = scene.customers.size;
  if (guests > scene.starPetGuests && id === 'corgi' && !asleep(scene, id) && scene.starPetBusy < now) react(scene, REACT_MS);
  scene.starPetGuests = guests;
  if (scene.starPetBusy > now) {
    img.setTexture(frames.happy[n % frames.happy.length]);
    return;
  }
  if (asleep(scene, id)) {
    img.setTexture(frames.sleep);
    if (id === 'raccoon') img.setAlpha(1);
    if (n % 12 === 0) pets.petEmote(scene, img, 'emo_zzz');
    return;
  }
  switch (id) {
    case 'parrot':
      img.setTexture(frames.idle[Math.floor(n / 5) % 2]);
      // Изредка говорит словечко (пока магазин открыт).
      if (scene.running && Math.random() < 0.015) say(scene, img);
      break;
    case 'hamster': {
      // Бегает в колесе отрезками: полминуты бега, потом сидит с семечкой.
      const run = scene.running && Math.floor(n / 40) % 3 !== 2;
      img.setTexture(run ? frames.move![n % 3] : frames.idle[0]);
      break;
    }
    case 'corgi':
      img.setTexture(frames.idle[Math.floor(n / 4) % 2]);
      break;
    case 'turtle':
      turtleWalk(scene, img, n, home);
      break;
    case 'bunny':
      img.setTexture(frames.idle[n % 7 === 0 ? 1 : 0]);
      // Иногда подпрыгивает на месте (не в лёгкой графике).
      if (!scene.lite && Math.random() < 0.02) hop(scene, img);
      break;
    case 'raccoon':
      raccoonPeek(scene, img, n);
      break;
  }
}

/** Черепаха: днём сидит у стены, в ночную смену медленно идёт через зал и обратно (в лёгкой графике — сидит). */
function turtleWalk(scene: StoreScene, img: Phaser.GameObjects.Image, n: number, home: { x: number; y: number }): void {
  const frames = FRAMES.turtle;
  if (!scene.night || scene.lite) {
    if (img.x !== home.x && !scene.tweens.isTweening(img)) img.setPosition(home.x, home.y).setFlipX(false);
    img.setTexture(frames.idle[0]);
    return;
  }
  img.setTexture(frames.move![n % 2]);
  if (scene.tweens.isTweening(img)) return;
  // Туда — до середины зала, обратно — домой.
  const far = Math.max(24, home.x - 80);
  const to = Math.abs(img.x - home.x) < 1 ? far : home.x;
  img.setFlipX(to < img.x);
  scene.tweens.add({ targets: img, x: to, duration: (Math.abs(to - img.x) / TURTLE_SPEED) * 1000, ease: 'Linear' });
}

/** Енот выглядывает из двери склада: то спрячется, то покажется и моргнёт; в ночную смену — не прячется. */
function raccoonPeek(scene: StoreScene, img: Phaser.GameObjects.Image, n: number): void {
  const frames = FRAMES.raccoon;
  const hidden = !scene.night && Math.floor(n / 18) % 3 === 2;
  if (scene.lite) img.setAlpha(hidden ? 0 : 1);
  else if ((img.alpha > 0.5) === hidden && !scene.tweens.isTweening(img)) scene.tweens.add({ targets: img, alpha: hidden ? 0 : 1, duration: 300 });
  img.setTexture(frames.idle[n % frames.idle.length]);
}

/** Прыжок крольчихи: вверх и обратно. */
function hop(scene: StoreScene, img: Phaser.GameObjects.Image): void {
  if (scene.tweens.isTweening(img)) return;
  img.setTexture('pet_bunny_hop');
  scene.tweens.add({ targets: img, y: img.y - 3, duration: 160, yoyo: true, ease: 'Quad.easeOut', onComplete: () => img.active && img.setTexture('pet_bunny_0') });
}

/** Попугай говорит: клюв открыт, над ним словечко. */
function say(scene: StoreScene, img: Phaser.GameObjects.Image): void {
  const words = t('pets.parrot.words').split(',');
  const word = words[Math.floor(Math.random() * words.length)].trim();
  img.setTexture('pet_parrot_talk');
  scene.time.delayedCall(500, () => img.active && img.setTexture('pet_parrot_0'));
  sound.pet('chirp', img.x);
  scene.popup(img.x + 4, img.y - img.displayHeight - 2, `«${word}»`, '#e8ffd8');
}

/** На время реакции — кадры радости; енот при этом показывается из-за двери. */
function react(scene: StoreScene, ms: number): void {
  const img = scene.starPet;
  if (!img?.active) return;
  scene.starPetBusy = scene.time.now + ms;
  if (img.getData('pet') === 'raccoon') {
    scene.tweens.killTweensOf(img);
    img.setAlpha(1);
  }
}

/** Погладили: сердечко, голосок, вибрация и имя. Спящий тоже рад — просыпается на минутку. */
export function petStarPet(scene: StoreScene): void {
  const img = scene.starPet;
  const pet = activePet(scene.state);
  if (!img?.active || !pet) return;
  react(scene, REACT_MS);
  sound.pet(VOICE[pet.id], img.x);
  haptic.tap();
  pets.heartAt(scene, img.x, img.y - img.displayHeight);
  if (pet.id === 'bunny' && !scene.lite) hop(scene, img);
  scene.popup(img.x, img.y - img.displayHeight - 6, t('pets.tap', { name: petName(scene, pet.id) }), '#fff3b0');
}

/** Утро: магазин открылся — питомец здоровается. */
export function greetStarPet(scene: StoreScene): void {
  const pet = activePet(scene.state);
  if (!pet) return;
  scene.time.delayedCall(1400, () => {
    const img = scene.starPet;
    if (!img?.active || !scene.running) return;
    react(scene, REACT_MS);
    scene.popup(img.x, img.y - img.displayHeight - 6, t(`pets.greet.${pet.id}` as TextKey, { name: petName(scene, pet.id) }), '#fff3b0');
  });
}

/** Рекордный день: питомец радуется вместе с хозяином. */
export function cheerStarPet(scene: StoreScene): void {
  const img = scene.starPet;
  const pet = activePet(scene.state);
  if (!img?.active || !pet) return;
  react(scene, REACT_MS * 2);
  pets.heartAt(scene, img.x, img.y - img.displayHeight);
  scene.popup(img.x, img.y - img.displayHeight - 6, t('pets.record', { name: petName(scene, pet.id) }), '#fee761');
}
