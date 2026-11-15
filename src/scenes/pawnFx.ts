// Ломбард (game/pawnshop.ts) в зале, пока нет подвала: дверь «Подсобка» в задней стене у туалета.
//
// 15.11, автор: «Ломбард тоже мне непонятен — может убрать из меню и в подвале его держать как комнату в подвале со
// своей вывеской». Плитки в «Уголках» больше нет — ломбард живёт в мире. С подвалом это комната с окошком внизу
// (floors/basementFloor.ts), а до подвала — дверь «Подсобка» с табличкой (рисунок — art/pawnshop.py). Раньше вещи
// стояли на полке «Разное» на стене склада; её не стало — у ломбарда теперь одно место, и его видно.
//  · Касание двери — карточка ломбарда (ui/pawnshop.ts, грузится по требованию): как это работает, «Сегодня»,
//    залоги, полка «Разное», итог.
//  · Гость с вещью ждёт ответа (утром новостью стал не он, pawnWaiting) — над дверью светится метка, пока не
//    ответили. В лёгкой графике метка не прыгает.
//  · Днём к двери иногда идут люди: несёт вещь — уходит с монетами, пришёл выкупить — выходит с вещью. Сколько их —
//    от того, сколько вещей в залоге и на полке (живые случайности зала: на деньги не влияют). В лёгкой графике — реже.
// Где дверь — layout.pawnDoorX: картины, щиток и бра на стене её обходят (shelves.behindShelf). Тряски нет.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { pawnOf, pawnPlace, pawnWaiting, PAWN_ITEM_IDS, type PawnItemId } from '../game/pawnshop';
import { saveGame } from '../game/save';
import type { StoreState } from '../game/economy';
import { t } from '../i18n';
import { lazy, withLazy } from '../platform/lazy';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { BACK_DOOR_HALF, backDoorX, pawnDoorX } from './layout';
import { Halo } from './halo';
import { SHIRTS, customerLook } from './common';
import { UI_FONT } from '../ui/dom';
import * as camera from './camera';
import * as persons from './persons';

/** Карточка ломбарда — отдельным файлом сборки: нужна, только когда коснулись двери или окошка. */
const pawnUi = lazy('pawnCard', () => import('../ui/pawnshop'));

/** Середина двери по высоте (низ — на полу у стены, как у двери туалета) и где встают перед ней. */
const DOOR_Y = 20.5;
/** Как часто пробуем выпустить гостя к двери (мс) в обычной и лёгкой графике. */
const EVERY = 26000;
const EVERY_LITE = 52000;

interface Door {
  img: Phaser.GameObjects.Image;
  halo: Halo;
  mark: Phaser.GameObjects.Image;
  bob?: Phaser.Tweens.Tween;
  busy: boolean;
}

/** Дверь этого зала (перестройка мира рисует новую). */
const doors = new WeakMap<StoreScene, Door>();

/** Поставить дверь «Подсобка» (building.buildShell, рядом с туалетом). Ломбард закрыт или он в подвале — двери нет. */
export function buildPawnDoor(scene: StoreScene): void {
  doors.delete(scene);
  // 15.11, ревью: запомнить, для какого места ломбарда строили зал — купили подвал, и утро перестроит зал без двери
  // (morningFlow.ts сверяет builtPawn с pawnPlace), иначе дверь висела бы до любой другой перестройки.
  scene.builtPawn = pawnPlace(scene.state) ?? '';
  const x = pawnDoorX(scene.layout, scene.state);
  if (x === null) return;
  const img = scene.art(x, DOOR_Y, 'pawn_door').setDepth(2);
  // Табличка над дверью — словом (на любом языке), картинка двери — с биркой ломбарда. Табличка шире двери: слева
  // бывает дверь задней комнаты под аренду (её косяк — до BACK_DOOR_HALF + 1,5), справа туалет — встаёт между ними.
  const label = scene.add.text(x, 4.5, t('pawn.door'), { fontFamily: UI_FONT, fontSize: '3.5px', fontStyle: 'bold', color: '#fee761' }).setOrigin(0.5).setResolution(scene.textRes(6)).setDepth(3.2);
  const half = (label.width + 3) / 2;
  const back = backDoorX(scene.layout, scene.state);
  const lx = Math.min(scene.layout.wc.x - 8 - half, Math.max(x, back === null ? x : back + BACK_DOOR_HALF + 2 + half));
  label.setX(lx);
  scene.add.rectangle(lx, 4.5, 2 * half, 5, 0x3b2a35).setStrokeStyle(0.5, 0xb86f50).setDepth(3.1);
  const halo = new Halo(scene, img, 0xfee761);
  const mark = scene.art(x, -1, 'pawn_mark').setDepth(6).setVisible(false);
  const door: Door = { img, halo, mark, busy: false };
  if (!scene.lite) door.bob = scene.tweens.add({ targets: mark, y: -3, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', paused: true });
  doors.set(scene, door);
  scene.add
    .zone(x, DOOR_Y + 2, 18, 30)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => camera.tap(scene, () => openPawn(scene, (item) => void guest(scene, item, true))));
  scene.worldTimer(scene.lite ? EVERY_LITE : EVERY, () => {
    if (!scene.running || scene.night || scene.timeLeft <= 0 || door.busy) return;
    const p = pawnOf(scene.state);
    // Чем больше вещей в залоге и на полке, тем чаще к двери ходят (выкупить, посмотреть, принести).
    if (Math.random() < Math.min(0.85, 0.3 + 0.12 * (p.loans.length + p.shelf.length))) void guest(scene, pick(scene.state), Math.random() < 0.55);
  });
  refreshPawn(scene);
}

/** Метка «ждут ответа» над дверью — по состоянию (building.refreshWarehouse, после карточки и утра). */
export function refreshPawn(scene: StoreScene): void {
  const door = doors.get(scene);
  if (!door?.img.active) return;
  // Ломбард уже не в зале (переехал в подвал до перестройки) — метку у двери не зажигать: гость ждёт внизу.
  const on = pawnPlace(scene.state) === 'hall' && pawnWaiting(scene.state);
  door.halo.set(on ? 2 : 0);
  door.mark.setVisible(on);
  if (on) door.bob?.resume();
  else door.bob?.pause();
}

/** С какой вещью идут: из залога или с полки (выкупить, присмотреться), иначе — любая. */
function pick(state: StoreState): PawnItemId {
  const p = pawnOf(state);
  const own = [...p.loans.map((l) => l.item), ...p.shelf.map((s) => s.item)];
  return Phaser.Utils.Array.GetRandom(own.length ? own : PAWN_ITEM_IDS);
}

/**
 * Гость ломбарда: с улицы через зал к двери, в проёме тает (за дверью — подсобка), через пару секунд выходит.
 * bring — несёт вещь (в руках) и выходит с монетами; нет — заходит с пустыми руками и выходит с вещью.
 */
async function guest(scene: StoreScene, item: PawnItemId, bring: boolean): Promise<void> {
  const door = doors.get(scene);
  if (!door || door.busy || !scene.running) return;
  door.busy = true;
  const world = scene.worldGen;
  const { door: entry, h, wallH } = scene.layout;
  const x = door.img.x;
  const man = persons.makePerson(scene, entry.x, h + 14, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  const alive = (): boolean => man.active && scene.worldGen === world;
  const held = scene.art(5, 2, `pawn_${item}`).setVisible(bring);
  man.add(held);
  const fade = (alpha: number): Promise<void> => new Promise((done) => scene.tweens.add({ targets: man, alpha, duration: 180, onComplete: () => done() }));
  try {
    await persons.walkVia(scene, man, [{ x: entry.x, y: h - 12 }, { x, y: wallH + 10 }]);
    if (!alive()) return;
    await persons.walkVia(scene, man, [{ x, y: wallH + 3 }], undefined, { direct: true });
    if (!alive()) return;
    await fade(0);
    await scene.wait(Phaser.Math.Between(2200, 3600));
    if (!alive()) return;
    held.setVisible(!bring);
    void fade(1);
    persons.setFacing(man, 'down');
    if (bring) {
      // Отдал вещь — вышел с деньгами: монетка над головой и звон.
      sound.coin(x);
      const coin = scene.art(x, man.y - 16, 'coin').setDepth(man.depth + 1);
      scene.tweens.add({ targets: coin, y: coin.y - 5, alpha: 0, delay: 300, duration: 700, onComplete: () => coin.destroy() });
    }
    await persons.walkVia(scene, man, [{ x, y: wallH + 10 }, { x: entry.x, y: h - 12 }, { x: entry.x, y: h + 14 }]);
    if (alive()) await persons.walk(scene, man, entry.x + (Math.random() < 0.5 ? -1 : 1) * 150, scene.streetY);
  } finally {
    if (scene.worldGen === world) door.busy = false;
    if (man.active) man.destroy();
  }
}

/**
 * Открыть карточку ломбарда поверх игры (дверь в зале, окошко в подвале). День не останавливаем: карточка короткая,
 * а с подвала остановка увела бы обратно в зал (floorView.update). Взяли вещь — onTake (гость с ней идёт к двери);
 * ответили — onChange (метка над окошком в подвале гаснет).
 */
export function openPawn(scene: StoreScene, onTake?: (item: PawnItemId) => void, onChange?: () => void): void {
  sound.tap();
  haptic.tap();
  withLazy(pawnUi, (ui) =>
    ui.openPawnCard(
      () => scene.state,
      (next, feedback) => {
        if (!next || next === scene.state) return;
        const before = scene.state.pawn?.loans.length ?? 0;
        scene.state = next;
        saveGame(next);
        scene.hud.update(next, scene.timeLeft);
        if (feedback === 'success') haptic.success();
        refreshPawn(scene);
        onChange?.();
        const loans = next.pawn?.loans ?? [];
        if (loans.length > before && scene.running && pawnPlace(next)) onTake?.(loans[loans.length - 1].item);
      },
    ),
  );
}
