// Ученик в зале (game/apprentice.ts, 13.11): подросток в своей форме — белая футболка, красные кепка и фартук,
// ростом чуть ниже взрослых — работает там, куда его поставили утром. На кассе пакует покупки (пакет на краю
// прилавка наполняется, пока идёт пробивка, и уезжает с покупателем), на складе сам носит коробки на полки,
// в зале подходит к покупателям и подсказывает. Выходной — его нет; ночную смену он не работает: уходит домой.
// Польза в цифрах — в game/apprentice.ts (касса быстрее, терпение и чаевые), здесь — то, что видно, и счёт дел.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { apprStockPace, type ApprPost } from '../game/apprentice';
import { inZar } from '../game/zarshop';
import { ART, PICKUP_MS, PLACE_MS, STAFF_SPEED, type Customer } from './common';
import * as persons from './persons';
import * as effects from './effects';
import * as motion from './motion';
import * as shelves from './shelves';
import { shelfToRestock, stockShelf } from './staff';
import { standFor } from './placement';

/** Форма ученика: как на портретах (art/apprentice.py). */
const SHIRT = 0xf4f4f4;
const CAP = 0xe43b44;
/** Кожа у мальчиков и девочек — как на их портретах appr0 / appr1. */
const SKIN = [0xf2d3ab, 0xeec39a];
/** Подросток — чуть ниже взрослых. */
const TEEN = 0.9;

/** Ученик сделал дело — к итогу дня (game/apprentice.ts apprNight копит их в карточку). */
const deed = (scene: StoreScene): void => {
  scene.stats.appr = (scene.stats.appr ?? 0) + 1;
};

/** Убрать ученика из зала (перед новой расстановкой или когда он ушёл домой). */
function clear(scene: StoreScene): void {
  if (scene.appr?.active) {
    persons.haltWalk(scene.appr);
    scene.tweens.killTweensOf(scene.appr);
    scene.appr.destroy();
  }
  if (scene.apprBag?.active) scene.apprBag.destroy();
  scene.appr = undefined;
  scene.apprBag = undefined;
}

/** Где он стоит без дела на своём месте. */
function homeOf(scene: StoreScene, post: Exclude<ApprPost, 'rest'>): { x: number; y: number } {
  const { warehouse, sellerHome, slots } = scene.layout;
  if (post === 'till') {
    const clerk = scene.registers[0]?.clerk ?? sellerHome;
    return { x: clerk.x - 2, y: clerk.y + 13 };
  }
  if (post === 'stock') return { x: warehouse.doorway.x - 8, y: warehouse.doorway.y - 14 };
  const slot = slots[Math.min(1, slots.length - 1)];
  return slot ? standFor(scene.layout, slot) : sellerHome;
}

/** Расставить ученика (вызывается вместе с персоналом, staff.ts syncStaff): на сегодняшнее место или никуда. */
export function syncAppr(scene: StoreScene, gen: number): void {
  clear(scene);
  const a = scene.state.appr;
  if (!a || a.post === 'rest' || inZar(scene.state) || scene.night) return;
  const post = a.post;
  const home = homeOf(scene, post);
  const me = persons.makePerson(scene, home.x, home.y, { shirt: SHIRT, skin: SKIN[a.name % 2], pants: 0x3a4466, style: 'cap', hair: CAP, acc: 'apron', accTint: CAP });
  me.setScale(TEEN).setData('baseScale', TEEN);
  const box = scene.art(0, 3, 'box').setVisible(false);
  me.add(box);
  scene.appr = me;
  const alive = () => scene.alive(gen) && scene.appr === me && me.active;
  const loop = post === 'till' ? tillLoop : post === 'stock' ? stockLoop : floorLoop;
  void loop(scene, me, box, alive);
}

/** Ночная смена — не для подростка: идёт к двери и домой. */
async function goHome(scene: StoreScene, me: Phaser.GameObjects.Container, alive: () => boolean): Promise<void> {
  const { door } = scene.layout;
  await persons.walkVia(scene, me, [{ x: door.x, y: door.y - 10 }, { x: door.x, y: scene.streetY + 30 }], STAFF_SPEED);
  if (alive()) clear(scene);
}

/** Касса: встаёт у прилавка хозяйской кассы и пакует каждому, кого там пробивают. */
async function tillLoop(scene: StoreScene, me: Phaser.GameObjects.Container, _box: Phaser.GameObjects.Image, alive: () => boolean): Promise<void> {
  let packed: Customer | null = null;
  while (alive()) {
    if (scene.night) return goHome(scene, me, alive);
    const r = scene.registers[0];
    const c = r?.customer;
    if (!r || !c || !r.scan || c === packed || !scene.running) {
      await scene.wait(200);
      continue;
    }
    packed = c;
    // Пакет встаёт на край прилавка и подрастает, пока идёт пробивка.
    const bag = (scene.apprBag ??= scene.art(0, 0, 'appr_bag'));
    const at = { x: me.x - 9, y: me.y - 9 };
    scene.tweens.killTweensOf(bag);
    bag.setPosition(at.x, at.y).setDepth(at.y + 30).setAlpha(1).setScale(0.6 / ART).setVisible(true);
    scene.tweens.add({ targets: bag, scale: 1 / ART, duration: 600, ease: 'Back.easeOut' });
    while (alive() && r.scan && r.customer === c) {
      motion.beat(scene, me, 0.5);
      await scene.wait(450);
    }
    if (!alive()) return;
    deed(scene);
    // Пробили — пакет уезжает к покупателю.
    const to = c.sprite.active ? { x: c.sprite.x, y: c.sprite.y - 6 } : at;
    scene.tweens.add({ targets: bag, x: to.x, y: to.y, alpha: 0, duration: 380, ease: 'Sine.easeIn', onComplete: () => bag.setVisible(false) });
  }
}

/** Склад: как грузчик, только медленнее (а к концу учёбы — шустрее) — сам носит коробки туда, где пустеет. */
async function stockLoop(scene: StoreScene, me: Phaser.GameObjects.Container, box: Phaser.GameObjects.Image, alive: () => boolean): Promise<void> {
  const home = { x: me.x, y: me.y };
  while (alive()) {
    if (scene.night) return goHome(scene, me, alive);
    const pace = apprStockPace(scene.state) || 1;
    const speed = STAFF_SPEED * pace;
    const index = scene.running ? shelfToRestock(scene) : -1;
    if (index < 0) {
      if (Phaser.Math.Distance.Between(me.x, me.y, home.x, home.y) > 2) await persons.walk(scene, me, home.x, home.y, speed);
      await scene.wait(500);
      continue;
    }
    const { doorway, pickup } = scene.layout.warehouse;
    const route = shelves.routeTo(scene, index);
    await persons.walkVia(scene, me, [doorway, pickup], speed);
    await scene.wait(PICKUP_MS / pace);
    if (!alive()) return;
    box.setVisible(true);
    await persons.walkVia(scene, me, [doorway, ...route], speed);
    await scene.wait(PLACE_MS / pace);
    if (!alive()) return;
    box.setVisible(false);
    stockShelf(scene, index, me);
    deed(scene);
    await persons.walkVia(scene, me, route.slice(0, -1).reverse(), speed);
  }
}

/** Зал: подходит к покупателю, который ищет товар, и подсказывает (звёздочка у него, сердечко у гостя). */
async function floorLoop(scene: StoreScene, me: Phaser.GameObjects.Container, _box: Phaser.GameObjects.Image, alive: () => boolean): Promise<void> {
  const helped = new WeakSet<Customer>();
  while (alive()) {
    if (scene.night) return goHome(scene, me, alive);
    const c = scene.running ? shopperNear(scene, me, helped) : undefined;
    if (!c) {
      // Никого — прохаживается вдоль полок.
      const slot = Phaser.Utils.Array.GetRandom(scene.layout.slots.slice(0, Math.max(1, scene.state.shelves.length)));
      if (slot) {
        const stand = standFor(scene.layout, slot);
        await persons.walk(scene, me, stand.x + Phaser.Math.Between(-10, 10), stand.y + 6, STAFF_SPEED * 0.8);
      }
      await scene.wait(1200);
      continue;
    }
    helped.add(c);
    await persons.walk(scene, me, c.sprite.x + 10, c.sprite.y + 2, STAFF_SPEED);
    if (!alive()) return;
    if (c.gone || !c.sprite.active) continue;
    persons.setFacing(me, 'left');
    deed(scene);
    if (!scene.lite) {
      effects.emote(scene, me, 'emo_star');
      scene.time.delayedCall(500, () => c.sprite.active && !c.gone && effects.emote(scene, c.sprite, 'emo_heart'));
    }
    await scene.wait(1600);
  }
}

/** Ближайший покупатель, который ещё ходит по залу (не в очереди, не вор, ему ещё не помогали). */
function shopperNear(scene: StoreScene, me: Phaser.GameObjects.Container, helped: WeakSet<Customer>): Customer | undefined {
  let best: Customer | undefined;
  let bestDist = Infinity;
  const floor = scene.layout.h - 8;
  for (const c of scene.customers) {
    if (c.gone || c.thief || c.serving || helped.has(c) || !c.sprite.active || c.sprite.y > floor || scene.queue.includes(c)) continue;
    const d = Phaser.Math.Distance.Between(me.x, me.y, c.sprite.x, c.sprite.y);
    if (d < bestDist) [best, bestDist] = [c, d];
  }
  return best;
}
