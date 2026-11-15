// Подвал в виде этажа (game/basement.ts; 13.11 — первый рисунок, 14.11 — своим модулем на общей основе floors/kit.ts).
//
// 14.11, автор: «нужно отрисовать красиво и подвал… и трафик туда, и улучшения — всё как в основном зале, чтобы было
// красиво». Теперь подвал — «настоящий зал» (рисунок — art/basement_art.py):
//  · кирпичные своды на пилонах, трубы с вентилем и кабели под сводом, бетонный пол с затёртыми местами (после
//    отделки — плитка); тёмная вуаль поверх всего и тёплые пятна ламп в сетках — как свет в зале (lighting.ts);
//  · автоматы у задней стены с табуретами; экраны мигают, когда за автоматом никого, и крутят барабаны, когда играют;
//  · барная стойка с окошком администратора: завсегдатай спускается, платит у окошка, садится за свободный автомат,
//    играет несколько раундов (рука жмёт кнопку, барабаны крутятся, изредка — золотая вспышка без сумм), потом иногда
//    пьёт чай у стойки или сидит на диване у телевизора и уходит наверх. Сколько людей внизу одновременно — от
//    числа завсегдатаев дня (slotsPlan, то же число, что в карточке «Этажей»);
//  · грузовой лифт и холодильник-склад: грузчик выкатывает из лифта паллету на рохле, увозит в холодильник (дверь
//    отъезжает, внутри синий свет) и возвращается за следующей;
//  · ломбард (15.11, автор: «в подвале его держать как комнату в подвале со своей вывеской»): будка с окном, световой
//    короб «ЛОМБАРД» и три золотых шара, за прилавком — ломбардщик, на полках вещи (сверху на продажу с ценником,
//    снизу в залоге). К окошку спускаются с вещами: отдал вещь — получил монеты, выкупил — уходит с вещью. Касание
//    будки — карточка ломбарда (scenes/pawnFx.openPawn); гость ждёт ответа — над вывеской прыгает метка;
//  · улучшения подвала (BASEMENT_UPS) видны: «неон» — большая вывеска и розовая подсветка у автоматов; без «вытяжки»
//    на стене потёки и плесень, на полу лужа и капает, с ней — короб вытяжки и вентилятор; «охрана» — пост у
//    лестницы, охранник и камера с мигающим глазком.
// Лёгкая графика: людей меньше, свет и неон горят ровно, вентилятор и телевизор не мигают, капель нет. Тряски нет.
// Глубина — по ногам (низу), как в зале: человек на шаг ниже предмета — перед ним. Ходят только по проходам.

import Phaser from 'phaser';
import { basementOf, raidLock, slotPlaces, slotsPlan, COLD_ROOM } from '../../game/basement';
import { floorOf, hasFloorUp } from '../../game/floors';
import { STORE_LEVELS } from '../../game/economy';
import { pawnOf, pawnPlace, pawnWaiting, PAWN_ITEM_IDS, type PawnItemId } from '../../game/pawnshop';
import { openPawn } from '../pawnFx';
import { t } from '../../i18n';
import { sound } from '../../platform/sound';
import { nightGuestLook, nightLook, VIEW_SUFFIX, type Look } from '../common';
import * as persons from '../persons';
import { chalkSpot, pause, prop, tile, type Facing, type FloorKit, type Point } from './kit';
import { floorCrowd } from '../../game/floorLife';
import { floorMoments } from './momentFx';

type Man = Phaser.GameObjects.Container;

/** От середины человечка до ног (тень рисунка — на +8,5): глубина и точки пути — по ногам. */
const FEET = 9;
/** Автоматы у задней стены: середины; низ автомата, табурета. */
const SLOT_X = [56, 76, 96, 116];
const SLOT_Y = 52;
const STOOL_Y = 66;
/** Проходы (по ногам) и коридоры между ними: люди ходят только по ним — не сквозь мебель. */
const AISLE = { a: 76, b: 154, c: 224 };
const CORRIDORS = [68, 104];
/** Лестница: откуда появляется (верх пролёта) и где уже стоит на полу. */
const STAIR_TOP = { x: 19, y: 24 };
const STAIR_FOOT = { x: 19, y: 58 };
/** Стойка: низ стойки и шкафа за ней, табуреты, окошко (где платят) и где стоит администратор. */
const BAR = { x: 31, y: 128, backY: 104 };
const BAR_STOOLS = [12, 24, 36];
const BAR_STOOL_Y = 138;
const PAY = { x: 50, y: 142 };
const ADMIN = { x: 48, y: 112 };
/** Уголок: диван (низ), места на нём (по ногам), телевизор, столик с табуретами. */
const SOFA = { x: 38, y: 186 };
const SOFA_SEATS = [32, 44];
const TABLE = { x: 86, y: 192 };
/** Лифт в задней стене, холодильник у правой стены (низ; дверь — середина). */
const LIFT = { x: 150, y: 46 };
const COLD = { x: 144, y: 146, door: 139 };
/** Путь грузчика: из лифта вниз до своей полосы (ниже табуретов у автоматов), по ней влево, по коридору к холодильнику. */
const LOADER_X = 116;
const LOAD_Y = 88;
/** Ломбард (низ будки) и где стоят у его окошка. */
const PAWN = { x: 138, y: 214 };
const PAWN_SPOT = { x: 128, y: AISLE.c };
/** У окошка — тот, кто пришёл с вещью; ломбардщик за прилавком (по ногам: их закрывает прилавок). */
const PAWN_WINDOW = { x: 134, y: AISLE.c };
const BROKER = { x: 147, y: 211 };
/** Верх прилавка: вещи и монеты переходят из рук в руки над ним. */
const COUNTER_Y = 201;
/** Как часто к окошку пробуют спуститься с вещью (мс) в обычной и лёгкой графике. */
const PAWN_EVERY = 9000;
const PAWN_EVERY_LITE = 20000;
/** Шаг (точек мира в секунду), свет и вуаль. */
const SPEED = 22;
const VEIL = 800;
const LIGHT = 900;
const UI = 1000;

/**
 * Где болтают двое (по ногам): между диваном и столиком, чуть выше нижнего прохода — не на табличке «Подвал» внизу
 * (она по середине у самого края, H − 7).
 */
const CHAT: [Point, Point] = [
  { x: 60, y: 206 },
  { x: 70, y: 206 },
];
/** Обход охранника (с улучшением «Охрана»): от поста — вдоль автоматов, по залу, к ломбарду и назад. */
const PATROL: Point[] = [
  { x: 28, y: 76 },
  { x: 104, y: 76 },
  { x: 104, y: 154 },
  { x: 68, y: 224 },
  { x: 68, y: 154 },
  { x: 28, y: 76 },
];

export function buildBasement(kit: FloorKit): void {
  const { scene, store, W, H, WALL, lite } = kit;
  const state = store.state;
  const b = basementOf(state);
  const plan = slotsPlan(state);
  const n = b?.slots ?? 0;
  const places = slotPlaces(state);
  const parts = b?.parts ?? [];
  const has = (up: string): boolean => hasFloorUp(state, 'basement', up);
  const neon = has('neon');
  const vent = has('vent');
  const guard = has('guard');
  const finish = floorOf(state, 'basement')?.finish ?? 0;

  // ------------------------------------------------------------ коробка зала
  const people = new Set<Man>();
  tile(kit, 0, WALL, W, H - WALL, finish ? 'bsm_floor_fin' : 'bsm_floor2');
  kit.art(0, 0, 'bsm_wall').setOrigin(0).setDepth(-10);
  // Тень у стены на полу и тёмные боковины (стены сбоку уходят в темноту).
  scene.add.rectangle(0, WALL, W, 6, 0x181425, 0.45).setOrigin(0).setDepth(-9);
  scene.add.rectangle(0, 0, 4, H, 0x181425).setOrigin(0).setDepth(-8);
  scene.add.rectangle(W - 4, 0, 4, H, 0x181425).setOrigin(0).setDepth(-8);
  // 14.11: выше и ниже кадра подвал продолжается (floorView.drawAround): кирпич сводов вверх, пол вниз, лестница
  // уходит в тёмный пролёт; притушено, как и сам подвал под вуалью.
  kit.surround({ wall: 0x3e2731, floor: finish ? 'bsm_floor_fin' : 'bsm_floor2', floorY: WALL, floorStep: 16, side: 0x181425, sideW: 4, shafts: { top: [[6, 26]] }, veil: 0.5 });
  if (!vent) kit.art(0, 0, 'bsm_damp').setOrigin(0).setDepth(-9.5);
  else {
    // Вытяжка: короб под сводом и вентилятор в стене (лопасти крутятся; в лёгкой графике — стоят).
    kit.art(0, 0, 'bsm_duct').setOrigin(0).setDepth(-9);
    kit.art(128, 22, 'bsm_fan').setDepth(-9);
    const blade = kit.art(128, 22, 'bsm_fan_blade').setDepth(-8.9);
    if (!lite) scene.tweens.add({ targets: blade, angle: 360, duration: 900, repeat: -1 });
  }
  prop(kit, 5, 0, 'bsm_stairs', { ox: 0, oy: 0, depth: 2 });
  // Затёртый пол там, где ходят и стоят чаще всего.
  const wear = (x: number, y: number, s = 1): void => void kit.art(x, y, 'bsm_wear').setScale(s / 2).setDepth(-7).setAlpha(0.55);
  wear(STAIR_FOOT.x + 4, STAIR_FOOT.y + 8);
  wear(PAY.x - 4, PAY.y + 6);
  wear(84, AISLE.b + 2, 1.4);
  for (let i = 0; i < n; i++) wear(SLOT_X[i], STOOL_Y + 6, 0.8);

  // ------------------------------------------------------------ лестница, охрана, неон у входа
  let guardMan: Man | null = null;
  kit.art(42, 18, 'bsm_neon_small').setDepth(-8);
  lightPool(kit, 42, 18, { w: 22, h: 18, tint: 0xff0044, alpha: 0.35, depth: LIGHT, flicker: !lite });
  if (guard) {
    prop(kit, 40, 66, 'bsm_post').setInteractive({ useHandCursor: true }).on('pointerup', () => tap(t('bsm.guard.tap'), 40, 44));
    kit.art(38, 34, 'bsm_cam').setDepth(-8);
    const led = scene.add.circle(36.5, 33.5, 0.5, 0xff0044).setDepth(LIGHT);
    if (!lite) scene.tweens.add({ targets: led, alpha: 0.15, duration: 600, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1] });
    const g = man(28, 66, nightGuestLook('guard'));
    guardMan = g;
    // Охранник поглядывает то на лестницу, то в зал; 15.11 — и обходит подвал: вдоль автоматов, по залу и назад к посту.
    if (!lite) scene.time.addEvent({ delay: 2600, loop: true, callback: () => !g.getData('walking') && persons.setFacing(g, Phaser.Utils.Array.GetRandom(['down', 'left', 'right'] as Facing[])) });

  }

  // ------------------------------------------------------------ автоматы
  const SCREEN_DY = -27 + 22.5;
  const slots: { lit: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; reels: Phaser.GameObjects.Image; idle?: Phaser.Tweens.Tween; who: Man | null }[] = [];
  if (neon) {
    // Неон: вывеска над автоматами, розовая полоса у пола и розовые пятна на полу.
    kit.art(86, 16, 'bsm_neon_big').setDepth(-8);
    lightPool(kit, 86, 18, { w: 96, h: 40, tint: 0xb55088, alpha: 0.4, depth: LIGHT, flicker: !lite });
    scene.add.rectangle(48, WALL - 1, 76, 1, 0xff0044).setOrigin(0).setDepth(-8);
    lightPool(kit, 86, WALL + 4, { w: 110, h: 14, tint: 0xff0044, alpha: 0.3, depth: LIGHT });
  }
  for (let i = 0; i < n; i++) {
    const x = SLOT_X[i];
    const machine = prop(kit, x, SLOT_Y, 'bsm_slot2');
    const lit = prop(kit, x, SLOT_Y, 'bsm_slot2_lit', { depth: SLOT_Y + 0.1 });
    const reels = kit.art(x, SLOT_Y + SCREEN_DY, 'bsm_reels0').setDepth(SLOT_Y + 0.2).setVisible(false);
    const glow = lightPool(kit, x, SLOT_Y - 10, { w: 26, h: 30, tint: i % 2 ? 0xb55088 : 0x2ce8f5, alpha: neon ? 0.42 : 0.3, depth: LIGHT });
    lightPool(kit, x, STOOL_Y + 2, { w: 30, h: 12, tint: i % 2 ? 0xb55088 : 0x2ce8f5, alpha: 0.22, depth: LIGHT });
    prop(kit, x, STOOL_Y, 'bsm_stool');
    // Свободный автомат зазывает: свет медленно дышит (в лёгкой — горит ровно).
    const idle = lite ? undefined : scene.tweens.add({ targets: [lit, glow], alpha: { from: 1, to: 0.5 }, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3], delay: i * 170 });
    slots.push({ lit, glow, reels, idle, who: null });
    machine.setInteractive({ useHandCursor: true }).on('pointerup', () => plan && tap(t('bsm.tap', { n: plan.players, sum: plan.income - plan.share }), x, SLOT_Y - 30));
  }
  // Свободные места под автоматы — меловой контур; после облавы — лента с печатью.
  for (let i = n; i < places; i++) chalkSpot(kit, SLOT_X[i], SLOT_Y - 2, 13, 5, 0x8b9bb4, 0.6);
  if (raidLock(state)) kit.art((SLOT_X[0] + SLOT_X[places - 1]) / 2, SLOT_Y - 12, 'grey_seal').setDepth(SLOT_Y + 1);

  // ------------------------------------------------------------ стойка и администратор
  const open = n > 0 || parts.length > 0;
  prop(kit, BAR.x, BAR.backY, 'bsm_bar_back');
  prop(kit, BAR.x, BAR.y, 'bsm_bar').setInteractive({ useHandCursor: true }).on('pointerup', () => tap(t('bsm.bar.tap', { n: plan?.players ?? 0 }), BAR.x, BAR.y - 28));
  for (const x of BAR_STOOLS) prop(kit, x, BAR_STOOL_Y, 'bsm_stool');
  const admin = open ? man(ADMIN.x, ADMIN.y, { ...nightLook(), shirt: 0x262b44, acc: 'vest', accTint: 0x68386c, style: 'short' }) : null;
  if (admin && !lite) scene.time.addEvent({ delay: 3100, loop: true, callback: () => persons.setFacing(admin, Phaser.Utils.Array.GetRandom(['down', 'down', 'left', 'right'] as Facing[])) });

  // ------------------------------------------------------------ уголок: диван, телевизор, столик
  prop(kit, 12, SOFA.y, 'bsm_tv');
  const screen = prop(kit, 12, SOFA.y, 'bsm_tv_lit', { depth: SOFA.y + 0.1 });
  const tvGlow = lightPool(kit, 12, SOFA.y - 10, { w: 30, h: 26, tint: 0x0099db, alpha: 0.3, depth: LIGHT });
  if (!lite) scene.tweens.add({ targets: [screen, tvGlow], alpha: 0.7, duration: 260, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2], repeatDelay: 900 });
  prop(kit, SOFA.x, SOFA.y, 'bsm_sofa');
  prop(kit, TABLE.x, TABLE.y, 'cafe_table');
  // Коробки и старые ящики в углу у телевизора — подвал живёт своей жизнью.
  prop(kit, 10, 214, 'box');
  prop(kit, 20, 216, 'box');
  prop(kit, 14, 207, 'box');

  // ------------------------------------------------------------ лифт, холодильник, паллеты
  const lift = prop(kit, LIFT.x, LIFT.y, 'bsm_lift', { depth: 1 });
  const liftGlow = lightPool(kit, LIFT.x, LIFT.y - 4, { w: 40, h: 26, tint: 0xfeae34, alpha: 0, depth: LIGHT });
  const cold = parts.includes('cold');
  let coldImg: Phaser.GameObjects.Image | null = null;
  let coldGlow: Phaser.GameObjects.Image | null = null;
  if (cold) {
    coldImg = prop(kit, COLD.x, COLD.y, 'bsm_cold2');
    coldImg.setInteractive({ useHandCursor: true }).on('pointerup', () => tap(t('bsm.cold.tap', { n: Math.round(STORE_LEVELS[state.level].warehouse * COLD_ROOM) }), COLD.x, COLD.y - 52));
    lightPool(kit, COLD.x + 13, COLD.y - 32, { w: 18, h: 10, tint: 0x2ce8f5, alpha: 0.45, depth: LIGHT });
    coldGlow = lightPool(kit, COLD.door, COLD.y + 2, { w: 34, h: 14, tint: 0x9cd8ff, alpha: 0.18, depth: LIGHT });
    // Жёлтая разметка: перед лифтом и площадка между холодильником и ломбардом, где паллеты ждут очереди.
    for (const [x, y, w, h] of [[136, 48, 28, 1], [136, 152, 30, 1], [136, 152, 1, 18]] as const) scene.add.rectangle(x, y, w, h, 0xfee761, 0.55).setOrigin(0).setDepth(-7);
    prop(kit, 148, 168, 'bsm_pallet');
    prop(kit, 159, 167, 'box');
    prop(kit, 159, 160, 'box');
  } else {
    // Нет холодильника — в углу старьё.
    prop(kit, 140, 120, 'box');
    prop(kit, 152, 124, 'box');
  }

  // ------------------------------------------------------------ ломбард (15.11: комната подвала, а не плитка меню)
  const pawn = pawnPlace(state) === 'basement' ? buildPawn(kit, parts.includes('back')) : null;
  if (!pawn && !n && !parts.length) kit.text(W / 2 + 6, WALL + 60, t('bsm.empty'), 6, '#8b9bb4').setDepth(UI);
  // Табличка этажа — внизу по середине, поверх вуали (наверху — вывеска и своды).
  kit.text(W / 2 - 4, H - 7, `🪜 ${t('floor.basement')}`, 7, '#fee761').setDepth(UI).setBackgroundColor('#181425cc').setPadding(3, 1, 3, 1);

  // ------------------------------------------------------------ сырость: лужа и капель (пока нет вытяжки)
  if (!vent) {
    kit.art(88, 120, 'bsm_puddle').setDepth(-7);
    if (!lite) {
      const drop = scene.add.rectangle(86, 80, 0.6, 1.4, 0x9cd8ff).setDepth(LIGHT).setAlpha(0);
      const ring = scene.add.ellipse(86, 120, 3, 1, 0x9cd8ff, 0).setStrokeStyle(0.4, 0x9cd8ff, 0.8).setDepth(-6.9).setAlpha(0);
      scene.time.addEvent({
        delay: 1900,
        loop: true,
        callback: () => {
          drop.setPosition(86, 82).setAlpha(0.9);
          scene.tweens.add({
            targets: drop,
            y: 119,
            duration: 520,
            ease: 'Quad.easeIn',
            onComplete: () => {
              drop.setAlpha(0);
              ring.setScale(0.4).setAlpha(1);
              scene.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 600 });
            },
          });
        },
      });
    }
  }

  // ------------------------------------------------------------ свет: тёмная вуаль и тёплые пятна ламп
  scene.add.rectangle(0, 0, W, H, 0x181425, 0.42).setOrigin(0).setDepth(VEIL);
  scene.add.rectangle(0, H - 46, W, 46, 0x181425, 0.22).setOrigin(0).setDepth(VEIL);
  // Лампы в сетках: над стойкой, у автоматов, над уголком и столиком, у ломбарда, у лифта.
  const lamps: [number, number, number][] = [
    [31, 92, 64],
    [66, 30, 54],
    [106, 30, 54],
    [24, 160, 70],
    [86, 166, 60],
    [138, 168, 52],
    [148, 60, 46],
  ];
  for (const [x, y, size] of lamps) lamp(kit, x, y, size);

  // ------------------------------------------------------------ люди
  /** Ноги: шаг в четыре кадра по пройденному пути (как motion.animatePeople в зале, только ноги). */
  const step = (): void => {
    for (const p of people) {
      if (!p.active) {
        people.delete(p);
        continue;
      }
      const legs = p.getData('legs') as Phaser.GameObjects.Image | undefined;
      if (!legs?.visible) continue;
      const lx = (p.getData('lx') as number | undefined) ?? p.x;
      const ly = (p.getData('ly') as number | undefined) ?? p.y;
      const moved = Math.hypot(p.x - lx, p.y - ly);
      p.setData('lx', p.x).setData('ly', p.y);
      const facing = (p.getData('facing') as Facing | undefined) ?? 'down';
      const suffix = VIEW_SUFFIX[facing];
      let key = `p_legs0${suffix}`;
      let flip = facing === 'left';
      if (moved > 0.01) {
        const phase = (((p.getData('step') as number | undefined) ?? 0) + moved / 2.4) % 4;
        p.setData('step', phase);
        const frame = Math.floor(phase);
        if (frame === 1) key = `p_legs1${suffix}`;
        if (frame === 3) {
          if (suffix === '_s') key = 'p_legs2_s';
          else {
            key = `p_legs1${suffix}`;
            flip = !flip;
          }
        }
      }
      if (legs.texture.key !== key) legs.setTexture(key);
      legs.setFlipX(flip);
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, step));

  /** Человечек ногами в (x, y): глубина — по ногам. */
  function man(x: number, y: number, look: Look): Man {
    const m = kit.person(x, y - FEET, look).setDepth(y).setData('skin', look.skin);
    people.add(m);
    return m;
  }
  /** Значок над головой: всплывает и тает. */
  function bubble(m: Man, key: string): void {
    const icon = kit.art(m.x, m.y - 14, key).setDepth(UI);
    scene.tweens.add({ targets: icon, y: icon.y - 4, alpha: 0, delay: 700, duration: 500, onComplete: () => icon.destroy() });
  }
  function tap(s: string, x: number, y: number): void {
    sound.tap();
    kit.popup(x, y, s, { depth: UI });
  }

  /** Маршрут по ногам: к ближайшему проходу, по нему к коридору, по коридору к проходу цели, к входу и к цели. */
  const route = (from: Point, to: Point, entry?: Point): Point[] => {
    const via = entry ?? to;
    const lanes = [AISLE.a, AISLE.b, AISLE.c];
    const near = (y: number) => lanes.reduce((p, q) => (Math.abs(q - y) < Math.abs(p - y) ? q : p));
    const a = near(from.y);
    const c = near(via.y);
    const pts: Point[] = [{ x: from.x, y: a }];
    if (a !== c) {
      const corr = CORRIDORS.reduce((p, q) => (Math.abs(q - from.x) + Math.abs(q - via.x) < Math.abs(p - from.x) + Math.abs(p - via.x) ? q : p));
      pts.push({ x: corr, y: a }, { x: corr, y: c });
    }
    pts.push({ x: via.x, y: c }, via);
    if (entry) pts.push(to);
    return pts;
  };
  /** Пройти по точкам (по ногам) ровным шагом, лицом туда, куда идёт. */
  const walkPts = async (m: Man, pts: Point[], speed = SPEED): Promise<void> => {
    for (const p of pts) {
      if (!m.active) return;
      const dx = p.x - m.x;
      const dy = p.y - FEET - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) continue;
      persons.setFacing(m, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      await new Promise<void>((done) =>
        scene.tweens.add({ targets: m, x: p.x, y: p.y - FEET, duration: (d / speed) * 1000, onUpdate: () => m.setDepth(m.y + FEET), onComplete: () => done() }),
      );
    }
  };
  const feetOf = (m: Man): Point => ({ x: m.x, y: m.y + FEET });
  const go = (m: Man, to: Point, entry?: Point): Promise<void> => walkPts(m, route(feetOf(m), to, entry));

  /** Сесть на табурет (низ табурета — y): ноги прячем, бёдра — на сиденье, спиной к нам. */
  const sit = async (m: Man, x: number, y: number, face: Facing = 'up', legs = false): Promise<void> => {
    persons.setFacing(m, face);
    (m.getData('legs') as Phaser.GameObjects.Image | undefined)?.setVisible(legs);
    await new Promise<void>((done) => scene.tweens.add({ targets: m, x, y: y - 11.5, duration: 220, onComplete: () => done() }));
    m.setDepth(y - 0.5);
  };
  const stand = (m: Man, y: number): Promise<void> => {
    (m.getData('legs') as Phaser.GameObjects.Image | undefined)?.setVisible(true);
    return new Promise<void>((done) => scene.tweens.add({ targets: m, y: y - FEET, duration: 200, onUpdate: () => m.setDepth(m.y + FEET), onComplete: () => done() }));
  };

  /** Раунды за автоматом: барабаны крутятся, рука жмёт кнопку; изредка — золотая вспышка (без сумм). */
  const play = async (m: Man, i: number, rounds: number): Promise<void> => {
    const s = slots[i];
    s.idle?.pause();
    s.lit.setAlpha(1);
    s.glow.setAlpha(1);
    s.reels.setVisible(true);
    const hand = scene.add.rectangle(SLOT_X[i] + 4, SLOT_Y - 10, 1.2, 1.6, (m.getData('skin') as number | undefined) ?? 0xe8b796).setDepth(STOOL_Y).setVisible(false);
    for (let r = 0; r < rounds && m.active; r++) {
      hand.setVisible(true);
      if (!lite) scene.tweens.add({ targets: hand, y: SLOT_Y - 11.5, duration: 140, yoyo: true });
      if (lite) await pause(kit, 1100);
      else for (let k = 0; k < 9 && m.active; k++) {
        s.reels.setTexture(k % 2 ? 'bsm_reels1' : 'bsm_reels0');
        await pause(kit, 120);
      }
      hand.setVisible(false);
      if (!m.active) break;
      if (Math.random() < 0.14) {
        s.lit.setTexture('bsm_slot2_win');
        const burst = kit.art(SLOT_X[i], SLOT_Y - 16, 'glow').setDisplaySize(26, 26).setTint(0xfee761).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT + 1);
        if (!lite) {
          scene.tweens.add({ targets: burst, displayWidth: 60, displayHeight: 60, alpha: 0, duration: 900, onComplete: () => burst.destroy() });
          scene.tweens.add({ targets: m, y: m.y - 1.5, duration: 120, yoyo: true, repeat: 1 });
        } else scene.time.delayedCall(700, () => burst.destroy());
        await pause(kit, 1300);
        s.lit.setTexture('bsm_slot2_lit');
      } else await pause(kit, 900 + Math.random() * 900);
    }
    hand.destroy();
    s.reels.setVisible(false);
    s.idle?.resume();
  };

  /** Все автоматы заняты — постоять за плечом играющего (за табуретом, на проходе), порадоваться за него. */
  const watch = async (m: Man): Promise<void> => {
    const busy = slots.map((s, k) => (s.who && !watchers[k] ? k : -1)).filter((k) => k >= 0);
    if (!busy.length) return;
    const k = Phaser.Utils.Array.GetRandom(busy);
    watchers[k] = m;
    await go(m, { x: SLOT_X[k] + 7, y: AISLE.a });
    if (m.active) {
      persons.setFacing(m, 'up');
      await pause(kit, 3500 + Math.random() * 3000);
      if (m.active && Math.random() < 0.5) persons.setFacing(m, 'left');
      await pause(kit, 1200);
    }
    watchers[k] = null;
  };
  const freeSlot = (): number => {
    const free = slots.map((s, i) => (s.who ? -1 : i)).filter((i) => i >= 0);
    return free.length ? Phaser.Utils.Array.GetRandom(free) : -1;
  };
  const barBusy: (Man | null)[] = BAR_STOOLS.map(() => null);
  const watchers: (Man | null)[] = SLOT_X.map(() => null);
  const sofaBusy: (Man | null)[] = SOFA_SEATS.map(() => null);

  /** Отдохнуть: чай у стойки или диван у телевизора (если есть свободное место). */
  const rest = async (m: Man): Promise<void> => {
    const sofa = sofaBusy.indexOf(null);
    const bar = barBusy.indexOf(null);
    if (sofa >= 0 && (bar < 0 || Math.random() < 0.5)) {
      sofaBusy[sofa] = m;
      const seat = { x: SOFA_SEATS[sofa], y: SOFA.y + 0.5 };
      await go(m, seat, { x: 60, y: seat.y });
      if (m.active) {
        persons.setFacing(m, 'down');
        await new Promise<void>((done) => scene.tweens.add({ targets: m, y: SOFA.y - 9, duration: 200, onComplete: () => done() }));
        m.setDepth(SOFA.y + 0.5);
        await pause(kit, 5000 + Math.random() * 6000);
        await walkPts(m, [{ x: 60, y: SOFA.y }]);
      }
      sofaBusy[sofa] = null;
      return;
    }
    if (bar < 0) return;
    barBusy[bar] = m;
    await go(m, { x: BAR_STOOLS[bar], y: AISLE.b });
    if (m.active) {
      await sit(m, BAR_STOOLS[bar], BAR_STOOL_Y);
      await pause(kit, 4000 + Math.random() * 5000);
      await stand(m, AISLE.b);
    }
    barBusy[bar] = null;
  };

  /**
   * Уйти наверх по лестнице и растаять. 14.11 (ревью): кто пошёл к лестнице, уже не «внизу» — сразу спускается
   * следующий; иначе автоматы пустели, пока уходящие шли через весь зал.
   */
  const leave = async (m: Man): Promise<void> => {
    if (m.getData('stay')) {
      m.setData('stay', false);
      staying--;
    }
    await go(m, STAIR_FOOT);
    if (!m.active) return;
    persons.setFacing(m, 'up');
    await new Promise<void>((done) => scene.tweens.add({ targets: m, y: STAIR_TOP.y - FEET, alpha: 0, duration: 1100, onUpdate: () => m.setDepth(m.y + FEET), onComplete: () => done() }));
    m.destroy();
  };

  /**
   * Сыграть за автоматом i (человек уже у прохода или на табурете) и встать. 14.11 (ревью): у тех, кто уже сидел, когда
   * мы спустились, раундов меньше и разное число, у новых — больше: иначе все вставали разом и автоматы стояли пустыми,
   * пока толпа шла к лестнице (новые не спускаются, пока внизу «полно»).
   */
  const session = async (m: Man, i: number, seated: boolean, rounds = Phaser.Math.Between(3, 6)): Promise<void> => {
    slots[i].who = m;
    if (!seated) {
      await go(m, { x: SLOT_X[i], y: AISLE.a });
      if (!m.active) return;
      await sit(m, SLOT_X[i], STOOL_Y);
    }
    await play(m, i, rounds);
    if (m.active) await stand(m, AISLE.a);
    slots[i].who = null;
  };

  /** Завсегдатай: спустился, заплатил у окошка, сыграл (если есть свободный автомат), иногда отдохнул, ушёл. */
  const regular = async (): Promise<void> => {
    const m = arrive(man(STAIR_TOP.x, STAIR_TOP.y, nightLook())).setAlpha(0);
    persons.setFacing(m, 'down');
    await new Promise<void>((done) =>
      scene.tweens.add({ targets: m, y: STAIR_FOOT.y - FEET, alpha: 1, duration: 1100, onUpdate: () => m.setDepth(m.y + FEET), onComplete: () => done() }),
    );
    if (!m.active) return;
    if (admin) {
      await go(m, PAY, { x: PAY.x, y: AISLE.b });
      if (!m.active) return;
      persons.setFacing(m, 'up');
      persons.setFacing(admin, 'down');
      await pause(kit, 900 + Math.random() * 600);
    }
    const i = freeSlot();
    if (i >= 0) await session(m, i, false);
    else if (m.active) await watch(m);
    if (m.active && Math.random() < 0.45) await rest(m);
    // Иногда — к окну ломбарда: посмотреть, что на полке «Разное».
    if (m.active && pawn && Math.random() < 0.2) {
      await go(m, PAWN_SPOT);
      if (m.active) persons.setFacing(m, 'up');
      await pause(kit, 1800);
    }
    if (m.active) await leave(m);
  };

  // Кто уже внизу, когда спустились мы: за автоматами и на отдыхе — доля сегодняшних завсегдатаев.
  // 15.11, автор: «прям пусто». Сколько людей внизу — от завсегдатаев дня, но не меньше четырёх (floorLife.floorCrowd):
  // кому не хватило автомата — смотрит из-за плеча играющего, пьёт чай или болтает у телевизора.
  const present = plan ? floorCrowd('basement', plan.players, lite) : 0;
  let staying = 0;
  /** Новый человек внизу: считаем, пока он не пошёл к лестнице (leave). */
  const arrive = (m: Man): Man => {
    staying++;
    return m.setData('stay', true);
  };
  const run = (job: () => Promise<void>): void => void job();
  const seated = Math.min(n, Math.ceil(present * 0.7));
  for (let k = 0; k < seated; k++) {
    const i = k;
    run(async () => {
      const m = arrive(man(SLOT_X[i], STOOL_Y, nightLook()));
      await sit(m, SLOT_X[i], STOOL_Y);
      await pause(kit, Math.random() * 2500);
      await session(m, i, true, 1 + ((i * 3 + Phaser.Math.Between(0, 1)) % 5));
      if (m.active && Math.random() < 0.4) await rest(m);
      if (m.active) await leave(m);
    });
  }
  if (present > seated) {
    run(async () => {
      const m = arrive(man(BAR_STOOLS[1], BAR_STOOL_Y, nightLook()));
      barBusy[1] = m;
      await sit(m, BAR_STOOLS[1], BAR_STOOL_Y);
      await pause(kit, 3000 + Math.random() * 4000);
      await stand(m, AISLE.b);
      barBusy[1] = null;
      if (m.active) await leave(m);
    });
  }
  // Поток: пока людей внизу меньше, чем сегодня бывает, спускается следующий; этаж уходит — новых нет.
  if (present) {
    scene.time.addEvent({
      delay: lite ? 4200 : 2600,
      loop: true,
      callback: () => {
        if (kit.leaving() || staying >= present) return;
        run(regular);
        // Иногда спускаются вдвоём — приятели.
        if (staying < present && Math.random() < 0.3) scene.time.delayedCall(600, () => !kit.leaving() && run(regular));
      },
    });
  }
  // Двое за столиком с чаем — когда завсегдатаев много (в лёгкой графике — нет).
  // 14.11 (ревью): сидят на табуретах столика (ноги спрятаны, бёдра на сиденье), а не стоят рядом с ними.
  if (!lite && plan && plan.players >= 6) {
    for (const [dx, face] of [[-9, 'right'], [9, 'left']] as const) {
      const m = man(TABLE.x + dx, TABLE.y, nightLook());
      persons.setFacing(m, face);
      (m.getData('legs') as Phaser.GameObjects.Image | undefined)?.setVisible(false);
      m.setY(TABLE.y - 11).setDepth(TABLE.y - 0.5);
    }
  }

  // ------------------------------------------------------------ 15.11: охрана обходит, двое болтают у телевизора
  const g0 = guardMan as Man | null;
  if (g0 && !lite) {
    void (async () => {
      await pause(kit, 6000);
      while (g0.active && !kit.leaving()) {
        if (!g0.getData('busy')) {
          g0.setData('walking', true);
          await walkPts(g0, PATROL.flatMap((p, k) => (k ? route(PATROL[k - 1], p) : [p])), 18);
          await walkPts(g0, [{ x: 28, y: 66 }], 18);
          g0.setData('walking', false);
          if (g0.active) persons.setFacing(g0, 'down');
        }
        await pause(kit, 14000);
      }
    })();
  }
  if (plan && !lite) {
    void (async () => {
      await pause(kit, 2500);
      for (let k = 0; !kit.leaving() && scene.sys.isActive(); k++) {
        // Двое спускаются, встают у телевизора лицом друг к другу, болтают (пузыри по очереди) и уходят.
        const pair = CHAT.map((p, i) => ({ p, m: arrive(man(STAIR_TOP.x, STAIR_TOP.y, nightLook())).setAlpha(0), i }));
        await Promise.all(
          pair.map(async ({ p, m, i }) => {
            await pause(kit, i * 600);
            persons.setFacing(m, 'down');
            await new Promise<void>((done) => scene.tweens.add({ targets: m, y: STAIR_FOOT.y - FEET, alpha: 1, duration: 1100, onUpdate: () => m.setDepth(m.y + FEET), onComplete: () => done() }));
            await go(m, p);
            if (m.active) persons.setFacing(m, i ? 'left' : 'right');
          }),
        );
        for (let r = 0; r < 4; r++) {
          const { m } = pair[r % 2];
          if (m.active) bubble(m, (['emo_bubble', 'emo_bubble', 'emo_star', 'emo_bubble'] as const)[r]);
          await pause(kit, 1900);
        }
        await Promise.all(pair.map(({ m, i }) => pause(kit, i * 400).then(() => (m.active ? leave(m) : undefined))));
        await pause(kit, 9000 + (k % 3) * 3000);
      }
    })();
  }

  // ------------------------------------------------------------ ломбард: с вещью к окошку (15.11)
  // Спустился, встал у окошка: принёс — вещь уходит через прилавок к ломбардщику, в ответ монеты; пришёл выкупить —
  // наоборот. Живые случайности этажа (на деньги не влияют, их считает game/pawnshop.ts). Один гость за раз; чем
  // больше вещей в залоге и на полке, тем чаще. Взяли вещь в карточке — гость с ней спускается сразу.
  if (pawn) {
    const broker = pawn.broker;
    let busy = false;
    /** Вещь или монета летит над прилавком из рук в руки. */
    const pass = (key: string, from: Point, to: Point): Promise<void> => {
      const img = kit.art(from.x, from.y, key).setDepth(UI - 1);
      return new Promise((done) => scene.tweens.add({ targets: img, x: to.x, y: to.y, duration: lite ? 250 : 450, ease: 'Sine.easeInOut', onComplete: () => (img.destroy(), done()) }));
    };
    const visitor = async (item: PawnItemId, bring: boolean): Promise<void> => {
      if (busy || kit.leaving()) return;
      busy = true;
      try {
        const m = man(STAIR_TOP.x, STAIR_TOP.y, nightLook()).setAlpha(0);
        const held = kit.art(5, 2, `pawn_${item}`).setVisible(bring);
        m.add(held);
        persons.setFacing(m, 'down');
        await new Promise<void>((done) => scene.tweens.add({ targets: m, y: STAIR_FOOT.y - FEET, alpha: 1, duration: 1100, onUpdate: () => m.setDepth(m.y + FEET), onComplete: () => done() }));
        if (!m.active) return;
        await go(m, PAWN_WINDOW);
        if (!m.active) return;
        persons.setFacing(m, 'up');
        persons.setFacing(broker, 'down');
        await pause(kit, 500);
        const hand = { x: m.x + 3, y: COUNTER_Y };
        const desk = { x: broker.x - 3, y: COUNTER_Y - 2 };
        if (bring) {
          held.setVisible(false);
          await pass(`pawn_${item}`, hand, desk);
          await pause(kit, lite ? 300 : 700);
          sound.coin(m.x);
          await pass('coin', desk, { x: m.x, y: m.y - 12 });
          if (m.active) bubble(m, 'emo_heart');
        } else {
          sound.coin(m.x);
          await pass('coin', { x: m.x, y: m.y - 12 }, desk);
          await pause(kit, lite ? 300 : 700);
          await pass(`pawn_${item}`, desk, hand);
          if (m.active) {
            held.setVisible(true);
            bubble(m, 'emo_star');
          }
        }
        await pause(kit, 900);
        persons.setFacing(broker, 'left');
        if (m.active) await leave(m);
      } finally {
        busy = false;
      }
    };
    const pick = (): PawnItemId => {
      const p = pawnOf(store.state);
      const own = [...p.loans.map((l) => l.item), ...p.shelf.map((x) => x.item)];
      return Phaser.Utils.Array.GetRandom(own.length ? own : PAWN_ITEM_IDS);
    };
    pawn.onTap(() => openPawn(store, (item) => void visitor(item, true), pawn.refresh));
    scene.time.delayedCall(2500, () => void visitor(pick(), Math.random() < 0.55));
    scene.time.addEvent({
      delay: lite ? PAWN_EVERY_LITE : PAWN_EVERY,
      loop: true,
      callback: () => {
        if (busy || kit.leaving()) return;
        const p = pawnOf(store.state);
        if (Math.random() < Math.min(0.9, 0.4 + 0.12 * (p.loans.length + p.shelf.length))) void visitor(pick(), Math.random() < 0.55);
      },
    });
  }

  // ------------------------------------------------------------ моменты подвала (game/floorLife.ts, 15.11)
  // Просят разменять на жетоны у окошка, автомат заело, гость буянит. Нажал — награда и развязка; не успел — тихо
  // расходится, без штрафа.
  if (plan) {
    let actor: Man | null = null;
    let jam = -1;
    let jamFx: Phaser.Time.TimerEvent | null = null;
    const unjam = (): void => {
      jamFx?.remove();
      jamFx = null;
      if (jam >= 0) {
        slots[jam].lit.clearTint().setTexture('bsm_slot2_lit');
        slots[jam].glow.clearTint();
      }
    };
    floorMoments(kit, 'basement', {
      start: (kind) => {
        if (kind === 'jam') {
          // Автомат заело: экран мигает красным, за ним — кто-то стучит по корпусу.
          const busy = slots.map((sl, k) => (sl.who ? k : -1)).filter((k) => k >= 0);
          jam = busy.length ? busy[0] : 0;
          const sl = slots[jam];
          if (!sl) return null;
          sl.lit.setTint(0xff6060);
          sl.glow.setTint(0xff0044);
          if (!lite) jamFx = scene.time.addEvent({ delay: 260, loop: true, callback: () => sl.lit.setAlpha(sl.lit.alpha > 0.7 ? 0.4 : 1) });
          return { target: { x: SLOT_X[jam], y: SLOT_Y - 6, active: true }, icon: 'flm_fix', dy: 22 };
        }
        const m = man(kind === 'change' ? PAY.x : TABLE.x + 2, kind === 'change' ? PAY.y : AISLE.c, nightLook()).setAlpha(0);
        scene.tweens.add({ targets: m, alpha: 1, duration: 400 });
        persons.setFacing(m, kind === 'change' ? 'up' : 'down');
        if (kind === 'change' && admin) persons.setFacing(admin, 'down');
        // Буян: подпрыгивает и машет кулаком (в лёгкой графике — просто стоит со значком).
        if (kind === 'rowdy' && !lite) scene.tweens.add({ targets: m, y: m.y - 1.5, duration: 180, yoyo: true, repeat: -1, repeatDelay: 500 });
        actor = m;
        return { target: m, icon: kind === 'change' ? 'flm_token' : 'emo_angry', dy: 14 };
      },
      caught: (kind) => {
        if (kind === 'jam') {
          unjam();
          const sl = slots[jam];
          // Починили: барабаны крутанулись, экран снова ровный.
          sl.reels.setVisible(true);
          scene.time.delayedCall(900, () => sl.reels.active && !sl.who && sl.reels.setVisible(false));
          jam = -1;
          return;
        }
        const m = actor;
        actor = null;
        if (!m?.active) return;
        scene.tweens.killTweensOf(m);
        if (kind === 'change') {
          bubble(m, 'emo_heart');
          void (async () => {
            await pause(kit, 800);
            const i = freeSlot();
            if (i >= 0 && m.active) await session(m, i, false, 2);
            if (m.active) await leave(m);
          })();
          return;
        }
        // Буяна выводят: охранник (или администратор из-за стойки) подходит и провожает до лестницы.
        void (async () => {
          const g = guardMan as Man | null;
          const who = g?.active ? g : man(STAIR_FOOT.x, STAIR_FOOT.y, nightGuestLook('guard'));
          who.setData('busy', true);
          scene.tweens.killTweensOf(who);
          await go(who, { x: m.x + 8, y: m.y + FEET });
          if (!m.active || !who.active) return;
          persons.setFacing(who, 'left');
          bubble(m, 'emo_sigh');
          await pause(kit, 700);
          void leave(m);
          await pause(kit, 400);
          await go(who, STAIR_FOOT);
          if (who === g) {
            await walkPts(who, [{ x: 28, y: 66 }], 18);
            who.setData('busy', false);
            persons.setFacing(who, 'down');
          } else if (who.active) {
            await new Promise<void>((done) => scene.tweens.add({ targets: who, y: STAIR_TOP.y - FEET, alpha: 0, duration: 1100, onComplete: () => done() }));
            who.destroy();
          }
        })();
      },
      missed: (kind) => {
        if (kind === 'jam') {
          unjam();
          jam = -1;
          return;
        }
        const m = actor;
        actor = null;
        if (!m?.active) return;
        scene.tweens.killTweensOf(m);
        bubble(m, 'emo_sigh');
        void leave(m);
      },
    });
  }

  // ------------------------------------------------------------ грузчик: из лифта паллету в холодильник
  if (cold && coldImg && coldGlow) {
    const door = coldImg;
    const doorGlow = coldGlow;
    const cart = scene.add.container(0, 0).setVisible(false);
    const jack = kit.art(0, 0, 'bsm_jack').setOrigin(0.5, 1);
    const load = kit.art(1.5, -2.5, 'bsm_pallet').setOrigin(0.5, 1);
    cart.add([jack, load]);
    /**
     * Рохля при грузчике: идёт вбок — катит её перед собой; вверх или вниз — она за ним (выше по экрану и глубже):
     * спереди закрыла бы его целиком.
     */
    const follow = (m: Man): void => {
      const f = (m.getData('facing') as Facing | undefined) ?? 'down';
      const dx = f === 'left' ? -12 : f === 'right' ? 12 : 0;
      const dy = f === 'left' || f === 'right' ? 0 : -3;
      jack.setFlipX(f === 'left');
      load.setX(f === 'left' ? -1.5 : 1.5);
      cart.setPosition(m.x + dx, m.y + FEET + dy).setDepth(m.y + FEET + dy).setAlpha(m.alpha);
    };
    // Рохля едет за грузчиком каждый кадр; обработчик снимаем вместе со сценой (уход с этажа посреди рейса).
    let loader: Man | null = null;
    const tick = (): void => {
      if (loader?.active && cart.visible) follow(loader);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));
    const trip = async (): Promise<void> => {
      const m = man(LIFT.x, LIFT.y - 4, { ...nightLook(), style: 'cap', hair: 0xfeae34, acc: 'vest', accTint: 0xf77622 }).setAlpha(0);
      persons.setFacing(m, 'down');
      loader = m;
      try {
        lift.setTexture('bsm_lift_open');
        liftGlow.setAlpha(0.35);
        cart.setVisible(true);
        load.setVisible(true);
        await new Promise<void>((done) => scene.tweens.add({ targets: m, alpha: 1, duration: 400, onComplete: () => done() }));
        await walkPts(m, [{ x: LIFT.x, y: LOAD_Y }], 16);
        lift.setTexture('bsm_lift');
        liftGlow.setAlpha(0);
        await walkPts(m, [{ x: LOADER_X, y: LOAD_Y }, { x: LOADER_X, y: AISLE.b }, { x: COLD.door - 12, y: AISLE.b }], 16);
        if (!m.active) return;
        door.setTexture('bsm_cold2_open');
        doorGlow.setAlpha(0.45);
        persons.setFacing(m, 'right');
        await pause(kit, 400);
        // Внутрь: паллета уезжает в холодильник, грузчик возвращается с пустой рохлей.
        await new Promise<void>((done) => scene.tweens.add({ targets: load, alpha: 0, duration: 500, onComplete: () => done() }));
        load.setVisible(false).setAlpha(1);
        await pause(kit, 700);
        door.setTexture('bsm_cold2');
        doorGlow.setAlpha(0.18);
        await walkPts(m, [{ x: LOADER_X, y: AISLE.b }, { x: LOADER_X, y: LOAD_Y }, { x: LIFT.x, y: LOAD_Y }], 20);
        if (!m.active) return;
        lift.setTexture('bsm_lift_open');
        liftGlow.setAlpha(0.35);
        await walkPts(m, [{ x: LIFT.x, y: LIFT.y - 2 }], 16);
        await new Promise<void>((done) => scene.tweens.add({ targets: m, alpha: 0, duration: 400, onComplete: () => done() }));
        lift.setTexture('bsm_lift');
        liftGlow.setAlpha(0);
      } finally {
        cart.setVisible(false);
        loader = null;
        m.destroy();
      }
    };
    const loop = async (): Promise<void> => {
      await pause(kit, 1500);
      while (!kit.leaving() && scene.sys.isActive()) {
        await trip();
        await pause(kit, lite ? 12000 : 6000 + Math.random() * 4000);
      }
    };
    void loop();
  }
}

/** Пятно света (ADD поверх вуали): с мерцанием неона/экрана в обычной графике, в лёгкой — ровно. */
function lightPool(kit: FloorKit, x: number, y: number, o: { w: number; h: number; tint: number; alpha: number; depth: number; flicker?: boolean }): Phaser.GameObjects.Image {
  const pool = kit.art(x, y, 'glow').setDisplaySize(o.w, o.h).setTint(o.tint).setAlpha(o.alpha).setBlendMode(Phaser.BlendModes.ADD).setDepth(o.depth);
  if (o.flicker) kit.scene.tweens.add({ targets: pool, alpha: o.alpha * 0.75, duration: 90, yoyo: true, repeat: -1, repeatDelay: 2400 + x * 7, ease: 'Stepped', easeParams: [1] });
  return pool;
}

/**
 * Лампа в сетке на коротком шнуре: колба светится поверх вуали, под ней — тёплый круг на полу (size — его ширина).
 * В обычной графике свет чуть дышит, в лёгкой — горит ровно.
 */
function lamp(kit: FloorKit, x: number, y: number, size: number): void {
  const { scene } = kit;
  scene.add.rectangle(x, y - 12, 0.5, 8, 0x181425).setOrigin(0.5, 0).setDepth(LIGHT);
  kit.art(x, y - 2, 'bsm_lamp').setDepth(LIGHT + 1);
  const halo = kit.art(x, y - 1, 'glow').setDisplaySize(16, 16).setTint(0xfee761).setAlpha(0.65).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT + 2);
  const pool = kit.art(x, y + size * 0.42, 'glow').setDisplaySize(size * 1.3, size).setTint(0xfeae34).setAlpha(0.34).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT);
  if (!kit.lite) scene.tweens.add({ targets: [pool, halo], alpha: '-=0.06', duration: 1100 + x * 4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/**
 * Ломбард (15.11): будка с окном, световой короб с вывеской (слово — на языке игрока), за прилавком — ломбардщик, на
 * полках вещи: сверху на продажу (с ценником), снизу в залоге. Решётка и прилавок — поверх вещей и ломбардщика.
 * С «серой» подсобкой (basement.ts, back) у будки — сейф. Гость с вещью ждёт ответа — над вывеской прыгает метка
 * (в лёгкой графике — просто висит). Возвращает ломбардщика, касание будки и как обновить метку.
 */
function buildPawn(kit: FloorKit, safe: boolean): { broker: Man; onTap: (fn: () => void) => void; refresh: () => void } {
  const { scene, store, lite } = kit;
  const p = pawnOf(store.state);
  const room = prop(kit, PAWN.x, PAWN.y, 'bsm_pawn');
  // Будка: левый край — PAWN.x − 28, верх — PAWN.y − 42. Полки — на 23 и 16 выше низа, окно — от +3 до +47 точек
  // от левого края. Пять вещей в ряд — от левого края окна: справа у прилавка стоит ломбардщик.
  const rows = [PAWN.y - 23, PAWN.y - 16];
  const shelfRows = [p.shelf.map((s) => s.item), p.loans.map((l) => l.item)];
  shelfRows.forEach((ids, row) =>
    ids.slice(0, 5).forEach((id, k) => {
      const ix = PAWN.x - 23 + k * 5.2;
      prop(kit, ix, rows[row], `pawn_${id}`, { depth: PAWN.y + 0.1 + (row * 5 + k) * 0.01 });
      if (row === 0) kit.art(ix + 2.5, rows[row] - 4.5, 'pawn_tag').setDepth(PAWN.y + 0.15);
    }),
  );
  const broker = kit.person(BROKER.x, BROKER.y - FEET, { ...nightLook(), shirt: 0x3a4466, acc: 'vest', accTint: 0x733e39, glasses: true, style: 'bald', hair: 0xc0cbdc }).setDepth(PAWN.y + 0.3);
  persons.setFacing(broker, 'down');
  if (!lite) scene.time.addEvent({ delay: 3600, loop: true, callback: () => broker.active && persons.setFacing(broker, Phaser.Utils.Array.GetRandom(['down', 'down', 'left'] as Facing[])) });
  prop(kit, PAWN.x, PAWN.y, 'bsm_pawn_bars', { depth: PAWN.y + 0.5 });
  if (safe) prop(kit, PAWN.x - 37, PAWN.y, 'pawn_safe');
  // Вывеска светится: слово поверх вуали, тёплое пятно под ним; настольная лампа в окне.
  const sign = kit.text(PAWN.x - 7, PAWN.y - 33.5, t('pawn.sign'), 5, '#fee761').setDepth(LIGHT + 2);
  if (sign.displayWidth > 32) sign.setScale(32 / sign.displayWidth);
  lightPool(kit, PAWN.x - 7, PAWN.y - 34, { w: 46, h: 16, tint: 0xfeae34, alpha: 0.38, depth: LIGHT, flicker: !lite });
  lightPool(kit, PAWN.x + 16, PAWN.y - 18, { w: 34, h: 24, tint: 0xfeae34, alpha: 0.3, depth: LIGHT });
  lightPool(kit, PAWN.x + 19, PAWN.y - 32, { w: 20, h: 16, tint: 0xfee761, alpha: 0.28, depth: LIGHT });
  // Метка «ждут ответа» над вывеской.
  const mark = kit.art(PAWN.x - 21, PAWN.y - 45, 'pawn_mark').setDepth(UI).setVisible(false);
  const bob = lite ? null : scene.tweens.add({ targets: mark, y: mark.y - 2, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', paused: true });
  const refresh = (): void => {
    const on = pawnWaiting(store.state);
    mark.setVisible(on);
    if (on) bob?.resume();
    else bob?.pause();
  };
  refresh();
  return {
    broker,
    onTap: (fn) => void room.setInteractive({ useHandCursor: true }).on('pointerup', fn),
    refresh,
  };
}
