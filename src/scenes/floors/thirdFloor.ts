// Фудкорт в виде этажа (game/foodcourt.ts, 13.11): то, что FloorView (floorView.ts) рисует для третьего этажа.
// Грузится вместе с видом этажа (по требованию), в первый файл игры не входит.
//
// 14.11, автор: «нужно отрисовать красиво и подвал, и второй этаж, и третий — и трафик туда, и улучшения, всё как в
// основном зале». Фудкорт стал настоящим залом (рисунок — art/foodcourt_art.py, раскладка — floors/thirdLayout.ts):
//  · задняя стена — панорамные окна на район: небо по часу дня (днём голубое, к вечеру закат, потом ночь и свет в
//    окнах домов), облака плывут; слева — лифт с раздвижными дверями, вдоль стены — точки еды: подвесная вывеска,
//    табло-меню, кухня у стены, стойка с витриной, за стойкой — повар (ходит, отворачивается к печи, подаёт);
//  · ТРАФИК: гости поднимаются на лифте, берут поднос у стойки с подносами, встают в очередь к точке, получают еду,
//    садятся за общий стол и едят (тарелка пустеет, кивают, переговариваются облачками), сдают поднос в урну и
//    уезжают. Сколько людей сразу на этаже — от едоков дня (foodPlan): тот же расчёт, что и вечерние деньги. По
//    выходным — семьи: ребёнок занимает место, родитель несёт еду; день рождения и закрытая по жалобе точка — как было;
//  · УЛУЧШЕНИЯ (game/foodcourtUps.ts) видны: «дизайн зала» — деревянные столы, настил, обшивка, тёплый свет на
//    столах и высокие фикусы; «детская зона» — коврик, горка, сухой бассейн и лошадка, там играют дети (по выходным
//    — больше);
//    «сцена» — помост с колонками, вечером на ней играет музыкант, к нему тянутся ноты, в зале наплыв;
//  · вечером зал темнеет (как ночь в основном зале), над столами — гирлянды, вывески светят.
// Глубина — по ногам, как в зале; ходят только по проходам (тест tests/floor3-layout.test.ts). Без тряски. В лёгкой
// графике людей меньше, облака стоят, свет не дышит, гирлянды не мигают.
//
// 22.11, автор: «надо улучшать дизайн этажей, сделать их красивее». Зал стал выше (290): пол - плитка с терракотовыми
// ромбиками, столовая - в рамке (песочная шашечка, после «дизайна» - настил), столы - со стульями и табуретами (у
// голого этажа - закусочная: белый пластик и красное, у «дизайна» - дерево и зелёное), детская зона и сцена - своей
// полосой внизу, а не вместо столов; пока их нет - мозаика в полу и кадки, до ремонта на месте нижнего ряда - кусты.

import Phaser from 'phaser';
import { foodPlan, isFoodWeekend, partyOn, stallPlaces, stallsOf, STALLS, type StallId, type StallPlan } from '../../game/foodcourt';
import { floorOf, hasFloorUp } from '../../game/floors';
import { t, type TextKey } from '../../i18n';
import { sound } from '../../platform/sound';
import { ART, SHIRTS, VIEW_SUFFIX, customerLook, type EmoteKey, type Look } from '../common';
import type { StoreScene } from '../StoreScene';
import * as effects from '../effects';
import * as persons from '../persons';
import { AROUND, chalkSpot, facingOf, lightPool, pause, prop, tile, type Facing, type FloorKit } from './kit';
import * as L from './thirdLayout';

type Man = Phaser.GameObjects.Container;

/** Шаг гостя (точек мира в секунду) и на сколько пути один кадр шага (как FRAME_STRIDE в зале). */
const SPEED = 34;
const STRIDE = 3.2;
/** Слои с кадрами взмаха рук (art/walk.py, как SWING_LAYERS в motion.ts). */
const SWING = new Set(['p_shirt', 'p_skin', 'p_skin_happy', 'p_skin_frown']);
/** Сколько едоков дня на одного человека в кадре; сколько людей на этаже сразу — не меньше и не больше. */
const EATERS_PER_GUEST = 5;
const GUESTS_MIN = 3;
const GUESTS_MAX = 18;
const LITE_MAX = 6;
/** Вечерний наплыв: насколько больше людей к ночи (со сценой — заметнее). */
const EVENING_RUSH = 0.15;
const STAGE_RUSH = 0.35;
/** Как часто впускать следующего (мс) и проверять час дня (свет, небо, музыкант). */
const SPAWN_EVERY = 1500;
const CLOCK_EVERY = 1000;
/** Лифт: створки раздвигаются (мс) и держатся открытыми после последнего, кто вошёл или вышел. */
const DOOR_MS = 280;
const DOOR_HOLD = 700;
/** Еда: сколько укусов и пауза между ними (мс); сколько ждут у стойки. */
const BITES = [6, 11];
const BITE_MS = [1300, 2300];
const ORDER_MS = [1200, 2200];
/** Слои ночи: затемнение зала, свет поверх него, гирлянды и всплывашки. */
const NIGHT_DEPTH = 900;
const LIGHT_DEPTH = 910;
const GARLAND_DEPTH = 920;
const POP_DEPTH = 1000;
/** Повар: где стоит (середина человечка) и глубина — между кухней у стены и стойкой. */
const COOK_Y = 55;
const COOK_DEPTH = 59;

/** Как одет повар каждой точки (гардероб, art/wardrobe.py). */
const COOK_LOOK: Record<StallId, Partial<Look>> = {
  pizza: { shirt: 0xffffff, hat: 'toque', outfit: 'chefcoat' },
  grill: { shirt: 0xe43b44, hat: 'bandana', hatTint: 0xe43b44, outfit: 'chefcoat', outfitTint: 0xead4aa },
  sushi: { shirt: 0x262b44, hat: 'headband', hatTint: 0xffffff, outfit: 'chefcoat', outfitTint: 0x3a4466 },
  coffee: { shirt: 0x3e8948, outfit: 'cardigan', outfitTint: 0x733e39, style: 'ponytail' },
};
/** Где у точки греется или парит (пар над печью, вертелом, кофемашиной) — смещение от середины места. */
const STEAM_AT: Record<StallId, [number, number]> = { pizza: [-3, 26], grill: [-7, 30], sushi: [8, 42], coffee: [7, 34] };

interface SeatSlot extends L.Seat {
  who: Man | null;
  /** Место занято заранее (ребёнок держит место родителю, гость идёт к столу). */
  held: boolean;
  plate: Phaser.GameObjects.Image | null;
}

interface StallSpot {
  i: number;
  id: StallId;
  x: number;
  plan: StallPlan;
  cook: Man | null;
  busy: boolean;
}

/** Плавная ступенька 0…1 (для вечера: гирлянды и окна домов зажигаются не сразу). */
const smooth = (a: number, b: number, v: number): number => {
  const k = Phaser.Math.Clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const between = (r: number[]): number => Phaser.Math.Between(r[0], r[1]);

export function buildThird(kit: FloorKit): void {
  const { scene, store, lite } = kit;
  const state = store.state;
  const finish = (floorOf(state, 'third')?.finish ?? 0) > 0;
  const ups = { design: hasFloorUp(state, 'third', 'design'), kids: hasFloorUp(state, 'third', 'kids'), stage: hasFloorUp(state, 'third', 'stage') };
  const plan = foodPlan(state);
  const weekend = isFoodWeekend(state);
  const party = partyOn(state);
  // Эффекты зала (облачка эмоций) ждут сцену магазина — даём им то, что им нужно, от сцены этажа.
  const fx = { art: kit.art, add: scene.add, tweens: scene.tweens, lite } as unknown as StoreScene;
  const people = new Set<Man>();

  // ------------------------------------------------------------ стена, окна, пол
  const sky = scene.add.graphics().setDepth(-20);
  const clouds = [0, 1, 2].map((k) => kit.art(26 + k * 50 + Math.random() * 14, 8 + k * 4, 'fc3_cloud').setDepth(-19).setAlpha(0.95));
  const city = kit.art(0, L.WINDOW_TOP, 'fc3_city').setOrigin(0).setDepth(-18);
  const cityLit = kit.art(0, L.WINDOW_TOP, 'fc3_city_lit').setOrigin(0).setDepth(-17).setAlpha(0);
  tile(kit, 0, 0, L.W, L.SILL + 2, 'fc3_frame', -16);
  tile(kit, 0, L.SILL + 2, L.W, L.WALL_BOTTOM - L.SILL - 2, ups.design ? 'fc3_wain_d' : 'fc3_wain', -15);
  tile(kit, 0, L.WALL_BOTTOM, L.W, L.H - L.WALL_BOTTOM, 'fc3_floor', -14);
  // 14.11: выше и ниже кадра зал продолжается (floorView.drawAround): балка перекрытия вверх, плитка вниз. 22.11: узор
  // плитки повторяется через 32 точки (ромбики на перекрестьях) - продолжение шагает так же, без шва.
  kit.surround({ wall: 0x262b44, floor: 'fc3_floor', floorY: L.WALL_BOTTOM, floorStep: 32, side: 0x733e39, sideW: 4 });
  scene.add.rectangle(0, L.WALL_BOTTOM, L.W, 2, 0x181425, 0.22).setOrigin(0).setDepth(-12);
  diningFloor(kit, L.dine(finish), ups.design);
  for (const x of [0, L.W - 4]) scene.add.rectangle(x, 0, 4, L.H, 0x733e39).setOrigin(0).setDepth(-11);

  // ------------------------------------------------------------ лифт
  prop(kit, L.LIFT_X, L.WALL_BOTTOM, 'fc3_lift', { depth: 0 });
  const doorL = kit.art(L.LIFT_X - 9.5, L.WALL_BOTTOM, 'fc3_lift_door').setOrigin(0, 1).setDepth(1);
  const doorR = kit.art(L.LIFT_X + 9.5, L.WALL_BOTTOM, 'fc3_lift_door').setOrigin(1, 1).setFlipX(true).setDepth(1);
  let riders = 0;
  let doorTimer: Phaser.Time.TimerEvent | null = null;
  const doors = (open: boolean): void => {
    scene.tweens.killTweensOf([doorL, doorR]);
    scene.tweens.add({ targets: [doorL, doorR], scaleX: (open ? 0.12 : 1) / ART, duration: DOOR_MS, ease: 'Sine.easeInOut' });
  };
  /** Кто-то входит или выходит: створки раздвигаются; ушёл последний — закрываются чуть погодя. */
  const liftIn = (): void => {
    riders++;
    doorTimer?.remove();
    doorTimer = null;
    if (riders === 1) doors(true);
  };
  const liftOut = (): void => {
    riders = Math.max(0, riders - 1);
    if (riders) return;
    doorTimer = scene.time.delayedCall(DOOR_HOLD, () => doors(false));
  };

  // ------------------------------------------------------------ точки еды
  const stalls = stallsOf(state);
  const places = stallPlaces(state);
  const spots: StallSpot[] = [];
  for (let i = 0; i < L.STALL_X.length; i++) {
    const x = L.STALL_X[i];
    const id = stalls[i];
    if (i >= places) {
      // Места ещё нет (до ремонта): у окна — высокий фикус, вид на район открыт.
      prop(kit, x, L.COUNTER_BOTTOM - 2, 'fc3_plant_tall');
      continue;
    }
    if (!id) {
      chalkSpot(kit, x, 67, 28, 14, 0xb86f50, 0.7);
      continue;
    }
    const p = plan?.stalls.find((s) => s.id === id);
    if (!p) continue;
    spots.push(buildStall(kit, { i, id, x, plan: p, cook: null, busy: false }));
  }
  if (!stalls.length) kit.text(L.W / 2, 92, t('fc.empty'), 5.5, '#733e39').setDepth(POP_DEPTH - 1).setBackgroundColor('#ead4aacc').setPadding(3, 1, 3, 1);

  // ------------------------------------------------------------ мебель
  prop(kit, L.TRAYS.x, L.TRAYS.y, 'fc3_trays');
  prop(kit, L.BINS.x, L.BINS.y, 'fc3_bins');
  const bush = ups.design ? 'fc3_plant_tall' : 'fc3_plant';
  for (const p of L.PLANTS) prop(kit, p.x, p.y, bush);
  prop(kit, L.COOLER.x, L.COOLER.y, 'fc3_cooler');
  // 22.11: штендер у лифта, узкие кадки у левой стены, кадки в нижних углах; пока внизу пусто - мозаика в полу,
  // без сцены - кусты.
  for (const p of L.SLIM) prop(kit, p.x, p.y, 'fc3_plant_slim');
  // Меловое меню у лифта - только когда есть чем кормить.
  if (spots.length) prop(kit, L.ABOARD.x, L.ABOARD.y, 'fc3_aboard');
  prop(kit, L.CORNERS[1].x, L.CORNERS[1].y, bush);
  if (!ups.kids) prop(kit, L.CORNERS[0].x, L.CORNERS[0].y, bush);
  if (!ups.kids && !ups.stage) kit.art(L.MOSAIC.x, L.MOSAIC.y, 'fc3_mosaic').setDepth(-12.4);
  if (ups.kids && !ups.stage) prop(kit, L.MUSICIAN.x, L.STAGE.y1, 'fc3_hedge');
  const seats: SeatSlot[] = [];
  const tables: number[] = [];
  L.TABLES.forEach((tb, k) => {
    if (!L.hasTable(k, finish)) {
      // До ремонта нижнего ряда нет - на его месте длинная кадка с кустами и цветами.
      prop(kit, tb.x, tb.y - 1, 'fc3_hedge');
      return;
    }
    tables.push(k);
    // Стулья сзади - под теми, кто сидит лицом к нам; столешница с табуретами спереди - поверх них.
    prop(kit, tb.x, tb.y - 16, ups.design ? 'fc3_bench_d' : 'fc3_bench', { depth: tb.y - 18 });
    prop(kit, tb.x, tb.y, ups.design ? 'fc3_table_d' : 'fc3_table', { depth: tb.y - 12 });
    for (const s of L.seatsOf(k)) seats.push({ ...s, who: null, held: false, plate: null });
    if (ups.design) {
      // Тёплый свет на столешнице (светильники под потолком — в кадр не попадают, виден их круг).
      lightPool(kit, tb.x, tb.y - 12, { w: 64, h: 26, tint: 0xfeae34, alpha: 0.16, depth: LIGHT_DEPTH, breathe: { alpha: 0.11, ms: 1700 + k * 130 } });
    }
  });

  // ------------------------------------------------------------ люди: шагомер, походка, руки
  const feet = (m: Man): L.Pt => ({ x: m.x, y: m.y + L.FOOT });
  /** Глубина по ногам; в кабине лифта — между кабиной и створками. */
  const depthAt = (y: number): number => (y < L.WALL_BOTTOM + 1 ? 0.5 : y);
  const make = (look: Look, at: L.Pt): Man => {
    const man = kit.person(at.x, at.y - L.FOOT, look).setDepth(depthAt(at.y));
    man.setData('step', { x: man.x, y: man.y, phase: Math.random() * 4, idle: Math.random() * 3000 });
    man.setData('speed', SPEED * (look.kid ? 1.12 : Phaser.Math.FloatBetween(0.9, 1.1)));
    // Своя полоса в проходах (thirdLayout.ts route): иначе идущие друг за другом сливаются в столбик.
    man.setData('lane', Phaser.Math.FloatBetween(-L.LANE, L.LANE));
    people.add(man);
    man.once('destroy', () => people.delete(man));
    return man;
  };
  const stepTo = (man: Man, p: L.Pt, speed?: number): Promise<void> =>
    new Promise((done) => {
      const f = feet(man);
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (!man.active || d < 0.3) return done();
      persons.setFacing(man, facingOf(p.x - f.x, p.y - f.y));
      scene.tweens.add({
        targets: man,
        x: p.x,
        y: p.y - L.FOOT,
        duration: (d / (speed ?? (man.getData('speed') as number))) * 1000,
        onUpdate: () => man.setDepth(depthAt(man.y + L.FOOT)),
        onComplete: () => done(),
      });
    });
  /** Дойти по проходам (floors/thirdLayout.ts route): сквозь столы и стойки не ходят. */
  const walkTo = (man: Man, to: L.Pt): Promise<void> => L.route(feet(man), to, (man.getData('lane') as number | undefined) ?? 0).reduce<Promise<void>>((prev, p) => prev.then(() => stepTo(man, p)), Promise.resolve());
  const face = (man: Man, f: Facing): void => {
    if (man.active) persons.setFacing(man, f);
  };
  /** Что в руках (поднос): спереди — перед грудью, сбоку — у бока, со спины не видно. */
  const hold = (man: Man, key: string | null): void => {
    const old = man.getData('hand') as Phaser.GameObjects.Image | undefined;
    old?.destroy();
    man.setData('hand', undefined);
    if (!key || !man.active) return;
    const img = kit.art(0, 3, key).setScale(0.85 / ART);
    man.add(img);
    man.setData('hand', img);
  };
  const emote = (man: Man, key: EmoteKey): void => {
    if (man.active) effects.emote(fx, man, key);
  };
  /** Облачко разговора над головой: всплывает и тает (своё, не облачко эмоции — их у человека одно). */
  const talk = (man: Man): void => {
    if (!man.active) return;
    const bubble = kit.art(man.x + 5, man.y - 12, 'fc3_talk').setOrigin(0.2, 1).setDepth(POP_DEPTH - 2).setScale(0);
    scene.tweens.add({ targets: bubble, scale: 0.8 / ART, duration: 200, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: bubble, alpha: 0, y: bubble.y - 3, delay: 1300, duration: 350, onComplete: () => bubble.destroy() });
  };
  const step = (time: number): void => {
    for (const man of people) {
      if (!man.active) continue;
      const st = man.getData('step') as { x: number; y: number; phase: number; idle: number };
      const moved = Math.hypot(man.x - st.x, man.y - st.y);
      st.x = man.x;
      st.y = man.y;
      const facing = (man.getData('facing') as Facing | undefined) ?? 'down';
      const suffix = VIEW_SUFFIX[facing];
      let key = `p_legs0${suffix}`;
      let flip = facing === 'left';
      let arms = '';
      let bob = 0;
      if (moved > 0.01 && !man.getData('seated')) {
        st.phase = (st.phase + moved / STRIDE) % 4;
        const frame = Math.floor(st.phase);
        if (frame === 1) key = `p_legs1${suffix}`;
        if (frame === 3) {
          if (suffix === '_s') key = 'p_legs2_s';
          else {
            key = `p_legs1${suffix}`;
            flip = !flip;
          }
        }
        // С подносом руки не машут — несут.
        if (!man.getData('hand')) arms = frame === 1 ? '_w1' : frame === 3 ? '_w2' : '';
        bob = frame % 2 === 0 ? -0.5 : 0;
      } else if (!lite) bob = Math.sin((time + st.idle) / 650) > 0.35 ? -0.5 : 0;
      const legs = man.getData('legs') as Phaser.GameObjects.Image | undefined;
      if (legs && (legs.texture.key !== key || legs.flipX !== flip)) legs.setTexture(key).setFlipX(flip);
      for (const [img, base] of (man.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined) ?? []) {
        if (!SWING.has(base)) continue;
        const want = base + suffix + arms;
        if (img.texture.key !== want) img.setTexture(want);
      }
      const extra = (man.getData('bite') as number | undefined) ?? 0;
      for (const img of (man.getData('upper') as Phaser.GameObjects.Image[] | undefined) ?? []) img.y = bob + extra + ((img.getData('dy') as number | undefined) ?? 0);
      const hand = man.getData('hand') as Phaser.GameObjects.Image | undefined;
      if (hand) hand.setVisible(facing !== 'up').setPosition(facing === 'left' ? -3 : facing === 'right' ? 3 : 0, 3 + bob);
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, step));

  const guestLook = (kid = false): Look => {
    const base = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day);
    return { ...base, stroller: undefined, dog: undefined, ...(kid ? { kid: true, bag: undefined, prop: undefined } : {}) };
  };

  // ------------------------------------------------------------ повара
  for (const s of spots) {
    if (s.plan.closed) continue;
    const look = { ...customerLook(0xffffff, 0), bag: undefined, prop: undefined, back: undefined, stroller: undefined, dog: undefined, ...COOK_LOOK[s.id] } as Look;
    const cook = kit.person(s.x, COOK_Y, look).setDepth(COOK_DEPTH);
    cook.setData('step', { x: cook.x, y: cook.y, phase: 0, idle: Math.random() * 3000 });
    people.add(cook);
    s.cook = cook;
    void cookIdle(s);
  }
  /** Повар не стоит столбом: шаг вбок, к печи (пар), обратно к стойке. Подаёт — idle ждёт. */
  async function cookIdle(s: StallSpot): Promise<void> {
    const cook = s.cook!;
    while (cook.active) {
      await pause(kit, Phaser.Math.Between(900, 2600));
      if (!cook.active || s.busy) continue;
      const r = Math.random();
      if (r < 0.45) {
        const to = s.x + Phaser.Math.Between(-7, 7);
        face(cook, to > cook.x ? 'right' : 'left');
        await moveCook(s, to);
        face(cook, 'down');
      } else if (r < 0.8) {
        face(cook, 'up');
        steam(s);
        await pause(kit, 1100);
        if (!s.busy) face(cook, 'down');
      }
    }
  }
  const moveCook = (s: StallSpot, x: number): Promise<void> =>
    new Promise((done) => {
      const cook = s.cook;
      if (!cook?.active) return done();
      scene.tweens.killTweensOf(cook);
      scene.tweens.add({ targets: cook, x: Phaser.Math.Clamp(x, s.x - 8, s.x + 8), duration: Math.abs(x - cook.x) * 45 + 60, onComplete: () => done() });
    });
  /** Пар или жар над кухней: три облачка поднимаются и тают (в лёгкой графике — одно). */
  function steam(s: StallSpot): void {
    const [dx, y] = STEAM_AT[s.id];
    for (let k = 0; k < (lite ? 1 : 3); k++) {
      const puff = kit.art(s.x + dx + Phaser.Math.FloatBetween(-1.5, 1.5), y, 'puff').setScale(0.35 / ART).setAlpha(0).setDepth(3);
      scene.tweens.add({ targets: puff, y: y - 9, alpha: { from: 0.75, to: 0 }, scale: 0.7 / ART, delay: k * 260, duration: 1100, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
    }
  }

  // ------------------------------------------------------------ очередь и еда
  const queues: Man[][] = L.STALL_X.map(() => []);
  const open = spots.filter((s) => !s.plan.closed && s.plan.eaters > 0);
  /** К какой точке идти: по доле едоков, свободная очередь — лучше. */
  const pickStall = (): StallSpot | null => {
    if (!open.length) return null;
    const room = open.filter((s) => queues[s.i].length < 2);
    const pool = room.length ? room : open;
    let r = Math.random() * pool.reduce((n, s) => n + s.plan.eaters, 0);
    for (const s of pool) if ((r -= s.plan.eaters) <= 0) return s;
    return pool[0];
  };
  /** Встать в очередь, дождаться, заказать, получить поднос с едой. false — не дождался (сцену закрыли). */
  async function order(man: Man, s: StallSpot): Promise<boolean> {
    const q = queues[s.i];
    // Подходит по проходу к своей точке (кто уже стоит у неё — с утра в очереди — не ходит).
    if (Math.abs(man.x - s.x) > 1) await walkTo(man, { x: s.x, y: L.AISLES[0] });
    while (man.active && q.length >= 2) await pause(kit, 350);
    if (!man.active) return false;
    q.push(man);
    let at = -1;
    while (man.active) {
      const idx = q.indexOf(man);
      if (idx !== at) {
        at = idx;
        await walkTo(man, { x: s.x, y: L.QUEUE_Y[idx] });
        face(man, 'up');
        continue;
      }
      if (idx === 0) break;
      await pause(kit, 250);
    }
    if (!man.active) return false;
    // Повар подходит к стойке, принимает заказ, отворачивается к кухне — и выдаёт поднос.
    s.busy = true;
    await moveCook(s, s.x);
    face(s.cook!, 'down');
    if (Math.random() < 0.35) emote(s.cook!, 'emo_question');
    await pause(kit, between(ORDER_MS) / 2);
    face(s.cook!, 'up');
    steam(s);
    await pause(kit, between(ORDER_MS) / 2);
    face(s.cook!, 'down');
    s.busy = false;
    q.shift();
    if (!man.active) return false;
    hold(man, `fc3_tray_${s.id}`);
    if (Math.random() < 0.3) emote(man, 'emo_heart');
    sound.tap();
    await walkTo(man, L.queueExit(s.i));
    return man.active;
  }

  /** Свободное место (и рядом — второе, для семьи). Праздничный стол — только для праздника. */
  const freeSeat = (pair: boolean): [SeatSlot, SeatSlot | null] | null => {
    const free = seats.filter((s) => !s.who && !s.held && !(party && s.table === tables[0]));
    Phaser.Utils.Array.Shuffle(free);
    for (const s of free) {
      if (!pair) return [s, null];
      const next = free.find((o) => o !== s && o.table === s.table && o.back === s.back && Math.abs(o.x - s.x) === 16);
      if (next) return [s, next];
    }
    return null;
  };
  /** Сесть: подойти к краю стола, ноги спрятать, опуститься на скамью — лицом к нам или спиной. */
  async function sit(man: Man, seat: SeatSlot): Promise<void> {
    seat.held = true;
    await walkTo(man, seat.approach);
    if (!man.active) return;
    seat.who = man;
    seat.held = false;
    man.setData('seated', true);
    face(man, seat.back ? 'down' : 'up');
    (man.getData('legs') as Phaser.GameObjects.Image | undefined)?.setVisible(false);
    (man.getData('shadow') as Phaser.GameObjects.Image | undefined)?.setVisible(false);
    const tb = L.TABLES[seat.table];
    man.setDepth(seat.back ? tb.y - 16 : tb.y + 0.5);
    await new Promise<void>((done) => scene.tweens.add({ targets: man, x: seat.x, y: seat.sitY, duration: 220, ease: 'Sine.easeOut', onComplete: () => done() }));
  }
  const stand = async (man: Man, seat: SeatSlot): Promise<void> => {
    seat.who = null;
    seat.plate?.destroy();
    seat.plate = null;
    if (!man.active) return;
    man.setData('seated', false);
    (man.getData('legs') as Phaser.GameObjects.Image | undefined)?.setVisible(true);
    (man.getData('shadow') as Phaser.GameObjects.Image | undefined)?.setVisible(true);
    await stepTo(man, seat.approach, 30);
  };
  /** Тарелка на столе перед сидящим (у сидящего спиной — чуть вбок, чтобы её было видно). */
  const plate = (seat: SeatSlot, key: string): void => {
    const tb = L.TABLES[seat.table];
    seat.plate?.destroy();
    seat.plate = kit.art(seat.x + (seat.back ? 0 : 6), seat.back ? tb.y - 15 : tb.y - 10, key).setScale(0.9 / ART).setDepth(tb.y - 11.9);
  };
  /** Едят: укус — кивок над тарелкой; к середине тарелка надкусана, в конце пустая. Соседи переговариваются. */
  async function eat(man: Man, seat: SeatSlot, id: StallId, bites = between(BITES)): Promise<void> {
    plate(seat, `fc3_plate_${id}`);
    for (let b = 0; b < bites && man.active; b++) {
      await pause(kit, between(BITE_MS));
      if (!man.active) return;
      man.setData('bite', 0.8);
      scene.time.delayedCall(170, () => man.active && man.setData('bite', 0));
      if (b === Math.floor(bites / 2)) plate(seat, `fc3_plate_${id}2`);
      const company = seats.some((o) => o !== seat && o.table === seat.table && o.who);
      const r = Math.random();
      if (company && r < 0.28) talk(man);
      else if (r > 0.93) emote(man, Math.random() < 0.5 ? 'emo_heart' : 'emo_star');
    }
    if (man.active) plate(seat, 'fc3_plate');
  }
  const stallFor = (): StallId => (open.length ? (pickStall() ?? open[0]).id : 'coffee');

  /** Очередь к урне: первый сдаёт поднос, остальные ждут за ним. */
  const binQ: Man[] = [];
  /** Уйти: сдать поднос в урну и уехать на лифте. */
  async function leave(man: Man): Promise<void> {
    if (!man.active) return;
    if (man.getData('hand')) {
      // К урне — очередью (thirdLayout.ts binSlot): подошёл на своё место, ушёл передний — шаг вперёд.
      binQ.push(man);
      let at = -1;
      while (man.active) {
        const idx = binQ.indexOf(man);
        if (idx !== at) {
          const first = at < 0;
          at = idx;
          await (first ? walkTo(man, L.binSlot(idx)) : stepTo(man, L.binSlot(idx)));
          // Первый — к урне; второй стоит над ним и смотрит на него; дальние — вдоль столов, к урне.
          face(man, idx === 1 ? 'down' : 'right');
          continue;
        }
        if (idx === 0) break;
        await pause(kit, 200);
      }
      if (man.active) {
        await pause(kit, 380);
        hold(man, null);
      }
      binQ.splice(binQ.indexOf(man), 1);
      if (!man.active) return;
    }
    // У лифта двери уже открываются — к кабине подходят, когда створки разъехались.
    await walkTo(man, { x: L.LIFT_X, y: 70 });
    if (!man.active) return;
    liftIn();
    await walkTo(man, L.LIFT_IN);
    if (!man.active) return liftOut();
    face(man, 'up');
    await new Promise<void>((done) => scene.tweens.add({ targets: man, alpha: 0, delay: 200, duration: 320, onComplete: () => done() }));
    liftOut();
    man.destroy();
  }
  /** Приехать на лифте: створки раздвигаются, гость выходит из кабины. */
  async function arrive(look: Look): Promise<Man> {
    const man = make(look, L.LIFT_IN).setAlpha(0);
    face(man, 'down');
    liftIn();
    await new Promise<void>((done) => scene.tweens.add({ targets: man, alpha: 1, delay: DOOR_MS, duration: 260, onComplete: () => done() }));
    liftOut();
    return man;
  }

  /** Гость целиком: лифт → подносы → очередь → стол → еда → урна → лифт. */
  async function guest(): Promise<void> {
    const man = await arrive(guestLook());
    await walkTo(man, L.TRAY_SPOT);
    if (!man.active) return;
    face(man, 'left');
    await pause(kit, 420);
    hold(man, 'fc3_tray');
    const s = pickStall();
    if (!s || !(await order(man, s))) return void leave(man);
    const pick = freeSeat(false);
    // Мест нет — берёт с собой и уезжает.
    if (!pick) return void leave(man);
    const [seat] = pick;
    await sit(man, seat);
    if (!man.active) return;
    hold(man, null);
    await eat(man, seat, s.id);
    await stand(man, seat);
    hold(man, 'fc3_tray_done');
    await leave(man);
  }

  /**
   * Семья (выходные): ребёнок бежит занять места, родитель берёт поднос и стоит в очереди, приносит еду на двоих.
   * С детской зоной ребёнок после еды убегает играть, а родитель ещё посидит.
   */
  async function family(): Promise<void> {
    const pick = freeSeat(true);
    if (!pick || !pick[1]) return guest();
    const [a, b] = pick;
    a.held = b.held = true;
    const parent = await arrive(guestLook());
    const kid = make(guestLook(true), { x: L.LIFT_X + 3, y: L.LIFT_IN.y });
    kid.setAlpha(0);
    scene.tweens.add({ targets: kid, alpha: 1, duration: 260 });
    const kidGoes = (async () => {
      await sit(kid, b);
      if (kid.active && Math.random() < 0.6) emote(kid, 'emo_heart');
    })();
    await walkTo(parent, L.TRAY_SPOT);
    face(parent, 'left');
    await pause(kit, 420);
    hold(parent, 'fc3_tray');
    const s = pickStall();
    if (!s || !(await order(parent, s))) {
      // Место родителя отпускаем (иначе оно «занято» до конца дня — 14.11, ревью); место ребёнка держит sit, пока
      // ребёнок до него не дошёл, — отпускать его здесь значило бы отдать место, к которому он уже бежит.
      a.held = false;
      void kidGoes.then(() => (b.who === kid ? stand(kid, b).then(() => leave(kid)) : undefined));
      return void leave(parent);
    }
    await sit(parent, a);
    if (!parent.active) return;
    hold(parent, null);
    await kidGoes;
    if (kid.active) plate(b, `fc3_plate_${s.id}`);
    const kidEats = kid.active ? eat(kid, b, s.id, between(BITES) - 1) : Promise.resolve();
    await Promise.all([eat(parent, a, s.id), kidEats]);
    if (kid.active && ups.kids) {
      // В детскую зону: поиграть, потом к лифту (родитель догонит).
      await stand(kid, b);
      void play(kid, 2).then(() => leave(kid));
      await pause(kit, 3000);
    } else if (kid.active) {
      await stand(kid, b);
      void leave(kid);
    }
    await stand(parent, a);
    hold(parent, 'fc3_tray_done');
    await leave(parent);
  }

  // ------------------------------------------------------------ детская зона
  const horse = ups.kids ? buildKids(kit) : null;
  /** Ребёнок играет: горка, сухой бассейн, лошадка или просто бегает по коврику — rounds раз (0 — без конца). */
  async function play(kid: Man, rounds = 0): Promise<void> {
    if (!ups.kids) return;
    await walkTo(kid, L.KID_TOP);
    // По коврику — через две «развилки» (сверху и снизу), чтобы не бегать сквозь горку и бассейн.
    const hub = async (low: boolean): Promise<void> => {
      const f = feet(kid);
      const near = f.y > L.KID_BOTTOM.y - 8 ? L.KID_BOTTOM : L.KID_TOP;
      await stepTo(kid, near);
      if ((near === L.KID_BOTTOM) !== low) await stepTo(kid, low ? L.KID_BOTTOM : L.KID_TOP);
    };
    for (let n = 0; kid.active && (!rounds || n < rounds); n++) {
      const r = Math.random();
      if (r < 0.4) {
        // Горка: к лесенке, наверх, съехать — и радость.
        const [foot, top, end] = L.SLIDE_PATH;
        await hub(true);
        await stepTo(kid, foot);
        face(kid, 'up');
        await stepTo(kid, top, 10);
        kid.setDepth(L.H - 2);
        face(kid, 'right');
        await stepTo(kid, end, 42);
        kid.setDepth(end.y);
        if (Math.random() < 0.5) emote(kid, 'emo_star');
        await pause(kit, 400);
      } else if (r < 0.65) {
        // Сухой бассейн: забраться и побарахтаться (спереди — бортик бассейна).
        await hub(false);
        await stepTo(kid, L.PIT_EDGE);
        await stepTo(kid, L.PIT_IN, 14);
        kid.setDepth(L.PIT.y - 1);
        for (let k = 0; k < 3 && kid.active; k++) {
          face(kid, k % 2 ? 'left' : 'right');
          await pause(kit, 500);
        }
        await stepTo(kid, L.PIT_EDGE, 14);
      } else if (r < 0.8 && horse) {
        // Лошадка-качалка.
        await hub(false);
        await stepTo(kid, L.HORSE_WAY);
        await stepTo(kid, L.HORSE_SEAT);
        face(kid, 'right');
        if (!lite) scene.tweens.add({ targets: horse, angle: { from: -7, to: 7 }, duration: 360, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => horse.setAngle(0) });
        await pause(kit, 1500);
        // Слезть - назад по верху коврика (не сквозь бассейн).
        await stepTo(kid, L.HORSE_WAY);
      } else {
        await hub(Math.random() < 0.5);
        face(kid, 'down');
        await pause(kit, 700);
      }
    }
    if (kid.active) await hub(false);
  }
  if (ups.kids && open.length) {
    // Дети в игровой с утра: в выходные — трое, в будни — один; рядом — мама или папа присматривает.
    const kids = lite ? 1 : weekend ? 3 : 1;
    for (let k = 0; k < kids; k++) {
      const kid = make(guestLook(true), k % 2 ? L.KID_BOTTOM : L.KID_TOP);
      void pause(kit, k * 900).then(() => play(kid));
    }
    const mom = make(guestLook(), L.WATCH);
    face(mom, 'left');
    if (!lite) scene.time.addEvent({ delay: 5200, loop: true, callback: () => Math.random() < 0.4 && emote(mom, 'emo_heart') });
  }

  // ------------------------------------------------------------ сцена
  let musician: Man | null = null;
  const stageLight = ups.stage ? buildStage(kit) : null;
  const notes = (): void => {
    if (!musician?.active || lite) return;
    const note = kit.art(L.MUSICIAN.x + Phaser.Math.FloatBetween(-6, 8), L.MUSICIAN.y - 20, Math.random() < 0.5 ? 'fc3_note' : 'fc3_note2').setScale(0.8 / ART).setDepth(POP_DEPTH - 3);
    scene.tweens.add({ targets: note, y: note.y - 14, x: note.x + Phaser.Math.FloatBetween(-6, 6), alpha: { from: 1, to: 0 }, duration: 1900, ease: 'Sine.easeOut', onComplete: () => note.destroy() });
  };
  const playMusic = (on: boolean): void => {
    if (on === Boolean(musician)) return;
    if (on) {
      musician = make({ ...guestLook(), outfit: 'band', outfitTint: 0x262b44, hat: undefined }, L.MUSICIAN).setAlpha(0).setDepth(L.STAGE.y1 + 1);
      musician.add(kit.art(1, 3.5, 'fc3_guitar').setScale(0.9 / ART));
      musician.setData('hand', undefined);
      scene.tweens.add({ targets: musician, alpha: 1, duration: 600 });
      if (!lite) scene.tweens.add({ targets: musician, scaleY: { from: musician.scaleY, to: musician.scaleY * 0.97 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      const m = musician!;
      musician = null;
      scene.tweens.add({ targets: m, alpha: 0, duration: 500, onComplete: () => m.destroy() });
    }
  };
  if (ups.stage) scene.time.addEvent({ delay: 650, loop: true, callback: notes });

  // ------------------------------------------------------------ праздник
  if (party) buildParty();
  function buildParty(): void {
    const k = tables[0];
    const tb = L.TABLES[k];
    prop(kit, tb.x - 19, tb.y - 10, 'fc_balloons', { depth: tb.y - 11 });
    prop(kit, tb.x, tb.y - 10, 'item_honeycake', { depth: tb.y - 11.5, scale: 0.9 });
    // Растяжка над праздничным столом — поверх всех.
    const sign = kit.text(tb.x, tb.y - 40, `🎂 ${t('fc.birthday')}`, 5, '#fee761').setDepth(POP_DEPTH - 1);
    sign.setBackgroundColor('#b55088cc').setPadding(2, 1, 2, 1);
    if (!lite) scene.tweens.add({ targets: sign, y: sign.y - 1.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const mine = seats.filter((s) => s.table === k);
    mine.forEach((seat, n) => {
      const kid = n < 4;
      const look = kid ? { ...guestLook(true), prop: 'balloon' as const, propTint: Phaser.Utils.Array.GetRandom([0xe43b44, 0xfee761, 0x2ce8f5]) } : guestLook();
      const man = make(look, seat.approach);
      void sit(man, seat).then(async () => {
        plate(seat, 'fc3_plate_coffee');
        while (man.active) {
          await pause(kit, Phaser.Math.Between(1600, 3600));
          if (Math.random() < 0.5) talk(man);
          else if (kid && Math.random() < 0.5) emote(man, 'emo_heart');
        }
      });
    });
  }

  // ------------------------------------------------------------ свет и час дня
  // Вечер темнит и продолжение зала над и под кадром (kit.surround) — с запасом AROUND.
  const night = scene.add.rectangle(0, -AROUND, L.W, L.H + 2 * AROUND, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(NIGHT_DEPTH);
  const signGlow = spots
    .filter((s) => !s.plan.closed)
    .map((s) => [
      lightPool(kit, s.x, 14, { w: 44, h: 22, tint: s.id === 'sushi' ? 0xf6757a : 0xfeae34, alpha: 0, depth: LIGHT_DEPTH }),
      lightPool(kit, s.x, L.COUNTER_BOTTOM + 4, { w: 40, h: 14, tint: 0xfeae34, alpha: 0, depth: LIGHT_DEPTH }),
    ])
    .flat();
  const garlands = buildGarlands(kit);
  let shownEv = -1;
  let cloudAlpha = 0.95;
  const clock = (): void => {
    const ev = Phaser.Math.Clamp(store.evening, 0, 1);
    if (Math.abs(ev - shownEv) < 0.01) return;
    shownEv = ev;
    paintSky(sky, ev, store.weather);
    const dusk = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0x6a5a8a), 100, Math.round(ev * 100));
    city.setTint(Phaser.Display.Color.GetColor(dusk.r, dusk.g, dusk.b));
    cloudAlpha = 0.95 * (1 - smooth(0.6, 1, ev));
    for (const c of clouds) c.setTint(ev > 0.3 ? 0xf6757a : 0xffffff).setAlpha(cloudAlpha);
    cityLit.setAlpha(smooth(0.3, 0.8, ev));
    // Зал к ночи темнеет, но не как улица: внутри горит свет (у основного зала — то же).
    const dim = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0x8a78b0), 100, Math.round(ev * 100));
    night.setFillStyle(Phaser.Display.Color.GetColor(dim.r, dim.g, dim.b));
    for (const g of signGlow) g.setAlpha(0.08 + 0.4 * ev);
    garlands.setAlpha(smooth(0.15, 0.5, ev));
    stageLight?.setAlpha(0.35 * smooth(0.1, 0.4, ev));
    if (ups.stage && open.length) playMusic(ev > 0.12);
  };
  clock();
  scene.time.addEvent({ delay: CLOCK_EVERY, loop: true, callback: clock });
  // Облака за окном плывут (в лёгкой графике стоят); у краёв окна тают.
  if (!lite) {
    const drift = (_t: number, dt: number): void => {
      for (const c of clouds) {
        c.x += dt * 0.0016;
        if (c.x > L.W - 12) c.x = 12;
        // У краёв окна облако тает (за рамой зала его не видно).
        const edge = Phaser.Math.Clamp(Math.min(c.x - 12, L.W - 12 - c.x) / 14, 0, 1);
        c.setAlpha(edge * cloudAlpha);
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, drift);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, drift));
  }

  // ------------------------------------------------------------ поток гостей
  if (!open.length) return;
  // Сколько людей сразу на этаже — от едоков дня: тот же foodPlan, что считает вечерние деньги.
  const eaters = plan?.eaters ?? 0;
  const target = (): number => {
    const rush = 1 + (ups.stage ? STAGE_RUSH : EVENING_RUSH) * store.evening;
    const n = Phaser.Math.Clamp(Math.round((eaters / EATERS_PER_GUEST) * rush), GUESTS_MIN, GUESTS_MAX);
    return lite ? Math.min(n, LITE_MAX) : n;
  };
  let inside = 0;
  const run = (job: () => Promise<void>): void => {
    inside++;
    void job().finally(() => inside--);
  };
  // С порога зал уже живой: часть гостей сидит и ест, у точек стоят.
  const start = Math.round(target() * 0.6);
  for (let n = 0; n < start; n++) {
    const pick = freeSeat(false);
    if (!pick) break;
    const [seat] = pick;
    const id = stallFor();
    run(async () => {
      const man = make(guestLook(), seat.approach);
      await sit(man, seat);
      // Доедают вразнобой (до 10 укусов): иначе сидевшие с порога встают почти разом и толпятся у урны.
      await eat(man, seat, id, Phaser.Math.Between(1, 10));
      await stand(man, seat);
      hold(man, 'fc3_tray_done');
      await leave(man);
    });
  }
  for (const s of open) {
    if (Math.random() < 0.7) {
      run(async () => {
        const man = make(guestLook(), { x: s.x, y: L.QUEUE_Y[0] });
        hold(man, 'fc3_tray');
        face(man, 'up');
        if (!(await order(man, s))) return leave(man);
        const pick = freeSeat(false);
        if (!pick) return leave(man);
        await sit(man, pick[0]);
        hold(man, null);
        await eat(man, pick[0], s.id);
        await stand(man, pick[0]);
        hold(man, 'fc3_tray_done');
        await leave(man);
      });
    }
  }
  scene.time.addEvent({
    delay: SPAWN_EVERY,
    loop: true,
    callback: () => {
      if (kit.leaving() || inside >= target()) return;
      run(weekend && Math.random() < 0.4 ? family : guest);
    },
  });
}

/** Точка: кухня с вывеской у стены, стойка с витриной; закрытая — под рольставней и с табличкой. Касание — сводка. */
function buildStall(kit: FloorKit, s: StallSpot): StallSpot {
  const { x, id, plan } = s;
  const back = prop(kit, x, L.WALL_BOTTOM, `fc3_${id}`, { depth: L.WALL_BOTTOM - 1 });
  const front = prop(kit, x, L.COUNTER_BOTTOM, `fc3_${id}_front`, { depth: L.COUNTER_BOTTOM });
  if (plan.closed) {
    prop(kit, x, L.COUNTER_BOTTOM, 'fc3_shutter', { depth: L.COUNTER_BOTTOM + 0.2 });
    const sign = kit.text(x, 62, t('fc.closedSign'), 4.5, '#ffffff').setDepth(L.COUNTER_BOTTOM + 0.3);
    sign.setBackgroundColor('#a22633').setPadding(1.5, 0.5, 1.5, 0.5);
  }
  const tap = (): void => {
    sound.tap();
    const name = t(`fc.stall.${id}` as TextKey);
    // 27.11: и кто ведёт точку (арендатор или наша кухня) — повар у стойки свой у точки, нанимать его не надо.
    const who = t(plan.mode === 'own' ? 'fc.who.own' : 'fc.who.rent');
    kit.popup(x, 30, plan.closed ? `${STALLS[id].icon} ${t('fc.inspect.closed', { name })}` : `${STALLS[id].icon} ${t('fc.tap', { n: plan.eaters, sum: plan.income, who })}`, { depth: POP_DEPTH });
  };
  for (const img of [back, front]) img.setInteractive({ useHandCursor: true }).on('pointerup', tap);
  return s;
}

/** Небо за окнами: днём голубое, к вечеру — закат, потом ночь; в дождь и снег — серое. */
function paintSky(g: Phaser.GameObjects.Graphics, ev: number, weather: string): void {
  const grey = weather === 'rain' || weather === 'storm' || weather === 'snow';
  const keys: [number, number, number][] = grey
    ? [
        [0, 0x8b9bb4, 0xc0cbdc],
        [0.5, 0x5a6988, 0x8b9bb4],
        [1, 0x262b44, 0x3a4466],
      ]
    : [
        [0, 0x4fa4e8, 0xb8e4ff],
        [0.45, 0x68386c, 0xf77622],
        [1, 0x181425, 0x3a2a5a],
      ];
  let i = 0;
  while (i < keys.length - 2 && ev > keys[i + 1][0]) i++;
  const [a, b] = [keys[i], keys[i + 1]];
  const k = Phaser.Math.Clamp((ev - a[0]) / (b[0] - a[0]), 0, 1);
  const mixc = (c1: number, c2: number): number => {
    const m = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(c1), Phaser.Display.Color.ValueToColor(c2), 100, Math.round(k * 100));
    return Phaser.Display.Color.GetColor(m.r, m.g, m.b);
  };
  const top = mixc(a[1], b[1]);
  const bottom = mixc(a[2], b[2]);
  g.clear();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, L.WINDOW_TOP, L.W, L.SILL - L.WINDOW_TOP);
}

/**
 * Пол столовой (22.11, автор: «сделать этажи красивее»): под столами - своя плитка в рамке, зал делится на проходы
 * и места. Голый этаж - песочная шашечка в терракотовой рамке; после «дизайна зала» - деревянный настил с тёмной
 * кромкой и латунной полосой. Рамка - полосками по краю (в точках мира, ровно по сетке пикселей рисунка).
 */
function diningFloor(kit: FloorKit, b: L.Box, design: boolean): void {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  tile(kit, b.x0, b.y0, w, h, design ? 'fc3_deck' : 'fc3_dine', -13);
  const ring = (inset: number, size: number, color: number): void => {
    const x = b.x0 + inset;
    const y = b.y0 + inset;
    const rw = w - 2 * inset;
    const rh = h - 2 * inset;
    for (const [rx, ry, rw2, rh2] of [
      [x, y, rw, size],
      [x, y + rh - size, rw, size],
      [x, y, size, rh],
      [x + rw - size, y, size, rh],
    ]) {
      kit.scene.add.rectangle(rx, ry, rw2, rh2, color).setOrigin(0).setDepth(-12.5);
    }
  };
  if (design) {
    ring(0, 0.5, 0x3e2731);
    ring(0.5, 0.5, 0x733e39);
    ring(1, 0.5, 0xfeae34);
  } else {
    ring(0, 0.5, 0x8f563b);
    ring(0.5, 1, 0xc28569);
    ring(1.5, 0.5, 0xe4a672);
  }
}

/** Детская зона: коврик, горка, сухой бассейн (бортик спереди — поверх ребёнка), лошадка. Возвращает лошадку. */
function buildKids(kit: FloorKit): Phaser.GameObjects.Image {
  kit.art(L.KIDS.x0, L.KIDS.y0, 'fc3_kmat').setOrigin(0).setDepth(-12);
  prop(kit, L.SLIDE.x, L.SLIDE.y, 'fc3_slide');
  prop(kit, L.PIT.x, L.PIT.y, 'fc3_pit', { depth: L.PIT.y - 6 });
  prop(kit, L.PIT.x, L.PIT.y - 1, 'fc3_pit_f', { depth: L.PIT.y });
  return prop(kit, L.HORSE.x, L.HORSE.y, 'fc3_horse').setOrigin(0.5, 0.9);
}

/** Сцена: помост с колонками и микрофоном; вечером на неё светит прожектор (возвращается свет). */
function buildStage(kit: FloorKit): Phaser.GameObjects.Image {
  prop(kit, L.MUSICIAN.x, L.STAGE.y1, 'fc3_stage', { depth: L.STAGE.y1 - 3 });
  return lightPool(kit, L.MUSICIAN.x, L.MUSICIAN.y - 4, { w: 60, h: 34, tint: 0xfee761, alpha: 0, depth: LIGHT_DEPTH });
}

/** Гирлянды под потолком: два провисших провода через зал, разноцветные лампочки; в обычной графике мигают. */
function buildGarlands(kit: FloorKit): Phaser.GameObjects.Container {
  const { scene, lite } = kit;
  const box = scene.add.container(0, 0).setDepth(GARLAND_DEPTH).setAlpha(0);
  const tints = [0xe43b44, 0xfee761, 0x63c74d, 0x2ce8f5, 0xf6757a];
  // Над рядами столов (22.11: ряды ниже - зал выше).
  for (const [y0, sag] of [
    [98, 9],
    [146, 8],
    [194, 7],
  ] as const) {
    const g = scene.add.graphics().lineStyle(0.6, 0x262b44, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let x = 4; x <= L.W - 4; x += 4) pts.push(new Phaser.Math.Vector2(x, y0 + sag * Math.sin((Math.PI * (x - 4)) / (L.W - 8))));
    g.strokePoints(pts);
    box.add(g);
    pts.forEach((p, k) => {
      if (k % 2) return;
      const tint = tints[(k / 2 + y0) % tints.length];
      const halo = kit.art(p.x, p.y + 1.5, 'glow').setDisplaySize(7, 7).setTint(tint).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
      const bulb = scene.add.circle(p.x, p.y + 1.2, 0.8, tint);
      box.add([halo, bulb]);
      if (!lite) scene.tweens.add({ targets: halo, alpha: 0.15, duration: 500 + ((k * 137) % 700), yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2] });
    });
  }
  return box;
}
