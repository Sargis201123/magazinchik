// Хозяин и сотрудники за работой: дела хозяина (раскладка товара, уборка мусора) и возврат к кассе,
// сменщик и кассиры у касс, уборщица (мусор, лужи, туалет, затёртый пол), грузчик со склада, управляющий;
// новенький в первый день, мокрый пол и подскользнувшиеся, гниющий мусор. Кто нанят — game/economy.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import {
  canPlace,
  PRODUCTS,
  staffOf,
  isAbsent,
  managerBoost,
  SHELF_KINDS,
  workSpeed,
  moveToShelf,
  PRODUCT_IDS,
  shelfFree,
  cashierScan,
  type StaffRole,
} from '../game/economy';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { carryOf, withUpgrades } from '../game/upgrades';
import { playDayOne } from '../game/onboarding';
import { slotSide, standFor } from './placement';
import type { Point } from './layout';
import { Halo } from './halo';
import { addStep, encodeWear, mopWear, MOP_RADIUS, settleWear, WEAR_CELL, wornSpot } from '../game/wear';
import { binSmell, ROTS, rotStage, smellLevel, type RotStage } from '../game/rot';
import { TRASH_KEYS } from './textures';
import { carryBonus } from '../game/owner';
import { managerPick, URGENT_QTYS } from '../game/urgent';
import { binCapacity, gearTier, warehouseSpeed } from '../game/gear';
import { registerOfRole, RELIEF_ROLE, TILL_ROLES } from '../game/registers';
import { note } from '../game/reviews';
import {
  ART,
  FACADE_H,
  SELLER_SPEED,
  CALL_EVERY_MS,
  MAX_TRASH,
  MOP_MS,
  BIN_DROP_MS,
  MAX_RESTOCK_TRIPS,
  SPILL_TINTS,
  SPILL_MOP_MS,
  TOILET_CLEAN_MS,
  TRASH_CLEAN_MS,
  PICKUP_MS,
  PLACE_MS,
  POLISH_EVERY_MS,
  POLISH_MIN_WEAR,
  HAIR_COLORS,
  randomLook,
  STAFF_ACC,
  UNIFORMS,
  STAFF_SPEED,
  STAFF_HAIR,
  type TrashKind,
  type Worker,
  staffKey,
  type ChoreStep,
  ROT_TIP,
} from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as deliveries from './deliveries';
import * as food from './food';

// ---------- Продавец: уборка и выкладка ----------

/** Продавец уходит от кассы по шагам и возвращается. Пока его нет, касса пустует. */
export async function doChore(scene: StoreScene, steps: ChoreStep[]): Promise<void> {
  if (scene.sellerBusy || scene.ownerScanning()) return;
  const id = ++scene.choreId;
  scene.sellerBusy = true;
  haptic.tap();
  for (const step of steps) {
    await scene.walk(scene.seller, step.x, step.y, SELLER_SPEED);
    if (id !== scene.choreId) return;
    step.arrive?.();
    if (step.ms) await scene.wait(step.ms);
    if (id !== scene.choreId) return;
    step.action?.();
  }
  await returnSeller(scene);
}

/** Продавца позвали к кассе: бросает дело на полпути и идёт обратно. Несённый товар остаётся на складе. */
export function recallSeller(scene: StoreScene): void {
  if (!scene.sellerBusy) return;
  dropChore(scene);
  haptic.tap();
  void returnSeller(scene);
}

/** Хозяин бросает дело на полпути (позвали к кассе, взяли в заложники): дальше оно не идёт. */
export function dropChore(scene: StoreScene): void {
  scene.choreId++;
  stopMop(scene, scene.seller);
  scene.tweens.killTweensOf(scene.carried);
  scene.carried.setVisible(false).setTexture('box').setPosition(0, 3);
  // Несли мусор — роняем обратно; несли мешок — он «возвращается» в ведро.
  if (scene.carryingTrash) dropTrash(scene, scene.seller.x, scene.seller.y - 6);
  scene.carryingTrash = false;
  if (scene.binBy === 'seller') {
    scene.binFill = Math.min(binCapacity(scene.state), scene.binFill + scene.bagCarried);
    scene.bagCarried = 0;
    scene.binBusy = false;
    scene.binBy = null;
    scene.refreshBin();
  }
}

export async function returnSeller(scene: StoreScene): Promise<void> {
  const id = scene.choreId;
  const home = ownerHome(scene);
  // С улицы — через дверь, а не сквозь стену.
  if (scene.seller.y > scene.layout.h - 2) {
    await scene.walkVia(
      scene.seller,
      [
        { x: scene.layout.door.x, y: scene.layout.h + FACADE_H + 6 },
        { x: scene.layout.door.x, y: scene.layout.door.y - 8 },
      ],
      SELLER_SPEED,
    );
    if (id !== scene.choreId) return;
  }
  // После дела — всегда к своей кассе, даже если наняты кассиры: первая касса — его.
  await scene.walk(scene.seller, home.x, home.y, SELLER_SPEED);
  if (id === scene.choreId) scene.sellerBusy = false;
}

/** Где стоит хозяин (игрок): за первой кассой, а когда за ней сменщик — рядом, у той же стойки. */
export function ownerHome(scene: StoreScene): { x: number; y: number } {
  if (reliefOnDuty(scene)) return reliefSpot(scene);
  return scene.registers[0]?.clerk ?? scene.layout.sellerHome;
}

/** Сменщик нанят и сегодня на смене: тогда касса хозяина — его на весь день. */
export function reliefOnDuty(scene: StoreScene): boolean {
  const m = staffOf(scene.state, RELIEF_ROLE);
  return Boolean(m && !isAbsent(scene.state, m));
}

/** Место рядом с кассой хозяина, у той же стойки: тут стоит хозяин, когда за его кассой сменщик. */
export function reliefSpot(scene: StoreScene): { x: number; y: number } {
  const { sellerHome } = scene.layout;
  return { x: sellerHome.x, y: sellerHome.y - 24 };
}

export function callSellerIfNeeded(scene: StoreScene): void {
  const r = scene.ownerRegister();
  const front = r?.customer;
  if (!r || !front || !scene.atSpot(r)) return;
  // Зовём, если хозяин занят делом или стоит не у этой кассы.
  if (!scene.sellerBusy && Phaser.Math.Distance.Between(scene.seller.x, scene.seller.y, r.clerk.x, r.clerk.y) <= 2) return;
  if (scene.time.now - scene.lastCall < CALL_EVERY_MS) return;
  scene.lastCall = scene.time.now;
  scene.popup(front.sprite.x, front.sprite.y - 22, t('popup.callRegister'), '#fff3b0');
}

/** Касание полки: продавец идёт на склад, берёт коробку подходящего товара и раскладывает. */
export function restockShelf(scene: StoreScene, index: number): void {
  if (!scene.running || scene.sellerBusy) return;
  const shelf = scene.state.shelves[index];
  const slot = scene.spotOf(index);
  if (shelf.broken) {
    scene.popup(slot.x, slot.y - 18, t('popup.broken'), '#ffd0d0');
    return;
  }
  if (shelfFree(shelf) === 0) {
    scene.popup(slot.x, slot.y - 18, t('popup.shelfFull'), '#fff3b0');
    return;
  }
  const available = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (scene.state.warehouse[id] ?? []).some((u) => !u.pending));
  if (!available) {
    scene.popup(slot.x, slot.y - 18, t('popup.warehouseEmpty'), '#ffd0d0');
    return;
  }
  // Одно касание — полка заполняется целиком: продавец ходит на склад, пока есть место и товар.
  const stock = PRODUCT_IDS.reduce((sum, id) => sum + (canPlace(id, shelf) ? (scene.state.warehouse[id] ?? []).filter((u) => !u.pending).length : 0), 0);
  const trips = Math.max(1, Math.ceil(Math.min(shelfFree(shelf), stock) / (carryOf(scene.state) + carryBonus(scene.state))));
  const { doorway, pickup } = scene.layout.warehouse;
  // К ларю на улице — через дверь и обратно.
  const route = scene.routeTo(index);
  const stand = route[route.length - 1];
  const back = route.slice(0, -1).reverse();
  const trip: ChoreStep[] = [
    { ...doorway },
    { ...pickup, ms: PICKUP_MS, action: () => scene.carried.setTexture('box').setPosition(0, 3).setVisible(true) },
    { ...doorway },
    ...route.slice(0, -1).map((p) => ({ ...p })),
    {
      x: stand.x,
      y: stand.y - (shelf.kind === 'icebox' ? 0 : 2),
      ms: PLACE_MS,
      action: () => {
        scene.carried.setVisible(false);
        stockShelf(scene, index, scene.seller);
      },
    },
    ...back.map((p) => ({ ...p })),
  ];
  void doChore(scene, Array.from({ length: Math.min(trips, MAX_RESTOCK_TRIPS) }, () => trip).flat());
  // Шаг обучения «Разложи товар»: полку нажали — хозяин уже несёт коробку.
  scene.passTut('restock');
  // Новичок разложил полку сам (до этого в первый день её раскладывала бабушка).
  if (playDayOne(scene.state)) scene.onbStep('stock');
}

/** Товар из коробки на полку: штуки вылетают по одной и встают на место с «чпок». */
export function stockShelf(scene: StoreScene, index: number, by: Phaser.GameObjects.Container): void {
  const view = scene.shelfViews[index];
  const before = view ? view.items.filter((img) => img.visible).length : 0;
  // Хозяин-силач носит больше (навык «Силач»), сотрудники — как обычно.
  scene.state = moveToShelf(scene.state, index, undefined, carryOf(scene.state) + (by === scene.seller ? carryBonus(scene.state) : 0)).state;
  // Без съезда: новые штуки сами летят на свои места, а сдвинутые соседи просто встают рядом.
  scene.refreshShelves(false);
  scene.refreshWarehouse();
  const items = scene.shelfViews[index]?.items ?? [];
  const backs = scene.shelfViews[index]?.backItems ?? [];
  const kind = scene.state.shelves[index]?.kind;
  const fresh = items.filter((img, n) => img.visible && n >= before);
  // Задний ряд проявляется, когда штука долетела до полки.
  backs.forEach((back, n) => n >= before && back.visible && back.setAlpha(0));
  scene.time.delayedCall(fresh.length * 90 + 300, () => backs.forEach((back) => back.active && back.alpha < 1 && scene.tweens.add({ targets: back, alpha: 1, duration: 200 })));
  fresh.forEach((img, n) => {
    const { x, y } = img;
    const scale = img.scaleX;
    const from = { x: by.x, y: by.y - 4 };
    // Пока летит, место ведёт полёт: если в это время с полки возьмут товар, эта штука не съезжает.
    img.setPosition(from.x, from.y).setScale(scale * 0.6).setAlpha(0).setData('flying', true);
    // Летит дугой вверх из рук на своё место и подпрыгивает.
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: n * 90,
      duration: 280,
      onStart: () => {
        img.setAlpha(1);
        // Звук материала отдела (бутылки звенят, хлеб ложится мягко…), через штуку — без «пулемёта».
        if (n % 2 === 0 && kind) sound.shelf(kind, n, x);
      },
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        img.setPosition(from.x + (x - from.x) * k, from.y + (y - from.y) * k - Math.sin(k * Math.PI) * 10);
        img.setScale(scale * (0.6 + 0.4 * k));
      },
      onComplete: () => {
        img.setPosition(x, y).setData('flying', false);
        scene.tweens.add({ targets: img, scale: { from: scale * 1.35, to: scale }, duration: 140, ease: 'Back.easeOut' });
        // Свежий товар поблёскивает; из коробки сыплется пыль.
        if (n === fresh.length - 1) {
          freshShine(scene, index);
          const shelfView = scene.shelfViews[index];
          if (shelfView) scene.time.delayedCall(60, () => motion.hopShelf(scene, shelfView, 2.5));
        }
      },
    });
  });
}

export function freshShine(scene: StoreScene, index: number): void {
  const view = scene.shelfViews[index];
  if (!view) return;
  const { x, y } = view.at;
  for (let i = 0; i < 3; i++) {
    const spark = scene.art(x + Phaser.Math.Between(-15, 15), y - Phaser.Math.Between(2, 12), 'spark').setScale(0.4 / ART).setDepth(y + 5);
    scene.tweens.add({ targets: spark, scale: 1 / ART, angle: 90, alpha: 0, delay: i * 120, duration: 450, onComplete: () => spark.destroy() });
  }
  for (let i = 0; i < 3; i++) food.steamPuff(scene, x + Phaser.Math.Between(-10, 10), y + 12, 0xc8b8a0);
}

export function cleanToilet(scene: StoreScene): void {
  if (scene.toiletDirt === 0) return;
  void doChore(scene, [
    {
      x: scene.layout.wc.x,
      y: scene.layout.wc.spotY,
      ms: TOILET_CLEAN_MS,
      action: () => {
        scene.toiletDirt = 0;
        scene.refreshToilet();
        effects.bubbles(scene, scene.layout.wc.x, scene.layout.wc.y);
        effects.cleanSparkle(scene, scene.layout.wc.x, scene.layout.wc.spotY - 4, 20);
      },
    },
  ]);
}

/**
 * Мусор на полу. trash — фантики и стаканчики: подобрать и отнести в ведро;
 * mud — грязные следы с улицы и spill — пролитое: их моют шваброй, это дольше.
 */
export function dropTrash(scene: StoreScene, x: number, y: number, kind: TrashKind = 'trash'): Phaser.GameObjects.Image | undefined {
  if (scene.trash.size >= MAX_TRASH) return undefined;
  // Чаще всего — бумажка, остальное вразнобой (art/litter.py).
  const key = kind === 'trash' ? Phaser.Utils.Array.GetRandom(['trash', ...TRASH_KEYS]) : kind;
  const area =
    kind === 'mud' ? new Phaser.Geom.Rectangle(-2, -2, 30, 26) : kind === 'spill' ? new Phaser.Geom.Rectangle(-2, -4, 32, 20) : new Phaser.Geom.Rectangle(-5, -5, 16, 15);
  const piece = scene
    .art(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(4, 8), key)
    .setDepth(kind === 'trash' ? 1 : 0.5)
    .setInteractive(area, Phaser.Geom.Rectangle.Contains);
  piece.setData('kind', kind);
  // Сколько секунд лежит на полу и стадия гниения (rot.ts), base — картинка без «_rot».
  piece.setData('age', 0).setData('rot', 0).setData('base', key);
  piece.setData('glow', new Halo(scene, piece, 0xffffff));
  piece.on('pointerup', () => {
    if (scene.dragged || scene.claimedTrash.has(piece) || scene.sellerBusy || scene.ownerScanning()) return;
    if (kind === 'trash' && scene.binFull()) {
      // Ведро полное — сначала вынести.
      scene.popup(scene.binSpot().x, scene.binSpot().y - 18, t('popup.binFull'), '#ffd0d0');
      sound.bad();
      return;
    }
    scene.claimedTrash.add(piece);
    if (kind === 'trash') {
      const stand = scene.binStand();
      void doChore(scene, [
        {
          x: piece.x + 6,
          y: piece.y,
          ms: TRASH_CLEAN_MS,
          action: () => {
            scene.carried.setTexture(piece.texture.key).setPosition(5, 0).setVisible(true);
            scene.carryingTrash = true;
            removeTrash(scene, piece);
          },
        },
        {
          ...stand,
          ms: BIN_DROP_MS,
          action: () => {
            scene.carryingTrash = false;
            scene.carried.setVisible(false).setTexture('box').setPosition(0, 3);
            scene.putInBin();
          },
        },
      ]);
      return;
    }
    // Продавец берёт швабру и трёт пол туда-сюда.
    scene.carried.setTexture('mop').setPosition(5, -1).setVisible(true);
    let scrub: Phaser.Tweens.Tween | undefined;
    const mopMs = kind === 'spill' ? SPILL_MOP_MS : MOP_MS;
    void doChore(scene, [
      {
        x: piece.x + 7,
        y: piece.y,
        action: () => {
          scrub = scene.tweens.add({ targets: scene.carried, x: 1, duration: 160, yoyo: true, repeat: -1 });
          mopSound(scene, scene.seller, piece.x, mopMs);
        },
      },
      {
        x: piece.x + 7,
        y: piece.y,
        ms: mopMs,
        action: () => {
          scrub?.remove();
          stopMop(scene, scene.seller);
          scene.carried.setVisible(false).setTexture('box').setPosition(0, 3);
          if (kind === 'spill') wetSign(scene, piece.x, piece.y);
          effects.cleanSparkle(scene, piece.x, piece.y, 16);
          removeTrash(scene, piece);
        },
      },
    ]);
  });
  scene.trash.add(piece);
  return piece;
}

/** После мытья — табличка «Мокрый пол» и влажный блеск, пока пол сохнет. */
export function wetSign(scene: StoreScene, x: number, y: number): void {
  const sheen = scene.add.ellipse(x, y + 1, 18, 7, 0xc8f0ff, 0.35).setDepth(0.55);
  scene.wetSheens.add(sheen);
  sheen.once('destroy', () => scene.wetSheens.delete(sheen));
  const sign = scene.art(x + 7, y - 5, 'wet_sign').setDepth(y + 3);
  scene.time.delayedCall(7000, () => {
    if (!sign.active) return;
    scene.tweens.add({ targets: [sign, sheen], alpha: 0, duration: 600, onComplete: () => [sign, sheen].forEach((o) => o.destroy()) });
  });
}

/** Покупатель уронил покупку: лужа и опрокинутый пакет. По луже скользко. */
export function spill(scene: StoreScene, x: number, y: number): void {
  const piece = dropTrash(scene, x, y, 'spill');
  if (!piece) return;
  piece.setTint(Phaser.Utils.Array.GetRandom(SPILL_TINTS));
  const pack = scene.art(piece.x + 9, piece.y - 3, 'spill_pack').setAngle(70).setDepth(0.6);
  piece.once('destroy', () => pack.destroy());
  sound.bad();
  scene.popup(x, y - 16, t('popup.spill'), '#ffd0d0');
}

/** Протёк холодильник: лужа перед ним (её моют, как пролитое). */
export function fridgeLeaks(scene: StoreScene): void {
  const fridges = scene.state.shelves.map((s, i) => ({ s, i })).filter(({ s }) => SHELF_KINDS[s.kind].fridge && !SHELF_KINDS[s.kind].fixture);
  if (!fridges.length) return;
  const slot = scene.spotOf(Phaser.Utils.Array.GetRandom(fridges).i);
  const front = standFor(scene.layout, slot);
  const piece = dropTrash(scene, front.x + Phaser.Math.Between(-6, 6), front.y + 2, 'spill');
  if (!piece) return;
  piece.setTint(0xc8f0ff);
  sound.bad();
  scene.popup(slot.x, slot.y + 8, t('popup.leak'), '#ffd0d0');
}

/** Наступил в лужу — чуть не упал: настроение испорчено. */
export function checkSlips(scene: StoreScene): void {
  const spills = [...scene.trash].filter((piece) => piece.getData('kind') === 'spill');
  if (!spills.length) return;
  for (const c of scene.customers) {
    if (c.slipped || c.gone || c.thief) continue;
    const feetY = c.sprite.y + 8;
    if (!spills.some((sp) => Math.abs(sp.x - c.sprite.x) < 7 && Math.abs(sp.y - feetY) < 4)) continue;
    c.slipped = true;
    c.unhappy = true;
    note(scene.stats, 'slip');
    scene.tweens.add({ targets: c.sprite, angle: { from: -14, to: 12 }, duration: 110, yoyo: true, repeat: 1, onComplete: () => c.sprite.setAngle(0) });
    effects.emote(scene, c.sprite, 'emo_angry');
    scene.popup(c.sprite.x, c.sprite.y - 18, t('popup.slip'), '#ffd0d0');
  }
}

/**
 * Мусор на полу стареет и гниёт (rot.ts): темнеет, над ним мухи и вонь. Переполненное ведро,
 * которое долго не выносят, тоже пахнет. В первый раз — всплывашка над гнилым мусором.
 */
export function updateRot(scene: StoreScene, dt: number): void {
  for (const piece of scene.trash) {
    if (!(ROTS as readonly string[]).includes(piece.getData('kind') as string)) continue;
    const age = ((piece.getData('age') as number) ?? 0) + dt;
    piece.setData('age', age);
    const stage = rotStage(age);
    if (stage <= ((piece.getData('rot') as RotStage) ?? 0)) continue;
    piece.setData('rot', stage);
    scene.rotting.apply(piece, stage, piece.y);
    if (stage === 1 && !scene.state.seenTips?.includes(ROT_TIP) && !scene.rotWarned) {
      scene.rotWarned = true;
      sound.bad();
      scene.popup(piece.x, piece.y - 14, t('popup.rotFirst'), '#d8f0a0');
    }
  }
  scene.binFullFor = scene.binFull() && !scene.binBusy ? scene.binFullFor + dt : 0;
  const bin = binSmell(scene.binFullFor) && scene.binImg?.active ? scene.binSpot() : null;
  scene.rotting.bin(bin && { x: bin.x, y: bin.y - 12 }, (bin?.y ?? 0) + 31);
  // Чем дольше стоит полное, тем гуще вонь над ним.
  scene.binStink?.setScale((binSmell(scene.binFullFor) === 2 ? 1.35 : 1) / ART);
  scene.rotting.tick(scene.time.now);
}

/** Сколько пахнет в зале: гнилой мусор и давно полное ведро (rot.ts). */
export function smell(scene: StoreScene): number {
  return smellLevel([...scene.trash].map((piece) => (piece.getData('age') as number) ?? 0), scene.binFullFor);
}

export function removeTrash(scene: StoreScene, piece: Phaser.GameObjects.Image): void {
  if (scene.trash.has(piece)) scene.stats.trashCleaned++;
  // Убрали первый гнилой мусор — подсказка про запах больше не нужна.
  if (piece.getData('rot') && !scene.state.seenTips?.includes(ROT_TIP)) scene.state = { ...scene.state, seenTips: [...(scene.state.seenTips ?? []), ROT_TIP] };
  scene.trash.delete(piece);
  scene.claimedTrash.delete(piece);
  if (piece.getData('kind') === 'trash') effects.puff(scene, piece.x, piece.y);
  else {
    effects.bubbles(scene, piece.x, piece.y);
    // Мыли шваброй — заодно стёрли и потёртость пола вокруг.
    polishFloor(scene, piece.x, piece.y);
  }
  piece.destroy();
}

/**
 * Шаги для потёртости пола (game/wear.ts): кто сейчас идёт по залу — в клетку под его ногами.
 * Смотрим по таймеру времени игры, а не каждый кадр: на ×2 таймер тикает вдвое чаще вместе с игрой.
 */
export function sampleSteps(scene: StoreScene): void {
  const wear = scene.wear;
  if (!wear || wear.level !== scene.state.level) return;
  const { w, h, wallH } = scene.layout;
  for (const person of scene.people) {
    if (!person.active || !person.visible || !person.getData('walking') || person.displayList !== scene.children) continue;
    const feet = person.y + 8 * person.scaleY;
    if (person.x <= 0 || person.x >= w || feet <= wallH || feet >= h) continue;
    addStep(wear.steps, wear.grid, person.x, feet - wallH);
  }
}

/** Конец дня: шаги дня — в потёртость пола; с уборщиком и решёткой у входа пол стирается медленнее. */
export function settleFloorWear(scene: StoreScene): void {
  const wear = scene.wear;
  if (!wear || wear.level !== scene.state.level) return;
  wear.cells = settleWear(wear.cells, wear.steps, wear.grid, { cleaner: scene.workers.has('cleaner'), entrance: gearTier(scene.state, 'entrance') });
  wear.steps.fill(0);
  scene.state = { ...scene.state, floorWear: encodeWear(wear.cells, wear.level, wear.grid) };
  scene.floor.setWear(scene.wearLayer());
}

/** Помыли пол в точке (x, y) зала: потёртость вокруг уходит — в сохранении и на картинке пола (только там). */
export function polishFloor(scene: StoreScene, x: number, y: number): void {
  const wear = scene.wear;
  const { wallH } = scene.layout;
  if (!wear || wear.level !== scene.state.level || !mopWear(wear.cells, wear.grid, x, y - wallH)) return;
  scene.state = { ...scene.state, floorWear: encodeWear(wear.cells, wear.level, wear.grid) };
  const r = MOP_RADIUS + WEAR_CELL;
  scene.floor.setWear(scene.wearLayer(), { x: x - r, y: y - r, w: 2 * r, h: 2 * r });
}

// ---------- Сотрудники ----------

/** Расставляет нанятых сотрудников по местам и запускает их работу. */
export function syncStaff(scene: StoreScene): void {
  const gen = ++scene.staffGen;
  // Повара переставляют посреди варки — сваренное не пропадает, а встаёт в витрину.
  food.flushCooking(scene);
  for (const w of scene.workers.values()) {
    stopMop(scene, w.sprite);
    scene.haltWalk(w.sprite);
    scene.tweens.killTweensOf(w.sprite);
    w.sprite.destroy();
  }
  scene.workers.clear();
  scene.newcomers.clear();
  scene.reliefReady = false;
  scene.managerOnFloor = false;
  scene.claimedTrash.clear();
  if (scene.binBy === 'cleaner') {
    scene.binFill = Math.min(binCapacity(scene.state), scene.binFill + scene.bagCarried);
    scene.bagCarried = 0;
    scene.binBusy = false;
    scene.binBy = null;
    scene.refreshBin();
  }
  // Кассир не вышел, а менеджер на месте — менеджер встаёт за его кассу. Сменщика не подменяет:
  // за первой кассой и так хозяин, а у менеджера свои дела.
  const manager = scene.state.staff.find((m) => m.role === 'manager' && !isAbsent(scene.state, m));
  const cover = manager
    ? TILL_ROLES.slice(0, scene.registers.length - 1).find((role) => {
        const m = staffOf(scene.state, role);
        return m && isAbsent(scene.state, m);
      })
    : undefined;
  for (const member of scene.state.staff) {
    if (isAbsent(scene.state, member)) continue;
    const covering = member.role === 'manager' && cover ? cover : undefined;
    const home = covering ? workerHome(scene, covering) : workerHome(scene, member.role);
    // Новенький в первый день не стоит сразу на месте, а входит с улицы.
    const fresh = scene.dayOpen && scene.newHires.has(staffKey(member));
    const at = fresh ? scene.streetSpawn() : home;
    const sprite = scene.makePerson(at.x ?? home.x, at.y ?? home.y, {
      ...randomLook(UNIFORMS[member.role]),
      style: STAFF_HAIR[member.role],
      acc: STAFF_ACC[member.role].acc,
      accTint: STAFF_ACC[member.role].tint,
      // У охранника форменная кепка, у пекаря — белый колпак.
      hair: member.role === 'guard' ? UNIFORMS.guard : member.role === 'baker' ? 0xffffff : Phaser.Utils.Array.GetRandom(HAIR_COLORS),
      // Повар — в поварском колпаке и белом кителе.
      ...(member.role === 'cook' ? { hat: 'toque' as const, outfit: 'chefcoat' as const } : {}),
    });
    const carried = scene.art(0, 3, 'box').setVisible(false);
    sprite.add(carried);
    const worker: Worker = { member, sprite, carried, home };
    scene.workers.set(member.role, worker);
    if (covering) {
      scene.workers.set(covering, worker);
      const serve = () => void cashierLoop(scene, worker, gen, registerOfRole(covering));
      if (fresh) void walkIn(scene, worker, gen).then(serve);
      else serve();
      continue;
    }
    const loop = {
      cashier: reliefLoop,
      cashier2: cashierLoop,
      cashier3: cashierLoop,
      cashier4: cashierLoop,
      cashier5: cashierLoop,
      cleaner: cleanerLoop,
      loader: loaderLoop,
      guard: null,
      manager: managerLoop,
      baker: food.bakerLoop,
      barista: food.baristaLoop,
      cook: food.cookLoop,
    }[member.role];
    const work = () => {
      if (loop) void loop(scene, worker, gen);
    };
    if (fresh) void walkIn(scene, worker, gen).then(work);
    else work();
  }
  // Новеньких встретили — в следующий раз они уже свои.
  if (scene.dayOpen) scene.newHires.clear();
  // Хозяин — за своей кассой (если не занят делом).
  const home = ownerHome(scene);
  if (!scene.sellerBusy) scene.seller.setPosition(home.x, home.y).setDepth(home.y);
}

/**
 * Первый рабочий день: новенький идёт по тротуару к двери, на пороге радуется (сердечко) и проходит
 * на своё место — работать начинает, когда дошёл.
 */
export async function walkIn(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  const { door } = scene.layout;
  scene.newcomers.add(w.sprite);
  await workerWalk(scene, w, door.x, scene.streetY);
  await workerWalk(scene, w, door.x, door.y - 10);
  scene.newcomers.delete(w.sprite);
  if (!scene.alive(gen)) return;
  effects.emote(scene, w.sprite, 'emo_heart');
  motion.squash(scene, w.sprite, 1.1, 0.9, 120);
  await workerWalk(scene, w, w.home.x, w.home.y);
}

export function workerHome(scene: StoreScene, role: StaffRole): { x: number; y: number } {
  const { wc, warehouse, door } = scene.layout;
  switch (role) {
    case 'cashier':
      // Сменщик — за кассой хозяина (хозяин встаёт рядом, у той же стойки).
      return scene.registers[0]?.clerk ?? reliefSpot(scene);
    case 'cashier2':
    case 'cashier3':
    case 'cashier4':
    case 'cashier5':
      return scene.registers[registerOfRole(role)]?.clerk ?? reliefSpot(scene);
    case 'cleaner':
      return { x: wc.x - 18, y: wc.spotY + 8 };
    case 'loader':
      return { x: warehouse.doorway.x + 6, y: warehouse.doorway.y - 18 };
    case 'guard':
      return { x: door.x + 22, y: door.y - 14 };
    case 'manager':
      // Менеджер ходит у входа, где проход свободен.
      return { x: door.x - 24, y: door.y - 30 };
    case 'baker':
      return { x: scene.layout.bakery.x + 26, y: scene.layout.bakery.y + 36 };
    case 'barista':
      return { x: scene.layout.coffee.x + 26, y: scene.layout.coffee.y + 19 };
    case 'cook': {
      // Повар — у правого края стола (доска с ножом слева от него); кухни в помещении нет (так не бывает) — у входа.
      const k = scene.layout.kitchen;
      return k ? { x: k.x + 40, y: k.y + 33 } : { x: door.x - 24, y: door.y - 30 };
    }
  }
}

/** Шаг сотрудника с учётом его скорости. */
export function workerWalk(scene: StoreScene, w: Worker, x: number, y: number): Promise<void> {
  return scene.walk(w.sprite, x, y, STAFF_SPEED * workerPace(scene, w));
}

/** Сотрудник идёт через несколько точек одним ходом (дверь склада, пекарни) — не встаёт в каждой. */
export function workerWalkVia(scene: StoreScene, w: Worker, points: Point[]): Promise<void> {
  return scene.walkVia(w.sprite, points, STAFF_SPEED * workerPace(scene, w));
}

export function workerWait(scene: StoreScene, w: Worker, ms: number): Promise<void> {
  return scene.wait(ms / workerPace(scene, w));
}

/** Скорость сотрудника: его навык, менеджер на смене, а у грузчика — ещё и оборудование склада. */
export function workerPace(scene: StoreScene, w: Worker): number {
  return workSpeed(w.member) * managerBoost(scene.state) * (w.member.role === 'loader' ? warehouseSpeed(scene.state) : 1);
}

/**
 * Швабра в руках у who трёт пол ms игрового времени. Звук идёт в настоящих секундах: на ×2 дело вдвое
 * короче (wait идёт по времени сцены), у шустрого уборщика — ещё в pace раз (как в workerWait).
 */
export function mopSound(scene: StoreScene, who: Phaser.GameObjects.Container, x: number, ms: number, pace = 1): void {
  stopMop(scene, who);
  scene.mops.set(who, sound.mop(x, ms / pace / scene.speed / 1000));
}

/** Швабра who стихает: дело закончили, бросили или его некому доделать; без who — все (зал перестроили). */
export function stopMop(scene: StoreScene, who?: Phaser.GameObjects.Container): void {
  for (const [owner, stop] of scene.mops) {
    if (who && owner !== who) continue;
    stop();
    scene.mops.delete(owner);
  }
}

/**
 * Менеджер обходит зал: заглядывает к полкам, а когда товар кончился и на полке, и на складе —
 * сам звонит и заказывает срочный подвоз (если хватает денег).
 */
export async function managerLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  scene.managerOnFloor = true;
  while (scene.alive(gen)) {
    if (!scene.running) {
      await scene.wait(400);
      continue;
    }
    // Заказ на дом: принятый — собирает и выносит к двери курьеру; звонит телефон — берёт трубку сам.
    const parcel = deliveries.nextParcel(scene);
    if (parcel) {
      await deliveries.packParcel(scene, w, gen, parcel);
      continue;
    }
    if (scene.call && scene.phone) {
      await workerWalk(scene, w, scene.phone.x - 10, scene.phone.y + 14);
      if (!scene.alive(gen)) return;
      if (scene.call) deliveries.acceptOrder(scene);
      continue;
    }
    const pick = managerPick(scene.state);
    if (pick && !scene.urgentOrders.some((o) => o.id === pick)) {
      const qty = URGENT_QTYS[0];
      if (deliveries.orderUrgentDelivery(scene, pick, qty, true)) scene.popup(w.sprite.x, w.sprite.y - 20, t('popup.managerOrder', { icon: PRODUCTS[pick].icon }), '#fff3b0');
    }
    const slot = Phaser.Utils.Array.GetRandom(scene.layout.slots.slice(0, Math.max(1, scene.state.shelves.length)));
    if (slot) {
      const stand = standFor(scene.layout, slot);
      await workerWalk(scene, w, stand.x + (slotSide(scene.layout, slot) ? 0 : Phaser.Math.Between(-12, 12)), stand.y);
    }
    await workerWait(scene, w, 2500);
  }
}

/**
 * Сменщик: весь день за кассой хозяина и пробивает сам всех, кто к ней подошёл. Хозяин свободен
 * для дел, а его касания кассы торопят пробивку (hurryRelief).
 */
export async function reliefLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  scene.reliefReady = true;
  // Хозяин, пока сменщик шёл, сам встал за кассу — уступает место и отходит к стойке.
  const clerk = scene.registers[0]?.clerk;
  if (clerk && !scene.sellerBusy && !scene.ownerScanning() && Phaser.Math.Distance.Between(scene.seller.x, scene.seller.y, clerk.x, clerk.y) <= 2) void returnSeller(scene);
  while (scene.alive(gen)) {
    const r = scene.registers[0];
    const front = r?.customer;
    if (!scene.running || !r || !front || !scene.atSpot(r) || front.serving || r.scan) {
      // Отводили в сторону (ограбление, новенький) — назад к стойке.
      if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await workerWalk(scene, w, w.home.x, w.home.y);
      await scene.wait(150);
      continue;
    }
    await scene.scanCustomer(r, front, withUpgrades(scene.state, cashierScan(w.member)), false);
  }
}

/** Кассир сам пробивает тех, кто подошёл к его кассе (второй кассир — ко второй). */
export async function cashierLoop(scene: StoreScene, w: Worker, gen: number, index = registerOfRole(w.member.role)): Promise<void> {
  while (scene.alive(gen)) {
    const r = scene.registers[index];
    const front = r?.customer;
    if (!scene.running || !r || !front || !scene.atSpot(r)) {
      await scene.wait(200);
      continue;
    }
    if (front.serving || r.scan) {
      await scene.wait(100);
      continue;
    }
    await scene.scanCustomer(r, front, withUpgrades(scene.state, cashierScan(w.member)), false);
  }
}

/** Уборщик подбирает мусор, а когда его нет — моет туалет. */
export async function cleanerLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  while (scene.alive(gen)) {
    // Ведро почти полное — сначала вынести.
    if (scene.running && scene.binFill >= binCapacity(scene.state) - 1 && !scene.binBusy) {
      scene.binBusy = true;
      scene.binBy = 'cleaner';
      for (const step of scene.takeOutSteps(
        () => {
          scene.bagFromBin();
          w.carried.setTexture('trash_bag').setVisible(true);
        },
        () => {
          w.carried.setVisible(false).setTexture('box');
          scene.bagToDumpster();
        },
      )) {
        await workerWalk(scene, w, step.x, step.y);
        if (!scene.alive(gen)) return;
        if (step.ms) await workerWait(scene, w, step.ms);
        // Пока завязывал мешок или бросал его в контейнер, состав мог смениться (syncStaff) — спрайта уже нет.
        if (!scene.alive(gen)) return;
        step.action?.();
      }
      continue;
    }
    const piece = scene.running ? nearestTrash(scene, w.sprite.x, w.sprite.y) : undefined;
    if (piece) {
      const kind = piece.getData('kind') as TrashKind;
      if (kind === 'trash' && scene.binFull()) {
        await scene.wait(300);
        continue;
      }
      scene.claimedTrash.add(piece);
      await workerWalk(scene, w, piece.x + 6, piece.y);
      if (!scene.alive(gen)) return;
      const ms = kind === 'trash' ? TRASH_CLEAN_MS : kind === 'spill' ? SPILL_MOP_MS : MOP_MS;
      if (kind !== 'trash') mopSound(scene, w.sprite, piece.x, ms, workerPace(scene, w));
      await workerWait(scene, w, ms);
      stopMop(scene, w.sprite);
      if (!scene.alive(gen)) return;
      if (!piece.active) continue;
      if (kind !== 'trash') {
        removeTrash(scene, piece);
        continue;
      }
      w.carried.setTexture(piece.texture.key).setVisible(true);
      removeTrash(scene, piece);
      const stand = scene.binStand();
      await workerWalk(scene, w, stand.x, stand.y);
      if (!scene.alive(gen)) return;
      await workerWait(scene, w, BIN_DROP_MS);
      if (!scene.alive(gen)) return;
      w.carried.setVisible(false).setTexture('box');
      scene.putInBin();
      continue;
    }
    if (scene.running && scene.toiletDirt >= 40) {
      await workerWalk(scene, w, scene.layout.wc.x, scene.layout.wc.spotY);
      if (!scene.alive(gen)) return;
      await workerWait(scene, w, TOILET_CLEAN_MS);
      if (!scene.alive(gen)) return;
      scene.toiletDirt = 0;
      scene.refreshToilet();
      effects.bubbles(scene, scene.layout.wc.x, scene.layout.wc.y);
      continue;
    }
    // Делать нечего — натирает шваброй самое потёртое место пола (не чаще раза в POLISH_EVERY_MS).
    const worn = scene.running && scene.time.now - scene.polishedAt > POLISH_EVERY_MS ? wornFloorSpot(scene) : null;
    if (worn) {
      scene.polishedAt = scene.time.now;
      await workerWalk(scene, w, worn.x + 6, worn.y);
      if (!scene.alive(gen)) return;
      mopSound(scene, w.sprite, worn.x, MOP_MS, workerPace(scene, w));
      await workerWait(scene, w, MOP_MS);
      stopMop(scene, w.sprite);
      if (!scene.alive(gen)) return;
      effects.bubbles(scene, worn.x, worn.y);
      polishFloor(scene, worn.x, worn.y);
      continue;
    }
    if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await workerWalk(scene, w, w.home.x, w.home.y);
    await scene.wait(300);
  }
}

/**
 * Самое потёртое место зала (точки мира), куда можно подойти со шваброй: не под мебелью. Потёрто
 * меньше POLISH_MIN_WEAR — натирать нечего (null).
 */
export function wornFloorSpot(scene: StoreScene): { x: number; y: number } | null {
  const wear = scene.wear;
  if (!wear || wear.level !== scene.state.level) return null;
  const { wallH } = scene.layout;
  const free = (x: number, y: number) => scene.obstacles.every((o) => x < o.x - 2 || x > o.x + o.w + 2 || y < o.y - 2 || y > o.y + o.h + 2);
  // Уборщик встаёт правее пятна (как у лужи): свободно должно быть и там, где он стоит.
  const spot = wornSpot(wear.cells, wear.grid, POLISH_MIN_WEAR, (x, y) => free(x, y + wallH) && free(x + 6, y + wallH));
  return spot && { x: spot.x, y: spot.y + wallH };
}

export function nearestTrash(scene: StoreScene, x: number, y: number): Phaser.GameObjects.Image | undefined {
  let best: Phaser.GameObjects.Image | undefined;
  let bestDist = Infinity;
  for (const piece of scene.trash) {
    if (scene.claimedTrash.has(piece)) continue;
    // Гнилое пахнет — его уборщик убирает в первую очередь.
    const d = Phaser.Math.Distance.Between(x, y, piece.x, piece.y) - 60 * ((piece.getData('rot') as number) ?? 0);
    if (d < bestDist) [best, bestDist] = [piece, d];
  }
  return best;
}

/** Грузчик носит товар со склада на полки, где он кончается. */
export async function loaderLoop(scene: StoreScene, w: Worker, gen: number): Promise<void> {
  while (scene.alive(gen)) {
    // Заказ на дом без менеджера в зале собирает грузчик: склад и так его.
    const parcel = scene.running && !scene.managerOnFloor ? deliveries.nextParcel(scene) : undefined;
    if (parcel) {
      await deliveries.packParcel(scene, w, gen, parcel);
      continue;
    }
    const index = scene.running ? shelfToRestock(scene) : -1;
    if (index < 0) {
      if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await workerWalk(scene, w, w.home.x, w.home.y);
      await scene.wait(400);
      continue;
    }
    const { doorway, pickup } = scene.layout.warehouse;
    const route = scene.routeTo(index);
    await workerWalkVia(scene, w, [doorway, pickup]);
    await workerWait(scene, w, PICKUP_MS);
    if (!scene.alive(gen)) return;
    w.carried.setVisible(true);
    await workerWalkVia(scene, w, [doorway, ...route]);
    await workerWait(scene, w, PLACE_MS);
    if (!scene.alive(gen)) return;
    w.carried.setVisible(false);
    stockShelf(scene, index, w.sprite);
    // От ларя на улице — обратно в зал через дверь.
    await workerWalkVia(scene, w, route.slice(0, -1).reverse());
  }
}

/** Полка, которую стоит пополнить: место есть, а на складе есть подходящий товар. */
/** Сначала полки со звёздочкой, потом те, где товар кончился, потом самые пустые. */
export function shelfToRestock(scene: StoreScene): number {
  let best = -1;
  let bestScore = 0;
  scene.state.shelves.forEach((shelf, i) => {
    if (shelf.broken) return;
    const free = shelfFree(shelf);
    const hasGoods = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (scene.state.warehouse[id] ?? []).some((u) => !u.pending));
    const runningOut = PRODUCT_IDS.some(
      (id) => canPlace(id, shelf) && (shelf.items[id]?.length ?? 0) === 0 && (scene.state.warehouse[id]?.length ?? 0) > 0,
    );
    if (!hasGoods || !(free >= 3 || (runningOut && free > 0))) return;
    const score = (runningOut ? 100 : 0) + free;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}
