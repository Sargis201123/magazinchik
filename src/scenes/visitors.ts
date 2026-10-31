// Жизнь улицы и особые гости: прохожие и машины, велосипедист, бегун и хозяин с собакой, лодка в наводнение,
// автобус на остановке, утро района (дворник, мусоровоз), гости из сюжета (бабушка с долгом, заказчик, особый
// гость с выбором у кассы, Эдуард у витрины, официант кафе «Пончик»). Покупатели в зале — shoppers.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { PRODUCTS, DAY_SECONDS } from '../game/economy';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { ambience } from '../platform/ambience';
import { UI_FONT } from '../ui/dom';
import { bigDayFor } from '../game/bigday';
import { isWet } from '../game/weather';
import { WING_OUTER } from './layout';
import { eduardLook } from '../game/eduard';
import { answerSpecial, grannyRepays, makeSpecial, type SpecialKind, type SpecialVisit } from '../game/special';
import { showChoice } from '../ui/choice';
import {
  ART,
  HEADLIGHT_POWER,
  CAR_TYPES,
  CUSTOMER_SPEED,
  SHIRTS,
  type Look,
  randomLook,
  HAT_COLORS,
  DOG_COLORS,
  customerLook,
  withCompanionItems,
  SIDE_SHOP_X,
  SIDE_SHOP_W,
  CAR_COLORS,
  GRANDMA,
  SKINS,
  VALYA,
} from './common';
import * as effects from './effects';
import * as weatherFx from './weatherFx';
import * as food from './food';
import * as cars from './cars';
import * as persons from './persons';
import * as camera from './camera';
import * as building from './building';
import * as arcsFx from './arcsFx';
import type { ClientId } from '../game/events';

const MARAT: Look = { shirt: 0xffffff, skin: 0xd9a066, pants: 0x262b44, hair: 0xffffff, style: 'cap' };
const SCHOOL_COOK: Look = { shirt: 0x5fcde4, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xc0cbdc, style: 'cap', acc: 'apron' };

const EDUARD: Look = { shirt: 0x3a4466, skin: 0xf2d3ab, pants: 0x262b44, hair: 0x181425, style: 'short', acc: 'tie' };
const GRANDMA_LINES_KEYS: TextKey[] = ['visit.grandma1', 'visit.grandma2', 'visit.grandma3'];
const ORDER_GUESTS: Record<ClientId, [Look, TextKey]> = {
  chef: [MARAT, 'who.marat'],
  school: [SCHOOL_COOK, 'client.school'],
  valya: [VALYA, 'who.valya'],
};

/** Прохожий идёт по тротуару, машина проезжает по дороге. */
export function streetLife(scene: StoreScene): void {
  const left = -60;
  const right = scene.next.w + 60;
  // Наводнение: машины не ходят, людей на улице мало — зато по воде плавают лодки.
  const flood = scene.bigObjs.length > 0 && bigDayFor(scene.state.day) === 'flood';
  if (flood) {
    if (Math.random() < 0.12) rowBoat(scene, left, right);
    if (Math.random() >= 0.12) return;
  }
  if (Math.random() < (flood ? 1 : 0.45)) {
    const fromLeft = Math.random() < 0.5;
    const y = scene.streetY + Phaser.Math.Between(-5, 5);
    const person = persons.makePerson(scene, fromLeft ? left : right, y, withCompanionItems(customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day)));
    weatherFx.addUmbrella(scene, person);
    if (Math.random() < 0.1) persons.addCompanion(scene, person);
    void persons.walk(scene, person, fromLeft ? right : left, y, persons.ownPace(scene, person, CUSTOMER_SPEED * Phaser.Math.FloatBetween(0.75, 1.1))).then(() => person.destroy());
  }
  if (flood) return;
  if (Math.random() < 0.14) passerby(scene);
  // Автобус тоже не выезжает следом за машиной с парковки.
  if (Math.random() < 0.04 && !scene.parking?.onRoad) driveBus(scene);
  if (Math.random() < 0.3) {
    const toRight = Math.random() < 0.5;
    // Машина с парковки сейчас на дороге (сворачивает к ней или выезжает) — новые не въезжают ей в бок и в багажник.
    if (scene.parking?.onRoad) return;
    const y = scene.streetY + (toRight ? 24 : 42);
    const total = CAR_TYPES.reduce((sum, [, , weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    const [key, color] = CAR_TYPES.find(([, , weight]) => (roll -= weight) < 0) ?? CAR_TYPES[0];
    const body = scene.art(0, 0, key);
    if (color !== null) body.setTint(color || Phaser.Utils.Array.GetRandom(CAR_COLORS));
    const lights = scene.art(0, 0, `${key}_lights`);
    // Вечером фары светят вперёд: конусом в карте освещения, а в лёгкой графике — пятном поверх темноты.
    const beam = scene.art(body.displayWidth / 2 + 8, 0, 'glow')
      .setScale(30 / 64, 16 / 64)
      .setTint(0xfff0b0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.8 * scene.evening * cars.beamHaze(scene));
    const parts = [body, lights, beam];
    // На мокрой дороге фары отражаются бликом.
    if (isWet(scene.weather)) {
      parts.push(
        scene.art(body.displayWidth / 2 + 6, 7, 'glow')
          .setScale(28 / 64, 5 / 64)
          .setTint(0xfff0b0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.2 + 0.5 * scene.evening),
      );
    }
    const car = scene.add.container(toRight ? left : right, y, parts).setDepth(y);
    car.setScale(toRight ? 1 : -1, 1);
    const lit = cars.headlights(scene, car);
    const dir = toRight ? 1 : -1;
    lit.rotation = -dir * (Math.PI / 2);
    lit.sync = () => {
      lit.x = car.x + dir * (body.displayWidth / 2 - 2);
      lit.y = car.y;
      lit.set(HEADLIGHT_POWER * scene.evening);
    };
    cars.onRoad(scene, car, toRight ? 'up' : 'down');
    scene.tweens.add({ targets: car, x: toRight ? right : left, duration: Phaser.Math.Between(2600, 4200), onComplete: () => car.destroy() });
  }
}

/** Прохожие повеселее: велосипедист у края дороги, бегун, хозяин с собакой. */
export function passerby(scene: StoreScene): void {
  const left = -60;
  const right = scene.next.w + 60;
  const fromLeft = Math.random() < 0.5;
  const roll = Math.random();
  const base = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day);
  if (roll < 0.4) {
    const y = scene.streetY + 12;
    const rider = persons.makePerson(scene, fromLeft ? left : right, y, { ...base, hat: Math.random() < 0.5 ? 'bikehelmet' : base.hat, hatTint: 0xe43b44 });
    rider.addAt(scene.art(0, 3, 'bike').setOrigin(0.5), 0);
    // Крутит педали, а не бежит: без подскока, наклона и пыли.
    rider.setData('wheels', true);
    void persons.walk(scene, rider, fromLeft ? right : left, y, 70).then(() => rider.destroy());
    // Иногда звонит в звонок — когда проезжает мимо магазина.
    if (Math.random() < 0.35) {
      const ms = (Math.abs(scene.layout.door.x - rider.x) / 70) * 1000 * Phaser.Math.FloatBetween(0.6, 1);
      scene.time.delayedCall(ms, () => rider.active && ambience.street('bike', rider.x));
    }
    return;
  }
  const y = scene.streetY + Phaser.Math.Between(-5, 5);
  if (roll < 0.7) {
    const runner = persons.makePerson(scene, fromLeft ? left : right, y, { ...base, outfit: 'runner', outfitTint: Phaser.Utils.Array.GetRandom(HAT_COLORS), hat: 'headband', hatTint: 0xffffff, coat: undefined, scarf: undefined });
    void persons.walk(scene, runner, fromLeft ? right : left, y, CUSTOMER_SPEED * 2.4).then(() => runner.destroy());
    return;
  }
  const walker = persons.makePerson(scene, fromLeft ? left : right, y, { ...base, dog: Phaser.Utils.Array.GetRandom(DOG_COLORS) });
  weatherFx.addUmbrella(scene, walker);
  void persons.walk(scene, walker, fromLeft ? right : left, y, persons.ownPace(scene, walker, CUSTOMER_SPEED * 0.8)).then(() => walker.destroy());
}

/** Наводнение: по затопленной дороге проплывает лодка с гребцом (иногда — с пассажиром). */
export function rowBoat(scene: StoreScene, left: number, right: number): void {
  const toRight = Math.random() < 0.5;
  const y = scene.streetY + Phaser.Math.Between(26, 40);
  const hull = scene.art(0, 4, 'boat');
  const oar = scene.art(4, 4, 'boat_oar').setOrigin(0.1, 0.2);
  const rower = persons.makePerson(scene, 4, -4, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  scene.people.delete(rower);
  rower.setScale(0.9);
  const parts: Phaser.GameObjects.GameObject[] = [rower, oar, hull];
  if (Math.random() < 0.4) {
    const guest = persons.makePerson(scene, -10, -4, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
    scene.people.delete(guest);
    guest.setScale(0.9);
    parts.unshift(guest);
  }
  const boat = scene.add.container(toRight ? left : right, y, parts).setDepth(y);
  boat.setScale(toRight ? 1 : -1, 1);
  scene.tweens.add({ targets: oar, angle: { from: -18, to: 22 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: boat, y: y + 1.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({
    targets: boat,
    x: toRight ? right : left,
    duration: Phaser.Math.Between(9000, 13000),
    onComplete: () => {
      scene.tweens.killTweensOf(boat);
      scene.tweens.killTweensOf(oar);
      boat.destroy();
    },
  });
}

/** Иногда по дороге едет автобус и останавливается на остановке. */
export function driveBus(scene: StoreScene): void {
  const y = scene.streetY + 25;
  const body = scene.art(0, 0, 'bus').setTint(Phaser.Utils.Array.GetRandom([0xfeae34, 0xe43b44, 0x63c74d]));
  const lights = scene.art(0, 0, 'bus_lights');
  const bus = scene.add.container(-120, y, [body, lights]).setDepth(y);
  const road = cars.onRoad(scene, bus, 'up', true);
  const stopX = -70;
  scene.tweens.add({
    targets: bus,
    x: stopX,
    duration: 2600,
    ease: 'Sine.easeOut',
    onComplete: () => {
      // На остановке выходят пассажиры и расходятся по тротуару.
      const out = Phaser.Math.Between(1, 3);
      for (let i = 0; i < out; i++) {
        scene.time.delayedCall(300 + i * 350, () => {
          const y = scene.streetY + Phaser.Math.Between(-4, 4);
          const p = persons.makePerson(scene, stopX + Phaser.Math.Between(-8, 8), scene.streetY + 10, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
          weatherFx.addUmbrella(scene, p);
          const to = Math.random() < 0.5 ? -100 : scene.next.w + 100;
          void persons.walk(scene, p, p.x, y).then(() => persons.walk(scene, p, to, y, CUSTOMER_SPEED * 0.9)).then(() => p.destroy());
        });
      }
      void scene.wait(1800)
        .then(() => cars.yieldToLot(scene, road, true))
        .then(() => bus.active && scene.tweens.add({ targets: bus, x: scene.next.w + 140, duration: 3200, ease: 'Sine.easeIn', onComplete: () => bus.destroy() }));
    },
  });
}

/**
 * Утро района: через день дворник метёт тротуар (за ним клубится пыль), раз в три дня
 * к мусорному контейнеру подъезжает мусоровоз.
 */
export function morningCrew(scene: StoreScene): void {
  const day = scene.state.day;
  if (day % 2 === 0) {
    scene.time.delayedCall(DAY_SECONDS * 30, () => {
      if (!scene.running) return;
      const y = scene.streetY + 2;
      const sweeper = persons.makePerson(scene, -60, y, { ...randomLook(0xf77622), acc: 'vest', accTint: 0xfee761, style: 'cap', hair: 0xf77622 });
      const broom = scene.add.container(6, 2, [scene.add.rectangle(0, -3, 1, 8, 0x8f563b), scene.add.rectangle(0, 2, 4, 2, 0xfeae34)]);
      sweeper.add(broom);
      scene.tweens.add({ targets: broom, angle: { from: -25, to: 25 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const stopDust = scene.worldTimer(420, () => sweeper.active && food.steamPuff(scene, sweeper.x + 7, sweeper.y + 6, 0xc8b8a0));
      void persons.walk(scene, sweeper, scene.next.w + 60, y, CUSTOMER_SPEED * 0.45).then(() => {
        stopDust();
        sweeper.destroy();
      });
    });
  }
  if (day % 3 === 0) {
    scene.time.delayedCall(DAY_SECONDS * 60, () => {
      if (!scene.running) return;
      const dump = building.dumpSpot(scene);
      const y = scene.streetY + 24;
      const truck = scene.add.container(-140, y, [scene.art(0, 0, 'car_truck').setTint(0x3e8948), scene.art(0, 0, 'car_truck_lights')]).setDepth(y);
      const road = cars.onRoad(scene, truck, 'up', true);
      scene.tweens.add({
        targets: truck,
        x: dump.x + 10,
        duration: 2600,
        ease: 'Sine.easeOut',
        onComplete: () => {
          if (scene.dumpImg?.active) scene.tweens.add({ targets: scene.dumpImg, angle: { from: -6, to: 6 }, duration: 90, yoyo: true, repeat: 5, onComplete: () => scene.dumpImg?.setAngle(0) });
          void scene.wait(2200)
            .then(() => cars.yieldToLot(scene, road, true))
            .then(() => truck.active && scene.tweens.add({ targets: truck, x: scene.next.w + 160, duration: 3200, ease: 'Sine.easeIn', onComplete: () => truck.destroy() }));
        },
      });
    });
  }
}

/** Кто из героев сюжета заглянет сегодня: бабушка, заказчик за заказом, Эдуард. */
export function scheduleStoryGuests(scene: StoreScene): void {
  const day = scene.state.day;
  const at = (share: number, fn: () => Promise<void>) =>
    scene.time.delayedCall(DAY_SECONDS * share * 1000, () => {
      if (scene.running) void fn();
    });
  if (day > 2 && day % 6 === 2) at(0.25, () => runVisitor(scene, GRANDMA, t(Phaser.Utils.Array.GetRandom(GRANDMA_LINES_KEYS))));
  const order = scene.state.plan?.order;
  if (order) {
    const [look, name] = ORDER_GUESTS[order.client];
    at(0.78, () => runVisitor(scene, look, t('popup.orderPickup', { name: t(name) }), true));
  }
  if (eduardLook(scene.state) !== 'vacant' && day % 5 === 1) at(0.5, () => runEduard(scene));
  if (scene.cafeToday) at(0.08, () => runCafeWaiter(scene));
  // Особый гость с выбором (бизнесмен, бабушка без денег, ребёнок с мелочью).
  const special = makeSpecial(scene.state, Math.random);
  if (special) at(Phaser.Math.FloatBetween(0.2, 0.6), () => runSpecial(scene, special));
  // Добрая бабушка возвращает долг.
  if (scene.state.grannyOwed && Math.random() < 0.5) at(0.35, () => runGrannyRepay(scene));
  // Хроники района: герой истории у кассы, свадебная машина, грузовик с вещами, забег (arcsFx.ts).
  arcsFx.scheduleArcScene(scene);
}

/**
 * Особый гость: заходит, встаёт у кассы, над ним «!». Нажми — окно выбора.
 * Не ответил за 14 секунд — гость уходит сам.
 */
export async function runSpecial(scene: StoreScene, visit: SpecialVisit): Promise<void> {
  const { door, sellerHome } = scene.layout;
  const looks: Record<SpecialKind, Look> = {
    business: { shirt: 0x262b44, skin: Phaser.Utils.Array.GetRandom(SKINS), pants: 0x181425, hair: 0x181425, style: 'short', acc: 'tie' },
    granny: { shirt: 0x8f563b, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true },
    kid: { ...randomLook(Phaser.Utils.Array.GetRandom(HAT_COLORS)), kid: true, style: 'short', bag: 'backpack', bagTint: 0xe43b44 },
  };
  const start = streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, looks[visit.kind]);
  await persons.walkVia(scene, sprite, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
    { x: sellerHome.x - 30, y: sellerHome.y - 16 },
  ]);
  if (!sprite.active || !scene.running) {
    sprite.destroy();
    return;
  }
  persons.setFacing(sprite, 'right');
  const item = PRODUCTS[visit.product];
  scene.popup(sprite.x, sprite.y - 18, t(`special.${visit.kind}.hello` as TextKey), '#fff3b0');
  // «!» над головой мигает, пока не ответишь.
  const mark = scene.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#fee761', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(scene.textRes(4));
  sprite.add(mark);
  const blink = scene.tweens.add({ targets: mark, y: -27, duration: 400, yoyo: true, repeat: -1 });
  let answered: boolean | null = null;
  let closeChoice: (() => void) | null = null;
  const hit = scene.add.zone(sprite.x, sprite.y - 6, 22, 30).setInteractive({ useHandCursor: true }).setDepth(2000);
  const decided = new Promise<void>((resolve) => {
    const finish = (yes: boolean | null) => {
      if (answered !== null) return;
      answered = yes;
      resolve();
    };
    hit.on('pointerup', () =>
      camera.tap(scene, () => {
        if (closeChoice) return;
        closeChoice = showChoice({
          title: t(`special.${visit.kind}.title` as TextKey),
          text: t(`special.${visit.kind}.text` as TextKey, { n: visit.qty, item: `${item.icon} ${t(item.nameKey)}`, pay: visit.pay, full: scene.state.prices[visit.product] * visit.qty }),
          note: t(`special.${visit.kind}.note` as TextKey),
          yes: t(`special.${visit.kind}.yes` as TextKey),
          no: t(`special.${visit.kind}.no` as TextKey),
          onYes: () => finish(true),
          onNo: () => finish(false),
        });
      }),
    );
    scene.time.delayedCall(14000, () => {
      closeChoice?.();
      if (answered === null) answered = false;
      resolve();
    });
  });
  await decided;
  hit.destroy();
  blink.stop();
  mark.destroy();
  if (!sprite.active) return;
  const yes = answered === true;
  const res = answerSpecial(scene.state, visit, yes);
  scene.state = res.state;
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  scene.hud.update(scene.state, scene.timeLeft);
  if (yes && res.money) {
    sound.coin(sprite.x);
    scene.popup(sprite.x, sprite.y - 18, `+${res.money} 💰`, '#c8ffb0');
  }
  if (res.rating > 0) scene.time.delayedCall(500, () => scene.popup(sprite.x, sprite.y - 26, `★ +${res.rating}`, '#fee761'));
  if (res.rating < 0) scene.time.delayedCall(500, () => scene.popup(sprite.x, sprite.y - 26, `★ ${res.rating}`, '#ffd0d0'));
  effects.emote(scene, sprite, yes ? 'emo_heart' : 'emo_angry');
  if (yes && visit.kind === 'business') sprite.add(scene.art(0, 3, 'box'));
  if (yes) sprite.add(scene.art(5, 1, `item_${visit.product}`).setScale(1 / ART));
  await scene.wait(1200);
  await persons.walk(scene, sprite, door.x, door.y - 10);
  await strollAway(scene, sprite);
}

/** Добрая бабушка возвращается с пирожками и отдаёт долг вдвое. */
export async function runGrannyRepay(scene: StoreScene): Promise<void> {
  const owed = grannyRepays(scene.state).paid;
  if (!owed) return;
  const look: Look = { shirt: 0x8f563b, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true };
  // Деньги — когда бабушка дошла до кассы; не дошла (день кончился) — придёт в другой раз.
  await runVisitor(scene, look, t('special.granny.repay', { n: owed }), false, () => {
    scene.state = grannyRepays(scene.state).state;
    sound.coin();
    scene.hud.update(scene.state, scene.timeLeft);
  });
}

/** Гость заходит к кассе, говорит фразу и уходит (заказчик уносит коробку). */
export async function runVisitor(scene: StoreScene, look: Look, line: string, carriesBox = false, onArrive?: () => void): Promise<void> {
  const { door, sellerHome } = scene.layout;
  const start = streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, look);
  weatherFx.addUmbrella(scene, sprite);
  await persons.walkVia(scene, sprite, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
    { x: sellerHome.x - 28, y: sellerHome.y - 12 },
  ]);
  if (!sprite.active) return;
  persons.setFacing(sprite, 'right');
  scene.popup(sprite.x, sprite.y - 18, line, '#fff3b0');
  effects.emote(scene, sprite, 'emo_heart');
  onArrive?.();
  await scene.wait(2200);
  if (carriesBox && sprite.active) sprite.add(scene.art(0, 3, 'box'));
  await persons.walkVia(scene, sprite, [
    { x: door.x, y: door.y - 10 },
    { x: door.x, y: scene.layout.h + 16 },
  ]);
  void strollAway(scene, sprite);
}

/** Эдуард подходит к витрине, присматривается и уходит в свой магазин по соседству. */
export async function runEduard(scene: StoreScene): Promise<void> {
  const { w, h } = scene.layout;
  const sprite = persons.makePerson(scene, scene.next.w + 60, scene.streetY, EDUARD);
  await persons.walkVia(scene, sprite, [
    { x: w - 20, y: scene.streetY },
    { x: w - 20, y: h + 15 },
  ]);
  if (!sprite.active) return;
  persons.setFacing(sprite, 'up');
  effects.emote(scene, sprite, 'emo_question');
  scene.popup(sprite.x, sprite.y - 18, t('popup.eduard'), '#d0e0ff');
  await scene.wait(2500);
  // Его магазин за дорогой, напротив входа — переходит по зебре; иначе — по соседству справа.
  const home = scene.rivalAcross ? { x: scene.layout.door.x, y: scene.streetY + 82 } : { x: scene.next.w + SIDE_SHOP_X + SIDE_SHOP_W * 0.62, y: scene.next.h - 2 };
  await persons.walkVia(scene, sprite, [
    { x: w - 20, y: scene.streetY },
    { x: home.x, y: scene.streetY },
    home,
  ]);
  sprite.destroy();
}

/** Официант кафе «Пончик» приходит к магазину за заказом по договору и уносит коробку. */
export async function runCafeWaiter(scene: StoreScene): Promise<void> {
  const { door, h } = scene.layout;
  const cafeDoor = -136 - WING_OUTER + 112 * 0.62;
  const sprite = persons.makePerson(scene, cafeDoor, scene.next.h - 2, { ...randomLook(0x733e39), acc: 'apron', accTint: 0xffffff });
  await persons.walkVia(scene, sprite, [
    { x: cafeDoor, y: scene.streetY },
    { x: door.x, y: scene.streetY },
    { x: door.x, y: h + 15 },
  ]);
  if (!sprite.active) return;
  persons.setFacing(sprite, 'up');
  scene.popup(sprite.x, sprite.y - 18, t('popup.cafeWaiter'), '#fff3b0');
  await scene.wait(1500);
  const result = scene.cafeToday;
  if (!sprite.active) return;
  if (result?.delivered) {
    sound.coin(sprite.x);
    scene.popup(sprite.x, sprite.y - 18, t('popup.cafePaid', { n: result.pay }), '#c8ffb0');
    sprite.add(scene.art(0, 3, 'box'));
  } else scene.popup(sprite.x, sprite.y - 18, t('popup.cafeShort'), '#ffd0d0');
  await scene.wait(900);
  await persons.walkVia(scene, sprite, [
    { x: door.x, y: scene.streetY },
    { x: cafeDoor, y: scene.streetY },
    { x: cafeDoor, y: scene.next.h - 2 },
  ]);
  sprite.destroy();
}

/** Откуда приходят с улицы: с тротуара слева или справа от входа. */
export function streetSpawn(scene: StoreScene): Phaser.Types.Math.Vector2Like {
  const side = Math.random() < 0.5 ? -1 : 1;
  return { x: scene.layout.door.x + side * Phaser.Math.Between(50, 90), y: scene.streetY + Phaser.Math.Between(-3, 3) };
}

/** Вышел из магазина — уходит по тротуару за край кадра. */
export async function strollAway(scene: StoreScene, sprite: Phaser.GameObjects.Container): Promise<void> {
  const y = scene.streetY + Phaser.Math.Between(-3, 3);
  const side = Math.random() < 0.5 ? -1 : 1;
  // С крыльца на тротуар и в сторону — одним ходом, заворачивая, а не по команде «налево».
  await persons.walkVia(scene, sprite, [
    { x: scene.layout.door.x, y },
    { x: side < 0 ? -60 : scene.next.w + 60, y },
  ]);
  sprite.destroy();
}
