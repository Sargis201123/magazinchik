// Стойка проката у входа (game/rental.ts, 13.11): на тротуаре у бордюра, рядом с торговцем, но не на нём.
// На стойке — вещи дня: велосипеды и самокаты, санки и ватрушки или зонты на крючках (art/rental.py); сколько их
// видно — по запасу. Днём прохожие подходят, берут вещь и уходят с ней: санки и ватрушку тянут за собой, зонт
// раскрывают над головой, на самокате и велосипеде уезжают; погодя возвращают — вещь снова на стойке. Кто не
// вернёт (столько, сколько посчитала игра на вечер), тот не приходит: место на стойке так и пустеет до утра.
// Денег сцена не считает — их считает вечер (day.ts). В лёгкой графике прохожих с вещами меньше: двое за день и
// по одному на улице (13.11, автор: «в лёгком режиме — меньше прохожих с вещами»).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { DEPOSITS, KIT_ICON, KIT_ITEMS, RENTAL_CAP, rentalDay, rentalKit, rentalOf, type RentalItem, type RentalKit } from '../game/rental';
import { guestsToday } from '../game/day';
import { pitchNow } from '../game/tenants';
import { inZar } from '../game/zarshop';
import { sound } from '../platform/sound';
import { SHIRTS, customerLook } from './common';
import * as camera from './camera';
import * as persons from './persons';
import { pitchSpot, sidewalkSpot } from './tenantsFx';

/** Где на стойке стоит каждая вещь набора (от середины стойки и её низа). */
interface Slot {
  key: string;
  dx: number;
  dy: number;
  /** Висит на крючке (верх картинки — на перекладине). */
  hang?: boolean;
}
const SLOTS: Record<RentalKit, Slot[]> = {
  wheels: [
    { key: 'rent_bike', dx: -6, dy: -1 },
    { key: 'rent_bike', dx: 6, dy: -1 },
    { key: 'rent_kick', dx: -9, dy: 1 },
    { key: 'rent_kick', dx: 3, dy: 1 },
  ],
  // 13.11: санки, прислонённые стоймя, в мире читались красными закорючками — лежат стопкой, как на катке.
  winter: [
    { key: 'rent_sled', dx: -7, dy: 0 },
    { key: 'rent_tube', dx: 7.5, dy: 0 },
    { key: 'rent_sled', dx: -7, dy: -2.5 },
    { key: 'rent_tube', dx: 7.5, dy: -2.8 },
  ],
  rain: [-10, -6, -2, 2, 6, 10].map((dx) => ({ key: 'rent_umbrella', dx, dy: -10.5, hang: true })),
};
/** Сколько прохожих с вещами показать за день (остальные взяли «за кадром») и сколько на улице сразу; в лёгкой — меньше. */
const SHOWN_MAX = 5;
const WALKERS = 2;
const LITE_SHOWN = 2;
const LITE_WALKERS = 1;
/** Как часто к стойке подходит следующий и через сколько возвращают (мс времени игры). */
const RENTER_EVERY = 6000;
const BACK_AFTER: [number, number] = [11000, 19000];
/** Скорость: пешком своим ходом, на самокате и велосипеде быстрее. */
const RIDE_SPEED: Partial<Record<RentalItem, number>> = { bike: 64, kick: 48 };

let objs: Phaser.GameObjects.GameObject[] = [];
let stops: (() => void)[] = [];
/** Вещи на стойке (картинки по местам) и сколько сейчас на руках. */
let slots: Phaser.GameObjects.Image[] = [];
let out = 0;
/** Сегодняшние прохожие: сколько уже подходили и сколько из них не вернут. */
let day = 0;
let taken = 0;
let walkers = 0;

function clear(): void {
  for (const obj of objs) obj.destroy();
  for (const stop of stops.splice(0)) stop();
  objs = [];
  slots = [];
  out = 0;
  walkers = 0;
}

/** Видно столько вещей, сколько их на стойке (запас минус те, что на руках), долей от мест набора. */
function refreshSlots(scene: StoreScene): void {
  const stock = rentalOf(scene.state)?.stock ?? 0;
  const left = Math.max(0, stock - out);
  const n = slots.length;
  const shown = left <= 0 ? 0 : Math.max(1, Math.round((n * left) / RENTAL_CAP));
  slots.forEach((img, i) => img.active && img.setVisible(i < shown));
}

/** Стойка: каждое утро (набор от погоды), после покупки и докупки и при перестройке мира (streets.buildStreet). */
export function applyRental(scene: StoreScene): void {
  clear();
  const state = scene.state;
  const rental = rentalOf(state);
  if (!rental || inZar(state)) return;
  const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
    objs.push(obj);
    return obj;
  };
  const top = scene.streetY - 12;
  // Торговец у входа уже стоит (tenantsFx.buildPitch) — стойка встаёт рядом, а не на него.
  const pitch = pitchNow(state) ? pitchSpot(scene, top).x - scene.layout.door.x : null;
  const { x, y } = sidewalkSpot(scene, top, 17, [44, 56, -44, -56, 68, -68, 92, -92, 116, -116, 140, -140], pitch === null ? [] : [[pitch - 23, pitch + 23]]);
  const kit = rentalKit(state.day);
  const stand = keep(scene.art(x, y + 1, 'rent_stand').setOrigin(0.5, 1).setDepth(y));
  SLOTS[kit].forEach((slot, i) => {
    const img = keep(scene.art(x + slot.dx, y + slot.dy, slot.key));
    img.setOrigin(0.5, slot.hang ? 0 : 1).setDepth(y + 0.1 + i * 0.01);
    slots.push(img);
  });
  // Вывеска на козырьке: та же грифельная доска, что у торговца, надпись мелом.
  const signY = y - 14.5;
  keep(scene.art(x, signY, 'pitch_sign').setDepth(y + 2));
  const label = keep(
    scene.add
      .text(x, signY - 0.2, `${KIT_ICON[kit]} ${t('rental.sign')}`, { fontFamily: UI_FONT, fontSize: '3.4px', color: '#f4f4f4' })
      .setOrigin(0.5)
      .setResolution(scene.textRes(8))
      .setDepth(y + 2.1),
  );
  if (label.width > 18) label.setScale(18 / label.width);
  if (day !== state.day) {
    day = state.day;
    taken = 0;
  }
  refreshSlots(scene);
  // Нажатие: что сегодня на стойке и сколько возьмут (прогноз утра — тот же расчёт, что вечером).
  stand.setInteractive({ useHandCursor: true }).on('pointerup', () =>
    camera.tap(scene, () => {
      sound.tap();
      const now = rentalOf(scene.state);
      const plan = rentalDay(scene.state, guestsToday(scene.state));
      if (!now || !plan) return;
      scene.popup(x, y - 22, t('rental.tap', { icon: KIT_ICON[kit], n: plan.rented, stock: now.stock, max: RENTAL_CAP, sum: DEPOSITS[now.deposit].sum }), '#c8f0ff');
    }),
  );
  const world = scene.worldGen;
  stops.push(
    scene.worldTimer(RENTER_EVERY, () => {
      if (!scene.sys.isActive() || !scene.running || scene.worldGen !== world || walkers >= (scene.lite ? LITE_WALKERS : WALKERS)) return;
      if (day !== scene.state.day) {
        day = scene.state.day;
        taken = 0;
      }
      const plan = rentalDay(scene.state, guestsToday(scene.state));
      const shown = Math.min(plan?.rented ?? 0, scene.lite ? LITE_SHOWN : SHOWN_MAX);
      if (!plan || taken >= shown) return;
      // Последние из показанных — те, кто не вернёт (сколько не вернут за день, столько и здесь, не больше).
      const keeps = taken >= shown - Math.min(plan.lost, shown);
      const item = KIT_ITEMS[kit][taken % KIT_ITEMS[kit].length];
      taken++;
      walkers++;
      void renter(scene, item, x, y, keeps).finally(() => {
        if (scene.worldGen === world) walkers = Math.max(0, walkers - 1);
      });
    }),
  );
}

/**
 * Повесить вещь на человека: велосипед и самокат — под ним, санки и ватрушку — сзади на верёвке, зонт — над головой.
 * Возвращает, как её снять (у стойки вещь возвращают и дальше идут пешком).
 */
function carry(scene: StoreScene, guest: Phaser.GameObjects.Container, item: RentalItem, toRight: boolean): () => void {
  let img: Phaser.GameObjects.Image;
  if (item === 'umbrella') {
    img = scene.art(0, -13, 'rent_umbrella_open');
    guest.add(img);
    // Раскрывается на улице и складывается, когда дождь кончился (motion.ts, как у своих зонтов).
    guest.setData('umbrella', img);
  } else if (item === 'bike' || item === 'kick') {
    img = scene.art(0, item === 'bike' ? 3 : 6, `rent_${item}`).setOrigin(0.5).setFlipX(!toRight);
    guest.addAt(img, 0);
    // Крутит педали или отталкивается — без подскока и пыли (motion.ts).
    guest.setData('wheels', true);
  } else {
    // Санки и ватрушка: верёвка от руки назад, вещь едет по земле позади.
    img = scene.art(toRight ? 1 : -1, 2, `rent_${item}_pull`).setOrigin(toRight ? 1 : 0, 0).setFlipX(!toRight);
    guest.addAt(img, 0);
  }
  return () => {
    img.destroy();
    guest.setData('umbrella', undefined);
    guest.setData('wheels', false);
  };
}

/** Взять со стойки (место пустеет) или вернуть (вещь снова на месте). */
function handOver(scene: StoreScene, x: number, y: number, back: boolean): void {
  out = Math.max(0, out + (back ? -1 : 1));
  refreshSlots(scene);
  if (back) scene.popup(x, y - 16, '👍', '#c8f0ff');
}

/**
 * Прохожий берёт вещь: идёт по тротуару, встаёт перед стойкой, уходит с вещью дальше (на колёсах — краем дороги).
 * Погодя возвращается с того же края и ставит её на место (keeps — не вернёт: тогда место пустеет до утра).
 */
async function renter(scene: StoreScene, item: RentalItem, x: number, y: number, keeps: boolean): Promise<void> {
  const world = scene.worldGen;
  const walkY = scene.streetY + Phaser.Math.Between(-2, 2);
  const front = y + 6;
  const ride = item === 'bike' || item === 'kick';
  const fromLeft = Math.random() < 0.5;
  const side = fromLeft ? -1 : 1;
  // Из-за края квартала и обратно (как прочие прохожие, visitors.passerby).
  const far = (left: boolean) => (left ? -60 : scene.next.w + 60);
  const look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day);
  const alive = (who: Phaser.GameObjects.Container) => who.active && scene.worldGen === world;
  // Путь вдоль улицы: пешком — по тротуару, на колёсах — краем дороги.
  const along = (to: boolean) => (ride ? { x: far(to), y: front + 2 } : { x: far(to), y: walkY });
  const guest = persons.makePerson(scene, far(fromLeft), walkY, look);
  await persons.walkVia(scene, guest, [{ x: x + side * 22, y: walkY }, { x: x + side * 4, y: front }]);
  if (!alive(guest)) return;
  persons.setFacing(guest, 'up');
  await scene.wait(800);
  if (!alive(guest)) return;
  handOver(scene, x, y, false);
  carry(scene, guest, item, fromLeft);
  await persons.walkVia(scene, guest, ride ? [along(!fromLeft)] : [{ x: x - side * 22, y: walkY }, along(!fromLeft)], RIDE_SPEED[item]);
  if (guest.active) guest.destroy();
  if (keeps || scene.worldGen !== world) return;
  await scene.wait(Phaser.Math.Between(...BACK_AFTER));
  // Возвращает тот же человек — с того края, куда уехал.
  const start = along(!fromLeft);
  const back = persons.makePerson(scene, start.x, start.y, look);
  const drop = carry(scene, back, item, !fromLeft);
  await persons.walkVia(scene, back, ride ? [{ x: x - side * 4, y: front }] : [{ x: x - side * 22, y: walkY }, { x: x - side * 4, y: front }], RIDE_SPEED[item]);
  if (!alive(back)) return;
  persons.setFacing(back, 'up');
  await scene.wait(600);
  if (!alive(back)) return;
  drop();
  handOver(scene, x, y, true);
  // Дальше — пешком по тротуару, без вещи.
  await persons.walkVia(scene, back, [{ x: x + side * 22, y: walkY }, { x: far(fromLeft), y: walkY }]);
  if (back.active) back.destroy();
}
