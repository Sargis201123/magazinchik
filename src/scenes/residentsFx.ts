// Жители района на улице (game/residents.ts, art/residents.py; 13.11). Ближние к магазину дома задней улицы
// (streets.ts buildBackStreet) — дома жителей: по четыре квартиры-окна, RES_FLATS всего. Заселённые вечером светятся,
// в пустых висит листок «Сдаётся». В день переезда у подъезда стоит мебельный фургон, рядом — коробки, грузчик носит
// вещи (в лёгкой графике — без фургона и грузчика, только окна). Число семей и фургон меняются утром: тогда сцена
// перестраивает мир (morningFlow.ts, residentsLook), как при новом здании района.

import type { StoreScene } from './StoreScene';
import { RES_FLATS, movingFlat, movingToday, residents } from '../game/residents';
import { inZar } from '../game/zarshop';
import { CUSTOMER_SPEED, randomLook, SHIRTS } from './common';
import * as persons from './persons';
import { outsideDepth } from './cars';

/** Окна жилого дома (смещения от двери) — streets.ts home рисует их в этом же порядке. */
export const HOME_WINDOWS = [-28, -15, 15, 28];
const PER_HOME = HOME_WINDOWS.length;
const RES_HOMES = RES_FLATS / PER_HOME;
/**
 * Квартира k — в доме k % RES_HOMES (дома по близости к магазину), окно — по своему порядку у каждого дома:
 * заселение идёт вразбивку по всем домам, а не «первый дом целиком, потом второй».
 */
const WINDOW_ORDER = [
  [1, 2, 0, 3],
  [2, 0, 3, 1],
  [0, 3, 1, 2],
  [3, 1, 2, 0],
  [1, 3, 0, 2],
];

export interface HomeFlats {
  /** Пустые окна (по HOME_WINDOWS). */
  empty: boolean[];
  /** Сегодня у этого подъезда переезд. */
  moving: boolean;
}

/**
 * Какие дома — жителей и что в их окнах. homesX — левые края домов северной стороны, center — середина магазина.
 * Возвращает по левому краю дома; дальние дома (не в карте) живут как раньше — все окна светятся.
 */
export function flatsOf(scene: StoreScene, homesX: number[], homeW: number, center: number): Map<number, HomeFlats> {
  const out = new Map<number, HomeFlats>();
  if (inZar(scene.state)) return out;
  const near = [...homesX].sort((a, b) => Math.abs(a + homeW / 2 - center) - Math.abs(b + homeW / 2 - center)).slice(0, RES_HOMES);
  for (const x of near) out.set(x, { empty: HOME_WINDOWS.map(() => false), moving: false });
  const n = residents(scene.state);
  const move = movingFlat(scene.state);
  for (let k = 0; k < near.length * PER_HOME; k++) {
    const rank = k % near.length;
    const home = out.get(near[rank])!;
    const win = WINDOW_ORDER[rank % WINDOW_ORDER.length][Math.floor(k / near.length)];
    home.empty[win] = k >= n;
    if (k === move) home.moving = true;
  }
  return out;
}

/** Окно пустой квартиры: листок «Сдаётся» поверх стекла. */
export function rentSign(scene: StoreScene, x: number, y: number): void {
  scene.art(x, y, 'res_rent').setDepth(-2.75);
}

/**
 * Переезд у подъезда (north — дом к северу от улицы, фасадом вниз): фургон в верхней полосе задними дверями к
 * дорожке, коробки на тротуаре и грузчик, который носит вещи — в дом (въехали) или из дома (съехали).
 */
export function moving(scene: StoreScene, doorX: number, doorY: number, walkY: number, laneY: number): void {
  const m = movingToday(scene.state);
  if (!m) return;
  void frontTrips(scene, m.dir);
  if (scene.lite) return;
  scene.art(doorX + 30, laneY, 'res_truck').setDepth(outsideDepth(laneY));
  scene.art(doorX - 16, walkY - 3, 'res_boxes').setDepth(outsideDepth(walkY));
  const mover = persons.makePerson(scene, doorX + 6, laneY + 2, randomLook(SHIRTS[0]));
  mover.setDepth(outsideDepth(laneY + 2));
  const box = scene.art(0, -1, 'box').setScale(0.55 / 2);
  mover.add(box);
  const world = scene.worldGen;
  const depth = (y: number) => outsideDepth(y);
  // Въехали — несёт в дом, съехали — из дома в фургон. Мир перестроили — цикл кончается (walk не вернётся).
  const loop = async () => {
    while (world === scene.worldGen && mover.active) {
      box.setVisible(m.dir > 0);
      await persons.walkVia(scene, mover, [{ x: doorX + 1, y: walkY }, { x: doorX, y: doorY }], 22, { depth, direct: true });
      await scene.wait(700);
      box.setVisible(m.dir < 0);
      await persons.walkVia(scene, mover, [{ x: doorX + 1, y: walkY }, { x: doorX + 6, y: laneY + 2 }], 22, { depth, direct: true });
      await scene.wait(900);
    }
  };
  void loop();
}

/** Сколько раз за день переезда грузчик с коробкой проходит мимо магазина (в лёгкой графике — реже). */
const FRONT_TRIPS = 3;
const FRONT_TRIPS_LITE = 1;

/**
 * 13.11, ревью: задняя улица в обычном кадре — под верхней панелью, фургон там мало кто увидит. Поэтому в день переезда
 * грузчик с коробкой проходит и по тротуару перед магазином (как прохожие, visitors.ts), а у двери над ним всплывает 📦.
 * Въехали — несёт от края квартала к домам (влево), съехали — от домов прочь (вправо). Без тряски камеры, только люди.
 */
async function frontTrips(scene: StoreScene, dir: 1 | -1): Promise<void> {
  const world = scene.worldGen;
  const trips = scene.lite ? FRONT_TRIPS_LITE : FRONT_TRIPS;
  for (let i = 0; i < trips; i++) {
    await scene.wait(i ? 9000 + Math.random() * 9000 : 2500);
    if (world !== scene.worldGen) return;
    const left = -60;
    const right = scene.next.w + 60;
    const toLeft = dir > 0;
    const y = scene.streetY + 2 + Math.round(Math.random() * 4);
    const mover = persons.makePerson(scene, toLeft ? right : left, y, randomLook(SHIRTS[0]));
    // Коробка крупнее, чем у грузчика на задней улице: в обычном кадре её должно быть видно издалека.
    mover.add(scene.art(0, -2, 'box').setScale(0.8 / 2));
    const door = scene.layout.door.x;
    // Шаг у человека свой (persons.ownPace), поэтому не считаем время, а смотрим, когда он поравнялся с дверью.
    const watch = scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        if (!mover.active || world !== scene.worldGen) return watch.remove();
        if ((mover.x - door) * (toLeft ? 1 : -1) > 0) return;
        scene.popup(mover.x, mover.y - 18, '📦', '#ead4aa');
        watch.remove();
      },
    });
    await persons.walk(scene, mover, toLeft ? left : right, y, CUSTOMER_SPEED * 0.7);
    watch.remove();
    if (mover.active) mover.destroy();
  }
}
