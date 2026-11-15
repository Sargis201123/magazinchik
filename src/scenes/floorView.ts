// Вид этажа (game/floors.ts, 13.11): отдельная сцена Phaser поверх магазина. Магазин под ней работает как обычно —
// день идёт, покупатели ходят, касса считает; эта сцена только показывает этаж. Своя сцена, а не угол того же мира:
// у каждого этажа свой свет (лампочки подвала, люстры одежды, вывески фудкорта), и ни карта освещения улицы, ни
// цветокоррекция часа (light.ts, grade.ts) его не трогают. Модуль подгружается, только когда игрок впервые едет на
// этаж (floors/nav.ts), — в первый файл игры он не входит.
//
// 14.11, автор: «в левой части экрана — переключение между этажами». Ездят переключателем слева (ui/floorSwitch.ts,
// floors/nav.ts): с этажа на этаж — сцена гаснет и уезжает вверх или вниз, как кабина лифта, и встаёт заново с
// другим этажом (перезапуск сцены); в зал — гаснет, магазин светлеет (nav.floorUp). Без тряски, в лёгкой графике —
// только затемнение. Кнопки «Наверх» больше нет: её место занял переключатель, а кадр этажа сдвинут вправо, чтобы
// переключатель не закрывал зал. Что на каком этаже — модули floors/basementFloor.ts, secondFloor.ts,
// thirdFloor.ts на общей основе floors/kit.ts.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { stopLevel, type FloorId, type FloorStop } from '../game/floors';
import { UI_FONT } from '../ui/dom';
import { ART, HUD_TOP } from './common';
import { crispZoom } from './pixels';
import { safeTop } from './camera';
import * as persons from './persons';
import * as nav from './floors/nav';
import { AROUND, type FloorBuild, type FloorKit, type PopupStyle, type SurroundOpts } from './floors/kit';
import { buildBasement } from './floors/basementFloor';
import { buildSecond } from './floors/secondFloor';
import { buildThird } from './floors/thirdFloor';

/**
 * Размер зала этажа в точках мира и высота задней стены. Зал выше, чем шире: телефон держат вертикально — так
 * этаж занимает экран по ширине при ровном масштабе, а не полоской посередине.
 */
const W = 168;
const H = 230;
const WALL = 44;
/** Снизу — кнопки звука и ускорения (в базовых точках интерфейса), если их не измерить. */
const BOTTOM = 76;
/** Сколько места слева занимает переключатель этажей (CSS px), если его не измерить: см. ui/floorSwitch.ts. */
const SWITCH_CSS = 66;
/** Зазор между залом и переключателем, верхней панелью, кнопками и краем экрана (CSS px). */
const GAP_CSS = 3;
/** Ровный масштаб берём, если он не мельче «впритык» больше чем на столько. */
const CRISP_MIN = 0.92;
/** Глубина затемнения продолжения зала: поверх всего, что вылезло за край (свет, подписи). */
const AROUND_DEPTH = 5000;
/** Сколько ступеней у затемнения продолжения (пиксельные полосы, а не плавный градиент — как свет зала). */
const FADE_STEPS = 7;
const FADE_MS = 320;
/** На сколько (доля высоты экрана) кадр уезжает вверх или вниз при переезде между этажами. */
const SLIDE = 0.1;

/** Модули этажей: новый этаж — тип в game/floors.ts и строка здесь. */
const BUILD: Record<FloorId, FloorBuild> = {
  basement: buildBasement,
  second: buildSecond,
  third: buildThird,
};

/** Человечки сцены этажа: persons.makePerson ждёт сцену магазина — даём ей «магазин» с тем, что ему нужно. */
type PersonHost = Pick<StoreScene, 'art' | 'add' | 'people'>;

export class FloorView extends Phaser.Scene {
  private store!: StoreScene;
  /** Какой этаж показан (переключатель берёт отсюда, где мы). */
  id: FloorId = 'basement';
  /** Откуда приехали: из зала или с другого этажа — с какой стороны въезжает кадр. */
  private from: FloorStop = 'hall';
  private leaving = false;
  private host!: PersonHost;
  /** Продолжение зала за краем кадра (SurroundOpts от модуля этажа) и на сколько точек мира оно сейчас видно. */
  private aroundOpts: SurroundOpts | null = null;
  private around: Phaser.GameObjects.GameObject[] = [];
  private ext = 0;

  constructor() {
    super({ key: 'floor' });
  }

  init(data: { store: StoreScene; id: FloorId; from?: FloorStop }): void {
    this.store = data.store;
    this.id = data.id;
    this.from = data.from ?? 'hall';
    this.leaving = false;
    this.aroundOpts = null;
    this.around = [];
  }

  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  create(): void {
    this.host = { art: (x, y, key) => this.art(x, y, key), add: this.add, people: new Set() } as PersonHost;
    this.cameras.main.setBackgroundColor(0x181425);
    // Кнопки вида и двора двигают камеру магазина, подсказка зала ложится на этаж — пока смотрим этаж, их нет (ui/hud.ts).
    // 14.11: до кадра — кадр меряет кнопки внизу, и спрятанные кнопки вида не должны его укорачивать.
    if (!document.getElementById('floor-style')) {
      const style = document.createElement('style');
      style.id = 'floor-style';
      style.textContent = '.on-floor .ui-view, .on-floor .ui-help, .on-floor .ui-hint { display: none !important; }';
      document.head.append(style);
    }
    document.body.classList.add('on-floor');
    this.frame();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.reframe, this);
    BUILD[this.id](this.kit());
    this.drawAround();
    this.arrive();
    // 13.11, ревью: этаж закрывает весь экран — магазин под ним не рисуем (вдвое меньше работы на кадр). День
    // наверху идёт как шёл: update сцены магазина работает, пропускается только отрисовка. Обратно — nav.floorUp.
    this.store.scene.setVisible(false);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.reframe, this);
      document.body.classList.remove('on-floor');
    });
  }

  update(): void {
    // День кончился (ритуал закрытия, итоги) или магазин закрыли — в зал сами.
    if (!this.leaving && (!this.store.sys.isActive() || !this.store.running)) this.leave('hall');
  }

  /** Въезд: кадр светлеет; приехали с другой высоты — заодно доезжает сверху или снизу (в лёгкой графике — без этого). */
  private arrive(): void {
    const cam = this.cameras.main;
    cam.fadeIn(FADE_MS, 24, 20, 37);
    const dir = Math.sign(stopLevel(this.id) - stopLevel(this.from));
    if (!this.store.lite && dir) {
      // Едем вверх — новый этаж опускается сверху на место (камера была ниже и поднимается), вниз — наоборот.
      const rest = cam.scrollY;
      cam.scrollY = rest + dir * this.slide();
      this.tweens.add({ targets: cam, scrollY: rest, duration: FADE_MS + 120, ease: 'Sine.easeOut' });
    }
    nav.arrived();
  }

  /** Насколько уезжает кадр (в точках мира этажа). */
  private slide(): number {
    return (this.scale.height * SLIDE) / this.cameras.main.zoom;
  }

  /**
   * Камера: весь зал этажа в кадре между верхней панелью и кнопками внизу, правее переключателя этажей, масштаб ровный,
   * где можно. Переключатель, панель и кнопки меряем по их месту на экране (нет их — по запасным размерам).
   *
   * 14.11, автор: «этаж нарисован процентов на 15 мельче, сверху и снизу — пустые полосы». Было: запас по 4 точки
   * мира с каждой стороны и верх — по высоте панели без строки целей недели. Теперь зал встаёт впритык (зазор в пару
   * пикселей экрана) — на телефоне он упирается в ширину, а лишняя высота уходит на продолжение зала (drawAround).
   */
  private frame(): void {
    const cam = this.cameras.main;
    const { width, height } = this.scale;
    const res = width / 720;
    const canvas = this.game.canvas?.getBoundingClientRect();
    const px = canvas && canvas.width > 0 ? width / canvas.width : 1;
    const top0 = canvas?.top ?? 0;
    const shown = (sel: string): DOMRect[] =>
      [...document.querySelectorAll<HTMLElement>(sel)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const box = shown('.ui-floors')[0];
    const gap = GAP_CSS * px;
    const left = Math.max(0, ((box ? box.right : SWITCH_CSS) - (canvas?.left ?? 0)) * px) + gap;
    // Верх — под панелью и строкой целей недели (что ниже); низ — над кнопками звука и ускорения.
    const hud = shown('.ui-hud, .ui-goal-wrap').reduce((m, r) => Math.max(m, (r.bottom - top0) * px), 0);
    const top = Math.max(HUD_TOP * res + safeTop(this.store), hud) + gap;
    const buttons = shown('.ui-mute, .ui-speed:not(.ui-view):not(.ui-help)').reduce((m, r) => Math.min(m, (r.top - top0) * px), Infinity);
    const bottom = Math.min(height - BOTTOM * res, buttons) - gap;
    const availW = Math.max(1, width - left - gap);
    const availH = Math.max(1, bottom - top);
    const fit = Math.min(availW / W, availH / H);
    // Ровный масштаб — только если он почти не мельче «впритык»: справа от переключателя места меньше, и ровный
    // шаг вниз делал зал на четверть мельче (14.11).
    const zoom = crispZoom(fit, ART, fit * CRISP_MIN, fit) || fit;
    cam.setZoom(zoom);
    cam.centerOn(W / 2 + (width / 2 - (left + availW / 2)) / zoom, H / 2 + (height / 2 - (top + availH / 2)) / zoom);
    // Сколько точек мира остаётся над и под залом до панели и кнопок — столько продолжения рисует drawAround.
    this.ext = Math.max(0, (availH / zoom - H) / 2);
  }

  /** Экран повернули или изменили: заново кадр и продолжение зала под него. */
  private reframe(): void {
    this.frame();
    this.drawAround();
  }

  /**
   * Продолжение зала за его верхним и нижним краем (14.11): стена уходит вверх, пол тянется вниз, боковины — дальше,
   * проёмы лестниц — тёмными шахтами; к панели и кнопкам всё ступенями гаснет в фон сцены. Сколько — this.ext
   * (frame), что — модуль этажа (kit.surround). Статичные прямоугольники и плитка — в лёгкой графике то же самое.
   */
  private drawAround(): void {
    for (const obj of this.around) obj.destroy();
    this.around = [];
    const o = this.aroundOpts;
    const e = Math.ceil(this.ext);
    if (!o || e < 2) return;
    const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.around.push(obj);
      return obj;
    };
    const rect = (x: number, y: number, w: number, h: number, color: number, alpha = 1, depth = -30) =>
      keep(this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0).setDepth(depth));
    // Стена вверх и пол вниз. Плитка пола начинается на шаг узора, лежащий в зале, — без шва на краю (зал её закрывает).
    rect(0, -e, W, e, o.wall);
    const from = o.floorY + Math.floor((H - o.floorY) / o.floorStep) * o.floorStep;
    keep(this.add.tileSprite(0, from, W, H + e - from, o.floor).setOrigin(0).setTileScale(1 / ART).setDepth(-31));
    for (const x of [0, W - o.sideW]) {
      rect(x, -e, o.sideW, e, o.side, 1, -29);
      rect(x, H, o.sideW, e, o.side, 1, -29);
    }
    for (const [x, w] of o.shafts?.top ?? []) rect(x, -e, w, e, 0x181425, 1, -29);
    for (const [x, w] of o.shafts?.bottom ?? []) rect(x, H, w, e, 0x181425, 1, -29);
    if (o.veil) {
      rect(0, -e, W, e, 0x181425, o.veil, AROUND_DEPTH - 1);
      rect(0, H, W, e, 0x181425, o.veil, AROUND_DEPTH - 1);
    }
    // Затемнение ступенями: у края зала чуть, к панели и кнопкам — фон сцены (полосы на всю ширину экрана).
    const step = e / FADE_STEPS;
    const span = this.scale.width / this.cameras.main.zoom;
    for (let i = 0; i < FADE_STEPS; i++) {
      // У края зала — едва (продолжение читается как тот же зал), к панели и кнопкам — почти фон.
      const alpha = 0.06 + 0.9 * (i / (FADE_STEPS - 1)) ** 1.6;
      rect(W / 2 - span, -(i + 1) * step, span * 2, step + 0.05, 0x181425, alpha, AROUND_DEPTH);
      rect(W / 2 - span, H + i * step - 0.05, span * 2, step + 0.05, 0x181425, alpha, AROUND_DEPTH);
    }
    // Дальше полос — фон сцены (то, что вылезло за край ещё дальше: свет, подписи — тоже гаснет).
    rect(W / 2 - span, -e - AROUND, span * 2, AROUND, 0x181425, 1, AROUND_DEPTH);
    rect(W / 2 - span, H + e, span * 2, AROUND, 0x181425, 1, AROUND_DEPTH);
  }

  /**
   * Уехать: в зал (кадр гаснет, магазин светлеет — nav.floorUp) или на другой этаж (кадр гаснет и уезжает
   * вверх/вниз, сцена встаёт заново с другим этажом). Второй вызов, пока уезжаем, ничего не делает.
   */
  leave(to: FloorStop): void {
    if (this.leaving || to === this.id) return;
    this.leaving = true;
    const cam = this.cameras.main;
    const dir = Math.sign(stopLevel(to) - stopLevel(this.id));
    // Едем вверх — этаж уходит вниз (камера поднимается), вниз — вверх.
    if (!this.store.lite && dir) this.tweens.add({ targets: cam, scrollY: cam.scrollY - dir * this.slide(), duration: FADE_MS, ease: 'Sine.easeIn' });
    cam.fadeOut(FADE_MS, 24, 20, 37);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (to === 'hall' || !this.store.sys.isActive() || !this.store.running) {
        nav.floorUp(this.store, this.id);
        this.scene.stop();
        return;
      }
      this.scene.restart({ store: this.store, id: to, from: this.id });
    });
  }

  private text(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text {
    const zoom = this.cameras.main.zoom;
    return this.add.text(x, y, s, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0.5).setResolution(Math.max(1, Math.round(zoom)));
  }

  /** Что модуль этажа получает от сцены: своё рисование, подписи, всплывашки и человечки (floors/kit.ts). */
  private kit(): FloorKit {
    return {
      scene: this,
      store: this.store,
      W,
      H,
      WALL,
      lite: this.store.lite,
      art: (x, y, key) => this.art(x, y, key),
      text: (x, y, s, size, color) => this.text(x, y, s, size, color),
      popup: (x, y, s, style) => this.popup(x, y, s, style),
      person: (x, y, look) => persons.makePerson(this.host as unknown as StoreScene, x, y, look),
      leaving: () => this.leaving,
      surround: (o) => {
        this.aroundOpts = o;
      },
    };
  }

  /** Строка над точкой: держится hold мс, потом всплывает и тает; у краёв зала не вылезает за стену. */
  private popup(x: number, y: number, s: string, style: PopupStyle = {}): void {
    const label = this.text(x, y, s, 5, style.color ?? '#c8f0ff').setDepth(style.depth ?? 40);
    label.setBackgroundColor('#181425cc').setPadding(2, 1, 2, 1);
    label.setX(Phaser.Math.Clamp(label.x, 2 + label.displayWidth / 2, W - 2 - label.displayWidth / 2));
    this.tweens.add({ targets: label, y: y - 6, alpha: 0, delay: style.hold ?? 1600, duration: 600, onComplete: () => label.destroy() });
  }
}

/** Открыть вид этажа поверх магазина (сцена создаётся один раз, дальше — перезапуск). */
export function openFloor(store: StoreScene, id: FloorId, from: FloorStop = 'hall'): void {
  const scenes = store.game.scene;
  if (!scenes.getScene('floor')) scenes.add('floor', FloorView, false);
  store.scene.launch('floor', { store, id, from });
  store.scene.bringToTop('floor');
}
