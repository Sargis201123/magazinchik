// Фудкорт в виде этажа (game/foodcourt.ts, 13.11): то, что FloorView (floorView.ts) рисует для третьего этажа.
// Отдельным модулем — чтобы подвал и будущий второй этаж не толкались в одном файле; грузится вместе с видом этажа
// (по требованию), в первый файл игры не входит.
//
// Светлый зал: задняя стена — панорамные окна на крыши района, слева в ней — лифт, по ней — точки еды (закрытая по
// жалобе — под жалюзи), в зале — общие столы со скамьями. За столами сидит столько людей, сколько сегодня едоков
// (не больше мест); по выходным — семьи с детьми, в день рождения у одного стола — шарики, торт и дети с шариками.
// Люди меняются: кто-то уходит к лифту, кто-то приходит и садится. В лёгкой графике — без смены людей и мигания.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { foodPlan, isFoodWeekend, partyOn, stallPlaces, stallsOf, STALLS, type StallId } from '../game/foodcourt';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { ART, SHIRTS, customerLook, type Look } from './common';
import * as persons from './persons';

/** Что вид этажа даёт фудкорту: свою сцену, магазин и пару рисовалок (FloorView держит их у себя). */
export interface FloorKit {
  scene: Phaser.Scene;
  store: StoreScene;
  W: number;
  H: number;
  WALL: number;
  art(x: number, y: number, key: string): Phaser.GameObjects.Image;
  text(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text;
  popup(x: number, y: number, s: string): void;
  person(x: number, y: number, look: Look): Phaser.GameObjects.Container;
  leaving(): boolean;
}

/** Лифт у левого края задней стены, точки — правее (середины мест), низ стойки. */
const LIFT_X = 13;
const STALL_X = [40, 71, 102, 133];
const STALL_BOTTOM = 66;
/** Столы: два ряда по ширине, три по глубине; голый этаж — четыре стола, после ремонта — шесть. */
const TABLE_X = [52, 118];
const TABLE_Y = [112, 158, 204];
/** Места за столом (смещения от низа-середины стола): двое сзади (лицом к нам), двое спереди (спиной). */
const SEATS: { dx: number; dy: number; back: boolean }[] = [
  { dx: -6, dy: -14, back: true },
  { dx: 6, dy: -14, back: true },
  { dx: -6, dy: 3, back: false },
  { dx: 6, dy: 3, back: false },
];
/** Сколько едоков на одного сидящего в кадре и как часто меняются люди (мс). */
const EATERS_PER_SEAT = 4;
const SWAP_EVERY = 4200;

interface Seat {
  x: number;
  y: number;
  back: boolean;
  depth: number;
  who: Phaser.GameObjects.Container | null;
}

export function buildFoodcourt(kit: FloorKit): void {
  const { scene, store, W, H, WALL } = kit;
  const state = store.state;
  const lite = store.lite;
  const tile = (x: number, y: number, w: number, h: number, key: string, depth: number) =>
    scene.add.tileSprite(x, y, w, h, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
  tile(0, 0, W, WALL, 'fc_wall', -10);
  tile(0, WALL, W, H - WALL, 'fc_floor', -10);
  scene.add.rectangle(0, WALL, W, 2, 0x181425, 0.25).setOrigin(0).setDepth(-9);
  // Боковые стены — тёплые, не тёмные: этаж светлый.
  scene.add.rectangle(0, 0, 4, H, 0x733e39).setOrigin(0).setDepth(-8);
  scene.add.rectangle(W - 4, 0, 4, H, 0x733e39).setOrigin(0).setDepth(-8);
  const head = kit.text(W / 2, 7, `🍕 ${t('fc.header')}`, 7, '#fee761').setDepth(1);
  head.setBackgroundColor('#181425aa').setPadding(3, 1, 3, 1);
  kit.art(LIFT_X, STALL_BOTTOM - 8, 'fc_lift').setOrigin(0.5, 1).setDepth(STALL_BOTTOM - 8);

  // Точки еды вдоль задней стены; свободные места — меловой контур на полу.
  const plan = foodPlan(state);
  const stalls = stallsOf(state);
  const places = stallPlaces(state);
  for (let i = 0; i < places; i++) {
    const x = STALL_X[i];
    const id = stalls[i];
    if (!id) {
      scene.add.rectangle(x, STALL_BOTTOM - 6, 24, 10).setStrokeStyle(0.5, 0xb86f50, 0.7).setDepth(-7);
      continue;
    }
    buildStall(kit, id, x, plan?.stalls.find((p) => p.id === id));
  }
  if (!stalls.length) kit.text(W / 2, WALL + 46, t('fc.empty'), 5.5, '#733e39').setDepth(5);

  // Столы и места за ними.
  const tables = 4 + (places > 3 ? 2 : 0);
  const seats: Seat[] = [];
  for (let k = 0; k < tables; k++) {
    const x = TABLE_X[k % 2];
    const y = TABLE_Y[Math.floor(k / 2)];
    kit.art(x, y, 'fc_table').setOrigin(0.5, 1).setDepth(y - 2);
    for (const s of SEATS) seats.push({ x: x + s.dx, y: y + s.dy, back: s.back, depth: s.back ? y - 3 : y + 4, who: null });
  }
  // Растения по углам и у колонн: зал живой.
  for (const [x, y] of [[W - 12, WALL + 30], [10, H - 8], [W - 12, H - 8], [85, 134]] as const) kit.art(x, y, 'plant_big').setOrigin(0.5, 1).setScale(0.7 / ART).setDepth(y);

  // Сколько сидит: по едокам дня, не больше мест. Выходные — семьи (у каждого второго стола ребёнок).
  const seated = Math.min(seats.length, Math.ceil((plan?.eaters ?? 0) / EATERS_PER_SEAT));
  const family = isFoodWeekend(state);
  const party = partyOn(state);
  // День рождения: первый стол — праздничный, за ним дети с шариками, на столе торт, рядом связка шариков.
  if (party) {
    const [x, y] = [TABLE_X[0], TABLE_Y[0]];
    kit.art(x - 24, y + 2, 'fc_balloons').setOrigin(0.5, 1).setDepth(y + 2);
    kit.art(x, y - 9, 'item_honeycake').setScale(0.9 / ART).setOrigin(0.5, 1).setDepth(y - 1);
    // Растяжка над праздничным столом — поверх всех (люди у стоек её не заслоняют).
    const sign = kit.text(x, y - 34, `🎂 ${t('fc.birthday')}`, 5, '#fee761').setDepth(H + 20);
    sign.setBackgroundColor('#b55088cc').setPadding(2, 1, 2, 1);
    if (!lite) scene.tweens.add({ targets: sign, y: sign.y - 1.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const look = (k: number): Look => {
    const base = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day);
    if (party && k < 4) return { ...base, kid: true, stroller: undefined, dog: undefined, prop: 'balloon', propTint: Phaser.Utils.Array.GetRandom([0xe43b44, 0xfee761, 0x2ce8f5]) };
    if (family && k % 4 === 1) return { ...base, kid: true, stroller: undefined, dog: undefined };
    return { ...base, stroller: undefined, dog: undefined };
  };
  const sit = (seat: Seat, k: number): Phaser.GameObjects.Container => {
    const man = kit.person(seat.x, seat.y, look(k)).setDepth(seat.depth);
    persons.setFacing(man, seat.back ? 'down' : 'up');
    seat.who = man;
    return man;
  };
  // Праздничный стол садится первым; остальные — вразбивку, чтобы не забивать столы по порядку.
  const order = seats.map((_, k) => k).sort((a, b) => (party ? Number(b < 4) - Number(a < 4) : 0) || ((a * 7) % 5) - ((b * 7) % 5));
  const busy = Math.max(seated, party ? 4 : 0);
  order.slice(0, busy).forEach((k) => sit(seats[k], k));
  // Еда на столах: перед каждым, кто сидит, — тарелка или чашка.
  for (const seat of seats) {
    if (!seat.who) continue;
    const food = kit.art(seat.x, seat.back ? seat.y + 8 : seat.y - 10, `fc_food${Math.floor(Math.random() * 4)}`).setDepth(seat.back ? seat.depth + 0.5 : seat.depth - 6);
    food.setScale(0.8 / ART);
  }
  if (lite) return;
  // Люди меняются: сидящий уходит к лифту и тает; на свободное место приходит новый (не на праздничный стол).
  scene.time.addEvent({
    delay: SWAP_EVERY,
    loop: true,
    callback: () => {
      if (kit.leaving()) return;
      const free = seats.map((s, k) => ({ s, k })).filter(({ s, k }) => !s.who && !(party && k < 4));
      const taken = seats.map((s, k) => ({ s, k })).filter(({ s, k }) => s.who && !(party && k < 4));
      // Сколько должно сидеть — держим около утреннего числа: кто-то ушёл — кто-то пришёл.
      if (taken.length >= busy - (party ? 4 : 0) && taken.length && Math.random() < 0.5) {
        const { s } = Phaser.Utils.Array.GetRandom(taken);
        const man = s.who!;
        s.who = null;
        persons.setFacing(man, 'left');
        scene.tweens.add({ targets: man, x: LIFT_X + 4, y: STALL_BOTTOM - 4, duration: 2200, ease: 'Linear', onStart: () => man.setDepth(STALL_BOTTOM) });
        scene.tweens.add({ targets: man, alpha: 0, delay: 1900, duration: 400, onComplete: () => man.destroy() });
      } else if (free.length) {
        const { s, k } = Phaser.Utils.Array.GetRandom(free);
        const man = kit.person(LIFT_X + 4, STALL_BOTTOM - 4, look(k + 8)).setDepth(STALL_BOTTOM).setAlpha(0);
        s.who = man;
        persons.setFacing(man, 'right');
        scene.tweens.add({ targets: man, alpha: 1, duration: 300 });
        scene.tweens.add({
          targets: man,
          x: s.x,
          y: s.y,
          duration: 2400,
          ease: 'Linear',
          onUpdate: () => man.setDepth(man.y < s.y - 2 ? man.y + 6 : s.depth),
          onComplete: () => {
            if (!man.active) return;
            man.setDepth(s.depth);
            persons.setFacing(man, s.back ? 'down' : 'up');
          },
        });
      }
    },
  });
}

/** Точка: стойка, свет вывески, очередь из одного-двух человек; закрытая — под жалюзи и с табличкой. */
function buildStall(kit: FloorKit, id: StallId, x: number, plan: { eaters: number; income: number; closed: boolean } | undefined): void {
  const { scene, store } = kit;
  const stall = kit.art(x, STALL_BOTTOM, `fc_${id}`).setOrigin(0.5, 1).setDepth(STALL_BOTTOM);
  // Тёплый отсвет вывески на полу перед точкой; в обычной графике чуть дышит.
  const glow = kit.art(x, STALL_BOTTOM + 3, 'glow').setDisplaySize(30, 12).setTint(0xfeae34).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(STALL_BOTTOM - 1);
  if (!store.lite) scene.tweens.add({ targets: glow, alpha: 0.12, duration: 1400 + x * 4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  if (plan?.closed) {
    kit.art(x, STALL_BOTTOM - 4, 'fc_shutter').setOrigin(0.5, 1).setDepth(STALL_BOTTOM + 0.2);
    const sign = kit.text(x, STALL_BOTTOM - 8, t('fc.closedSign'), 4.5, '#ffffff').setDepth(STALL_BOTTOM + 0.3);
    sign.setBackgroundColor('#a22633').setPadding(1.5, 0.5, 1.5, 0.5);
    glow.setVisible(false);
  } else if (plan) {
    // Очередь у стойки: у людной точки — двое, у тихой — один.
    const queue = plan.eaters >= STALLS[id].eaters ? 2 : 1;
    for (let q = 0; q < queue; q++) {
      const man = kit.person(x + (q ? 5 : -3), STALL_BOTTOM + 7 + q * 8, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), store.state.day)).setDepth(STALL_BOTTOM + 7 + q * 8);
      persons.setFacing(man, 'up');
    }
  }
  stall.setInteractive({ useHandCursor: true }).on('pointerup', () => {
    sound.tap();
    const name = t(`fc.stall.${id}` as TextKey);
    kit.popup(x, STALL_BOTTOM - 34, plan?.closed ? `${STALLS[id].icon} ${t('fc.inspect.closed', { name })}` : `${STALLS[id].icon} ${t('fc.tap', { n: plan?.eaters ?? 0, sum: plan?.income ?? 0 })}`);
  });
}
