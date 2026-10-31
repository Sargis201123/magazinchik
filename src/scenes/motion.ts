// Живость людей и вещей в зале: шаг и покачивание, дыхание стоящих, мысли над головой, рука к полке,
// подпрыгивающие полки и товары, круги от касания, мигание подсветок, дверь магазина. Здесь — только
// как это выглядит; решения (кто куда идёт, что купил) — в людях и покупателях (people.ts, customers.ts).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { unitSalePrice, type ProductId } from '../game/economy';
import { sound } from '../platform/sound';
import { frameStride, type Facing } from './stride';
import { ambience } from '../platform/ambience';
import { UI_FONT } from '../ui/dom';
import { Halo } from './halo';
import { NIGHT_MARKUP } from '../game/night';
import {
  ART,
  FACADE_H,
  SWING_LAYERS,
  LIGHT_DEPTH,
  QUAKE_WAVE_MS,
  QUAKE_SHAKE_MS,
  QUAKE_SHAKE_PX,
  CUSTOMER_SPEED,
  RUN_PACE,
  MAX_DUST,
  VIEW_SUFFIX,
  type Gait,
  STEP_GRACE,
  type Customer,
  type ShelfView,
  type TakenSpot,
} from './common';
import * as persons from './persons';
import * as building from './building';

/**
 * Шаги в 4 кадра (ноги: шаг, вместе, другой шаг, вместе; тело чуть подпрыгивает)
 * и дыхание, когда человек стоит. Спереди и сзади другой шаг — зеркало первого.
 * Кадр шага меняется по пройденному пути, а не по часам: ноги не скользят ни на разгоне и торможении,
 * ни при ускорении ×2, ни у сотрудника, который ходит быстрее. Кто спешит (продавец, бегуны), тот бежит —
 * отрывается от земли, наклоняется вперёд, из-под ног летит пыль. У стариков, детей и спортсменов
 * своя походка, с коляской и тележкой идут ровнее, а спереди и со спины переносят вес с ноги на ногу.
 */
export function animatePeople(scene: StoreScene): void {
  const now = scene.time.now;
  for (const person of scene.people) {
    if (!person.active) continue;
    const leader = person.getData('leader') as Phaser.GameObjects.Container | undefined;
    if (leader?.active) persons.followLeader(person, leader);
    const trail = person.getData('trail') as { x: number; y: number }[] | undefined;
    const last = trail?.at(-1);
    if (trail && (!last || Phaser.Math.Distance.Between(last.x, last.y, person.x, person.y) > 0.5)) {
      trail.push({ x: person.x, y: person.y });
      if (trail.length > 40) trail.shift();
    }
    const dog = person.getData('dog') as Phaser.GameObjects.Image | undefined;
    if (dog?.active) persons.updateDog(scene, person, dog);
    const st = persons.strideOf(person);
    // Сколько прошёл с прошлого кадра: на столько и переставил ноги.
    const moved = Math.hypot(person.x - st.lastX, person.y - st.lastY);
    st.lastX = person.x;
    st.lastY = person.y;
    const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
    const facing = (person.getData('facing') as Facing | undefined) ?? 'down';
    const suffix = VIEW_SUFFIX[facing];
    const phase = (person.getData('phase') as number) ?? 0;
    let key = `p_legs0${suffix}`;
    let flip = facing === 'left';
    let bob = 0;
    // Руки на шаге: кадры взмаха у рубашки и кожи (art/walk.py), в такт ногам.
    let arms = '';
    // Подскок всего человека над тенью (бег, вприпрыжку) и наклон корпуса на бегу.
    let lift = 0;
    let lean = 0;
    // Перенос веса с ноги на ногу (спереди и со спины): всё тело — на точку рисунка в сторону.
    let weight = 0;
    const gait = person.getData('gait') as Gait | undefined;
    // Только что дошёл, а следующий путь начнётся сразу (из двери — к полке): не останавливается.
    const walking = Boolean(person.getData('walking')) || now - st.endAt < STEP_GRACE;
    // Остановился — чуть приседает, тронулся — вытягивается: шаг с весом, а не скольжение.
    if (walking !== Boolean(person.getData('wasWalking'))) {
      person.setData('wasWalking', walking);
      squash(scene, person, walking ? 0.96 : 1.05, walking ? 1.05 : 0.93, 70);
      // Трогается — первый шаг почти сразу, то с левой ноги, то с правой.
      if (walking) {
        st.foot = 2 - st.foot;
        st.phase = st.foot + 0.55;
      }
    }
    if (walking) {
      const pace = (person.getData('pace') as number | undefined) ?? CUSTOMER_SPEED;
      // На велосипеде, с тележкой или коляской — без подскоков: колёса не скачут.
      const wheels = Boolean(person.getData('wheels') || person.getData('stroller'));
      const running = pace >= RUN_PACE && !wheels;
      // Чем быстрее идёт, тем шире и чаще шаг; ребёнок (он меньше) и старик с тростью шагают мельче.
      const scale = (person.getData('baseScale') as number | undefined) ?? 1;
      st.phase = (st.phase + moved / frameStride(pace, CUSTOMER_SPEED, scale, st.stride)) % 4;
      const frame = Math.floor(st.phase);
      arms = frame === 1 ? '_w1' : frame === 3 ? '_w2' : '';
      if (frame === 1) key = `p_legs1${suffix}`;
      if (frame === 3) {
        if (suffix === '_s') key = 'p_legs2_s';
        else {
          key = `p_legs1${suffix}`;
          flip = !flip;
        }
      }
      bob = frame % 2 === 0 ? -0.5 : 0;
      const side = facing === 'left' || facing === 'right';
      if (running) {
        // Бег: на широком шаге отрывается от земли, сбоку видно, как наклоняется вперёд (сильнее,
        // когда разогнался); приземлился — из-под ноги облачко пыли (каждый второй шаг).
        lift = frame % 2 === 1 ? -1 : 0;
        bob = 0;
        if (side) lean = (facing === 'right' ? 4 : -4) * Math.min(1, st.ratio);
        if (frame === 0 && st.frame !== frame) kickUp(scene, person, facing);
      } else if (wheels || gait === 'elder') {
        // Катит коляску, тележку или крутит педали — ровно: тело чуть приподнимается раз на два шага.
        // Пожилой идёт так же ровно, не пружиня.
        bob = frame === 0 ? -0.5 : 0;
      } else if (gait === 'kid') {
        // Ребёнок вприпрыжку: через шаг подскакивает.
        lift = frame === 1 ? -1 : 0;
      } else if (gait === 'bouncy') {
        // В наушниках пружинит в такт музыке.
        lift = frame % 2 === 0 ? -0.5 : 0;
      } else if (gait === 'cane') {
        // С тростью приподнимается только на одной ноге — чуть прихрамывает — и идёт, ссутулившись вперёд.
        bob = frame === 0 ? -0.5 : 0;
        if (side) lean = facing === 'right' ? 3 : -3;
      }
      if (!running && !wheels && !side && !scene.lite) weight = frame === 1 ? 0.5 : frame === 3 ? -0.5 : 0;
      if (person.getData('idleAt') !== undefined) person.setData('idleAt', undefined);
      // Шаги слышно только у продавца — остальных было бы слишком много. Раз на пару шагов, а не
      // на каждый: иначе на бегу стучало, как пулемёт (ещё реже — ограничитель в ambience.step).
      if (person === scene.seller && frame === 0 && st.frame !== frame) ambience.step(person.x);
      st.frame = frame;
    } else {
      bob = Math.sin((now + phase) / 650) > 0.35 ? -0.5 : 0;
      // Ожидание: переминается с ноги на ногу, поправляет сумку (idle).
      if (now < ((person.getData('shiftUntil') as number | undefined) ?? 0)) key = `p_legs1${suffix}`;
      const hitch = ((person.getData('hitchUntil') as number | undefined) ?? 0) - now;
      if (hitch > 0) bob -= Math.floor(hitch / 120) % 2;
      idle(scene, person, now, facing);
    }
    if (legs && (legs.texture.key !== key || legs.flipX !== flip)) legs.setTexture(key).setFlipX(flip);
    // Наклон — у самого тела (ноги и верхние слои), а не у контейнера: облачко эмоции, мысль,
    // коробка в руках и тень остаются ровными, а падение на луже (angle контейнера) не спорит с бегом.
    const tilt = Phaser.Math.DegToRad(lean);
    if (legs) {
      legs.x = weight;
      legs.y = lift;
      legs.rotation = tilt;
    }
    for (const [img, base] of (person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined) ?? []) {
      if (!SWING_LAYERS.has(base)) continue;
      const want = base + suffix + arms;
      if (img.texture.key !== want) img.setTexture(want);
    }
    // Старик с тростью сутулится: плечи и голова ниже и (сбоку) чуть впереди.
    const side = facing === 'right' ? 1 : facing === 'left' ? -1 : 0;
    const stoop = gait === 'cane' ? 0.5 : 0;
    for (const img of (person.getData('upper') as Phaser.GameObjects.Image[]) ?? []) {
      const dy = (img.getData('dy') as number | undefined) ?? 0;
      img.y = bob + lift + stoop + dy;
      // Высокие слои (шапка, вещь, рюкзак) смещены вверх — наклоняются вокруг середины тела, как остальные.
      img.x = stoop * side - dy * Math.sin(tilt) + weight;
      img.rotation = tilt;
    }
    // Вещь в руке ходит вместе с рукой (вперёд-назад сбоку, вверх-вниз спереди),
    // сумка на плече отстаёт и качается навстречу.
    const sway = arms === '_w1' ? 0.5 : arms === '_w2' ? -0.5 : 0;
    if (sway) {
      const prop = person.getData('prop') as Phaser.GameObjects.Image | undefined;
      const satchel = person.getData('satchel') as Phaser.GameObjects.Image | undefined;
      if (prop) {
        if (side) prop.x += sway * side;
        else prop.y -= sway;
      }
      if (satchel && side) satchel.x -= sway * side;
    }
    const umbrella = person.getData('umbrella') as Phaser.GameObjects.Image | undefined;
    // Зонт раскрывается на выходе из магазина и закрывается, когда дождь кончился.
    const open = person.y > scene.layout.h + 2 && !scene.rainStopped;
    if (umbrella && umbrella.visible !== open) {
      umbrella.setVisible(open);
      if (open) {
        umbrella.setScale(umbrella.scaleX, 0.1 / ART);
        scene.tweens.add({ targets: umbrella, scaleY: 1 / ART, duration: 220, ease: 'Back.easeOut' });
      }
    }
    lampShadow(scene, person, lift);
    reflect(scene, person);
    breathe(scene, person, now, facing);
  }
}

/**
 * Из-под ноги бегущего: облачко пыли (клубки с каёмкой — мягкий пар, как у steamPuff,
 * на светлом полу не видно), на мокром полу и на улице в дождь — голубые брызги, в снег — снежная пыль.
 */
export function kickUp(scene: StoreScene, person: Phaser.GameObjects.Container, facing: Facing): void {
  if (scene.lite || scene.footDust.size >= MAX_DUST || !person.visible) return;
  if (!scene.cameras.main.worldView.contains(person.x, person.y)) return;
  // Только из-под тех, кто стоит прямо на сцене: уничтоженный с прежним залом или сидящий
  // в чужом контейнере не пылит (проверка по ссылке на список — без поиска по тысячам объектов).
  if (person.displayList !== scene.children) return;
  const s = person.scaleY;
  // Пыль летит назад, из-под отталкивающейся ноги; спереди и сзади — из-под левой или правой.
  const back = facing === 'right' ? -1 : facing === 'left' ? 1 : 0;
  const x = person.x + (back ? back * 2 : Phaser.Math.RND.sign() * 1.5) * s;
  const y = person.y + 8 * s;
  const { w, h, wallH } = scene.layout;
  const { x: px, y: py } = person;
  const room = building.openRooms(scene).some((r) => px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h);
  const indoor = room || (py > wallH && py < h && px > 0 && px < w);
  // Мокро: только что вымытый пол или пролитая лужа, а на улице — дождь.
  const near = (o: { x: number; y: number }, r: number) => Math.abs(o.x - x) < r && Math.abs(o.y - y) < 5;
  const wet = indoor
    ? [...scene.wetSheens].some((sh) => near(sh, 10)) || [...scene.trash].some((piece) => piece.getData('kind') === 'spill' && near(piece, 8))
    : Boolean(scene.rainFx);
  // Убегая от нас, пинает пыль к нам — облачко перед ним; иначе — за ним.
  const depth = person.depth + (facing === 'up' ? 0.5 : -0.5);
  if (wet) {
    // Брызги: четыре капли дугой разлетаются из-под ноги.
    const drops = [0x41a6f6, 0x5fb4e8, 0x41a6f6, 0xc8f0ff].map((color) => scene.add.rectangle(x, y, 1, 1, color).setDepth(depth));
    scene.footDust.add(drops[0]);
    drops[0].once('destroy', () => scene.footDust.delete(drops[0]));
    const fly = drops.map((_, i) => ({
      dx: back ? back * Phaser.Math.FloatBetween(2.5, 5.5) : (i - 1.5) * Phaser.Math.FloatBetween(1.5, 2.5),
      up: Phaser.Math.FloatBetween(2.5, 4.5),
    }));
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 340,
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        drops.forEach((d, i) => d.setPosition(x + fly[i].dx * k, y - Math.sin(k * Math.PI) * fly[i].up).setAlpha(1 - k * k));
      },
      onComplete: () => drops.forEach((d) => d.destroy()),
    });
    return;
  }
  // Светлый клубок с тёмной каёмкой виден и на светлом полу, и на асфальте; в снег — белый.
  const [fill, edge] = !indoor && scene.weather === 'snow' ? [0xffffff, 0xc0cbdc] : [0xf4ece0, 0xb8a888];
  const away = back || Phaser.Math.FloatBetween(-1, 1);
  // Облачко из двух клубков: побольше у ноги, поменьше чуть позади; растут, отлетают и тают.
  // Крошечный круг — восьмиугольником: по умолчанию Phaser режет его на ~100 сегментов.
  const puff = (px: number, py: number, r: number) => scene.add.circle(px, py, r, fill).setIterations(0.125).setStrokeStyle(0.5, edge);
  const puffs = [puff(x, y - 0.5, 1.5), puff(x + away * 1.8, y - 1.3, 1)];
  for (const puff of puffs) puff.setDepth(depth);
  scene.footDust.add(puffs[0]);
  puffs[0].once('destroy', () => scene.footDust.delete(puffs[0]));
  scene.tweens.add({
    targets: puffs,
    x: (target: { x: number }) => target.x + away * 2.5,
    y: (target: { y: number }) => target.y - 2.5,
    scale: 1.7,
    duration: 420,
    ease: 'Sine.easeOut',
  });
  // Тает к концу, а не сразу: облачко успевают заметить.
  scene.tweens.add({ targets: puffs, alpha: 0, duration: 420, ease: 'Quad.easeIn', onComplete: () => puffs.forEach((puff) => puff.destroy()) });
}

/** Стоит без дела: раз в несколько секунд — переступить, глянуть в телефон, потянуться, поправить сумку. */
export function idle(scene: StoreScene, person: Phaser.GameObjects.Container, now: number, facing: Facing): void {
  if (scene.lite || person === scene.seller) return;
  const at = person.getData('idleAt') as number | undefined;
  if (at === undefined) {
    person.setData('idleAt', now + Phaser.Math.Between(2500, 7000));
    return;
  }
  if (now < at) return;
  person.setData('idleAt', now + Phaser.Math.Between(5000, 11000));
  const kind = Phaser.Math.Between(0, 3);
  if (kind === 0) person.setData('shiftUntil', now + 450);
  else if (kind === 3) person.setData('hitchUntil', now + 480);
  else if (kind === 1 && facing !== 'up') {
    // Телефон в руке: тёмный корпус и голубой экран.
    const side = facing === 'left' ? -3 : 3;
    const phone = [scene.add.rectangle(side, 1.5, 2, 3, 0x262b44), scene.add.rectangle(side, 1, 1.2, 1.6, 0x9fd8f0)];
    person.add(phone);
    scene.time.delayedCall(Phaser.Math.Between(1800, 3000), () => phone.forEach((o) => o.destroy()));
  } else if (!scene.tweens.isTweening(person)) {
    // Потянуться (зевнуть): медленно вытянуться и опуститься.
    const base = (person.getData('baseScale') as number | undefined) ?? 1;
    scene.tweens.add({ targets: person, scaleY: base * 1.06, scaleX: base * 0.97, duration: 380, hold: 260, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => person.setScale(base) });
  }
}

/** Бледное отражение на мраморе: ноги и рубашка, перевёрнутые под ступнями. */
export function reflect(scene: StoreScene, person: Phaser.GameObjects.Container): void {
  if (!scene.glossyFloor || scene.lite) return;
  const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
  const shirt = (person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined)?.find(([, base]) => base === 'p_shirt')?.[0];
  if (!legs || !shirt) return;
  let mirror = person.getData('mirror') as Phaser.GameObjects.Container | undefined;
  if (!mirror?.active) {
    const made = scene.add
      .container(0, 0, [scene.art(0, 0, legs.texture.key).setTint(legs.tintTopLeft).setFlipY(true), scene.art(0, 0, shirt.texture.key).setTint(shirt.tintTopLeft).setFlipY(true)])
      .setAlpha(0.13)
      .setDepth(0.6);
    person.setData('mirror', made);
    person.once('destroy', () => made.destroy());
    mirror = made;
  }
  const { w, h, wallH } = scene.layout;
  const inside = person.visible && person.y > wallH && person.y < h - 4 && person.x > 0 && person.x < w;
  mirror.setVisible(inside);
  if (!inside) return;
  mirror.setPosition(person.x, person.y + 15 * person.scaleY).setScale(person.scaleX, person.scaleY);
  const [ml, ms] = mirror.list as Phaser.GameObjects.Image[];
  if (ml.texture.key !== legs.texture.key || ml.flipX !== legs.flipX) ml.setTexture(legs.texture.key).setFlipX(legs.flipX);
  if (ms.texture.key !== shirt.texture.key) ms.setTexture(shirt.texture.key);
  // Бегущий подпрыгнул — отражение уходит вниз.
  ml.y = ms.y = -legs.y;
}

/** Мороз: на улице изо рта облачко пара, раз в пару секунд. */
export function breathe(scene: StoreScene, person: Phaser.GameObjects.Container, now: number, facing: Facing): void {
  if (!scene.coldAir || scene.lite || !person.visible || facing === 'up') return;
  if (person.y < scene.layout.h + 4 && person.x > 0 && person.x < scene.layout.w) return;
  const next = (person.getData('breathAt') as number | undefined) ?? 0;
  if (now < next) return;
  person.setData('breathAt', now + Phaser.Math.Between(1800, 2800));
  if (next === 0) return;
  const dx = facing === 'left' ? -3 : facing === 'right' ? 3 : 1;
  const puff = scene.add.circle(person.x + dx * person.scaleX, person.y - 7 * person.scaleY, 1.2, 0xffffff, 0.55).setIterations(0.125).setDepth(person.depth + 1);
  scene.tweens.add({ targets: puff, x: puff.x + dx, y: puff.y - 4, scale: 2.4, alpha: 0, duration: 750, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
}

/** Вечером на улице тень вытягивается в сторону от ближайшего фонаря. В прыжке (lift) тень меньше. */
/**
 * День встал (итоги, вопрос о ночной смене): поза бега больше не обновляется (animatePeople не идёт),
 * поэтому снимаем наклон и подскок сразу — иначе продавец простоит наклонённым до утра.
 */
export function straightenPeople(scene: StoreScene): void {
  for (const person of scene.people) {
    if (!person.active) continue;
    const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
    if (legs) {
      legs.x = 0;
      legs.y = 0;
      legs.rotation = 0;
    }
    const stoop = person.getData('gait') === 'cane' ? 0.5 : 0;
    for (const img of (person.getData('upper') as Phaser.GameObjects.Image[] | undefined) ?? []) {
      img.y = stoop + ((img.getData('dy') as number | undefined) ?? 0);
      img.x = 0;
      img.rotation = 0;
    }
    lampShadow(scene, person);
  }
}

export function lampShadow(scene: StoreScene, person: Phaser.GameObjects.Container, lift = 0): void {
  const shadow = person.getData('shadow') as Phaser.GameObjects.Image | undefined;
  if (!shadow) return;
  // Днём тень поворачивается вслед за солнцем: утром — вправо, к вечеру — влево.
  let lean = scene.evening > 0 ? 0 : (0.45 - scene.dayProgress) * 4;
  if (scene.evening > 0 && person.y > scene.layout.h + FACADE_H && scene.lampXs.length) {
    const lamp = scene.lampXs.reduce((a, b) => (Math.abs(b - person.x) < Math.abs(a - person.x) ? b : a));
    lean = Phaser.Math.Clamp((person.x - lamp) / 5, -5, 5) * scene.evening;
  }
  shadow.x = lean;
  const air = lift < 0 ? 0.85 : 1;
  shadow.scaleX = ((1 + Math.abs(lean) / 5) * air) / ART;
  shadow.scaleY = air / ART;
}

/** Облачко-мысль с товаром над головой. */
export function think(scene: StoreScene, person: Phaser.GameObjects.Container, id: ProductId): Phaser.GameObjects.Container {
  const cloud = scene.art(0, 0, 'think');
  const icon = scene.art(1, -1.5, `item_${id}_0`).setScale(0.75 / ART);
  const thought = scene.add.container(4, -22, [cloud, icon]).setScale(0.2);
  person.add(thought);
  scene.tweens.add({ targets: thought, scale: 1, duration: 220, ease: 'Back.easeOut' });
  return thought;
}

/** Взял — облачко тает; не нашёл или дорого — товар перечёркнут, потом облачко тает. */
export function endThought(scene: StoreScene, thought: Phaser.GameObjects.Container, failed: boolean): void {
  if (!thought.active) return;
  if (failed) thought.add(scene.art(1, -1.5, 'cross'));
  scene.tweens.add({ targets: thought, alpha: 0, delay: failed ? 1100 : 150, duration: 250, onComplete: () => thought.destroy() });
}

/**
 * Покупатель тянется к полке; если взял — товар летит ему в руки. Летит та самая штука, что пропала
 * с полки (from — места из tryTake); без них (корзина уценки) — из случайной точки над полкой.
 */
export function reachShelf(scene: StoreScene, c: Customer, slot: { x: number; y: number }, id: ProductId | null, from: TakenSpot[] = []): void {
  const base = (c.sprite.getData('baseScale') as number) ?? 1;
  scene.tweens.add({ targets: c.sprite, scaleY: base * 1.07, duration: 140, yoyo: true, onComplete: () => c.sprite.setScale(base) });
  // Нашёл — улыбается, полка пустая — хмурится.
  persons.setMood(scene, c.sprite, id ? 'happy' : 'frown', id ? 1400 : 1200);
  if (!id) return;
  const spots = from.length ? from : [{ x: slot.x + Phaser.Math.Between(-12, 12), y: slot.y - 5, texture: `item_${id}_0`, scale: 1 / ART, tint: 0xffffff }];
  // Товар перелетает дугой в руки (в корзину), над полкой — цена, которую принесёт. «2 по цене 1» — две штуки одна за другой.
  spots.forEach((spot, n) => {
    const item = scene.art(spot.x, spot.y, spot.texture).setScale(spot.scale).setTint(spot.tint).setDepth(c.sprite.y + 1).setVisible(n === 0);
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: n * 110,
      duration: 360,
      ease: 'Sine.easeInOut',
      onStart: () => item.setVisible(true),
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        const to = { x: c.sprite.x, y: c.sprite.y - 3 };
        item.setPosition(spot.x + (to.x - spot.x) * k, spot.y + (to.y - spot.y) * k - Math.sin(k * Math.PI) * 9);
        item.setScale(spot.scale * (1 - 0.5 * k)).setAlpha(1 - 0.6 * k * k);
      },
      onComplete: () => item.destroy(),
    });
  });
  const unit = [...c.items].reverse().find((i) => i.id === id);
  if (unit && !unit.free) priceFlash(scene, spots[0].x, slot.y - 12, Math.ceil(unitSalePrice(scene.state, id, unit.unit) * (scene.night ? NIGHT_MARKUP : 1)));
}

/** «+45» над полкой: золотая цифра подпрыгивает и тает. Не всплывающая надпись — без подложки, мелко. */
export function priceFlash(scene: StoreScene, x: number, y: number, n: number): void {
  if (scene.lite || n <= 0) return;
  const label = scene.add
    .text(x, y, `+${n}`, { fontFamily: UI_FONT, fontSize: '8px', fontStyle: 'bold', color: '#fee761', stroke: '#3e2731', strokeThickness: 3 })
    .setOrigin(0.5)
    .setResolution(scene.textRes(5))
    .setDepth(1000)
    .setScale(0.3);
  scene.tweens.chain({
    targets: label,
    tweens: [
      { scale: 0.75, y: y - 5, duration: 160, ease: 'Back.easeOut' },
      { y: y - 13, alpha: 0, duration: 520, delay: 220, ease: 'Quad.easeIn' },
    ],
    onComplete: () => label.destroy(),
  });
}

/**
 * Упругое сжатие: предмет приседает (sy < 1) или вытягивается и возвращается. Низ остаётся на месте —
 * полка не «подпрыгивает над полом». Исходный масштаб запоминается, чтобы частые нажатия не копились.
 */
export function squash(scene: StoreScene, obj: Phaser.GameObjects.Image | Phaser.GameObjects.Container, sx: number, sy: number, ms = 90): void {
  if (scene.lite || !obj.active || obj.getData('growing')) return;
  // Человек (контейнер) стоит на ногах и может уже идти: только масштаб, от его обычного роста.
  if (obj instanceof Phaser.GameObjects.Container) {
    const s = (obj.getData('baseScale') as number | undefined) ?? 1;
    scene.tweens.add({ targets: obj, scaleX: s * sx, scaleY: s * sy, duration: ms, yoyo: true, ease: 'Quad.easeOut', onComplete: () => obj.setScale(s) });
    return;
  }
  const base = {
    x: (obj.getData('sqX') as number | undefined) ?? obj.scaleX,
    y: (obj.getData('sqY') as number | undefined) ?? obj.scaleY,
    py: (obj.getData('sqPy') as number | undefined) ?? obj.y,
  };
  obj.setData({ sqX: base.x, sqY: base.y, sqPy: base.py });
  // Центр картинки посередине: сдвигаем вниз на потерянную высоту, чтобы низ стоял на месте.
  const below = (1 - obj.originY) * obj.displayHeight;
  scene.tweens.add({
    targets: obj,
    scaleX: base.x * sx,
    scaleY: base.y * sy,
    y: base.py + below * (1 - sy),
    duration: ms,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      obj.setScale(base.x, base.y);
      obj.y = base.py;
      obj.setData({ sqX: undefined, sqY: undefined, sqPy: undefined });
    },
  });
}

/**
 * Полка подпрыгивает целиком — с товаром и кромкой: после выкладки и от касания. Штуки, которые
 * сейчас съезжают на новое место (slideItem), не подпрыгивают: высоту у них ведёт съезд.
 */
export function hopShelf(scene: StoreScene, view: ShelfView, height = 2): void {
  if (scene.lite) return;
  // Штуки, которые ещё летят из коробки (stockShelf) или съезжают на место, не трогаем: их ведёт свой твин.
  const still = (i: Phaser.GameObjects.Image) => i.visible && !i.getData('flying') && !(i.getData('slide') as Phaser.Tweens.Tween | undefined)?.isActive();
  // Вечерние полоски света над товаром прыгают вместе с полкой, а не остаются висеть.
  const strips = view.lights.filter((o): o is Phaser.GameObjects.Image => scene.shelfStrips.includes(o as Phaser.GameObjects.Image));
  const parts = [view.bg, view.front, ...strips, ...view.items.filter(still), ...view.backItems.filter(still)];
  if (parts.some((p) => p.getData('hopping'))) return;
  for (const p of parts) p.setData('hopping', true);
  scene.tweens.add({
    targets: parts,
    y: `-=${height}`,
    duration: 80,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => parts.forEach((p) => p.setData('hopping', false)),
  });
}

/**
 * Дрожь по залу от толчка: волна бежит по полкам слева направо — каждая полка вместе с товаром
 * мелко ходит из стороны в сторону и затихает. Когда волна доходит до полки, зовётся onShelf.
 * Возвращает, через сколько мс волна пройдёт весь зал.
 */
export function quakeWave(scene: StoreScene, onShelf: (view: ShelfView, index: number) => void): number {
  type Part = Phaser.GameObjects.GameObject & { x: number; visible: boolean; depth: number };
  let end = 0;
  scene.shelfViews.forEach((view, index) => {
    const delay = Math.max(0, view.at.x) * QUAKE_WAVE_MS;
    end = Math.max(end, delay + QUAKE_SHAKE_MS);
    let parts: { obj: Part; base: number; set: number }[] = [];
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay,
      duration: QUAKE_SHAKE_MS,
      onStart: () => {
        if (!view.bg.active) return;
        onShelf(view, index);
        // Толчок снизу: полка коротко подскакивает, дальше дрожит.
        hopShelf(scene, view, 1);
        // Полка, кромка, товар, значок отдела; плитка, тени и отсветы на полу стоят на месте.
        const all = [view.bg, view.front, view.cover, view.meter, ...view.items, ...view.backItems, ...view.pips, ...(view.lights as unknown as Part[])];
        parts = all.filter((o): o is Part => Boolean(o?.active && o.visible && o.depth > 1)).map((obj) => ({ obj, base: obj.x, set: NaN }));
      },
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        // Несколько качаний, к концу всё тише.
        const off = Math.sin(k * Math.PI * 8) * QUAKE_SHAKE_PX * (1 - k);
        for (const p of parts) {
          if (!p.obj.active) continue;
          // Предмет переставили (полку перерисовали, штука летит из коробки) — качаем от нового места.
          if (p.obj.x !== p.set) p.base = p.obj.x;
          p.obj.x = p.set = p.base + off;
        }
      },
      onComplete: () => {
        for (const p of parts) if (p.obj.active && p.obj.x === p.set) p.obj.x = p.base;
      },
    });
  });
  return end;
}

/**
 * Штука на полке съезжает со старого места на своё (refreshShelves уже поставил её туда): взяли
 * соседнюю — остальные плавно сдвигаются, а не перескакивают. Пока полка подпрыгивает (hopShelf),
 * высоту ведёт прыжок — он сам вернёт штуку на её высоту, поэтому едем только вбок.
 */
export function slideItem(scene: StoreScene, img: Phaser.GameObjects.Image, from: { x: number; y: number }): void {
  (img.getData('slide') as Phaser.Tweens.Tween | undefined)?.stop();
  const hopping = Boolean(img.getData('hopping'));
  const to = { x: img.x, y: img.y };
  img.setPosition(from.x, hopping ? to.y : from.y);
  const tween = scene.tweens.add({ targets: img, x: to.x, ...(hopping ? {} : { y: to.y }), duration: 140, ease: 'Quad.easeOut' });
  img.setData('slide', tween);
}

/**
 * Штуку сняли с полки — соседи по ряду качнулись к пустому месту и пружинят обратно: ближние
 * сильнее и раньше, дальние — слабее и чуть позже, как волна. На слабом телефоне не качаем.
 */
export function jostleShelf(scene: StoreScene, view: ShelfView, gone: { x: number; y: number }): void {
  if (scene.lite) return;
  // Шаг между штуками в ряду: на плотной полке качаются больше соседей, но так же далеко по счёту.
  const row = view.items.filter((img) => img.visible && Math.abs(img.y - gone.y) < 3).map((img) => img.x).sort((a, b) => a - b);
  const step = row.length > 1 ? Math.max(2, (row[row.length - 1] - row[0]) / (row.length - 1)) : 6;
  for (const img of [...view.items, ...view.backItems]) {
    if (!img.visible) continue;
    const dx = img.x - gone.x;
    if (Math.abs(img.y - gone.y) > 3 || Math.abs(dx) < 0.5) continue;
    // В соседях (1 шаг) — полные 9°, через два шага — почти ничего.
    const slots = Math.max(1, Math.abs(dx) / step);
    const k = 1 - (slots - 1) / 2.2;
    if (k <= 0) continue;
    (img.getData('jostle') as Phaser.Tweens.TweenChain | undefined)?.stop();
    // Быстро клонится к пустому месту и пружинит обратно, чуть перемахнув.
    img.setData(
      'jostle',
      scene.tweens.chain({
        targets: img,
        tweens: [
          { angle: (dx < 0 ? 9 : -9) * k, delay: (slots - 1) * 40, duration: 70, ease: 'Sine.easeOut' },
          { angle: 0, duration: 420, ease: 'Back.easeOut', easeParams: [2.5] },
        ],
      }),
    );
  }
}

/** Круг от пальца: показывает, куда пришлось касание, и что нажатие засчитано. */
export function ripple(scene: StoreScene, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 4).setStrokeStyle(1.5, 0xffffff, 0.95).setDepth(LIGHT_DEPTH + 50);
  scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
}

/** Отклик на касание предмета в мире: круг под пальцем и пружинка того, что нажали. */
export function tapFx(scene: StoreScene, p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject): void {
  if (scene.dragged || scene.arranging) return;
  ripple(scene, p.worldX, p.worldY);
  const view = scene.shelfViews.find((v) => v.bg === obj);
  if (view) return hopShelf(scene, view, 1.5);
  // Невидимые зоны касс: пружинит сам аппарат.
  if (obj instanceof Phaser.GameObjects.Zone) {
    const r = scene.registers.find((reg) => reg.img && Phaser.Math.Distance.Between(reg.counter.x, reg.counter.y, obj.x, obj.y) < 30);
    if (r?.img) squash(scene, r.img, 1.06, 0.9, 80);
    return;
  }
  // Живые (кот, люди) и то, что уже само двигается, не трогаем — у них свои движения.
  if (obj instanceof Phaser.GameObjects.Image && !scene.tweens.isTweening(obj)) squash(scene, obj, 1.08, 0.88, 80);
}

/**
 * То, что можно нажать, мягко пульсирует ореолом (scenes/halo.ts): пустые полки (есть товар на складе),
 * мусор, полное ведро, щиток без света. Ореол — нарисованная картинка за предметом, а не эффект
 * со своим проходом отрисовки: погасший не рисуется вовсе.
 */
export function pulseHighlights(scene: StoreScene): void {
  const pulse = 1.5 + Math.sin(scene.time.now / 260) * 1.2;
  for (const view of scene.shelfViews) view.glow?.set(view.needsStock ? pulse : 0);
  for (const piece of scene.trash) (piece.getData('glow') as Halo | undefined)?.set(pulse);
  scene.binGlow?.set(scene.binImg && building.binFull(scene) && !scene.binBusy ? pulse : 0);
  scene.fuseGlow?.set(scene.blackout ? pulse : 0);
  // Звонящий телефон светится, пока звонит (ореол растёт вместе с ним).
  scene.phoneGlow?.set(scene.call ? 2.4 + Math.sin(scene.time.now / 120) * 0.6 : 0);
}

/** Двери разъезжаются, когда к ним подходят. */
export function updateDoor(scene: StoreScene): void {
  const { door, h } = scene.layout;
  const close = (p: { x: number; y: number }) => Math.abs(p.x - door.x) < 16 && Math.abs(p.y - h - 4) < 18;
  const near = [...scene.customers].some((c) => close(c.sprite)) || [...scene.newcomers].some(close);
  // Колокольчик над дверью — записанный (sound.ts); пока лента не скачалась — синтезированный. Звенит,
  // только когда входит один человек: на выходе молчит, а когда входят несколько сразу (пара, толпа
  // в час пик) — тоже, иначе дверь звенела без умолку. Ещё реже — правило звука (не чаще раза в 4 с).
  const entering = [...scene.customers].filter((c) => !c.gone && close(c.sprite)).length + [...scene.newcomers].filter(close).length;
  if (entering === 1 && scene.doorOpen === 0 && !sound.doorbell(door.x)) ambience.chime(door.x);
  scene.doorOpen = Phaser.Math.Clamp(scene.doorOpen + (near ? 0.12 : -0.06), 0, 1);
  // Открытая дверь «впускает улицу»: пока кто-то входит, за стеклом слышно ярче и чуть громче.
  ambience.door(scene.doorOpen);
  const key = scene.doorOpen < 0.34 ? 'door' : scene.doorOpen < 0.67 ? 'door_half' : 'door_open';
  if (scene.doorImg.texture.key !== key) scene.doorImg.setTexture(key);
  // В снегопад в открытые двери залетают снежинки и тают у входа.
  if (scene.weather === 'snow' && scene.doorOpen > 0.6 && Math.random() < 0.3) {
    const flake = scene.art(door.x + Phaser.Math.Between(-8, 8), h + 6, 'snowflake').setScale(1.4 / ART).setDepth(h + 4);
    scene.tweens.add({
      targets: flake,
      x: flake.x + Phaser.Math.Between(-6, 6),
      y: h - Phaser.Math.Between(8, 22),
      alpha: 0,
      duration: Phaser.Math.Between(700, 1200),
      ease: 'Sine.easeOut',
      onComplete: () => flake.destroy(),
    });
  }
}
