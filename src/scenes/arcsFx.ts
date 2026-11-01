// Хроники района в мире (game/arcs.ts): в день шага истории его видно — герой заходит к кассе
// с букетом или шаром, на свадьбу гости нарядные и по улице едет машина с лентами, к переезду
// приезжает грузовик с вещами, в день забега по тротуару бегут соседи. Всё — из готовых человечков,
// машин и вещей гардероба. Поставки кафе Ахмеда — при открытии, как у кафе «Пончик» (visitors.ts).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS } from '../game/economy';
import { ARCS, arcDeliver, arcSceneToday, type ArcWho } from '../game/arcs';
import { regularById, type RegularId } from '../game/regulars';
import { livedRegular } from '../game/life';
import { repayDay } from '../game/notebook';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { CUSTOMER_SPEED, GRANDMA, VALYA, randomLook, SHIRTS, type Look } from './common';
import type { PropId } from './wardrobe';
import * as visitors from './visitors';
import * as persons from './persons';
import * as cars from './cars';
import * as building from './building';

/** Жители района, которых нет среди постоянных покупателей. */
const NPC: Record<Exclude<ArcWho, RegularId>, Look> = {
  zina: { ...GRANDMA, shirt: 0x5a6988, hair: 0xc0cbdc, style: 'curly' },
  family: { shirt: 0x63c74d, skin: 0xeec39a, pants: 0x3a4466, hair: 0xb86f50, style: 'long', bag: 'bag', bagTint: 0xfee761 },
  eduard: { shirt: 0x3a4466, skin: 0xf2d3ab, pants: 0x262b44, hair: 0x5a6988, style: 'short', acc: 'tie' },
  valya: VALYA,
  zoya: { shirt: 0x8fd7f5, skin: 0xf2d3ab, pants: 0x262b44, hair: 0x181425, style: 'ponytail', glasses: true, bag: 'backpack', bagTint: 0x68386c },
  liza: { shirt: 0xf6757a, skin: 0xeec39a, pants: 0x181425, hair: 0xfee761, style: 'bun', bag: 'bag', bagTint: 0x262b44 },
};
const REGULAR_IDS: string[] = ['petr', 'sveta', 'kostya', 'akhmed', 'olga', 'misha'];

/** Наряды на праздник: платья, костюмы и фрак, в руках — цветы или шарик. */
const FESTIVE_OUTFITS = ['dress', 'suit', 'tuxedo', 'gown'] as const;
const FESTIVE_TINTS = [0xf6757a, 0xffffff, 0xfee761, 0xb55088, 0x8fd7f5, 0x262b44];
/** Сколько гостей наряжается в праздник и сколько приходит с детьми в день детей. */
const FESTIVE_SHARE = 0.35;
const KIDS_SHARE = 0.25;

/** Как выглядит герой шага: постоянный — со всем, что с ним случилось (life.ts), житель — свой образ. */
export function arcLook(scene: StoreScene, who: ArcWho, prop?: string): Look {
  const base: Look = REGULAR_IDS.includes(who) ? { ...livedRegular(scene.state, regularById(who as RegularId)).look } : { ...NPC[who as Exclude<ArcWho, RegularId>] };
  if (!prop) return base;
  return { ...base, prop: prop as PropId, propTint: prop === 'balloon' ? Phaser.Utils.Array.GetRandom([0xe43b44, 0xfee761, 0x5fcde4]) : undefined };
}

/** Утро после открытия: что из истории дня видно в мире (зовётся вместе с гостями сюжета). */
export function scheduleArcScene(scene: StoreScene): void {
  const at = (share: number, fn: () => void | Promise<void>) =>
    scene.time.delayedCall(DAY_SECONDS * share * 1000, () => {
      if (scene.running) void fn();
    });
  if (repayDay(scene.state)) scheduleRepay(scene, at);
  const today = arcSceneToday(scene.state);
  if (!today) return;
  const icon = ARCS[today.id].icon;
  if (today.show.includes('visit')) {
    const line = `${icon} ${t(`arc.${today.id}.${today.beat}.line` as TextKey)}`;
    at(0.18, () => visitors.runVisitor(scene, arcLook(scene, today.who, today.prop), line));
  }
  if (today.show.includes('festive')) at(0.03, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('arc.festive'), '#fee761'));
  if (today.show.includes('car')) at(0.3, () => weddingCar(scene));
  // Не в одно время с мусоровозом (visitors.morningCrew, 6–10 с дня): оба стоят в одной полосе.
  if (today.show.includes('truck')) at(0.2, () => movingTruck(scene));
  if (today.show.includes('runners')) at(0.12, () => runners(scene));
}

/** Нарядить случайного покупателя, если сегодня праздник (свадьба, сюрприз постоянных) или день детей. */
export function dressUp(scene: StoreScene, look: Look): Look {
  const today = arcSceneToday(scene.state);
  const repay = repayDay(scene.state);
  if (!today && !repay) return look;
  if ((repay || today?.show.includes('festive')) && Math.random() < FESTIVE_SHARE) {
    const prop: PropId = Math.random() < 0.5 ? 'bouquet' : 'balloon';
    return {
      ...look,
      outfit: Phaser.Utils.Array.GetRandom([...FESTIVE_OUTFITS]),
      outfitTint: Phaser.Utils.Array.GetRandom(FESTIVE_TINTS),
      prop,
      propTint: Phaser.Utils.Array.GetRandom([0xe43b44, 0xfee761, 0xf6757a]),
      coat: undefined,
    };
  }
  if (!today) return look;
  if (today.show.includes('kids') && Math.random() < KIDS_SHARE)
    return { ...look, kid: true, stroller: undefined, dog: undefined, bag: 'backpack', bagTint: Phaser.Utils.Array.GetRandom([0xe43b44, 0x5fcde4, 0xfeae34]), prop: 'balloon', propTint: 0xfee761 };
  if (today.show.includes('runners') && Math.random() < KIDS_SHARE) return { ...look, outfit: 'runner', outfitTint: Phaser.Utils.Array.GetRandom(FESTIVE_TINTS), coat: undefined, prop: undefined };
  return look;
}

/**
 * «Бабушкина тетрадь», кульминация (game/notebook.ts repayDay): в день жюри, он же последний день битвы
 * с «Гигантом», люди из тетради приходят «вернуть долги» — нарядные гости весь день и знакомые лица
 * у кассы с цветами: Валентина, Эдуард, баба Зина. Тот же праздник, что у хроник района.
 */
function scheduleRepay(scene: StoreScene, at: (share: number, fn: () => void | Promise<void>) => void): void {
  at(0.03, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('nb.repay.banner'), '#fee761'));
  const guests: [Exclude<ArcWho, RegularId>, TextKey, PropId][] = [
    ['valya', 'nb.repay.valya', 'bouquet'],
    ['eduard', 'nb.repay.eduard', 'bouquet'],
    ['zina', 'nb.repay.zina', 'balloon'],
  ];
  // В лёгкой графике — один гость, чтобы не толпились рядом с жюри.
  guests.slice(0, scene.lite ? 1 : guests.length).forEach(([who, key, prop], i) => at(0.1 + i * 0.12, () => visitors.runVisitor(scene, arcLook(scene, who, prop), `📓 ${t(key)}`)));
}

/** Свадебная машина: белая, с лентой и шарами, медленно проезжает мимо магазина. */
async function weddingCar(scene: StoreScene): Promise<void> {
  if (scene.parking?.onRoad) await cars.until(scene, () => !scene.parking?.onRoad);
  if (!scene.running) return;
  const left = -70;
  const right = scene.next.w + 70;
  const y = scene.streetY + 24;
  const body = scene.art(0, 0, 'car_sedan').setTint(0xffffff);
  const w = body.displayWidth;
  const ribbon = scene.add.rectangle(0, -2, w * 0.8, 1, 0xe43b44);
  // Шары привязаны к багажнику и висят над крышей.
  const top = -body.displayHeight / 2;
  const balloons = [0xe43b44, 0xfee761, 0xf6757a].map((c, i) => scene.add.ellipse(-w / 2 + 3 + i * 3, top - 6 - (i % 2) * 2, 4, 5, c));
  const strings = scene.add.rectangle(-w / 2 + 6, top - 1, 1, 6, 0xffffff);
  const car = scene.add.container(left, y, [body, scene.art(0, 0, 'car_sedan_lights'), ribbon, strings, ...balloons]).setDepth(y);
  cars.onRoad(scene, car, 'up', true);
  if (!scene.lite) for (const b of balloons) scene.tweens.add({ targets: b, y: b.y - 1, duration: 500 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: car, x: right, duration: 9000, onComplete: () => car.destroy() });
}

/** Грузовик с вещами: приезжает, стоит у тротуара (на крыше коробки), уезжает. */
async function movingTruck(scene: StoreScene): Promise<void> {
  if (scene.parking?.onRoad) await cars.until(scene, () => !scene.parking?.onRoad);
  if (!scene.running) return;
  const y = scene.streetY + 24;
  const boxes = [scene.art(-8, -12, 'box'), scene.art(2, -12, 'box'), scene.art(-3, -18, 'box')];
  const truck = scene.add.container(-140, y, [scene.art(0, 0, 'car_truck').setTint(0xfeae34), scene.art(0, 0, 'car_truck_lights'), ...boxes]).setDepth(y);
  const road = cars.onRoad(scene, truck, 'up', true);
  scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('arc.truck'), '#fff3b0');
  scene.tweens.add({
    targets: truck,
    // Встаёт напротив домов за дорогой, правее зебры — на виду у магазина.
    x: scene.layout.door.x + 110,
    duration: 3000,
    ease: 'Sine.easeOut',
    onComplete: () => {
      void scene
        .wait(8000)
        .then(() => {
          // Разгрузили: коробки уносят в дом.
          if (truck.active) boxes.forEach((b) => b.destroy());
          return cars.yieldToLot(scene, road, true);
        })
        .then(() => truck.active && scene.tweens.add({ targets: truck, x: scene.next.w + 160, duration: 3200, ease: 'Sine.easeIn', onComplete: () => truck.destroy() }));
    },
  });
}

/** Забег района: соседи с номерами бегут по тротуару (в лёгкой графике — меньше). */
function runners(scene: StoreScene): void {
  scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('arc.runners'), '#fee761');
  const count = scene.lite ? 3 : 7;
  for (let i = 0; i < count; i++) {
    scene.time.delayedCall(i * 1400 + Math.random() * 600, () => {
      if (!scene.running) return;
      const y = scene.streetY + Phaser.Math.Between(-4, 4);
      const look: Look = { ...randomLook(Phaser.Utils.Array.GetRandom(SHIRTS)), outfit: 'runner', outfitTint: Phaser.Utils.Array.GetRandom(FESTIVE_TINTS), coat: undefined, scarf: undefined };
      const runner = persons.makePerson(scene, -60, y, look);
      void persons.walk(scene, runner, scene.next.w + 60, y, CUSTOMER_SPEED * Phaser.Math.FloatBetween(1.7, 2.2)).then(() => runner.destroy());
    });
  }
}

/** Открылись: в день поставки кафе Ахмеда забирает хлеб, сам Ахмед заходит и благодарит. */
export function dealAtOpening(scene: StoreScene): void {
  const res = arcDeliver(scene.state);
  if (!res.result) return;
  scene.state = res.state;
  const result = res.result;
  if (result.delivered) {
    scene.refreshShelves();
    building.refreshWarehouse(scene);
  }
  const line = result.delivered ? t('arc.deal.paid', { n: result.pay }) : t('arc.deal.short');
  scene.time.delayedCall(DAY_SECONDS * 0.1 * 1000, () => {
    if (!scene.running) return;
    void visitors.runVisitor(scene, arcLook(scene, 'akhmed', 'stringbag'), `🥙 ${line}`, result.delivered, () => {
      if (result.delivered) sound.coin();
      if (result.ended) scene.time.delayedCall(1500, () => scene.running && scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('arc.deal.done'), '#c8ffb0'));
      scene.hud.update(scene.state, scene.timeLeft);
    });
  });
}
