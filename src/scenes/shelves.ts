// Полки зала: постройка и обновление полок с товаром (refreshShelves), боковые полки со шкалой запаса, ларь
// и вёдра у кассы, вставки отделов в полу, уценка прямо в зале, места и пути к полкам, пары и неудачное
// соседство. Где какие места — layout.ts и placement.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import {
  canPlace,
  SHELF_LEVELS,
  expiringIn,
  SHELF_KINDS,
  PRODUCT_IDS,
  shelfCapacity,
  shelfFree,
  isFixture,
  slotOf,
  type Category,
  type ProductId,
} from '../game/economy';
import { getLang, t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { UI_FONT } from '../ui/dom';
import { kioskCount } from '../game/lanes';
import {
  slotRect,
  slotSide,
  standFor,
  propFootprint,
  propRect,
} from './placement';
import { brandSpotFor, iceboxRect, iceboxSpotFor, WALL_ROW_Y } from './layout';
import { Halo } from './halo';
import { PAIR_CHANCE, shelfLinks, type Link } from '../game/neighbors';
import { gearTier } from '../game/gear';
import { registerSlots } from '../game/registers';
import { cleanHall, dreamShelf } from '../game/firstday';
import { ART, FURNITURE_TOP, QUAKE_SHAKE_PX, ITEM_VARIANTS, type ShelfView } from './common';
import * as motion from './motion';
import * as lighting from './lighting';
import * as staff from './staff';
import * as camera from './camera';

/** Сколько штук на полке считается «почти пусто» — табличка «Осталось N». */
const LOW_STOCK = 2;
/** Одна коробка на складе изображает минимум столько штук товара. */


const SHELF_LOOK: Record<Category, { texture: string; tint: number }> = {
  bakery: { texture: 'shelf', tint: 0xffffff },
  produce: { texture: 'stand', tint: 0xffffff },
  dairy: { texture: 'fridge', tint: 0xd8ecff },
  meat: { texture: 'fridge', tint: 0xffd6d6 },
  drinks: { texture: 'drinks', tint: 0xffffff },
  // Морозильник — тот же холодильник, но ледяной.
  frozen: { texture: 'fridge', tint: 0xc4f4ff },
  household: { texture: 'chem', tint: 0xffffff },
  // Ларь с мороженым у входа и вёдра с цветами у кассы — свои картинки и свои места.
  icebox: { texture: 'icebox', tint: 0xffffff },
  florist: { texture: 'florist', tint: 0xffffff },
  brand: { texture: 'brand_stand', tint: 0xffffff },
};
/** Плиточная вставка отдела под полкой — на плитке пола, под тенями живого пола (FLOOR_SHADE_DEPTH). */
const DEPT_INLAY_DEPTH = 0.2;

// ---------- Названия отделов на полу ----------
// Значок отдела на шапке и цветная вставка в полу у каждой полки есть давно, но в большом зале полки
// сливались в сетку похожих холодильников. С ближним кадром у касс (camera.ts) перед каждой полкой на вставке
// видно название отдела — как наклейка на полу супермаркета. На общем плане буквы были бы рябью, поэтому
// подписи видны только вблизи (showDeptNames).

/** Отделы с подписью (полки на своих местах — ларь, цветы, своя марка — подписаны и так). */
const NAMED: readonly Category[] = ['bakery', 'produce', 'dairy', 'meat', 'drinks', 'frozen', 'household'];
/** Высота строки подписи в точках мира и её ширина (не шире вставки отдела). */
const NAME_H = 5;
const NAME_W = 30;
/** С какого приближения к обычному кадру подписи видны. */
const NAMES_FROM_ZOOM = 1.3;

/**
 * Все названия — на одном общем холсте (ключ зависит от языка и плотности): одна текстура на все подписи,
 * а не по текстуре на полку — видеокарта рисует их одной пачкой.
 */
function deptNamesTexture(scene: StoreScene): string {
  const res = scene.textRes(8);
  const key = `dept_names2_${getLang()}_${res}`;
  if (scene.textures.exists(key)) return key;
  const w = NAME_W * res;
  const h = NAME_H * res;
  const tex = scene.textures.createCanvas(key, w, h * NAMED.length);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  NAMED.forEach((kind, i) => {
    const text = t(`dept.${kind}` as TextKey).toUpperCase();
    // Длинное название ужимается под ширину вставки.
    let size = 3.6 * res;
    ctx.font = `800 ${size}px ${UI_FONT}`;
    const fit = (w - res * 2) / Math.max(1, ctx.measureText(text).width);
    if (fit < 1) {
      size *= fit;
      ctx.font = `800 ${size}px ${UI_FONT}`;
    }
    // Белые буквы с тёмной обводкой: читаются и на светлой вставке хлебного отдела, и на синей у холодильников.
    ctx.lineJoin = 'round';
    ctx.lineWidth = res * 0.9;
    ctx.strokeStyle = 'rgba(43, 34, 51, 0.9)';
    ctx.strokeText(text, w / 2, h * i + h / 2 + res * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h * i + h / 2 + res * 0.2);
    tex.add(kind, 0, 0, h * i, w, h);
  });
  tex.refresh();
  return key;
}

/** Подпись отдела на полу перед полкой: видна только в ближнем кадре. */
function deptName(scene: StoreScene, kind: Category, x: number, y: number): Phaser.GameObjects.Image | null {
  if (!NAMED.includes(kind)) return null;
  const key = deptNamesTexture(scene);
  if (!scene.textures.exists(key) || !scene.textures.get(key).has(kind)) return null;
  const img = scene.add.image(x, y, key, kind).setDisplaySize(NAME_W, NAME_H).setDepth(DEPT_INLAY_DEPTH + 0.05).setVisible(namesShown(scene));
  img.setData('deptName', true);
  return img;
}

const namesShown = (scene: StoreScene): boolean => scene.cameras.main.zoom >= scene.baseZoom * NAMES_FROM_ZOOM;

/** Камера подошла или отошла — подписи отделов показать или спрятать. Зовётся каждый кадр: меняет только на переходе. */
export function showDeptNames(scene: StoreScene): void {
  const on = namesShown(scene);
  if (on === scene.deptNamesOn) return;
  scene.deptNamesOn = on;
  for (const view of scene.shelfViews) for (const obj of view.lights) if (obj.getData('deptName')) (obj as Phaser.GameObjects.Image).setVisible(on);
}
/** Где на картинке лежит товар (относительно центра места): x, ширина, верхний ряд, шаг рядов. */
const ITEM_AREA: Partial<Record<Category, { x: number; w: number; y: number; row: number }>> = {
  icebox: { x: -13, w: 26, y: -6, row: 4 },
  // Полка «От бабушки»: банки двумя ступенями — задняя повыше, передняя пониже.
  brand: { x: -12, w: 24, y: -1, row: 6 },
};
/** Вёдра с цветами: в каждом ведре по три букета (заднее ведро выше). */
const FLORIST_SPOTS = [
  [0, -9], [-2, -9.5], [2, -9.5],
  [-6.5, -3], [-8.5, -3.5], [-4.5, -3.5],
  [6.5, -3], [4.5, -3.5], [8.5, -3.5],
];

/**
 * Разметка свободного места под полку. Новичку первой недели — только когда на новую полку хватает
 * денег: до этого пустое место в киоске — просто пол.
 */
export function slotShown(scene: StoreScene): boolean {
  if (!cleanHall(scene.state)) return true;
  const kind = dreamShelf(scene.state);
  return Boolean(kind && scene.state.money >= SHELF_KINDS[kind].price);
}

/** Есть товар на складе, а на его полке он закончился. */
export function shelfNeedsRestock(scene: StoreScene): boolean {
  return PRODUCT_IDS.some(
    (id) =>
      (scene.state.warehouse[id]?.length ?? 0) > 0 &&
      scene.state.shelves.some((s) => canPlace(id, s) && (s.items[id]?.length ?? 0) === 0 && shelfFree(s) > 0),
  );
}

/**
 * Создаёт картинки для новых полок и обновляет товар на всех. Штука товара узнаётся по месту в своём
 * товаре (третий батон — всегда третий батон): взяли одну — остальные съезжают на освободившееся
 * место (slide). При выкладке (stockShelf) не съезжают — там штуки сами летят из рук.
 */
export function refreshShelves(scene: StoreScene, slide = true): void {
  // Разбитое толчком падает раньше, чем полку перерисуют: иначе его картинку займёт уцелевшая штука.
  scene.quakeFlush?.();
  scene.layout.slots.forEach((slot, i) => {
    // Свободное место под полку — разметка на полу: полку покупают утром во вкладке «Зал».
    if (!scene.slotDecor[i]) {
      const mark = scene.art(slot.x, slot.y + 2, 'slot_empty').setDepth(1.5).setAngle(slotSide(scene.layout, slot) ? 90 : 0);
      mark.setInteractive({ useHandCursor: true }).on('pointerup', () =>
        camera.tap(scene, () => i >= regularShelves(scene) && scene.popup(slot.x, slot.y - 8, t('popup.slotEmpty'), '#fff3b0')),
      );
      scene.slotDecor[i] = mark;
    }
    scene.slotDecor[i].setVisible(i >= regularShelves(scene) && slotShown(scene));
  });
  // Полок стало меньше (продали) — лишние картинки убираем.
  const sold = scene.shelfViews.splice(scene.state.shelves.length);
  for (const view of sold) destroyShelfView(view);
  // Мебель в зале поменялась — тени на полу запечь заново (в пересборке зала — потом, разом).
  let moved = sold.length > 0;
  scene.state.shelves.forEach((shelf, i) => {
    let view = scene.shelfViews[i];
    const at = spotOf(scene, i);
    // Полку пересобираем, если сменился тип или место (после продажи соседней).
    if (!view || view.kind !== shelf.kind || view.at.x !== at.x || view.at.y !== at.y) {
      if (view) destroyShelfView(view);
      view = buildShelf(scene, i, shelf.kind);
      scene.shelfViews[i] = view;
      moved = true;
    }

    const capacity = shelfCapacity(shelf);
    const perRow = capacity / 2;
    const area = ITEM_AREA[shelf.kind] ?? { x: -17, w: 34, y: -5, row: 11 };
    const step = area.w / perRow;
    // Где на полке просторно, товар крупнее — его лучше видно; плотная полка — обычный размер.
    const size = (shelf.kind === 'florist' ? 1 : Phaser.Math.Clamp(step / 4, 1, 1.3)) / ART;
    const slot = at;
    const side = shelf.kind !== 'florist' && shelf.kind !== 'icebox' && slotSide(scene.layout, slot) !== null;
    const units = PRODUCT_IDS.flatMap((id) => (shelf.items[id] ?? []).map((unit, k) => ({ id, unit, k })));
    const covered = false;
    // Где какая штука стояла до обновления (там, где видна сейчас — даже на полпути съезда).
    const was = new Map<string, { x: number; y: number; bx: number; by: number }>();
    if (slide && !scene.lite) {
      view.items.forEach((img, n) => {
        const key = img.getData('stock') as string | null | undefined;
        if (key && img.visible && !img.getData('flying')) was.set(key, { x: img.x, y: img.y, bx: view.backItems[n].x, by: view.backItems[n].y });
      });
    }
    view.items.forEach((img, n) => {
      const entry = units[n];
      const florist = shelf.kind === 'florist';
      img.setVisible(!covered && n < (florist ? FLORIST_SPOTS.length : capacity) && Boolean(entry));
      if (florist) {
        const [dx, dy] = FLORIST_SPOTS[n % FLORIST_SPOTS.length];
        img.setPosition(slot.x + dx, slot.y + dy);
      } else if (side) {
        // Боковая полка: товар двумя столбиками вдоль полки, сверху вниз.
        const rows = Math.ceil(capacity / 2);
        img.setPosition(slot.x + (n % 2 ? 3 : -3), slot.y - 18 + (32 / rows) * (Math.floor(n / 2) + 0.5));
      } else img.setPosition(slot.x + area.x + step * ((n % perRow) + 0.5), slot.y + area.y + Math.floor(n / perRow) * area.row);
      // Вид штуки — по её месту в своём товаре, а не на полке: съезжая, батон остаётся тем же батоном.
      const variant = entry ? entry.k + PRODUCT_IDS.indexOf(entry.id) : 0;
      if (entry) {
        // Три вида каждого товара (батон, багет, булка…) — полка выглядит живой.
        img.setTexture(`item_${entry.id}_${variant % ITEM_VARIANTS}`).setScale(side ? 0.85 / ART : size);
        img.setTint(entry.unit.markdown ? 0xffe08a : entry.unit.bad ? 0x9a8a80 : 0xffffff);
      }
      // Позади — такой же товар чуть выше и в тени, между передними.
      const back = view.backItems[n];
      back.setVisible(img.visible && shelf.kind !== 'florist' && !side);
      if (entry) {
        back.setPosition(Math.min(img.x + step / 2, slot.x + area.x + area.w - 2), img.y - 2);
        back.setTexture(`item_${entry.id}_${(variant + 1) % ITEM_VARIANTS}`).setScale(size);
      }
      const key = img.visible && entry ? `${entry.id}:${entry.k}` : null;
      img.setData('stock', key);
      const from = key ? was.get(key) : undefined;
      // Подпрыгивает с полкой — по высоте не сравниваем: прыжок сам вернёт её на место.
      // Дрожь от толчка (до QUAKE_SHAKE_PX вбок) — не переезд: штука и так стоит на своём месте.
      if (from && (Math.abs(from.x - img.x) > QUAKE_SHAKE_PX || (from.y !== img.y && !img.getData('hopping')))) {
        motion.slideItem(scene, img, from);
        if (back.visible) motion.slideItem(scene, back, { x: from.bx, y: from.by });
      }
    });
    view.pips.forEach((pip, n) => pip.setVisible(n < shelf.level));
    const few = units.length > 0 && units.length <= LOW_STOCK;
    // Пустая полка — серая табличка «пусто»: видно, что кончился товар, а не что полка сломана.
    const empty = units.length === 0 && shelf.kind !== 'florist';
    if (few) view.low.setText(t('shelf.low', { n: units.length })).setBackgroundColor('#d95763');
    else if (empty) view.low.setText(t('shelf.empty')).setBackgroundColor('#5a6988');
    view.low.setVisible(few || empty);
    if (view.meter) drawMeter(view.meter, units.length, capacity);
    view.expire.setVisible(expiringIn(scene.state, shelf.items) > 0);
    view.needsStock = units.length === 0 && PRODUCT_IDS.some((id) => canPlace(id, shelf) && (scene.state.warehouse[id]?.length ?? 0) > 0);
    view.bg.setTint(SHELF_LOOK[shelf.kind].tint);
  });
  // В перестановке тени спрятаны (там «призраки») — запечём, когда расстановку примут.
  if (moved && scene.floor.ready() && !scene.arranging) scene.bakeFloor();
}

export function buildShelf(scene: StoreScene, index: number, kind: Category): ShelfView {
  const slot = spotOf(scene, index);
  const look = SHELF_LOOK[kind];
  const fixture = SHELF_KINDS[kind].fixture;
  if (!fixture && slotSide(scene.layout, slot)) return buildSideShelf(scene, index, kind, slot);
  // У ларя и вёдер тень нарисована в самой картинке.
  const shadow = scene.art(slot.x, slot.y + 12, 'shadow_wide').setDepth(slot.y - 15).setVisible(!fixture);
  // Мебель в виде «три четверти»: над передней частью видна крышка высотой FURNITURE_TOP.
  const top = fixture ? 0 : FURNITURE_TOP / 2;
  const bg = scene.art(slot.x, slot.y - top, look.texture).setTint(look.tint).setDepth(slot.y - 14);
  const front = scene.art(slot.x, slot.y - top, `${look.texture}_front`).setDepth(slot.y - 12);
  // Глубина по нижнему краю: ларь ниже обычной полки, его край — на 10 точек ниже центра.
  const d = kind === 'icebox' ? slot.y + 10 : kind === 'brand' ? slot.y + 12 : slot.y;
  bg.setDepth(d - 14);
  front.setDepth(d - 12);
  const cover = undefined;
  bg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => staff.restockShelf(scene, index)));
  const items = Array.from({ length: SHELF_LEVELS[SHELF_LEVELS.length - 1].capacity }, () => scene.art(slot.x, slot.y, 'item').setDepth(d - 13));
  const backItems = items.map(() => scene.art(slot.x, slot.y, 'item').setDepth(d - 13.5).setTint(0x8f8278).setVisible(false));
  // Уровень улучшения — жёлтые точки над полкой.
  const pips = [0, 1, 2].map((n) => scene.art(slot.x + (fixture ? -6 : -17) + n * 4, slot.y - (kind === 'florist' ? 18 : 16), 'pip').setDepth(d - 12));
  const glow = new Halo(scene, bg, 0xfee761);
  const low = scene.add
    .text(slot.x + 6, slot.y - 22, '', {
      fontFamily: UI_FONT,
      fontSize: '5px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#d95763',
      padding: { x: 2, y: 1 },
    })
    .setOrigin(0.5)
    .setResolution(scene.textRes(6))
    .setDepth(990)
    .setVisible(false);
  scene.tweens.add({ targets: low, y: low.y - 1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const expire = scene.add
    .text(slot.x, slot.y - 30, t('shelf.expiring'), { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color: '#2b2233', backgroundColor: '#fee761', padding: { x: 2, y: 1 } })
    .setOrigin(0.5)
    .setResolution(scene.textRes(6))
    .setDepth(991)
    .setVisible(false);
  const lights: Phaser.GameObjects.GameObject[] = [];
  // Плиточная вставка отдела в полу под полкой и перед ней, шириной с полку (art/livefloor.py): узор
  // и кайма в тон отдела. У задней стены вставка начинается от плинтуса — на стену не заходит.
  const tileTop = Math.max(slot.y - 11, scene.layout.wallH);
  if (!fixture) lights.push(deptInlay(scene, `deptfloor_${kind}`, slot.x, slot.y + 19, 30, slot.y + 19 - tileTop));
  // Название отдела — наклейкой на вставке перед полкой (видно в ближнем кадре).
  const name = fixture ? null : deptName(scene, kind, slot.x, slot.y + 16);
  if (name) lights.push(name);
  // На мраморе низ полки отражается в полу — бледно и перевёрнуто.
  if (!fixture && scene.glossyFloor) {
    // Только самый низ полки и коротко: блик у основания, а не призрачная копия полки.
    const mirror = scene.art(slot.x, slot.y - top + 32, look.texture).setTint(look.tint).setFlipY(true).setAlpha(0.1).setDepth(0.6);
    mirror.setCrop(0, 50, 80, 14);
    lights.push(mirror);
  }
  // Крупный значок отдела поверх таблички на шапке: молоко, мясо и заморозку не спутать.
  if (!fixture) lights.push(scene.art(slot.x, slot.y - top - 13, `dept_${kind}`).setDepth(d - 11.9));
  // Вечером над рядами товара на обычном стеллаже тлеют тёплые полоски подсветки — под каждой
  // полкой, над верхушками товара (furnitureLight). Ряды товара — на slot.y − 5 и slot.y + 6.
  if (!fixture && look.texture !== 'fridge' && !scene.lite) {
    scene.shelfStrips = scene.shelfStrips.filter((strip) => strip.active);
    for (const dy of [-9.5, 1.5]) {
      const strip = scene.art(slot.x, slot.y + dy, 'glow').setDisplaySize(34, 3).setTint(0xffd890).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(d - 12.5);
      scene.shelfStrips.push(strip);
      lights.push(strip);
    }
    lighting.furnitureLight(scene);
  }
  if (look.texture === 'fridge') {
    // Новые холодильники — с наклейкой класса энергосбережения.
    if (gearTier(scene.state, 'fridge')) lights.push(scene.art(slot.x + 13, slot.y - 15, 'eco_label').setDepth(slot.y - 11));
    const cool = kind === 'meat' ? 0xffd8d8 : 0xc8f0ff;
    // Блик на стекле — лёгкий: товар за ним должен быть хорошо виден.
    const glass = scene.add.rectangle(slot.x, slot.y - 1.5, 36, 19, cool).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.03).setDepth(slot.y - 12.5);
    // Изморозь в углу стекла; у морозильника — в двух углах.
    lights.push(scene.art(slot.x - 17, slot.y - 10.5, 'frost').setOrigin(0).setScale(1.3 / ART).setDepth(slot.y - 12.4));
    if (kind === 'frozen') lights.push(scene.art(slot.x + 17, slot.y + 7.5, 'frost').setOrigin(0).setScale(1.3 / ART).setAngle(180).setDepth(slot.y - 12.4));
    scene.tweens.add({ targets: glass, alpha: 0.07, duration: 1800 + index * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const spill = scene.art(slot.x, slot.y + 13, 'light_spill').setOrigin(0.5, 0).setScale(1.4 / ART, 0.5 / ART).setTint(cool);
    spill.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(0.4);
    lights.push(glass, spill);
    // Время от времени по стеклу пробегает блик — холодильник выглядит стеклянным, а не нарисованным.
    if (!scene.lite) {
      const glint = scene.add.rectangle(slot.x - 15, slot.y - 2, 2, 17, 0xffffff, 0.5).setAngle(18).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(slot.y - 12.3);
      scene.tweens.add({
        targets: glint,
        x: slot.x + 15,
        alpha: { from: 0.55, to: 0 },
        duration: 900,
        delay: 2500 + ((index * 1700) % 5000),
        repeatDelay: 7000 + ((index * 911) % 5000),
        repeat: -1,
        ease: 'Sine.easeIn',
      });
      lights.push(glint);
    }
  }
  // Тень от полки на пол запекается вместе с полом (bakeFloor): свет сверху слева — вниз и вправо.
  if (fixture) lighting.shelfLight(scene, bg, kind, 50, 40, 4);
  else lighting.shelfLight(scene, bg, kind, 58, 50, look.texture === 'fridge' ? 10 : 6);
  // Полка своей марки: на табличке навеса — «От бабушки» (уходит вместе с полкой, как её свет).
  if (kind === 'brand') {
    lights.push(
      scene.add
        .text(slot.x, slot.y - 7.5, t('shelf.brandSign'), { fontFamily: UI_FONT, fontSize: '4.5px', fontStyle: 'bold', color: '#fee761' })
        .setOrigin(0.5)
        .setResolution(scene.textRes(8))
        .setDepth(d - 11.9),
    );
  }
  return { kind, at: { x: slot.x, y: slot.y }, cover, bg, front, shadow, items, backItems, pips, lights, low, expire, glow, needsStock: false };
}

/**
 * Плиточная вставка отдела в полу (art/livefloor.py) нижним краем на bottom; full — её высота
 * в мире, visible — сколько видно (у задней стены верх срезан плинтусом). Лежит на плитке под
 * тенями пола (bakeFloor) — и мебель отбрасывает тень на вставку, как на пол.
 */
export function deptInlay(scene: StoreScene, key: string, x: number, bottom: number, full: number, visible: number): Phaser.GameObjects.Image {
  const img = scene.art(x, bottom, key).setOrigin(0.5, 1).setDepth(DEPT_INLAY_DEPTH);
  if (visible < full) img.setCrop(0, (full - visible) * ART, img.width, visible * ART);
  return img;
}

/**
 * Полка боком у боковой стены: сверху видна длинная полка с отсеками, к нам — торец; товар
 * раскладывается столбиками, покупатель подходит сбоку. У правой стены — зеркально.
 */
export function buildSideShelf(scene: StoreScene, index: number, kind: Category, slot: { x: number; y: number }): ShelfView {
  const look = SHELF_LOOK[kind];
  const right = slotSide(scene.layout, slot) === 'right';
  const d = slot.y + 18;
  const shadow = scene.art(slot.x, slot.y + 2, 'shadow_wide').setScale(0.5 / ART, 1.2 / ART).setAngle(90).setDepth(slot.y - 30);
  const bg = scene.art(slot.x, slot.y, `${look.texture}_side`).setTint(look.tint).setFlipX(right).setDepth(d - 14);
  const front = scene.art(slot.x, slot.y, 'item').setVisible(false);
  bg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => staff.restockShelf(scene, index)));
  const items = Array.from({ length: SHELF_LEVELS[SHELF_LEVELS.length - 1].capacity }, () => scene.art(slot.x, slot.y, 'item').setDepth(d - 13));
  const backItems = items.map(() => scene.art(slot.x, slot.y, 'item').setVisible(false));
  const pips = [0, 1, 2].map((n) => scene.art(slot.x - 4 + n * 4, slot.y - 26, 'pip').setDepth(d - 12));
  const label = (text: string, dy: number, bgColor: string, color = '#ffffff') =>
    scene.add
      .text(slot.x + (right ? -10 : 10), slot.y + dy, text, { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color, backgroundColor: bgColor, padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setResolution(scene.textRes(6))
      .setDepth(990)
      .setVisible(false);
  const low = label('', -18, '#d95763');
  const expire = label(t('shelf.expiring'), -34, '#fee761', '#2b2233');
  const glow = new Halo(scene, bg, 0xfee761);
  const lights: Phaser.GameObjects.GameObject[] = [
    deptInlay(scene, `deptfloor_${kind}_side`, slot.x + (right ? -6 : 6), slot.y + 25, 50, 50),
    scene.art(slot.x, slot.y - 24, `dept_${kind}`).setScale(0.7 / ART).setDepth(d - 11.9),
  ];
  const meter = scene.add.graphics({ x: slot.x + (right ? -12 : 12), y: slot.y }).setDepth(d - 11);
  lighting.shelfLight(scene, bg, kind, 40, 70, 0);
  return { kind, at: { x: slot.x, y: slot.y }, cover: undefined, bg, front, shadow, items, backItems, pips, lights, low, expire, glow, needsStock: false, meter };
}

/** Шкала запаса боковой полки: зелёная — полно, жёлтая — половина, красная — пора нести товар. */
export function drawMeter(meter: Phaser.GameObjects.Graphics, units: number, capacity: number): void {
  const H = 36;
  const share = capacity > 0 ? Math.min(1, units / capacity) : 0;
  const color = share > 0.5 ? 0x63c74d : share > 0.2 ? 0xfee761 : 0xe43b44;
  const fill = Math.round(H * share);
  meter.clear();
  meter.fillStyle(0x2b2233, 0.75).fillRect(-1.5, -H / 2 - 1, 3, H + 2);
  if (fill > 0) meter.fillStyle(color, 1).fillRect(-0.5, H / 2 - fill, 1, fill);
  // Пустая полка — красная точка внизу шкалы, чтобы было видно издалека.
  else meter.fillStyle(0xe43b44, 1).fillRect(-1, H / 2 - 2, 2, 2);
}

export function destroyShelfView(view: ShelfView): void {
  for (const obj of [view.bg, view.front, view.shadow, view.low, view.expire, view.cover, view.meter, ...view.items, ...view.backItems, ...view.pips, ...view.lights]) obj?.destroy();
}

/** Сколько обычных полок стоит на местах в зале (ларь и вёдра — не в счёт). */
export function regularShelves(scene: StoreScene): number {
  return scene.state.shelves.filter((s) => !SHELF_KINDS[s.kind].fixture).length;
}

/** Где стоит полка: на своём месте в зале, ларь — в зале слева от входа, вёдра с цветами — у кассы. */
/** Связи соседних полок (пары и неудачное соседство) — по номерам мест. */
export function links(scene: StoreScene): Link[] {
  const kinds = scene.state.shelves.filter((sh) => !isFixture(sh)).map((sh) => sh.kind);
  return shelfLinks(scene.layout.slots.slice(0, kinds.length).map((p) => slotRect(scene.layout, p)), kinds);
}

/** Номер полки (в state.shelves) на месте slot. */
export function shelfAtSlot(scene: StoreScene, slot: number): number {
  return scene.state.shelves.findIndex((_, i) => slotOf(scene.state, i) === slot);
}

/** Рядом с этой полкой еды стоит химия. */
export function clashes(scene: StoreScene, index: number): boolean {
  const slot = slotOf(scene.state, index);
  if (slot < 0 || scene.state.shelves[index].kind === 'household') return false;
  return links(scene).some((l) => l.kind === 'clash' && (l.a === slot || l.b === slot));
}

/** Что прихватить заодно с соседней полки-пары (или ничего). */
export function pairPick(scene: StoreScene, index: number, wanted: ProductId[]): { id: ProductId; index: number } | null {
  const slot = slotOf(scene.state, index);
  if (slot < 0 || Math.random() >= PAIR_CHANCE) return null;
  const partners = links(scene)
    .filter((l) => l.kind === 'pair' && (l.a === slot || l.b === slot))
    .map((l) => shelfAtSlot(scene, l.a === slot ? l.b : l.a))
    .filter((i) => i >= 0);
  const options = partners.flatMap((i) =>
    PRODUCT_IDS.filter((id) => !wanted.includes(id) && (scene.state.shelves[i].items[id]?.length ?? 0) > 0).map((id) => ({ id, index: i })),
  );
  return options.length ? options[Math.floor(Math.random() * options.length)] : null;
}

/** Вещь на стене (центр x, полуширина half) целиком за полкой у задней стены — её не вешаем, чтобы не торчал краешек. */
export function behindShelf(scene: StoreScene, x: number, half = 6): boolean {
  const n = scene.state.shelves.filter((sh) => !isFixture(sh)).length;
  return scene.layout.slots.slice(0, n).some((p) => p.y === WALL_ROW_Y && Math.abs(p.x - x) < 20 + half);
}

export function spotOf(scene: StoreScene, index: number): { x: number; y: number } {
  const kind = scene.state.shelves[index]?.kind;
  if (kind === 'icebox') return iceboxSpot(scene);
  if (kind === 'florist') return floristSpot(scene);
  if (kind === 'brand') return brandSpot(scene);
  return scene.layout.slots[Math.max(0, slotOf(scene.state, index))];
}

/** Куда встать, чтобы взять с полки: к полке — снизу, к ларю — сверху (со стороны зала), к вёдрам — слева. */
export function standOf(scene: StoreScene, index: number): { x: number; y: number } {
  const p = spotOf(scene, index);
  const kind = scene.state.shelves[index]?.kind;
  if (kind === 'icebox') return { x: p.x, y: p.y - 16 };
  if (kind === 'florist') return { x: p.x - 14, y: p.y + 6 };
  if (kind === 'brand') return { x: p.x, y: p.y + 20 };
  // Обычная полка — снизу, боковая у стены — сбоку (placement.ts).
  return standFor(scene.layout, p);
}

/** Путь из зала к полке. */
export function routeTo(scene: StoreScene, index: number): { x: number; y: number }[] {
  return [standOf(scene, index)];
}

/**
 * Ларь с мороженым — у кассы: у правой стены рядом с очередью, в тесном зале — у нижней стены
 * поближе к кассе; там, где он не задевает места под полки и кассы (layout.ts, iceboxSpotFor).
 */
export function iceboxSpot(scene: StoreScene): { x: number; y: number } {
  // Вещи, переставленные игроком в этом помещении, ларь обходит (как и при перестановке).
  const moved = scene.state.propPos?.level === scene.state.level ? Object.entries(scene.state.propPos.at) : [];
  const avoid = moved.map(([id, p]) => propRect({ id, x: p.x, y: p.y, fp: propFootprint(scene.layout, id, p.x) }));
  return iceboxSpotFor(scene.layout, registerSlots(scene.state), avoid, kioskCount(scene.state));
}

/** Полка «От бабушки» — у входа, на свободном полу у прохода к двери; ларь с мороженым обходит (layout.ts brandSpotFor). */
export function brandSpot(scene: StoreScene): { x: number; y: number } {
  const ice = scene.state.shelves.some((sh) => sh.kind === 'icebox') ? [iceboxRect(iceboxSpot(scene))] : [];
  return brandSpotFor(scene.layout, registerSlots(scene.state), ice, kioskCount(scene.state));
}

/** Вёдра с цветами — у кассы, в углу у правой стены. */
export function floristSpot(scene: StoreScene): { x: number; y: number } {
  const { counter, h } = scene.layout;
  return { x: counter.x + 20, y: h - 40 };
}
