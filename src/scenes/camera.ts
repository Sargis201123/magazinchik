// Камера и касания: обычный кадр под холст (масштаб — pixels.ts), подлёт к магазину в начале дня, осмотр
// квартала пальцем и щипком с возвратом домой, поворот или новый размер холста, касание улицы под магазином
// вместо кассы, отсечение невидимого за краем кадра и замер FPS (quality.ts упрощает графику на медленных).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { toast } from '../ui/dom';
import { track } from '../platform/analytics';
import { buildingSpan } from './layout';
import { crispZoom, homeFrame } from './pixels';
import { deferLiteNote, fpsSummary, fpsVerdict, lowerQuality, qualityChosen } from '../platform/quality';
import { quietDays } from '../game/firstday';
import { framesThrottled } from '../platform/frameCap';
import { HUD_TOP, ART, FACADE_H, LIGHT_DEPTH, STREET_TAP_MS } from './common';
import * as motion from './motion';

/** Снизу подсказки — магазин рисуем над ними (в базовых точках, × res; сверху — HUD_TOP в common.ts). */
const HUD_BOTTOM = 80;
/** Сколько первых дней ларёк снят ближе (флигель — только склад): см. frameCamera. */
const KIOSK_CLOSE_DAYS = 3;
/** Запас по бокам обычного кадра (в точках мира): наружная стена флигеля и правая стена не впритык к краю экрана. */
const FRAME_PAD = 1;
/** Верх вывески над стеной магазина: под верхнюю панель — без полосы пустого газона. */
const SIGN_TOP = -16;
/** На сколько выше по залу стоит следующая пара касс. */
/** Насколько далеко можно отвести камеру от магазина пальцем. */
const CAMERA_REACH = 200;
/** Перед уходом бабушка показывает, что пробивать можно и касанием улицы: столько мс до прощания. */
const ONB_ROAD_MS = 4500;

/**
 * Обычный кадр — масштаб и середина (baseZoom, home) под нынешний холст: при постройке зала и когда
 * холст меняется (полный экран Telegram, поворот планшета).
 * Внизу кадра видна улица: тротуар и дорога с машинами. Камера показывает весь магазин: по ширине —
 * от наружной стены флигеля до правой стены зала, по высоте — от вывески до фасада; участок под
 * расширение и улицу видно краем, а весь квартал — свайпом или отдалив двумя пальцами.
 */
export function frameCamera(scene: StoreScene): void {
  const { width, height } = scene.scale;
  const top = HUD_TOP * scene.res;
  const bottom = HUD_BOTTOM * scene.res;
  const { h } = scene.layout;
  // В кадре целиком и флигель слева (склад, пекарня, кофейня, кухня — с табличками), и правая стена зала:
  // на узком телефоне камера раньше подходила ближе ради ровного масштаба, и флигель уходил за край.
  // Масштаб ровный (пиксель рисунка — целое число пикселей экрана), но не крупнее «впритык» и не намного
  // мельче; иначе дробный — весь магазин в кадре важнее ровных пикселей (scenes/pixels.ts).
  const span = buildingSpan(scene.layout);
  // Первые дни в ларьке: от флигеля в кадре только склад с дверью в зал (запертые пекарня и кофейня ещё
  // пусты) — камера на шаг ближе, ларёк на телефоне крупнее там, где новичок решает, остаться ли в игре.
  const closeKiosk = scene.state.level === 0 && scene.state.day <= KIOSK_CLOSE_DAYS;
  const left = closeKiosk ? Math.round(span.left / 2) : span.left - FRAME_PAD;
  const { zoom, x } = homeFrame(width, height - top - bottom, { left, right: span.right + FRAME_PAD }, h + (closeKiosk ? 34 : 40), ART);
  const midY = top + (height - top - bottom) / 2;
  scene.baseZoom = zoom;
  // Если по высоте есть запас, вывеска прижимается под верхнюю панель — снизу видно больше улицы.
  const centered = (h + 4) / 2 + (height / 2 - midY) / zoom;
  const signUnderHud = SIGN_TOP + (height / 2 - top) / zoom;
  // Середина — на целой точке мира: камера в покое не сдвинута на полпикселя рисунка.
  scene.home = { x, y: Math.round(Math.max(centered, signUnderHud)) };
}

/**
 * Отсечение: то, что не двигается и сейчас за краем экрана, камера не рисует (через cameraFilter —
 * собственную видимость объектов не трогаем). В большом магазине за кадром ~800 деревьев, кустов
 * и домов — на слабом телефоне это треть времени отрисовки.
 */
export function cullView(scene: StoreScene): void {
  const cam = scene.cameras.main;
  if (scene.cullDirty) {
    scene.cullDirty = false;
    scene.cullAt = '';
    // Люди и звери (контейнеры, кот, Бобик) ходят, частицы летают — их не трогаем.
    const moving = new Set<unknown>([scene.catImg, scene.bobik]);
    scene.cullables = [];
    for (const obj of scene.children.list) {
      if (obj.type === 'Container' || obj.type === 'ParticleEmitter' || moving.has(obj)) continue;
      // Прибитое к экрану (виньетка) не отсекается по месту в мире.
      if ((obj as unknown as Phaser.GameObjects.Components.ScrollFactor).scrollFactorX === 0) continue;
      const shape = obj as unknown as Phaser.GameObjects.Components.GetBounds & { cameraFilter: number };
      if (typeof shape.getBounds !== 'function') continue;
      scene.cullables.push({ obj: obj as Phaser.GameObjects.GameObject & { cameraFilter: number }, box: shape.getBounds() });
    }
  }
  // Пересчитываем, только когда видимая область сдвинулась или приблизилась. Ключ — по самой
  // видимой области (worldView), а не по scroll: после прыжка камеры worldView обновляется лишь
  // к следующему кадру, и по scroll отсечение застряло бы со старым видом — пропадали дома и деревья.
  const v = cam.worldView;
  const key = `${Math.round(v.x)}|${Math.round(v.y)}|${Math.round(v.width)}|${scene.cullables.length}`;
  if (key === scene.cullAt) return;
  scene.cullAt = key;
  const margin = 24;
  const view = new Phaser.Geom.Rectangle(v.x - margin, v.y - margin, v.width + margin * 2, v.height + margin * 2);
  for (const c of scene.cullables) {
    if (!c.obj.active) continue;
    c.obj.cameraFilter = Phaser.Geom.Rectangle.Overlaps(view, c.box) ? 0 : cam.id;
  }
}

/**
 * FPS по секундам, пока идёт день и вкладка на экране. Если игра заметно тормозит (медиана за
 * полминуты, quality.ts) — графика на несколько дней проще: с высокой на обычную, а совсем медленно —
 * лёгкая (о ней говорим). Ровные 30 кадров (энергосбережение iPhone) — не тормоза.
 */
export function measureFps(scene: StoreScene, deltaMs: number): void {
  // Свернули вкладку, окно поверх зала (там кадров нарочно меньше) — такие кадры не в счёт.
  if (!scene.running || document.hidden || framesThrottled() || deltaMs > 250) {
    scene.fpsFrames = 0;
    scene.fpsMs = 0;
    return;
  }
  scene.fpsFrames++;
  scene.fpsMs += deltaMs;
  if (scene.fpsMs < 1000) return;
  scene.fpsSamples.push((scene.fpsFrames * 1000) / scene.fpsMs);
  if (scene.fpsSamples.length > 600) scene.fpsSamples.shift();
  scene.fpsFrames = 0;
  scene.fpsMs = 0;
  // Судим по полминуте замеров после прошлого понижения: сначала видно, помогло ли оно.
  if (++scene.fpsSince < 30) return;
  const recent = scene.fpsSamples.slice(-30);
  const verdict = fpsVerdict(recent, scene.gfx);
  // Игрок сам выбрал графику в профиле — её не трогаем.
  if (!verdict || qualityChosen()) return;
  scene.fpsSince = 0;
  scene.gfx = verdict;
  lowerQuality(verdict);
  // Виньетки больше нет, в лёгкой — и цветокоррекции; карта освещения грубее — с ближайшей перестройки.
  scene.grade.setTier(verdict);
  scene.light.setTier(verdict);
  const median = fpsSummary(recent)?.median ?? 0;
  if (verdict !== 'lite') {
    track('gfx_auto', scene.state.day, median);
    return;
  }
  scene.lite = true;
  track('lite_auto', scene.state.day, median);
  // Первые тихие дни новичка: лёгкая включается молча, а записка о ней — утром 4-го дня (firstday.ts).
  if (quietDays(scene.state)) deferLiteNote();
  else toast('assets/ico_phone.png', t('lite.autoTitle'), t('lite.autoText'));
}

/** Нажатие засчитывается, только если палец не двигал камеру. */
export function tap(scene: StoreScene, action: () => void): void {
  if (!scene.dragged) action();
}

/** Квартал можно рассмотреть, проведя пальцем; через несколько секунд камера возвращается к магазину. */
export function setupCameraDrag(scene: StoreScene): void {
  const cam = scene.cameras.main;
  scene.input.on('gameobjectup', (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => motion.tapFx(scene, p, obj));
  // Новый жест — с первым пальцем. Второй палец (щипок, касания внахлёст, ладонь у края экрана)
  // жест не сбрасывает и сам его сдвигом не делает: сдвигом считается только движение пальцев.
  scene.input.on('pointerdown', () => {
    if (!(scene.input.pointer1.isDown && scene.input.pointer2.isDown)) scene.dragged = false;
    // Игрок здесь — подсказка «что дальше» гаснет.
    scene.lastTouch = scene.time.now;
    scene.nudgeUntil = 0;
  });
  scene.input.addPointer(1);
  // Пока пальцы двигаются, масштаб любой — плавно; отпустили — доходит до ближайшего ровного
  // (пиксель рисунка — целое число пикселей экрана), иначе картинка так и останется в ряби.
  let zoomed = false;
  const zoomTo = (z: number) => {
    cam.zoomEffect.reset();
    cam.setZoom(Phaser.Math.Clamp(z, scene.baseZoom * 0.5, scene.baseZoom * 2.2));
    zoomed = true;
  };
  const settle = () => {
    if (!zoomed) return;
    zoomed = false;
    // Большой магазин: развёл пальцы до общего плана — значит, хочет видеть весь магазин; свёл — ближе к кассам.
    if (bigStore(scene) && scene.rushView) {
      const mid = (scene.baseZoom + scene.rushView.zoom) / 2;
      if (cam.zoom < mid && !prefersWide()) setPrefersWide(true);
    } else if (bigStore(scene) && prefersWide() && cam.zoom > scene.baseZoom * 1.25) setPrefersWide(false);
    const target = crispZoom(cam.zoom, ART, scene.baseZoom * 0.5, scene.baseZoom * 2.2);
    if (target && target !== cam.zoom) cam.zoomTo(target, 160, 'Sine.easeOut', true);
  };
  // Середина кадра под пальцем — без округления: камера рисуется с шагом в целую точку мира
  // (roundPixels), и медленный палец иначе терял бы сдвиг меньше точки — в одну сторону.
  let drag: { x: number; y: number } | null = null;
  // Колёсико на компьютере: ровный масштаб — когда колёсико затихло.
  scene.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
    if (scene.arranging) return;
    zoomTo(cam.zoom * (dy > 0 ? 0.9 : 1.1));
    scene.wheelTimer?.remove();
    scene.wheelTimer = scene.time.delayedCall(200, settle);
    scheduleHome(scene);
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    // Пока переставляют полки, палец двигает полку, а не камеру.
    if (scene.arranging) return;
    const a = scene.input.pointer1;
    const b = scene.input.pointer2;
    // Палец сдвинулся — каждый считается от того места, где коснулся.
    const slop = 12 * scene.res;
    if (a.isDown && b.isDown) {
      // Оба пальца почти на месте — это ещё не щипок (два касания внахлёст), касание засчитается.
      if (!scene.dragged && a.getDistance() < slop && b.getDistance() < slop) return;
      // Два пальца: приближаем или отдаляем.
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      scene.pinch ??= { dist, zoom: cam.zoom };
      zoomTo(scene.pinch.zoom * (dist / scene.pinch.dist));
      scene.dragged = true;
      scene.homeTimer?.remove();
      drag = null;
      return;
    }
    scene.pinch = null;
    if (!p.isDown) return;
    if (!scene.dragged && p.getDistance() < slop) return;
    scene.dragged = true;
    scene.homeTimer?.remove();
    // Камера могла лететь домой — палец её перехватывает.
    if (!drag || cam.panEffect.isRunning) {
      cam.panEffect.reset();
      drag = { x: cam.midPoint.x, y: cam.midPoint.y };
    }
    drag.x = Phaser.Math.Clamp(drag.x - (p.x - p.prevPosition.x) / cam.zoom, -CAMERA_REACH, scene.next.w + CAMERA_REACH);
    drag.y = Phaser.Math.Clamp(drag.y - (p.y - p.prevPosition.y) / cam.zoom, -CAMERA_REACH / 2, scene.next.h + CAMERA_REACH / 2);
    cam.centerOn(drag.x, drag.y);
  });
  scene.input.on('pointerup', () => {
    scene.pinch = null;
    drag = null;
    settle();
    if (scene.dragged) scheduleHome(scene);
  });
  // Холст сменил размер (полный экран Telegram, поворот, окно на компьютере) — кадр под новый холст.
  // Масштабом холста ведает игра, а не сцена: подписка снимается вместе со сценой.
  scene.scale.on(Phaser.Scale.Events.RESIZE, scene.onResize, scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, scene.onResize, scene));
}

/**
 * Касание улицы под магазином (участок перед входом, тротуары, дорога и дальше — туда, куда
 * достаёт большой палец) — то же, что касание кассы: пробить того, кто ждёт у кассы хозяина, или
 * позвать хозяина с дела. Считается только короткое касание без сдвига камеры и мимо всего, что
 * нажимается само (вор, курьер, Бобик, голуби, мусор), — у тех своё. Отклик — круг под пальцем,
 * кивок кассы и лёгкая вибрация.
 */
export function setupStreetTap(scene: StoreScene): void {
  scene.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
    if (over.length || scene.dragged || scene.arranging || !scene.running || p.upTime - p.downTime > STREET_TAP_MS) return;
    const at = scene.cameras.main.getWorldPoint(p.x, p.y);
    if (at.y < scene.layout.h + FACADE_H) return;
    serveFromStreet(scene, at.x, at.y);
  });
}

/**
 * Касание улицы в точке мира: пробить того, кто ждёт у кассы хозяина, или поторопить сменщика.
 * false — касание ничего бы не изменило (и отклика нет); тогда его может взять то, что под пальцем
 * (домик друга на улице, friendStreet.ts).
 */
export function serveFromStreet(scene: StoreScene, x: number, y: number): boolean {
  if (!scene.running) return false;
  // За кассой хозяина сменщик: касание улицы торопит его, пока он пробивает.
  const first = scene.registers[0];
  if (scene.operator(0) !== 'owner') {
    if (!first?.scan || first.scan.byOwner) return false;
    motion.ripple(scene, x, y);
    void scene.serveNext();
    return true;
  }
  // Касание ничего не изменит (у кассы никого, хозяин уже пробивает) — и отклика нет.
  const r = scene.ownerRegister();
  if (!r || scene.ownerScanning() || (!scene.sellerBusy && !scene.atSpot(r))) return false;
  motion.ripple(scene, x, y);
  if (r.img) motion.squash(scene, r.img, 1.06, 0.9, 80);
  if (!scene.sellerBusy) scene.serves.street++;
  void scene.serveNext();
  return true;
}

/**
 * Бабушка показывает касание улицы: на дороге под её словами прыгает стрелка и расходятся круги,
 * как от пальца. Точка — в кадре, даже если дорога ниже края экрана (тогда — на участке у входа).
 */
export function showStreetTap(scene: StoreScene): void {
  const view = scene.cameras.main.worldView;
  const x = Phaser.Math.Clamp(scene.layout.door.x + 34, view.x + 24, view.right - 24);
  const y = Phaser.Math.Clamp(scene.streetY + 32, scene.layout.h + FACADE_H + 14, view.bottom - 28);
  const arrow = scene.art(x, y - 12, 'arrow').setScale(1.3 / ART).setDepth(LIGHT_DEPTH + 20);
  if (!scene.lite) scene.tweens.add({ targets: arrow, y: y - 16, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.time.delayedCall(ONB_ROAD_MS - 400, () => arrow.destroy());
  const rings = scene.lite ? 1 : 3;
  for (let i = 0; i < rings; i++)
    scene.time.delayedCall(300 + i * 800, () => {
      if (!scene.running) return;
      const ring = scene.add.circle(x, y, 5).setStrokeStyle(1.5, 0xffffff, 0.95).setDepth(LIGHT_DEPTH + 50);
      scene.tweens.add({ targets: ring, scale: 3.6, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    });
}

/**
 * Холст сменил размер. Камера стояла в обычном кадре или летела к нему — ставим новый обычный кадр
 * (масштаб ровный под новый холст); показывала своё (заставку, перестановку, осмотр) — та же середина.
 */
export function onResize(scene: StoreScene, size: Phaser.Structs.Size, _base: Phaser.Structs.Size, _display: Phaser.Structs.Size, prevW: number, prevH: number): void {
  if (size.width === prevW && size.height === prevH) return;
  const cam = scene.cameras.main;
  const mid = { x: cam.midPoint.x, y: cam.midPoint.y };
  const atHome = cam.zoom === scene.baseZoom && Math.abs(mid.x - scene.home.x) <= 1 && Math.abs(mid.y - scene.home.y) <= 1;
  const flying = cam.panEffect.isRunning || cam.zoomEffect.isRunning;
  frameCamera(scene);
  if (scene.arranging || !(atHome || flying)) {
    cam.centerOn(mid.x, mid.y);
    return;
  }
  cam.panEffect.reset();
  cam.zoomEffect.reset();
  cam.setZoom(scene.baseZoom).centerOn(scene.home.x, scene.home.y);
}

/**
 * Начало дня: камера сначала показывает весь квартал сверху-сбоку (улица, соседи), потом
 * плавно подлетает к магазину. Если игрок сам двигает камеру — не мешаем.
 */
export function flyIn(scene: StoreScene): void {
  const cam = scene.cameras.main;
  if (scene.input.pointer1.isDown || scene.input.pointer2.isDown) return;
  scene.homeTimer?.remove();
  // Кадр зависит от дня (ближний ларёк первых дней) — пересчитать к началу каждого дня.
  frameCamera(scene);
  const wide = scene.baseZoom * 0.55;
  const x = Phaser.Math.Clamp(scene.home.x + 70, -CAMERA_REACH, scene.next.w + CAMERA_REACH);
  const y = Phaser.Math.Clamp(scene.home.y + 30, -CAMERA_REACH / 2, scene.next.h + CAMERA_REACH / 2);
  cam.setZoom(wide).centerOn(x, y);
  cam.pan(scene.home.x, scene.home.y, 1600, 'Sine.easeInOut', true);
  cam.zoomTo(scene.baseZoom, 1600, 'Cubic.easeInOut', true);
}

/** Через несколько секунд после осмотра камера возвращается к магазину (в час пик — к кассам). */
export function scheduleHome(scene: StoreScene): void {
  const cam = scene.cameras.main;
  scene.homeTimer?.remove();
  scene.homeTimer = scene.time.delayedCall(4000, () => {
    const view = scene.rushView ?? { x: scene.home.x, y: scene.home.y, zoom: scene.baseZoom };
    cam.pan(view.x, view.y, 700, 'Sine.easeInOut');
    cam.zoomTo(view.zoom, 700, 'Sine.easeInOut');
  });
}

// ---------- Ближний кадр у касс ----------
// В большом магазине обычный кадр показывает всё здание, и человек на телефоне — восемь-десять точек.
// С 10.11 днём камера по умолчанию стоит ближе — у касс и очереди (тот же кадр, что раньше был только в час
// пик); весь магазин — кнопкой «🔍» или сведя два пальца, выбор запоминается. А когда в зале что-то ждёт
// касания (момент дня, течь, вор без охранника, звонок доставки), камера сама отходит на общий план.

/** Ключ в памяти браузера: какой вид выбрал игрок ('wide' — весь магазин; иначе — ближе к кассам). */
const VIEW_KEY = 'magazinchik.view';
/** Сколько секунд от начала дня камера не трогает кадр: идёт облёт (flyIn). */
const CLOSE_AFTER = 3;

let widePref: boolean | null = null;
/** Игрок выбрал общий план. Память браузера может быть недоступна (закрытый режим) — тогда выбор живёт до перезапуска. */
export function prefersWide(): boolean {
  if (widePref === null) {
    try {
      widePref = localStorage.getItem(VIEW_KEY) === 'wide';
    } catch {
      widePref = false;
    }
  }
  return widePref;
}

export function setPrefersWide(wide: boolean): void {
  widePref = wide;
  try {
    localStorage.setItem(VIEW_KEY, wide ? 'wide' : 'close');
  } catch {
    // Не запомнилось — не беда: до перезапуска выбор действует.
  }
}

/** Магазин достаточно велик, чтобы ближний кадр имел смысл (ларёк и так крупный). */
export const bigStore = (scene: StoreScene): boolean => scene.layout.w >= RUSH_MIN_W;

/** В зале что-то ждёт касания не у касс: камере лучше показать весь магазин. */
function calledElsewhere(scene: StoreScene): boolean {
  if (scene.liveEvent || scene.moments.showing || scene.call || scene.inspector === 'here') return true;
  if (scene.oven?.state === 'ready') return true;
  if (!scene.workers.has('guard')) for (const c of scene.customers) if (c.thief && !c.gone) return true;
  return false;
}

/**
 * Каким должен быть кадр сейчас: true — ближе к кассам. Час пик — всегда ближе (как раньше); в остальное время —
 * если игрок не выбрал общий план и ничто не зовёт его в другой конец зала. elapsed — секунд от начала дня.
 */
export function wantClose(scene: StoreScene, rush: boolean, elapsed: number): boolean {
  if (!bigStore(scene) || scene.arranging) return false;
  if (rush) return true;
  return elapsed >= CLOSE_AFTER && !prefersWide() && !calledElsewhere(scene);
}

/** Кнопка «🔍»: переключить вид и запомнить выбор. */
export function toggleView(scene: StoreScene): void {
  setPrefersWide(!prefersWide());
  scene.homeTimer?.remove();
  scene.dragged = false;
  // Кадр подстроится в ближайшем кадре игры (StoreScene.update → rushFocus).
}

/** Час пик ближе: во сколько раз камера подходит (дальше — ровный масштаб crispZoom) и за сколько мс. */
const RUSH_ZOOM = 1.5;
const RUSH_MOVE_MS = 1400;

/**
 * Час пик в большом магазине: камера мягко подходит на шаг ближе — к кассам и очереди, люди крупнее; час пик
 * кончился — так же мягко обратно. Без тряски. В ларьке (он и так крупный), при «меньше движения», пока
 * игрок сам смотрит квартал или переставляет полки — не двигаем.
 */
export function rushFocus(scene: StoreScene, on: boolean): void {
  const cam = scene.cameras.main;
  if (!on) {
    if (!scene.rushView) return;
    scene.rushView = undefined;
    if (atView(scene)) {
      cam.pan(scene.home.x, scene.home.y, RUSH_MOVE_MS, 'Sine.easeInOut');
      cam.zoomTo(scene.baseZoom, RUSH_MOVE_MS, 'Sine.easeInOut');
    }
    return;
  }
  if (scene.rushView || scene.arranging || scene.layout.w < RUSH_MIN_W || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const zoom = crispZoom(scene.baseZoom * RUSH_ZOOM, ART, scene.baseZoom * 1.25, scene.baseZoom * 2);
  if (!zoom) return;
  const { sellerHome, w, h, door } = scene.layout;
  const viewW = cam.width / zoom;
  const viewH = (cam.height - (HUD_TOP + HUD_BOTTOM) * scene.res) / zoom;
  // Кассы у правой стены: кадр — от них влево, по высоте — от касс до входа; за стены не выходим.
  const x = Phaser.Math.Clamp(sellerHome.x - viewW * 0.3, viewW / 2 - 4, w + 8 - viewW / 2);
  const y = Phaser.Math.Clamp((sellerHome.y + door.y) / 2 - 10, viewH / 2 - 10, h + 24 - viewH / 2);
  const wasHome = atView(scene);
  scene.rushView = { x: Math.round(x), y: Math.round(y), zoom };
  if (!wasHome || scene.input.pointer1.isDown) return;
  cam.pan(scene.rushView.x, scene.rushView.y, RUSH_MOVE_MS, 'Sine.easeInOut', true);
  cam.zoomTo(zoom, RUSH_MOVE_MS, 'Sine.easeInOut', true);
}

/** Не мельче этого зал (в точках мира) — камера в час пик подходит ближе; ларёк и так крупный. */
const RUSH_MIN_W = 180;

/** Камера стоит в обычном кадре (или в кадре часа пик) и не осматривает квартал. */
function atView(scene: StoreScene): boolean {
  if (scene.homeTimer && scene.homeTimer.getProgress() < 1) return false;
  return !scene.dragged && !scene.pinch;
}
