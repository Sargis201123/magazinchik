// Сбывшиеся мечты соседей на улице (game/dreams.ts, art/dreams.py; 13.11): у входа — кофейная тележка Кости, за ней
// сам Костя, над кофемашиной идёт пар; дальше по тротуару — указатель к лодочной станции Петра Ильича. Нажатие —
// что это даёт. Хлеб от Ани видно в закупке (цена ниже), а деньги Ахмеда — в кассе, на улице их нет.
// Перерисовывается утром, после ответа на новость и при перестройке мира (как уголки своей марки, brandLines.ts).
// Тележка встаёт туда, где свободно: не на торговца сезона, не на лотки недели и ярмарки (tenantsFx.entranceBusy).

import type { StoreScene } from './StoreScene';
import type Phaser from 'phaser';
import { t } from '../i18n';
import { BOAT_GUESTS, cartHere, cartIncome, dreamCame } from '../game/dreams';
import { livedRegular } from '../game/life';
import { regularById } from '../game/regulars';
import { pitchNow } from '../game/tenants';
import { inZar } from '../game/zarshop';
import { sound } from '../platform/sound';
import * as camera from './camera';
import * as food from './food';
import * as persons from './persons';
import { entranceBusy, nearLamp, pitchSpot } from './tenantsFx';

/** Полуширина тележки и указателя (точек мира) и где их пробовать ставить (x от двери). */
const CART_HALF = 14;
/** Костя стоит слева от тележки: столько ещё занимает он сам. */
const KOSTYA_W = 8;
const CART_SPOTS = [-56, 68, -68, 84, -84, 100, -100, 124, -124, 152, -152];
/** Скамейка и урна у входа (streets.buildStreet: +44 и −32) — тележку на них не ставим. */
const BENCH_BIN: [number, number][] = [
  [32, 56],
  [-38, -26],
];
const SIGN_HALF = 6;
const SIGN_SPOTS = [182, -182, 206, -206, 230];
/** Как часто идёт пар над кофемашиной (мс). */
const STEAM_EVERY = 1500;

/** Что нарисовано сейчас — убрать перед новой отрисовкой (поля сцены не трогаем). */
const drawn = new WeakMap<StoreScene, { objs: Phaser.GameObjects.GameObject[]; stops: (() => void)[] }>();

function clear(scene: StoreScene): void {
  const old = drawn.get(scene);
  if (!old) return;
  for (const stop of old.stops) stop();
  for (const obj of old.objs) obj.destroy();
  drawn.delete(scene);
}

/**
 * Первое свободное место из списка: не на занятом и не на фонарном столбе. Фонари — через 72 от −100 (streets.ts).
 * left/right — сколько вещь занимает влево и вправо от середины (у тележки слева стоит сам Костя): 13.11 Костя
 * встал ровно на столб — проверяли только середину тележки.
 */
function spot(busy: [number, number][], spots: number[], left: number, right: number, d: number): number | null {
  const lampIn = (a: number, b: number) => -100 + 72 * Math.ceil((a + 100) / 72) <= b;
  return spots.find((dx) => busy.every(([a, b]) => dx + right <= a || dx - left >= b) && !nearLamp(d + dx) && !lampIn(d + dx - left - 2, d + dx + right + 2)) ?? null;
}

/** Нажатие на вещь — подпись над ней: что даёт сбывшаяся мечта. */
function tappable(scene: StoreScene, obj: Phaser.GameObjects.Image, text: () => string): void {
  obj.setInteractive({ useHandCursor: true }).on('pointerup', () =>
    camera.tap(scene, () => {
      sound.tap();
      scene.popup(obj.x, obj.y - obj.displayHeight - 4, text(), '#fff3b0');
    }),
  );
}

export function applyDreams(scene: StoreScene): void {
  clear(scene);
  const state = scene.state;
  const cart = cartHere(state);
  const boat = !inZar(state) && Boolean(dreamCame(state, 'petr'));
  if (!cart && !boat) return;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const stops: (() => void)[] = [];
  drawn.set(scene, { objs, stops });
  const d = scene.layout.door.x;
  const top = scene.streetY - 12;
  const y = top + 19;
  const busy = [...entranceBusy(state, d), ...BENCH_BIN];
  // Торговец сезона встал раньше (streets.buildStreet) — тележка его обходит.
  if (pitchNow(state)) {
    const p = pitchSpot(scene, top);
    busy.push([p.x - d - 22, p.x - d + 22]);
  }
  if (cart) {
    const dx = spot(busy, CART_SPOTS, CART_HALF + KOSTYA_W, CART_HALF, d);
    if (dx !== null) {
      busy.push([dx - CART_HALF - KOSTYA_W, dx + CART_HALF]);
      const x = d + dx;
      const img = scene.art(x, y + 1, 'dream_cart').setOrigin(0.5, 1).setDepth(y);
      objs.push(img);
      tappable(scene, img, () => `☕ ${t('dream.kostya.name')} · ${t('dream.perk.cart', { n: cartIncome(scene.state) })}`);
      // Сам Костя — у тележки, без коляски (малыш дома, life.ts).
      const { stroller: _s, ...look } = livedRegular(state, regularById('kostya')).look;
      // Человечек стоит ногами на 9 точек ниже своей середины (persons.makePerson) — встаёт вровень с колёсами.
      const kostya = persons.makePerson(scene, x - CART_HALF - 2, y - 7, look);
      scene.people.delete(kostya);
      persons.setFacing(kostya, 'down');
      kostya.setDepth(y + 0.5);
      objs.push(kostya);
      if (!scene.lite) {
        // Переминается и поглядывает на прохожих; над кофемашиной — пар, пока магазин открыт.
        const sway = scene.tweens.add({ targets: kostya, x: kostya.x + 1.5, duration: 1700, yoyo: true, repeat: -1, repeatDelay: 2600 });
        stops.push(() => sway.remove());
        stops.push(scene.worldTimer(STEAM_EVERY, () => scene.running && img.active && food.steamPuff(scene, x - 4, y - 16)));
      }
    }
  }
  if (boat) {
    const dx = spot(busy, SIGN_SPOTS, SIGN_HALF, SIGN_HALF, d);
    if (dx !== null) {
      const sign = scene.art(d + dx, y + 1, 'dream_boat_sign').setOrigin(0.5, 1).setDepth(y);
      objs.push(sign);
      tappable(scene, sign, () => `⛵ ${t('dream.petr.name')} · ${t('dream.perk.boat', { p: Math.round(BOAT_GUESTS * 100) })}`);
    }
  }
}
