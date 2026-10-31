// Люди в мире: как собрать человечка (внешность, походка, спутник, собака, тележка или коляска), куда он
// смотрит и какое у него настроение, ходьба по точкам (walk/walkVia/stepAlong, остановка — haltWalk), очередь
// к кассе и облачко над ней, ожидание в очереди. Кто и зачем идёт — shoppers.ts, staff.ts, visitors.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { findPath } from './paths';
import {
  facingAlong,
  makeRoute,
  paceAt,
  planPace,
  polylineLength,
  roundCorners,
  sampleRoute,
  sidestep,
  turnVia,
  type Facing,
  type Passer,
  type Pace,
  type Route,
} from './stride';
import { BIG_LAYER_DY } from './wardrobe';
import { hasUpgrade } from '../game/upgrades';
import type { Point } from './layout';
import {
  ART,
  FACADE_H,
  PATIENCE_MS,
  SHIRTS,
  type EmoteKey,
  VIEW_SUFFIX,
  type Look,
  STEP_GRACE,
  customerLook,
  type Customer,
  type Gait,
} from './common';
import * as effects from './effects';
import * as weatherFx from './weatherFx';

/** Седые волосы (у пенсионеров, бабушек, Деда Мороза): по ним видно, что человек в годах. */
const GREY_HAIR = new Set([0xd8d8e0, 0xc0cbdc, 0xffffff]);

/**
 * Свой шаг у походки: speed — во сколько раз быстрее обычного идёт своим ходом (когда не спешит
 * по делу), stride — во сколько раз шире шаг. Старик идёт медленно и мелко (ноги перебирают реже),
 * ребёнок — чуть быстрее и короче (семенит), спортсмен — бодро и широко.
 */
const GAIT: Record<Gait, { speed: number; stride: number }> = {
  cane: { speed: 0.8, stride: 0.85 },
  elder: { speed: 0.92, stride: 0.9 },
  kid: { speed: 1.05, stride: 0.95 },
  sporty: { speed: 1.12, stride: 1.06 },
  bouncy: { speed: 1.05, stride: 1 },
};
/**
 * Разброс шага у каждого (от и до). Середина чуть выше единицы: медленных стариков уравновешивают
 * остальные, и в среднем покупатели ходят столько же, сколько прежде, — поток через кассу не меняется.
 */
const OWN_SPEED: [number, number] = [0.93, 1.09];
/** Очередь теснее этого (точки мира) — встают ёлочкой, через одного на столько левее. */
const QUEUE_SNUG = 12;
const QUEUE_STAGGER = 5;
/** Поворот кругом (мс времени игры): на миг — промежуточная сторона, а не мгновенный разворот. */
const TURN_MS = 90;
/** Как быстро отходит вбок, чтобы разойтись со встречным (точек мира в секунду). */
const LANE_SPEED = 16;
/** Как часто заново смотрит, нет ли кого впереди (мс времени игры). */
const LANE_EVERY = 110;
/**
 * Шаг человека — всё, что меняется каждый кадр, в одном объекте (а не в setData: тот на каждую
 * запись рассылает события). Кадр шага растёт с пройденным путём, а не по часам.
 */
interface Stride {
  /** Кадр шага (дробный): 0…4 — два шага, растёт на пройденный путь. */
  phase: number;
  /** Где был в прошлом кадре: сколько прошёл. */
  lastX: number;
  lastY: number;
  /** Свой шаг: множители скорости (своим ходом) и ширины шага — у каждого чуть свои. */
  speed: number;
  stride: number;
  /** Каким по счёту шагом трогается: то с левой ноги, то с правой. */
  foot: number;
  /** Когда (время сцены) закончил прошлый путь и с какой скоростью шёл (точек в мс времени игры). */
  endAt: number;
  vel: number;
  /** Доля крейсерской скорости сейчас (разгон и торможение): наклон на бегу растёт с ней. */
  ratio: number;
  /** Кадр шага в прошлый раз: пыль и звук — один раз на шаг. */
  frame: number;
  /** Текущий путь: точки, скорость по нему, на каком отрезке и сколько прошло времени (мс игры). */
  route?: Route;
  pace?: Pace;
  seg: number;
  t: number;
  /** Сдвиг вбок от пути (разойтись со встречным): сейчас и куда тянется, когда снова посмотреть вперёд. */
  lane: number;
  laneGoal: number;
  laneAt: number;
  /** Направление пути сейчас: по нему другие решают, встречный это или попутчик. */
  dirX: number;
  dirY: number;
  /** Поворот кругом: какой стороной встать и когда (время пути). */
  turn?: { to: Facing; at: number };
  /** Глубина по высоте не как в зале (за зданием, на парковке, — своя); нет — глубина = y. */
  depthOf?: (y: number) => number;
}
const gaitOf = (look: Look): Gait | undefined =>
  look.prop === 'cane'
    ? 'cane'
    : look.kid
      ? 'kid'
      : look.outfit === 'tracksuit' || look.outfit === 'runner'
        ? 'sporty'
        : look.hat === 'headphones'
          ? 'bouncy'
          : look.hair !== undefined && GREY_HAIR.has(look.hair)
            ? 'elder'
            : undefined;
/** Аксессуары, которые видны только спереди. */
const FRONT_ONLY = new Set(['acc_badge', 'acc_tie', 'acc_glasses', 'p_pat_print']);

/** Человечек из слоёв: тень, штаны, рубашка, форма, кожа, волосы — каждый слой перекрашивается тинтом. */
export function makePerson(scene: StoreScene, x: number, y: number, look: Look): Phaser.GameObjects.Container {
  const shadow = scene.art(0, 8.5, 'shadow');
  const legs = scene.art(0, 0, 'p_legs0').setTint(look.pants ?? 0x3a4466);
  const shirt = scene.art(0, 0, 'p_shirt').setTint(look.shirt);
  const skin = scene.art(0, 0, 'p_skin').setTint(look.skin);
  const hairBase = `p_hair_${look.style ?? 'short'}`;
  const hair = scene.art(0, 0, hairBase).setTint(look.hair ?? 0x4a2c1a);
  // Слои, которые поворачиваются вместе с человеком: [картинка, имя текстуры спереди].
  const layers: [Phaser.GameObjects.Image, string][] = [
    [shirt, 'p_shirt'],
    [skin, 'p_skin'],
    [hair, hairBase],
  ];
  const parts: Phaser.GameObjects.Image[] = [shadow];
  // Вещь из гардероба: слой поворачивается вместе с человеком; большие холсты стоят чуть выше.
  const wear = (key: string, tint?: number, big = false): Phaser.GameObjects.Image => {
    const img = scene.art(0, big ? BIG_LAYER_DY : 0, key).setTint(tint ?? 0xffffff);
    img.setData('dy', big ? BIG_LAYER_DY : 0);
    layers.push([img, key]);
    return img;
  };
  // На спине (веер, плащ, гитара): за телом, а когда человек отвернулся — поверх (setFacing).
  const back = look.back ? wear(`w_back_${look.back}`, look.backTint, true) : undefined;
  if (back) parts.push(back);
  parts.push(legs, shirt);
  if (look.coat !== undefined) {
    const coat = scene.art(0, 0, 'p_coat').setTint(look.coat);
    layers.push([coat, 'p_coat']);
    parts.push(coat);
  } else if (look.pattern) {
    // Светлая рубашка — тёмный узор, тёмная — светлый.
    const c = Phaser.Display.Color.IntegerToColor(look.shirt);
    const light = (c.red * 299 + c.green * 587 + c.blue * 114) / 1000 > 150;
    const tint = look.pattern === 'print' ? (light ? 0xe43b44 : 0xfee761) : light ? 0x262b44 : 0xffffff;
    const pat = scene.art(0, 0, `p_pat_${look.pattern}`).setTint(tint).setAlpha(look.pattern === 'print' ? 1 : 0.45);
    layers.push([pat, `p_pat_${look.pattern}`]);
    parts.push(pat);
  }
  if (look.outfit) parts.push(wear(`w_outfit_${look.outfit}`, look.outfitTint));
  if (look.acc) {
    const acc = scene.art(0, 0, `acc_${look.acc}`).setTint(look.accTint ?? 0xffffff);
    layers.push([acc, `acc_${look.acc}`]);
    parts.push(acc);
  }
  let satchel: Phaser.GameObjects.Image | undefined;
  if (look.bag) {
    const bag = scene.art(0, 0, look.bag).setTint(look.bagTint ?? 0xffffff);
    layers.push([bag, look.bag]);
    parts.push(bag);
    if (look.bag === 'bag') satchel = bag;
  }
  parts.push(skin);
  if (look.scarf !== undefined) {
    const scarf = scene.art(0, 0, 'p_scarf').setTint(look.scarf);
    layers.push([scarf, 'p_scarf']);
    parts.push(scarf);
  }
  if (look.face) {
    const hairy = look.face === 'beard' || look.face === 'mustache';
    parts.push(wear(`w_face_${look.face}`, look.faceTint ?? (hairy ? (look.hair ?? 0x4a2c1a) : undefined)));
  }
  if (look.glasses) {
    const glasses = scene.art(0, 0, 'acc_glasses');
    layers.push([glasses, 'acc_glasses']);
    parts.push(glasses);
  }
  parts.push(hair);
  if (look.hat) parts.push(wear(`w_hat_${look.hat}`, look.hatTint, true));
  const prop = look.prop ? wear(`w_prop_${look.prop}`, look.propTint, true) : undefined;
  if (prop) parts.push(prop);
  const person = scene.add.container(x, y, parts).setDepth(y);
  if (back) person.setData('back', back);
  // Вещь в руке и сумка через плечо покачиваются в такт шагу (animatePeople).
  if (prop) person.setData('prop', prop);
  if (satchel) person.setData('satchel', satchel);
  const gait = gaitOf(look);
  person.setData('gait', gait);
  // Свой шаг: и скорость, и ширина шага у каждого чуть свои — толпа не марширует в ногу.
  const own = gait ? GAIT[gait] : { speed: 1, stride: 1 };
  person.setData('stride', newStride(x, y, own.speed * Phaser.Math.FloatBetween(...OWN_SPEED), own.stride * Phaser.Math.FloatBetween(0.94, 1.06)));
  const baseScale = look.kid ? 0.8 : 1;
  person.setScale(baseScale);
  person.setData('legs', legs);
  person.setData('shadow', shadow);
  person.setData('layers', layers);
  person.setData('upper', layers.map(([img]) => img));
  person.setData('facing', 'down');
  person.setData('baseScale', baseScale);
  // Сдвиг фазы: люди дышат и шагают не в унисон.
  person.setData('phase', Math.random() * 1000);
  if (look.stroller !== undefined) {
    const stroller = scene.art(0, 9, 'stroller').setTint(look.stroller);
    person.add(stroller);
    person.setData('stroller', stroller);
  }
  if (look.dog !== undefined) {
    const dog = scene.art(x - 9, y + 6, 'dog_sit0').setTint(look.dog);
    person.setData('dog', dog);
    person.once('destroy', () => dog.destroy());
  }
  scene.people.add(person);
  person.once('destroy', () => scene.people.delete(person));
  return person;
}

export function newStride(x: number, y: number, speed = 1, stride = 1): Stride {
  return { phase: 0, lastX: x, lastY: y, speed, stride, foot: Math.random() < 0.5 ? 0 : 2, endAt: -Infinity, vel: 0, ratio: 1, frame: 0, seg: 0, t: 0, lane: 0, laneGoal: 0, laneAt: 0, dirX: 0, dirY: 0 };
}

/** Шаг человека (makePerson заводит его сразу; у собранных иначе — заводится тут). */
export function strideOf(person: Phaser.GameObjects.Container): Stride {
  let st = person.getData('stride') as Stride | undefined;
  if (!st) {
    st = newStride(person.x, person.y);
    person.setData('stride', st);
  }
  return st;
}

/** Вторая половинка пары идёт следом за первой — тем же путём, чуть позади. */
export function addCompanion(scene: StoreScene, leader: Phaser.GameObjects.Container, look?: Look): void {
  const companion = makePerson(scene, leader.x - 8, leader.y + 1, look ?? customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  weatherFx.addUmbrella(scene, companion);
  companion.setData('leader', leader);
  leader.setData('trail', [] as { x: number; y: number }[]);
  leader.once('destroy', () => companion.destroy());
  // Парочка иногда обменивается сердечками.
  const hearts = scene.time.addEvent({
    delay: 5000,
    loop: true,
    callback: () => companion.active && Math.random() < 0.35 && effects.emote(scene, companion, 'emo_heart'),
  });
  companion.once('destroy', () => hearts.remove());
}

/** Спутник идёт по следу ведущего: берёт точку следа не ближе 9 к нему. */
export function followLeader(person: Phaser.GameObjects.Container, leader: Phaser.GameObjects.Container): void {
  const trail = (leader.getData('trail') as { x: number; y: number }[] | undefined) ?? [];
  let target: { x: number; y: number } | undefined;
  for (let i = trail.length - 1; i >= 0; i--) {
    if (Phaser.Math.Distance.Between(trail[i].x, trail[i].y, leader.x, leader.y) >= 9) {
      target = trail[i];
      break;
    }
  }
  const dx = (target?.x ?? person.x) - person.x;
  const dy = (target?.y ?? person.y) - person.y;
  const moving = Math.hypot(dx, dy) > 0.4;
  if (moving) {
    person.x += dx * 0.2;
    person.y += dy * 0.2;
    person.setDepth(person.y);
    setFacing(person, facingAlong(dx, dy, person.getData('facing') as Facing | undefined));
  }
  person.setData('walking', moving);
  person.setData('pace', leader.getData('pace'));
}

/** Собака идёт рядом с хозяином; пока он в магазине — сидит привязанная у входа и виляет хвостом. */
export function updateDog(scene: StoreScene, person: Phaser.GameObjects.Container, dog: Phaser.GameObjects.Image): void {
  const { h, door } = scene.layout;
  const outside = person.y > h + FACADE_H;
  const side = person.getData('facing') === 'left' ? 1 : -1;
  const tx = outside ? person.x + side * 9 : door.x + 17;
  const ty = outside ? person.y + 5 : h + FACADE_H + 7;
  const dx = tx - dog.x;
  const dy = ty - dog.y;
  const d = Math.hypot(dx, dy);
  const now = scene.time.now;
  if (d > 0.8) {
    const step = Math.min(d, Math.max(0.9, d * 0.18));
    dog.x += (dx / d) * step;
    dog.y += (dy / d) * step;
    dog.setTexture(Math.floor(now / 110) % 2 ? 'dog0' : 'dog1').setFlipX(dx < 0);
  } else {
    dog.setTexture(Math.floor(now / (outside ? 700 : 220)) % 2 ? 'dog_sit0' : 'dog_sit1').setFlipX(false);
  }
  dog.setDepth(dog.y + 3);
}

/** Тележки стоят у входа: в большом магазине всегда, в «Магазинчике» — если куплены. */
export function cartsAtDoor(scene: StoreScene): boolean {
  return scene.state.level >= 2 || (scene.state.level >= 1 && hasUpgrade(scene.state, 'cart'));
}

/** Покупатель берёт тележку у входа и катит её перед собой (как коляску). */
export function giveTrolley(scene: StoreScene, person: Phaser.GameObjects.Container): void {
  const trolley = scene.art(0, 9, 'trolley');
  person.add(trolley);
  person.setData('stroller', trolley);
  person.setData('push', 'trolley');
}

/** У выхода тележку оставляют. */
export function dropTrolley(person: Phaser.GameObjects.Container): void {
  if (person.getData('push') !== 'trolley') return;
  (person.getData('stroller') as Phaser.GameObjects.Image | undefined)?.destroy();
  person.setData('stroller', undefined);
  person.setData('push', undefined);
}

/** Коляска (или тележка) всегда впереди: снизу, сверху (за человеком) или сбоку. */
export function placeStroller(person: Phaser.GameObjects.Container, facing: Facing): void {
  const stroller = person.getData('stroller') as Phaser.GameObjects.Image | undefined;
  if (!stroller) return;
  const tex = (person.getData('push') as string | undefined) ?? 'stroller';
  if (facing === 'down') {
    stroller.setTexture(tex).setPosition(0, 9).setFlipX(false);
    person.bringToTop(stroller);
  } else if (facing === 'up') {
    stroller.setTexture(tex).setPosition(0, -5).setFlipX(false);
    person.sendToBack(stroller);
  } else {
    stroller.setTexture(`${tex}_s`).setPosition(facing === 'right' ? 11 : -11, 3).setFlipX(facing === 'left');
    person.bringToTop(stroller);
  }
}

/** Поворот: спереди, со спины или боком (левый бок — зеркальный правый). Значок охранника виден только спереди. */
/**
 * Настроение на лице: радуется найденному товару, хмурится в долгой очереди.
 * С ms — через столько вернётся обычное лицо (если за это время его не сменили).
 */
export function setMood(scene: StoreScene, person: Phaser.GameObjects.Container, mood: 'happy' | 'frown' | null, ms?: number): void {
  const layers = person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined;
  const entry = layers?.find(([, base]) => base.startsWith('p_skin'));
  if (!entry || !person.active) return;
  const base = mood ? `p_skin_${mood}` : 'p_skin';
  const token = ((person.getData('moodToken') as number | undefined) ?? 0) + 1;
  person.setData('moodToken', token);
  person.setData('mood', mood);
  entry[1] = base;
  entry[0].setTexture(base + VIEW_SUFFIX[(person.getData('facing') as Facing | undefined) ?? 'down']);
  if (ms) scene.time.delayedCall(ms, () => person.getData('moodToken') === token && setMood(scene, person, null));
}

export function setFacing(person: Phaser.GameObjects.Container, facing: Facing): void {
  if (person.getData('facing') === facing) return;
  person.setData('facing', facing);
  const suffix = VIEW_SUFFIX[facing];
  const layers = person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined;
  for (const [img, base] of layers ?? []) {
    if (FRONT_ONLY.has(base)) {
      img.setVisible(facing === 'down');
      continue;
    }
    img.setTexture(base + suffix).setFlipX(facing === 'left');
  }
  const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
  legs?.setTexture(`p_legs0${suffix}`).setFlipX(facing === 'left');
  const back = person.getData('back') as Phaser.GameObjects.Image | undefined;
  if (back) {
    if (facing === 'up') person.bringToTop(back);
    // Сразу над тенью (а у светящегося человека тень — над свечением, personGlow).
    else person.moveTo(back, person.getData('glow') ? 2 : 1);
  }
  placeStroller(person, facing);
}

/** Сколько терпения осталось у ждущего покупателя (1 — только встал, 0 — уходит). */
export function patienceLeft(scene: StoreScene, c: Customer): number {
  return 1 - (scene.time.now - c.waitStart) / (c.patienceMs ?? PATIENCE_MS);
}

/**
 * Очередь не стоит столбом: один из ждущих переминается, оглядывается, а когда ждать
 * надоело — смотрит на часы и вздыхает. Дети подпрыгивают на месте.
 */
export function queueIdle(scene: StoreScene): void {
  const waiting = [...scene.queue, ...scene.registers.map((r) => r.customer).filter((c): c is Customer => Boolean(c))].filter(
    (c) => !c.serving && !c.gone && c.sprite.active && !c.sprite.getData('walking'),
  );
  if (!waiting.length) return;
  const c = Phaser.Utils.Array.GetRandom(waiting);
  const p = c.sprite;
  const left = patienceLeft(scene, c);
  const base = (p.getData('baseScale') as number) ?? 1;
  if (base < 1) {
    scene.tweens.add({ targets: p, y: p.y - 2, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    return;
  }
  if (left < 0.6 && Math.random() < 0.6) {
    effects.emote(scene, p, Math.random() < 0.55 ? 'emo_clock' : 'emo_sigh');
    return;
  }
  if (Math.random() < 0.5) {
    // Переминается с ноги на ногу.
    scene.tweens.add({ targets: p, x: p.x + 0.7, duration: 160, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    return;
  }
  // Оглядывается по сторонам и снова смотрит вперёд.
  const facing = (p.getData('facing') as Facing | undefined) ?? 'up';
  setFacing(p, 'left');
  scene.time.delayedCall(450, () => p.active && !p.getData('walking') && setFacing(p, 'right'));
  scene.time.delayedCall(900, () => p.active && !p.getData('walking') && setFacing(p, facing));
}

/** Продавец без покупателей: протирает прилавок, к вечеру зевает. */
export function sellerIdle(scene: StoreScene): void {
  const s = scene.seller;
  if (!s?.active || scene.sellerBusy || scene.ownerScanning() || s.getData('walking') || scene.waiting() > 0) return;
  const { counter } = scene.layout;
  if (Math.hypot(s.x - counter.x, s.y - counter.y) > 40) return;
  if (scene.evening > 0.4 && Math.random() < 0.45) {
    effects.emote(scene, s, 'emo_zzz');
    setMood(scene, s, 'frown', 1200);
    return;
  }
  // Тряпка ходит по прилавку, на чистом поблёскивает.
  const rag = scene.add.rectangle(counter.x - 5, counter.y - 6, 4, 2, 0x9cd8ff).setStrokeStyle(0.5, 0x3a4466).setDepth(counter.y + 25);
  scene.tweens.add({
    targets: rag,
    x: counter.x + 5,
    duration: 260,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      rag.destroy();
      const shine = scene.art(counter.x + 3, counter.y - 8, 'spark').setScale(0.6 / ART).setDepth(counter.y + 26);
      scene.tweens.add({ targets: shine, alpha: 0, scale: 1.2 / ART, angle: 90, duration: 500, onComplete: () => shine.destroy() });
    },
  });
  const base = (s.getData('baseScale') as number) ?? 1;
  scene.tweens.add({ targets: s, scaleY: base * 1.04, duration: 130, yoyo: true, repeat: 2, onComplete: () => s.setScale(base) });
}

/** Все в зале оборачиваются на кассу: что-то случилось (серия, рекорд). */
export function everyoneLooks(scene: StoreScene, x: number, y: number, key: EmoteKey, share = 0.35): void {
  for (const c of scene.customers) {
    const p = c.sprite;
    if (!p.active || c.gone || p.getData('walking') || p.y > scene.layout.h) continue;
    const dx = x - p.x;
    const dy = y - p.y;
    setFacing(p, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    if (Math.random() < share) scene.time.delayedCall(Phaser.Math.Between(0, 300), () => effects.emote(scene, p, key));
  }
}

/** Свободные кассы забирают первых из очереди; остальные стоят в линию за кассами. */
export function layoutQueue(scene: StoreScene): void {
  scene.registers.forEach((r, i) => {
    if (r.customer || !scene.operator(i) || !scene.queue.length) return;
    const c = scene.queue.shift()!;
    r.customer = c;
    void walk(scene, c.sprite, r.spot.x, r.spot.y);
  });
  scene.queue.forEach((c, i) => {
    const spot = queueSpot(scene, c, i);
    void walk(scene, c.sprite, spot.x, spot.y);
  });
}

export function updateBubble(scene: StoreScene, c: Customer): void {
  if (!c.bubble.visible) return;
  const left = 1 - (scene.time.now - c.waitStart) / (c.patienceMs ?? PATIENCE_MS);
  c.bubble.setTint(left > 0.6 ? 0x8fd16a : left > 0.3 ? 0xf2c14e : 0xd95763);
  // Терпение кончается — человек в очереди хмурится.
  if (left <= 0.3 && c.sprite.getData('mood') !== 'frown') setMood(scene, c.sprite, 'frown');
}

// ---------- Утилиты ----------

/**
 * Место в линии: сразу за кассами (выше их мест), длинная очередь сжимается до стены (в тесном
 * ларьке стоит плотнее, чтобы не упираться в полки). Сжалась теснее роста человека — встают
 * «ёлочкой», через одного чуть левее: видно каждого, а не стопку голов друг в друге.
 */
export function queueSpot(scene: StoreScene, c: Customer, index: number): Point {
  const { x, y, step, minY } = scene.layout.queue;
  const top = (scene.registers.length ? Math.min(...scene.registers.map((r) => r.spot.y)) : y + step) - step;
  const fit = scene.queue.length > 1 ? (top - minY) / (scene.queue.length - 1) : step;
  const gap = Math.min(step, fit);
  return { x: x - (gap < QUEUE_SNUG ? (c.queueSide ?? 0) * QUEUE_STAGGER : 0), y: top - index * gap };
}

/**
 * Идёт к точке; в зале — в обход мебели, по нескольким отрезкам. Новый walk отменяет прежний.
 * Мир перестроили, пока шёл, — дело дальше не идёт: обещание так и не исполнится (как и у wait).
 * Без скорости — своим шагом (покупатели): старик с тростью медленнее, спортсмен бодрее, с коляской ровнее.
 */
export function walk(scene: StoreScene, target: Phaser.GameObjects.Container, x: number, y: number, speed?: number): Promise<void> {
  return walkVia(scene, target, [{ x, y }], speed);
}

/**
 * Идёт через несколько точек одним ходом: у дверей и полок не встаёт на каждом повороте, а заворачивает
 * дугой (stride.ts). С места разгоняется, к концу притормаживает, но в пути ровно столько, сколько шёл бы
 * ровным шагом по ломаной, — ход игры от походки не зависит. Встречного и стоящего на пути обходит
 * чуть сбоку (на слабом телефоне — нет). Шаг — твин-счётчик: ×2 и пауза действуют на него, как на всё,
 * а killTweensOf(человек) его не гасит — для этого haltWalk.
 */
export function walkVia(scene: StoreScene, target: Phaser.GameObjects.Container, points: Point[], speed?: number, opts: { depth?: (y: number) => number; direct?: boolean } = {}): Promise<void> {
  const world = scene.worldGen;
  const st = strideOf(target);
  const pace = speed ?? ownPace(scene, target);
  const from = { x: target.x, y: target.y };
  const legs: Point[] = [];
  let at = from;
  for (const p of points) {
    // В зале — в обход мебели; на улице и через дверь — напрямик.
    const indoor = !opts.direct && at.y < scene.layout.h - 2 && p.y < scene.layout.h - 2;
    legs.push(...(indoor ? findPath(at, p, scene.obstacles) : [p]));
    at = p;
  }
  const route = makeRoute([from, ...roundCorners(from, legs, scene.obstacles)]);
  const duration = (polylineLength(from, legs) / pace) * 1000;
  // Останавливаем только прошлый шаг: прыжок от радости и прочие анимации доигрывают.
  (target.getData('move') as Phaser.Tweens.Tween | undefined)?.stop();
  // Уже шёл (новый путь посреди прежнего или сразу следом) — продолжает с той же скоростью, без разгона.
  const going = Boolean(target.getData('walking')) || scene.time.now - st.endAt < STEP_GRACE;
  Object.assign(st, { route, pace: planPace(route.length, duration, going ? st.vel : 0), seg: 0, t: 0, lane: 0, laneGoal: 0, laneAt: 0, turn: undefined, depthOf: opts.depth });
  // Уже на месте (очередь пересчитали, а он и так стоит где надо) — не «трогается» на кадр.
  if (route.length >= 0.3) target.setData('walking', true);
  // Темп шага (animatePeople): чем быстрее идёт, тем шире и чаще шаг.
  target.setData('pace', pace);
  const end = route.pts[route.pts.length - 1];
  return new Promise<void>((resolve) => {
    const stop = () => {
      target.setData('walking', false);
      st.endAt = scene.time.now;
      resolve();
    };
    const move = scene.tweens.addCounter({
      from: 0,
      to: duration,
      duration,
      onUpdate: (tween) => stepAlong(scene, target, st, tween.getValue() ?? 0),
      onComplete: () => {
        if (target.active) {
          target.setPosition(end.x, end.y).setDepth(st.depthOf ? st.depthOf(end.y) : end.y);
          // Не успел довернуться кругом — встаёт той стороной, куда шёл.
          if (st.turn) setFacing(target, st.turn.to);
        }
        st.turn = undefined;
        stop();
      },
      onStop: stop,
    });
    target.setData('move', move);
  }).then(() => (world === scene.worldGen ? undefined : new Promise<void>(() => undefined)));
}

/** Своим ходом: скорость base с поправкой на походку человека (старик медленнее, спортсмен бодрее). */
export function ownPace(scene: StoreScene, person: Phaser.GameObjects.Container, base = scene.customerSpeed()): number {
  return base * strideOf(person).speed;
}

/** Остановить шаг на месте, не исполняя обещание walk (как прежде killTweensOf гасил твин шага). */
export function haltWalk(person: Phaser.GameObjects.Container): void {
  (person.getData('move') as Phaser.Tweens.Tween | undefined)?.destroy();
  person.setData('walking', false);
}

/** Шаг по пути: где человек через t мс (времени игры), куда смотрит, насколько отошёл вбок от встречного. */
export function stepAlong(scene: StoreScene, target: Phaser.GameObjects.Container, st: Stride, t: number): void {
  const { route, pace } = st;
  if (!target.active || !route || !pace) return;
  const dt = Math.max(0, t - st.t);
  st.t = t;
  const { s, v } = paceAt(pace, t);
  const p = sampleRoute(route, s, st.seg);
  st.seg = p.seg;
  if (p.dx || p.dy) {
    st.dirX = p.dx;
    st.dirY = p.dy;
  }
  st.vel = v;
  st.ratio = pace.vc > 0 ? v / pace.vc : 1;
  // Разойтись со встречным: раз в LANE_EVERY смотрит вперёд, а вбок отходит плавно.
  if (!scene.lite) {
    if (t >= st.laneAt) {
      st.laneAt = t + LANE_EVERY;
      st.laneGoal = laneGoal(scene, target, st, p.x, p.y, route.length - s);
    }
    const step = (LANE_SPEED * dt) / 1000;
    st.lane += Phaser.Math.Clamp(st.laneGoal - st.lane, -step, step);
  }
  // У начала и конца пути сдвиг сходит на нет: приходит ровно туда, куда шёл.
  const off = st.lane * Phaser.Math.Clamp(Math.min(s, route.length - s) / 10, 0, 1);
  target.x = p.x - st.dirY * off;
  target.y = p.y + st.dirX * off;
  // Глубину трогаем, только если она правда сменилась: каждая смена — пересортировка всей сцены.
  const depth = st.depthOf ? st.depthOf(target.y) : target.y;
  if (target.depth !== depth) target.setDepth(depth);
  if (route.length > 0.5) faceAlong(target, st, t);
}

/** Смотрит туда, куда идёт; кругом поворачивается не мгновенно — на миг встаёт вполоборота. */
export function faceAlong(target: Phaser.GameObjects.Container, st: Stride, t: number): void {
  if (st.turn) {
    if (t < st.turn.at) return;
    setFacing(target, st.turn.to);
    st.turn = undefined;
  }
  if (!st.dirX && !st.dirY) return;
  const current = target.getData('facing') as Facing | undefined;
  const want = facingAlong(st.dirX, st.dirY, current);
  if (want === current) return;
  const via = current && turnVia(current, want, st.dirX);
  if (via) {
    setFacing(target, via);
    st.turn = { to: want, at: t + TURN_MS };
  } else setFacing(target, want);
}

/** Люди на сцене в этом кадре: где стоят и куда идут (для обхода встречных; считаем раз за кадр). */
export function passers(scene: StoreScene): Passer[] {
  const frame = scene.game.loop.frame;
  if (scene.crowd.frame === frame) return scene.crowd.list;
  const list: Passer[] = [];
  for (const p of scene.people) {
    // Только те, кто стоит прямо на сцене и виден: сидящий в чужом контейнере (лодка) — не помеха.
    if (!p.active || !p.visible || p.displayList !== scene.children) continue;
    const st = p.getData('stride') as Stride | undefined;
    list.push({ x: p.x, y: p.y, dx: st?.dirX ?? 0, dy: st?.dirY ?? 0, moving: Boolean(p.getData('walking')), shift: st ? st.laneGoal - st.lane : 0 });
  }
  scene.crowd = { frame, list };
  return list;
}

/**
 * Насколько отойти вбок, чтобы не пройти сквозь людей впереди (stride.ts: sidestep). Сдвиг не
 * заводит в мебель: там, где окажется сейчас и через полшага, должно быть свободно; негде разойтись —
 * протиснутся по своему пути, как раньше.
 */
export function laneGoal(scene: StoreScene, target: Phaser.GameObjects.Container, st: Stride, x: number, y: number, left: number): number {
  const free = (lane: number) =>
    [0, 8].every((ahead) => {
      const qx = x + st.dirX * ahead - st.dirY * lane;
      const qy = y + st.dirY * ahead + st.dirX * lane;
      return scene.obstacles.every((r) => qx <= r.x + 1 || qx >= r.x + r.w - 1 || qy <= r.y + 1 || qy >= r.y + r.h - 1);
    });
  return sidestep({ x: target.x, y: target.y }, st.dirX, st.dirY, st.lane, passers(scene), left, free);
}
