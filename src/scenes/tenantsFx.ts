// Комнаты арендаторов во флигеле (game/tenants.ts): над кухней и кофейней. Свободная комната — тёмная, с
// табличкой «Сдаётся»; занятая — со своей обстановкой и работником, из зала в неё заходят посетители
// (из пункта выдачи выходят с посылкой). Места комнат — layout.ts (tenants), двери и свет — как у остальных
// комнат флигеля (building.openRooms). В Заречье комнат нет.
//
// 10.11 (третий обход, просьба автора — «движений никаких нету»): комнаты живые. В автомате с игрушками ездит и
// ныряет клешня, мигают лампочки, выкатывается шарик, ребёнок подпрыгивает; в пункте выдачи работница ходит от
// стеллажа к стойке, по стойке едет посылка; в аптеке горит крест; у мастера летят искры; у парикмахера крутится
// столбик и щёлкают ножницы; в фотобудке вспышка; банкомат выдаёт купюру. Нажатие на комнату — отклик. Посетителей
// больше, к пункту выдачи в час пик — очередь. Вторая отделка — гирлянда под потолком. Вечером вывески светятся.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t, type TextKey } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { PITCH_ICON, pitchNow, tenantsLook, tenantsOf, tenantTier, type TenantId } from '../game/tenants';
import { sound } from '../platform/sound';
import { inZar } from '../game/zarshop';
import { ART, SHIRTS, WALL, customerLook, randomLook } from './common';
import { WING_OUTER, type Room } from './layout';
import * as building from './building';
import * as camera from './camera';
import * as lighting from './lighting';
import * as motion from './motion';
import * as persons from './persons';

/** Сколько посетителей арендаторов ходит по залу сразу. */
const VISITORS = 3;
const KRAFT = [0xc8955a, 0xb07a45, 0xd8a868];
/** Пол и стена комнаты по арендатору. */
const TONE: Record<TenantId, { floor: number; wall: number }> = {
  pickup: { floor: 0xdfe6f5, wall: 0xdce4f6 },
  pharmacy: { floor: 0xe6fff0, wall: 0xd8f0e0 },
  repair: { floor: 0xf0e2c8, wall: 0xf0dcc0 },
  toys: { floor: 0xfff0d8, wall: 0xffe2ea },
  barber: { floor: 0xf0e8f4, wall: 0xe8d8f0 },
  photo: { floor: 0xe6e8f2, wall: 0xd4d8ec },
  atm: { floor: 0xe6f2e6, wall: 0xd6e6da },
};
/** Чем комната отзывается на нажатие и каким цветом светится её вывеска вечером. */
const TAP: Record<TenantId, string> = { pickup: '📦', pharmacy: '💊', repair: '🔧', toys: '🧸', barber: '✂️', photo: '📸', atm: '💵' };
const NEON: Record<TenantId, number> = { pickup: 0xffb060, pharmacy: 0x7cff8a, repair: 0xffe080, toys: 0xff8ad8, barber: 0x9cd8ff, photo: 0xf4f8ff, atm: 0x8affb0 };

/** Комнаты, в которых кто-то работает: у них есть дверь из зала и свет. */
export function rentedRooms(scene: StoreScene): Room[] {
  return inZar(scene.state) ? [] : scene.layout.tenants.slice(0, tenantsOf(scene.state).length);
}

/** Блок комнат под аренду над флигелем: стены, свободные и занятые комнаты, посетители. */
export function buildTenants(scene: StoreScene): void {
  scene.builtTenants = tenantsLook(scene.state);
  scene.tenantGuests = 0;
  const rooms = inZar(scene.state) ? [] : scene.layout.tenants;
  if (!rooms.length) return;
  const cap = (x: number, y: number, w: number, h: number) => scene.add.tileSprite(x, y, w, h, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(2);
  const left = -WING_OUTER;
  const top = rooms[rooms.length - 1].y;
  const bottom = rooms[0].y + rooms[0].h;
  cap(left, top - 4, WING_OUTER - WALL, 4);
  cap(left, top, WALL, bottom - top + WALL);
  const who = tenantsOf(scene.state);
  rooms.forEach((room, i) => {
    cap(left + WALL, room.y + room.h, room.w, WALL);
    buildRoom(scene, room, who[i]);
  });
  if (!scene.lite && who.length) scene.worldTimer(4200, () => scene.sys.isActive() && scene.running && void visit(scene));
}

function buildRoom(scene: StoreScene, room: Room, id?: TenantId): void {
  const { x, y, w, h } = room;
  const tone = id ? TONE[id] : { floor: 0xffffff, wall: 0xd8d8e0 };
  scene.add.tileSprite(x, y, w, h, id ? 'floor2' : 'wh_floor').setOrigin(0).setTileScale(1 / ART).setTint(tone.floor);
  scene.add.tileSprite(x, y, w, 14, 'wall').setOrigin(0).setTileScale(1 / ART).setTint(tone.wall).setDepth(1);
  if (!id) {
    // Свободная комната: полумрак и объявление.
    scene.add.rectangle(x, y + 14, w, h - 14, 0x1d1a26, 0.55).setOrigin(0).setDepth(y + h);
    scene.add
      .text(x + w / 2, y + h / 2 + 6, `🔑\n${t('wing.forRent')}`, { fontFamily: UI_FONT, fontSize: '5px', color: '#c0cbdc', align: 'center' })
      .setOrigin(0.5)
      .setResolution(scene.textRes(4))
      .setDepth(y + h + 1);
    return;
  }
  building.roomSign(scene, x, y + 7, w, t(`wing.tenant.${id}` as TextKey));
  // Створка двери со стороны комнаты — как у пекарни и кофейни.
  scene.add.rectangle(x + w - 3, room.doorway.y, 4, 14, 0x9e5b33).setStrokeStyle(1, 0x5a3420).setDepth(1.5);
  const g = scene.add.graphics().setDepth(y + 30);
  const back = scene.add.graphics().setDepth(2);
  const staff = FURNISH[id](scene, room, g, back);
  // Вторая отделка: гирлянда под потолком и коврик у двери.
  if (tenantTier(scene.state, id) === 2) {
    const bulbs = [0xfee761, 0xf6757a, 0x5fcde4, 0x63c74d];
    for (let i = 0; i < 9; i++) {
      const bulb = scene.add.circle(x + 5 + i * 6.2, y + 14.5 + (i % 2) * 1.2, 1, bulbs[i % bulbs.length]).setDepth(2.2);
      loop(scene, { targets: bulb, alpha: 0.35, duration: 520, yoyo: true, delay: (i % 3) * 170 });
    }
    back.lineStyle(0.4, 0x3b2a35, 0.8).lineBetween(x + 3, y + 14, x + w - 3, y + 14);
    g.fillStyle(0xb13e53, 1).fillRect(x + w - 13, room.doorway.y + 8, 9, 5);
    g.fillStyle(0xfee761, 1).fillRect(x + w - 12, room.doorway.y + 9, 7, 0.7).fillRect(x + w - 12, room.doorway.y + 11.3, 7, 0.7);
  }
  // Вечером вывеска светится своим цветом; аптечная — мерцает.
  lighting.nightGlow(scene, scene.add.rectangle(x + w - 16, y + 7, 26, 9, NEON[id]), 0.3, undefined, id === 'pharmacy' ? { twinkle: 1.3 } : {});
  // Нажатие на комнату: отклик — значок и кивок работника.
  scene.add
    .zone(x + w / 2, y + h / 2 + 4, w, h - 10)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () =>
      camera.tap(scene, () => {
        sound.tap();
        scene.popup(x + w / 2, y + 16, TAP[id], '#fff3b0');
        if (staff && !scene.lite) motion.squash(scene, staff, 1.08, 0.9, 90);
      }),
    );
}

/** Бесконечное движение в комнате; в лёгкой графике комнаты стоят неподвижно. */
function loop(scene: StoreScene, config: Phaser.Types.Tweens.TweenBuilderConfig): void {
  if (!scene.lite) scene.tweens.add({ repeat: -1, ease: 'Sine.easeInOut', ...config });
}

type Draw = Phaser.GameObjects.Graphics;

/** Ящик с тёмной кромкой снизу и справа — мебель «в один цвет» выглядела бы наклейкой. */
function box(g: Draw, x: number, y: number, w: number, h: number, color: number, edge = 0x262b44): void {
  g.fillStyle(edge, 1).fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
  g.fillStyle(color, 1).fillRect(x, y, w, h);
  g.fillStyle(0x181425, 0.18).fillRect(x, y + h - 1, w, 1).fillRect(x + w - 1, y, 1, h);
}

/** Работник за стойкой: стоит на месте, в общий список людей не идёт. */
function clerk(scene: StoreScene, x: number, y: number, shirt: number, depth: number, facing: 'down' | 'up' = 'down'): Phaser.GameObjects.Container {
  const man = persons.makePerson(scene, x, y, { ...randomLook(shirt), shirt });
  scene.people.delete(man);
  persons.setFacing(man, facing);
  man.setDepth(depth);
  return man;
}

/** Полка у задней стены с рядом коробок или баночек. */
function wallShelf(g: Draw, x: number, y: number, w: number, colors: number[], seed: string): void {
  const rnd = new Phaser.Math.RandomDataGenerator([seed]);
  g.fillStyle(0x8f563b, 1).fillRect(x, y + 5, w, 1.2);
  for (let bx = x + 0.5; bx < x + w - 3; ) {
    const bw = rnd.between(3, 6);
    const bh = rnd.between(3, 5);
    const color = rnd.pick(colors);
    g.fillStyle(0x3b2a35, 1).fillRect(bx - 0.4, y + 5 - bh - 0.4, bw + 0.8, bh + 0.4);
    g.fillStyle(color, 1).fillRect(bx, y + 5 - bh, bw, bh);
    g.fillStyle(0xffffff, 0.45).fillRect(bx, y + 5 - bh + 1, bw, 0.6);
    bx += bw + 1;
  }
}

/** Обстановка комнаты; возвращает работника (кивает на нажатие), если он есть. */
const FURNISH: Record<TenantId, (scene: StoreScene, room: Room, g: Draw, back: Draw) => Phaser.GameObjects.Container | undefined> = {
  // Пункт выдачи: стеллаж с посылками, стойка со сканером, коробки у стены.
  pickup: (scene, { x, y }, g, back) => {
    wallShelf(back, x + 4, y + 13, 40, KRAFT, 'pickup-a');
    wallShelf(back, x + 4, y + 20, 40, [...KRAFT, 0xd8e8f8], 'pickup-b');
    const man = clerk(scene, x + 14, y + 27, 0xf77622, y + 29);
    // Работница ходит от стеллажа к стойке и обратно; по стойке едет посылка, сканер мигает.
    loop(scene, { targets: man, x: x + 31, duration: 2600, yoyo: true, hold: 900, repeatDelay: 700 });
    const parcel = scene.add.rectangle(x + 9, y + 31, 5, 3.6, KRAFT[2]).setStrokeStyle(0.5, 0x5a3420).setDepth(y + 31);
    loop(scene, { targets: parcel, x: x + 37, duration: 2400, ease: 'Linear', repeatDelay: 1500, alpha: { from: 1, to: 0.9 } });
    const beam = scene.add.rectangle(x + 32.5, y + 30.7, 3, 1.5, 0xe43b44).setDepth(y + 31);
    loop(scene, { targets: beam, alpha: 0.1, duration: 300, yoyo: true, repeatDelay: 900 });
    box(g, x + 6, y + 32, 34, 7, 0x8b9bb4);
    g.fillStyle(0xf77622, 1).fillRect(x + 6, y + 36, 34, 1.5);
    box(g, x + 30, y + 29.5, 5, 3, 0x262b44);
    g.fillStyle(0x2ce8f5, 1).fillRect(x + 31, y + 30, 3, 1.5);
    box(g, x + 46, y + 38, 8, 6, KRAFT[0], 0x5a3420);
    box(g, x + 49, y + 33, 6, 5, KRAFT[1], 0x5a3420);
    g.fillStyle(0xe8d0a8, 1).fillRect(x + 49.5, y + 38, 1, 6).fillRect(x + 51.5, y + 33, 1, 5);
    return man;
  },
  // Аптека: зелёный крест, полки с лекарствами, белая витрина.
  pharmacy: (scene, { x, y }, g, back) => {
    back.fillStyle(0xffffff, 1).fillCircle(x + 10, y + 7, 4.5);
    back.fillStyle(0x265c42, 1).fillRect(x + 9, y + 4, 2, 6).fillRect(x + 7, y + 6, 6, 2);
    // Крест «горит»: яркий слой поверх тёмного дышит.
    const cross = scene.add.graphics().setDepth(2.1);
    cross.fillStyle(0x63ff7a, 1).fillRect(x + 9, y + 4, 2, 6).fillRect(x + 7, y + 6, 6, 2);
    loop(scene, { targets: cross, alpha: 0.15, duration: 650, yoyo: true });
    wallShelf(back, x + 4, y + 13, 40, [0xffffff, 0x5fcde4, 0xf6757a, 0x63c74d], 'pharm-a');
    wallShelf(back, x + 4, y + 20, 40, [0xffffff, 0xfee761, 0x5fcde4, 0xb55088], 'pharm-b');
    const man = clerk(scene, x + 18, y + 27, 0xffffff, y + 29);
    loop(scene, { targets: man, x: x + 30, duration: 3200, yoyo: true, hold: 1400, repeatDelay: 1100 });
    // На витрине мигает ценник-подсветка.
    const tag = scene.add.rectangle(x + 37, y + 33.2, 3, 1, 0xfee761).setDepth(y + 31);
    loop(scene, { targets: tag, alpha: 0.2, duration: 800, yoyo: true });
    box(g, x + 6, y + 32, 36, 7, 0xf4f8ff, 0x5a6988);
    g.fillStyle(0x9cd8ff, 0.9).fillRect(x + 7, y + 34, 34, 4);
    for (let i = 0; i < 6; i++) g.fillStyle([0xe43b44, 0x63c74d, 0xfee761][i % 3], 1).fillRect(x + 9 + i * 5.5, y + 35.5, 3, 2);
    box(g, x + 47, y + 36, 7, 8, 0x3e8948, 0x265c42);
    g.fillStyle(0x63c74d, 1).fillCircle(x + 50.5, y + 34, 4);
    return man;
  },
  // Ремонт телефонов и ключей: верстак с лампой, доска с ключами, мастер за работой.
  repair: (scene, { x, y }, g, back) => {
    back.fillStyle(0x5a3a2a, 1).fillRect(x + 5, y + 2.5, 20, 9);
    for (let i = 0; i < 12; i++) back.fillStyle(i % 3 ? 0xfee761 : 0xc0cbdc, 1).fillRect(x + 6.5 + (i % 6) * 3, y + 4 + Math.floor(i / 6) * 3.6, 1.4, 2.4);
    box(back, x + 5, y + 16, 38, 7, 0xb86f50, 0x5a3420);
    back.fillStyle(0x262b44, 1).fillRect(x + 9, y + 17.5, 3, 4.5);
    back.fillStyle(0x2ce8f5, 1).fillRect(x + 9.5, y + 18, 2, 3);
    back.fillStyle(0xc0cbdc, 1).fillRect(x + 16, y + 18, 5, 1).fillRect(x + 18, y + 20, 4, 1);
    back.fillStyle(0x3a4466, 1).fillRect(x + 37, y + 12, 1, 6).fillRect(x + 34, y + 12, 4, 1.5);
    // Свет лампы подрагивает, от паяльника летят искры, мастер покачивается над верстаком.
    const cone = scene.add.triangle(0, 0, x + 34, y + 13.5, x + 29, y + 22, x + 38, y + 22, 0xfee761, 0.5).setOrigin(0).setDepth(2.1);
    loop(scene, { targets: cone, alpha: 0.28, duration: 140, yoyo: true, repeatDelay: 2300 });
    for (let i = 0; i < 4; i++) {
      const spark = scene.add.rectangle(x + 19, y + 19, 0.9, 0.9, i % 2 ? 0xfee761 : 0xffffff).setDepth(y + 37).setAlpha(0);
      loop(scene, { targets: spark, x: x + 19 + (i - 1.5) * 3.2, y: y + 15 - (i % 2) * 2, alpha: { from: 1, to: 0 }, duration: 380, ease: 'Quad.easeOut', delay: i * 70, repeatDelay: 1500 });
    }
    const man = clerk(scene, x + 22, y + 30, 0x3a4466, y + 36, 'up');
    loop(scene, { targets: man, y: y + 29.2, duration: 420, yoyo: true, repeatDelay: 600 });
    box(g, x + 46, y + 37, 8, 7, 0x8b9bb4);
    g.fillStyle(0xe43b44, 1).fillRect(x + 47, y + 39, 6, 1.5);
    return man;
  },
  // Автомат с игрушками и шарики-жвачки: работает сам, у автомата стоит ребёнок.
  toys: (scene, { x, y }, g, back) => {
    const toys = [0xf6757a, 0xfee761, 0x63c74d, 0x5fcde4, 0xb55088, 0xfeae34];
    box(back, x + 8, y + 15, 18, 24, 0xe43b44, 0x6e1a2c);
    back.fillStyle(0x9cd8ff, 0.9).fillRect(x + 9.5, y + 16.5, 15, 13);
    const rnd = new Phaser.Math.RandomDataGenerator(['toys']);
    for (let i = 0; i < 12; i++) back.fillStyle(rnd.pick(toys), 1).fillCircle(x + 11 + rnd.frac() * 12, y + 25.5 + rnd.frac() * 3, 1.5);
    // Клешня ездит по стеклу и ныряет за игрушкой; под крышей бегут лампочки.
    const claw = scene.add.container(x + 12, y + 16.5, [scene.add.rectangle(0, 2.5, 0.8, 5, 0x5a6988), scene.add.rectangle(0, 5.2, 4, 1, 0x5a6988), scene.add.rectangle(-1.7, 6.2, 0.8, 1.6, 0x5a6988), scene.add.rectangle(1.7, 6.2, 0.8, 1.6, 0x5a6988)]).setDepth(2.1);
    loop(scene, { targets: claw, x: x + 22, duration: 2200, yoyo: true, hold: 1200, repeatDelay: 500 });
    loop(scene, { targets: claw, scaleY: 1.9, duration: 500, yoyo: true, delay: 2300, repeatDelay: 5100, ease: 'Quad.easeIn' });
    for (let i = 0; i < 5; i++) {
      const bulb = scene.add.circle(x + 10 + i * 3.5, y + 15.6, 0.8, i % 2 ? 0xfee761 : 0xffffff).setDepth(2.1);
      loop(scene, { targets: bulb, alpha: 0.2, duration: 260, yoyo: true, delay: i * 130 });
    }
    back.fillStyle(0xfee761, 1).fillRect(x + 9.5, y + 31, 15, 3);
    back.fillStyle(0x262b44, 1).fillRect(x + 13, y + 31.5, 1.5, 2).fillRect(x + 20, y + 35, 4, 3);
    // Автомат с шариками.
    box(back, x + 36, y + 28, 8, 10, 0xe43b44, 0x6e1a2c);
    back.fillStyle(0xd8f0f8, 1).fillCircle(x + 40, y + 23, 5.5);
    for (let i = 0; i < 9; i++) back.fillStyle(rnd.pick(toys), 1).fillCircle(x + 37 + rnd.frac() * 6, y + 21.5 + rnd.frac() * 5, 1.1);
    back.lineStyle(0.6, 0x262b44, 1).strokeCircle(x + 40, y + 23, 5.5);
    // Из автомата с шариками выкатывается шарик и катится по полу.
    const ball = scene.add.circle(x + 40, y + 37, 1.2, 0xfee761).setStrokeStyle(0.4, 0x3b2a35).setDepth(y + 46).setAlpha(0);
    loop(scene, { targets: ball, x: x + 30, y: y + 43, alpha: { from: 1, to: 1 }, duration: 900, ease: 'Bounce.easeOut', repeatDelay: 3600, hold: 500 });
    // Коврик-классики на полу.
    for (let i = 0; i < 4; i++) g.fillStyle(toys[i], 0.85).fillRect(x + 45 + (i % 2) * 5, y + 36 + Math.floor(i / 2) * 5, 4.5, 4.5);
    const kid = persons.makePerson(scene, x + 17, y + 41, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
    scene.people.delete(kid);
    persons.setFacing(kid, 'up');
    kid.setScale(0.82).setDepth(y + 47);
    // Ребёнок у автомата подпрыгивает от нетерпения; над ним — шарик на нитке.
    loop(scene, { targets: kid, y: y + 39.2, duration: 190, yoyo: true, repeatDelay: 1700, ease: 'Quad.easeOut' });
    const balloon = scene.add.container(x + 52, y + 24, [scene.add.rectangle(0, 4.5, 0.4, 6, 0x5a6988), scene.add.ellipse(0, 0, 4.4, 5.2, 0xf6757a), scene.add.rectangle(-0.8, -1, 0.9, 1.4, 0xffffff, 0.7)]).setDepth(y + 46);
    loop(scene, { targets: balloon, y: y + 22, duration: 1300, yoyo: true });
    return kid;
  },
  // Парикмахерская: зеркало, кресло с клиентом, мастер с ножницами, крутится столбик-вывеска.
  barber: (scene, { x, y }, g, back) => {
    box(back, x + 5, y + 14, 24, 13, 0x9cd8ff, 0x5a3420);
    back.fillStyle(0xffffff, 0.55).fillRect(x + 7, y + 15.5, 2, 9).fillRect(x + 11, y + 15.5, 0.8, 9);
    box(back, x + 5, y + 28, 24, 2.4, 0xb86f50, 0x5a3420);
    for (let i = 0; i < 4; i++) back.fillStyle([0xf6757a, 0x5fcde4, 0xfee761, 0x63c74d][i], 1).fillRect(x + 7 + i * 5, y + 26, 2, 2.4);
    // Столбик: белый цилиндр, по нему бегут красные и синие полосы.
    box(back, x + 46, y + 16, 5, 16, 0xf4f8ff, 0x3a4466);
    for (let i = 0; i < 4; i++) {
      const stripe = scene.add.rectangle(x + 48.5, y + 17 + i * 4, 5, 1.5, i % 2 ? 0x3b5dc9 : 0xe43b44).setDepth(2.1);
      loop(scene, { targets: stripe, y: stripe.y + 4, duration: 900, ease: 'Linear' });
    }
    back.fillStyle(0x3a4466, 1).fillRect(x + 45.5, y + 14.5, 6, 2).fillRect(x + 45.5, y + 31.5, 6, 2);
    // Кресло и клиент под накидкой.
    box(g, x + 13, y + 36, 9, 6, 0xb13e53, 0x5a1a2c);
    g.fillStyle(0x8b9bb4, 1).fillRect(x + 16.5, y + 42, 2, 3);
    const client = persons.makePerson(scene, x + 17.5, y + 38, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
    scene.people.delete(client);
    persons.setFacing(client, 'up');
    client.setDepth(y + 39);
    const man = clerk(scene, x + 27, y + 38, 0xb55088, y + 40, 'up');
    loop(scene, { targets: man, x: x + 25, duration: 600, yoyo: true, repeatDelay: 500 });
    // Ножницы щёлкают, обрезки падают на пол.
    const snip = scene.add.container(x + 22, y + 31, [scene.add.rectangle(-0.8, 0, 2.4, 0.5, 0xc0cbdc).setAngle(25), scene.add.rectangle(-0.8, 0, 2.4, 0.5, 0xc0cbdc).setAngle(-25)]).setDepth(y + 41);
    loop(scene, { targets: snip, scaleY: 0.2, duration: 150, yoyo: true, repeatDelay: 240 });
    for (let i = 0; i < 3; i++) {
      const hair = scene.add.rectangle(x + 15 + i * 2.5, y + 33, 1, 0.6, 0x4a2c1a).setDepth(y + 41).setAlpha(0);
      loop(scene, { targets: hair, y: y + 44, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Quad.easeIn', delay: i * 400, repeatDelay: 1300 });
    }
    box(g, x + 44, y + 38, 9, 6, 0x5a6988);
    return man;
  },
  // Фото на документы: будка со шторкой и вспышкой, штатив с камерой, фотограф, из щели выезжает лента снимков.
  photo: (scene, { x, y }, g, back) => {
    box(back, x + 6, y + 14, 20, 26, 0x3a4466, 0x181425);
    back.fillStyle(0xb13e53, 1).fillRect(x + 8, y + 19, 9, 21);
    back.fillStyle(0x8a2c40, 1).fillRect(x + 10, y + 19, 0.8, 21).fillRect(x + 13.5, y + 19, 0.8, 21);
    back.fillStyle(0xfee761, 1).fillRect(x + 8, y + 15.2, 16, 2.6);
    back.fillStyle(0x181425, 1).fillRect(x + 19, y + 24, 5, 1);
    // Вспышка за шторкой и лента снимков из щели.
    const flash = scene.add.rectangle(x + 12.5, y + 28, 11, 20, 0xffffff).setDepth(2.1).setAlpha(0);
    loop(scene, { targets: flash, alpha: { from: 0.95, to: 0 }, duration: 260, ease: 'Quad.easeOut', repeatDelay: 2900 });
    const strip = scene.add.container(x + 21.5, y + 25, [scene.add.rectangle(0, 0, 3.4, 7, 0xf4f8ff).setStrokeStyle(0.4, 0x3b2a35), scene.add.rectangle(0, -2, 2.2, 1.6, 0x5a6988), scene.add.rectangle(0, 0.2, 2.2, 1.6, 0x5a6988), scene.add.rectangle(0, 2.4, 2.2, 1.6, 0x5a6988)]).setDepth(2.2);
    loop(scene, { targets: strip, y: y + 31, duration: 900, hold: 1400, repeatDelay: 860, ease: 'Quad.easeOut', alpha: { from: 1, to: 1 } });
    // Фон для съёмки и табурет.
    box(back, x + 32, y + 14, 14, 14, 0xf4f8ff, 0x8b9bb4);
    box(g, x + 36, y + 31, 6, 3, 0x8f563b, 0x5a3420);
    // Штатив с камерой и фотограф.
    g.lineStyle(0.7, 0x262b44, 1).lineBetween(x + 39, y + 38, x + 36, y + 45).lineBetween(x + 39, y + 38, x + 42, y + 45).lineBetween(x + 39, y + 38, x + 39, y + 45);
    box(g, x + 36.5, y + 34.5, 5, 3.5, 0x262b44);
    g.fillStyle(0x9cd8ff, 1).fillCircle(x + 39, y + 36.2, 1);
    const pop = scene.add.circle(x + 39, y + 36.2, 3.4, 0xffffff).setDepth(y + 46).setAlpha(0);
    loop(scene, { targets: pop, alpha: { from: 0.9, to: 0 }, scale: { from: 0.6, to: 1.6 }, duration: 300, delay: 1500, repeatDelay: 4100 });
    const man = clerk(scene, x + 48, y + 41, 0x262b44, y + 43, 'up');
    loop(scene, { targets: man, x: x + 46, duration: 900, yoyo: true, repeatDelay: 2100 });
    return man;
  },
  // Банкомат и терминал: работают сами — экран мигает, из щели выезжает купюра, на стене бегут огоньки.
  atm: (scene, { x, y }, g, back) => {
    box(back, x + 8, y + 14, 15, 25, 0x3e8948, 0x265c42);
    back.fillStyle(0x181425, 1).fillRect(x + 10, y + 17, 11, 8);
    back.fillStyle(0xc0cbdc, 1).fillRect(x + 10.5, y + 27.5, 10, 4.5);
    for (let i = 0; i < 9; i++) back.fillStyle(0x5a6988, 1).fillRect(x + 11.5 + (i % 3) * 3, y + 28.2 + Math.floor(i / 3) * 1.4, 1.8, 0.9);
    back.fillStyle(0x181425, 1).fillRect(x + 11, y + 34, 9, 1);
    const screen = scene.add.rectangle(x + 15.5, y + 21, 10, 7, 0x2ce8f5).setDepth(2.1);
    loop(scene, { targets: screen, alpha: 0.55, duration: 700, yoyo: true });
    const note = scene.add.rectangle(x + 15.5, y + 34.5, 7, 2.6, 0x63c74d).setStrokeStyle(0.4, 0x265c42).setDepth(2.2).setAlpha(0);
    loop(scene, { targets: note, y: y + 37.5, alpha: { from: 1, to: 1 }, duration: 600, hold: 1200, repeatDelay: 2600, ease: 'Quad.easeOut' });
    // Терминал оплаты рядом.
    box(back, x + 30, y + 18, 12, 21, 0xfeae34, 0x8f563b);
    back.fillStyle(0x181425, 1).fillRect(x + 32, y + 20.5, 8, 6);
    const pay = scene.add.rectangle(x + 36, y + 23.5, 7, 5, 0xfee761).setDepth(2.1);
    loop(scene, { targets: pay, alpha: 0.4, duration: 450, yoyo: true, repeatDelay: 300 });
    back.fillStyle(0xf4f8ff, 1).fillRect(x + 33, y + 29, 6, 6);
    for (let i = 0; i < 6; i++) {
      const led = scene.add.rectangle(x + 9 + i * 6.5, y + 12.8, 2, 0.9, 0x8affb0).setDepth(2.1);
      loop(scene, { targets: led, alpha: 0.15, duration: 300, yoyo: true, delay: i * 150 });
    }
    // Столбик с лентой для очереди и фикус.
    g.fillStyle(0xc0cbdc, 1).fillRect(x + 27, y + 38, 1, 6).fillRect(x + 43, y + 38, 1, 6);
    g.fillStyle(0xe43b44, 1).fillRect(x + 27, y + 39, 17, 0.9);
    box(g, x + 48, y + 38, 6, 6, 0xb86f50, 0x5a3420);
    g.fillStyle(0x3e8948, 1).fillCircle(x + 51, y + 34, 4.2);
    g.fillStyle(0x63c74d, 1).fillCircle(x + 50, y + 33, 2);
    return undefined;
  },
};

/** Посетитель арендатора: с улицы через зал в комнату, постоял — и обратно; из пункта выдачи — с посылкой. */
async function visit(scene: StoreScene): Promise<void> {
  const rooms = rentedRooms(scene);
  if (!rooms.length || scene.tenantGuests >= VISITORS) return;
  const world = scene.worldGen;
  const i = Phaser.Math.Between(0, rooms.length - 1);
  const room = rooms[i];
  const id = tenantsOf(scene.state)[i];
  const { door, h } = scene.layout;
  scene.tenantGuests++;
  const guest = persons.makePerson(scene, door.x, h + 14, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  const alive = () => guest.active && scene.worldGen === world;
  const STAND: Partial<Record<TenantId, number>> = { toys: 14, atm: -14, photo: 4, barber: 14 };
  const stand = { x: room.x + room.w / 2 + (STAND[id] ?? 2) + (scene.tenantGuests - 1) * 5, y: room.y + room.h - 6 };
  await persons.walkVia(scene, guest, [{ x: door.x, y: h - 12 }, room.doorway, room.inside, stand]);
  if (alive()) {
    persons.setFacing(guest, 'up');
    await scene.wait(1800);
  }
  if (alive()) {
    if (id === 'pickup') guest.add(scene.add.rectangle(4.5, 3, 5, 4, KRAFT[0]).setStrokeStyle(0.5, 0x5a3420));
    await persons.walkVia(scene, guest, [room.inside, room.doorway, { x: door.x, y: h - 12 }, { x: door.x, y: h + 14 }]);
  }
  if (alive()) await persons.walk(scene, guest, door.x + (Math.random() < 0.5 ? -1 : 1) * 150, scene.streetY);
  // Мир перестроили — счётчик уже обнулён вместе с ним.
  if (scene.worldGen === world) scene.tenantGuests = Math.max(0, scene.tenantGuests - 1);
  if (guest.active) guest.destroy();
}

// ---------- Сезонная площадка у входа (game/tenants.ts, pitchNow) ----------

/** Где встаёт торговец: на нашем тротуаре у бордюра, слева от перехода (или справа), не у фонарного столба. */
function pitchSpot(scene: StoreScene, top: number): { x: number; y: number } {
  const d = scene.layout.door.x;
  // Фонари стоят через 72 от −100 (streets.ts): рядом со столбом тележку не ставим.
  const nearLamp = (x: number) => Math.abs(((((x + 100) % 72) + 72) % 72) - 36) > 24;
  const x = [d - 40, d - 52, d + 40, d + 52, d - 64].find((cx) => !nearLamp(cx)) ?? d - 40;
  return { x, y: top + 19 };
}

/**
 * Сезонный торговец у входа: весной стол с рассадой и цветами, летом тележка с мороженым под полосатым зонтом,
 * осенью ящики с тыквами и тюк сена, зимой ёлочный базар с гирляндой. Рядом — продавец; время от времени над
 * прилавком всплывает значок покупки. Зовётся при постройке улицы (streets.buildStreet), только в Центре.
 */
export function buildPitch(scene: StoreScene, top: number): void {
  const kind = pitchNow(scene.state);
  if (!kind || inZar(scene.state)) return;
  const { x, y } = pitchSpot(scene, top);
  const g = scene.add.graphics().setDepth(y);
  g.fillStyle(0x181425, 0.2).fillEllipse(x, y + 1, 30, 5);
  const seller = (dx: number, shirt: number) => clerk(scene, x + dx, y - 1, shirt, y - 0.5);
  if (kind === 'icecream') {
    // Тележка: белый ящик-морозилка на колёсах, полосатый зонт покачивается.
    box(g, x - 9, y - 9, 18, 8, 0xf4f8ff, 0x5a6988);
    g.fillStyle(0x5fcde4, 1).fillRect(x - 9, y - 5, 18, 1.4);
    g.fillStyle(0xf6757a, 1).fillCircle(x - 4, y - 10.5, 1.8);
    g.fillStyle(0xfee761, 1).fillCircle(x, y - 10.8, 1.8);
    g.fillStyle(0xf4ecd8, 1).fillCircle(x + 4, y - 10.5, 1.8);
    g.fillStyle(0x262b44, 1).fillCircle(x - 6, y, 2).fillCircle(x + 6, y, 2);
    g.fillStyle(0x8b9bb4, 1).fillRect(x - 0.5, y - 26, 1, 17);
    const umbrella = scene.add.graphics().setDepth(y + 1);
    for (let i = 0; i < 6; i++) umbrella.fillStyle(i % 2 ? 0xf4f8ff : 0xf6757a, 1).fillTriangle(x, y - 31, x - 15 + i * 5, y - 23, x - 10 + i * 5, y - 23);
    loop(scene, { targets: umbrella, y: 0.7, duration: 1400, yoyo: true });
    seller(14, 0xf6757a);
  } else if (kind === 'pumpkins') {
    // Ящики с тыквами, тюк сена, табличка.
    box(g, x - 14, y - 6, 12, 6, 0xb86f50, 0x5a3420);
    box(g, x - 1, y - 6, 12, 6, 0xb86f50, 0x5a3420);
    for (const [px, py, r] of [[-11, -8, 2.6], [-6, -8.5, 3], [2, -8.5, 3], [7, -8, 2.6], [-8, -12, 2.4], [5, -12, 2.4]]) {
      g.fillStyle(0xa8491c, 1).fillCircle(x + px, y + py, r + 0.5);
      g.fillStyle(0xf77622, 1).fillCircle(x + px, y + py, r);
      g.fillStyle(0xfeae34, 1).fillRect(x + px - 0.4, y + py - r, 0.8, r * 1.6);
      g.fillStyle(0x3e8948, 1).fillRect(x + px - 0.4, y + py - r - 1.2, 0.8, 1.4);
    }
    box(g, x + 13, y - 5, 8, 5, 0xfee761, 0xb89c3a);
    g.fillStyle(0xd8b848, 1).fillRect(x + 13, y - 3, 8, 0.7);
    seller(-20, 0x8f563b);
  } else if (kind === 'trees') {
    // Ёлочный базар: стойка, ёлки разного роста, гирляндой мигают огоньки.
    g.fillStyle(0x8f563b, 1).fillRect(x - 17, y - 12, 34, 1).fillRect(x - 17, y - 12, 1, 12).fillRect(x + 16, y - 12, 1, 12);
    for (let i = 0; i < 5; i++) {
      const tx = x - 13 + i * 6.5;
      const tall = 13 + (i % 3) * 3;
      g.fillStyle(0x5a3420, 1).fillRect(tx - 0.6, y - 2, 1.2, 2.4);
      for (let k = 0; k < 3; k++) g.fillStyle(k % 2 ? 0x3e8948 : 0x265c42, 1).fillTriangle(tx, y - 2 - tall + k * (tall / 4), tx - 3.4 - k * 0.5, y - 2 - (2 - k) * (tall / 4), tx + 3.4 + k * 0.5, y - 2 - (2 - k) * (tall / 4));
      g.fillStyle(0xf4f8ff, 0.8).fillRect(tx - 1.2, y - 1 - tall + 2, 2.4, 0.8);
    }
    const lights = [0xfee761, 0xe43b44, 0x5fcde4, 0x63c74d];
    for (let i = 0; i < 9; i++) {
      const bulb = scene.add.circle(x - 16 + i * 4, y - 13.4 + (i % 2), 0.9, lights[i % lights.length]).setDepth(y + 1);
      loop(scene, { targets: bulb, alpha: 0.25, duration: 480, yoyo: true, delay: (i % 4) * 140 });
    }
    seller(22, 0x3e8948);
  } else {
    // Весна: стол с рассадой в лотках и вёдра с тюльпанами.
    box(g, x - 13, y - 8, 26, 3, 0xc8955a, 0x5a3420);
    g.fillStyle(0x8f563b, 1).fillRect(x - 12, y - 5, 1.2, 5).fillRect(x + 11, y - 5, 1.2, 5);
    for (let i = 0; i < 4; i++) {
      box(g, x - 12 + i * 6.3, y - 11, 5, 3, 0x5a3420, 0x3b2a35);
      for (let k = 0; k < 3; k++) g.fillStyle(0x63c74d, 1).fillRect(x - 11.4 + i * 6.3 + k * 1.6, y - 13 - (k % 2), 1, 2.2 + (k % 2));
    }
    for (const [bx, color] of [[-19, 0xe43b44], [17, 0xfee761]] as const) {
      box(g, x + bx - 2.5, y - 5, 5, 5, 0x8b9bb4, 0x3a4466);
      for (let k = 0; k < 3; k++) {
        g.fillStyle(0x3e8948, 1).fillRect(x + bx - 1.6 + k * 1.4, y - 9, 0.6, 4);
        g.fillStyle(color, 1).fillCircle(x + bx - 1.3 + k * 1.4, y - 9.6, 1);
      }
    }
    seller(0, 0x63c74d).setY(y - 9);
  }
  // Табличка с названием и время от времени — значок покупки над прилавком.
  scene.add
    .text(x, y - (kind === 'icecream' ? 35 : 22), t(`pitch.${kind}` as TextKey), { fontFamily: UI_FONT, fontSize: '4px', color: '#f4ecd8', backgroundColor: '#3b2a35', padding: { x: 1.5, y: 0.6 } })
    .setOrigin(0.5)
    .setResolution(scene.textRes(8))
    .setDepth(y + 2);
  if (!scene.lite) scene.worldTimer(7000, () => scene.sys.isActive() && scene.running && scene.popup(x, y - 24, PITCH_ICON[kind], '#fff3b0'));
}
