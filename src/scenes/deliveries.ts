// Доставки: заказы на дом (звонок с карточкой заказа ui/delivery.ts, сборка посылки хозяином или
// сотрудником, курьер на велосипеде, самокате или фургоне, оплата), фургон с утренней закупкой к складу
// и срочные заказы управляющего. Правила и деньги — game/delivery.ts и game/urgent.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { PRODUCTS, warehouseCapacity, warehouseCount, type ProductId } from '../game/economy';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { hasUpgrade } from '../game/upgrades';
import { unitsPerBox } from './layout';
import { Halo } from './halo';
import { orderUrgent, receiveUrgent, URGENT_SECONDS } from '../game/urgent';
import { autoArrived, autoTopUp } from '../game/autoorder';
import { showUrgent } from '../ui/urgent';
import { modalOpen } from '../platform/frameCap';
import {
  deliveryRating,
  deliveryTip,
  makeHomeOrder,
  nextCallIn,
  ORDER_TIMEOUT,
  orderUnits,
  outcomeFor,
  packHomeOrder,
  rateDelivery,
  vehicleOf,
  type HomeOrder,
  type Vehicle,
} from '../game/delivery';
import { clock } from '../ui/delivery';
import { ART, FACADE_H, LIGHT_DEPTH, SELLER_SPEED, randomLook, type Worker, type Parcel, CALL_CARD_TIP } from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as cars from './cars';
import * as staff from './staff';
import * as persons from './persons';
import * as camera from './camera';
import * as building from './building';

/** Сколько мс укладывают одну штуку заказа в коробку (и ещё немного — закрыть и заклеить). */
const PACK_UNIT_MS = 380;
const PACK_CLOSE_MS = 450;

/** Если позвонить некуда (курьеру некуда брать или телефон занят) — перезвонят через столько секунд. */
const RETRY_CALL = 4;
const packMs = (order: HomeOrder): number => orderUnits(order) * PACK_UNIT_MS + PACK_CLOSE_MS;
/** Фургончик курьера — оранжевый, как его кепка. */
const VAN_TINT = 0xf9a25c;

// ---------- Доставка на дом ----------

/** Телефон на кассе и курьер у входа со своим транспортом (если доставка куплена). */
export function buildDelivery(scene: StoreScene): void {
  // Мир перестраивают только между днями; что осталось от прошлого зала — отпускаем.
  scene.callTimer?.remove();
  scene.callTimer = undefined;
  endCall(scene);
  scene.parcels = [];
  scene.packRequested = false;
  scene.deliveryUi.setPill(null);
  scene.phone = undefined;
  scene.phoneGlow = undefined;
  scene.courier = undefined;
  scene.courierRide = undefined;
  scene.courierBusy = false;
  scene.courierTrip = null;
  if (!hasUpgrade(scene.state, 'delivery')) return;
  const { counter, door, h } = scene.layout;
  scene.phone = scene.art(counter.x - 5, counter.y - 9, 'phone').setDepth(counter.y + 22);
  // Звонит — светится ореолом (а не эффектом со своим проходом отрисовки).
  scene.phoneGlow = new Halo(scene, scene.phone, 0xfee761);
  // Касание телефона тоже принимает заказ, но главное «Принять» — в карточке внизу (ui/delivery.ts):
  // телефон в пару точек пальцем почти не попасть, а рядом — касса со своей зоной касания. Поэтому
  // телефон ловит касания, только пока звонит, — в остальное время они достаются кассе.
  scene.phone.setInteractive(new Phaser.Geom.Rectangle(-6, -6, 24, 23), Phaser.Geom.Rectangle.Contains).on('pointerup', () => camera.tap(scene, () => acceptOrder(scene)));
  scene.phone.disableInteractive();
  // Курьер ждёт у входа рядом со своим велосипедом или мопедом; фургончик подъезжает, когда есть что везти.
  const at = { x: door.x - 36, y: h + FACADE_H + 9 };
  scene.courierHome = at;
  const vehicle = vehicleOf(scene.state);
  if (vehicle.id !== 'van') scene.courierRide = scene.art(at.x + 9, at.y + 2, vehicle.id).setDepth(at.y + 1);
  scene.courier = persons.makePerson(scene, at.x, at.y, { ...randomLook(0xf77622), style: 'cap', hair: 0xf77622, bag: 'backpack', bagTint: 0xe43b44 });
}

/**
 * Следующий звонок: через случайное время, с хорошим транспортом и рейтингом доставки — чаще.
 * Без доставки случайное число не тратим: остальной день идёт по тем же случайностям, что и раньше.
 */
export function scheduleOrder(scene: StoreScene, seconds?: number): void {
  scene.callTimer?.remove();
  scene.callTimer = undefined;
  if (!scene.phone) return;
  scene.callTimer = scene.time.delayedCall((seconds ?? nextCallIn(scene.state, Math.random)) * 1000, () => ringPhone(scene));
}

/** Сколько принятых заказов ещё не уехало (собираются или ждут курьера у двери). */
export function parcelsWaiting(scene: StoreScene): number {
  return scene.parcels.filter((p) => p.stage !== 'riding').length;
}

/** Звонок: телефон трезвонит и светится, внизу экрана — карточка заказа с кнопками. */
export function ringPhone(scene: StoreScene): void {
  scene.callTimer = undefined;
  const phone = scene.phone;
  if (!phone?.active || !scene.running || scene.night || scene.timeLeft < ORDER_TIMEOUT + 3) return;
  // Курьеру уже некуда брать или игрок в окне (срочный подвоз, особый гость) — перезвонят чуть позже,
  // заказ не пропадает.
  if (scene.call || parcelsWaiting(scene) >= vehicleOf(scene.state).queue || modalOpen()) {
    scheduleOrder(scene, RETRY_CALL);
    return;
  }
  const order = makeHomeOrder(scene.state, Math.random);
  if (!order) {
    scheduleOrder(scene);
    return;
  }
  scene.call = {
    order,
    at: scene.dayClock(),
    timer: scene.time.delayedCall(ORDER_TIMEOUT * 1000, () => missCall(scene)),
    // Трель — раз в полторы секунды, пока не ответили; трубка подпрыгивает чаще.
    ringer: scene.time.addEvent({ delay: 1500, loop: true, callback: () => ringOnce(scene) }),
    shake: scene.time.addEvent({ delay: 110, loop: true, callback: () => phone.active && phone.setTexture(phone.texture.key === 'phone' ? 'phone_ring' : 'phone') }),
  };
  ringOnce(scene);
  phone.setInteractive();
  haptic.tap();
  scene.popup(phone.x, phone.y - 14, t('popup.order'), '#fff3b0');
  // Телефон крупнее, светится, от него расходятся кольца — видно, где звонит.
  scene.tweens.add({ targets: phone, scale: 1.6 / ART, duration: 180, ease: 'Back.easeOut' });
  scene.phoneHalo = scene.add.circle(phone.x, phone.y, 5).setStrokeStyle(1.2, 0xfee761, 1).setDepth(LIGHT_DEPTH + 12);
  scene.tweens.add({ targets: scene.phoneHalo, scale: 2.6, alpha: { from: 0.95, to: 0 }, duration: 750, repeat: -1, ease: 'Quad.easeOut' });
  scene.deliveryUi.showCall({
    order,
    waiting: parcelsWaiting(scene),
    top: registerLow(scene),
    onAccept: () => acceptOrder(scene),
    onDecline: () => declineOrder(scene),
  });
}

/** Одна трель: звонок и трубка покачивается. */
export function ringOnce(scene: StoreScene): void {
  const phone = scene.phone;
  if (!phone?.active) return;
  sound.phone(phone.x);
  scene.tweens.add({ targets: phone, angle: { from: -14, to: 14 }, duration: 60, yoyo: true, repeat: 5, onComplete: () => phone.active && phone.setAngle(0) });
}

/** Касса в нижней части экрана: карточку звонка ставим сверху, чтобы не закрыть её. */
export function registerLow(scene: StoreScene): boolean {
  const view = scene.cameras.main.worldView;
  return (scene.layout.counter.y - view.y) / view.height > 0.55;
}

/** Звонок кончился (ответили, отказали, не дождались, день кончился): телефон стихает, карточка уезжает. */
export function endCall(scene: StoreScene): { order: HomeOrder; at: number } | null {
  const call = scene.call;
  scene.call = null;
  scene.deliveryUi.hideCall(!call);
  if (scene.phoneHalo) {
    scene.tweens.killTweensOf(scene.phoneHalo);
    scene.phoneHalo.destroy();
  }
  scene.phoneHalo = undefined;
  if (!call) return null;
  call.timer.remove();
  call.ringer.remove();
  call.shake.remove();
  // Карточку звонка игрок увидел — подробная подсказка больше не нужна.
  if (!(scene.state.seenTips ?? []).includes(CALL_CARD_TIP)) scene.state = { ...scene.state, seenTips: [...(scene.state.seenTips ?? []), CALL_CARD_TIP] };
  const phone = scene.phone;
  if (phone?.active) {
    scene.tweens.killTweensOf(phone);
    phone.setTexture('phone').setAngle(0).setScale(1 / ART).disableInteractive();
  }
  scene.phoneGlow?.set(0);
  return call;
}

/** Не ответили вовремя: заказ ушёл, рейтинг доставки падает — звонить будут реже. */
export function missCall(scene: StoreScene): void {
  if (!endCall(scene)) return;
  sound.bad();
  if (scene.phone) scene.popup(scene.phone.x, scene.phone.y - 14, t('popup.orderMissed'), '#ffd0d0');
  scene.state = rateDelivery(scene.state, 'missed');
  scene.stats.deliveryMissed = (scene.stats.deliveryMissed ?? 0) + 1;
  scheduleOrder(scene);
}

/** Отказали: вежливо — рейтинг падает меньше, чем за пропущенный звонок. */
export function declineOrder(scene: StoreScene): void {
  if (!endCall(scene)) return;
  haptic.tap();
  if (scene.phone) scene.popup(scene.phone.x, scene.phone.y - 14, t('popup.orderDeclined'), '#fff3b0');
  scene.state = rateDelivery(scene.state, 'declined');
  scene.stats.deliveryMissed = (scene.stats.deliveryMissed ?? 0) + 1;
  scheduleOrder(scene);
}

/** Приняли (кнопкой, касанием телефона или трубку снял менеджер): товар откладываем, заказ — собирать. */
export function acceptOrder(scene: StoreScene): void {
  const phone = scene.phone;
  const call = endCall(scene);
  if (!call || !phone) return;
  const packed = packHomeOrder(scene.state, call.order);
  if (!packed) {
    // Пока звонили, последнее раскупили.
    sound.bad();
    scene.popup(phone.x, phone.y - 14, t('popup.orderNoStock'), '#ffd0d0');
    scene.state = rateDelivery(scene.state, 'noStock');
    scene.stats.deliveryMissed = (scene.stats.deliveryMissed ?? 0) + 1;
    scheduleOrder(scene);
    return;
  }
  scene.state = packed;
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  haptic.success();
  sound.good();
  scene.parcels.push({ order: call.order, calledAt: call.at, stage: 'wait', packed: 0 });
  scene.popup(phone.x, phone.y - 14, t('popup.orderPack'), '#c8ffb0');
  // Собирают менеджер или грузчик (их циклы сами берут заказ), а без них — хозяин, как только освободится.
  if (!staffPacks(scene)) scene.packRequested = true;
  scheduleOrder(scene);
}

/** Кто собирает заказы: менеджер в зале или грузчик на смене; иначе — сам хозяин. */
export function staffPacks(scene: StoreScene): boolean {
  return scene.managerOnFloor || scene.workers.has('loader');
}

export function nextParcel(scene: StoreScene): Parcel | undefined {
  return scene.parcels.find((p) => p.stage === 'wait');
}

/**
 * Укладка заказа: рядом с упаковщиком открытая коробка, товар по штуке прыгает в неё с «чпок»,
 * над головой — полоска. Возвращает «бросить»: позвали к кассе — коробка и полоска пропадают.
 */
export function packFx(scene: StoreScene, who: Phaser.GameObjects.Container, parcel: Parcel, ms: number): () => void {
  const x = who.x + 9;
  const y = who.y + 5;
  const units = parcel.order.items.flatMap(({ id, qty }) => Array.from({ length: qty }, () => id));
  const box = scene.art(x, y, 'parcel').setDepth(y + 1);
  // Светлая каёмка: полоска не теряется на тёмных стеллажах склада.
  const bar = scene.add.rectangle(who.x - 9, who.y - 22, 18, 4, 0x181425).setStrokeStyle(0.6, 0xfee761).setOrigin(0, 0.5).setDepth(1000);
  const fill = scene.add.rectangle(who.x - 8, who.y - 22, 0, 2, 0x63c74d).setOrigin(0, 0.5).setDepth(1001);
  const parts: Phaser.GameObjects.GameObject[] = [box, bar, fill];
  scene.tweens.add({ targets: fill, width: 16, duration: ms });
  // Штуки ложатся за первые 4/5 времени, остальное — закрыть и заклеить коробку.
  const step = (ms * 0.8) / Math.max(1, units.length);
  const timers = units.map((id, i) =>
    scene.time.delayedCall(step * (i + 0.5), () => {
      if (!box.active) return;
      parcel.packed = i + 1;
      sound.shelf(PRODUCTS[id].category, i, x);
      if (scene.lite) return;
      const item = scene.art(who.x, who.y - 12, `item_${id}`).setScale(0.8 / ART).setDepth(1002);
      parts.push(item);
      scene.tweens.add({
        targets: item,
        x,
        y: y - 2,
        duration: 240,
        ease: 'Quad.easeIn',
        onComplete: () => {
          item.destroy();
          if (box.active) motion.squash(scene, box, 1.15, 0.85, 70);
        },
      });
    }),
  );
  const clear = () => {
    for (const timer of timers) timer.remove();
    for (const part of parts) part.destroy();
  };
  const done = scene.time.delayedCall(ms, clear);
  return () => {
    done.remove();
    clear();
  };
}

/** Хозяин собирает заказ сам: идёт на склад, укладывает коробку и выносит её к двери. */
export async function ownerPack(scene: StoreScene): Promise<void> {
  const parcel = nextParcel(scene);
  if (!parcel || !scene.running || scene.sellerBusy || scene.ownerScanning()) return;
  const { warehouse, door } = scene.layout;
  const ms = packMs(parcel.order);
  let cancel = () => {};
  parcel.stage = 'packing';
  scene.popup(scene.seller.x, scene.seller.y - 18, t('popup.packOwner'), '#fff3b0');
  await staff.doChore(scene, [
    { ...warehouse.doorway },
    {
      ...warehouse.pickup,
      ms,
      arrive: () => (cancel = packFx(scene, scene.seller, parcel, ms)),
      action: () => scene.carried.setTexture('parcel').setPosition(0, 3).setVisible(true),
    },
    { ...warehouse.doorway },
    {
      x: door.x - 6,
      y: door.y - 10,
      ms: 250,
      action: () => {
        scene.carried.setVisible(false).setTexture('box');
        parcelAtDoor(scene, parcel);
      },
    },
  ]);
  // Позвали к кассе на полпути: заказ ждёт, собирать — заново, когда скажут (плашка «📦 Собрать заказ»).
  if (parcel.stage === 'packing') {
    cancel();
    parcel.stage = 'wait';
    parcel.packed = 0;
    scene.packRequested = false;
    return;
  }
  // Вынес — и, если ждут ещё принятые заказы, как освободится, соберёт следующий.
  scene.packRequested = Boolean(nextParcel(scene));
}

/** Менеджер или грузчик собирает заказ на складе и выносит коробку к двери. */
export async function packParcel(scene: StoreScene, w: Worker, gen: number, parcel: Parcel): Promise<void> {
  const { warehouse, door } = scene.layout;
  parcel.stage = 'packing';
  // Смена кончилась или человек ушёл на полпути — заказ снова ждёт сборки.
  const drop = (cancel = () => {}) => {
    cancel();
    w.carried.setVisible(false).setTexture('box');
    if (parcel.stage === 'packing') {
      parcel.stage = 'wait';
      parcel.packed = 0;
    }
  };
  await staff.workerWalk(scene, w, warehouse.doorway.x, warehouse.doorway.y);
  await staff.workerWalk(scene, w, warehouse.pickup.x, warehouse.pickup.y);
  if (!scene.alive(gen)) return drop();
  const ms = packMs(parcel.order) / staff.workerPace(scene, w);
  const cancel = packFx(scene, w.sprite, parcel, ms);
  await scene.wait(ms);
  if (!scene.alive(gen)) return drop(cancel);
  w.carried.setTexture('parcel').setPosition(0, 3).setVisible(true);
  scene.popup(w.sprite.x, w.sprite.y - 18, t('popup.parcel'), '#fff3b0');
  await staff.workerWalk(scene, w, warehouse.doorway.x, warehouse.doorway.y);
  await staff.workerWalk(scene, w, door.x - 6, door.y - 10);
  await staff.workerWait(scene, w, 250);
  if (!scene.alive(gen)) return drop();
  w.carried.setVisible(false).setTexture('box');
  parcelAtDoor(scene, parcel);
}

/** Коробка у двери ждёт курьера; свободный курьер сразу идёт за ней. */
export function parcelAtDoor(scene: StoreScene, parcel: Parcel): void {
  // День кончился, пока несли: заказ уже развезли после закрытия.
  if (!scene.parcels.includes(parcel)) return;
  parcel.stage = 'ready';
  const { door } = scene.layout;
  const n = scene.parcels.filter((p) => p.box?.active).length;
  parcel.box = scene.art(door.x - 14 - n * 7, door.y - 3, 'parcel').setDepth(door.y - 2);
  sound.boxLand(parcel.box.x);
  // Курьер ещё в пути — коробка постоит у двери, он заберёт её, когда вернётся.
  if (scene.courierBusy) scene.popup(parcel.box.x, parcel.box.y - 12, t('popup.parcelWaits'), '#fff3b0');
  void dispatchCourier(scene);
}

/** Свободный курьер забирает коробки у двери (сколько увезёт его транспорт) и едет к клиентам. */
export async function dispatchCourier(scene: StoreScene): Promise<void> {
  const courier = scene.courier;
  if (!courier?.active || scene.courierBusy) return;
  const vehicle = vehicleOf(scene.state);
  const batch = scene.parcels.filter((p) => p.stage === 'ready').slice(0, vehicle.carry);
  if (!batch.length) return;
  scene.courierBusy = true;
  for (const p of batch) p.stage = 'riding';
  const { door, h } = scene.layout;
  // Подходит к порогу (снаружи, у двери), коробки перелетают к нему в руки.
  await persons.walk(scene, courier, door.x - 4, h + FACADE_H + 5, 45);
  if (!courier.active) return;
  batch.forEach((p, i) => {
    const box = p.box;
    p.box = undefined;
    if (box?.active) scene.tweens.add({ targets: box, x: courier.x, y: courier.y - 3, delay: i * 120, duration: 220, ease: 'Quad.easeOut', onComplete: () => box.destroy() });
  });
  const held = scene.art(0, 2, 'parcel');
  courier.add(held);
  scene.popup(courier.x, courier.y - 18, t('popup.parcelGiven', { icon: vehicle.icon }), '#c8ffb0');
  await scene.wait(300);
  await persons.walk(scene, courier, scene.courierHome.x, scene.courierHome.y, 45);
  held.destroy();
  if (!courier.active) return;
  await rideCourier(scene, batch, vehicle);
}

/**
 * Курьер уезжает по улице (на велосипеде или мопеде — сам, фургончик подъезжает за ним), у клиента
 * получает деньги и чаевые за скорость, возвращается — монетки летят в кассу. Потом — следующие коробки.
 */
export async function rideCourier(scene: StoreScene, batch: Parcel[], vehicle: Vehicle): Promise<void> {
  const courier = scene.courier;
  if (!courier?.active) return;
  const home = scene.courierHome;
  const away = -80;
  // Сколько ехать — для плашки: до края улицы, у клиентов и обратно.
  scene.courierTrip = { start: scene.dayClock(), seconds: (2 * (home.x - away + 24)) / vehicle.speed + vehicle.away, icon: vehicle.icon };
  sound.courier(vehicle.id, courier.x);
  scene.popup(courier.x, courier.y - 18, t('popup.orderGo', { icon: vehicle.icon }), '#c8ffb0');
  // У клиента: чаевые — по тому, сколько прошло от звонка до двери.
  const arrive = () => {
    for (const p of batch) p.tip = deliveryTip(scene.dayClock() - p.calledAt + vehicle.away / 2);
  };
  if (vehicle.id === 'van') {
    if (!(await vanTrip(scene, courier, vehicle, arrive))) return;
  } else {
    const road = scene.streetY + 2;
    const ride = scene.art(0, 3, vehicle.id).setOrigin(0.5);
    courier.addAt(ride, 0);
    // На велосипеде крутит педали, а не бежит (animatePeople): без подскока и пыли.
    courier.setData('wheels', true);
    scene.courierRide?.setVisible(false);
    await persons.walk(scene, courier, home.x, road, vehicle.speed);
    ride.setFlipX(true);
    await persons.walk(scene, courier, away, road, vehicle.speed);
    if (!courier.active) return;
    arrive();
    await scene.wait(vehicle.away * 1000);
    ride.setFlipX(false);
    await persons.walk(scene, courier, home.x, road, vehicle.speed);
    await persons.walk(scene, courier, home.x, home.y, vehicle.speed);
    if (!courier.active) return;
    ride.destroy();
    courier.setData('wheels', false);
    scene.courierRide?.setVisible(true);
  }
  persons.setFacing(courier, 'down');
  scene.courierBusy = false;
  scene.courierTrip = null;
  sound.courier(vehicle.id, courier.x);
  payParcels(scene, batch, vehicle, courier);
  void dispatchCourier(scene);
}

/**
 * Фургончик: подъезжает к тротуару, курьер садится, уезжает по ближней полосе. Машины на ней едут
 * только вправо (налево — по дальней), поэтому обратно он не пятится, а объезжает квартал: снова
 * появляется слева, высаживает курьера и едет дальше вправо. false — не доехал.
 */
export async function vanTrip(scene: StoreScene, courier: Phaser.GameObjects.Container, vehicle: Vehicle, arrive: () => void): Promise<boolean> {
  const home = scene.courierHome;
  const roadY = scene.streetY + 24;
  const van = scene.add.container(-70, roadY, [scene.art(0, 0, 'car_van').setTint(VAN_TINT), scene.art(0, 0, 'car_van_lights')]).setDepth(roadY);
  const drive = (x: number, ease: string) =>
    new Promise<void>((done) => {
      const ms = (Math.abs(van.x - x) / vehicle.speed) * 1000;
      scene.tweens.add({ targets: van, x, duration: ms, ease, onComplete: () => done(), onStop: () => done() });
    });
  await drive(home.x + 6, 'Sine.easeOut');
  await persons.walk(scene, courier, home.x, roadY - 9, 45);
  if (!courier.active || !van.active) return false;
  courier.setVisible(false);
  await drive(scene.next.w + 70, 'Sine.easeIn');
  arrive();
  await scene.wait(vehicle.away * 1000);
  if (!van.active) return false;
  van.x = -70;
  await drive(home.x + 6, 'Sine.easeOut');
  courier.setVisible(true);
  await persons.walk(scene, courier, home.x, home.y, 45);
  if (van.active) void drive(scene.next.w + 70, 'Sine.easeIn').then(() => van.destroy());
  return courier.active;
}

/** Курьер вернулся с деньгами: за заказы и чаевые; рейтинг доставки растёт (за скорость — сильнее). */
export function payParcels(scene: StoreScene, batch: Parcel[], vehicle: Vehicle, courier: Phaser.GameObjects.Container): void {
  let pay = 0;
  let tips = 0;
  for (const p of batch) {
    const i = scene.parcels.indexOf(p);
    // День кончился, пока ехал: эти заказы уже посчитаны в итогах.
    if (i < 0) continue;
    scene.parcels.splice(i, 1);
    const tip = p.tip ?? 0;
    pay += p.order.pay;
    tips += tip;
    scene.state = rateDelivery(scene.state, outcomeFor(tip));
    scene.stats.deliveries = (scene.stats.deliveries ?? 0) + 1;
  }
  if (!pay) return;
  scene.state = { ...scene.state, money: scene.state.money + pay + tips };
  scene.stats.revenue += pay + tips;
  scene.stats.deliveryPay = (scene.stats.deliveryPay ?? 0) + pay + tips;
  scene.stats.deliveryTips = (scene.stats.deliveryTips ?? 0) + tips;
  sound.coin(courier.x);
  haptic.success();
  scene.popup(courier.x, courier.y - 16, t('popup.orderPaid', { icon: vehicle.icon, n: pay }), '#c8ffb0');
  if (tips) scene.time.delayedCall(450, () => courier.active && scene.popup(courier.x, courier.y - 16, t('popup.orderTip', { n: tips }), '#fee761'));
  effects.flyCoins(scene, courier.x, courier.y, Math.min(6, 2 + batch.length * 2));
}

/** Каждый кадр: кольцо на карточке звонка, хозяин идёт собирать заказ, плашка-статус доставки. */
export function updateDelivery(scene: StoreScene): void {
  if (!scene.phone) return;
  const call = scene.call;
  if (call) {
    // Поверх открыли окно (срочный подвоз, особый гость): карточка его не закрывает и сама под ним не
    // теряется — прячется, а звонок ждёт: время на ответ стоит, трель молчит, трубку не нажать сквозь окно.
    const covered = modalOpen();
    if (covered !== Boolean(call.covered)) {
      call.covered = covered;
      call.timer.paused = covered;
      call.ringer.paused = covered;
      scene.deliveryUi.coverCall(covered);
      if (covered) scene.phone.disableInteractive();
      else scene.phone.setInteractive();
    }
    scene.deliveryUi.setCountdown(1 - call.timer.getProgress(), call.timer.getRemainingSeconds());
  }
  if (scene.packRequested && !scene.sellerBusy && !scene.ownerScanning()) {
    scene.packRequested = false;
    void ownerPack(scene);
  }
  const waiting = scene.parcels.filter((p) => p.stage === 'wait' || p.stage === 'packing');
  const ready = scene.parcels.filter((p) => p.stage === 'ready');
  // Собрать некому: менеджера и грузчика нет, хозяина позвали к кассе — кнопка «📦 Собрать заказ».
  if (!staffPacks(scene) && !scene.packRequested && scene.parcels.some((p) => p.stage === 'wait')) {
    scene.deliveryUi.setPill(t('delivery.pill.wait'), () => {
      scene.packRequested = true;
      haptic.tap();
    });
    return;
  }
  const trip = scene.courierTrip;
  if (trip) {
    const more = waiting.length + ready.length;
    const time = clock(trip.seconds - (scene.dayClock() - trip.start));
    scene.deliveryUi.setPill(t('delivery.pill.ride', { icon: trip.icon, time }) + (more ? ` · ${t('delivery.pill.more', { n: more })}` : ''));
  } else if (waiting.length) {
    const p = waiting[0];
    scene.deliveryUi.setPill(t('delivery.pill.pack', { done: p.packed, total: orderUnits(p.order) }));
  } else if (scene.courierBusy) scene.deliveryUi.setPill(t('delivery.pill.pickup', { icon: vehicleOf(scene.state).icon }));
  else if (ready.length) scene.deliveryUi.setPill(t('delivery.pill.ready'));
  else scene.deliveryUi.setPill(null);
}

/**
 * День закрылся: звонок без ответа стихает, а принятые заказы курьер развозит после закрытия — деньги
 * сразу, без чаевых. Возвращает строку для итогов дня (или null, если доставки сегодня не было).
 */
export function closeDelivery(scene: StoreScene): [string, string] | null {
  scene.callTimer?.remove();
  scene.callTimer = undefined;
  endCall(scene);
  scene.packRequested = false;
  for (const p of scene.parcels) {
    p.box?.destroy();
    scene.state = rateDelivery({ ...scene.state, money: scene.state.money + p.order.pay }, 'delivered');
    scene.stats.revenue += p.order.pay;
    scene.stats.deliveryPay = (scene.stats.deliveryPay ?? 0) + p.order.pay;
    scene.stats.deliveries = (scene.stats.deliveries ?? 0) + 1;
  }
  scene.parcels = [];
  scene.courierTrip = null;
  scene.deliveryUi.setPill(null);
  const n = scene.stats.deliveries ?? 0;
  const missed = scene.stats.deliveryMissed ?? 0;
  if (!scene.phone || n + missed === 0) return null;
  const tips = scene.stats.deliveryTips ?? 0;
  const value =
    t('summary.deliveryValue', { n, money: scene.stats.deliveryPay ?? 0, rating: deliveryRating(scene.state).toFixed(1) }) +
    (tips ? t('summary.deliveryTips', { n: tips }) : '') +
    (missed ? t('summary.deliveryMissed', { n: missed }) : '');
  return [t('summary.delivery'), value];
}

/** Сколько коробок закуплено этим утром (по разнице с началом утра). */
export function boxesToDeliver(scene: StoreScene): number {
  const added = warehouseCount(scene.state) - scene.morningStock;
  return added > 0 ? Math.ceil(added / unitsPerBox(warehouseCapacity(scene.state))) : 0;
}

/**
 * Доставка закупки: фургон подъезжает к складу, водитель через проход в заборе носит коробки
 * к роллету склада — и они по одной появляются на стеллаже. Потом фургон уезжает.
 */
export async function deliver(scene: StoreScene): Promise<void> {
  const { warehouse, h } = scene.layout;
  const shutterX = warehouse.x + warehouse.w / 2;
  const roadY = scene.streetY + 24;
  const back = h + FACADE_H + 6;
  const vanX = shutterX + 14;
  const body = scene.art(0, 0, 'car_van').setTint(0xffffff);
  const lights = scene.art(0, 0, 'car_van_lights');
  const van = scene.add.container(-260, roadY, [body, lights]).setDepth(roadY);
  const road = cars.onRoad(scene, van, 'up', true);
  await cars.yieldToLot(scene, road);
  await new Promise<void>((done) => scene.tweens.add({ targets: van, x: vanX, duration: 2200, ease: 'Sine.easeOut', onComplete: () => done() }));
  if (!van.active) return;
  // Задние двери распахиваются: внутри темно и видны коробки.
  const hold = scene.add.rectangle(-body.displayWidth / 2 + 1, 0, 0.1, 10, 0x262b44).setOrigin(0, 0.5);
  const cargo = scene.art(-body.displayWidth / 2 + 5, 1, 'box').setScale(0.7 / ART).setAlpha(0);
  van.add([hold, cargo]);
  scene.tweens.add({ targets: hold, width: 9, x: hold.x - 1, duration: 300, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: cargo, alpha: 1, delay: 200, duration: 200 });
  const driver = persons.makePerson(scene, vanX, scene.streetY + 10, { ...randomLook(0x0099db), style: 'cap', hair: 0x0099db });
  // Водитель катит тележку с двумя коробками.
  const box = scene.art(7, 1, 'hand_truck').setVisible(false);
  driver.add(box);
  // Катит тележку быстрым шагом, но не вприпрыжку: тележка не скачет по асфальту.
  driver.setData('wheels', true);
  // С тротуара по подъезду к воротам склада во флигеле.
  const route = [
    { x: shutterX, y: scene.streetY + 4 },
    { x: shutterX, y: back },
  ];
  const trips = Math.min(scene.awaitingBoxes, 4);
  for (let trip = 0; trip < trips && driver.active; trip++) {
    box.setVisible(true);
    await persons.walkVia(scene, driver, route, SELLER_SPEED);
    if (!driver.active) return;
    await scene.wait(300);
    box.setVisible(false);
    // Каждый рейс открывает свою долю коробок (на последнем — все оставшиеся).
    scene.awaitingBoxes = trip === trips - 1 ? 0 : Math.max(0, scene.awaitingBoxes - Math.ceil(scene.awaitingBoxes / (trips - trip)));
    building.refreshWarehouse(scene);
    // Коробка легла на склад — картонный стук, каждая следующая чуть выше.
    sound.place('box', trip, driver.x);
    if (trip < trips - 1) await persons.walkVia(scene, driver, [...route].reverse(), SELLER_SPEED);
  }
  await persons.walkVia(scene, driver, [...[...route].reverse(), { x: vanX, y: scene.streetY + 10 }], SELLER_SPEED);
  driver.destroy();
  if (!van.active) return;
  // Двери закрываются — и в путь.
  cargo.destroy();
  scene.tweens.add({ targets: hold, width: 0.1, x: hold.x + 1, duration: 250 });
  await scene.wait(300);
  if (!van.active) return;
  await cars.yieldToLot(scene, road, true);
  scene.tweens.add({ targets: van, x: scene.next.w + 300, duration: 2600, ease: 'Sine.easeIn', onComplete: () => van.destroy() });
}

// ---------- Срочный подвоз ----------

/** Сколько штук срочного заказа сейчас едет. */
export function urgentOnTheWay(scene: StoreScene): number {
  return scene.urgentOrders.reduce((sum, o) => sum + o.qty, 0);
}

/** Оплатить срочный заказ и отправить фургон. false — нет денег, места или товара. */
export function orderUrgentDelivery(scene: StoreScene, id: ProductId, qty: number, byManager = false): boolean {
  const next = orderUrgent(scene.state, id, qty, urgentOnTheWay(scene), byManager);
  if (!next) return false;
  scene.state = next;
  scene.urgentOrders.push({ id, qty });
  scene.hud.update(scene.state, scene.timeLeft);
  if (!scene.urgentVanBusy) void urgentVan(scene);
  return true;
}

/** Автозаказ подвозит кончившийся товар: оплачено из лимита дня, едет тем же фургоном, что и срочный заказ. */
export function autoTopUpIfNeeded(scene: StoreScene): void {
  const order = autoTopUp(scene.state, (id) => scene.stats.sold[id] ?? 0, scene.urgentOrders.map((o) => o.id), urgentOnTheWay(scene));
  if (!order) return;
  scene.state = order.state;
  scene.urgentOrders.push({ id: order.pid, qty: order.qty, auto: true });
  scene.hud.update(scene.state, scene.timeLeft);
  const { warehouse } = scene.layout;
  scene.popup(warehouse.x + warehouse.w / 2, warehouse.y - 4, t('popup.autoTopUp', { icon: PRODUCTS[order.pid].icon, n: order.qty }), '#c8ffb0');
  if (!scene.urgentVanBusy) void urgentVan(scene);
}

/** Фургон срочного подвоза: подъезжает к складу, товар — на стеллаж, уезжает. */
export async function urgentVan(scene: StoreScene): Promise<void> {
  scene.urgentVanBusy = true;
  const { warehouse } = scene.layout;
  const vanX = warehouse.x + warehouse.w / 2 + 14;
  const roadY = scene.streetY + 24;
  const van = scene.add.container(-260, roadY, [scene.art(0, 0, 'car_van').setTint(0xffd27a), scene.art(0, 0, 'car_van_lights')]).setDepth(roadY);
  const road = cars.onRoad(scene, van, 'up', true);
  await scene.wait((URGENT_SECONDS * 1000) / Math.max(1, scene.speed) - 1800);
  await cars.yieldToLot(scene, road);
  await new Promise<void>((done) => scene.tweens.add({ targets: van, x: vanX, duration: 1800, ease: 'Sine.easeOut', onComplete: () => done(), onStop: () => done() }));
  receiveUrgentOrders(scene);
  scene.urgentVanBusy = false;
  if (scene.urgentOrders.length) void urgentVan(scene);
  // Пустой — в путь.
  await scene.wait(600);
  if (!van.active) return;
  await cars.yieldToLot(scene, road, true);
  scene.tweens.add({ targets: van, x: scene.next.w + 300, duration: 2400, ease: 'Sine.easeIn', onComplete: () => van.destroy() });
}

/** Всё, что едет, — на склад (и в конце дня, если фургон не успел). */
export function receiveUrgentOrders(scene: StoreScene): void {
  if (!scene.urgentOrders.length) return;
  const list = scene.urgentOrders.map((o) => `${PRODUCTS[o.id].icon}×${o.qty}`).join(' ');
  for (const o of scene.urgentOrders) scene.state = o.auto ? autoArrived(scene.state, o.id, o.qty) : receiveUrgent(scene.state, o.id, o.qty);
  scene.urgentOrders = [];
  building.refreshWarehouse(scene);
  scene.refreshShelves();
  sound.place('box', 0);
  const { warehouse } = scene.layout;
  scene.popup(warehouse.x + warehouse.w / 2, warehouse.y - 4, t('popup.urgent', { list }), '#fff3b0');
}

export function openUrgent(scene: StoreScene): void {
  if (!scene.running || scene.night) return;
  showUrgent({
    getState: () => scene.state,
    onTheWay: () => urgentOnTheWay(scene),
    onTheWayList: () => scene.urgentOrders.map((o) => `${PRODUCTS[o.id].icon}×${o.qty}`).join(' '),
    order: (id, qty) => {
      if (orderUrgentDelivery(scene, id, qty)) sound.coin();
    },
  });
}
