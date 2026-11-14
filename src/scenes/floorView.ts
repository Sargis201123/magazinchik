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
import type { FloorBuild, FloorKit, PopupStyle } from './floors/kit';
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
/** Снизу — кнопки звука и ускорения (в базовых точках интерфейса, как HUD_BOTTOM у камеры магазина). */
const BOTTOM = 64;
/** Сколько места слева занимает переключатель этажей (CSS px), если его не измерить: см. ui/floorSwitch.ts. */
const SWITCH_CSS = 66;
/** Ровный масштаб берём, если он не мельче «впритык» больше чем на столько. */
const CRISP_MIN = 0.92;
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

  constructor() {
    super({ key: 'floor' });
  }

  init(data: { store: StoreScene; id: FloorId; from?: FloorStop }): void {
    this.store = data.store;
    this.id = data.id;
    this.from = data.from ?? 'hall';
    this.leaving = false;
  }

  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  create(): void {
    this.host = { art: (x, y, key) => this.art(x, y, key), add: this.add, people: new Set() } as PersonHost;
    this.cameras.main.setBackgroundColor(0x181425);
    this.frame();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.frame, this);
    BUILD[this.id](this.kit());
    this.arrive();
    // Кнопки вида и двора двигают камеру магазина, подсказка зала ложится на этаж — пока смотрим этаж, их нет (ui/hud.ts).
    if (!document.getElementById('floor-style')) {
      const style = document.createElement('style');
      style.id = 'floor-style';
      style.textContent = '.on-floor .ui-view, .on-floor .ui-help, .on-floor .ui-hint { display: none !important; }';
      document.head.append(style);
    }
    document.body.classList.add('on-floor');
    // 13.11, ревью: этаж закрывает весь экран — магазин под ним не рисуем (вдвое меньше работы на кадр). День
    // наверху идёт как шёл: update сцены магазина работает, пропускается только отрисовка. Обратно — nav.floorUp.
    this.store.scene.setVisible(false);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.frame, this);
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
   * Камера: весь зал этажа в кадре между верхней панелью и низом, правее переключателя этажей, масштаб ровный, где
   * можно. Переключатель меряем по его месту на экране (нет его — по ширине из CSS).
   */
  private frame(): void {
    const cam = this.cameras.main;
    const { width, height } = this.scale;
    const res = width / 720;
    const canvas = this.game.canvas?.getBoundingClientRect();
    const px = canvas && canvas.width > 0 ? width / canvas.width : 1;
    const box = document.querySelector('.ui-floors')?.getBoundingClientRect();
    const left = Math.max(0, ((box && box.width > 0 ? box.right : SWITCH_CSS) - (canvas?.left ?? 0)) * px);
    const top = HUD_TOP * res + safeTop(this.store);
    const availW = width - left;
    const availH = height - top - BOTTOM * res;
    const fit = Math.min(availW / (W + 8), availH / (H + 8));
    // Ровный масштаб — только если он почти не мельче «впритык»: справа от переключателя места меньше, и ровный
    // шаг вниз делал зал на четверть мельче (14.11).
    const zoom = crispZoom(fit, ART, fit * CRISP_MIN, fit) || fit;
    cam.setZoom(zoom);
    cam.centerOn(W / 2 + (width / 2 - (left + availW / 2)) / zoom, H / 2 + (height / 2 - (top + availH / 2)) / zoom);
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
