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
import { SHIRTS, VIEW_SUFFIX, customerLook, nightGuestLook, type Look } from '../common';
import { floorCrowd } from '../../game/floorLife';
import { floorMoments } from './momentFx';
import * as persons from '../persons';
import { AROUND, crowd, facingOf, lightPool, pause as wait, prop, shell, tweenTo, type Facing, type FloorKit } from './kit';
import * as L from './secondLayout';

type Person = Phaser.GameObjects.Container;
type Point = L.Point;

/** Верх стены над залом (art/clothes_decor.py fl2d_upper): высота картинки в точках мира и цвет потолка над ней. */
const UPPER_H = 64;
const CEILING = 0x8f574a;
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
/**
 * Зеваки (смотрят и уходят без покупки, 14.11). 15.11, автор: «прям пусто — они просто есть». Сколько их сразу —
 * от гостей дня, но не меньше трёх (floorLife.floorCrowd); поднимаются чаще, часть — парами, с детьми, с пакетами из зала.
 */
const LOOK_EVERY = 2200;
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
  // 22.11, автор: «надо улучшать дизайн этажей». Над залом (на телефоне — до верхней панели) была плоская полоса
  // стены. Теперь стена продолжается вверх: фрамуги-витражи над окнами, вывеска бутика с золотой вешалкой и
  // подсветкой, гирлянда из зелени и роз, лепной карниз, тёплый потолок (art/clothes_decor.py). Выше картинки —
  // тот же потолок; к панели всё гаснет ступенями (floorView.drawAround кладёт затемнение поверх).
  kit.art(W / 2, 0, 'fl2d_upper').setOrigin(0.5, 1).setDepth(-9.5);
  view.add.rectangle(5, -AROUND, W - 10, AROUND - UPPER_H + 0.5, CEILING).setOrigin(0).setDepth(-9.6);
  // Потёртости паркета — там, где ходят чаще всего: у лестницы, у кассы, перед примерочными, на перекрёстках.
  // 22.11: у лестницы — внизу, где она теперь, и на проходе от неё к коридору.
  for (const [x, y, s] of [[26, 246, 1], [50, 238, 0.8], [128, 198, 1.1], [130, 78, 1], [52, 114, 0.8], [84, 156, 0.9], [118, 150, 0.7], [60, 196, 0.8]] as const) {
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
    // 15.11: соседние стойки одной коллекции — с разным набором вещей (второй рисунок, art/floors_life.py).
    const key = rackKeys[i] && i % 2 ? rackKeys[i].replace('fl2b_rack_', 'fl2c_rack_') : rackKeys[i];
    const img = prop(kit, p.x, p.y, key ?? 'fl2b_rack');
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
  // Лестница из магазина — у нижнего края слева: проём уходит за край зала, в шахту (22.11; была посреди пола).
  // На площадке — полукруглый коврик. Монстера у кассы, фикус у входа.
  prop(kit, L.STAIRS.x, L.STAIRS.y - 4, 'fl2d_stairs', { oy: 0, depth: -4 });
  prop(kit, L.STAIRS.x, L.STAIRS.y, 'fl2d_mat', { depth: -6 });
  prop(kit, L.PLANTS[0].x, L.PLANTS[0].y, 'fl2b_plant');
  prop(kit, L.PLANTS[1].x, L.PLANTS[1].y, 'fl2b_ficus');
  // 22.11: низ зала, который раньше пустовал. У входа — вешалка со шляпами и мраморный столик с букетом; у самого
  // края — подиум «новая коллекция» (манекены в других нарядах сезона, чем у окон, и ваза с пампасом) и уголок
  // ожидания: изумрудный диван, торшер, ковёр (art/clothes_decor.py).
  prop(kit, L.HATSTAND.x, L.HATSTAND.y, 'fl2d_hatstand');
  prop(kit, L.FLOWERS.x, L.FLOWERS.y, 'fl2d_flowers');
  prop(kit, L.STAGE.x, L.STAGE.y, 'fl2d_stage');
  prop(kit, L.STAGE.x, L.STAGE.y - 13, 'fl2d_pampas', { depth: L.STAGE.y + 0.2 });
  for (const [k, dx] of [[0, -10], [1, 10]] as const) prop(kit, L.STAGE.x + dx, L.STAGE.y - 10, `fl2d_manq_${coll}${k}`, { depth: L.STAGE.y + 0.5 });
  prop(kit, L.SOFA.x + 2, L.SOFA.y - 4, 'fl2d_rug', { oy: 0.5, depth: -6 });
  prop(kit, L.SOFA.x, L.SOFA.y, 'fl2d_sofa');
  // У дивана — пакет из бутика (с «Брендами» — чёрный с золотом): кто-то ждёт, пока примеряют.
  prop(kit, L.SOFA.x - 23, L.SOFA.y, ups.brands ? 'fl2b_bag_lux' : 'fl2_bag');
  prop(kit, L.LAMP.x, L.LAMP.y, 'fl2d_lamp');
  // До ремонта (четыре стойки) на месте третьего столбца — новая стойка в плёнке и стремянка с коробками: видно,
  // куда встанут стойки после отделки.
  if (racks.length < 6) {
    prop(kit, L.RACKS[4].x, L.RACKS[4].y, 'fl2d_wrap');
    prop(kit, L.RACKS[5].x, L.RACKS[5].y, 'fl2d_reno');
  }
  // 15.11, автор: «2 этаж дорисуй — красивее». Стол со стопками сложенных вещей у левой стены, бра между
  // примерочными, гирлянда тёплых огоньков под карнизом, подвесные лампы над залом (art/floors_life.py).
  prop(kit, L.FOLD.x, L.FOLD.y, fresh ? `fl2c_fold_${coll}` : 'fl2c_fold')
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => {
      sound.tap();
      popup(L.FOLD.x + 8, L.FOLD.y - 18, `${COLLECTION_DEFS[coll].icon} ${t('cl.stock', { n: stockTotal(c), max: places })}`, '#ffffff');
    });
  for (const x of L.SCONCES) prop(kit, x, 29, 'fl2c_sconce', { depth: 1 });
  view.add.tileSprite(5, 1, W - 10, 5, 'fl2c_garland').setOrigin(0).setTileScale(0.5).setDepth(3);
  for (const p of L.PENDANTS) {
    view.add.rectangle(p.x, p.y - 12, 0.5, 8, 0x262b44).setOrigin(0.5, 0).setDepth(350);
    kit.art(p.x, p.y, 'fl2c_pendant').setOrigin(0.5, 0.75).setDepth(351);
  }

  // ------------------------------------------------------------ свет

  if (!lite) {
    // Тёплые пятна люстр — как свет зала (lighting.ts): мягко, поверх всего, сложением. 15.11: пятно — под каждой
    // подвесной лампой, ярче, с бликом на паркете; у бра и вдоль гирлянды — свой тёплый ореол; у окон — блик от стекла.
    for (const p of L.PENDANTS) {
      lightPool(kit, p.x, p.y + 26, { w: 84, h: 58, tint: 0xfee761, alpha: 0.16, depth: 300, breathe: { alpha: '-=0.04', ms: 1700 + p.x * 7 } });
      kit.art(p.x + 4, p.y + 28, 'fl2c_gloss').setTint(0xfee761).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
      lightPool(kit, p.x, p.y + 1, { w: 14, h: 12, tint: 0xfee761, alpha: 0.7, depth: 352 });
    }
    for (const x of L.SCONCES) lightPool(kit, x, 23, { w: 22, h: 20, tint: 0xfeae34, alpha: 0.5, depth: 300 });
    lightPool(kit, W / 2, 6, { w: W * 1.1, h: 18, tint: 0xfeae34, alpha: 0.22, depth: 300 });
    for (const x of L.WINDOWS) kit.art(x + 10, WALL + 16, 'fl2c_gloss').setTint(0xc8f0ff).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(-5);
    if (ups.showcase) {
      // Споты — узкие конусы на манекены и стеллаж.
      for (const m of L.MANNEQUINS) lightPool(kit, m.x, m.y - 10, { w: 28, h: 44, tint: 0xfee761, alpha: 0.32, depth: 300 });
      lightPool(kit, L.SHELF.x, L.SHELF.y - 18, { w: 40, h: 46, tint: 0xfee761, alpha: 0.14, depth: 300 });
    }
    if (ups.brands) lightPool(kit, L.BRAND.x, L.BRAND.y - 14, { w: 34, h: 36, tint: 0xfee761, alpha: 0.18, depth: 300 });
    // 22.11: верх стены — подсветка вывески, свет в фрамугах, точки ламп в потолке; низ — пятно на подиуме и торшер.
    lightPool(kit, 130, -6, { w: 64, h: 18, tint: 0xfee761, alpha: 0.3, depth: 300 });
    for (const x of L.WINDOWS) lightPool(kit, x, -4, { w: 46, h: 20, tint: 0xc8f0ff, alpha: 0.22, depth: 300 });
    for (const x of [20, 52, 84, 116, 148]) lightPool(kit, x, -28, { w: 12, h: 7, tint: 0xfee761, alpha: 0.55, depth: 300 });
    lightPool(kit, L.STAGE.x, L.STAGE.y - 18, { w: 54, h: 44, tint: 0xfee761, alpha: ups.showcase ? 0.28 : 0.2, depth: 300 });
    lightPool(kit, L.LAMP.x, L.LAMP.y - 26, { w: 16, h: 14, tint: 0xfee761, alpha: 0.6, depth: 300 });
    lightPool(kit, L.LAMP.x - 10, L.LAMP.y - 8, { w: 56, h: 34, tint: 0xfeae34, alpha: 0.2, depth: 300, breathe: { alpha: '-=0.04', ms: 2100 } });
    lightPool(kit, L.FLOWERS.x, L.FLOWERS.y - 10, { w: 30, h: 26, tint: 0xfee761, alpha: 0.12, depth: 300 });
  }
  // 14.11, ревью: строка в одну линию упиралась в правую стену (а на других языках длиннее) — переносим по ширине зала.
  // 14.11, аудит: на высоте 132 строка лежала прямо на верхушках нижнего ряда стоек, полупрозрачная. Теперь —
  // табличка с плотным фоном и рамкой в проходе под стойками (между ними и ковром со столом), где мебели нет.
  // 15.11: над подвесными лампами и их светом (глубина 350–352) — лампа не ложится на строку.
  if (!fresh) {
    const note = kit.text(W / 2, L.RACKS[2].y + 11, t('cl.floorEmpty'), 5.5, '#733e39').setWordWrapWidth(W - 24).setAlign('center').setDepth(360).setBackgroundColor('#f4e4c1').setPadding(3, 1, 3, 1);
    view.add.rectangle(note.x, note.y, note.displayWidth + 1, note.displayHeight + 1).setStrokeStyle(0.6, 0xb86f50).setDepth(360.1);
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
  /** Момент «очередь» пойман: кассир пробивает быстрее, пока очередь не разойдётся. */
  let rush = false;
  /** Охранник этажа (patrol): он и ловит воришку в момент «вор у стойки». */
  let guard: Person | null = null;
  const queueSpot = (i: number): Point => ({ x: L.SPOTS.till.x - i * 11, y: L.SPOTS.till.y });

  if (shown.n < sales.length) crowd(kit, { every: SPAWN_EVERY, max: MAX_PEOPLE, liteMax: LITE_PEOPLE, next: () => (shown.n < sales.length ? shown.n++ : null), run: (n) => shopper(n, sales[n]) });
  // 14.11, ревью: покупок на «Магазинчике»–«Супермаркете» — 2–5 в день, и после них этаж стоял мёртвым, пока открыт.
  // Как в зале, ходят и те, кто только смотрит (по модели этажа таких большинство — покупает лишь BUY_SHARE гостей):
  // поднялись, посмотрели вещь, поморщились от цены или вздохнули у пустой стойки — и ушли без пакета. Денег не
  // приносят, на кассе не стоят: выручка этажа — только покупатели выше.
  if (c) {
    let looks = 0;
    const most = floorCrowd('second', guestsToday(state), false);
    crowd(kit, { every: LOOK_EVERY, max: most, liteMax: floorCrowd('second', guestsToday(state), true), next: () => looks++, run: (n) => looker(n) });
    // 15.11: этаж открыли — а там уже кто-то выбирает (не все ждут, пока поднимется первый). В лёгкой графике —
    // без них, без болтунов, грузчика и охранника: там людей ровно столько, сколько даёт floorCrowd (ревью 15.11).
    if (!lite) {
      for (let k = 0; k < 3; k++) void browse(looks++, pick(k * 5 + 1, false), 0, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day), k === 1, true);
      void chatter();
      void loader();
      void patrol();
    }
  }

  // ------------------------------------------------------------ моменты этажа (game/floorLife.ts, 15.11)
  // Покупателю в примерочной нужен другой размер, очередь у кассы, воришка у стойки. Нажал — награда и развязка;
  // не успел — сценка тихо расходится (без штрафа).
  {
    let actor: Person | null = null;
    let booth: (typeof booths)[number] | undefined;
    let extras: Person[] = [];
    let rackAt = 0;
    floorMoments(kit, 'second', {
      start: (kind) => {
        if (kind === 'size') {
          // Выглянул из-за шторы: машет, просит размер побольше. Все кабинки заняты — ждёт у крайней.
          booth = booths.find((b) => !b.busy);
          if (booth) {
            booth.busy = true;
            booth.img.setTexture('fl2b_booth_shut');
          }
          const man = spawn(L.SPOTS.booth((booth ?? booths[booths.length - 1]).x), customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day));
          persons.setFacing(man, 'down');
          if (!lite) view.tweens.add({ targets: man, x: man.x + 1, duration: 260, yoyo: true, repeat: -1 });
          actor = man;
          return { target: man, icon: 'flm_size', dy: 17 };
        }
        if (kind === 'queue') {
          // Очередь к кассе разом: трое с вещами переминаются, поглядывают на часы.
          extras = [0, 1, 2].map((i) => {
            const man = spawn(queueSpot(queue.length + i), customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day)).setAlpha(0);
            view.tweens.add({ targets: man, alpha: 1, duration: 400, delay: i * 200 });
            persons.setFacing(man, 'right');
            emote(man, 'emo_clock', 900 + i * 400);
            return man;
          });
          for (const man of extras) void checkout(man, null);
          return { target: cashier, icon: 'emo_clock', dy: 17 };
        }
        // Воришка: капюшон, у стойки, оглядывается и прячет вещь под куртку.
        rackAt = Math.max(0, Math.min(racks.length, full) - 1);
        const spot = L.SPOTS.rack(racks[rackAt], 4);
        const man = spawn(spot, { ...customerLook(0x262b44, 0), outfit: 'hoodie', outfitTint: 0x3a4466, style: 'beanie', hair: 0x262b44 }).setAlpha(0);
        view.tweens.add({ targets: man, alpha: 1, duration: 400 });
        persons.setFacing(man, 'up');
        if (!lite) {
          void (async () => {
            for (let k = 0; man.active && actor === man; k++) {
              persons.setFacing(man, (['up', 'left', 'up', 'right'] as Facing[])[k % 4]);
              if (k % 4 === 0) nudge(rackImgs[rackAt]);
              await pause(700);
            }
          })();
        }
        actor = man;
        return { target: man, icon: 'emo_alert', dy: 17 };
      },
      caught: (kind) => {
        const man = actor;
        actor = null;
        if (kind === 'size' && man?.active) {
          // Принесли размер: штора задёргивается, выходит довольный — и на кассу.
          view.tweens.killTweensOf(man);
          emote(man, 'emo_heart', 400);
          void (async () => {
            await pause(900);
            if (booth) {
              booth.img.setTexture('fl2b_booth');
              booth.busy = false;
            }
            if (man.active) await checkout(man, null);
          })();
        }
        if (kind === 'queue') {
          rush = true;
          emote(cashier, 'emo_star', 200);
          view.time.delayedCall(9000, () => (rush = false));
        }
        if (kind === 'thief' && man?.active) {
          // Охранник подходит, вещь возвращается на стойку, воришка уходит вниз быстрым шагом.
          void (async () => {
            const g = guard;
            if (g?.active) {
              g.setData('busy', true);
              view.tweens.killTweensOf(g);
              await walk(g, { x: man.x + 9, y: man.y + L.FOOT });
              if (g.active) persons.setFacing(g, 'left');
            }
            if (!man.active) return;
            persons.setFacing(man, 'right');
            emote(man, 'emo_sigh', 300);
            nudge(rackImgs[rackAt]);
            await pause(900);
            g?.setData('busy', false);
            if (man.active) await leaveDown(man);
          })();
        }
      },
      missed: (kind) => {
        const man = actor;
        actor = null;
        if (booth && kind === 'size') {
          booth.img.setTexture('fl2b_booth');
          booth.busy = false;
        }
        extras = [];
        if (man?.active) {
          view.tweens.killTweensOf(man);
          emote(man, 'emo_sigh', 200);
          void leaveDown(man);
        }
      },
    });
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

  /**
   * Зевака (или пара, родитель с ребёнком — 15.11: «пары, друзья, кто-то с пакетами, дети»): поднимаются вместе,
   * смотрят одну вещь, уходят вниз без покупки. Консультант к ним не подходит — он занят покупателями.
   */
  async function looker(n: number): Promise<void> {
    const goal = pick(n * 3 + 2, false);
    const look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day);
    // Лёгкая графика — только поодиночке: одно место в толпе = один человечек (ревью 15.11).
    const group = lite ? null : n % 5 === 0 ? 'pair' : n % 5 === 3 ? 'kid' : null;
    if (!group) return browse(n, goal, 0, look, n % 4 === 1);
    const other = group === 'kid' ? { ...customerLook(look.shirt, state.day), kid: true, bag: undefined } : customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day);
    await Promise.all([browse(n, goal, 0, look, group === 'pair'), pause(500).then(() => browse(n + 1, goal, 8, other, false, false, true))]);
  }

  /** Один зевака: лестница (или уже у вещи — here) → вещь → (зеркало) → вниз; bag — пакет из зала в руке. */
  async function browse(n: number, goal: ReturnType<typeof pick>, dx: number, look: Look, bag: boolean, here = false, follower = false): Promise<void> {
    const at = { x: goal.at.x + dx, y: goal.at.y };
    const man = spawn(here ? at : L.SPOTS.stairsBottom, look).setAlpha(0);
    if (bag) man.add(kit.art(4, 3, 'fl2_bag'));
    if (here) {
      persons.setFacing(man, 'up');
      await tweenTo(kit, man, { alpha: 1, duration: 500 });
      await pause(800 + (n % 4) * 700);
    } else {
      persons.setFacing(man, 'up');
      await tweenTo(kit, man, { y: L.SPOTS.stairsTop.y - L.FOOT, alpha: 1, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
      await walk(man, at);
    }
    if (!man.active) return;
    persons.setFacing(man, follower ? 'left' : 'up');
    nudge(goal.img);
    await pause(1300 + (n % 3) * 500);
    if (!man.active) return;
    // Пусто — вздохнул; с «Брендами» чаще морщатся от бирки, без них — просто не решились. Ребёнок и спутник — радуются.
    emote(man, follower ? 'emo_heart' : !fresh ? 'emo_sigh' : ups.brands || n % 2 ? 'emo_pricey' : 'emo_question', 300);
    await pause(900);
    if (fresh && n % 3 === 1 && !follower) {
      await walk(man, L.SPOTS.mirror);
      if (!man.active) return;
      persons.setFacing(man, 'up');
      await pause(900);
    }
    await leaveDown(man);
  }

  /** Вниз по лестнице: дошёл до проёма и растаял. */
  async function leaveDown(man: Person): Promise<void> {
    await walk(man, L.SPOTS.stairsTop);
    if (!man.active) return;
    persons.setFacing(man, 'down');
    await tweenTo(kit, man, { y: L.SPOTS.stairsBottom.y - L.FOOT, alpha: 0, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
    man.destroy();
  }

  /** Двое знакомых встретились и болтают (по очереди — пузырь, сердечко, смех), потом расходятся. */
  async function chatter(): Promise<void> {
    for (let k = 0; view.sys.isActive() && !kit.leaving(); k++) {
      const pair = L.CHATS[k % L.CHATS.length];
      const men = pair.map((p, i) => ({ p, man: spawn(L.SPOTS.stairsBottom, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day)).setAlpha(0), i }));
      await Promise.all(
        men.map(async ({ p, man, i }) => {
          await pause(i * 700);
          persons.setFacing(man, 'up');
          await tweenTo(kit, man, { y: L.SPOTS.stairsTop.y - L.FOOT, alpha: 1, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
          await walk(man, p);
          if (man.active) persons.setFacing(man, i ? 'left' : 'right');
        }),
      );
      for (let r = 0; r < 4; r++) {
        const { man } = men[r % 2];
        emote(man, (['emo_bubble', 'emo_bubble', 'emo_heart', 'emo_star'] as const)[r], 900);
        await pause(1900);
      }
      await Promise.all(men.map(({ man, i }) => pause(i * 400).then(() => (man.active ? leaveDown(man) : undefined))));
      await pause(5000 + (k % 3) * 2000);
    }
  }

  /** Грузчик: снизу коробка с новой партией — к стеллажу, поправил полку, обратно за следующей. */
  async function loader(): Promise<void> {
    await pause(3000);
    for (let k = 0; view.sys.isActive() && !kit.leaving(); k++) {
      const man = spawn(L.SPOTS.stairsBottom, { ...customerLook(0xf77622, 0), style: 'cap', hair: 0xfeae34, acc: 'vest', accTint: 0xf77622 }).setAlpha(0);
      const box = kit.art(0, 1, 'box').setScale(0.4);
      man.add(box);
      persons.setFacing(man, 'up');
      await tweenTo(kit, man, { y: L.SPOTS.stairsTop.y - L.FOOT, alpha: 1, duration: 1100, onUpdate: () => man.setDepth(man.y + L.FOOT) });
      const to = k % 2 ? L.SPOTS.fold : L.SPOTS.shelf;
      await walk(man, to);
      if (!man.active) return;
      persons.setFacing(man, 'up');
      await pause(900);
      box.destroy();
      if (!man.active) return;
      emote(man, 'emo_star', 200);
      await pause(600);
      await leaveDown(man);
      await pause(14000 + (k % 3) * 4000);
    }
  }

  /** Охранник этажа: неспешно обходит зал по кругу, у каждой точки — оглядывается. */
  async function patrol(): Promise<void> {
    const man = spawn(L.PATROL[0], nightGuestLook('guard'));
    guard = man;
    for (let k = 1; man.active && !kit.leaving(); k++) {
      if (man.getData('busy')) {
        await pause(500);
        continue;
      }
      await walk(man, L.PATROL[k % L.PATROL.length]);
      if (!man.active) return;
      persons.setFacing(man, (['down', 'left', 'right', 'up'] as Facing[])[k % 4]);
      await pause(1600 + (k % 3) * 900);
    }
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
    await checkout(man, buy.price);
  }

  /**
   * Очередь на кассу: подошёл на своё место, ушёл кто-то впереди — шагнул вперёд; у кассы — заплатил и с пакетом
   * вниз. price — сумма над головой (null — без неё: покупка из момента «очередь», её деньги — в награде момента).
   */
  async function checkout(man: Person, price: number | null): Promise<void> {
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
    await pause(rush ? 350 : price === null ? 2600 : 900);
    if (!man.active) return;
    if (price !== null) popup(man.x, man.y - 16, `+${price} 💰`);
    man.add(kit.art(4, 3, ups.brands ? 'fl2b_bag_lux' : 'fl2_bag'));
    emote(cashier, 'emo_heart', 300);
    queue.shift();
    // Вниз по лестнице: тает в проёме.
    await leaveDown(man);
  }
}
