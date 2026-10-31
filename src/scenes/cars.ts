// Парковка и машины: стоянка у магазина и подъезд вдоль правой стены, машины гостей (приезжают, паркуются,
// гость выходит и садится обратно, уезжают), фары вечером, пешеходы пропускают машины у въезда.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { UI_FONT } from '../ui/dom';
import { BIG_DAYS, bigDayFor, MASKS, type BigDayId } from '../game/bigday';
import type { Layout } from './layout';
import type { Light } from './light';
import {
  ART,
  TUTORIAL_DAYS,
  HEADLIGHT_POWER,
  LIGHT_DEPTH,
  CUSTOMER_SPEED,
  SHIRTS,
  customerLook,
  nightLook,
  type ParkSpot,
  type LotCar,
  type ParkingLot,
  type RoadCar,
  LOT,
  LOT_DRIVE_END,
  CAR_COLORS,
  CAR_TYPES,
} from './common';
import * as lighting from './lighting';
import * as weatherFx from './weatherFx';
import * as persons from './persons';
import * as visitors from './visitors';

/** Путь машины по прямой. */
const straight = (x0: number, y0: number, x1: number, y1: number): Phaser.Curves.Path => new Phaser.Curves.Path(x0, y0).lineTo(x1, y1);
/**
 * Отрезок пути машины: по прямой или дугой поворота (path), скорость равномерно меняется от v0 до v1
 * (точек мира в секунду), back — задним ходом, turn — какой поворотник мигает.
 */
interface CarLeg {
  path: Phaser.Curves.Path;
  v0: number;
  v1: number;
  back?: boolean;
  turn?: 'left' | 'right';
}

/** Фары в карте освещения: конус (ширина у дальнего края и длина, точки мира) и сила к ночи. */
const HEADLIGHT = { w: 24, h: 50 };
/** Поворот: плавная дуга от (x0, y0) к (x1, y1) через угол (cx, cy). */
const bend = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): Phaser.Curves.Path =>
  new Phaser.Curves.Path(x0, y0).quadraticBezierTo(x1, y1, cx, cy);
/**
 * Прямой участок: разгон от v0 до v на первых up точках, дальше ровно, на последних down — торможение
 * до v1 (поворотник turn мигает, пока тормозит). На коротком участке ровного куска нет.
 */
function cruise(x0: number, y0: number, x1: number, y1: number, v0: number, v: number, v1: number, up: number, down: number, turn?: CarLeg['turn']): CarLeg[] {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const speedUp = Math.min(up, length / 2);
  const slowDown = Math.min(down, length / 2);
  const at = (d: number): [number, number] => [x0 + ((x1 - x0) * d) / length, y0 + ((y1 - y0) * d) / length];
  const legs: CarLeg[] = [{ path: straight(x0, y0, ...at(speedUp)), v0, v1: v }];
  if (length - speedUp - slowDown > 0.5) legs.push({ path: straight(...at(speedUp), ...at(length - slowDown)), v0: v, v1: v });
  legs.push({ path: straight(...at(length - slowDown), x1, y1), v0: v, v1, turn });
  return legs;
}
/** Кто паркуется: легковые и фургоны (грузовики — только по улице). */
const LOT_CARS = CAR_TYPES.filter(([key]) => key !== 'car_truck');
/**
 * Проезд к парковке — справа от зала (от его правого края, точки мира): дорожка для пешеходов вдоль
 * стены (FOOT…DRIVE), за ней асфальт шириной в машину с запасом (DRIVE…DRIVE_END), дальше — соседний дом.
 */
const LOT_FOOT = 7;
const LOT_DRIVE = 14;
/** Полоса тротуара перед въездом, которую переезжает машина: полкузова и шаг прохожего от середины въезда. */
const LOT_MOUTH = 12;
/** Глубина машин и людей на парковке (за зданием глубина отрицательная): над асфальтом, под кронами. */
const LOT_DEPTH = -9.41;
/** Скорости машины у парковки (точек мира в секунду): по улице, в проезде, по парковке, на месте. */
const CAR_ROAD = 85;
const CAR_DRIVE = 80;
const CAR_LOT = 30;
const CAR_CREEP = 12;
/** Сколько мест утром заняты машинами соседей (в лёгкой графике машин меньше). */
const LOT_NEIGHBORS = 0.4;
const LOT_NEIGHBORS_LITE = 0.25;
/** Сколько покупателей приезжает на машине, если на парковке есть место (в лёгкой графике — реже). */
const CAR_CUSTOMERS = 0.5;
/** Позже этого (секунд до закрытия) на машине уже не приезжают: пока доедет и дойдёт — магазин закроется. */
const CAR_LAST_SECONDS = 50;
/**
 * В какие особые дни к парковке можно проехать по улице: в наводнение, ремонт дороги, шествия,
 * съёмки, свадьбу, автобус туристов и ограбление улица занята — машины стоят, где стоят.
 */
const LOT_ROAD_DAYS: BigDayId[] = ['heatwave', 'frost', 'quake', 'blackout', 'starfall', 'pigeons', 'sanitary', 'epidemic'];

/**
 * Парковка за магазином и проезд к ней с улицы вдоль правой стены: площадка с бордюром и разметкой
 * мест, островки с кустами, деревом и фонарём, у стены — дорожка для пешеходов, у въезда — знак «P».
 * Утром на местах стоят машины соседей; днём на машинах приезжают наши покупатели (carCustomer).
 * Возвращает занятые места — сквер не сажает туда деревья.
 */
export function buildParking(scene: StoreScene, next: Layout, street: number): { x: number; y: number; w: number; h: number }[] {
  const right = next.w + LOT_DRIVE_END;
  const left = right - LOT.w;
  const top = LOT.top;
  const bottom = top + LOT.h;
  const aisleY = top + LOT.h / 2;
  const driveX = next.w + LOT_DRIVE;
  const footX = next.w + LOT_FOOT;
  const tile = (x: number, y: number, w: number, h: number, key: string, depth: number) =>
    scene.add.tileSprite(x, y, w, h, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
  // Бордюр вокруг площадки и тень от него на асфальт.
  scene.add.rectangle(left - 3, top - 3, LOT.w + 6, LOT.h + 6, 0xc0cbdc).setOrigin(0).setDepth(-9.47);
  scene.add.rectangle(left - 3, top - 3, LOT.w + 6, 1, 0xe8edf4).setOrigin(0).setDepth(-9.47);
  tile(left, top, LOT.w, LOT.h, 'asphalt', -9.46);
  scene.add.rectangle(left, top, LOT.w, 2, 0x181425, 0.25).setOrigin(0).setDepth(-9.45);
  scene.add.rectangle(left, top, 2, LOT.h, 0x181425, 0.2).setOrigin(0).setDepth(-9.45);
  // Проезд с улицы: асфальт от площадки до тротуара (бордюр площадки тут разобран), справа — бордюр,
  // слева за поребриком — дорожка, по которой водители ходят в магазин и обратно.
  tile(driveX, bottom, right - driveX, street - bottom, 'asphalt', -9.46);
  scene.add.rectangle(right, bottom, 2, street - bottom, 0xc0cbdc).setOrigin(0).setDepth(-9.45);
  tile(footX, bottom - 30, driveX - footX, street - bottom + 30, 'paving', -9.455);
  scene.add.rectangle(driveX - 1, bottom - 30, 1, street - bottom + 30, 0xc0cbdc).setOrigin(0).setDepth(-9.45);
  // На тротуаре — края въезда, у дороги — пониженный бордюр.
  for (const x of [driveX, right]) scene.add.rectangle(x, street, 1, 22, 0x8b9bb4, 0.8).setOrigin(0).setDepth(-9.4);
  scene.add.rectangle(driveX, street + 22, right - driveX, 2, 0x5a6988).setOrigin(0).setDepth(-8.99);
  // Знак «P» у въезда: видно, куда сворачивают машины.
  const signX = right + 3;
  scene.add.rectangle(signX, street + 4, 1, 9, 0x5a6988).setOrigin(0.5, 1).setDepth(street + 4);
  scene.add.rectangle(signX, street - 8, 7, 7, 0x0099db).setStrokeStyle(0.6, 0xffffff).setDepth(street + 4.1);
  scene.add
    .text(signX, street - 8, 'P', { fontFamily: UI_FONT, fontSize: '6px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(street + 4.2);
  // Островки с газоном: по краям рядов — кусты, справа сверху — дерево (въезд под ним свободен),
  // справа снизу, у дорожки, — фонарь.
  const isle = (x: number, y: number, w: number, h: number) => {
    scene.add.rectangle(x - 1, y, w + 2, h, 0xc0cbdc).setOrigin(0).setDepth(-9.44);
    tile(x + 1, y + 2, w - 2, h - 4, 'grass', -9.435);
  };
  isle(left + 3, top + 4, 10, 24);
  isle(left + 3, bottom - 28, 10, 24);
  isle(right - 40, top + 4, 36, 22);
  isle(right - 42, bottom - 28, 10, 24);
  scene.art(left + 8, top + 18, 'bush').setDepth(-9.42);
  scene.art(left + 8, bottom - 12, 'bush').setDepth(-9.42);
  scene.add.image(right - 18, top + 24, 'shadow').setScale(2.1 / ART, 1.5 / ART).setAlpha(0.75).setDepth(-9.43);
  // Дерево — как в сквере: в снегу в шапке, осенью рыжее, на ветру качается.
  const tree = scene.art(right - 23, top + 24, 'tree_round').setOrigin(0.5, 0.9).setDepth(-9.42);
  scene.greenery.push(tree);
  scene.windTrees.push(tree);
  scene.art(right - 9, top + 20, 'bush_flower').setDepth(-9.42);
  // Фонарь парковки загорается первым — у него датчик сумерек; под ним на асфальте — пятно света.
  const lampX = right - 37;
  scene.art(lampX, bottom - 8, 'lamp').setOrigin(0.5, 0.95).setDepth(-9.42);
  const parkLamp = lighting.addLamp(scene, lampX, bottom - 30, 0.02, 0.5);
  lighting.lampGlow(scene, parkLamp, scene.art(lampX, bottom - 8, 'glow').setScale(40 / 64).setTint(0xffc860), 0.5, { key: 'light_pool', w: 70, h: 38, gain: 1.6 });
  // Разметка мест, стрелки проезда (въезд справа) и упоры для колёс у дальнего края каждого места.
  const bayX = left + 16;
  const marks = scene.add.graphics().setDepth(-9.45);
  marks.fillStyle(0xe6e1d6, 1);
  for (const ry of [top + 4, bottom - 30]) for (let i = 0; i <= LOT.bays; i++) marks.fillRect(bayX + i * LOT.bay, ry, 1.5, 26);
  marks.fillStyle(0xe6e1d6, 0.75);
  for (const [ax, dir] of [[bayX + 40, 1], [right - 66, -1]] as const) {
    marks.fillRect(ax - 7 * dir, aisleY - 0.75, 10 * dir, 1.5);
    marks.fillTriangle(ax + 3 * dir, aisleY - 3, ax + 3 * dir, aisleY + 3, ax + 7 * dir, aisleY);
  }
  scene.add
    .text(bayX + 92, aisleY, 'P', { fontFamily: UI_FONT, fontSize: '10px', color: '#e6e1d6', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(-9.44)
    .setAlpha(0.7);
  const stops = scene.add.graphics().setDepth(-9.445);
  // Два ряда мест носом к проезду посередине. Утром часть занята соседями — остальные ждут наших покупателей.
  const rnd = new Phaser.Math.RandomDataGenerator(['parking']);
  const full = scene.lite ? LOT_NEIGHBORS_LITE : LOT_NEIGHBORS;
  const spots: ParkSpot[] = [];
  for (const up of [true, false]) {
    for (let i = 0; i < LOT.bays; i++) {
      const spot: ParkSpot = { x: bayX + i * LOT.bay + LOT.bay / 2, y: up ? top + 18 : bottom - 18, up, car: null };
      spots.push(spot);
      stops.fillStyle(0xa8a8a8, 1).fillRect(spot.x - 6, up ? top + 6 : bottom - 8, 12, 2);
      stops.lineStyle(0.5, 0x5a6988, 1).strokeRect(spot.x - 6, up ? top + 6 : bottom - 8, 12, 2);
      if (rnd.frac() < full) spot.car = lotCar(scene, lotCarType(() => rnd.frac()), spot.x, spot.y, up ? -90 : 90, 'neighbor');
    }
  }
  scene.parking = {
    spots,
    left,
    right,
    top,
    bottom,
    aisleY,
    laneX: right - 12,
    footX: (footX + driveX) / 2,
    mouthY: street,
    busy: { drive: false, aisle: false },
    waiting: 0,
    onRoad: false,
    mouth: false,
  };
  scene.parkingTimer?.remove();
  scene.parkingTimer = scene.time.addEvent({ delay: 4000, loop: true, callback: () => parkingTick(scene) });
  return [
    { x: left - 8, y: top - 8, w: LOT.w + 16, h: LOT.h + 16 },
    { x: footX - 4, y: bottom, w: right - footX + 8, h: street - bottom },
  ];
}

/** Глубина на улице: перед зданием и сбоку — по высоте, как у людей; за ним (y < 0) — над асфальтом парковки. */
export function outsideDepth(y: number): number {
  return y >= 0 ? y : LOT_DEPTH + (y + 400) / 100000;
}

/** Машина у магазина: стоит на месте носом по heading (или сейчас поедет). */
export function lotCar(scene: StoreScene, [key, color]: [string, number | null, number], x: number, y: number, heading: number, owner: LotCar['owner']): LotCar {
  const body = scene.art(0, 0, key);
  if (color !== null) body.setTint(color || Phaser.Utils.Array.GetRandom(CAR_COLORS));
  const lights = scene.art(0, 0, `${key}_lights`);
  const blink = [0, 1].map(() => scene.add.rectangle(0, 0, 1.5, 1.5, 0xfeae34).setVisible(false));
  const box = scene.add.container(x, y, [body, lights, ...blink]);
  // Свет фар и вспышка поворотника — поверх вечерней темноты (как у ночного такси), едут вместе с машиной.
  // Они в своём контейнере (в координатах мира): отсечение за краем кадра (cullView) не трогает то, что ездит.
  const glow = (w: number, h: number, tint: number) => scene.art(x, y, 'glow').setScale(w / 64, h / 64).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  // Свет фар ложится в карту освещения конусом (на тёмном асфальте его видно слабо — поверх темноты
  // остаётся и лёгкое пятно); в лёгкой графике карта без движущихся огней — там пятно по-старому яркое.
  const beam = glow(30, 14, 0xfff0b0);
  const flash = glow(7, 7, 0xffa030);
  const lamps = scene.add.container(0, 0, [beam, flash]).setDepth(LIGHT_DEPTH + 1);
  box.once(Phaser.GameObjects.Events.DESTROY, () => lamps.destroy());
  const lit = headlights(scene, box);
  const car: LotCar = { box, body, lights, key, half: key === 'car_hatch' ? 13 : 16, heading, frame: 'side', blink, turn: null, beam, flash, headlights: lit, moving: false, owner, leaving: false };
  placeCar(scene, car, x, y, heading);
  return car;
}

/** Какая машина: седан, хэтчбек, такси или фургон — по весам, как на улице. */
export function lotCarType(random: () => number = Math.random): [string, number | null, number] {
  const total = LOT_CARS.reduce((sum, [, , weight]) => sum + weight, 0);
  let roll = random() * total;
  return LOT_CARS.find(([, , weight]) => (roll -= weight) < 0) ?? LOT_CARS[0];
}

/**
 * Машина в точке (x, y) носом по heading: кадр — ближайший из четырёх (вбок, вверх, вниз; влево —
 * зеркально), остаток поворота — наклоном. Поворотник мигает у носа и у багажника со своей стороны,
 * фары светят вперёд — пока едет и только вечером.
 */
export function placeCar(scene: StoreScene, car: LotCar, x: number, y: number, heading: number): void {
  const h = Phaser.Math.Angle.WrapDegrees(heading);
  car.heading = h;
  const west = Math.abs(h) > 135;
  const frame: LotCar['frame'] = Math.abs(h) <= 45 || west ? 'side' : h > 0 ? 'down' : 'up';
  if (frame !== car.frame) {
    car.frame = frame;
    const key = frame === 'side' ? car.key : `${car.key}_${frame}`;
    car.body.setTexture(key);
    car.lights.setTexture(`${key}_lights`);
  }
  car.body.setFlipX(west);
  car.lights.setFlipX(west);
  const tilt = Phaser.Math.Angle.WrapDegrees(h - (frame === 'side' ? (west ? 180 : 0) : frame === 'down' ? 90 : -90));
  car.box.setPosition(x, y).setAngle(tilt).setDepth(outsideDepth(y));
  // Нос в кадре (до наклона) и левый бок: поворотник — у носа и багажника со своей стороны.
  const fwd = frame === 'side' ? { x: west ? -1 : 1, y: 0 } : { x: 0, y: frame === 'down' ? 1 : -1 };
  const side = car.turn === 'right' ? -5 : 5;
  const on = car.turn !== null && Math.floor(scene.time.now / 300) % 2 === 0;
  car.blink.forEach((dot, i) => {
    const along = (i === 0 ? 1 : -1) * (car.half - 1);
    dot.setPosition(fwd.x * along + fwd.y * side, fwd.y * along - fwd.x * side).setVisible(on);
  });
  const t = Phaser.Math.DegToRad(tilt);
  const [dot] = car.blink;
  car.flash
    .setPosition(x + dot.x * Math.cos(t) - dot.y * Math.sin(t), y + dot.x * Math.sin(t) + dot.y * Math.cos(t))
    .setAlpha(on ? 0.2 + 0.7 * scene.evening : 0);
  const a = Phaser.Math.DegToRad(h);
  const reach = car.half + 12;
  car.beam
    .setPosition(x + Math.cos(a) * reach, y + Math.sin(a) * reach)
    .setRotation(a)
    .setAlpha(car.moving ? 0.75 * scene.evening * beamHaze(scene) : 0);
  // Конус фар — от носа вперёд по ходу.
  const lit = car.headlights;
  lit.x = x + Math.cos(a) * (car.half - 3);
  lit.y = y + Math.sin(a) * (car.half - 3);
  lit.rotation = a - Math.PI / 2;
  lit.set(car.moving ? HEADLIGHT_POWER * scene.evening : 0);
}

/** Пятно фар поверх темноты: в карте освещения фары и так светят — пятно лишь дымка; в лёгкой — как раньше. */
export function beamHaze(scene: StoreScene): number {
  return scene.lite ? 1 : 0.45;
}

/**
 * Фары в карте освещения: конус света (узким концом у носа машины) на асфальте впереди. Движется — его
 * нет в лёгкой графике. Машина уехала — свет гаснет вместе с ней.
 */
export function headlights(scene: StoreScene, car: Phaser.GameObjects.GameObject): Light {
  const lit = scene.light.add('light_cone', 0, 0, HEADLIGHT.w, HEADLIGHT.h, 0xfff0c8, 0).attach(car);
  lit.originY = 0;
  lit.moving = true;
  return lit;
}

/** Машина едет по отрезкам пути: место и направление — по прямой или дуге, скорость меняется плавно. */
export async function drive(scene: StoreScene, car: LotCar, legs: CarLeg[]): Promise<void> {
  for (const leg of legs) {
    if (!car.box.active) return;
    const length = leg.path.getLength();
    if (length < 0.5) continue;
    car.turn = leg.turn ?? null;
    const seconds = (2 * length) / Math.max(1, leg.v0 + leg.v1);
    const place = (u: number) => {
      const p = leg.path.getPoint(u);
      const d = leg.path.getTangent(u);
      placeCar(scene, car, p.x, p.y, Phaser.Math.RadToDeg(Math.atan2(d.y, d.x)) + (leg.back ? 180 : 0));
    };
    await new Promise<void>((done) =>
      scene.tweens.addCounter({
        from: 0,
        to: seconds,
        duration: seconds * 1000,
        onUpdate: (tween) => {
          const time = tween.getValue() ?? 0;
          place(Phaser.Math.Clamp((leg.v0 * time + ((leg.v1 - leg.v0) * time * time) / (2 * seconds)) / length, 0, 1));
        },
        onComplete: () => {
          if (car.box.active) place(1);
          done();
        },
      }),
    );
  }
  car.turn = null;
  if (car.box.active) placeCar(scene, car, car.box.x, car.box.y, car.heading);
}

/** Машина стоит с работающим мотором (фары горят, поворотник мигает), пока ready() не скажет «можно». */
export function carWait(scene: StoreScene, car: LotCar, ready: () => boolean, turn: LotCar['turn']): Promise<void> {
  car.turn = turn;
  return new Promise((done) => {
    const tick = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      repeat: -1,
      onUpdate: () => {
        if (!car.box.active) {
          tick.stop();
          return;
        }
        if (!ready()) {
          placeCar(scene, car, car.box.x, car.box.y, car.heading);
          return;
        }
        tick.stop();
        done();
      },
    });
  });
}

/** Ждёт, пока ready() не станет истинным (проверяет несколько раз в секунду); перестройка мира обрывает ожидание. */
export function until(scene: StoreScene, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((done) => {
    const stop = scene.worldTimer(150, () => {
      if (!ready()) return;
      stop();
      done();
    });
  });
}

/** Человек идёт по точкам на улице напрямик (без обхода полок); перестройка мира обрывает путь. */
export async function stroll(scene: StoreScene, sprite: Phaser.GameObjects.Container, points: { x: number; y: number }[]): Promise<void> {
  if (!sprite.active || !points.length) return;
  await persons.walkVia(scene, sprite, points, undefined, { depth: (y) => outsideDepth(y), direct: true });
}

/** Занять проезд (drive) и/или парковку (aisle), если они свободны. */
export function lotTake(scene: StoreScene, lot: ParkingLot, need: ('drive' | 'aisle')[]): boolean {
  if (scene.parking !== lot || need.some((key) => lot.busy[key])) return false;
  for (const key of need) lot.busy[key] = true;
  return true;
}

/** Машина появилась на улице: с парковки выезжают, только когда в её полосе слева никого нет. */
export function onRoad(scene: StoreScene, obj: Phaser.GameObjects.Container, lane: 'up' | 'down', slow = false): RoadCar {
  const entry: RoadCar = { obj, lane, slow };
  scene.roadTraffic.add(entry);
  obj.once(Phaser.GameObjects.Events.DESTROY, () => scene.roadTraffic.delete(entry));
  return entry;
}

/**
 * Фургон (автобус, мусоровоз) трогается с места: сначала пропускает машину с парковки, если она сейчас
 * на дороге (сворачивает к парковке или уже выехала), — не въезжает ей в багажник и не проезжает сквозь
 * неё; та, что ещё ждёт у тротуара, сама его пропустит. away — уезжает насовсем и разгоняется, как все:
 * он больше не медленный — с парковки при нём не выезжают и справа через его полосу не сворачивают.
 */
export async function yieldToLot(scene: StoreScene, car: RoadCar, away = false): Promise<void> {
  await until(scene, () => !scene.parking?.onRoad || scene.parking.mouth);
  if (away) car.slow = false;
}

/** Можно ли ехать по улице к парковке: в особые дни, когда улица занята, машины стоят, где стоят. */
export function lotRoadOpen(scene: StoreScene): boolean {
  const big = scene.bigObjs.length ? bigDayFor(scene.state.day) : null;
  return !big || LOT_ROAD_DAYS.includes(big);
}

/**
 * Откуда можно подъехать к парковке (пока машина с парковки на дороге, новые на улице не появляются).
 * Слева — по ближней к магазину полосе, если в ней нет автобуса или фургона, которые стоят или тащатся
 * впереди (или ждут за краем, чтобы поехать к складу), а быстрая машина уже отъехала от края (сзади
 * эта её не догонит — медленнее). Справа — по дальней полосе с поворотом направо через ближнюю: если
 * справа только что никто не въехал, а в ближней полосе до въезда пусто (её переезжать). null — пока никак.
 */
export function arrivalSide(scene: StoreScene, lot: ParkingLot): 'left' | 'right' | null {
  let left = true;
  let right = true;
  for (const v of scene.roadTraffic) {
    if (!v.obj.active) continue;
    const { x } = v.obj;
    if (v.lane === 'up' && (v.slow ? x > -300 && x < scene.next.w + 80 : x < 0)) left = false;
    if (v.lane === 'down' && x > scene.next.w + 20) right = false;
    if (v.lane === 'up' && x < lot.laneX + 40 && (!v.slow || x > lot.laneX - 160)) right = false;
  }
  return left && right ? (Math.random() < 0.5 ? 'left' : 'right') : left ? 'left' : right ? 'right' : null;
}

/** Можно ли выехать с проезда на улицу: в своей полосе слева никого, перед въездом нет прохожих. */
export function mouthClear(scene: StoreScene, lot: ParkingLot): boolean {
  for (const v of scene.roadTraffic) {
    if (v.lane === 'up' && v.obj.active && v.obj.x < lot.laneX + 40 && (!v.slow || v.obj.x > -220)) return false;
  }
  return sidewalkClear(scene, lot);
}

/** На тротуаре перед въездом никого: машина переедет его, ни в кого не упершись. */
export function sidewalkClear(scene: StoreScene, lot: ParkingLot): boolean {
  for (const p of scene.people) if (Math.abs(p.x - lot.laneX) < LOT_MOUTH && Math.abs(p.y - scene.streetY) < 9) return false;
  return true;
}

/**
 * Машина переезжает тротуар у въезда: прохожие, что подходят к въезду, останавливаются перед ним
 * и ждут, пока она проедет, — никто не проходит сквозь машину. Возвращает «проехала»: идут дальше.
 */
export function holdWalkers(scene: StoreScene, lot: ParkingLot): () => void {
  const held = new Set<Phaser.GameObjects.Container>();
  // Смотрим каждый кадр, как машина ждёт просвета (carWait): шаг прохожих — тоже твин, в одном с ним времени.
  const tick = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 1000,
    repeat: -1,
    onUpdate: () => {
      for (const p of scene.people) {
        if (held.has(p) || !p.getData('walking') || Math.abs(p.y - scene.streetY) >= 9) continue;
        const dx = p.x - lot.laneX;
        const pace = (p.getData('pace') as number | undefined) ?? CUSTOMER_SPEED;
        // Подходит к въезду и вот-вот на него ступит (за шаг-другой), а не уходит от него.
        if (Math.abs(dx) < LOT_MOUTH || Math.abs(dx) > LOT_MOUTH + 2 + pace * 0.5 || p.getData('facing') !== (dx < 0 ? 'right' : 'left')) continue;
        const move = p.getData('move') as Phaser.Tweens.Tween | undefined;
        if (!move?.isPlaying()) continue;
        move.pause();
        p.setData('walking', false);
        held.add(p);
      }
    },
  });
  return () => {
    tick.stop();
    for (const p of held) {
      const move = p.getData('move') as Phaser.Tweens.Tween | undefined;
      if (!p.active || !move?.isPaused()) continue;
      p.setData('walking', true);
      move.resume();
    }
  };
}

/**
 * Очередной покупатель приезжает на машине — если на парковке есть место и проезд к ней свободен.
 * Поток гостей тот же: этот просто придёт с парковки, а не с тротуара (arriveByCar). true — поехал.
 * Под вечер и в короткую ночную смену не приезжают (пока доедет и дойдёт — магазин закроется),
 * в обучение — тоже.
 */
export function carCustomer(scene: StoreScene): boolean {
  const lot = scene.parking;
  if (!lot || scene.night || scene.state.day <= TUTORIAL_DAYS || scene.timeLeft < CAR_LAST_SECONDS || !lotRoadOpen(scene)) return false;
  if (lot.busy.drive || lot.waiting > 0 || lot.onRoad) return false;
  const side = arrivalSide(scene, lot);
  if (!side || Math.random() >= CAR_CUSTOMERS * (scene.lite ? 0.5 : 1)) return false;
  const free = lot.spots.filter((s) => !s.car);
  if (!free.length) return false;
  void arriveByCar(scene, lot, Phaser.Utils.Array.GetRandom(free), side);
  return true;
}

/**
 * Покупатель на машине: едет по улице в своей полосе, у въезда сбрасывает скорость, мигает и сворачивает
 * в проезд вдоль магазина (слева — налево из ближней полосы, справа — направо через неё); если по
 * тротуару перед въездом кто-то идёт — останавливается и пропускает его. В конце проезда —
 * на парковку (если там кто-то паркуется — ждёт), по ней — к своему месту, заезжает носом по дуге
 * и глохнет. Водитель выходит и по дорожке вдоль стены идёт на тротуар — там он уже обычный
 * покупатель (spawnCustomer), а после покупок вернётся к машине (driveHome).
 */
export async function arriveByCar(scene: StoreScene, lot: ParkingLot, spot: ParkSpot, side: 'left' | 'right'): Promise<void> {
  const { laneX, aisleY } = lot;
  const road = scene.streetY + 24;
  const far = scene.streetY + 42;
  const r = 12;
  lot.busy.drive = true;
  lot.onRoad = true;
  const from = side === 'left' ? -70 : scene.next.w + 90;
  const car = lotCar(scene, lotCarType(), from, side === 'left' ? road : far, side === 'left' ? 0 : 180, 'customer');
  car.moving = true;
  spot.car = car;
  // Перед самым поворотом смотрит на тротуар: кто уже на въезде — пропускает (тормозит до конца и ждёт),
  // кто только подходит — сам подождёт, пока машина проедет (holdWalkers).
  const lane = side === 'left' ? road : far;
  const turnAt = side === 'left' ? laneX - r : laneX + r;
  const before = side === 'left' ? turnAt - 8 : turnAt + 8;
  const slow = side === 'left' ? 16 : 14;
  await drive(scene, 
    car,
    side === 'left'
      ? cruise(from, road, before, road, CAR_ROAD, CAR_ROAD, slow, 0, 110, 'left')
      : cruise(from, far, before, far, CAR_ROAD * 0.8, CAR_ROAD * 0.8, slow, 0, 50, 'right'),
  );
  const clear = sidewalkClear(scene, lot);
  await drive(scene, car, [{ path: straight(before, lane, turnAt, lane), v0: slow, v1: clear ? slow : 0, turn: side }]);
  if (!clear) await carWait(scene, car, () => sidewalkClear(scene, lot), side);
  const release = holdWalkers(scene, lot);
  const v0 = clear ? slow : 0;
  await drive(scene, 
    car,
    side === 'left'
      ? [{ path: bend(laneX - r, road, laneX, road, laneX, road - r), v0, v1: 18, turn: 'left' }]
      : [
          { path: bend(laneX + r, far, laneX, far, laneX, far - r), v0, v1: 16, turn: 'right' },
          { path: straight(laneX, far - r, laneX, road - r), v0: 16, v1: 18, turn: 'right' },
        ],
  );
  lot.onRoad = false;
  // По проезду вдоль магазина: разгон, ровно, перед поворотом на парковку — тормозит. Разогнался —
  // уже за тротуаром: прохожие идут дальше.
  const corner = aisleY + r;
  const legs = cruise(laneX, road - r, laneX, corner, 18, CAR_DRIVE, 14, 50, 60, 'left');
  const brake = legs.pop()!;
  await drive(scene, car, legs.splice(0, 1));
  release();
  await drive(scene, car, legs);
  const free = lotTake(scene, lot, ['aisle']);
  if (!free) brake.v1 = 0;
  await drive(scene, car, [brake]);
  if (!free) await carWait(scene, car, () => lotTake(scene, lot, ['aisle']), 'left');
  await drive(scene, car, [{ path: bend(laneX, corner, laneX, aisleY, laneX - r, aisleY), v0: free ? 14 : 0, v1: 14, turn: 'left' }]);
  // Свернул на парковку — проезд свободен для следующей машины.
  lot.busy.drive = false;
  const bay = 14;
  const into = spot.x + bay;
  const dir = spot.up ? -1 : 1;
  const turn = spot.up ? 'right' : 'left';
  await drive(scene, car, [
    ...cruise(laneX - r, aisleY, into, aisleY, 14, CAR_LOT, CAR_CREEP, 20, 30, turn),
    { path: bend(into, aisleY, spot.x, aisleY, spot.x, aisleY + dir * bay), v0: CAR_CREEP, v1: CAR_CREEP, turn },
    { path: straight(spot.x, aisleY + dir * bay, spot.x, spot.y), v0: CAR_CREEP, v1: 0 },
  ]);
  if (!car.box.active) {
    lot.busy.aisle = false;
    return;
  }
  car.moving = false;
  placeCar(scene, car, spot.x, spot.y, spot.up ? -90 : 90);
  // Водитель выходит (дверь слева по ходу) и идёт по парковке к дорожке вдоль стены, по ней — на тротуар.
  let look = scene.night ? nightLook() : customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day);
  const big = bigDayFor(scene.state.day);
  if (big && BIG_DAYS[big].masks && !look.face && Math.random() < MASKS) look = { ...look, face: 'medmask' };
  const door = carDoor(spot);
  const driver = persons.makePerson(scene, door.x, door.y, look);
  driver.setDepth(outsideDepth(door.y)).setAlpha(0);
  weatherFx.addUmbrella(scene, driver);
  scene.tweens.add({ targets: driver, alpha: 1, duration: 250 });
  await stroll(scene, driver, [{ x: door.x, y: aisleY + 3 }, { x: lot.footX, y: aisleY + 3 }, { x: lot.footX, y: lot.bottom }]);
  lot.busy.aisle = false;
  await stroll(scene, driver, [{ x: lot.footX, y: scene.streetY }]);
  if (!driver.active) return;
  // Пока шёл, магазин закрылся — возвращается к машине.
  if (scene.running && scene.timeLeft > 0 && !scene.siege) scene.spawnCustomer(undefined, { sprite: driver, look, car: spot });
  else void driveHome(scene, driver, spot);
}

/** Где у машины на месте дверь водителя (слева по ходу): там он выходит и садится. */
export function carDoor(spot: ParkSpot): { x: number; y: number } {
  return { x: spot.x + (spot.up ? -9 : 9), y: spot.y + (spot.up ? 6 : -6) };
}

/**
 * Покупатель с покупками возвращается к машине: по тротуару к дорожке вдоль стены, по ней на парковку —
 * и уезжает (boardCar). Парковку за это время перестроили — просто уходит по тротуару.
 */
export async function driveHome(scene: StoreScene, sprite: Phaser.GameObjects.Container, spot: ParkSpot): Promise<void> {
  const lot = scene.parking;
  if (!lot || !lot.spots.includes(spot) || !spot.car?.box.active) {
    void visitors.strollAway(scene, sprite);
    return;
  }
  await stroll(scene, sprite, [
    { x: sprite.x, y: scene.streetY },
    { x: lot.footX, y: scene.streetY },
  ]);
  await boardCar(scene, lot, spot, sprite);
}

/** Водитель по дорожке поднимается на парковку, ждёт, пока проезд свободен, садится — и машина уезжает. */
export async function boardCar(scene: StoreScene, lot: ParkingLot, spot: ParkSpot, sprite: Phaser.GameObjects.Container): Promise<void> {
  const car = spot.car;
  if (!car) return;
  car.leaving = true;
  // Ждёт у края парковки, пока по ней и по проезду никто не едет (если ждут несколько — друг за другом).
  await stroll(scene, sprite, [{ x: lot.footX, y: lot.bottom + 4 + 7 * Math.min(lot.waiting, 3) }]);
  lot.waiting++;
  await until(scene, () => lotTake(scene, lot, ['drive', 'aisle']));
  lot.waiting--;
  const door = carDoor(spot);
  await stroll(scene, sprite, [{ x: lot.footX, y: lot.aisleY + 3 }, { x: door.x, y: lot.aisleY + 3 }, door]);
  if (!sprite.active || !car.box.active) {
    lot.busy.drive = false;
    lot.busy.aisle = false;
    return;
  }
  // Сел в машину.
  await new Promise<void>((done) => scene.tweens.add({ targets: sprite, alpha: 0, duration: 200, onComplete: () => done() }));
  sprite.destroy();
  await lotDepart(scene, lot, spot, car);
}

/**
 * Машина уезжает с парковки (проезд и парковка уже заняты для неё): задним ходом с места и по дуге —
 * носом к выезду, по парковке и проезду к улице; у тротуара пропускает машины в своей полосе
 * и прохожих, мигает — и уезжает направо, за край.
 */
export async function lotDepart(scene: StoreScene, lot: ParkingLot, spot: ParkSpot, car: LotCar): Promise<void> {
  const { laneX, aisleY } = lot;
  const r = 12;
  const back = 14;
  const dir = spot.up ? -1 : 1;
  // Завёлся: зажглись фары.
  car.moving = true;
  placeCar(scene, car, spot.x, spot.y, car.heading);
  await scene.wait(400);
  await drive(scene, car, [
    { path: straight(spot.x, spot.y, spot.x, aisleY + dir * back), v0: 0, v1: CAR_CREEP, back: true },
    { path: bend(spot.x, aisleY + dir * back, spot.x, aisleY, spot.x - back, aisleY), v0: CAR_CREEP, v1: 0, back: true },
  ]);
  spot.car = null;
  await drive(scene, car, [
    ...cruise(spot.x - back, aisleY, laneX - r, aisleY, 0, CAR_LOT, 14, 20, 30, 'right'),
    { path: bend(laneX - r, aisleY, laneX, aisleY, laneX, aisleY + r), v0: 14, v1: 16, turn: 'right' },
  ]);
  lot.busy.aisle = false;
  const stop = lot.mouthY - 17;
  await drive(scene, car, cruise(laneX, aisleY + r, laneX, stop, 16, CAR_DRIVE, 0, 50, 60, 'left'));
  // У тротуара (нос — у его края) ждёт просвета: в её полосе новые машины не появляются, пока она
  // не уехала. Пока она переезжает тротуар, подошедшие прохожие ждут.
  lot.onRoad = true;
  lot.mouth = true;
  await carWait(scene, car, () => mouthClear(scene, lot), 'left');
  lot.mouth = false;
  const release = holdWalkers(scene, lot);
  const road = scene.streetY + 24;
  await drive(scene, car, [
    { path: straight(laneX, stop, laneX, road - r), v0: 0, v1: 24, turn: 'left' },
    { path: bend(laneX, road - r, laneX, road, laneX + r, road), v0: 24, v1: 28, turn: 'left' },
  ]);
  release();
  lot.busy.drive = false;
  await drive(scene, car, [{ path: straight(laneX + r, road, scene.next.w + 100, road), v0: 28, v1: CAR_ROAD * 1.3 }]);
  lot.onRoad = false;
  car.box.destroy();
}

/**
 * Соседские машины разъезжаются во второй половине дня (к вечеру парковка пустеет), а утром — только
 * если мест почти не осталось: проезд узкий, пусть сначала заезжают наши покупатели (carCustomer).
 * За машиной приходит водитель по дорожке вдоль стены.
 */
export function parkingTick(scene: StoreScene): void {
  const lot = scene.parking;
  if (!lot || !scene.running || scene.arranging || !lotRoadOpen(scene)) return;
  if (lot.busy.drive || lot.busy.aisle || lot.waiting > 0 || lot.onRoad) return;
  const taken = lot.spots.filter((s) => s.car).length;
  if (!scene.night && scene.timeLeft > CAR_LAST_SECONDS && taken < lot.spots.length - 2) return;
  const target = Math.round(lot.spots.length * (0.5 - 0.3 * scene.evening) * (scene.lite ? 0.7 : 1));
  // Те, за кем уже идут, не в счёт: уедут и так.
  const staying = lot.spots.filter((s) => s.car && !s.car.leaving).length;
  const parked = lot.spots.filter((s) => s.car?.owner === 'neighbor' && !s.car.leaving);
  if (staying <= target || !parked.length || Math.random() >= 0.3) return;
  // Сосед приходит из-за угла по тротуару и по дорожке вдоль стены поднимается к машине — как наши покупатели.
  const spot = Phaser.Utils.Array.GetRandom(parked);
  spot.car!.leaving = true;
  const driver = persons.makePerson(scene, scene.next.w + 60, scene.streetY + Phaser.Math.Between(-3, 3), customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  driver.setAlpha(0);
  scene.tweens.add({ targets: driver, alpha: 1, duration: 250 });
  weatherFx.addUmbrella(scene, driver);
  void driveHome(scene, driver, spot);
}

/**
 * Утро: за ночь соседи вернулись — на свободных местах снова стоят их машины (сразу, без заезда: магазин
 * был закрыт). Днём они понемногу разъезжаются (parkingTick), а места занимают наши покупатели.
 */
export function refillParking(scene: StoreScene): void {
  const lot = scene.parking;
  if (!lot) return;
  const want = Math.round(lot.spots.length * (scene.lite ? LOT_NEIGHBORS_LITE : LOT_NEIGHBORS));
  let have = lot.spots.filter((s) => s.car?.owner === 'neighbor' && !s.car.leaving).length;
  for (const spot of Phaser.Utils.Array.Shuffle(lot.spots.filter((s) => !s.car))) {
    if (have >= want) break;
    spot.car = lotCar(scene, lotCarType(), spot.x, spot.y, spot.up ? -90 : 90, 'neighbor');
    have++;
  }
}
