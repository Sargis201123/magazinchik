// Переезды между этажами (14.11, автор: «в левой части экрана должно появиться переключение между этажами — подвал,
// второй и третий этаж. Нажимать в углу магазина на подвал не очень удобно»). Здесь — куда едем и как гаснет и
// светлеет магазин; сам вид этажа — сцена floorView.ts (подгружается по требованию), кнопки — ui/floorSwitch.ts,
// какие кнопки показать — game/floors.ts (floorStops).
//
// Из зала на этаж: переключателем — кадр магазина уезжает вверх (на второй и третий) или вниз (в подвал) и гаснет,
// как кабина лифта; касанием двери в фасаде (basementFx.floorDown) — как раньше, камера подлетает к двери. С этажа
// на этаж и обратно в зал — этим занимается сцена этажа (FloorView.leave), а сюда она сообщает, что приехала
// (arrived) или что мы снова в зале (floorUp). Без тряски; в лёгкой графике кадр не ездит — только гаснет.
//
// Модуль — в первом файле игры (его зовёт StoreScene каждый кадр); вид этажа отсюда только подгружается.

import Phaser from 'phaser';
import type { StoreScene } from '../StoreScene';
import type { FloorView } from '../floorView';
import { FLOOR_IDS, FLOORS, floorStops, hasFloor, stopLevel, type FloorId, type FloorStop, type StopInfo } from '../../game/floors';
import { STORE_LEVELS } from '../../game/economy';
import { t, type TextKey } from '../../i18n';
import { lazy } from '../../platform/lazy';
import { sound } from '../../platform/sound';
import { haptic } from '../../platform/telegram';
import { track } from '../../platform/analytics';
import type { SwitchStop } from '../../ui/floorSwitch';
import { calledElsewhere } from '../camera';

const floorView = lazy('floorView', () => import('../floorView'));

/** Подлёт к двери (касание фасада) и затемнение перед видом этажа (мс). */
const DIVE_MS = 650;
const FADE_MS = 320;
/** Переключателем: кадр магазина уезжает на долю высоты экрана и гаснет (мс). */
const SLIDE_MS = 420;
const SLIDE = 0.12;
/** Переезд не закончился за столько мс (этаж не загрузился, сцену сняли) — переключатель снова слушается. */
const STUCK_MS = 4000;
/** Как часто проверять, не зовёт ли зал (camera.calledElsewhere), пока игрок на этаже. */
const CALL_EVERY = 300;

/** Куда едем (переезд идёт) и когда начали. */
let target: FloorStop | null = null;
let since = 0;
/** Как ушли из зала: подлетели к двери в фасаде или уехали переключателем — так же и вернёмся. */
let via: 'door' | 'slide' = 'slide';
/**
 * Кадр до ухода и кадр, где камера погасла. 13.11, ревью: этаж закрывается и сам — когда день встал на паузу (сценка,
 * ночная смена, итоги). Тот, кто остановил день, мог уже навести камеру магазина (сценка — на гостя); тогда при
 * возврате не уводим её — только возвращаем прежний масштаб.
 */
let before = { x: 0, y: 0, zoom: 1 };
let dived = { x: 0, y: 0 };
/** Зал зовёт (вор у полки, «момент», готовая печь): кнопка «Зал» светится; когда проверить снова. */
let call = false;
let checkAt = 0;

/** Сцена этажа, если она сейчас показана. */
function floorScene(scene: StoreScene): FloorView | null {
  const f = scene.game.scene.getScene('floor') as FloorView | null;
  return f && f.sys.isActive() ? f : null;
}

/** Где игрок сейчас: на этаже (какой) или в зале. Пока едем — уже там, куда едем (кнопка горит сразу). */
export function whereNow(scene: StoreScene): FloorStop {
  return target ?? floorScene(scene)?.id ?? 'hall';
}

/**
 * Поехать: на этаж или в зал. С этажа уезжает сама сцена этажа (FloorView.leave); из зала — гаснет магазин: door —
 * подлететь к двери в фасаде (касание двери), без неё — уехать вверх или вниз, как лифт (переключатель).
 */
export function goFloor(scene: StoreScene, to: FloorStop, door?: { x: number; y: number }): void {
  if (target !== null && performance.now() - since < STUCK_MS) return;
  const floor = floorScene(scene);
  const from: FloorStop = floor?.id ?? 'hall';
  if (to === from) return;
  if (to !== 'hall' && (!scene.running || !hasFloor(scene.state, to))) return;
  target = to;
  since = performance.now();
  haptic.tap();
  sound.tap();
  if (floor) {
    floor.leave(to);
    return;
  }
  if (to === 'hall') {
    target = null;
    return;
  }
  track('floor_view', scene.state.day, 0);
  const cam = scene.cameras.main;
  scene.homeTimer?.remove();
  // Касания магазина на время этажа выключены — палец не пробьёт покупку и не сдвинет камеру внизу.
  scene.input.enabled = false;
  const mod = floorView.load();
  before = { x: cam.midPoint.x, y: cam.midPoint.y, zoom: cam.zoom };
  via = door ? 'door' : 'slide';
  cam.panEffect.reset();
  cam.zoomEffect.reset();
  let fadeAt = 0;
  if (door) {
    cam.pan(door.x, door.y - 10, DIVE_MS, 'Sine.easeInOut', true);
    cam.zoomTo(Math.min(cam.zoom * 2, scene.baseZoom * 2.4), DIVE_MS, 'Sine.easeIn', true);
    fadeAt = DIVE_MS - FADE_MS;
  } else if (!scene.lite) {
    // Вверх — зал уходит вниз (камера поднимается), в подвал — вверх.
    const d = (scene.scale.height * SLIDE) / cam.zoom;
    cam.pan(cam.midPoint.x, cam.midPoint.y - Math.sign(stopLevel(to)) * d, SLIDE_MS, 'Sine.easeIn', true);
    fadeAt = SLIDE_MS - FADE_MS;
  }
  scene.time.delayedCall(fadeAt, () => {
    cam.fadeOut(FADE_MS, 24, 20, 37);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      dived = { x: cam.midPoint.x, y: cam.midPoint.y };
      mod.then(
        (m) => {
          // Этаж не открылся — магазин не должен остаться тёмным и глухим к касаниям.
          try {
            m.openFloor(scene, to);
          } catch (error) {
            floorUp(scene);
            throw error;
          }
        },
        () => floorUp(scene),
      );
    });
  });
}

/**
 * День кончился, пока игрок на этаже: сначала в зал, потом then (окно «Ночная смена?», ритуал закрытия). 14.11, аудит:
 * окно открывалось сразу, и полторы секунды поверх него ещё стоял гаснущий этаж с переключателем. Этажа нет —
 * false, звать then не нужно (зовущий продолжает сам). Сцена этажа не закрылась (не загрузилась, застряла) — then
 * всё равно через STUCK_MS: день не должен встать навсегда.
 */
export function hallFirst(scene: StoreScene, then: () => void): boolean {
  const floor = floorScene(scene);
  if (!floor) return false;
  let done = false;
  const go = (): void => {
    if (done) return;
    done = true;
    then();
  };
  floor.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.time.delayedCall(0, go));
  scene.time.delayedCall(STUCK_MS, go);
  floor.leave('hall');
  return true;
}

/** Сцена этажа встала и светлеет: переезд закончен. */
export function arrived(): void {
  target = null;
}

/**
 * Снова в зале: этаж закрылся — магазин снова рисуется (пока смотрели этаж, его не рисовали — FloorView.create),
 * камера светлеет. Куда смотреть: камеру навёл кто-то другой (сценка — на гостя) — остаёмся там, только прежний
 * масштаб; день идёт — в обычный кадр; день встал (итоги, ночная смена) — туда, где игрок смотрел до ухода. Ушли
 * переключателем — зал въезжает с той стороны, откуда спустились (поднялись); через дверь — камера отлетает от неё.
 */
export function floorUp(scene: StoreScene, from?: FloorId): void {
  target = null;
  call = false;
  scene.scene.setVisible(true);
  if (!scene.sys.isActive()) return;
  scene.input.enabled = true;
  scene.dragged = false;
  const cam = scene.cameras.main;
  cam.resetFX();
  cam.fadeIn(FADE_MS, 24, 20, 37);
  const steered = cam.panEffect.isRunning || Math.hypot(cam.midPoint.x - dived.x, cam.midPoint.y - dived.y) > 3;
  const home = scene.rushView ?? { x: scene.home.x, y: scene.home.y, zoom: scene.baseZoom };
  const view = steered ? { x: cam.midPoint.x, y: cam.midPoint.y, zoom: before.zoom } : scene.running ? home : before;
  if (!steered) {
    if (via === 'slide') {
      // С верхнего этажа вниз — зал поднимается снизу на место (камера была выше), из подвала — наоборот.
      const d = from && !scene.lite ? (scene.scale.height * SLIDE) / view.zoom : 0;
      cam.setZoom(view.zoom).centerOn(view.x, view.y - Math.sign(stopLevel(from ?? 'hall')) * d);
      if (d) cam.pan(view.x, view.y, SLIDE_MS + 120, 'Sine.easeOut', true);
    } else cam.pan(view.x, view.y, DIVE_MS + 200, 'Sine.easeInOut', true);
  }
  cam.zoomTo(view.zoom, DIVE_MS + 200, 'Sine.easeOut', true);
}

/** Открыто ли окно поверх игры (утро, итоги, сценка с выбором): тогда переключателя не видно. */
const modalOpen = (): boolean => document.querySelector('.ui-modal:not(.closing), .ui-tour') !== null;

const STOP_ICON: Record<FloorStop, string> = { third: 'ico_floor_food', second: 'ico_floor_clothes', hall: 'ico_shop', basement: 'ico_floor_cellar' };
const STOP_NAME: Record<FloorId, TextKey> = { basement: 'floor.basement', second: 'floor.second', third: 'floor.third' };

/** Подсказка у серой кнопки: с какого помещения, что сначала, или где открыть и почём. */
function lockHint(stop: StopInfo): string {
  if (stop.id === 'hall') return '';
  const def = FLOORS[stop.id];
  const name = t(STOP_NAME[stop.id]);
  if (stop.lock === 'level') return t('floor.sw.lockLevel', { name, level: t(STORE_LEVELS[def.minLevel].nameKey), cost: def.cost });
  if (stop.lock === 'below') return t('floor.sw.lockBelow', { name });
  return t('floor.sw.lockBuy', { name, cost: def.cost });
}

/**
 * Переключатель этажей (ui/floorSwitch.ts) — каждый кадр из StoreScene.update; перерисовка — только когда что-то
 * поменялось. Виден, пока идёт день (и пока игрок на этаже — чтобы вернуться); нет — в Заречье, на расстановке,
 * в ритуале закрытия и под окнами (утро, итоги, сценки).
 */
export function syncSwitch(scene: StoreScene): void {
  const floor = floorScene(scene);
  const at = whereNow(scene);
  const away = at !== 'hall';
  const visible = (away || (scene.running && scene.timeLeft > 0 && !scene.arranging)) && !modalOpen();
  const now = performance.now();
  if (now >= checkAt) {
    checkAt = now + CALL_EVERY;
    const next = Boolean(floor) && target === null && calledElsewhere(scene);
    // Зал позвал — лёгкий отклик (как раньше у «Наверх»); сами не уводим: игрок решает, когда спуститься.
    if (next && !call) haptic.tap();
    call = next;
  }
  const stops: SwitchStop[] = visible
    ? floorStops(scene.state).map((s) => ({ id: s.id, open: s.open, icon: STOP_ICON[s.id], label: t(`floor.sw.${s.id}` as TextKey), hint: s.open ? '' : lockHint(s) }))
    : [];
  scene.hud.floors.show(stops, at, call && away);
}

/** Кнопка переключателя: открытый этаж или зал — едем; серый — подсказку показывает сам переключатель. */
export function pick(scene: StoreScene, id: FloorStop): void {
  if (id !== 'hall' && !FLOOR_IDS.includes(id)) return;
  goFloor(scene, id);
}
