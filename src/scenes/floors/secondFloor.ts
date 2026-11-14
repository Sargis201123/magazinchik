// Второй этаж — магазин одежды в виде этажа (scenes/floorView.ts, game/clothes.ts, 13.11; 14.11 — на общей основе
// floors/kit.ts, вид не менялся). Светлый зал: обои и
// паркет, окна на улицу, у окон — манекены в вещах сезона, справа — примерочные с занавесками и зеркало, посередине —
// стойки (сколько вещей на этаже, столько стоек и заполнено), стол уценки с прошлым сезоном (на распродаже — красная
// бирка, без неё — паутинка), касса этажа с кассиром, внизу слева — лестница из магазина.
//
// Покупатели поднимаются по лестнице, смотрят вещи у стойки, заходят в примерочную (занавеска задёргивается) и
// выходят уже в обновке, крутятся у зеркала, платят на кассе и уходят вниз с розовым пакетом. Сколько их — от
// прогноза дня (clothesPlan): стойки пусты — никто не поднимается. В лёгкой графике — меньше людей, без примерочной
// и без бликов. Модуль — в том же отдельном файле, что и вид этажа: в первый файл игры не входит.

import Phaser from 'phaser';
import { t } from '../../i18n';
import { sound } from '../../platform/sound';
import { clothesOf, clothesPlan, collectionFor, COLLECTION_DEFS, COLLECTIONS, oldStock, rackPlaces, SALE_OFF, soldBy, stockTotal, type Collection } from '../../game/clothes';
import { guestsToday } from '../../game/day';
import { SHIRTS, customerLook, type Look } from '../common';
import * as persons from '../persons';
import { crowd, lightPool, pause as wait, prop, shell, tweenTo, walker, type FloorKit, type Point } from './kit';

/** Стойки: где стоят (низ) — голый этаж занимает первые четыре, после ремонта — все шесть. */
const RACKS: Point[] = [
  { x: 34, y: 110 },
  { x: 66, y: 110 },
  { x: 34, y: 152 },
  { x: 66, y: 152 },
  { x: 98, y: 110 },
  { x: 98, y: 152 },
];
/** Сколько вещей изображает одна полная стойка. */
const PER_RACK = 10;
/** Проходы (по высоте) и коридоры (по ширине): люди ходят по ним, а не сквозь стойки. */
const AISLES = [74, 124, 168, 192];
const CORRIDORS = [16, 118];
const SPEED = 30;
/** Сколько покупателей одновременно на этаже и как часто поднимается следующий (мс). */
const MAX_PEOPLE = 4;
const LITE_PEOPLE = 2;
const SPAWN_EVERY = 2600;
/** Кого уже показали на кассе сегодня: 13.11, ревью — этаж не должен «продавать» больше, чем продаст вечер, даже
 *  если вид открывают по нескольку раз за день. */
let shown = { day: 0, n: 0 };

/** Манекены и обновки — что носят в этой коллекции (гардероб wardrobe.ts и куртки persons.ts). */
function wear(coll: Collection, i: number): Partial<Look> {
  if (coll === 'warm') return { coat: [0xa22633, 0x262b44, 0x3e8948][i % 3], scarf: [0xfee761, 0xe43b44, 0xffffff][i % 3], hat: i % 2 ? 'ushanka' : 'furhat', hatTint: [0x8f563b, 0xc0cbdc][i % 2] };
  if (coll === 'rain') return { outfit: 'trench', outfitTint: [0xe4a672, 0xfeae34, 0xc28569][i % 3], hat: 'beret', hatTint: [0x124e89, 0xa22633][i % 2] };
  return { outfit: 'hawaii', outfitTint: [0xffffff, 0x9cd8ff, 0xfee761][i % 3], hat: i % 2 ? 'straw' : 'sunhat', hatTint: 0xffffff };
}

const MANNEQUIN: Look = { shirt: 0xc0cbdc, skin: 0xc0cbdc, pants: 0x8b9bb4, style: 'bald' };

export function buildSecond(kit: FloorKit): void {
  const { scene: view, store, W, H, WALL, lite } = kit;
  const state = store.state;
  const c = clothesOf(state);
  const coll = collectionFor(state.day);
  const text = kit.text;
  const popup = (x: number, y: number, s: string, color = '#fee761'): void => kit.popup(x, y, s, { color, depth: 400, hold: 1400 });
  const pause = (ms: number): Promise<void> => wait(kit, ms);
  const { walk } = walker(kit, { aisles: AISLES, corridors: CORRIDORS, speed: SPEED });

  // Стены и пол.
  shell(kit, { wall: 'fl2_wall', floor: 'fl2_floor', side: 0x3e2731, sideW: 5, strips: [[WALL - 2, 2, 0xb86f50], [WALL, 1.5, 0x733e39, 0.5]] });
  text(W / 2 - 14, 8, `👗 ${t('floor.second')}`, 7, '#b55088').setDepth(1);
  // Окна на улицу, у окон — манекены в вещах сезона.
  for (const [k, x] of [24, 66].entries()) {
    prop(kit, x, WALL - 3, 'fl2_window', { depth: 0 });
    const m = kit.person(x, WALL + 13, { ...MANNEQUIN, ...wear(coll, k) }).setDepth(WALL + 13);
    view.add.ellipse(x, WALL + 21, 10, 3, 0xb86f50).setDepth(WALL + 12);
    m.setData('mannequin', true);
  }
  // Примерочные и зеркало у правой стены.
  const booths = [128, 150].map((x) => prop(kit, x, WALL + 22, 'fl2_fitting'));
  const busy = [false, false];
  prop(kit, 105, WALL + 22, 'fl2_mirror');
  // Стойки: пустые места (ещё не отделали — только четыре), заполненные — по запасу коллекции.
  const places = rackPlaces(state);
  const racks = RACKS.slice(0, places / PER_RACK > 4 ? 6 : 4);
  const fresh = c?.stock?.[coll] ?? 0;
  const full = Math.ceil(fresh / PER_RACK);
  racks.forEach((p, i) => {
    const key = i < full ? `fl2_rack_${coll}` : 'fl2_rack';
    const rack = prop(kit, p.x, p.y, key);
    rack.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      sound.tap();
      popup(p.x, p.y - 24, `${COLLECTION_DEFS[coll].icon} ${t('cl.stock', { n: stockTotal(c), max: places })}`, '#ffffff');
    });
  });
  // Прошлый сезон: стол уценки. На распродаже — бирка, без неё вещи пылятся (паутинка).
  const old = oldStock(state);
  if (old) {
    prop(kit, 138, 116, 'fl2_bin');
    if (c?.sale) {
      const tag = kit.art(138, 98, 'fl2_sale').setDepth(117);
      if (!lite) view.tweens.add({ targets: tag, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else kit.art(131, 105, 'fl2_web').setDepth(117).setAlpha(0.8);
  }
  // Касса этажа: кассир за стойкой.
  const cashier = kit.person(140, 160, { ...customerLook(0xb55088, 0), acc: 'badge' });
  cashier.setDepth(160);
  prop(kit, 138, 172, 'fl2_till').setInteractive({ useHandCursor: true }).on('pointerup', () => {
    sound.tap();
    const plan = clothesPlan(store.state, guestsToday(store.state));
    popup(138, 146, plan && fresh ? t('cl.tap', { n: plan.sold + plan.sale, sum: plan.income - plan.wage }) : t('cl.floorEmpty'));
  });
  // Лестница из магазина — внизу слева.
  prop(kit, 22, H - 31, 'fl2_stairs', { oy: 0 });
  // Свет: тёплые пятна от люстр (в лёгкой графике — без них).
  if (!lite) {
    for (const [x, y] of [[50, 100], [118, 150], [60, 180]] as const) lightPool(kit, x, y, { w: 90, h: 70, tint: 0xfee761, alpha: 0.12, depth: 300 });
  }
  if (!fresh) text(W / 2 - 10, 132, t('cl.floorEmpty'), 6, '#733e39').setDepth(301);

  // Продавец-консультант: ходит между стойками и поправляет вещи.
  if (c?.clerk) {
    const clerk = kit.person(50, 124, { ...customerLook(0x68386c, 0), acc: 'tie' });
    // Следующий обход — только когда закончен прежний: 13.11, ревью — по таймеру длинный путь (4–5 с) накладывался на
    // новый, и продавец дёргался между двумя целями.
    if (!lite) {
      const round = async (): Promise<void> => {
        for (let k = 0; clerk.active; k++) {
          const p = racks[k % racks.length];
          await walk(clerk, { x: p.x + 6, y: p.y + 8 });
          if (!clerk.active) return;
          persons.setFacing(clerk, 'up');
          await pause(1800);
        }
      };
      void pause(1200).then(round);
    }
  }

  // Покупки дня — ровно по прогнозу: сначала вещи сезона по полной цене, потом уценка прошлых коллекций за полцены
  // (тот же порядок, что и вечером в clothesNight). Показали всех — больше никто не поднимается.
  const plan = clothesPlan(state, guestsToday(state));
  const sales: { price: number; bin: boolean }[] = [];
  if (plan && c) {
    const by = soldBy(c, plan);
    for (const id of COLLECTIONS) {
      const own = id === coll;
      const price = own ? COLLECTION_DEFS[id].price : Math.round(COLLECTION_DEFS[id].price * SALE_OFF);
      for (let i = 0; i < (by[id] ?? 0); i++) sales[own ? 'unshift' : 'push']({ price, bin: !own });
    }
  }
  if (shown.day !== state.day) shown = { day: state.day, n: 0 };
  if (shown.n >= sales.length) return;
  crowd(kit, { every: SPAWN_EVERY, max: MAX_PEOPLE, liteMax: LITE_PEOPLE, next: () => (shown.n < sales.length ? shown.n++ : null), run: (n) => shopper(n, sales[n]) });

  /** Покупатель: лестница → стойка (уценка — стол распродажи) → (примерочная → зеркало) → касса → с пакетом вниз. */
  async function shopper(n: number, buy: { price: number; bin: boolean }): Promise<void> {
    let look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day);
    let man = kit.person(22, H - 18, look).setAlpha(0);
    persons.setFacing(man, 'up');
    await tweenTo(kit, man, { y: H - 38, alpha: 1, duration: 900 });
    const rack = buy.bin ? { x: 138, y: 116 } : racks[Math.floor(Math.random() * Math.min(racks.length, Math.max(1, full)))];
    await walk(man, { x: rack.x + Phaser.Math.Between(-6, 6), y: rack.y + 8 });
    if (!man.active) return;
    persons.setFacing(man, 'up');
    await pause(1300);
    // Примерочная (в лёгкой графике — сразу на кассу): заходит, занавеска задёргивается, выходит в обновке.
    const b = busy.indexOf(false);
    if (!lite && !buy.bin && b >= 0 && man.active) {
      busy[b] = true;
      const booth = booths[b];
      await walk(man, { x: booth.x, y: WALL + 28 });
      if (!man.active) return;
      persons.setFacing(man, 'up');
      await tweenTo(kit, man, { y: WALL + 20, alpha: 0, duration: 400 });
      booth.setTexture('fl2_fitting_shut');
      await pause(1900);
      booth.setTexture('fl2_fitting');
      busy[b] = false;
      look = { ...look, ...wear(coll, n), ...(coll === 'warm' ? { outfit: undefined } : { coat: undefined }) };
      man.destroy();
      man = kit.person(booth.x, WALL + 20, look).setAlpha(0);
      persons.setFacing(man, 'down');
      await tweenTo(kit, man, { y: WALL + 28, alpha: 1, duration: 400 });
      // У зеркала: повернулся, полюбовался.
      await walk(man, { x: 105, y: WALL + 32 });
      if (!man.active) return;
      persons.setFacing(man, 'up');
      const heart = kit.art(man.x, man.y - 14, 'emo_heart').setDepth(400);
      view.tweens.add({ targets: heart, y: heart.y - 4, alpha: 0, delay: 600, duration: 500, onComplete: () => heart.destroy() });
      await pause(1000);
    }
    // Касса: платит и получает пакет.
    await walk(man, { x: 134, y: 182 });
    if (!man.active) return;
    persons.setFacing(man, 'up');
    await pause(800);
    popup(man.x, man.y - 16, `+${buy.price} 💰`);
    man.add(kit.art(4, 3, 'fl2_bag'));
    // Вниз по лестнице: тает в проёме.
    await walk(man, { x: 22, y: H - 38 });
    if (!man.active) return;
    persons.setFacing(man, 'down');
    await tweenTo(kit, man, { y: H - 18, alpha: 0, duration: 900 });
    man.destroy();
  }
}
