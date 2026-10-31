// Еда в магазине: кофейня (бариста, очередь у стойки, пар над чашкой), пекарня (печь, партии хлеба,
// подгоревший хлеб, свежий хлеб на полку) и кухня (повар, кастрюли и плита, нарезка, блюда на витрину).
// Правила и деньги — game/bakery.ts, game/kitchen.ts, game/gear.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { canPlace, PRODUCTS, DAY_SECONDS, shelfFree, warehouseOf, type ProductId } from '../game/economy';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { UI_FONT } from '../ui/dom';
import { hasUpgrade } from '../game/upgrades';
import { kioskSlots } from '../game/lanes';
import {
  cookBatch,
  DISHES,
  DISH_IDS,
  dishPortions,
  foodSlots,
  foodSprite,
  kitchenOpen,
  kitchenWorking,
  pantryOf,
  portionsOf,
  servePortions,
  stoveSeconds,
  stoveSprite,
  takeDish,
  takeIngredients,
  topUpKitchen,
  wantsDish,
  type DishId,
} from '../game/kitchen';
import { blockedZones, standFor, overlapsRect, propFootprint, propRect, tillZones } from './placement';
import { iceboxRect } from './layout';
import { Halo } from './halo';
import { coffeeChance, cupsOf, useCup } from '../game/coffee';
import { BRAND_BATCH, brandBatchCost, brandToBake, startBrandBatch } from '../game/brand';
import { brewSeconds, coffeePrice, coffeeSprite, gearTier, ovenBake, ovenBatch, ovenBatchCost, ovenSprite } from '../game/gear';
import { registerSlots } from '../game/registers';
import {
  AROMA_SECONDS,
  bakerShouldBake,
  bakeryWorking,
  OVEN_BURN_SECONDS,
  sellWholesale,
  startBatch,
  takeOutBread,
  wholesaleToBake,
} from '../game/bakery';
import { ART, LIGHT_DEPTH, PLACE_MS, COOK_LATE, COFFEE_WAITING, COFFEE_ORDERS, type Customer, type KitchenView, type Worker } from './common';
import * as motion from './motion';
import * as lighting from './lighting';
import * as staff from './staff';
import * as persons from './persons';
import * as camera from './camera';
import * as shelves from './shelves';
import * as building from './building';

/** Кофейня во флигеле: кофемашина у стены, стойка, за ней бариста; в углу столик. */
export function buildCoffee(scene: StoreScene): void {
  scene.coffeeImg = undefined;
  if (!coffeeOpen(scene)) return;
  const { x, y } = scene.layout.coffee;
  scene.coffeeImg = scene.art(x + 10, y + 19, coffeeSprite(scene.state)).setDepth(y + 20);
  scene.art(x + 22, y + 28, 'coffee_bar').setDepth(y + 34);
  scene.art(x + 47, y + 49, 'cafe_table').setDepth(y + 55);
  // Уют: фикус в углу и пар над кофемашиной.
  scene.art(x + 6, y + 52, 'plant').setDepth(y + 57);
  if (!scene.lite) {
    for (let k = 0; k < 3; k++) {
      const steam = scene.add.image(x + 8 + k * 1.5, y + 9, 'glow').setDisplaySize(6, 6).setTint(0xffffff).setAlpha(0).setDepth(y + 22);
      scene.tweens.add({ targets: steam, y: y + 1, alpha: { from: 0.5, to: 0 }, scale: steam.scale * 1.8, duration: 1700, delay: k * 600, repeat: -1, repeatDelay: 900, ease: 'Sine.easeOut' });
    }
  }
  // Столики (улучшение): ещё два столика у окна — за ними пьют кофе.
  if (hasUpgrade(scene.state, 'coffeeTables')) for (const tx of [12, 30]) scene.art(x + tx, y + 52, 'cafe_table').setDepth(y + 58);
}

/** У стойки: где делают заказ и куда отходят ждать (у столика и у стены). */
export function coffeeSpots(scene: StoreScene): { order: { x: number; y: number }; wait: { x: number; y: number }[] } {
  const { x, y } = scene.layout.coffee;
  return {
    order: { x: x + 24, y: y + 43 },
    wait: [
      { x: x + 38, y: y + 45 },
      { x: x + 10, y: y + 47 },
      { x: x + 54, y: y + 40 },
    ],
  };
}

/**
 * Покупатель с покупками иногда заходит в кофейню: подходит к стойке, заказывает,
 * отходит ждать; бариста варит заказы по очереди и зовёт — покупатель забирает стаканчик.
 * Платят на кассе вместе с покупками.
 */
export async function buyCoffee(scene: StoreScene, c: Customer): Promise<void> {
  const machine = scene.coffeeImg;
  const barista = scene.workers.get('barista');
  if (!machine?.active || !barista || scene.coffeeOrders.length >= COFFEE_WAITING || c.thief || c.items.length === 0) return;
  if (Math.random() >= coffeeChance(scene.state)) return;
  const next = useCup(scene.state);
  if (!next) return;
  scene.state = next;
  const room = scene.layout.coffee;
  const spots = coffeeSpots(scene);
  const alive = () => !c.gone && c.sprite.active;
  await persons.walkVia(scene, c.sprite, [room.doorway, room.inside]);
  // К стойке по одному: пока там кто-то заказывает или забирает — подождать.
  await waitCounter(scene, c);
  if (!alive()) return;
  scene.coffeeCounter = true;
  await persons.walk(scene, c.sprite, spots.order.x, spots.order.y);
  if (!alive()) {
    scene.coffeeCounter = false;
    return;
  }
  persons.setFacing(c.sprite, 'up');
  scene.popup(c.sprite.x, c.sprite.y - 18, t(Phaser.Utils.Array.GetRandom(COFFEE_ORDERS)), '#ffffff');
  await scene.wait(900);
  scene.coffeeCounter = false;
  if (!alive()) return;
  // Отходит ждать, пока сварят.
  const spot = spots.wait[scene.coffeeOrders.length % spots.wait.length];
  const ready = new Promise<void>((done) => scene.coffeeOrders.push({ c, done }));
  await persons.walk(scene, c.sprite, spot.x, spot.y);
  if (alive()) persons.setFacing(c.sprite, 'up');
  await ready;
  if (!alive() || !scene.sys.isActive()) return;
  await waitCounter(scene, c);
  scene.coffeeCounter = true;
  await persons.walk(scene, c.sprite, spots.order.x + 6, spots.order.y);
  scene.coffeeCounter = false;
  if (!alive()) return;
  const cup = scene.art(5, 1, 'cup');
  c.sprite.add(cup);
  c.extras = [...(c.extras ?? []), { kind: 'coffee', price: coffeePrice(scene.state) }];
  scene.stats.coffees = (scene.stats.coffees ?? 0) + 1;
  // Чашку ставят на блюдце — тонкий звон.
  sound.place('glass', 2, c.sprite.x);
  scene.popup(c.sprite.x, c.sprite.y - 18, t('popup.coffee', { n: coffeePrice(scene.state) }), '#fff3b0');
  if (cupsOf(scene.state) === 0) scene.time.delayedCall(900, () => scene.popup(machine.x + 10, machine.y - 16, t('popup.noCups'), '#ffd0d0'));
  await persons.walkVia(scene, c.sprite, [room.inside, room.doorway]);
}

/** Подождать, пока у стойки освободится место (не дольше 8 секунд). */
export async function waitCounter(scene: StoreScene, c: Customer): Promise<void> {
  for (let i = 0; i < 32 && scene.coffeeCounter && !c.gone; i++) await scene.wait(250);
}

/** Бариста варит заказы по очереди: пар над машиной, «Готово!» — покупатель подходит за стаканчиком. */
export async function baristaLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  while (scene.alive(gen)) {
    const order = scene.coffeeOrders[0];
    const machine = scene.coffeeImg;
    if (!order || !machine?.active) {
      if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await staff.workerWalk(scene, w, w.home.x, w.home.y);
      persons.setFacing(w.sprite, 'down');
      await scene.wait(300);
      continue;
    }
    // К машине: варит, над машиной пар.
    await staff.workerWalk(scene, w, machine.x + 7, w.home.y);
    if (!scene.alive(gen)) return;
    persons.setFacing(w.sprite, 'left');
    sound.hiss(brewSeconds(scene.state) * 0.8, 2600, 0.035, machine.x);
    const steam = scene.time.addEvent({ delay: 260, repeat: Math.floor((brewSeconds(scene.state) * 1000) / 260), callback: () => steamPuff(scene, machine.x, machine.y - 6) });
    await staff.workerWait(scene, w, brewSeconds(scene.state) * 1000);
    steam.remove();
    if (!scene.alive(gen)) return;
    await staff.workerWalk(scene, w, w.home.x, w.home.y);
    persons.setFacing(w.sprite, 'down');
    scene.popup(w.sprite.x, w.sprite.y - 18, t('popup.coffeeReady'), '#c8ffb0');
    if (scene.coffeeOrders[0] === order) scene.coffeeOrders.shift();
    order.done();
    await scene.wait(500);
  }
}

/** Облачко пара: поднимается и тает. */
export function steamPuff(scene: StoreScene, x: number, y: number, tint = 0xffffff): void {
  const puff = scene.art(x + Phaser.Math.FloatBetween(-2, 2), y, 'glow').setScale(0.08).setTint(tint).setAlpha(0.7).setDepth(LIGHT_DEPTH - 2);
  scene.tweens.add({ targets: puff, y: y - 10, scale: 0.16, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
}

// ---------- Печь ----------

/** Печь в пекарне во флигеле: окошко светится, пока печётся; рядом стеллаж с хлебом и стол пекаря. */
export function buildOven(scene: StoreScene): void {
  scene.oven?.timer?.remove();
  scene.oven = undefined;
  if (!bakeryOpen(scene)) return;
  const room = scene.layout.bakery;
  scene.art(room.x + 31, room.y + 24, 'bread_rack').setDepth(room.y + 33);
  scene.art(room.x + 26, room.y + 44, 'baker_table').setDepth(room.y + 50);
  const at = { x: room.x + 11, y: room.y + 25 };
  const img = scene.art(at.x, at.y, ovenSprite(scene.state)).setDepth(at.y + 9);
  const glow = scene.add.rectangle(at.x, at.y + 1.5, 7, 3, 0xf77622).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(at.y + 10);
  const bread = scene.art(at.x, at.y + 1.5, 'oven_bread').setDepth(at.y + 11).setVisible(false);
  const bar = scene.add.rectangle(at.x - 8, at.y - 13, 16, 3, 0x181425).setOrigin(0, 0.5).setDepth(1000).setVisible(false);
  const fill = scene.add.rectangle(at.x - 7.5, at.y - 13, 0, 2, 0xfeae34).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
  const halo = new Halo(scene, img, 0xfee761);
  // Тёплый отсвет печи на полу и мука, взлетающая со стола пекаря.
  const warm = scene.add.image(at.x + 2, at.y + 13, 'glow').setDisplaySize(34, 14).setTint(0xffb060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.14).setDepth(room.y + 26);
  scene.tweens.add({ targets: warm, alpha: 0.22, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  if (!scene.lite) {
    for (let k = 0; k < 4; k++) {
      const dust = scene.add.rectangle(room.x + 20 + k * 4, room.y + 41, 1, 1, 0xffffff, 0.8).setDepth(room.y + 52);
      scene.tweens.add({ targets: dust, y: room.y + 33, x: dust.x + (k % 2 ? 2 : -2), alpha: { from: 0.8, to: 0 }, duration: 1300, delay: k * 450, repeat: -1, repeatDelay: 2600 });
    }
  }
  // Печь светит в карте освещения: ровный тёплый отсвет на полу, а пока печёт — огонь за дверцей (его
  // дрожь — ступеньками по четверти: карту не перерисовывать каждый кадр ради едва заметного мерцания).
  scene.light.follow(warm, { key: 'light_pool', w: 46, h: 30, power: () => 0.45 * lighting.powerOn(scene) });
  scene.light.follow(glow, { key: 'glow', w: 22, h: 16, color: 0xff9a40, power: () => Math.round(glow.alpha * 4) / 4 });
  scene.oven = { img, glow, bread, bar, fill, halo, state: 'idle', start: 0, product: 'bread' };
  img.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => tapOven(scene)));
}

/** Печью занимается пекарь: без него пекарня стоит, касание подсказывает, что делать. */
export function tapOven(scene: StoreScene): void {
  const oven = scene.oven;
  if (!oven || !scene.running) return;
  const why = bakeryWorking(scene.state) ? t('popup.bakerWorks') : t('popup.needBaker');
  scene.popup(oven.img.x + 10, oven.img.y - 18, why, bakeryWorking(scene.state) ? '#fff3b0' : '#ffd0d0');
}

/** Пекарь ставит противень: деньги за муку, через время хлеб готов. */
export function startOven(scene: StoreScene, product: ProductId = 'bread', forShops = false): void {
  const oven = scene.oven;
  if (!oven || oven.state !== 'idle') return;
  // Хлеб для соседей уходит не на полки — место в зале ему не нужно, только деньги на муку.
  const next = forShops
    ? scene.state.money >= ovenBatchCost(scene.state) ? { ...scene.state, money: scene.state.money - ovenBatchCost(scene.state) } : null
    : product === 'bread' ? startBatch(scene.state) : startBrandBatch(scene.state, product);
  if (!next) {
    const why = scene.state.money < ovenBatchCost(scene.state) ? t('popup.ovenMoney') : t('popup.ovenFull');
    scene.popup(oven.img.x - 10, oven.img.y - 18, why, '#ffd0d0');
    sound.bad();
    return;
  }
  scene.state = next;
  haptic.tap();
  sound.hiss(0.5, 900, 0.04, oven.img.x);
  const cost = product === 'bread' ? ovenBatchCost(scene.state) : brandBatchCost(product);
  scene.popup(oven.img.x - 10, oven.img.y - 18, `${PRODUCTS[product].icon} ${t('popup.ovenStart', { n: cost })}`, '#fff3b0');
  oven.product = product;
  oven.forShops = forShops;
  if (forShops) scene.wholesaleBaked++;
  oven.state = 'baking';
  oven.start = scene.time.now;
  oven.timer = scene.time.delayedCall(ovenBake(scene.state) * 1000, () => breadReady(scene));
}

export function breadReady(scene: StoreScene): void {
  const oven = scene.oven;
  if (!oven?.img.active || oven.state !== 'baking') return;
  oven.state = 'ready';
  oven.start = scene.time.now;
  oven.bread.setVisible(true);
  // Таймер печи: «дзинь».
  sound.ding(oven.img.x);
  scene.tweens.add({ targets: oven.img, scaleY: 1.08 / ART, duration: 120, yoyo: true, repeat: 1 });
  // Пекарь рядом и вынет сам; если он ушёл (заболел посреди дня) — хлеб может сгореть.
  if (!scene.workers.get('baker')) oven.timer = scene.time.delayedCall(OVEN_BURN_SECONDS * 1000, () => burnBread(scene));
}

/** Не вынули вовремя — хлеб сгорел, из печи валит чёрный дым. */
export function burnBread(scene: StoreScene): void {
  const oven = scene.oven;
  if (!oven?.img.active || oven.state !== 'ready') return;
  resetOven(scene);
  scene.stats.burnt = (scene.stats.burnt ?? 0) + 1;
  sound.bad();
  haptic.error();
  scene.popup(oven.img.x - 10, oven.img.y - 20, t('popup.ovenBurnt'), '#ffd0d0');
  for (let i = 0; i < 8; i++) scene.time.delayedCall(i * 160, () => steamPuff(scene, oven.img.x, oven.img.y - 8, 0x3a3046));
}

export function resetOven(scene: StoreScene): void {
  const oven = scene.oven;
  if (!oven) return;
  oven.timer?.remove();
  oven.state = 'idle';
  oven.bread.setVisible(false);
  oven.glow.setAlpha(0);
  oven.bar.setVisible(false);
  oven.fill.setVisible(false);
  oven.halo?.set(0);
}

/**
 * Пекарь: ставит противень, когда на хлебных полках есть место, пока печётся — месит тесто,
 * готовый хлеб выносит в зал на хлебную полку. По залу от двери пекарни идёт запах хлеба.
 */
export async function bakerLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  const room = scene.layout.bakery;
  while (scene.alive(gen)) {
    const oven = scene.oven;
    if (!scene.running || !oven?.img.active) {
      await scene.wait(500);
      continue;
    }
    const atOven = { x: oven.img.x + 10, y: oven.img.y + 12 };
    if (oven.state === 'ready') {
      await staff.workerWalk(scene, w, atOven.x, atOven.y);
      await staff.workerWait(scene, w, 400);
      if (!scene.alive(gen)) return;
      if (oven.state !== 'ready') continue;
      const product = oven.product;
      const forShops = oven.forShops;
      resetOven(scene);
      if (forShops) {
        // Противень для соседей — в ящик у двери пекарни, курьер заберёт; деньги сразу.
        await staff.workerWalk(scene, w, room.inside.x, room.inside.y);
        if (!scene.alive(gen)) return;
        const sold = sellWholesale(scene.state);
        scene.state = sold.state;
        scene.stats.revenue += sold.pay;
        sound.coin(room.inside.x);
        scene.popup(room.inside.x + 10, room.inside.y - 14, t('popup.wholesale', { n: ovenBatch(scene.state), pay: sold.pay }), '#c8ffb0');
        scene.hud.update(scene.state, scene.timeLeft);
        continue;
      }
      w.carried.setTexture('bread_tray').setPosition(0, 1).setVisible(true);
      const index = breadShelfIndex(scene, product);
      const slot = index >= 0 ? shelves.spotOf(scene, index) : null;
      // Из пекарни через дверь к полке — одним ходом, без остановки в дверях.
      const stand = slot && standFor(scene.layout, slot);
      await staff.workerWalkVia(scene, w, [room.inside, room.doorway, ...(stand ? [{ x: stand.x, y: stand.y - 2 }] : [])]);
      await staff.workerWait(scene, w, PLACE_MS);
      if (!scene.alive(gen)) return;
      w.carried.setVisible(false).setTexture('box').setPosition(0, 3);
      freshBread(scene, slot ? { x: slot.x, y: slot.y - 18 } : room.doorway, product);
      await staff.workerWalkVia(scene, w, [room.doorway, room.inside]);
      continue;
    }
    // Сначала хлеб для зала (по режиму пекарни); когда хватает — своя выпечка; потом — заказ соседей.
    const dayLeft = scene.timeLeft / DAY_SECONDS;
    const next = oven.state === 'idle' ? (bakerShouldBake(scene.state, dayLeft) ? 'bread' : brandToBake(scene.state, dayLeft)) : null;
    const forShops = oven.state === 'idle' && !next && wholesaleToBake(scene.state, scene.wholesaleBaked);
    if (next || forShops) {
      await staff.workerWalk(scene, w, atOven.x, atOven.y);
      if (!scene.alive(gen)) return;
      startOven(scene, next ?? 'bread', forShops);
      continue;
    }
    // Пока печётся — месит тесто у стола.
    if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await staff.workerWalk(scene, w, w.home.x, w.home.y);
    persons.setFacing(w.sprite, 'up');
    await scene.wait(600);
  }
}

/** Хлебная полка, где есть место (первая по порядку); -1 — нет. */
export function breadShelfIndex(scene: StoreScene, product: ProductId = 'bread'): number {
  return scene.state.shelves.findIndex((s) => !s.broken && canPlace(product, s) && shelfFree(s) > 0);
}

/** Свежий хлеб из печи — на полки (лишнее на склад); по залу от двери пекарни идёт запах. */
export function freshBread(scene: StoreScene, at: { x: number; y: number }, product: ProductId = 'bread'): void {
  const out = product === 'bread' ? takeOutBread(scene.state) : takeOutBread(scene.state, BRAND_BATCH, product);
  scene.state = out.state;
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  sound.hiss(0.6, 1400, 0.04, at.x);
  sound.good();
  const text = product === 'bread' ? t('popup.freshBread', { n: out.onShelves }) : t('popup.freshOwn', { icon: PRODUCTS[product].icon, n: out.onShelves });
  scene.popup(at.x, at.y, text, '#c8ffb0');
  scene.time.delayedCall(900, () => scene.popup(scene.layout.w / 2, scene.layout.wallH + 50, t('popup.aroma'), '#fff3b0'));
  scene.aromaUntil = scene.time.now + AROMA_SECONDS * 1000;
  // Тёплые завитки запаха плывут из пекарни по залу.
  const { w, wallH, h, bakery } = scene.layout;
  scene.time.addEvent({
    delay: 380,
    repeat: Math.floor((AROMA_SECONDS * 1000) / 380),
    callback: () => {
      const wisp = scene.art(bakery.doorway.x, bakery.doorway.y - 6, 'glow').setScale(0.07).setTint(0xfeae34).setAlpha(0.5).setDepth(LIGHT_DEPTH - 2);
      scene.tweens.add({
        targets: wisp,
        x: Phaser.Math.Between(10, w - 20),
        y: Phaser.Math.Between(wallH + 20, h - 30),
        scale: 0.2,
        alpha: 0,
        duration: 2600,
        ease: 'Sine.easeInOut',
        onComplete: () => wisp.destroy(),
      });
    },
  });
}

/** Полоска над печью: сколько осталось печься; готовый хлеб — окошко мигает. */
export function updateOven(scene: StoreScene): void {
  const oven = scene.oven;
  if (!oven?.img.active) return;
  const now = scene.time.now;
  if (oven.state === 'baking') {
    const k = Math.min(1, (now - oven.start) / (ovenBake(scene.state) * 1000));
    oven.bar.setVisible(true);
    oven.fill.setVisible(true).setFillStyle(0xfeae34);
    oven.fill.width = 15 * k;
    oven.glow.setAlpha(0.35 + 0.15 * Math.sin(now / 200));
    if (Math.random() < 0.03) steamPuff(scene, oven.img.x + 3, oven.img.y - 16, 0xc0cbdc);
  } else if (oven.state === 'ready') {
    // Сколько осталось до «сгорит»: полоска краснеет и убывает.
    const k = 1 - Math.min(1, (now - oven.start) / (OVEN_BURN_SECONDS * 1000));
    oven.bar.setVisible(true);
    oven.fill.setVisible(true).setFillStyle(k > 0.4 ? 0x63c74d : 0xe43b44);
    oven.fill.width = 15 * k;
    oven.glow.setAlpha(Math.floor(now / 250) % 2 ? 0.7 : 0.3);
    oven.halo?.set(2 + 2 * Math.sin(now / 120));
    if (Math.random() < 0.06) steamPuff(scene, oven.img.x, oven.img.y - 6);
  }
}

// ---------- Флигель: склад, пекарня, кофейня ----------

/** Пекарня и кофейня открыты, когда куплены печь и кофейный уголок. */
export function bakeryOpen(scene: StoreScene): boolean {
  return hasUpgrade(scene.state, 'oven');
}

export function coffeeOpen(scene: StoreScene): boolean {
  return hasUpgrade(scene.state, 'coffee');
}

/**
 * Кухня: кафельный фартук, плита (модель — оборудование «Плита»), стол повара с доской и ножом,
 * ящик с овощами и витрина-раздача, где стоят тарелки с готовым. Касание плиты — кто готовит,
 * касание витрины — сколько чего осталось.
 */
export function buildKitchen(scene: StoreScene): void {
  // Что варилось до перестройки, уже куплено и снято со склада: сразу в витрину.
  flushCooking(scene);
  scene.kitchenView = undefined;
  const room = scene.layout.kitchen;
  if (!room || !kitchenOpen(scene.state)) return;
  const { x, y } = room;
  scene.add.tileSprite(x + 1, y + 6, 40, 8, 'ktiles').setOrigin(0).setTileScale(1 / ART).setDepth(1.5);
  const stove = scene.art(x + 10, y + 23, stoveSprite(scene.state)).setDepth(y + 31);
  const table = scene.art(x + 33, y + 23, 'ktable').setDepth(y + 29);
  const knife = scene.art(table.x - 3, table.y - 2.5, 'kknife').setDepth(y + 30);
  knife.setData('y', knife.y);
  // Ящик с овощами — кладовая кухни: сюда кухня складывает закупленное у поставщиков.
  const crate = scene.art(x + 52, y + 24, 'kcrate').setDepth(y + 28);
  const showcase = scene.art(x + 16, y + 46.5, 'kshowcase').setDepth(y + 50);
  scene.art(showcase.x, showcase.y, 'kshowcase_glass').setDepth(y + 50.6);
  // Кастрюли на конфорках: у электроплитки одна посередине, у газовой и плиты шефа — две спереди.
  const burners = gearTier(scene.state, 'stove') ? [-3, 3].map((dx) => ({ x: stove.x + dx, y: stove.y - 3.5 })) : [{ x: stove.x, y: stove.y - 4 }];
  const gas = gearTier(scene.state, 'stove') > 0;
  const flames = burners.map((b) =>
    scene.add
      .rectangle(b.x, b.y + 0.5, 4, 1, gas ? 0x5fcde4 : 0xf77622)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false)
      .setDepth(y + 31.5),
  );
  const pots = burners.map((b) => scene.art(b.x, b.y + 1, 'kpot').setOrigin(0.5, 1).setVisible(false).setDepth(y + 32));
  // Огонь плиты отсвечивает на стену и повара: газ — голубым, электроплитка — оранжевым. Сам огонёк
  // дрожит часто (твин в startPots), а отсвет — ступеньками раз в 300 мс и у всех конфорок разом: иначе
  // карту перерисовывали бы каждый кадр, пока варится.
  for (const flame of flames) scene.light.follow(flame, { key: 'glow', w: 26, h: 20, dy: -2, power: () => (flame.visible ? (Math.floor(scene.time.now / 300) % 2 ? 0.55 : 0.4) * lighting.powerOn(scene) : 0) });
  scene.kitchenView = { stove, pots, flames, knife, crate, showcase, plates: [], cooking: [], onPass: false };
  stove.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => tapStove(scene)));
  showcase.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => tapShowcase(scene)));
  refreshKitchen(scene);
}

/**
 * Тарелки на раздаче кухни — только что сваренное, пока повар не переложил на поднос (по тарелке на каждые
 * три порции, восемь в ряд); и тарелки на полке «Еда».
 */
export function refreshKitchen(scene: StoreScene): void {
  refreshFood(scene);
  const k = scene.kitchenView;
  if (!k?.showcase.active) return;
  for (const plate of k.plates) plate.destroy();
  k.plates = [];
  const dishes = k.onPass ? k.cooking.flatMap((id) => Array.from({ length: Math.ceil(dishPortions(scene.state, id) / 3) }, () => id)).slice(0, 8) : [];
  dishes.forEach((id, i) => {
    // Низ тарелки — на полке за стеклом, на полточки ниже середины витрины (art/kitchen.py).
    const px = k.showcase.x + (7 + i * 6.5 - 28) / 2;
    k.plates.push(scene.art(px, k.showcase.y + 0.5, `kdish_${id}`).setOrigin(0.5, 1).setDepth(k.showcase.depth + 0.3 + i * 0.01));
  });
}

/** Плита: кто готовит — повар или никто (тогда подсказка: нанять или готовить самому утром). */
export function tapStove(scene: StoreScene): void {
  const k = scene.kitchenView;
  if (!k || !scene.running) return;
  const works = kitchenWorking(scene.state);
  scene.popup(k.stove.x + 8, k.stove.y - 14, works ? t('popup.cookWorks') : t('popup.needCook'), works ? '#fff3b0' : '#ffd0d0');
}

/** Раздача и полка «Еда»: сколько каких порций на полке — значками блюд. */
export function tapShowcase(scene: StoreScene, at?: { x: number; y: number }): void {
  const k = scene.kitchenView;
  const where = at ?? (k ? { x: k.showcase.x, y: k.showcase.y } : null);
  if (!where) return;
  const text = DISH_IDS.filter((id) => portionsOf(scene.state, id) > 0)
    .map((id) => `${DISHES[id].icon}${portionsOf(scene.state, id)}`)
    .join(' ');
  scene.popup(where.x, where.y - 10, text || t('popup.kitchenEmpty'), '#fff3b0');
}

/** Что варилось или несут — сразу на полку «Еда» (зал перестраивают, повара переставляют); кастрюли с плиты. */
export function flushCooking(scene: StoreScene): void {
  const k = scene.kitchenView;
  if (!k) return;
  for (const id of k.cooking.splice(0)) scene.state = servePortions(scene.state, id);
  k.onPass = false;
  stopPots(scene);
  refreshKitchen(scene);
}

/**
 * Полка «Еда» у входа (модель — оборудование «Полка «Еда»»): у нижней стены рядом с дверью, где свободно
 * (или где поставили при перестановке). Сверху табличка «Еда», в нише — тарелки с готовым. Нажать —
 * сколько чего осталось.
 */
export function buildFood(scene: StoreScene): void {
  scene.foodView = undefined;
  if (!scene.layout.kitchen || !kitchenOpen(scene.state)) return;
  const { door, h, w } = scene.layout;
  const fp = propFootprint(scene.layout, 'food', 0);
  // Места под все киоски помещения (и ещё не купленные): полку не ставим туда, где встанет киоск.
  const zones = [...tillZones(scene.layout, registerSlots(scene.state), kioskSlots(scene.state)), ...blockedZones(scene.layout)];
  const ice = scene.state.shelves.some((sh) => sh.kind === 'icebox') ? [iceboxRect(shelves.iceboxSpot(scene))] : [];
  // Горка уценки целиком (она выше своего следа) и место её покупателя; где стоят менеджер и охранник.
  const bargain = scene.bargainAt;
  const stand = bargain ? [{ x: bargain.x - 15, y: building.bargainStand(scene, bargain) - 4, w: 30, h: bargain.y + 8 - (building.bargainStand(scene, bargain) - 4) }] : [];
  const homes = (['manager', 'guard'] as const).map((role) => staff.workerHome(scene, role)).map((p) => ({ x: p.x - 6, y: p.y - 10, w: 12, h: 14 }));
  // Вещи, переставленные игроком в этом помещении (ёлку ставят позже — по своему месту), полка тоже обходит.
  const moved = scene.state.propPos?.level === scene.state.level ? Object.entries(scene.state.propPos.at).filter(([id]) => id !== 'food') : [];
  const placed = moved.map(([id, p]) => propRect({ id, x: p.x, y: p.y, fp: propFootprint(scene.layout, id, p.x) }));
  // Тележки и корзинки у входа (buildDecor ставит их по обе стороны двери) — не загораживаем.
  const byDoor = [-46, -26, -24, 26, 46].map((dx) => ({ x: door.x + dx - 11, y: h - 22, w: 22, h: 22 }));
  // Свободно и место покупателя над полкой (там он стоит, когда берёт порцию).
  const free = (p: { x: number; y: number }) => {
    const r = { x: p.x + fp.x - 3, y: p.y + fp.y - 16, w: fp.w + 6, h: fp.h + 19 };
    return r.x > 2 && r.x + r.w < w - 2 && r.y > scene.layout.wallH + 4 && ![...scene.obstacles, ...zones, ...ice, ...byDoor, ...stand, ...homes, ...placed].some((o) => overlapsRect(r, o));
  };
  // У нижней стены как можно ближе к двери, а если там тесно — в зале повыше, тоже поближе к входу.
  const candidates: { x: number; y: number }[] = [];
  for (let y = h - 12; y > scene.layout.wallH + 40; y -= 8) for (let x = 20; x <= w - 20; x += 4) candidates.push({ x, y });
  candidates.sort((a, b) => Math.hypot(a.x - door.x, (a.y - h) * 1.5) - Math.hypot(b.x - door.x, (b.y - h) * 1.5));
  const def = candidates.find(free) ?? { x: door.x + 76, y: h - 12 };
  const at = building.propAt(scene, 'food', def);
  const tex = foodSprite(scene.state);
  const img = scene.art(at.x, at.y - 4, tex).setDepth(at.y + 4);
  img.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => tapShowcase(scene, { x: at.x, y: at.y - 14 })));
  // Табличка «Еда» — надпись по центру таблички над нишей (art/kitchen.py).
  scene.add
    .text(at.x, at.y - 13.5, t('food.sign'), { fontFamily: UI_FONT, fontSize: '4.5px', fontStyle: 'bold', color: '#fee761' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(8))
    .setDepth(at.y + 4.2);
  if (gearTier(scene.state, 'foodShelf') === 2) scene.art(at.x, at.y - 4, 'food_glass2').setDepth(at.y + 4.6);
  scene.foodView = { at, img, plates: [] };
  scene.obstacles.push({ x: at.x + fp.x, y: at.y + fp.y, w: fp.w, h: fp.h });
  building.registerProp(scene, 'food', at, tex, fp);
  refreshFood(scene);
}

/** Тарелки на полке «Еда»: до десяти в два ряда — сколько их, по заполненности полки; блюда — по порядку меню. */
export function refreshFood(scene: StoreScene): void {
  const f = scene.foodView;
  if (!f?.img.active) return;
  for (const plate of f.plates) plate.destroy();
  f.plates = [];
  const slots = foodSlots(scene.state);
  const dishes = DISH_IDS.flatMap((id) => Array.from({ length: Math.ceil((portionsOf(scene.state, id) * 10) / slots) }, () => id)).slice(0, 10);
  // Сначала задний ряд, потом передний (в точках картинки полки: низ тарелок — 19 и 23, по x — от 12 через 9).
  dishes.forEach((id, i) => {
    const px = f.at.x + (12 + (i % 5) * 9 - 30) / 2;
    const py = f.at.y - 16 + (i < 5 ? 19 : 23) / 2;
    f.plates.push(scene.art(px, py, `kdish_${id}`).setOrigin(0.5, 1).setDepth(f.img.depth + 0.2 + i * 0.01));
  });
}

/** Где стоит покупатель (и повар), когда берёт с полки «Еда» или ставит на неё: над полкой. */
export function foodStand(scene: StoreScene): { x: number; y: number } | null {
  const f = scene.foodView;
  return f ? { x: f.at.x, y: f.at.y - 17 } : null;
}

/**
 * Покупатель с покупками по пути к кассе заглядывает на полку «Еда» и берёт порцию — платит за неё на
 * кассе. Хотел, а полка пуста, — в отчёт (повар учтёт спрос завтра).
 */
export async function visitFood(scene: StoreScene, c: Customer): Promise<void> {
  const stand = foodStand(scene);
  if (!stand || c.thief || scene.night || !c.items.length || !wantsDish(scene.state, Math.random)) return;
  scene.stats.dishWanted = (scene.stats.dishWanted ?? 0) + 1;
  await persons.walk(scene, c.sprite, stand.x + Phaser.Math.Between(-7, 7), stand.y);
  if (c.gone) return;
  persons.setFacing(c.sprite, 'down');
  await scene.wait(450);
  if (c.gone) return;
  const took = takeDish(scene.state, Math.random);
  if (!took) {
    if (Math.random() < 0.6) scene.popup(c.sprite.x, c.sprite.y - 22, t('popup.foodEmpty'), '#ffd0d0');
    return;
  }
  scene.state = took.state;
  const d = DISHES[took.dish];
  c.extras = [...(c.extras ?? []), { kind: 'dish', price: d.price, dish: took.dish }];
  // Тарелка с полки перелетает дугой в руки, над полкой — цена порции.
  const from = { x: c.sprite.x, y: c.sprite.y + 10 };
  persons.setMood(scene, c.sprite, 'happy', 1400);
  const plate = scene.art(from.x, from.y, `kdish_${took.dish}`).setDepth(c.sprite.y + 1);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 360,
    ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      const k = tween.getValue() ?? 0;
      plate.setPosition(from.x + (c.sprite.x - from.x) * k, from.y + (c.sprite.y - 3 - from.y) * k - Math.sin(k * Math.PI) * 7).setAlpha(1 - 0.6 * k * k);
    },
    onComplete: () => plate.destroy(),
  });
  motion.priceFlash(scene, from.x, from.y - 12, d.price);
  if (Math.random() < 0.5) scene.popup(c.sprite.x, c.sprite.y - 24, t('popup.foodTake', { icon: d.icon, name: t(`dish.${took.dish}` as TextKey) }), '#c8ffb0');
  sound.place('glass', 0, c.sprite.x);
  refreshFood(scene);
}

/** На плиту: кастрюли (блины и сырники — на сковороде), огонь под ними, пар и шкворчание. */
export function startPots(scene: StoreScene, dishes: DishId[]): void {
  const k = scene.kitchenView;
  if (!k) return;
  k.pots.forEach((pot, i) => {
    const id = dishes[i];
    const pan = id === 'pancakes' || id === 'syrniki';
    pot.setTexture(pan ? 'kpan' : 'kpot').setOrigin(pan ? 0.4 : 0.5, 1).setVisible(Boolean(id));
    k.flames[i].setVisible(Boolean(id)).setAlpha(0.8);
    if (id) scene.tweens.add({ targets: k.flames[i], alpha: 0.35, duration: 180, yoyo: true, repeat: -1 });
  });
  sound.hiss(Math.min(2.5, stoveSeconds(scene.state) * 0.4), 1200, 0.03, k.stove.x);
  // Пар — облачками над каждой кастрюлей (сероватый: на белом кафеле белый не видно); в лёгкой графике реже.
  k.stopSteam?.();
  k.stopSteam = scene.worldTimer(scene.lite ? 700 : 320, () => {
    for (const pot of k.pots) if (pot.visible && pot.active) steamPuff(scene, pot.x + Phaser.Math.FloatBetween(-1.5, 1.5), pot.y - 5, 0xc0cbdc);
  });
}

export function stopPots(scene: StoreScene): void {
  const k = scene.kitchenView;
  if (!k) return;
  k.stopSteam?.();
  k.stopSteam = undefined;
  for (const pot of k.pots) if (pot.active) pot.setVisible(false);
  for (const flame of k.flames) {
    if (!flame.active) continue;
    scene.tweens.killTweensOf(flame);
    flame.setVisible(false);
  }
}

/**
 * Повар: по меню дня решает, что поставить (kitchen.ts, cookBatch). Не хватает продуктов — кухня докупает
 * их в кладовую (из кассы). Берёт из ящика-кладовой (нет денег — со склада и с полок зала), режет на доске,
 * варит на плите — над кастрюлями пар, — ставит тарелки на раздачу, перекладывает на поднос и несёт
 * на полку «Еда» у входа. Под вечер и ночью новое не начинает: не успеет продаться — спишется.
 */
export async function cookLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  while (scene.alive(gen)) {
    const k = scene.kitchenView;
    // Через сколько закладка будет на полке: варка — по плите, нарезка и дорога — по шагу повара.
    const ready = stoveSeconds(scene.state) + COOK_LATE / staff.workerPace(scene, w);
    const open = scene.running && !scene.night && Boolean(k?.stove.active) && Boolean(scene.foodView) && scene.timeLeft > ready;
    const left = scene.timeLeft / DAY_SECONDS;
    // Что поставил бы, будь всё в кладовой, — на это кухня и докупает.
    const wish = open ? cookBatch(scene.state, left, ready / DAY_SECONDS, undefined, true) : [];
    if (k && wish.length) topUpPantry(scene, k, wish);
    const plan = wish.length ? cookBatch(scene.state, left, ready / DAY_SECONDS) : [];
    if (!k || !plan.length) {
      // Надо готовить, а продуктов не купить (денег нет) — раз в день повар об этом говорит.
      if (wish.length && scene.cookNoFoodDay !== scene.state.day) {
        scene.cookNoFoodDay = scene.state.day;
        scene.popup(w.sprite.x, w.sprite.y - 18, t('popup.cookNoFood'), '#ffd0d0');
      }
      await cookIdle(scene, w);
      continue;
    }
    const taken = await fetchIngredients(scene, w, gen, k, plan);
    if (!scene.alive(gen)) return;
    if (!taken.length) continue;
    // Режет на доске: корзинку — на стол, сам — у края стола боком к доске, чтобы нож было видно.
    await staff.workerWalk(scene, w, w.home.x, w.home.y);
    if (!scene.alive(gen)) return;
    w.carried.setVisible(false);
    persons.setFacing(w.sprite, 'left');
    await chop(scene, w, gen, k, taken);
    if (!scene.alive(gen)) return;
    // К плите: встаёт сбоку (кастрюли и пар не загораживает) и, пока варится, помешивает.
    await staff.workerWalk(scene, w, k.stove.x + 11, w.home.y);
    if (!scene.alive(gen)) return;
    persons.setFacing(w.sprite, 'left');
    startPots(scene, taken);
    const stir = Math.max(1, Math.round(stoveSeconds(scene.state) / 1.5));
    for (let i = 0; i < stir; i++) {
      motion.squash(scene, w.sprite, 1.04, 0.96, 140);
      await scene.wait((stoveSeconds(scene.state) * 1000) / stir);
      if (!scene.alive(gen)) return;
    }
    stopPots(scene);
    // Магазин закрылся, пока варилось: сваренное уже на полке (flushCooking) — нести нечего.
    if (!k.cooking.length) continue;
    sound.ding(k.stove.x);
    // Готовое — по тарелкам на раздачу, оттуда — на поднос.
    await staff.workerWalk(scene, w, k.showcase.x + 4, k.showcase.y - 8);
    if (!scene.alive(gen)) return;
    persons.setFacing(w.sprite, 'down');
    k.onPass = true;
    refreshKitchen(scene);
    sound.place('glass', 1, k.showcase.x);
    await staff.workerWait(scene, w, PLACE_MS * 2);
    if (!scene.alive(gen)) return;
    k.onPass = false;
    refreshKitchen(scene);
    w.carried.setTexture('kplates').setPosition(0, 1).setVisible(true);
    // С подносом — через дверь кухни в зал, к полке «Еда» у входа.
    await carryToFood(scene, w, gen, k);
    if (!scene.alive(gen)) return;
  }
}

/** Кухня докупает в кладовую то, чего не хватает на закладки plan, — из кассы; у ящика — коробка и надпись. */
export function topUpPantry(scene: StoreScene, k: KitchenView, plan: DishId[]): void {
  const top = topUpKitchen(scene.state, plan);
  if (!top.spent) return;
  scene.state = top.state;
  scene.stats.kitchenSpent = (scene.stats.kitchenSpent ?? 0) + top.spent;
  scene.popup(k.crate.x, k.crate.y - 12, t('popup.kitchenBought', { n: top.spent }), '#fff3b0');
  motion.squash(scene, k.crate, 1.08, 0.92, 120);
  sound.place('bump', 1, k.crate.x);
}

/**
 * Повар несёт поднос на полку «Еда»: из кухни через дверь в зал, ставит тарелки (порции — на полку)
 * и возвращается на кухню. Полки нет (зал перестроили) — сваренное и так уже на ней (flushCooking).
 */
export async function carryToFood(scene: StoreScene, w: Worker, gen: number, k: KitchenView): Promise<void> {
  const room = scene.layout.kitchen!;
  await staff.workerWalkVia(scene, w, [room.inside, room.doorway]);
  if (!scene.alive(gen)) return;
  const stand = foodStand(scene);
  if (stand) {
    await staff.workerWalk(scene, w, stand.x + 4, stand.y);
    if (!scene.alive(gen)) return;
    persons.setFacing(w.sprite, 'down');
    await staff.workerWait(scene, w, PLACE_MS);
    if (!scene.alive(gen)) return;
  }
  w.carried.setVisible(false).setTexture('box').setPosition(0, 3);
  const at = foodStand(scene) ?? { x: w.sprite.x, y: w.sprite.y };
  k.cooking.splice(0).forEach((id, i) => {
    const before = portionsOf(scene.state, id);
    scene.state = servePortions(scene.state, id);
    const text = t('popup.cooked', { icon: DISHES[id].icon, name: t(`dish.${id}` as TextKey), n: portionsOf(scene.state, id) - before });
    scene.time.delayedCall(i * 450, () => scene.popup(at.x, at.y - 8, text, '#c8ffb0'));
  });
  refreshKitchen(scene);
  sound.place('glass', 1, at.x);
  await staff.workerWalkVia(scene, w, [room.doorway, room.inside, w.home]);
}

/** Готовить нечего — стоит у стола. */
export async function cookIdle(scene: StoreScene, w: Worker): Promise<void> {
  if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await staff.workerWalk(scene, w, w.home.x, w.home.y);
  persons.setFacing(w.sprite, 'up');
  await scene.wait(600);
}

/**
 * За продуктами на всю закладку: всё есть в кладовой — к ящику на кухне; нет (денег на закупку не было) —
 * на склад, а чего там не хватает — к полке в зале. Снимает их в последней точке пути; чего уже нет
 * (разобрали, пока шёл) — того блюда не будет. Возвращает, что взял в работу.
 */
export async function fetchIngredients(scene: StoreScene, w: Worker, gen: number, k: KitchenView, plan: DishId[]): Promise<DishId[]> {
  const room = scene.layout.kitchen!;
  const store = scene.layout.warehouse;
  const need = new Map<ProductId, number>();
  for (const id of plan) for (const [p, n] of Object.entries(DISHES[id].needs)) need.set(p as ProductId, (need.get(p as ProductId) ?? 0) + (n ?? 0));
  // Кладовой хватает на всю закладку сразу (два блюда могут делить продукт).
  const pantry = [...need].every(([p, n]) => pantryOf(scene.state, p) >= n);
  const fromStore = !pantry && [...need.keys()].some((p) => warehouseOf(scene.state, p) > 0);
  const short = pantry ? undefined : [...need].find(([p, n]) => warehouseOf(scene.state, p) < n)?.[0];
  const shelf = short ? scene.state.shelves.findIndex((sh) => !sh.broken && (sh.items[short]?.length ?? 0) > 0) : -1;
  if (pantry) {
    // Ящик-кладовая в углу кухни: встаёт перед ним и набирает корзинку.
    await staff.workerWalk(scene, w, k.crate.x - 2, w.home.y);
    persons.setFacing(w.sprite, 'up');
    await staff.workerWait(scene, w, 450);
  } else {
    await staff.workerWalk(scene, w, room.inside.x, room.inside.y);
    await staff.workerWalk(scene, w, room.doorway.x, room.doorway.y);
  }
  if (fromStore) {
    await staff.workerWalk(scene, w, store.doorway.x, store.doorway.y);
    await staff.workerWalk(scene, w, store.inside.x, store.inside.y);
    await staff.workerWait(scene, w, 450);
  }
  if (shelf >= 0) {
    // Со склада в зал — обратно через дверь, а не наискосок сквозь стену флигеля.
    if (fromStore) await staff.workerWalk(scene, w, store.doorway.x, store.doorway.y);
    const stand = standFor(scene.layout, shelves.spotOf(scene, shelf));
    await staff.workerWalk(scene, w, stand.x, stand.y - 2);
    await staff.workerWait(scene, w, PLACE_MS);
  }
  // Пока ходил, магазин закрылся: варить уже нечего — к ночи всё равно спишется.
  if (!scene.alive(gen) || !scene.running || scene.night) return [];
  const taken: DishId[] = [];
  for (const id of plan) {
    const next = takeIngredients(scene.state, id);
    if (!next) continue;
    scene.state = next;
    taken.push(id);
  }
  if (taken.length) {
    // Уже снято из кладовой (со склада): если зал перестроят, пока варится, — сразу на полку (flushCooking).
    k.cooking.push(...taken);
    if (!pantry) {
      building.refreshWarehouse(scene);
      scene.refreshShelves();
    }
    w.carried.setTexture('kbasket').setPosition(0, 1).setVisible(true);
    sound.place('bump', 0, w.sprite.x);
  }
  if (pantry) return taken;
  if (fromStore && shelf < 0) await staff.workerWalk(scene, w, store.doorway.x, store.doorway.y);
  await staff.workerWalk(scene, w, room.doorway.x, room.doorway.y);
  await staff.workerWalk(scene, w, room.inside.x, room.inside.y);
  return taken;
}

/** Нарезка: нож стучит по доске, кусочки подпрыгивают — цвета продуктов закладки. */
export async function chop(scene: StoreScene, w: Worker, gen: number, k: KitchenView, dishes: DishId[]): Promise<void> {
  const knife = k.knife;
  if (!knife.active) return;
  const base = knife.getData('y') as number;
  const colors = dishes.flatMap((id) => Object.keys(DISHES[id].needs).map((p) => PRODUCTS[p as ProductId].color));
  for (let i = 0; i < 5 * dishes.length && scene.alive(gen); i++) {
    scene.tweens.add({ targets: knife, y: base - 1.5, duration: 80, yoyo: true, ease: 'Quad.easeOut', onComplete: () => void (knife.active && knife.setY(base)) });
    if (i % 2 === 0) {
      sound.place('bump', i % 4, knife.x);
      motion.squash(scene, w.sprite, 1.03, 0.97, 90);
    }
    if (!scene.lite) {
      const bit = scene.add.rectangle(knife.x - 2 + Math.random() * 3, knife.y, 1, 1, colors[i % colors.length]).setDepth(knife.depth + 1);
      scene.tweens.add({ targets: bit, y: bit.y - 2.5, x: bit.x + Phaser.Math.FloatBetween(-2, 2), alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
    }
    await staff.workerWait(scene, w, 240);
  }
}
