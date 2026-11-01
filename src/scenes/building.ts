// Здание магазина и вещи зала: стены и фасад, кассы (пробивка, монитор, сканер), кассы самообслуживания,
// оборудование на виду (рохля, вентиляторы, камеры, завеса у входа), витрины «Акция», ведро и контейнер
// с выносом мусора, горка уценки, флигель с комнатами и дверью из зала, склад со стеллажами, туалет.
// Полки с товаром — shelves.ts, свет — lighting.ts, убранство — decorations.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { PRODUCT_IDS, HYPER_LEVEL, unitSalePrice, warehouseCapacity, type StoreState } from '../game/economy';
import { saveGame } from '../game/save';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import type { Rect } from './paths';
import { UI_FONT } from '../ui/dom';
import { weatherFor } from '../game/weather';
import { yearTime } from '../game/calendar';
import { hasUpgrade } from '../game/upgrades';
import { KIOSK_ERROR_SECONDS, KIOSK_PREFER, kioskCount, kioskTier } from '../game/lanes';
import { activeDecor, type DecorId } from '../game/decor';
import { kitchenOpen } from '../game/kitchen';
import { blockedZones, slotSide, overlapsRect, propFootprint, propRect, tillZones } from './placement';
import { kioskZones, REGISTER_ROW, registerSpot, unitsPerBox, WAREHOUSE_COLS, WING_OUTER, type Room } from './layout';
import { Halo, personGlow } from './halo';
import { BARGAIN_CHANCE, BARGAIN_PER_ROW, bargainCapacity, bargainCount, fillBargain, hasBargain, takeBargain } from '../game/bargain';
import { bargainRows, bargainSprite, binCapacity, binSprite, gearTier, type GearId, registerSprite } from '../game/gear';
import { registerSlots } from '../game/registers';
import { cleanHall } from '../game/firstday';
import {
  ART,
  FURNITURE_TOP,
  WALL,
  FACADE_H,
  ITEM_VARIANTS,
  KIOSK_GLOW,
  TOILET_DIRTY,
  type Customer,
  type Register,
  type ChoreStep,
  type Look,
} from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as lighting from './lighting';
import * as decorations from './decorations';
import * as food from './food';
import * as staff from './staff';
import * as shoppers from './shoppers';
import * as persons from './persons';
import * as liveFx from './liveFx';
import * as nightShift from './nightShift';
import * as camera from './camera';
import * as shelves from './shelves';

const OWNER: Look = { shirt: 0x8fd16a, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x4a2c1a, style: 'short' };
/** Наряды хозяина за звёзды (decor.ts, раздел «Наряд»). Должно совпадать с art/costumes.py. */
const COSTUMES: Partial<Record<DecorId, Partial<Look>>> = {
  outfit_farmer: { hat: 'straw', outfit: 'overalls', pants: 0x3b5a9a },
  outfit_retro: { hat: 'papercap', outfit: 'soda', face: 'mustache', pants: 0x262b44 },
  outfit_tuxedo: { hat: 'silkhat', outfit: 'tuxedo', face: 'monocle', back: 'tails', pants: 0x181425 },
  outfit_cyber: { hat: 'cyberhelmet', outfit: 'cyber', back: 'jetpack', pants: 0x262b44 },
  // Эксклюзив звёздного пропуска (pass.ts, art/season.py).
  outfit_s1: { hat: 'leafcap', outfit: 'trench', pants: 0x4f2c17 },
  outfit_s2: { hat: 'pompom', outfit: 'nordic', pants: 0x262b44 },
};

/**
 * Вид фасада по уровню магазина: ларёк в досках, кирпич, светлая плитка и стеклянный
 * супермаркет. У двух старших вместо навесиков над окнами — сплошной козырёк фирменного
 * цвета (у супермаркета — с подсветкой), главный навес над входом того же цвета.
 */
const FACADE_STYLES: { texture: string; awning?: number; canopy?: number; led?: boolean }[] = [
  { texture: 'facade_wood', awning: 0x8fd16a },
  { texture: 'facade' },
  { texture: 'facade', awning: 0xfee761 },
  { texture: 'facade_tile', canopy: 0x3e8948 },
  { texture: 'facade_glass', canopy: 0x262b44, led: true },
  // Гипермаркет: светлые колонны, тёмное стекло, красный козырёк с подсветкой.
  { texture: 'facade_hyper', canopy: 0xa22633, led: true },
];
/** Пол по уровням помещения. */
const FLOORS = ['floor', 'floor', 'floor2', 'floor2', 'floor3', 'floor3'];
const KIOSK_ALARM = 0xe43b44;
/** Полка «Уценка» (art/bargain_shelf.py, в точках мира): низ горки ниже точки места, высота цоколя и шаг рядов. */
const BARGAIN_BOTTOM = 8;
const BARGAIN_BASE = 6;
const BARGAIN_STEP = 4;
/** Завязать мешок и бросить его в контейнер на улице. */
const BAG_MS = 600;
const DUMP_MS = 450;
const ownerLook = (state: StoreState): Look => {
  const outfit = activeDecor(state, 'outfit');
  return { ...OWNER, ...(outfit ? COSTUMES[outfit.id] : {}) };
};

export function buildStore(scene: StoreScene): void {
  const { w, h, wallH, wc, counter, sellerHome } = scene.layout;
  // Пол богаче с каждым уровнем: тёплая плитка, прохладная плитка, мрамор.
  // Пол и цвет стен можно сменить в «Оформлении».
  const floor = activeDecor(scene.state, 'floor')?.texture ?? FLOORS[Math.min(scene.state.level, FLOORS.length - 1)];
  scene.add.tileSprite(0, wallH, w, h - wallH, floor).setOrigin(0).setTileScale(1 / ART);
  scene.glossyFloor = ['floor3', 'floor_gold', 'floor_noir'].includes(floor);
  scene.coldAir = yearTime(scene.state.day) === 'winter' || weatherFor(scene.state.day) === 'snow';
  lighting.floorLight(scene, w, h, wallH);
  // Стены: цветная краска за монеты или премиальная отделка (кирпич, плитка, обои) за звёзды.
  const wallDecor = activeDecor(scene.state, 'wall');
  scene.add
    .tileSprite(0, 0, w, wallH, wallDecor?.texture ?? 'wall')
    .setOrigin(0)
    .setTileScale(1 / ART)
    .setTint(wallDecor?.color ?? 0xffffff);
  buildShell(scene);
  // Вывеска с названием на крыше; премиальная — своя доска и цвет букв.
  const sign = activeDecor(scene.state, 'sign');
  const signColor = sign?.textColor ?? 0xfee761;
  // У гипермаркета своя вывеска — вдвое шире, буквы крупнее (премиальная доска из «Оформления» — главнее).
  const grand = !sign && scene.state.level >= HYPER_LEVEL;
  const signFont = grand ? '9px' : '7px';
  scene.art(w / 2, -9, sign?.texture ?? (grand ? 'sign_hyper' : 'sign')).setDepth(2);
  if (sign?.id === 'sign_marquee') {
    // Лампочки «Бродвея» перемигиваются.
    const lit = scene.art(w / 2, -9, 'sign_marquee_lit').setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: lit, alpha: { from: 1, to: 0.25 }, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped' });
  }
  if (sign?.id === 'sign_s2' && !scene.lite) {
    // «Северное сияние» медленно дышит.
    const lit = scene.art(w / 2, -9, 'sign_s2_lit').setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: lit, alpha: { from: 0.9, to: 0.2 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  scene.add
    .text(w / 2, -9, scene.shopTitle(), {
      fontFamily: UI_FONT,
      fontSize: signFont,
      color: `#${signColor.toString(16).padStart(6, '0')}`,
    })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(3);
  lighting.neonSign(scene, w / 2, -9, scene.shopTitle(), signFont, signColor, grand ? 92 : 64, true);
  if (!sign) nightShift.signLights(scene, w / 2, -9, grand ? 46 : 30);
  buildWing(scene);
  buildWarehouse(scene);
  decorations.buildDecor(scene);

  scene.wcDoor = scene.art(wc.x, wc.y, 'wc');
  // Над грязным туалетом поднимается запах.
  scene.wcStink = scene.art(wc.x, wc.y - 10, 'stink').setScale(1.4 / ART).setDepth(wc.y + 30).setVisible(false);
  scene.tweens.add({ targets: scene.wcStink, y: wc.y - 15, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });
  scene.art(wc.x, wc.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
  scene.wcBar = scene.art(wc.x - 7, wc.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
  scene.add
    .zone(wc.x, wc.y + 4, 24, 36)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => camera.tap(scene, () => staff.cleanToilet(scene)));

  scene.art(counter.x + 2, counter.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(counter.y + 19);
  const registerImg = scene.art(counter.x, counter.y + FURNITURE_TOP / 2, registerSprite(scene.state)).setDepth(counter.y + 20);
  buildShowcases(scene);
  buildBin(scene);
  buildBargain(scene);
  food.buildFood(scene);
  // Электрощиток на стене: нужен, когда отключат свет. Перестановка не даёт закрыть его полкой
  // (placement.ts), а если в старом сохранении полка уже стоит там — щиток висит левее, на открытой стене.
  scene.fuseBox = scene.art(fuseSpot(scene), 18, 'fusebox').setDepth(3);
  scene.fuseBox.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => liveFx.fixFuse(scene)));
  scene.fuseGlow = new Halo(scene, scene.fuseBox, 0xfee761);
  // Свет отключили — у щитка мигает аварийная лампочка: в тёмном зале видно, куда нажать. Мигает
  // ступеньками (ярко — тускло), а не плавно: карту перерисовывать дважды за мигание, а не каждый кадр.
  const fuse = scene.fuseBox;
  const emergency = scene.light.add('light_pool', fuse.x, fuse.y + 6, 34, 30, 0xffe08a, 0).attach(fuse);
  emergency.sync = () => emergency.set(scene.blackout ? (Math.floor(scene.time.now / 400) % 2 ? 0.8 : 0.35) : 0);
  scene.registers = [];
  scene.registers.push({ ...makeRegister(scene, counter, false, scene.layout.queue, scene.layout.sellerHome), img: registerImg });
  decorations.buildUpgrades(scene);
  void sellerHome;
  const home = staff.ownerHome(scene);
  scene.seller = persons.makePerson(scene, home.x, home.y, ownerLook(scene.state));
  // Кибер-продавец светится неоном.
  if (activeDecor(scene.state, 'outfit')?.id === 'outfit_cyber') personGlow(scene, scene.seller, 0x2ce8f5, 2);
  scene.carried = scene.art(0, 3, 'box').setVisible(false);
  scene.seller.add(scene.carried);
  scene.add
    .zone(counter.x + 6, counter.y + 6, 40, 64)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => camera.tap(scene, () => scene.serveNext()));
}

/**
 * Касса: полоска пробивки над столом, экран монитора и луч сканера. Вторая касса стоит
 * зеркально слева от очереди: её покупатель — второй в очереди, кассир — слева от стола.
 */
export function makeRegister(scene: StoreScene, counter: { x: number; y: number }, mirrored: boolean, spot: { x: number; y: number }, clerk: { x: number; y: number }): Register {
  const bar = scene.add.rectangle(counter.x - 9, counter.y - 31, 18, 4, 0x181425).setOrigin(0, 0.5).setDepth(1000).setVisible(false);
  const fill = scene.add.rectangle(counter.x - 8, counter.y - 31, 0, 2, 0x63c74d).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
  const sx = counter.x + (mirrored ? -0.5 : 0.5);
  const screen = scene.add.rectangle(sx, counter.y + 10.5, 6, 3, 0xb6f58a).setDepth(counter.y + 21).setVisible(false);
  // Экран кассы светит зеленоватым на прилавок и кассира: тлеет всегда, ярче — пока пробивает. Ровно, не по
  // мерцанию экрана (оно 7 раз в секунду, при заедании — каждый кадр): карту ради него не перерисовывать.
  const till = scene.light.add('glow', sx, counter.y + 9, 22, 16, 0xb6f58a).attach(screen);
  till.sync = () => till.set(lighting.powerOn(scene) * (screen.visible ? 0.5 : 0.2));
  const beam = scene.add
    .rectangle(sx, counter.y + 4.2, 8, 4.5, 0xff4a4a)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(counter.y + 21)
    .setVisible(false);
  return {
    counter,
    spot,
    clerk,
    customer: null,
    scan: null,
    bar,
    fill,
    screen,
    beam,
    hurry: 0,
  };
}

/**
 * Касса номер index (с 1): нечётные — зеркально слева от очереди, чётные — справа;
 * каждая следующая пара — выше по залу. Покупатель встаёт в колонку очереди рядом со столом.
 */
export function buildRegister(scene: StoreScene, index: number): void {
  const { queue } = scene.layout;
  const { left, ...at } = registerSpot(scene.layout, index);
  const row = Math.floor(index / 2);
  const shadowX = left ? at.x - 2 : at.x + 2;
  scene.art(shadowX, at.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(at.y + 19);
  const img = scene.art(at.x, at.y + FURNITURE_TOP / 2, registerSprite(scene.state)).setFlipX(left).setDepth(at.y + 20);
  if (hasUpgrade(scene.state, 'terminal')) scene.art(at.x + (left ? -3 : 3), at.y - 4, 'card_terminal').setDepth(at.y + 22);
  scene.obstacles.push({ x: at.x - 13, y: at.y - 30, w: 26, h: 54 });
  const spot = { x: queue.x, y: queue.y - REGISTER_ROW * row - (left ? queue.step : 0) };
  const clerk = { x: at.x + (left ? -16 : 16), y: at.y + 16 };
  scene.registers.push({ ...makeRegister(scene, at, left, spot, clerk), img });
  scene.add
    .zone(at.x + (left ? -6 : 6), at.y + 6, 40, 64)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => camera.tap(scene, () => scene.serveNext(index)));
}

/**
 * Оборудование, которое видно в зале: рохля, погрузчик или автосклад на складе, вентиляторы
 * или кондиционер на стене, камеры под потолком, решётка и тепловая завеса у входа,
 * экран на фасаде и датчик у туалета.
 */
export function buildGearProps(scene: StoreScene): void {
  const { w, h, door, warehouse, wc } = scene.layout;
  const tier = (id: GearId) => gearTier(scene.state, id);
  const store = tier('warehouse');
  if (store === 3) scene.art(warehouse.x + warehouse.w - 13, warehouse.y + 12, 'autostore').setDepth(warehouse.y + 60);
  else if (store) scene.art(warehouse.x + 11, h - 11, store === 1 ? 'pallet_jack' : 'forklift').setDepth(h - 4);
  const climate = tier('climate');
  // На стене между постером, часами и окном (они висят через 32 от x = 30) — свободные места.
  if (climate === 1) {
    for (const x of [46, 78].filter((fx) => !shelves.behindShelf(scene, fx))) {
      scene.art(x, 10, 'fan_base').setDepth(4);
      const blades = scene.art(x, 10, 'fan_blades').setDepth(5);
      scene.tweens.add({ targets: blades, angle: 360, duration: 700, repeat: -1 });
    }
  } else if (climate === 2) {
    // Кондиционер — между картинами и окнами, на куске стены, не закрытом полкой.
    const acX = [126, 190].find((x) => x < wc.x - 16 && !shelves.behindShelf(scene, x, 10));
    const ac = acX === undefined ? null : scene.art(acX, 7, 'ac_wall').setDepth(4);
    // Струйки холодного воздуха из кондиционера.
    for (let i = 0; ac && i < 3; i++) {
      const puff = scene.add.rectangle(ac.x - 8 + i * 8, ac.y + 6, 1, 3, 0xc8f0ff, 0.6).setDepth(5);
      scene.tweens.add({ targets: puff, y: ac.y + 14, alpha: 0, duration: 1100, delay: i * 300, repeat: -1 });
    }
  }
  const cams = tier('cameras');
  const camSpots = cams === 2 ? [{ x: w - 5, y: 3, flip: true }, { x: 5, y: 3, flip: false }, { x: w / 2, y: 3, flip: false }] : cams === 1 ? [{ x: w - 5, y: 3, flip: true }] : [];
  for (const spot of camSpots) {
    scene.art(spot.x, spot.y, 'cam').setFlipX(spot.flip).setDepth(6);
    const led = scene.add.rectangle(spot.x + (spot.flip ? 2 : -2), spot.y + 1, 1, 1, 0xff4a4a).setDepth(7);
    scene.tweens.add({ targets: led, alpha: 0.1, duration: 600, yoyo: true, repeat: -1 });
  }
  if (tier('entrance') === 2) scene.art(door.x, h - 2, 'air_curtain').setDepth(h + 3);
  if (tier('lights') === 2) {
    const screen = scene.art(w / 2 + 50, -9, 'facade_screen0').setDepth(3);
    scene.worldTimer(1400, () => screen.active && screen.setTexture(screen.texture.key === 'facade_screen0' ? 'facade_screen1' : 'facade_screen0'));
  }
  if (tier('wc')) {
    const sensor = scene.add.rectangle(wc.x + 9, wc.y - 13, 2, 2, tier('wc') === 2 ? 0x2ce8f5 : 0x63c74d).setDepth(wc.y + 2);
    scene.tweens.add({ targets: sensor, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
  }
}

// ---------- Доска отзывов ----------

export function buildReviewBoard(scene: StoreScene, x: number, y: number): void {
  // Доска у входа — просто украшение. Раньше нажатие на неё открывало отзывы, и они вылезали
  // посреди дня от случайного касания у двери; теперь отзывы — в итогах дня и утром на вкладке «Развитие».
  scene.art(x, y, 'review_board').setOrigin(0.5, 1).setDepth(y);
}

/**
 * Покупатель с небольшой корзиной пробивает себя сам на свободной кассе самообслуживания: когда у
 * касс очередь, а без очереди — каждый третий (KIOSK_PREFER). Сколько штук, как быстро, как часто
 * «ошибка» и непробитый товар — по модели киосков (lanes.ts).
 */
export async function useKiosk(scene: StoreScene, c: Customer): Promise<boolean> {
  const tier = kioskTier(scene.state);
  if (!scene.kiosks.length || c.thief || !c.items.length || c.items.length > tier.maxItems) return false;
  if (scene.waiting() === 0 && Math.random() >= KIOSK_PREFER) return false;
  const kiosk = scene.kiosks.find((k) => !k.busy && k.img.active);
  if (!kiosk) return false;
  kiosk.busy = true;
  const { img, screen } = kiosk;
  await persons.walk(scene, c.sprite, img.x - 14, img.y + 4);
  if (c.gone || !c.sprite.active) {
    kiosk.busy = false;
    return true;
  }
  persons.setFacing(c.sprite, 'right');
  c.serving = true;
  // «Забыл» пробить один товар (только из нескольких — с пустым чеком не уходят): уйдёт с ним, не заплатив.
  const skipped = c.items.length > 1 && Math.random() < tier.skip ? c.items[c.items.length - 1] : undefined;
  for (const [n, it] of c.items.entries()) {
    await scene.wait(tier.item * 1000);
    if (!scene.sys.isActive()) return true;
    if (it === skipped) continue;
    const item = scene.art(c.sprite.x, c.sprite.y - 2, `item_${it.id}`).setScale(1.5 / ART).setDepth(1000);
    scene.tweens.add({ targets: item, x: img.x, y: img.y - 6, alpha: 0.2, duration: 220, onComplete: () => item.destroy() });
    sound.scan(img.x, n);
    screen.setAlpha(0.9);
    scene.time.delayedCall(150, () => screen.setAlpha(0.3));
  }
  // «Неизвестный товар в зоне упаковки»: экран краснеет, покупатель ждёт, пока он сбросится.
  if (Math.random() < tier.error) {
    screen.setFillStyle(KIOSK_ALARM).setAlpha(0.9);
    scene.popup(img.x - 6, img.y - 20, t('popup.kioskError'), '#ffd0d0');
    await scene.wait(KIOSK_ERROR_SECONDS * 1000);
    if (!scene.sys.isActive()) return true;
    screen.setFillStyle(KIOSK_GLOW).setAlpha(0.3);
  }
  await scene.wait(tier.pay * 1000);
  kiosk.busy = false;
  if (!scene.sys.isActive()) return true;
  if (skipped) {
    c.items = c.items.filter((it) => it !== skipped);
    const value = unitSalePrice(scene.state, skipped.id, skipped.unit);
    scene.stats.stolen += value;
    scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.kioskSkip', { n: value }), '#ffd0d0');
  }
  shoppers.finishCheckout(scene, c, { x: img.x - 10, y: img.y - 12 });
  return true;
}

export function buildShell(scene: StoreScene): void {
  const { w, h, door } = scene.layout;
  const cap = (x: number, y: number, ww: number, hh: number) =>
    scene.add.tileSprite(x, y, ww, hh, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(2);
  cap(-WALL, -4, w + 2 * WALL, 4);
  // Левая стена с проёмами в открытые комнаты флигеля.
  const gaps = openRooms(scene)
    .map((room) => room.doorway.y)
    .sort((a, b) => a - b);
  let from = 0;
  for (const y of gaps) {
    cap(-WALL, from, WALL, y - 8 - from);
    buildWingDoor(scene, y);
    from = y + 8;
  }
  cap(-WALL, from, WALL, h - from);
  cap(w, 0, WALL, h);
  // Окна в правой стене: стекло в толще стены, вечером через них на пол падает солнце.
  scene.sideSun = [];
  for (let y = scene.layout.wallH + 50; y < h - 70; y += 72) {
    scene.add.rectangle(w + 1, y, WALL - 2, 22, 0x9fd8f0).setOrigin(0).setStrokeStyle(0.6, 0x3a4466).setDepth(2.1);
    scene.add.rectangle(w + 2, y + 2, 1, 18, 0xe8f8ff).setOrigin(0).setDepth(2.11);
    const sun = scene.art(w - 2, y + 11, 'light_spill').setOrigin(0.5, 0).setAngle(90).setScale(1 / ART, 1.3 / ART).setTint(0xffd6a0).setAlpha(0).setDepth(0.45);
    scene.sideSun.push(sun);
  }
  // Тень здания на газон справа: магазин стоит на земле, а не наклеен на траву.
  const ink = 0x181425;
  const shade = scene.add.graphics().setDepth(-9.4);
  shade.fillGradientStyle(ink, ink, ink, ink, 0.22, 0, 0.22, 0);
  shade.fillRect(w + WALL, 2, 12, h + FACADE_H - 4);
  const style = facadeStyle(scene);
  scene.add.tileSprite(-WALL, h, w + 2 * WALL, FACADE_H, potTile(scene, style.texture)).setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
  scene.doorImg = scene.art(door.x, h + 5, 'door').setDepth(h + 2);
  scene.doorSign = scene.art(door.x + 11, h + 8, scene.running ? 'door_sign_open' : 'door_sign_closed').setDepth(h + 42);
  // Витрины с маленькими навесами слева и справа от двери.
  const segments: [number, number][] = [
    [8, door.x - 18],
    [door.x + 18, w - 2],
  ];
  for (const [from, to] of segments) {
    const n = Math.floor((to - from) / 24);
    const start = (from + to) / 2 - ((n - 1) * 24) / 2;
    for (let i = 0; i < n; i++) {
      const x = start + i * 24;
      scene.art(x, h + 5.5, 'shopwin').setDepth(h + 2);
      if (!style.canopy) scene.art(x, h + 1.5, 'awning_small').setTint(style.awning ?? 0xffffff).setDepth(h + 40);
      lighting.windowLight(scene, x, h + 5.5, h + 9, false, undefined, true);
    }
  }
  // Из дверей свет падает дорожкой на тротуар.
  lighting.nightGlow(scene, scene.art(door.x, h + 9, 'light_spill').setOrigin(0.5, 0).setScale(1.3 / ART, 1.4 / ART).setTint(0xffd890), 0.55, undefined, { store: true, map: { scale: 1.1, gain: 1.5, haze: 0.12 } });
  // Главный навес над входом: покупатели проходят под ним.
  scene.art(door.x, h + 1, 'awning').setScale(1 / ART, 0.6 / ART).setTint(style.canopy ?? style.awning ?? 0xffffff).setDepth(h + 41);
  if (style.canopy) {
    // Сплошной козырёк над витринами; у супермаркета снизу светится полоса.
    scene.add.rectangle(-WALL, h - 1, w + 2 * WALL, 3, style.canopy).setOrigin(0).setStrokeStyle(0.5, 0x181425).setDepth(h + 40);
    scene.add.rectangle(-WALL, h + 2, w + 2 * WALL, 1, 0x181425, 0.25).setOrigin(0).setDepth(h + 40);
    if (style.led) {
      scene.add.rectangle(-WALL, h + 1.5, w + 2 * WALL, 0.6, 0x9cd8ff).setOrigin(0).setDepth(h + 40.5);
      lighting.nightGlow(scene, scene.add.rectangle(-WALL, h + 1, w + 2 * WALL, 3, 0x9cd8ff).setOrigin(0), 0.6, undefined, { store: true });
    }
  }
}

export function facadeStyle(scene: StoreScene): (typeof FACADE_STYLES)[number] {
  return FACADE_STYLES[Math.min(scene.state.level, FACADE_STYLES.length - 1)];
}

/**
 * Острова-витрины «Акция» в пустом центре зала и список препятствий для обхода:
 * полки (и места под них), витрины, касса. Человек за мебелью — если его центр выше её задней кромки,
 * перед ней — если ноги ниже передней.
 */
export function buildShowcases(scene: StoreScene): void {
  // Витрины с товаром в пустом центре зала больше не ставим: игроки принимали их за полки,
  // с которых почему-то не покупают. Пустые места под полки размечены на полу.
  const { slots, counter } = scene.layout;
  const furniture = (x: number, y: number): Rect => ({ x: x - 25, y: y - 16, w: 50, h: 24 });
  // Места под полки обходят всегда: полку могут купить утром без перестройки зала.
  scene.obstacles = slots.map((p) => (slotSide(scene.layout, p) ? { x: p.x - 10, y: p.y - 24, w: 20, h: 48 } : furniture(p.x, p.y)));
  scene.obstacles.push({ x: counter.x - 13, y: counter.y - 30, w: 26, h: 54 });
  // Место ларя обходят всегда, как и места под полки: его могут поставить утром.
  const ice = shelves.iceboxSpot(scene);
  scene.obstacles.push({ x: ice.x - 16, y: ice.y - 10, w: 32, h: 18 });
  // Левая стена: вдоль неё не ходят, во флигель — только через двери.
  const { h } = scene.layout;
  let from = -4;
  for (const y of openRooms(scene).map((room) => room.doorway.y).sort((a, b) => a - b)) {
    scene.obstacles.push({ x: -WALL - 2, y: from, w: WALL + 2, h: y - 8 - from });
    from = y + 8;
  }
  scene.obstacles.push({ x: -WALL - 2, y: from, w: WALL + 2, h: h - from });
  // Вещи, поставленные раньше (автомат, растения), — тоже препятствия.
  for (const prop of scene.propList) scene.obstacles.push(propRect(prop));
}

/** Место вещи зала: своё (перестановка в этом помещении) или стандартное. */
export function propAt(scene: StoreScene, id: string, def: { x: number; y: number }): { x: number; y: number } {
  scene.propDefaults[id] = def;
  const custom = scene.state.propPos?.level === scene.state.level ? scene.state.propPos.at[id] : undefined;
  return custom ? { x: custom.x, y: custom.y } : def;
}

/** Вещь зала, которую можно двигать при перестановке; её «след» — препятствие для обхода (oy — сдвиг картинки по высоте). */
export function registerProp(scene: StoreScene, id: string, at: { x: number; y: number }, tex: string, fp: Rect, oy = 0): void {
  scene.propList.push({ id, x: at.x, y: at.y, fp, tex, oy });
}

/** Стандартное место ведра: правый нижний угол зала (двигается отдельно от кассы). */
export function binDefault(scene: StoreScene): { x: number; y: number } {
  return { x: scene.layout.w - 10, y: scene.layout.h - 12 };
}

/** Где стоит ведро и уличный контейнер (у роллета склада). */
export function binSpot(scene: StoreScene): { x: number; y: number } {
  return propAt(scene, 'bin', binDefault(scene));
}

/** Куда встать, чтобы завязать мешок: со стороны зала. */
export function binStand(scene: StoreScene): { x: number; y: number } {
  const bin = binSpot(scene);
  return { x: bin.x + (bin.x < scene.layout.w / 2 ? 16 : -16), y: bin.y + 2 };
}

/** Контейнер у фасада слева от двери, на пути от двери не стоит. */
export function dumpSpot(scene: StoreScene): { x: number; y: number } {
  const { h } = scene.layout;
  return { x: 18, y: h + FACADE_H + 9 };
}

/** Ведро в зале (нажми — продавец вынесет мусор) и зелёный контейнер на улице. */
export function buildBin(scene: StoreScene): void {
  const bin = binSpot(scene);
  const dump = dumpSpot(scene);
  scene.binFill = 0;
  scene.binBusy = false;
  scene.binBy = null;
  scene.bagCarried = 0;
  scene.dumpImg = scene.art(dump.x, dump.y, 'dumpster').setDepth(dump.y + 8);
  scene.binImg = scene.art(bin.x, bin.y, binSprite(scene.state, 0)).setDepth(bin.y + 6);
  scene.binImg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => takeOutTrash(scene)));
  scene.binGlow = new Halo(scene, scene.binImg, 0xe43b44);
  scene.binStink = scene.art(bin.x, bin.y - 14, 'stink').setDepth(bin.y + 30).setVisible(false);
  scene.tweens.add({ targets: scene.binStink, y: bin.y - 19, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });
  scene.obstacles.push({ x: bin.x - 8, y: bin.y - 12, w: 16, h: 14 });
  registerProp(scene, 'bin', bin, binSprite(scene.state, 0), propFootprint(scene.layout, 'bin', bin.x));
  refreshBin(scene);
}

/**
 * Полка «Уценка»: горка у входа, на свободном месте у нижней стены (или где поставили при перестановке).
 * Модель (gear 'bargain') — сколько на ней рядов по BARGAIN_PER_ROW мест; товар лежит на полках горки.
 * Нажать — снести на неё то, что испортится ночью.
 */
export function buildBargain(scene: StoreScene): void {
  scene.bargainAt = null;
  scene.bargainItems = [];
  if (!hasBargain(scene.state)) return;
  const { door, h, w } = scene.layout;
  const fp = propFootprint(scene.layout, 'bargain', 0);
  const zones = [...tillZones(scene.layout, registerSlots(scene.state), kioskCount(scene.state)), ...blockedZones(scene.layout)];
  const free = (p: { x: number; y: number }) => {
    const r = { x: p.x + fp.x - 3, y: p.y + fp.y - 16, w: fp.w + 6, h: fp.h + 19 };
    return r.x > 2 && r.x + r.w < w - 2 && ![...scene.obstacles, ...zones].some((o) => overlapsRect(r, o));
  };
  const candidates = [-46, -76, 46, 76, -106, 106, -136, 136].map((dx) => ({ x: door.x + dx, y: h - 12 }));
  const def = candidates.find(free) ?? { x: door.x - 46, y: h - 12 };
  const at = propAt(scene, 'bargain', def);
  scene.bargainAt = at;
  const rows = bargainRows(scene.state);
  const tex = bargainSprite(scene.state);
  // Низом — на пол у точки at: у моделей побольше горка растёт вверх.
  const img = scene.art(at.x, at.y + BARGAIN_BOTTOM, tex).setOrigin(0.5, 1).setDepth(at.y + 4);
  img.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => sendToBargain(scene, true)));
  scene.bargainItems = Array.from({ length: rows * BARGAIN_PER_ROW }, (_, n) => {
    const spot = bargainSlot(at, n);
    // Передний ряд — поверх задних.
    return scene.art(spot.x, spot.y, 'item').setDepth(at.y + 5 - Math.floor(n / BARGAIN_PER_ROW) * 0.1).setVisible(false);
  });
  scene.obstacles.push({ x: at.x + fp.x, y: at.y + fp.y, w: fp.w, h: fp.h });
  registerProp(scene, 'bargain', at, tex, fp, BARGAIN_BOTTOM - img.displayHeight / 2);
  refreshBargain(scene);
}

/** Место n на горке уценки: ряды по BARGAIN_PER_ROW, первый — передний нижний (art/bargain_shelf.py). */
export function bargainSlot(at: { x: number; y: number }, n: number): { x: number; y: number } {
  const row = Math.floor(n / BARGAIN_PER_ROW);
  const col = n % BARGAIN_PER_ROW;
  // Полка ряда — на BARGAIN_BASE + row × BARGAIN_STEP точек выше низа горки; товар стоит на ней.
  return { x: at.x - 11.25 + col * 4.5, y: at.y + BARGAIN_BOTTOM - BARGAIN_BASE - row * BARGAIN_STEP - 2 };
}

/** Где встать покупателю: за горкой, тянется к товару через неё (горка повыше — встаёт дальше). */
export function bargainStand(scene: StoreScene, at: { x: number; y: number }): number {
  return at.y + BARGAIN_BOTTOM - BARGAIN_BASE - bargainRows(scene.state) * BARGAIN_STEP - 9;
}

/** Товар на полке уценки: по картинке на каждую штуку, передний ряд заполняется первым. */
export function refreshBargain(scene: StoreScene): void {
  const units = PRODUCT_IDS.flatMap((id) => (scene.state.bargain?.[id] ?? []).map(() => id));
  scene.bargainItems.forEach((img, n) => {
    if (!img.active) return;
    const id = units[n];
    img.setVisible(Boolean(id));
    if (id) img.setTexture(`item_${id}_${n % ITEM_VARIANTS}`).setScale(0.7 / ART);
  });
}

/** Снести на полку уценки то, что испортится ночью (по нажатию — с подсказкой, если нечего). */
export function sendToBargain(scene: StoreScene, byTap = false): void {
  if (!scene.bargainAt) return;
  const moved = fillBargain(scene.state);
  if (moved.count) {
    scene.state = moved.state;
    saveGame(scene.state);
    sound.tap();
    scene.popup(scene.bargainAt.x, scene.bargainAt.y - 18, t('popup.bargain', { n: moved.count }), '#ffd0d0');
    scene.refreshShelves();
    refreshWarehouse(scene);
  } else if (byTap) {
    const full = bargainCount(scene.state) >= bargainCapacity(scene.state);
    scene.popup(scene.bargainAt.x, scene.bargainAt.y - 18, t(full ? 'popup.bargainFull' : 'popup.bargainNone'), '#fff3b0');
  }
  refreshBargain(scene);
}

/** Покупатель по пути заглядывает на полку уценки и берёт одну штуку сверх списка — прямо с её места на горке. */
export async function visitBargain(scene: StoreScene, c: Customer): Promise<void> {
  const at = scene.bargainAt;
  if (!at || c.thief || !bargainCount(scene.state) || Math.random() >= BARGAIN_CHANCE) return;
  await persons.walk(scene, c.sprite, at.x + Phaser.Math.Between(-8, 8), bargainStand(scene, at));
  await scene.wait(400);
  if (c.gone) return;
  const units = PRODUCT_IDS.flatMap((id) => (scene.state.bargain?.[id] ?? []).map(() => id));
  const taken = takeBargain(scene.state);
  if (!taken) return;
  scene.state = taken.state;
  c.items.push({ id: taken.id, unit: taken.unit });
  // Штука улетает в руки с того места, где лежала (берут самую старую — первую этого товара).
  const n = units.indexOf(taken.id);
  const img = scene.bargainItems[n];
  const from = img?.active && img.visible ? [{ x: img.x, y: img.y, texture: img.texture.key, scale: img.scaleX, tint: 0xffffff }] : [];
  motion.reachShelf(scene, c, { x: at.x, y: at.y - 6 }, taken.id, from);
  if (Math.random() < 0.5) scene.popup(c.sprite.x, c.sprite.y - 18, t('popup.bargainTake'), '#ffd0d0');
  refreshBargain(scene);
}

export function binFull(scene: StoreScene): boolean {
  return scene.binFill >= binCapacity(scene.state);
}

export function refreshBin(scene: StoreScene): void {
  if (!scene.binImg?.active) return;
  const level = scene.binFill === 0 ? 0 : binFull(scene) ? 3 : scene.binFill >= binCapacity(scene.state) / 2 ? 2 : 1;
  scene.binImg.setTexture(binSprite(scene.state, level));
  scene.binStink?.setVisible(binFull(scene));
}

/** Мусор в ведро: оно подпрыгивает. */
export function putInBin(scene: StoreScene): void {
  scene.binFill = Math.min(binCapacity(scene.state), scene.binFill + 1);
  refreshBin(scene);
  sound.tap();
  if (scene.binImg) scene.tweens.add({ targets: scene.binImg, scaleY: 1.15 / ART, duration: 90, yoyo: true });
  if (binFull(scene)) scene.popup(binSpot(scene).x, binSpot(scene).y - 18, t('popup.binFull'), '#ffd0d0');
}

/** Шаги «вынести мусор»: к ведру, завязать мешок, через дверь к контейнеру, бросить и вернуться. */
export function takeOutSteps(scene: StoreScene, onBag: () => void, onDump: () => void): ChoreStep[] {
  const dump = dumpSpot(scene);
  const { door, h } = scene.layout;
  const outside = h + FACADE_H + 6;
  return [
    { ...binStand(scene), ms: BAG_MS, action: onBag },
    { x: door.x, y: door.y - 8 },
    { x: door.x, y: outside },
    { x: dump.x + 15, y: dump.y + 3, ms: DUMP_MS, action: onDump },
    { x: door.x, y: outside },
    { x: door.x, y: door.y - 8 },
  ];
}

export function bagFromBin(scene: StoreScene): void {
  scene.bagCarried = scene.binFill;
  scene.binFill = 0;
  refreshBin(scene);
}

export function bagToDumpster(scene: StoreScene): void {
  scene.bagCarried = 0;
  scene.binBusy = false;
  scene.binBy = null;
  sound.coin();
  const dump = dumpSpot(scene);
  effects.puff(scene, dump.x, dump.y - 6);
}

/** Продавец выносит мусор: долго, касса в это время пустует. */
export function takeOutTrash(scene: StoreScene): void {
  if (!scene.running || scene.sellerBusy || scene.ownerScanning() || scene.binBusy || scene.binFill === 0) return;
  scene.binBusy = true;
  scene.binBy = 'seller';
  void staff.doChore(scene, 
    takeOutSteps(scene, 
      () => {
        bagFromBin(scene);
        scene.carried.setTexture('trash_bag').setPosition(5, 1).setVisible(true);
      },
      () => {
        scene.carried.setVisible(false).setTexture('box').setPosition(0, 3);
        bagToDumpster(scene);
      },
    ),
  );
}

/** Плакаты на стене, растения и корзинки у входа — чтобы зал не выглядел пустым. */
/** Первое место, где вещь 26×20 не мешает полкам, кассе, складу и автомату. */
export function freeSpot(scene: StoreScene, candidates: { x: number; y: number }[]): { x: number; y: number } | null {
  const { slots, counter } = scene.layout;
  const blocked = [
    ...slots.map((s) => ({ x: s.x - 22, y: s.y - 14, w: 44, h: 30 })),
    { x: counter.x - 10, y: counter.y - 28, w: 20, h: 64 },
    ...scene.propList.map(propRect),
    // Купленные киоски у правой стены (их ставит buildUpgrades — позже украшений).
    ...(kioskCount(scene.state) ? kioskZones(scene.layout, kioskCount(scene.state)) : []),
  ];
  return (
    candidates.find((c) =>
      blocked.every((b) => c.x + 13 < b.x || c.x - 13 > b.x + b.w || c.y + 10 < b.y || c.y - 10 > b.y + b.h),
    ) ?? null
  );
}

/** Комнаты флигеля, в которые есть дверь из зала. */
export function openRooms(scene: StoreScene): Room[] {
  const { warehouse, bakery, coffee, kitchen } = scene.layout;
  return [warehouse, ...(food.bakeryOpen(scene) ? [bakery] : []), ...(food.coffeeOpen(scene) ? [coffee] : []), ...(kitchen && kitchenOpen(scene.state) ? [kitchen] : [])];
}

/**
 * Флигель слева от зала: наружные стены, стены между комнатами, фасад склада с воротами
 * и подъезд к ним с улицы. Пекарня и кофейня, пока не открыты, стоят тёмные и запертые.
 */
export function buildWing(scene: StoreScene): void {
  const { h, wing, warehouse, bakery, coffee } = scene.layout;
  const cap = (x: number, y: number, ww: number, hh: number) =>
    scene.add.tileSprite(x, y, ww, hh, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(2);
  const left = -WING_OUTER;
  cap(left, wing.y - 4, WING_OUTER - WALL, 4);
  cap(left, wing.y, WALL, h - wing.y);
  cap(left + WALL, warehouse.y - WALL, wing.w, WALL);
  cap(left + WALL, bakery.y - WALL, wing.w, WALL);
  if (scene.layout.kitchen) cap(left + WALL, scene.layout.coffee.y - WALL, wing.w, WALL);
  scene.add.tileSprite(left, h, WING_OUTER - WALL, FACADE_H, potTile(scene, facadeStyle(scene).texture)).setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
  const gateX = warehouse.x + warehouse.w / 2;
  scene.art(gateX, h + 5.5, 'shutter').setDepth(h + 2);
  // Подъезд от тротуара к воротам склада.
  const top = scene.next.h + 4;
  if (top > h + FACADE_H) scene.add.tileSprite(gateX - 12, h + FACADE_H, 24, top - h - FACADE_H, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9);
  buildRoom(scene, bakery, 'bakery', food.bakeryOpen(scene));
  buildRoom(scene, coffee, 'coffee', food.coffeeOpen(scene));
  if (scene.layout.kitchen) buildRoom(scene, scene.layout.kitchen, 'kitchen', kitchenOpen(scene.state));
  food.buildKitchen(scene);
}

/**
 * Дверь из зала во флигель: порог, деревянные косяки, створка открыта внутрь комнаты,
 * коврик в зале. Куда ведёт дверь — видно по табличке внутри самой комнаты.
 */
export function buildWingDoor(scene: StoreScene, y: number): void {
  const { warehouse, bakery, coffee } = scene.layout;
  const room = [warehouse, bakery, coffee].find((r) => r.doorway.y === y);
  scene.add.tileSprite(-WALL, y - 8, WALL, 16, 'wh_floor').setOrigin(0).setTileScale(1 / ART).setDepth(1);
  // Косяки — сверху и снизу проёма.
  for (const jy of [y - 9.5, y + 7.5]) scene.add.rectangle(-WALL - 1, jy, WALL + 2, 2.5, 0x5a3a2a).setOrigin(0).setDepth(jy + 6);
  // Створка распахнута внутрь комнаты.
  scene.add.rectangle(-WALL - 11, y - 8, 11, 2, 0xb86f50).setOrigin(0).setStrokeStyle(0.5, 0x3b2a35).setDepth(y - 2);
  // Коврик со стороны зала.
  scene.add.rectangle(0.5, y - 6, 9, 12, room === warehouse ? 0x5a6988 : 0x9e2835, 0.85).setOrigin(0).setDepth(1);
}

/** Комната флигеля: пол, кусок стены с табличкой; закрытая — тёмная, с замком. */
export function buildRoom(scene: StoreScene, room: Room, kind: 'bakery' | 'coffee' | 'kitchen', open: boolean): void {
  const { x, y, w, h } = room;
  scene.add.tileSprite(x, y, w, h, kind === 'coffee' ? 'floor_wood' : 'floor2').setOrigin(0).setTileScale(1 / ART);
  scene.add
    .tileSprite(x, y, w, 14, 'wall')
    .setOrigin(0)
    .setTileScale(1 / ART)
    .setTint(kind === 'bakery' ? 0xffe2d2 : kind === 'kitchen' ? 0xd8f0d8 : 0xe6dcf6)
    .setDepth(1);
  if (open || !cleanHall(scene.state)) roomSign(scene, x, y + 7, w, t(`wing.${kind}`));
  if (open) {
    lighting.nightGlow(scene, scene.art(x + w / 2, y + 26, 'glow').setScale(44 / 64).setTint(kind === 'bakery' ? 0xffd8a0 : 0xffe8c8), 0.5, undefined, { store: true, map: { scale: 1.3, gain: 0.8, haze: 0.12 } });
    // Мелочи: на стене слева от таблички — меню, банки или сковородки; у двери — коврик.
    scene.art(x + 13, y + 7, kind === 'coffee' ? 'menu_chalk' : kind === 'bakery' ? 'jar_shelf' : 'pot_rack').setDepth(2);
    if (kind === 'bakery') scene.art(x + w - 8, y + h - 8, 'flour_sacks').setDepth(y + h - 2);
    scene.add.rectangle(x + w - 3, room.doorway.y, 4, 14, 0x9e5b33).setStrokeStyle(1, 0x5a3420).setDepth(1.5);
    return;
  }
  scene.add.rectangle(x, y + 16, w, h - 16, 0x1d1a26, 0.62).setOrigin(0).setDepth(y + h);
  // Первая неделя новичка в киоске: закрытая комната — тихий силуэт, без замка и «закрыта» (firstday.ts).
  if (cleanHall(scene.state)) return;
  scene.add
    .text(x + w / 2, y + h / 2 + 6, `🔒\n${t(`wing.${kind}Locked`)}`, { fontFamily: UI_FONT, fontSize: '5px', color: '#c0cbdc', align: 'center' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(4))
    .setDepth(y + h + 1);
}

/**
 * Табличка комнаты флигеля по ширине надписи — у двери в зал (справа): её видно,
 * даже когда флигель в кадре краем.
 */
export function roomSign(scene: StoreScene, x: number, y: number, w: number, text: string): void {
  const label = scene.add.text(0, y, text, { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#fee761' }).setOrigin(0.5).setResolution(scene.textRes(4));
  const plateW = Math.min(w - 4, label.width + 6);
  const cx = x + w - 2 - plateW / 2;
  label.setX(cx).setDepth(y + 61);
  scene.add.rectangle(cx, y, plateW, 9, 0x3b2a35).setStrokeStyle(1, 0xb86f50).setDepth(y + 60);
}

/** Центр ряда тары на складе: ряды стоят на балках стеллажа. */
export function warehouseRowY(scene: StoreScene, row: number): number {
  return scene.layout.warehouse.y + 16 + row * 8;
}

export function buildWarehouse(scene: StoreScene): void {
  const { x, y, w, h, doorway } = scene.layout.warehouse;
  scene.add.tileSprite(x, y, w, h, 'wh_floor').setOrigin(0).setTileScale(1 / ART);
  // Складской стеллаж: на каждой балке — поддон и ряд тары.
  const rows = scene.layout.warehouse.rows;
  for (let row = 0; row < rows; row++) {
    const rowY = warehouseRowY(scene, row);
    scene.art(x, rowY - 4, 'rack').setOrigin(0).setDepth(rowY - 101);
  }
  // Жёлто-чёрная разметка проезда под стеллажом и у проёма.
  const laneY = warehouseRowY(scene, rows - 1) + 7;
  scene.add.tileSprite(x + 2, laneY, w - 4, 2, 'hazard').setOrigin(0).setTileScale(1 / ART).setDepth(laneY - 100);
  scene.add.tileSprite(x + w - 2, doorway.y - 10, 2, 20, 'hazard').setOrigin(0).setTileScale(1 / ART).setDepth(doorway.y - 100);
  // Огнетушитель у проёма и лампа под потолком.
  scene.art(x + w - 4, doorway.y - 16, 'extinguisher').setDepth(doorway.y - 90);
  lighting.nightGlow(scene, scene.art(x + w / 2, y + 10, 'glow').setScale(40 / 64).setTint(0xfff0c8), 0.5, undefined, { store: true, map: { scale: 1.3, gain: 0.8, haze: 0.12 } });
  roomSign(scene, x, y + 7, w, t('warehouse.label'));
}

export function refreshWarehouse(scene: StoreScene): void {
  // На складе помещается ~30 коробок: в большом складе одна коробка изображает больше штук.
  const perBox = unitsPerBox(warehouseCapacity(scene.state));
  const boxes = PRODUCT_IDS.flatMap((id) =>
    Array.from({ length: Math.ceil((scene.state.warehouse[id]?.length ?? 0) / perBox) }, () => id),
  ).slice(0, WAREHOUSE_COLS * scene.layout.warehouse.rows);
  // Купленное утром ещё едет: последние коробки появятся, когда водитель их занесёт.
  boxes.length = Math.max(0, boxes.length - scene.awaitingBoxes);
  while (scene.boxes.length < boxes.length) scene.boxes.push(scene.art(0, 0, 'box'));
  scene.boxes.forEach((img, n) => {
    const id = boxes[n];
    img.setVisible(Boolean(id));
    if (!id) return;
    // У каждого товара своя тара: лоток, ящик, мешок, пластиковый ящик, термобокс.
    const row = Math.floor(n / WAREHOUSE_COLS);
    const y = warehouseRowY(scene, row);
    img.setPosition(scene.layout.warehouse.x + 8 + (n % WAREHOUSE_COLS) * 9, y).setTexture(`crate_${id}`).setDepth(y - 100);
  });
}

export function refreshToilet(scene: StoreScene): void {
  const dirt = scene.toiletDirt;
  scene.wcBar.setDisplaySize((14 * dirt) / 100, 2);
  scene.wcBar.setTint(dirt < 30 ? 0x8fd16a : dirt < TOILET_DIRTY ? 0xf2c14e : 0xd95763);
  scene.wcDoor.setTint(dirt >= TOILET_DIRTY ? 0xc8a878 : 0xffffff);
  scene.wcStink.setVisible(dirt >= TOILET_DIRTY);
}

/**
 * Картинка для полосы-плитки (фасад, забор, гирлянда). Phaser растягивает плитку до степени двойки
 * (32×20 → 32×32), и ряды пикселей выходят разной высоты при любом масштабе камеры. Плитке с высотой
 * не в степень двойки — копия, дополненная до неё той же картинкой ниже: полоса в одну плитку высотой
 * показывает те же ряды, только без растяжки.
 */
export function potTile(scene: StoreScene, key: string): string {
  const frame = scene.textures.getFrame(key);
  if (!frame) return key;
  const { cutWidth: w, cutHeight: h } = frame;
  const pot = Phaser.Math.Pow2.GetNext(h);
  if (pot === h || !Phaser.Math.Pow2.IsValue(w)) return key;
  const padded = `${key}@pot`;
  if (!scene.textures.exists(padded)) {
    const canvas = scene.textures.createCanvas(padded, w, pot);
    for (let y = 0; canvas && y < pot; y += h) canvas.context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, w, h, 0, y, w, h);
    canvas?.refresh();
  }
  return padded;
}

/** Где на стене висит электрощиток (в точках мира по x): первое открытое место левее туалета. */
export function fuseSpot(scene: StoreScene): number {
  const { wc } = scene.layout;
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => wc.x - 24 - k * 12).find((x) => x > 10 && !shelves.behindShelf(scene, x, 6)) ?? wc.x - 24;
}
