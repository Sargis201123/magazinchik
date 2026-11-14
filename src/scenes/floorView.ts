// Вид этажа (game/floors.ts, 13.11): отдельная сцена Phaser поверх магазина. Магазин под ней работает как обычно —
// день идёт, покупатели ходят, касса считает; эта сцена только показывает этаж и закрывается кнопкой «Наверх» (или
// сама, когда день кончился). Своя сцена, а не угол того же мира: у подвала свой свет — лампочки под потолком, — и
// ни карта освещения улицы, ни цветокоррекция часа (light.ts, grade.ts) его не трогают. Модуль подгружается, только
// когда игрок впервые спускается (basementFx.floorDown), — в первый файл игры он не входит.
//
// Подвал (game/basement.ts): кирпич, бетонный пол, лестница сверху слева, автоматы у задней стены (их экраны мигают;
// в лёгкой графике горят ровно), у автоматов — завсегдатаи (меняются: кто-то уходит наверх, кто-то спускается),
// справа — склад-холодильник, внизу справа — «серая» подсобка с полкой «Разное» ломбарда. После облавы на месте
// автоматов — лента с печатью. Второй и третий этаж допишут сюда свой build по id.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import type { FloorId } from '../game/floors';
import { basementOf, raidLock, slotPlaces, slotsPlan } from '../game/basement';
import { pawnOf } from '../game/pawnshop';
import { t } from '../i18n';
import { button, UI_FONT } from '../ui/dom';
import { haptic } from '../platform/telegram';
import { sound } from '../platform/sound';
import { ART, HUD_TOP, SHIRTS, customerLook } from './common';
import { crispZoom } from './pixels';
import { safeTop } from './camera';
import * as persons from './persons';
import * as basementFx from './basementFx';

/**
 * Размер зала подвала в точках мира и высота задней стены. Зал выше, чем шире: телефон держат вертикально — так
 * подвал занимает экран по ширине при ровном масштабе, а не полоской посередине.
 */
const W = 168;
const H = 230;
const WALL = 44;
/** Места автоматов у задней стены (середины) и где стоит тот, кто играет. */
const SLOT_X = [50, 72, 94, 116];
const SLOT_Y = WALL + 6;
const PLAYER_DY = 11;
/** Внизу экрана — кнопка «Наверх» (в базовых точках интерфейса, как HUD_BOTTOM у камеры магазина). */
const BOTTOM = 96;
/** Низ лестницы: отсюда спускаются и сюда уходят завсегдатаи. */
const STAIRS_FOOT = { x: 22, y: WALL + 8 };
/** Как часто у автомата меняется человек (мс). */
const SWAP_EVERY = 5200;
const FADE_MS = 320;

/** Человечки сцены этажа: persons.makePerson ждёт сцену магазина — даём ей «магазин» с тем, что ему нужно. */
type PersonHost = Pick<StoreScene, 'art' | 'add' | 'people'>;

export class FloorView extends Phaser.Scene {
  private store!: StoreScene;
  private id: FloorId = 'basement';
  private upBtn?: HTMLButtonElement;
  private leaving = false;
  private host!: PersonHost;
  private players: (Phaser.GameObjects.Container | null)[] = [];

  constructor() {
    super({ key: 'floor' });
  }

  init(data: { store: StoreScene; id: FloorId }): void {
    this.store = data.store;
    this.id = data.id;
    this.leaving = false;
    this.players = [];
  }

  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  create(): void {
    this.host = { art: (x, y, key) => this.art(x, y, key), add: this.add, people: new Set() } as PersonHost;
    this.cameras.main.setBackgroundColor(0x181425);
    this.frame();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.frame, this);
    // Этаж по id: второй и третий допишут сюда свой build.
    if (this.id === 'basement') this.buildBasement();
    this.cameras.main.fadeIn(FADE_MS, 24, 20, 37);
    // «Наверх» — кнопкой интерфейса внизу, как остальные кнопки игры.
    this.upBtn = button(`⬆️ ${t('floor.up')}`, () => this.leave(), 'ui-btn floor-up');
    this.upBtn.style.cssText = 'position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom)); transform: translateX(-50%); width: auto; padding: 10px 22px; z-index: 30;';
    document.body.append(this.upBtn);
    // Кнопки вида и двора двигают камеру магазина, подсказка зала ложится на «Наверх» — пока смотрим этаж, их нет (ui/hud.ts).
    if (!document.getElementById('floor-style')) {
      const style = document.createElement('style');
      style.id = 'floor-style';
      style.textContent = '.on-floor .ui-view, .on-floor .ui-help, .on-floor .ui-hint { display: none !important; }';
      document.head.append(style);
    }
    document.body.classList.add('on-floor');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.frame, this);
      this.upBtn?.remove();
      document.body.classList.remove('on-floor');
    });
  }

  update(): void {
    // День кончился (ритуал закрытия, итоги) или магазин закрыли — наверх сами.
    if (!this.leaving && (!this.store.sys.isActive() || !this.store.running)) this.leave();
  }

  /** Камера: весь зал этажа в кадре между верхней панелью и кнопкой «Наверх», масштаб ровный, где можно. */
  private frame(): void {
    const cam = this.cameras.main;
    const { width, height } = this.scale;
    const res = width / 720;
    const top = HUD_TOP * res + safeTop(this.store);
    const avail = height - top - BOTTOM * res;
    const fit = Math.min(width / (W + 8), avail / (H + 8));
    const zoom = crispZoom(fit, ART, 0, fit) || fit;
    cam.setZoom(zoom);
    cam.centerOn(W / 2, H / 2 + (height / 2 - (top + avail / 2)) / zoom);
  }

  /** Наверх: этаж гаснет, магазин светлеет (basementFx.floorUp), сцена этажа останавливается. */
  leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    haptic.tap();
    this.upBtn?.remove();
    const cam = this.cameras.main;
    cam.fadeOut(FADE_MS, 24, 20, 37);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      basementFx.floorUp(this.store);
      this.scene.stop();
    });
  }

  private text(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text {
    const zoom = this.cameras.main.zoom;
    return this.add.text(x, y, s, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0.5).setResolution(Math.max(1, Math.round(zoom)));
  }

  private buildBasement(): void {
    const state = this.store.state;
    const lite = this.store.lite;
    const tile = (x: number, y: number, w: number, h: number, key: string, depth: number) =>
      this.add.tileSprite(x, y, w, h, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
    tile(0, 0, W, WALL, 'bsm_brick', -10);
    tile(0, WALL, W, H - WALL, 'bsm_floor', -10);
    // Плинтус и тень у стены, боковые стены — темнее.
    this.add.rectangle(0, WALL, W, 2, 0x181425, 0.6).setOrigin(0).setDepth(-9);
    this.add.rectangle(0, 0, 5, H, 0x181425).setOrigin(0).setDepth(-8);
    this.add.rectangle(W - 5, 0, 5, H, 0x181425).setOrigin(0).setDepth(-8);
    this.art(5, 0, 'bsm_stairs').setOrigin(0).setDepth(2);
    this.text(W / 2 + 14, 9, `🪜 ${t('floor.basement')}`, 7, '#fee761').setDepth(1);
    const b = basementOf(state);
    const plan = slotsPlan(state);
    const n = b?.slots ?? 0;
    // Автоматы у задней стены; экран мигает (в лёгкой графике — горит ровно), под ним — отсвет на полу.
    for (let i = 0; i < n; i++) {
      const x = SLOT_X[i];
      const glow = this.art(x, SLOT_Y + 4, 'glow').setDisplaySize(22, 12).setTint(0x2ce8f5).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(SLOT_Y - 1);
      const slot = this.art(x, SLOT_Y, 'bsm_slot').setOrigin(0.5, 1).setDepth(SLOT_Y);
      const lit = this.art(x, SLOT_Y, 'bsm_slot_lit').setOrigin(0.5, 1).setDepth(SLOT_Y + 0.1);
      if (!lite) this.tweens.add({ targets: [lit, glow], alpha: { from: 1, to: 0.45 }, duration: 380 + i * 70, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3], delay: i * 160 });
      slot.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        sound.tap();
        if (plan) this.popup(x, SLOT_Y - 26, t('bsm.tap', { n: plan.players, sum: plan.income - plan.share }));
      });
    }
    // Свободные места под автоматы — меловой контур на полу; после облавы — лента с печатью.
    const places = slotPlaces(state);
    for (let i = n; i < places; i++) this.add.rectangle(SLOT_X[i], SLOT_Y - 1, 12, 4).setStrokeStyle(0.5, 0x8b9bb4, 0.6).setDepth(-7);
    if (raidLock(state)) this.art((SLOT_X[0] + SLOT_X[places - 1]) / 2, SLOT_Y - 12, 'grey_seal').setDepth(SLOT_Y + 1);
    // Склад-холодильник — у правой стены, иней светится холодным.
    if (b?.parts?.includes('cold')) {
      this.art(W - 26, SLOT_Y, 'bsm_cold').setOrigin(0.5, 1).setDepth(SLOT_Y);
      // Перед холодильником — поддон с водой: склад магазина теперь и здесь.
      this.art(W - 26, SLOT_Y + 24, 'pallet_water').setScale(0.7 / ART).setOrigin(0.5, 1).setDepth(SLOT_Y + 24);
      this.art(W - 26, SLOT_Y + 3, 'glow').setDisplaySize(26, 10).setTint(0x9cd8ff).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(SLOT_Y - 1);
    }
    if (b?.parts?.includes('back')) this.buildBack(W - 42, H - 34);
    if (!n && !b?.parts?.length) this.text(W / 2 + 10, WALL + 60, t('bsm.empty'), 6, '#8b9bb4').setDepth(5);
    // Своя жизнь подвала: трубы вдоль левой стены, старые коробки в углу, лужица под трубой.
    this.add.rectangle(7, WALL, 1.6, H - WALL, 0x5a6988).setOrigin(0).setDepth(-6);
    this.add.rectangle(10, WALL, 1.2, H - WALL, 0x3a4466).setOrigin(0).setDepth(-6);
    this.add.ellipse(16, H - 70, 14, 4, 0x3a4466, 0.7).setDepth(-6);
    for (const [x, y] of [[24, H - 22], [38, H - 20], [30, H - 30]] as const) this.art(x, y, 'box').setOrigin(0.5, 1).setDepth(y);
    // Стол, за которым завсегдатаи пьют чай между заходами, и огнетушитель на стене у лестницы.
    this.art(70, 136, 'cafe_table').setOrigin(0.5, 1).setDepth(136);
    this.art(40, 30, 'extinguisher').setDepth(1);
    // Лампочки: под потолком у стены — на шнурах, дальше по залу — голые лампы; вокруг — тёплый круг света.
    // В обычной графике свет чуть дышит, в лёгкой — горит ровно.
    const lamps: [number, number, boolean][] = [[40, 16, true], [84, 16, true], [128, 16, true], [56, 120, false], [118, 170, false]];
    for (const [x, y, cord] of lamps) {
      if (cord) this.add.rectangle(x, 0, 0.6, y - 1, 0x181425).setOrigin(0.5, 0).setDepth(20);
      this.add.circle(x, y, 1.6, 0xfee761).setDepth(20);
      const pool = this.art(x, cord ? y + 38 : y + 4, 'glow').setDisplaySize(88, 70).setTint(0xfeae34).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
      const halo = this.art(x, y, 'glow').setDisplaySize(18, 18).setTint(0xfee761).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(21);
      if (!lite) this.tweens.add({ targets: [pool, halo], alpha: '-=0.06', duration: 900 + x * 3, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Тёмный низ: подвал освещён пятнами, не ровно.
    this.add.rectangle(0, H - 40, W, 40, 0x181425, 0.35).setOrigin(0).setDepth(18);
    // Завсегдатаи у автоматов: сколько сегодня придёт, но не больше мест.
    const busy = Math.min(n, plan?.players ?? 0);
    for (let i = 0; i < busy; i++) this.players[i] = this.player(SLOT_X[i], SLOT_Y + PLAYER_DY);
    if (!lite && n) this.time.addEvent({ delay: SWAP_EVERY, loop: true, callback: () => this.swap(n) });
  }

  /** «Серая» подсобка: перегородка, занавеска, на полке — вещи ломбарда (на продажу — с ценником). */
  private buildBack(x: number, bottom: number): void {
    this.art(x, bottom, 'bsm_back').setOrigin(0.5, 1).setDepth(bottom);
    const p = pawnOf(this.store.state);
    const things = [...p.shelf.map((s) => ({ id: s.item, sale: true })), ...p.loans.map((l) => ({ id: l.item, sale: false }))];
    const left = x - 18 + 13;
    const rows = [bottom - 26 + 8, bottom - 26 + 17];
    things.slice(0, 12).forEach((thing, k) => {
      const ix = left + (k % 6) * 4.6;
      const iy = rows[Math.floor(k / 6)];
      this.art(ix, iy, `pawn_${thing.id}`).setOrigin(0.5, 1).setDepth(bottom + 0.1 + k * 0.01);
      if (thing.sale) this.art(ix + 2, iy - 4, 'pawn_tag').setDepth(bottom + 0.3);
    });
  }

  /** Человек у автомата — спиной к нам, лицом к экрану. */
  private player(x: number, y: number): Phaser.GameObjects.Container {
    const look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.store.state.day);
    const man = persons.makePerson(this.host as unknown as StoreScene, x, y, look).setDepth(y);
    persons.setFacing(man, 'up');
    return man;
  }

  /** Один уходит к лестнице и тает, другой спускается и встаёт к свободному автомату. */
  private swap(n: number): void {
    if (this.leaving) return;
    const i = Phaser.Math.Between(0, n - 1);
    const old = this.players[i];
    if (old?.active) {
      this.players[i] = null;
      persons.setFacing(old, 'left');
      this.tweens.add({ targets: old, x: STAIRS_FOOT.x + 8, y: STAIRS_FOOT.y + 2, duration: 1800, ease: 'Linear' });
      this.tweens.add({ targets: old, alpha: 0, delay: 1500, duration: 400, onComplete: () => old.destroy() });
      return;
    }
    const man = this.player(STAIRS_FOOT.x, STAIRS_FOOT.y - 18);
    man.setAlpha(0);
    persons.setFacing(man, 'down');
    this.players[i] = man;
    this.tweens.add({ targets: man, alpha: 1, duration: 300 });
    this.tweens.add({
      targets: man,
      y: STAIRS_FOOT.y + 2,
      duration: 900,
      onComplete: () => {
        if (!man.active) return;
        persons.setFacing(man, 'right');
        this.tweens.add({ targets: man, x: SLOT_X[i], y: SLOT_Y + PLAYER_DY, duration: 1600, onComplete: () => man.active && persons.setFacing(man, 'up') });
      },
    });
  }

  private popup(x: number, y: number, s: string): void {
    const label = this.text(x, y, s, 5, '#c8f0ff').setDepth(40);
    label.setBackgroundColor('#181425cc').setPadding(2, 1, 2, 1);
    if (label.x - label.displayWidth / 2 < 2) label.setX(2 + label.displayWidth / 2);
    if (label.x + label.displayWidth / 2 > W - 2) label.setX(W - 2 - label.displayWidth / 2);
    this.tweens.add({ targets: label, y: y - 6, alpha: 0, delay: 1600, duration: 600, onComplete: () => label.destroy() });
  }
}

/** Открыть вид этажа поверх магазина (сцена создаётся один раз, дальше — перезапуск). */
export function openFloor(store: StoreScene, id: FloorId): void {
  const scenes = store.game.scene;
  if (!scenes.getScene('floor')) scenes.add('floor', FloorView, false);
  store.scene.launch('floor', { store, id });
  store.scene.bringToTop('floor');
}
