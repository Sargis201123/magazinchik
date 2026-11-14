// Подвал в виде этажа (game/basement.ts, 13.11; 14.11 — своим модулем на общей основе floors/kit.ts, вид не менялся):
// кирпич, бетонный пол, лестница сверху слева, автоматы у задней стены (их экраны мигают; в лёгкой графике горят
// ровно), у автоматов — завсегдатаи (меняются: кто-то уходит наверх, кто-то спускается), справа — склад-холодильник,
// внизу справа — «серая» подсобка с полкой «Разное» ломбарда. После облавы на месте автоматов — лента с печатью.

import Phaser from 'phaser';
import { basementOf, raidLock, slotPlaces, slotsPlan } from '../../game/basement';
import { pawnOf } from '../../game/pawnshop';
import { t } from '../../i18n';
import { sound } from '../../platform/sound';
import { SHIRTS, customerLook } from '../common';
import * as persons from '../persons';
import { bulb, chalkSpot, lightPool, prop, shell, type FloorKit } from './kit';

/** Места автоматов у задней стены (середины) и где стоит тот, кто играет. */
const SLOT_X = [50, 72, 94, 116];
const PLAYER_DY = 11;
/** Как часто у автомата меняется человек (мс). */
const SWAP_EVERY = 5200;

export function buildBasement(kit: FloorKit): void {
  const { scene, store, W, H, WALL, lite } = kit;
  const state = store.state;
  const SLOT_Y = WALL + 6;
  /** Низ лестницы: отсюда спускаются и сюда уходят завсегдатаи. */
  const STAIRS_FOOT = { x: 22, y: WALL + 8 };
  const players: (Phaser.GameObjects.Container | null)[] = [];
  shell(kit, { wall: 'bsm_brick', floor: 'bsm_floor', side: 0x181425, sideW: 5, strips: [[WALL, 2, 0x181425, 0.6]] });
  prop(kit, 5, 0, 'bsm_stairs', { ox: 0, oy: 0, depth: 2 });
  kit.text(W / 2 + 14, 9, `🪜 ${t('floor.basement')}`, 7, '#fee761').setDepth(1);
  const b = basementOf(state);
  const plan = slotsPlan(state);
  const n = b?.slots ?? 0;
  // Автоматы у задней стены; экран мигает (в лёгкой графике — горит ровно), под ним — отсвет на полу.
  for (let i = 0; i < n; i++) {
    const x = SLOT_X[i];
    const glow = lightPool(kit, x, SLOT_Y + 4, { w: 22, h: 12, tint: 0x2ce8f5, alpha: 0.25, depth: SLOT_Y - 1 });
    const slot = prop(kit, x, SLOT_Y, 'bsm_slot');
    const lit = prop(kit, x, SLOT_Y, 'bsm_slot_lit', { depth: SLOT_Y + 0.1 });
    if (!lite) scene.tweens.add({ targets: [lit, glow], alpha: { from: 1, to: 0.45 }, duration: 380 + i * 70, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3], delay: i * 160 });
    slot.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      sound.tap();
      if (plan) kit.popup(x, SLOT_Y - 26, t('bsm.tap', { n: plan.players, sum: plan.income - plan.share }));
    });
  }
  // Свободные места под автоматы — меловой контур на полу; после облавы — лента с печатью.
  const places = slotPlaces(state);
  for (let i = n; i < places; i++) chalkSpot(kit, SLOT_X[i], SLOT_Y - 1, 12, 4, 0x8b9bb4, 0.6);
  if (raidLock(state)) kit.art((SLOT_X[0] + SLOT_X[places - 1]) / 2, SLOT_Y - 12, 'grey_seal').setDepth(SLOT_Y + 1);
  // Склад-холодильник — у правой стены, иней светится холодным.
  if (b?.parts?.includes('cold')) {
    prop(kit, W - 26, SLOT_Y, 'bsm_cold');
    // Перед холодильником — поддон с водой: склад магазина теперь и здесь.
    prop(kit, W - 26, SLOT_Y + 24, 'pallet_water', { scale: 0.7 });
    lightPool(kit, W - 26, SLOT_Y + 3, { w: 26, h: 10, tint: 0x9cd8ff, alpha: 0.25, depth: SLOT_Y - 1 });
  }
  if (b?.parts?.includes('back')) buildBack(kit, W - 42, H - 34);
  if (!n && !b?.parts?.length) kit.text(W / 2 + 10, WALL + 60, t('bsm.empty'), 6, '#8b9bb4').setDepth(5);
  // Своя жизнь подвала: трубы вдоль левой стены, старые коробки в углу, лужица под трубой.
  scene.add.rectangle(7, WALL, 1.6, H - WALL, 0x5a6988).setOrigin(0).setDepth(-6);
  scene.add.rectangle(10, WALL, 1.2, H - WALL, 0x3a4466).setOrigin(0).setDepth(-6);
  scene.add.ellipse(16, H - 70, 14, 4, 0x3a4466, 0.7).setDepth(-6);
  for (const [x, y] of [[24, H - 22], [38, H - 20], [30, H - 30]] as const) prop(kit, x, y, 'box');
  // Стол, за которым завсегдатаи пьют чай между заходами, и огнетушитель на стене у лестницы.
  prop(kit, 70, 136, 'cafe_table');
  kit.art(40, 30, 'extinguisher').setDepth(1);
  // Лампочки: под потолком у стены — на шнурах, дальше по залу — голые лампы; вокруг — тёплый круг света.
  for (const [x, y, cord] of [[40, 16, true], [84, 16, true], [128, 16, true], [56, 120, false], [118, 170, false]] as const) bulb(kit, x, y, cord);
  // Тёмный низ: подвал освещён пятнами, не ровно.
  scene.add.rectangle(0, H - 40, W, 40, 0x181425, 0.35).setOrigin(0).setDepth(18);

  /** Человек у автомата — спиной к нам, лицом к экрану. */
  const player = (x: number, y: number): Phaser.GameObjects.Container => {
    const man = kit.person(x, y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), state.day)).setDepth(y);
    persons.setFacing(man, 'up');
    return man;
  };
  /** Один уходит к лестнице и тает, другой спускается и встаёт к свободному автомату. */
  const swap = (): void => {
    if (kit.leaving()) return;
    const i = Phaser.Math.Between(0, n - 1);
    const old = players[i];
    if (old?.active) {
      players[i] = null;
      persons.setFacing(old, 'left');
      scene.tweens.add({ targets: old, x: STAIRS_FOOT.x + 8, y: STAIRS_FOOT.y + 2, duration: 1800, ease: 'Linear' });
      scene.tweens.add({ targets: old, alpha: 0, delay: 1500, duration: 400, onComplete: () => old.destroy() });
      return;
    }
    const man = player(STAIRS_FOOT.x, STAIRS_FOOT.y - 18);
    man.setAlpha(0);
    persons.setFacing(man, 'down');
    players[i] = man;
    scene.tweens.add({ targets: man, alpha: 1, duration: 300 });
    scene.tweens.add({
      targets: man,
      y: STAIRS_FOOT.y + 2,
      duration: 900,
      onComplete: () => {
        if (!man.active) return;
        persons.setFacing(man, 'right');
        scene.tweens.add({ targets: man, x: SLOT_X[i], y: SLOT_Y + PLAYER_DY, duration: 1600, onComplete: () => man.active && persons.setFacing(man, 'up') });
      },
    });
  };
  // Завсегдатаи у автоматов: сколько сегодня придёт, но не больше мест.
  const busy = Math.min(n, plan?.players ?? 0);
  for (let i = 0; i < busy; i++) players[i] = player(SLOT_X[i], SLOT_Y + PLAYER_DY);
  if (!lite && n) scene.time.addEvent({ delay: SWAP_EVERY, loop: true, callback: swap });
}

/** «Серая» подсобка: перегородка, занавеска, на полке — вещи ломбарда (на продажу — с ценником). */
function buildBack(kit: FloorKit, x: number, bottom: number): void {
  prop(kit, x, bottom, 'bsm_back');
  const p = pawnOf(kit.store.state);
  const things = [...p.shelf.map((s) => ({ id: s.item, sale: true })), ...p.loans.map((l) => ({ id: l.item, sale: false }))];
  const left = x - 18 + 13;
  const rows = [bottom - 26 + 8, bottom - 26 + 17];
  things.slice(0, 12).forEach((thing, k) => {
    const ix = left + (k % 6) * 4.6;
    const iy = rows[Math.floor(k / 6)];
    prop(kit, ix, iy, `pawn_${thing.id}`, { depth: bottom + 0.1 + k * 0.01 });
    if (thing.sale) kit.art(ix + 2, iy - 4, 'pawn_tag').setDepth(bottom + 0.3);
  });
}
