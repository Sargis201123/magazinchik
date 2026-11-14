// Беда района в зале и на улице (game/crisis.ts; 13.11). На улице — погода беды поверх обычной
// (weatherFx.applyWeather берёт weatherToday: жара, снег, ливень) и её вещи: мешки с песком у входа
// и разлив на дороге в паводок, сугробы в буран, объявление на двери и бочка-водовоз, когда отключили воду,
// в жару — солнце бьёт в глаза. В зале первые гости дня бегут за водой и хлебом один за другим (очередь
// у полки и кассы), а если хозяин раздаёт — к открытию заходят старики за своим и благодарят.
// Камера не трясётся; в лёгком режиме — меньше людей, без бликов и без лишних частиц.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { crisisGive, crisisToday, staplesToday } from '../game/crisis';
import { sellableProducts, type ProductId } from '../game/economy';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { ART, FACADE_H, LIGHT_DEPTH, randomLook } from './common';
import { wearOf } from './archetypes';
import * as persons from './persons';
import * as effects from './effects';
import * as visitors from './visitors';
import * as building from './building';
import * as pixelFx from './pixelFx';

type Keep = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

/** Сколько первых гостей бегут за товарами первой нужды и через сколько секунд друг за другом. */
const RUSH = 4;
const RUSH_LITE = 2;
export const RUSH_GAP = 0.7;
/** Старики, которым раздают (видно в зале): не больше стольких за утро. */
const ELDERS = 3;

/** Что нарисовано на улице сейчас (утро сравнивает — перерисовать ли погоду). */
export const crisisLook = (scene: StoreScene): string => crisisToday(scene.state)?.kind ?? '';

/** Вещи беды на улице — вместе с погодой (weatherFx.applyWeather), её же списком keep. */
export function dress(scene: StoreScene, keep: Keep): void {
  const c = crisisToday(scene.state);
  scene.builtCrisis = c?.kind ?? '';
  if (!c) return;
  const { door, h } = scene.layout;
  const front = h + FACADE_H;
  const top = scene.next.h + 4;
  const rnd = new Phaser.Math.RandomDataGenerator([`crisis${c.from}`]);
  if (c.kind === 'flood') {
    // Мешки с песком по бокам от входа, на дороге — разлив: большие лужи поверх мокрого асфальта.
    for (const side of [-1, 1]) keep(scene.art(door.x + side * 24, front + 12, 'crisis_sandbags').setOrigin(0.5, 1).setDepth(front + 12));
    for (let i = 0; i < (scene.lite ? 3 : 7); i++) {
      const x = door.x - 200 + rnd.frac() * 400;
      keep(scene.art(x, rnd.pick([top + 24, top + 40, top + 58]), 'puddle_wet').setScale(2.6 / ART, 1.8 / ART).setAlpha(0.9).setDepth(-8.8));
    }
  } else if (c.kind === 'blizzard') {
    // Сугробы у фасада и вдоль бордюра; метёт вбок — второй, косой снег поверх обычного.
    for (const dx of [-46, 44]) keep(scene.art(door.x + dx, front + 9, 'crisis_drift').setOrigin(0.5, 1).setDepth(front + 9));
    for (let i = 0; i < (scene.lite ? 2 : 5); i++) {
      const x = door.x - 220 + rnd.frac() * 440;
      if (Math.abs(x - door.x) < 30) continue;
      keep(scene.art(x, top + 2, 'crisis_drift').setOrigin(0.5, 1).setFlipX(rnd.frac() < 0.5).setDepth(top + 2));
    }
    if (!scene.lite) {
      keep(scene.add.particles(0, 0, 'snowflake', {
        x: { min: -200, max: scene.next.w + 200 },
        y: -140,
        speedY: { min: 40, max: 70 },
        speedX: { min: -70, max: -40 },
        scale: { min: 1 / ART, max: 1.8 / ART },
        lifespan: ((scene.next.h + 600) / 50) * 1000,
        quantity: 2,
        frequency: 40,
      })).setDepth(-5);
    }
  } else if (c.kind === 'water') {
    // Объявление на двери и бочка-водовоз на тротуаре — между фонарями справа от входа (streets.ts ставит
    // их через 72 px от x = −100): у стены тесно (скамейка, доска, домик кота), на дороге — машины.
    keep(scene.art(door.x + 14, front - 4, 'crisis_notice').setDepth(front + 1));
    const lamp = -100 + 72 * Math.ceil((door.x + 20 + 100) / 72);
    keep(scene.art(lamp + 36, top + 20, 'crisis_cistern').setOrigin(0.5, 1).setDepth(top + 20));
  } else if (c.kind === 'heat' && !scene.lite) {
    // Солнце бьёт в глаза: тёплый блик над кварталом, чуть дышит (марево — у погоды «жара»).
    // 13.11, ревью: блик лежит над картой света, и сам он с вечером не гаснет — гасим, как облака
    // (lighting.ts dayLife: к сумеркам на нет), а ночной сменой его нет совсем. Иначе солнце светит ночью.
    const sun = keep(scene.art(door.x - 160, -90, 'glow'))
      .setDisplaySize(520, 420)
      .setTint(0xfff0b8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.22)
      .setDepth(LIGHT_DEPTH + 2);
    const breath = { v: 0 };
    const tween = scene.tweens.add({
      targets: breath,
      v: 1,
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (sun.active) sun.setAlpha(scene.night ? 0 : (0.22 + 0.08 * breath.v) * Phaser.Math.Clamp(1 - scene.evening * 2.5, 0, 1));
      },
    });
    sun.once('destroy', () => tween.remove());
  }
}

/**
 * Открытие дня беды (morningFlow.prepareDay): первые гости — за водой и хлебом; если хозяин решил раздавать —
 * раздача к открытию (game/crisis.ts crisisGive) и старики в зале.
 */
export function openDay(scene: StoreScene): void {
  scene.crisisRush = 0;
  const c = crisisToday(scene.state);
  if (!c) return;
  scene.crisisRush = scene.lite ? RUSH_LITE : RUSH;
  const gave = crisisGive(scene.state);
  if (!gave.given.length) return;
  scene.state = gave.state;
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  const { counter } = scene.layout;
  scene.time.delayedCall(1200, () => scene.running && scene.popup(counter.x, counter.y - 20, t('crisis.gave', { n: gave.given.length }), '#c8ffb0'));
  const n = Math.min(scene.lite ? 1 : ELDERS, gave.given.length);
  for (let i = 0; i < n; i++) void elder(scene, gave.given[i], 1800 + i * 1700, i);
}

/** Гость из первых в день беды: за чем пришёл (null — обычный гость). */
export function rushWants(scene: StoreScene): ProductId[] | null {
  if (scene.crisisRush <= 0) return null;
  const sellable = sellableProducts(scene.state);
  const pool = staplesToday(scene.state).filter((id) => sellable.includes(id));
  if (!pool.length) return null;
  return Phaser.Utils.Array.Shuffle([...pool]).slice(0, Phaser.Math.Between(1, 2));
}

/** Первый из бегущих за водой говорит, что творится. */
export function rushSay(scene: StoreScene, sprite: Phaser.GameObjects.Container): void {
  const c = crisisToday(scene.state);
  if (!c || scene.crisisRush !== (scene.lite ? RUSH_LITE : RUSH)) return;
  scene.time.delayedCall(1100, () => sprite.active && scene.speak(sprite, 16, t(`crisis.rush.${c.kind}` as TextKey)));
}

/** Старик или бабушка заходит за водой (хлебом): хозяин протягивает через прилавок, тот благодарит и уходит. */
async function elder(scene: StoreScene, id: ProductId, delay: number, i: number): Promise<void> {
  await scene.wait(delay);
  if (!scene.running) return;
  const world = scene.worldGen;
  const { door, queue, counter, h } = scene.layout;
  const look = { ...randomLook(0x8b9bb4), ...wearOf(i % 2 ? 'babushka' : 'pensioner', Math.random) };
  const side = i % 2 ? 1 : -1;
  const sprite = persons.makePerson(scene, door.x + side * 70, scene.streetY, look);
  const alive = () => sprite.active && scene.worldGen === world;
  await persons.walkVia(scene, sprite, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
    // У кассы, сбоку от очереди — не мешает тем, кто платит.
    { x: queue.x + 16 + i * 6, y: queue.y + 12 },
  ], 26);
  if (!alive()) return;
  persons.setFacing(sprite, 'up');
  // Товар — через прилавок в руки.
  const gift = scene.art(counter.x, counter.y - 10, `item_${id}`).setDepth(sprite.y + 30);
  scene.tweens.add({ targets: gift, x: sprite.x, y: sprite.y - 10, duration: 520, ease: 'Sine.easeOut', onComplete: () => gift.destroy() });
  await scene.wait(600);
  if (!alive()) return;
  effects.emote(scene, sprite, 'emo_heart');
  pixelFx.burst(scene, 'hearts', sprite.x, sprite.y, { fade: 1100, zoom: 1 });
  sound.thanks(sprite.x, false);
  // Спасибо — чуть позже сердечка: иначе значок над головой закрывает первые буквы.
  scene.time.delayedCall(600, () => alive() && scene.speak(sprite, 16, t(`crisis.thanks.${i % 3}` as TextKey)));
  await scene.wait(1500);
  if (!alive()) return;
  await persons.walkVia(scene, sprite, [{ x: door.x, y: door.y - 10 }, { x: door.x, y: h + 16 }], 26);
  if (alive()) void visitors.strollAway(scene, sprite);
}
