// Второй этаж — бутик одежды (game/clothes.ts; 13.11 — первый вид, 14.11 — «как настоящий зал»).
//
// 14.11, автор: «нужно отрисовать красиво и подвал, и второй этаж, и третий. И трафик туда, и улучшения — всё как
// в основном зале, чтобы было красиво». Прежний этаж был схемой (голые стойки на паркете, люди скользили без шагов).
// Теперь — светлый бутик (рисунок art/clothes_art.py, план — floors/secondLayout.ts): окна во всю стену с улицей
// и солнцем на полу, паркет «ёлочкой» с потёртостями там, где ходят, стеллаж со сложенными вещами, обувь, манекены
// в вещах сезона, ряды стоек (сколько вещей сезона — столько стоек заполнено, за ними — прошлые сезоны),
// примерочные со шторами, большое зеркало с пуфом, круглый стол с аксессуарами на ковре, стол уценки, касса
// с витриной и кассиром, растения, тёплые пятна света.
//
// Трафик — как в зале: покупатели поднимаются по лестнице и шагают (ноги и руки в такт, как motion.ts в зале, своим
// маленьким шагомером — сцена этажа не крутит animatePeople), ходят только по проходам между мебелью (тест
// floor2-layout), смотрят вещь у стойки, стеллажа, стола или обуви, идут в примерочную (штора задёргивается) и
// выходят в обновке, крутятся у зеркала, встают в очередь на кассу, платят и уходят вниз с пакетом. Продавец-
// консультант подходит к тем, кто выбирает, и подсказывает. Сколько покупателей с пакетом — ровно покупки дня по
// прогнозу (clothesPlan/soldBy): этаж не «продаёт» больше, чем посчитает вечер. Между ними ходят зеваки — смотрят и
// уходят без пакета (их не считают в выручку).
//
// Улучшения этажа (game/clothesUps.ts) видны: «Витрины» — подиумы под манекенами, споты на рейках и неоновая
// вешалка; «Ещё примерочная» — третья кабинка на месте фикуса; «Бренды» — витрина с сумками, таблички марок на
// стене и чёрные пакеты с золотом. Глубина — по ногам у людей и по низу у мебели: кто ниже, тот ближе. В лёгкой
// графике — меньше людей, без пятен света и солнца на полу, свет не дышит. Без тряски. Модуль — в отдельном файле
// вида этажа, в первый файл игры не входит.

import Phaser from 'phaser';
import { t } from '../../i18n';
import { sound } from '../../platform/sound';
import { clothesOf, clothesPlan, collectionFor, COLLECTION_DEFS, COLLECTIONS, oldStock, rackPlaces, salePrice, soldBy, stockTotal, tagPrice, type Collection } from '../../game/clothes';
import { hasFloorUp } from '../../game/floors';
import { guestsToday } from '../../game/day';
import { weatherToday } from '../../game/crisis';
import { SHIRTS, VIEW_SUFFIX, customerLook, type Look } from '../common';
import * as persons from '../persons';
import { crowd, facingOf, lightPool, pause as wait, prop, shell, tweenTo, type Facing, type FloorKit } from './kit';
import * as L from './secondLayout';

type Person = Phaser.GameObjects.Container;
type Point = L.Point;

/** Сколько вещей изображает одна полная стойка. */
const PER_RACK = 10;
/** Шаг людей этажа (точек мира в секунду) — чуть спокойнее, чем в зале: в бутике не спешат. */
const SPEED = 26;
/** Сколько пройти на один кадр шага (как FRAME_STRIDE в зале, stride.ts — под этот темп). */
const STRIDE = 3.2;
/** Сколько покупателей одновременно на этаже и как часто поднимается следующий (мс). */
const MAX_PEOPLE = 5;
const LITE_PEOPLE = 2;
const SPAWN_EVERY = 2300;
/** Зеваки (смотрят и уходят без покупки, 14.11): не больше двоих сразу, реже покупателей. */
const LOOKERS = 2;
const LOOK_EVERY = 5600;
/** Слои, у которых есть кадры взмаха рук (art/walk.py; как SWING_LAYERS в motion.ts). */
const SWING = new Set(['p_shirt', 'p_skin', 'p_skin_happy', 'p_skin_frown']);
/** Кого уже показали на кассе сегодня: 13.11, ревью — этаж не должен «продавать» больше, чем продаст вечер, даже
 *  если вид открывают по нескольку раз за день. */
let shown = { day: 0, n: 0 };

/** Обновка из примерочной — что носят в этой коллекции (гардероб wardrobe.ts и куртки persons.ts). */
function wear(coll: Collection, i: number): Partial<Look> {
  if (coll === 'warm') return { coat: [0xa22633, 0x262b44, 0x3e8948][i % 3], scarf: [0xfee761, 0xe43b44, 0xffffff][i % 3], hat: i % 2 ? 'ushanka' : 'furhat', hatTint: [0x8f563b, 0xc0cbdc][i % 2] };
  if (coll === 'rain') return { outfit: 'trench', outfitTint: [0xe4a672, 0xfeae34, 0xc28569][i % 3], hat: 'beret', hatTint: [0x124e89, 0xa22633][i % 2] };
  return { outfit: 'hawaii', outfitTint: [0xffffff, 0x9cd8ff, 0xfee761][i % 3], hat: i % 2 ? 'straw' : 'sunhat', hatTint: 0xffffff };
}

export function buildSecond(kit: FloorKit): void {
  const { scene: view, store, W, WALL, lite } = kit;
  const state = store.state;
  const c = clothesOf(state);
  const coll = collectionFor(state.day);
  const fresh = c?.stock?.[coll] ?? 0;
  const ups = { showcase: hasFloorUp(state, 'second', 'showcase'), fitting: hasFloorUp(state, 'second', 'fitting'), brands: hasFloorUp(state, 'second', 'brands') };
  const popup = (x: number, y: number, s: string, color = '#fee761'): void => kit.popup(x, y, s, { color, depth: 400, hold: 1400 });
  const pause = (ms: number): Promise<void> => wait(kit, ms);
  const season = (key: string): string => (fresh ? `${key}_${coll}` : key);

  // ------------------------------------------------------------ зал: стены, пол, свет из окон

  shell(kit, { wall: 'fl2b_wall', floor: 'fl2b_floor', side: 0x3e2731, sideW: 5, strips: [[WALL, 3, 0x733e39, 0.22], [WALL + 3, 3, 0x733e39, 0.08]] });
  // 14.11: выше и ниже кадра зал продолжается (floorView.drawAround): обои вверх, паркет вниз, лестница — в пролёт.
  kit.surround({ wall: 0xc28569, floor: 'fl2b_floor', floorY: WALL, floorStep: 24, side: 0x3e2731, sideW: 5, shafts: { bottom: [[L.STAIRS.x - 13, 26]] } });
  // Потёртости паркета — там, где ходят чаще всего: у лестницы, у кассы, перед примерочными, на перекрёстках.
  for (const [x, y, s] of [[24, 192, 1], [128, 198, 1.1], [130, 78, 1], [52, 114, 0.8], [84, 156, 0.9], [118, 150, 0.7], [60, 196, 0.8]] as const) {
    kit.art(x, y, 'fl2b_wear').setScale(s / 2).setDepth(-7);
  }
  // Ковёр под столом аксессуаров.
  kit.art(L.TABLE.x, L.TABLE.y - 6, 'fl2b_rug').setDepth(-6);
  // За окнами — сезон коллекции (снег к холодам, пасмурно в сезон плащей, солнце летом), а в дождь и снег дня — сама
  // погода. Солнце из окон ложится на пол наискось, только когда за окном ясно (в лёгкой графике — без него:
  // сложение света по большой площади).
  const weather = weatherToday(state);
  const outside: Collection = weather === 'rain' || weather === 'storm' ? 'rain' : weather === 'snow' ? 'warm' : coll;
  const sunny = (weather === 'clear' || weather === 'heat') && outside !== 'rain';
  if (!lite && sunny) for (const x of L.WINDOWS) kit.art(x + 8, WALL, 'fl2b_sun').setOrigin(0.5, 0).setTint(0xfee761).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);

  // ------------------------------------------------------------ задняя стена

  for (const x of L.WINDOWS) prop(kit, x, WALL, outside === 'summer' ? 'fl2b_window' : `fl2b_window_${outside}`, { depth: 0 });
  prop(kit, L.SHELF.x, L.SHELF.y, season('fl2b_shelf'));
  // Примерочные: две, с улучшением — три (на месте фикуса).
  const boothXs = ups.fitting ? L.BOOTHS : L.BOOTHS.slice(1);
  const booths = boothXs.map((x) => ({ x, img: prop(kit, x, L.BOOTH_Y, 'fl2b_booth'), busy: false }));
  if (!ups.fitting) prop(kit, L.BOOTHS[0], L.BOOTH_Y - 4, 'fl2b_ficus');
  // «Витрины»: неоновая вешалка над примерочными и рейки со спотами над окнами; «Бренды» — таблички марок.
  if (ups.showcase) {
    const neon = prop(kit, L.BOOTHS[1], 29, 'fl2b_neon', { depth: 1 });
    if (!lite) view.tweens.add({ targets: neon, alpha: 0.82, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const x of L.WINDOWS) prop(kit, x, 5, 'fl2b_track', { depth: 2 });
  }
  // Над примерочными: до улучшений — модные картинки в рамах, с «Брендами» — таблички марок по краям.
  if (ups.brands) for (const x of [L.BOOTHS[0], L.BOOTHS[2]]) prop(kit, x, 28, 'fl2b_logo', { depth: 1 });
  else {
    prop(kit, L.BOOTHS[2], 28, 'fl2b_poster1', { depth: 1 });
    if (ups.fitting) prop(kit, L.BOOTHS[0], 28, 'fl2b_poster0', { depth: 1 });
  }
  if (!ups.showcase) prop(kit, L.BOOTHS[1], 28, 'fl2b_poster0', { depth: 1 });
  // Манекены у окон в вещах сезона (свои картинки без лица — не серые люди): на подиумах («Витрины») или на своей
  // подставке.
  L.MANNEQUINS.forEach((m, k) => {
    if (ups.showcase) prop(kit, m.x, m.y + 3, 'fl2b_podium', { depth: m.y - 0.5 });
    prop(kit, m.x, m.y + 1 - (ups.showcase ? 3 : 0), `fl2b_manq_${coll}${k}`, { depth: m.y });
  });

  // ------------------------------------------------------------ зал: стойки, обувь, зеркало, стол, уценка, касса

  const places = rackPlaces(state);
  const racks = L.RACKS.slice(0, places / PER_RACK > 4 ? 6 : 4);
  const full = Math.ceil(fresh / PER_RACK);
  // 14.11, ревью: остатки прошлых сезонов тоже висят на стойках (они и занимают места — clothes.ts freePlaces), а
  // раньше их стойки рисовались пустыми: при полных местах половина зала стояла голой и «уценка» была не видна.
  // Теперь сначала стойки сезона, за ними — старые вещи (посеревшие: пылятся до распродажи), пустые — только свободные места.
  const rackKeys: string[] = Array.from({ length: Math.min(racks.length, full) }, () => `fl2b_rack_${coll}`);
  for (const id of COLLECTIONS) {
    if (id === coll) continue;
    for (let k = Math.ceil((c?.stock?.[id] ?? 0) / PER_RACK); k > 0 && rackKeys.length < racks.length; k--) rackKeys.push(`fl2b_rack_${id}`);
  }
  const rackImgs = racks.map((p, i) => {
    const img = prop(kit, p.x, p.y, rackKeys[i] ?? 'fl2b_rack');
    if (i >= full && rackKeys[i]) {
      if (c?.sale) kit.art(p.x + 8, p.y - 22, 'fl2_sale').setScale(0.35).setDepth(p.y + 0.5);
      else img.setTint(0xc0cbdc);
    }
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      sound.tap();
      popup(p.x, p.y - 28, `${COLLECTION_DEFS[coll].icon} ${t('cl.stock', { n: stockTotal(c), max: places })}`, '#ffffff');
    });
    return img;
  });
  prop(kit, L.SHOES.x, L.SHOES.y, season('fl2b_shoes'));
  prop(kit, L.MIRROR.x, L.MIRROR.y, 'fl2b_mirror');
  prop(kit, L.POUF.x, L.POUF.y, 'fl2b_pouf');
  if (ups.brands) {
    prop(kit, L.BRAND.x, L.BRAND.y, 'fl2b_brand')
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        sound.tap();
        popup(L.BRAND.x, L.BRAND.y - 34, `👜 ${t('fup.second.brands')} · ${tagPrice(state, coll)} 💰`);
      });
  }
  // Без витрины марок на её месте — портновский бюст в вещи сезона: середина зала справа не пустует.
  if (!ups.brands) prop(kit, L.BRAND.x, L.BRAND.y, season('fl2b_form'));
  prop(kit, L.TABLE.x, L.TABLE.y, season('fl2b_table'));
  // Прошлый сезон: стол уценки. На распродаже — бирка, без неё вещи пылятся (паутинка).
  if (oldStock(state)) {
    prop(kit, L.BIN.x, L.BIN.y, 'fl2b_bin');
    if (c?.sale) {
      const tag = kit.art(L.BIN.x, L.BIN.y - 19, 'fl2_sale').setDepth(L.BIN.y + 1);
      if (!lite) view.tweens.add({ targets: tag, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else kit.art(L.BIN.x - 8, L.BIN.y - 12, 'fl2_web').setDepth(L.BIN.y + 1).setAlpha(0.8);
  }
  // Касса: кассир за стойкой (стойка закрывает ему ноги).
  const cashier = kit.person(L.CASHIER.x, L.CASHIER.y - L.FOOT, { ...customerLook(0xb55088, 0), acc: 'badge' }).setDepth(L.CASHIER.y);
  prop(kit, L.TILL.x, L.TILL.y, 'fl2b_till')
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => {
      sound.tap();
      const plan = clothesPlan(store.state, guestsToday(store.state));
      popup(L.TILL.x, L.TILL.y - 30, plan && fresh ? t('cl.tap', { n: plan.sold + plan.sale, sum: plan.income - plan.wage }) : t('cl.floorEmpty'));
    });
  // Лестница из магазина — внизу слева, растения по углам.
  prop(kit, L.STAIRS.x, L.STAIRS.y, 'fl2b_stairs', { oy: 0, depth: -4 });
  prop(kit, L.PLANTS[0].x, L.PLANTS[0].y, 'fl2b_plant');
  prop(kit, L.PLANTS[1].x, L.PLANTS[1].y, 'fl2b_ficus');

  // ------------------------------------------------------------ свет

  if (!lite) {
    // Тёплые пятна люстр — как свет зала (lighting.ts): мягко, поверх всего, сложением.
    for (const [x, y] of [[52, 100], [100, 140], [140, 196], [60, 190], [140, 96]] as const) lightPool(kit, x, y, { w: 96, h: 66, tint: 0xfee761, alpha: 0.1, depth: 300, breathe: { alpha: '-=0.03', ms: 1700 + x * 7 } });
    if (ups.showcase) {
      // Споты — узкие конусы на манекены и стеллаж.
      for (const m of L.MANNEQUINS) lightPool(kit, m.x, m.y - 10, { w: 28, h: 44, tint: 0xfee761, alpha: 0.32, depth: 300 });
      lightPool(kit, L.SHELF.x, L.SHELF.y - 18, { w: 40, h: 46, tint: 0xfee761, alpha: 0.14, depth: 300 });
    }
    if (ups.brands) lightPool(kit, L.BRAND.x, L.BRAND.y - 14, { w: 34, h: 36, tint: 0xfee761, alpha: 0.18, depth: 300 });
  }
  // 14.11, ревью: строка в одну линию упиралась в правую стену (а на других языках длиннее) — переносим по ширине зала.
  // 14.11, аудит: на высоте 132 строка лежала прямо на верхушках нижнего ряда стоек, полупрозрачная. Теперь —
  // табличка с плотным фоном и рамкой в проходе под стойками (между ними и ковром со столом), где мебели нет.
  if (!fresh) {
    const note = kit.text(W / 2, L.RACKS[2].y + 11, t('cl.floorEmpty'), 5.5, '#733e39').setWordWrapWidth(W - 24).setAlign('center').setDepth(302).setBackgroundColor('#f4e4c1').setPadding(3, 1, 3, 1);
    view.add.rectangle(note.x, note.y, note.displayWidth + 1, note.displayHeight + 1).setStrokeStyle(0.6, 0xb86f50).setDepth(302.1);
  }

  // ------------------------------------------------------------ люди: шаг, ходьба по проходам

  const people = new Set<Person>();
  const feet = (man: Person): Point => ({ x: man.x, y: man.y + L.FOOT });
  /** Человечек ногами в точке p: глубина — по ногам. */
  const spawn = (p: Point, look: Look): Person => {
    const man = kit.person(p.x, p.y - L.FOOT, look).setDepth(p.y);
    man.setData('step', { x: man.x, y: man.y, phase: Math.random() * 4, idle: Math.random() * 1000 });
    people.add(man);
    man.once('destroy', () => people.delete(man));
    return man;
  };
  /** Идёт по проходам к точке ног `to`: ровным шагом, лицом туда, куда идёт. */
  const walk = (man: Person, to: Point): Promise<void> =>
    L.route(feet(man), to).reduce<Promise<void>>(
      (prev, p) =>
        prev.then(
          () =>
            new Promise<void>((done) => {
              const dx = p.x - man.x;
              const dy = p.y - L.FOOT - man.y;
              const d = Math.hypot(dx, dy);
              if (!man.active || d < 0.5) return done();
              persons.setFacing(man, facingOf(dx, dy));
              view.tweens.add({ targets: man, x: p.x, y: p.y - L.FOOT, duration: (d / SPEED) * 1000, onUpdate: () => man.setDepth(man.y + L.FOOT), onComplete: () => done() });
            }),
        ),
      Promise.resolve(),
    );
  /** Шагомер: ноги и руки в такт пройденному пути (кадры зала, art/walk.py), стоя — чуть дышит. */
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
      if (moved > 0.01) {
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
        arms = frame === 1 ? '_w1' : frame === 3 ? '_w2' : '';
        bob = frame % 2 === 0 ? -0.5 : 0;
      } else if (!lite) bob = Math.sin((time + st.idle) / 650) > 0.35 ? -0.5 : 0;
      const legs = man.getData('legs') as Phaser.GameObjects.Image | undefined;
      if (legs && (legs.texture.key !== key || legs.flipX !== flip)) legs.setTexture(key).setFlipX(flip);
      for (const [img, base] of (man.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined) ?? []) {
        if (!SWING.has(base)) continue;
        const want = base + suffix + arms;
        if (img.texture.key !== want) img.setTexture(want);
      }
      for (const img of (man.getData('upper') as Phaser.GameObjects.Image[] | undefined) ?? []) img.y = bob + ((img.getData('dy') as number | undefined) ?? 0);
    }
  };
  view.events.on(Phaser.Scenes.Events.UPDATE, step);
  view.events.once(Phaser.Scenes.Events.SHUTDOWN, () => view.events.off(Phaser.Scenes.Events.UPDATE, step));
  /** Значок над головой: всплывает и тает. */
  const emote = (man: Person, key: string, delay = 500): void => {
    if (!man.active) return;
    const icon = kit.art(man.x, man.y - 14, key).setDepth(400);
    view.tweens.add({ targets: icon, y: icon.y - 4, alpha: 0, delay, duration: 500, onComplete: () => icon.destroy() });
  };
  /** Вещь на стойке качнулась — её сняли посмотреть или поправили. */
  const nudge = (img: Phaser.GameObjects.Image | undefined): void => {
    if (img && !lite) view.tweens.add({ targets: img, angle: { from: -1.5, to: 1.5 }, duration: 160, yoyo: true, repeat: 1, onComplete: () => img.setAngle(0) });
  };

  // Кассир стоит не столбом: иногда поворачивается к пакетам.
  if (!lite) {
    void (async () => {
      for (let k = 0; cashier.active; k++) {
        await pause(3200 + (k % 3) * 900);
        if (!cashier.active) return;
        persons.setFacing(cashier, k % 2 ? 'left' : 'down');
      }
    })();
  }

  /** Кто сейчас выбирает вещь (к нему подходит консультант): где стоит и подходил ли уже. */
  const browsing = new Map<Person, { at: Point; helped: boolean }>();

  // Продавец-консультант: подходит к тем, кто выбирает, подсказывает; свободен — поправляет вещи на стойках.
  if (c?.clerk) {
    const clerk = spawn({ x: L.CORRIDORS[1], y: L.AISLES[1] }, { ...customerLook(0x68386c, 0), acc: 'tie' });
    void (async () => {
      await pause(900);
      for (let k = 0; clerk.active; k++) {
        const guest = [...browsing].find(([man, b]) => man.active && !b.helped);
        if (guest) {
          const [man, b] = guest;
          b.helped = true;
          const side = b.at.x > W / 2 ? -9 : 9;
          await walk(clerk, { x: b.at.x + side, y: b.at.y });
          if (!clerk.active) return;
          persons.setFacing(clerk, side > 0 ? 'left' : 'right');
          if (man.active) persons.setFacing(man, side > 0 ? 'right' : 'left');
          emote(clerk, 'emo_question', 700);
          await pause(1100);
          emote(man, 'emo_star', 500);
          await pause(900);
          continue;
        }
        const i = k % racks.length;
        await walk(clerk, L.SPOTS.rack(racks[i], 6));
        if (!clerk.active) return;
        persons.setFacing(clerk, 'up');
        nudge(rackImgs[i]);
        await pause(1500);
      }
    })();
  }

  // ------------------------------------------------------------ покупатели дня

  // Покупки дня — ровно по прогнозу: сначала вещи сезона по полной цене, потом уценка прошлых коллекций за полцены
  // (тот же порядок, что и вечером в clothesNight). Показали всех — больше никто не поднимается.
  const plan = clothesPlan(state, guestsToday(state));
  const sales: { price: number; bin: boolean }[] = [];
  if (plan && c) {
    const by = soldBy(c, plan);
    for (const id of COLLECTIONS) {
      const own = id === coll;
      const price = own ? tagPrice(state, id) : salePrice(state, id);
      for (let i = 0; i < (by[id] ?? 0); i++) sales[own ? 'unshift' : 'push']({ price, bin: !own });
    }
  }
  if (shown.day !== state.day) shown = { day: state.day, n: 0 };

  /** Очередь на кассу: первый — у кассы, остальные — левее по нижнему проходу; каждый сам шагает вперёд. */
  const queue: Person[] = [];
  const queueSpot = (i: number): Point => ({ x: L.SPOTS.till.x - i * 11, y: L.SPOTS.till.y });

  if (shown.n < sales.length) crowd(kit, { every: SPAWN_EVERY, max: MAX_PEOPLE, liteMax: LITE_PEOPLE, next: () => (shown.n < sales.length ? shown.n++ : null), run: (n) => shopper(n, sales[n]) });
  // 14.11, ревью: покупок на «Магазинчике»–«Супермаркете» — 2–5 в день, и после них этаж стоял мёртвым, пока открыт.
  // Как в зале, ходят и те, кто только смотрит (по модели этажа таких большинство — покупает лишь BUY_SHARE гостей):
  // поднялись, посмотрели вещь, поморщились от цены или вздохнули у пустой стойки — и ушли без пакета. Денег не
  // приносят, на кассе не стоят: выручка этажа — только покупатели выше.
  if (c) {
    let looks = 0;
    crowd(kit, { every: LOOK_EVERY, max: LOOKERS, liteMax: 1, next: () => looks++, run: (n) => looker(n) });
  }

  /** Что посмотреть: уценка — стол распродажи; своя коллекция — чаще стойка, иногда стеллаж, стол или обувь. */
  function pick(n: number, bin: boolean): { at: Point; img?: Phaser.GameObjects.Image; rack: boolean } {
    if (bin) return { at: L.SPOTS.bin, rack: false };
    const filled = Math.max(1, Math.min(racks.length, full));
    const r = n % 7;
    if (r === 3) return { at: L.SPOTS.shelf, rack: false };
    if (r === 5) return { at: L.SPOTS.table, rack: false };
    if (r === 6) return { at: L.SPOTS.shoes, rack: false };
    const i = (n * 5 + 1) % filled;
    return { at: L.SPOTS.rack(racks[i], ((n * 7) % 13) - 6), img: rackImgs[i], rack: true };
  }

  /** Зевака: лестница → вещь → (зеркало) → вниз без пакета. Консультант к нему не подходит — он занят покупателями. */
  async function looker(n: number): Promise<void> {
    const man = spawn(L.SPOTS.stairsBottom, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day)).setAlpha(0);
    persons.setFacing(man, 'up');
    await tweenTo(kit, man, { y: L.SPOTS.stairsTop.y - L.FOOT, alpha: 1, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
    const goal = pick(n * 3 + 2, false);
    await walk(man, goal.at);
    if (!man.active) return;
    persons.setFacing(man, 'up');
    nudge(goal.img);
    await pause(1300 + (n % 3) * 500);
    if (!man.active) return;
    // Пусто — вздохнул; с «Брендами» чаще морщатся от бирки, без них — просто не решились.
    emote(man, !fresh ? 'emo_sigh' : ups.brands || n % 2 ? 'emo_pricey' : 'emo_question', 300);
    await pause(900);
    if (fresh && n % 3 === 1) {
      await walk(man, L.SPOTS.mirror);
      if (!man.active) return;
      persons.setFacing(man, 'up');
      await pause(900);
    }
    await walk(man, L.SPOTS.stairsTop);
    if (!man.active) return;
    persons.setFacing(man, 'down');
    await tweenTo(kit, man, { y: L.SPOTS.stairsBottom.y - L.FOOT, alpha: 0, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
    man.destroy();
  }

  /** Покупатель: лестница → (манекен) → вещь → (примерочная → зеркало) → очередь → касса → с пакетом вниз. */
  async function shopper(n: number, buy: { price: number; bin: boolean }): Promise<void> {
    let look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day);
    let man = spawn(L.SPOTS.stairsBottom, look).setAlpha(0);
    persons.setFacing(man, 'up');
    await tweenTo(kit, man, { y: L.SPOTS.stairsTop.y - L.FOOT, alpha: 1, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
    // С «Витринами» каждый третий сперва засматривается на манекен у окна.
    if (ups.showcase && n % 3 === 0) {
      await walk(man, L.SPOTS.window[n % 2]);
      if (!man.active) return;
      persons.setFacing(man, 'up');
      emote(man, 'emo_star', 400);
      await pause(1000);
    }
    const goal = pick(n, buy.bin);
    await walk(man, goal.at);
    if (!man.active) return;
    persons.setFacing(man, 'up');
    browsing.set(man, { at: goal.at, helped: false });
    nudge(goal.img);
    await pause(1500 + (n % 3) * 400);
    if (man.active && browsing.get(man)?.helped) await pause(1600);
    browsing.delete(man);
    if (!man.active) return;
    // Примерочная (вещь сезона, есть свободная): заходит, штора задёргивается, выходит в обновке.
    const booth = buy.bin || !goal.rack ? undefined : booths.find((b) => !b.busy);
    if (booth) {
      booth.busy = true;
      await walk(man, L.SPOTS.booth(booth.x));
      if (!man.active) return void (booth.busy = false);
      persons.setFacing(man, 'up');
      await tweenTo(kit, man, { y: man.y - 5, alpha: 0, duration: 400 });
      booth.img.setTexture('fl2b_booth_shut');
      await pause(ups.fitting ? 1700 : 2100);
      booth.img.setTexture('fl2b_booth');
      look = { ...look, ...wear(coll, n), ...(coll === 'warm' ? { outfit: undefined } : { coat: undefined }) };
      const at = feet(man);
      man.destroy();
      man = spawn({ x: at.x, y: at.y }, look).setAlpha(0);
      persons.setFacing(man, 'down');
      await tweenTo(kit, man, { y: man.y + 5, alpha: 1, duration: 400, onUpdate: () => man.setDepth(man.y + L.FOOT) });
      booth.busy = false;
      // У зеркала: повернулся, полюбовался.
      await walk(man, L.SPOTS.mirror);
      if (!man.active) return;
      persons.setFacing(man, 'up');
      emote(man, 'emo_heart', 600);
      await pause(700);
      persons.setFacing(man, 'left');
      await pause(400);
      persons.setFacing(man, 'up');
      await pause(500);
    }
    // Очередь на кассу: подошёл на своё место, ушёл кто-то впереди — шагнул вперёд.
    queue.push(man);
    for (let at = -1; man.active; ) {
      const i = queue.indexOf(man);
      if (i !== at) {
        at = i;
        await walk(man, queueSpot(i));
        continue;
      }
      if (i === 0) break;
      persons.setFacing(man, 'right');
      await pause(300);
    }
    if (!man.active) return;
    persons.setFacing(man, 'up');
    persons.setFacing(cashier, 'down');
    await pause(900);
    if (!man.active) return;
    popup(man.x, man.y - 16, `+${buy.price} 💰`);
    man.add(kit.art(4, 3, ups.brands ? 'fl2b_bag_lux' : 'fl2_bag'));
    emote(cashier, 'emo_heart', 300);
    queue.shift();
    // Вниз по лестнице: тает в проёме.
    await walk(man, L.SPOTS.stairsTop);
    if (!man.active) return;
    persons.setFacing(man, 'down');
    await tweenTo(kit, man, { y: L.SPOTS.stairsBottom.y - L.FOOT, alpha: 0, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
    man.destroy();
  }
}
