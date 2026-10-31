// Полки зала: постройка и обновление полок с товаром (refreshShelves), боковые полки со шкалой запаса, ларь
// и вёдра у кассы, вставки отделов в полу, уценка прямо в зале, места и пути к полкам, пары и неудачное
// соседство, утренняя перестановка полок пальцем. Где какие места — layout.ts и placement.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import {
  canPlace,
  promoKind,
  SHELF_LEVELS,
  markdownExpiring,
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
import { saveGame } from '../game/save';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { button, el, openModal, UI_FONT } from '../ui/dom';
import { kioskCount } from '../game/lanes';
import { track } from '../platform/analytics';
import {
  blockedZones,
  canShortenQueue,
  slotRect,
  slotSide,
  standFor,
  wallSnap,
  SIDE_X,
  clampTill,
  iceboxFits,
  overlapsRect,
  propFootprint,
  propIssues,
  propPosFor,
  propRect,
  slotIssues,
  slotPosFor,
  snap,
  tillZones,
  vendingFootprint,
  vendingSide,
  withTill,
  type Prop,
} from './placement';
import { iceboxRect, iceboxSpotFor, layoutFor, WALL_ROW_Y } from './layout';
import { crispZoom } from './pixels';
import { Halo } from './halo';
import { PAIR_CHANCE, shelfLinks, type Link } from '../game/neighbors';
import { fillBargain } from '../game/bargain';
import { gearTier, registerSprite } from '../game/gear';
import { registerSlots } from '../game/registers';
import { cleanHall, dreamShelf } from '../game/firstday';
import {
  HUD_TOP,
  ART,
  LOW_STOCK,
  FURNITURE_TOP,
  LIGHT_DEPTH,
  QUAKE_SHAKE_PX,
  ITEM_VARIANTS,
  SHELF_LOOK,
  DEPT_INLAY_DEPTH,
  ITEM_AREA,
  FLORIST_SPOTS,
  BROKEN_TINT,
  type ShelfView,
} from './common';
import * as motion from './motion';
import * as lighting from './lighting';
import * as staff from './staff';
import * as morningFlow from './morningFlow';
import * as camera from './camera';
import * as building from './building';

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
 * Перестановка полок утром: зал целиком в кадре, каждое место под полку — «призрак», который тянут
 * пальцем по сетке. Место, куда ставить нельзя (вплотную к проходу, на кассе, у двери, так, что к
 * полке не подойти), — красное; «Готово» — только когда красных нет.
 */
export function arrange(scene: StoreScene): void {
  if (scene.arranging) return;
  scene.arranging = true;
  const { w, h } = scene.layout;
  const level = scene.state.level;
  const plain = layoutFor(level);
  const defaults = plain.slots;
  const registers = registerSlots(scene.state);
  let at = scene.layout.slots.map((p) => ({ ...p }));
  // Касса переезжает целиком вдоль нижней стены: сдвиг от стандартного места.
  let tillDx = scene.state.tillPos?.level === level ? scene.state.tillPos.dx : 0;
  // Короткая очередь освобождает верх зала у правой стены.
  let shortQueue = scene.state.tillPos?.level === level && Boolean(scene.state.tillPos.short);
  const placed = () => withTill(plain, { level, dx: tillDx, short: shortQueue }, level);
  // Настоящие полки и разметку прячем — вместо них «призраки»; тени мебели на полу — тоже.
  for (const view of scene.shelfViews.splice(0)) destroyShelfView(view);
  for (const mark of scene.slotDecor) mark?.setVisible(false);
  scene.floor.hide();
  const cam = scene.cameras.main;
  // Весь зал целиком; масштаб ровный (или хотя бы целый) — чуть дальше, если ровно не влезает.
  const fit = Math.min(scene.scale.width / (w + 24), (scene.scale.height - (HUD_TOP + 120) * scene.res) / (h + 24));
  cam.setZoom(crispZoom(fit, ART, 0, fit) || fit).centerOn(w / 2, h / 2 + 10);
  const grid = scene.add.graphics().setDepth(LIGHT_DEPTH + 10);
  grid.lineStyle(0.4, 0x2b2233, 0.18);
  for (let x = 0; x <= w; x += 8) grid.lineBetween(x, scene.layout.wallH, x, h);
  for (let y = scene.layout.wallH; y <= h; y += 8) grid.lineBetween(0, y, w, y);
  // Где полку не поставить (вход, двери флигеля, щиток) — видно сразу, а не только когда полка краснеет.
  for (const z of blockedZones(scene.layout, defaults)) {
    const r = { x: Math.max(0, z.x), y: Math.max(scene.layout.wallH, z.y), w: 0, h: 0 };
    r.w = Math.min(w, z.x + z.w) - r.x;
    r.h = Math.min(h, z.y + z.h) - r.y;
    if (r.w <= 0 || r.h <= 0) continue;
    grid.fillStyle(0xe43b44, 0.12).fillRect(r.x, r.y, r.w, r.h);
    grid.lineStyle(0.6, 0xe43b44, 0.45).strokeRect(r.x, r.y, r.w, r.h);
  }
  // Соседство отделов: зелёная связь — пара (берут вместе), красная — химия рядом с едой.
  const linkG = scene.add.graphics().setDepth(LIGHT_DEPTH + 13);
  // Какая полка в каком месте: обычные полки занимают места по порядку покупки.
  const kinds = scene.state.shelves.filter((sh) => !SHELF_KINDS[sh.kind].fixture).map((sh) => sh.kind);
  // Полка у боковой стены — боком: картинка и место на полу другие.
  const styleGhost = (ghost: Phaser.GameObjects.Container, i: number) => {
    const kind = kinds[i];
    const look = kind ? SHELF_LOOK[kind] : null;
    const side = slotSide(scene.layout, at[i]);
    const img = ghost.getData('img') as Phaser.GameObjects.Image;
    if (side) img.setTexture(look ? `${look.texture}_side` : 'slot_empty').setPosition(0, 0).setAngle(look ? 0 : 90).setFlipX(side === 'right');
    else img.setTexture(look ? look.texture : 'slot_empty').setPosition(0, look ? -FURNITURE_TOP / 2 : 2).setAngle(0).setFlipX(false);
    if (look) img.setTint(look.tint);
    const r = slotRect(scene.layout, at[i]);
    ghost.setSize(Math.max(20, r.w + 4), Math.max(30, r.h + 6));
    ghost.input?.hitArea.setTo(0, 0, ghost.width, ghost.height);
  };
  const ghosts = at.map((p, i) => {
    const img = scene.art(0, 0, 'slot_empty');
    const frame = scene.add.graphics();
    const ghost = scene.add.container(p.x, p.y, [img, frame]).setDepth(LIGHT_DEPTH + 11);
    ghost.setData('frame', frame).setData('img', img);
    ghost.setSize(44, 30);
    ghost.setInteractive({ draggable: true, useHandCursor: true });
    styleGhost(ghost, i);
    return ghost;
  });
  // Касса — тоже «призрак»: тянется только влево-вправо, вместе с очередью и всем, что при ней.
  const tillFrame = scene.add.graphics();
  const tillImg = scene.art(0, FURNITURE_TOP / 2, registerSprite(scene.state));
  const till = scene.add.container(scene.layout.counter.x, scene.layout.counter.y, [tillFrame, tillImg]).setDepth(LIGHT_DEPTH + 11);
  till.setSize(32, 62).setInteractive({ draggable: true, useHandCursor: true });
  const drawTill = (bad: boolean) => {
    const lay = placed();
    tillFrame.clear();
    for (const z of tillZones(lay, registers, kioskCount(scene.state))) {
      const r = { x: z.x - lay.counter.x, y: z.y - lay.counter.y, w: z.w, h: z.h };
      tillFrame.fillStyle(bad ? 0xe43b44 : 0x2ce8f5, 0.18).fillRect(r.x, r.y, r.w, r.h);
      tillFrame.lineStyle(1, bad ? 0xe43b44 : 0x0099db, 0.9).strokeRect(r.x, r.y, r.w, r.h);
    }
  };
  // Вещи зала (автомат, ведро, растения) — тоже «призраки», их тянут свободно.
  const props: (Prop & { tex: string; oy?: number })[] = scene.propList.map((p) => ({ ...p, fp: { ...p.fp } }));
  const propGhosts = props.map((p) => {
    const img = scene.art(0, p.oy ?? 0, p.tex);
    const frame = scene.add.graphics();
    const ghost = scene.add.container(p.x, p.y, [frame, img]).setDepth(LIGHT_DEPTH + 11);
    ghost.setSize(Math.max(16, p.fp.w), Math.max(16, p.fp.h)).setInteractive({ draggable: true, useHandCursor: true });
    ghost.setData('frame', frame).setData('img', img);
    return ghost;
  });
  const propDefault = (id: string) => scene.propDefaults[id];
  const bar = el('div', 'ui-arrange');
  const hint = el('div', 'ui-arrange-hint', t('arrange.hint'));
  const done = button(t('arrange.done'), () => finish(true), 'ui-btn');
  const reset = button(t('arrange.reset'), () => {
    at = defaults.map((p) => ({ ...p }));
    ghosts.forEach((g, i) => {
      g.setPosition(at[i].x, at[i].y);
      styleGhost(g, i);
    });
    tillDx = 0;
    shortQueue = false;
    queueBtn.textContent = t('arrange.queueShort');
    till.setPosition(plain.counter.x, plain.counter.y);
    props.forEach((p, i) => {
      const d = propDefault(p.id);
      if (d) movePropTo(i, d.x, d.y);
    });
    check();
  }, 'ui-btn secondary');
  const cancel = button(t('arrange.cancel'), () => finish(false), 'ui-btn secondary');
  const row = el('div', 'ui-arrange-row');
  row.append(cancel, reset, done);
  // Длинная очередь тянется до задней стены, короткая — стоит плотнее и освобождает верх зала.
  const queueBtn = button(t(shortQueue ? 'arrange.queueLong' : 'arrange.queueShort'), () => {
    shortQueue = !shortQueue;
    queueBtn.textContent = t(shortQueue ? 'arrange.queueLong' : 'arrange.queueShort');
    check();
  }, 'ui-btn secondary ui-arrange-queue');
  if (canShortenQueue(plain)) bar.append(hint, queueBtn, row);
  else bar.append(hint, row);
  document.body.append(bar);
  // Автомат у боковой стены разворачивается боком.
  const movePropTo = (i: number, x: number, y: number) => {
    const p = props[i];
    p.x = x;
    p.y = y;
    if (p.id === 'vending') {
      const side = vendingSide(plain, x);
      p.tex = side ? 'vending_side' : 'vending';
      p.fp = vendingFootprint(side);
      (propGhosts[i].getData('img') as Phaser.GameObjects.Image).setTexture(p.tex).setFlipX(side && x < w / 2);
    }
    propGhosts[i].setPosition(x, y);
  };
  const check = () => {
    const lay = placed();
    const bad = slotIssues(lay, at, defaults, registers, props.map(propRect), kioskCount(scene.state));
    const badProps = propIssues(lay, at, props, registers, kioskCount(scene.state));
    // След праздничной вещи вырос книзу (чтобы гости обходили кадку), но проверять её место — по
    // прежнему: ёлка, переставленная игроком раньше, не должна вдруг стать красной.
    if (badProps.has('holiday')) {
      const legacy = props.map((p) => (p.id === 'holiday' ? { ...p, fp: { x: -7, y: -8, w: 14, h: 12 } } : p));
      if (!propIssues(lay, at, legacy, registers, kioskCount(scene.state)).has('holiday')) badProps.delete('holiday');
    }
    // Вещь на своём стандартном месте игра поставила сама так, чтобы не мешать (растение у будущей
    // кассы, у двери склада) — красной она становится, только если на неё поставили полку.
    for (const p of props) {
      const d = propDefault(p.id);
      if (d && d.x === p.x && d.y === p.y && !at.some((s) => overlapsRect(slotRect(lay, s), propRect(p)))) badProps.delete(p.id);
    }
    // Ларь ищет место сам — вещь не должна занять его место.
    if (scene.state.shelves.some((sh) => sh.kind === 'icebox')) {
      const ice = iceboxRect(iceboxSpotFor({ ...lay, slots: at }, registers, props.map(propRect), kioskCount(scene.state)));
      for (const p of props) if (overlapsRect(propRect(p), ice)) badProps.add(p.id);
    }
    propGhosts.forEach((g, i) => {
      const frame = g.getData('frame') as Phaser.GameObjects.Graphics;
      const { fp, id } = props[i];
      const red = badProps.has(id);
      frame.clear();
      frame.fillStyle(red ? 0xe43b44 : 0xfee761, 0.3).fillRect(fp.x, fp.y, fp.w, fp.h);
      frame.lineStyle(1, red ? 0xe43b44 : 0xb86f50, 1).strokeRect(fp.x, fp.y, fp.w, fp.h);
    });
    // Кассу подсвечиваем красным, если на её месте или в очереди стоит красная полка.
    drawTill(tillZones(lay, registers, kioskCount(scene.state)).some((z) => at.some((p, i) => bad.has(i) && overlapsRect(slotRect(lay, p), z))));
    ghosts.forEach((g, i) => {
      const frame = g.getData('frame') as Phaser.GameObjects.Graphics;
      const abs = slotRect(lay, at[i]);
      const r = { x: abs.x - at[i].x, y: abs.y - at[i].y, w: abs.w, h: abs.h };
      frame.clear();
      frame.fillStyle(bad.has(i) ? 0xe43b44 : 0x63c74d, 0.28).fillRect(r.x, r.y, r.w, r.h);
      frame.lineStyle(1, bad.has(i) ? 0xe43b44 : 0x3e8948, 1).strokeRect(r.x, r.y, r.w, r.h);
    });
    linkG.clear();
    for (const link of shelfLinks(at.map((p) => slotRect(lay, p)), at.map((_, i) => kinds[i]))) {
      const [a, b] = [at[link.a], at[link.b]];
      const color = link.kind === 'pair' ? 0x63c74d : 0xe43b44;
      linkG.lineStyle(1.5, color, 0.95).lineBetween(a.x, a.y - 4, b.x, b.y - 4);
      linkG.fillStyle(0xffffff, 1).fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2 - 4, 2.6);
      linkG.fillStyle(color, 1).fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2 - 4, 1.8);
    }
    // Ларь ищет место сам — после перестановки ему должно найтись место у стены.
    const iceless = scene.state.shelves.some((sh) => sh.kind === 'icebox') && !iceboxFits(lay, at, registers, props.map(propRect), kioskCount(scene.state));
    done.disabled = bad.size > 0 || badProps.size > 0 || iceless;
    hint.textContent = bad.size || badProps.size ? t('arrange.bad', { n: bad.size + badProps.size }) : iceless ? t('arrange.icebox') : t('arrange.hint');
    return iceless || badProps.size ? new Set([...bad, -1]) : bad;
  };
  const onDrag = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, x: number, y: number) => {
    if (obj === till) {
      tillDx = clampTill(plain, registers, x - plain.counter.x);
      till.setPosition(plain.counter.x + tillDx, plain.counter.y);
      check();
      return;
    }
    const k = propGhosts.indexOf(obj as Phaser.GameObjects.Container);
    if (k >= 0) {
      movePropTo(k, Phaser.Math.Clamp(snap(x), 6, w - 6), Phaser.Math.Clamp(snap(y), scene.layout.wallH + 8, h - 8));
      propGhosts[k].setDepth(LIGHT_DEPTH + 12);
      check();
      return;
    }
    const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
    if (i < 0) return;
    // У боковой стены полка «прилипает» к ней и разворачивается боком.
    let gx = snap(x);
    gx = gx < 20 ? SIDE_X : gx > w - 20 ? w - SIDE_X : gx;
    const sideNow = gx === SIDE_X || gx === w - SIDE_X;
    // У задней стены — «прилипает» к ней вплотную.
    const gy = Phaser.Math.Clamp(snap(y), scene.layout.wallH + (sideNow ? 22 : 4), h - (sideNow ? 24 : 28));
    at[i] = { x: gx, y: wallSnap(scene.layout, { x: gx, y: gy }) };
    ghosts[i].setPosition(at[i].x, at[i].y).setDepth(LIGHT_DEPTH + 12);
    styleGhost(ghosts[i], i);
    check();
  };
  // Откуда взяли полку: если бросить её на другую полку или на пустое место, они меняются местами.
  let dragFrom: { x: number; y: number } | null = null;
  const onDragStart = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
    const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
    dragFrom = i >= 0 ? { ...at[i] } : null;
  };
  const onDragEnd = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
    (obj as Phaser.GameObjects.Container).setDepth?.(LIGHT_DEPTH + 11);
    haptic.tap();
    const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
    if (i < 0 || !dragFrom) return;
    const mine = slotRect(scene.layout, at[i]);
    const area = (j: number) => {
      const o = slotRect(scene.layout, at[j]);
      return Math.max(0, Math.min(mine.x + mine.w, o.x + o.w) - Math.max(mine.x, o.x)) * Math.max(0, Math.min(mine.y + mine.h, o.y + o.h) - Math.max(mine.y, o.y));
    };
    const others = at.map((_, j) => j).filter((j) => j !== i && area(j) > 0);
    if (!others.length) return;
    const j = others.reduce((a, b) => (area(b) > area(a) ? b : a));
    at[i] = { ...at[j] };
    at[j] = dragFrom;
    for (const k of [i, j]) {
      ghosts[k].setPosition(at[k].x, at[k].y);
      styleGhost(ghosts[k], k);
    }
    check();
  };
  // В первый раз — коротко, что можно делать в перестановке.
  if (!scene.state.arrangeIntro) {
    scene.state = { ...scene.state, arrangeIntro: true };
    saveGame(scene.state);
    const { card, close } = openModal();
    const list = el('ul', 'ui-arrange-intro');
    for (const key of ['arrange.intro.drag', 'arrange.intro.side', 'arrange.intro.swap', 'arrange.intro.red', 'arrange.intro.links', 'arrange.intro.queue'] as const) {
      if (key === 'arrange.intro.queue' && !canShortenQueue(plain)) continue;
      list.append(el('li', '', t(key)));
    }
    card.append(el('h2', '', t('arrange.intro.title')), list, button(t('arrange.intro.ok'), close, 'ui-btn'));
  }
  scene.input.on('dragstart', onDragStart);
  scene.input.on('drag', onDrag);
  scene.input.on('dragend', onDragEnd);
  check();
  const finish = (save: boolean) => {
    if (save && check().size) return;
    scene.input.off('dragstart', onDragStart);
    scene.input.off('drag', onDrag);
    scene.input.off('dragend', onDragEnd);
    bar.remove();
    grid.destroy();
    linkG.destroy();
    ghosts.forEach((g) => g.destroy());
    propGhosts.forEach((g) => g.destroy());
    till.destroy();
    scene.arranging = false;
    if (save) {
      scene.state = {
        ...scene.state,
        slotPos: slotPosFor(level, at),
        tillPos: tillDx || shortQueue ? { level, dx: tillDx, ...(shortQueue ? { short: true } : {}) } : undefined,
        propPos: propPosFor(level, props, scene.propDefaults),
      };
      saveGame(scene.state);
      track('arrange', scene.state.day, at.length);
    }
    // Всё пересобираем по новым местам (обход, ларь, растения) и возвращаемся к утру.
    scene.buildWorld();
    morningFlow.showMorning(scene);
  };
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
    view.promo.setVisible(PRODUCT_IDS.some((id) => canPlace(id, shelf) && promoKind(scene.state, id)));
    const few = !shelf.broken && units.length > 0 && units.length <= LOW_STOCK;
    // Пустая полка — серая табличка «пусто»: видно, что кончился товар, а не что полка сломана.
    const empty = !shelf.broken && units.length === 0 && shelf.kind !== 'florist';
    if (few) view.low.setText(t('shelf.low', { n: units.length })).setBackgroundColor('#d95763');
    else if (empty) view.low.setText(t('shelf.empty')).setBackgroundColor('#5a6988');
    view.low.setVisible(few || empty);
    if (view.meter) drawMeter(view.meter, units.length, capacity, Boolean(shelf.broken));
    view.expire.setVisible(!shelf.broken && expiringIn(scene.state, shelf.items) > 0);
    view.needsStock = !shelf.broken && units.length === 0 && PRODUCT_IDS.some((id) => canPlace(id, shelf) && (scene.state.warehouse[id]?.length ?? 0) > 0);
    view.bg.setTint(shelf.broken ? BROKEN_TINT : SHELF_LOOK[shelf.kind].tint);
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
  const d = kind === 'icebox' ? slot.y + 10 : slot.y;
  bg.setDepth(d - 14);
  front.setDepth(d - 12);
  const cover = undefined;
  bg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => staff.restockShelf(scene, index)));
  const items = Array.from({ length: SHELF_LEVELS[SHELF_LEVELS.length - 1].capacity }, () => scene.art(slot.x, slot.y, 'item').setDepth(d - 13));
  const backItems = items.map(() => scene.art(slot.x, slot.y, 'item').setDepth(d - 13.5).setTint(0x8f8278).setVisible(false));
  // Уровень улучшения — жёлтые точки над полкой.
  const pips = [0, 1, 2].map((n) => scene.art(slot.x + (fixture ? -6 : -17) + n * 4, slot.y - (kind === 'florist' ? 18 : 16), 'pip').setDepth(d - 12));
  // Красный ценник «АКЦИЯ» над полкой с товаром дня.
  const promo = scene.add
    .text(slot.x - 12, slot.y - 22, t('shelf.promo'), { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#e43b44', padding: { x: 2, y: 1 } })
    .setOrigin(0.5)
    .setResolution(scene.textRes(6))
    .setDepth(990)
    .setAngle(-8)
    .setVisible(false);
  scene.tweens.add({ targets: promo, angle: 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
  expire.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => markdownNow(scene, expire.x, expire.y)));
  const lights: Phaser.GameObjects.GameObject[] = [];
  // Плиточная вставка отдела в полу под полкой и перед ней, шириной с полку (art/livefloor.py): узор
  // и кайма в тон отдела. У задней стены вставка начинается от плинтуса — на стену не заходит.
  const tileTop = Math.max(slot.y - 11, scene.layout.wallH);
  if (!fixture) lights.push(deptInlay(scene, `deptfloor_${kind}`, slot.x, slot.y + 19, 30, slot.y + 19 - tileTop));
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
  return { kind, at: { x: slot.x, y: slot.y }, cover, bg, front, shadow, items, backItems, pips, lights, low, expire, promo, glow, needsStock: false };
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
  const promo = label(t('shelf.promo'), -26, '#e43b44');
  const low = label('', -18, '#d95763');
  const expire = label(t('shelf.expiring'), -34, '#fee761', '#2b2233');
  expire.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(scene, () => markdownNow(scene, expire.x, expire.y)));
  const glow = new Halo(scene, bg, 0xfee761);
  const lights: Phaser.GameObjects.GameObject[] = [
    deptInlay(scene, `deptfloor_${kind}_side`, slot.x + (right ? -6 : 6), slot.y + 25, 50, 50),
    scene.art(slot.x, slot.y - 24, `dept_${kind}`).setScale(0.7 / ART).setDepth(d - 11.9),
  ];
  const meter = scene.add.graphics({ x: slot.x + (right ? -12 : 12), y: slot.y }).setDepth(d - 11);
  lighting.shelfLight(scene, bg, kind, 40, 70, 0);
  return { kind, at: { x: slot.x, y: slot.y }, cover: undefined, bg, front, shadow, items, backItems, pips, lights, low, expire, promo, glow, needsStock: false, meter };
}

/** Шкала запаса боковой полки: зелёная — полно, жёлтая — половина, красная — пора нести товар. */
export function drawMeter(meter: Phaser.GameObjects.Graphics, units: number, capacity: number, broken: boolean): void {
  const H = 36;
  const share = capacity > 0 ? Math.min(1, units / capacity) : 0;
  const color = broken ? 0x8b9bb4 : share > 0.5 ? 0x63c74d : share > 0.2 ? 0xfee761 : 0xe43b44;
  const fill = Math.round(H * share);
  meter.clear();
  meter.fillStyle(0x2b2233, 0.75).fillRect(-1.5, -H / 2 - 1, 3, H + 2);
  if (fill > 0) meter.fillStyle(color, 1).fillRect(-0.5, H / 2 - fill, 1, fill);
  // Пустая полка — красная точка внизу шкалы, чтобы было видно издалека.
  else if (!broken) meter.fillStyle(0xe43b44, 1).fillRect(-1, H / 2 - 2, 2, 2);
}

/** Уценить всё, что испортится ночью (на полках и складе), прямо в зале — по ценнику «⏳». */
export function markdownNow(scene: StoreScene, x: number, y: number): void {
  // Есть полка уценки — старое уходит туда, под табличку «АКЦИЯ».
  if (scene.bargainAt && fillBargain(scene.state).count) {
    building.sendToBargain(scene);
    return;
  }
  const { state, count } = markdownExpiring(scene.state);
  if (!count) return;
  scene.state = state;
  saveGame(state);
  sound.coin();
  scene.popup(x, y - 6, t('popup.markdown', { n: count }), '#fff3b0');
  scene.refreshShelves();
}

export function destroyShelfView(view: ShelfView): void {
  for (const obj of [view.bg, view.front, view.shadow, view.low, view.expire, view.promo, view.cover, view.meter, ...view.items, ...view.backItems, ...view.pips, ...view.lights]) obj?.destroy();
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
    .filter((i) => i >= 0 && !scene.state.shelves[i].broken);
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
  return scene.layout.slots[Math.max(0, slotOf(scene.state, index))];
}

/** Куда встать, чтобы взять с полки: к полке — снизу, к ларю — сверху (со стороны зала), к вёдрам — слева. */
export function standOf(scene: StoreScene, index: number): { x: number; y: number } {
  const p = spotOf(scene, index);
  const kind = scene.state.shelves[index]?.kind;
  if (kind === 'icebox') return { x: p.x, y: p.y - 16 };
  if (kind === 'florist') return { x: p.x - 14, y: p.y + 6 };
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

/** Вёдра с цветами — у кассы, в углу у правой стены. */
export function floristSpot(scene: StoreScene): { x: number; y: number } {
  const { counter, h } = scene.layout;
  return { x: counter.x + 20, y: h - 40 };
}
