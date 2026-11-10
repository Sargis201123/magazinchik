// Комнаты арендаторов во флигеле (game/tenants.ts): над кухней и кофейней. Свободная комната — тёмная, с
// табличкой «Сдаётся»; занятая — со своей обстановкой и работником, из зала в неё заходят посетители
// (из пункта выдачи выходят с посылкой). Места комнат — layout.ts (tenants), двери и свет — как у остальных
// комнат флигеля (building.openRooms). В Заречье комнат нет.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t, type TextKey } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { tenantsLook, tenantsOf, type TenantId } from '../game/tenants';
import { inZar } from '../game/zarshop';
import { ART, SHIRTS, WALL, customerLook, randomLook } from './common';
import { WING_OUTER, type Room } from './layout';
import * as building from './building';
import * as persons from './persons';

/** Сколько посетителей арендаторов ходит по залу сразу. */
const VISITORS = 2;
const KRAFT = [0xc8955a, 0xb07a45, 0xd8a868];
/** Пол и стена комнаты по арендатору. */
const TONE: Record<TenantId, { floor: number; wall: number }> = {
  pickup: { floor: 0xdfe6f5, wall: 0xdce4f6 },
  pharmacy: { floor: 0xe6fff0, wall: 0xd8f0e0 },
  repair: { floor: 0xf0e2c8, wall: 0xf0dcc0 },
  toys: { floor: 0xfff0d8, wall: 0xffe2ea },
};

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
  if (!scene.lite && who.length) scene.worldTimer(6500, () => scene.sys.isActive() && scene.running && void visit(scene));
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
  FURNISH[id](scene, room, g, back);
}

type Draw = Phaser.GameObjects.Graphics;

/** Ящик с тёмной кромкой снизу и справа — мебель «в один цвет» выглядела бы наклейкой. */
function box(g: Draw, x: number, y: number, w: number, h: number, color: number, edge = 0x262b44): void {
  g.fillStyle(edge, 1).fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
  g.fillStyle(color, 1).fillRect(x, y, w, h);
  g.fillStyle(0x181425, 0.18).fillRect(x, y + h - 1, w, 1).fillRect(x + w - 1, y, 1, h);
}

/** Работник за стойкой: стоит на месте, в общий список людей не идёт. */
function clerk(scene: StoreScene, x: number, y: number, shirt: number, depth: number, facing: 'down' | 'up' = 'down'): void {
  const man = persons.makePerson(scene, x, y, { ...randomLook(shirt), shirt });
  scene.people.delete(man);
  persons.setFacing(man, facing);
  man.setDepth(depth);
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

const FURNISH: Record<TenantId, (scene: StoreScene, room: Room, g: Draw, back: Draw) => void> = {
  // Пункт выдачи: стеллаж с посылками, стойка со сканером, коробки у стены.
  pickup: (scene, { x, y }, g, back) => {
    wallShelf(back, x + 4, y + 13, 40, KRAFT, 'pickup-a');
    wallShelf(back, x + 4, y + 20, 40, [...KRAFT, 0xd8e8f8], 'pickup-b');
    clerk(scene, x + 22, y + 27, 0xf77622, y + 29);
    box(g, x + 6, y + 32, 34, 7, 0x8b9bb4);
    g.fillStyle(0xf77622, 1).fillRect(x + 6, y + 36, 34, 1.5);
    box(g, x + 30, y + 29.5, 5, 3, 0x262b44);
    g.fillStyle(0x2ce8f5, 1).fillRect(x + 31, y + 30, 3, 1.5);
    box(g, x + 46, y + 38, 8, 6, KRAFT[0], 0x5a3420);
    box(g, x + 49, y + 33, 6, 5, KRAFT[1], 0x5a3420);
    g.fillStyle(0xe8d0a8, 1).fillRect(x + 49.5, y + 38, 1, 6).fillRect(x + 51.5, y + 33, 1, 5);
  },
  // Аптека: зелёный крест, полки с лекарствами, белая витрина.
  pharmacy: (scene, { x, y }, g, back) => {
    back.fillStyle(0xffffff, 1).fillCircle(x + 10, y + 7, 4.5);
    back.fillStyle(0x3e8948, 1).fillRect(x + 9, y + 4, 2, 6).fillRect(x + 7, y + 6, 6, 2);
    wallShelf(back, x + 4, y + 13, 40, [0xffffff, 0x5fcde4, 0xf6757a, 0x63c74d], 'pharm-a');
    wallShelf(back, x + 4, y + 20, 40, [0xffffff, 0xfee761, 0x5fcde4, 0xb55088], 'pharm-b');
    clerk(scene, x + 24, y + 27, 0xffffff, y + 29);
    box(g, x + 6, y + 32, 36, 7, 0xf4f8ff, 0x5a6988);
    g.fillStyle(0x9cd8ff, 0.9).fillRect(x + 7, y + 34, 34, 4);
    for (let i = 0; i < 6; i++) g.fillStyle([0xe43b44, 0x63c74d, 0xfee761][i % 3], 1).fillRect(x + 9 + i * 5.5, y + 35.5, 3, 2);
    box(g, x + 47, y + 36, 7, 8, 0x3e8948, 0x265c42);
    g.fillStyle(0x63c74d, 1).fillCircle(x + 50.5, y + 34, 4);
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
    back.fillStyle(0xfee761, 0.5).fillTriangle(x + 34, y + 13.5, x + 29, y + 22, x + 38, y + 22);
    clerk(scene, x + 22, y + 30, 0x3a4466, y + 36, 'up');
    box(g, x + 46, y + 37, 8, 7, 0x8b9bb4);
    g.fillStyle(0xe43b44, 1).fillRect(x + 47, y + 39, 6, 1.5);
  },
  // Автомат с игрушками и шарики-жвачки: работает сам, у автомата стоит ребёнок.
  toys: (scene, { x, y }, g, back) => {
    const toys = [0xf6757a, 0xfee761, 0x63c74d, 0x5fcde4, 0xb55088, 0xfeae34];
    box(back, x + 8, y + 15, 18, 24, 0xe43b44, 0x6e1a2c);
    back.fillStyle(0x9cd8ff, 0.9).fillRect(x + 9.5, y + 16.5, 15, 13);
    const rnd = new Phaser.Math.RandomDataGenerator(['toys']);
    for (let i = 0; i < 12; i++) back.fillStyle(rnd.pick(toys), 1).fillCircle(x + 11 + rnd.frac() * 12, y + 25.5 + rnd.frac() * 3, 1.5);
    back.fillStyle(0x5a6988, 1).fillRect(x + 16.5, y + 16.5, 0.8, 5).fillRect(x + 15, y + 21, 4, 1);
    back.fillStyle(0xfee761, 1).fillRect(x + 9.5, y + 31, 15, 3);
    back.fillStyle(0x262b44, 1).fillRect(x + 13, y + 31.5, 1.5, 2).fillRect(x + 20, y + 35, 4, 3);
    // Автомат с шариками.
    box(back, x + 36, y + 28, 8, 10, 0xe43b44, 0x6e1a2c);
    back.fillStyle(0xd8f0f8, 1).fillCircle(x + 40, y + 23, 5.5);
    for (let i = 0; i < 9; i++) back.fillStyle(rnd.pick(toys), 1).fillCircle(x + 37 + rnd.frac() * 6, y + 21.5 + rnd.frac() * 5, 1.1);
    back.lineStyle(0.6, 0x262b44, 1).strokeCircle(x + 40, y + 23, 5.5);
    // Коврик-классики на полу.
    for (let i = 0; i < 4; i++) g.fillStyle(toys[i], 0.85).fillRect(x + 45 + (i % 2) * 5, y + 36 + Math.floor(i / 2) * 5, 4.5, 4.5);
    const kid = persons.makePerson(scene, x + 17, y + 41, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
    scene.people.delete(kid);
    persons.setFacing(kid, 'up');
    kid.setScale(0.82).setDepth(y + 47);
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
  const stand = { x: room.x + room.w / 2 + (id === 'toys' ? 14 : 2), y: room.y + room.h - 6 };
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
