// «Улица друзей» (game/street.ts) в мире: домики магазинов настоящих друзей вдоль аллеи за дорогой —
// между зданиями района (streets.ts, buildDistrict) и парком. Вывеска — название их магазина и их
// премиальная доска, домик — по помещению, в витринах свет, если друг играл сегодня. Касание домика —
// карточка друга (ui/street.ts); друзей ещё нет — участок «Сдаётся» зовёт пригласить. Всё — неподвижные
// картинки, нарисованные раз при сборке мира; кадр за кадром ничего не считается.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { STORE_LEVELS } from '../game/economy';
import { decorItem } from '../game/decor';
import { litToday, streetKey, type StreetFriend } from '../game/street';
import { savingPaused } from '../game/save';
import { streetInfo } from '../platform/multiplayer';
import { inviteFriends } from '../platform/social';
import { haptic } from '../platform/telegram';
import { track } from '../platform/analytics';
import { t } from '../i18n';
import { toast, UI_FONT } from '../ui/dom';
import { showStreetCard } from '../ui/street';
import { STREET_TAP_MS } from './common';
import * as camera from './camera';
import * as lighting from './lighting';

/** Места домиков: середины между фонарями аллеи (они через 96 от −520, buildPark) — фонари в просветах. */
const SLOT_X = [-88, 8, 104, 200, 296];
/** Ширина домика по помещению (art/friend_street.py, LEVELS) — в точках мира. */
const SHOP_W = [44, 50, 56, 60, 64, 68];
/** Высота полосы фасада у домиков — вывеска над ней, на краю крыши. */
const FACADE = 12;
/** Цвет доски вывески по помещению, если премиальной нет (как навесы на домиках). */
const SIGN_TINT = [0xa22633, 0x3e8948, 0x124e89, 0xb86f50, 0x68386c, 0x262b44];

/**
 * Домики друзей (или участок «Сдаётся») на северной стороне аллеи парка. Возвращает место ряда —
 * всегда одно и то же, есть друзья или нет, чтобы сквер не сажал туда деревья (когда список придёт
 * позже, мир перестроится — и деревья не встанут поперёк домиков).
 */
export function buildFriendStreet(scene: StoreScene, top: number): { x: number; y: number; w: number; h: number }[] {
  const alley = top + 268;
  const bottom = alley - 2;
  const area = { x: SLOT_X[0] - 40, y: bottom - 44, w: SLOT_X[SLOT_X.length - 1] - SLOT_X[0] + 80, h: 44 };
  const list = streetInfo();
  scene.builtStreet = streetKey(list);
  // В гостях у друга (rivals.ts) на улице — не наши друзья: ряд пустой.
  if (!list || savingPaused()) return [area];
  if (!list.length) {
    buildLot(scene, SLOT_X[2], bottom);
    return [area];
  }
  const first = Math.floor((SLOT_X.length - list.length) / 2);
  list.forEach((f, i) => buildShop(scene, f, SLOT_X[first + i], bottom));
  return [area];
}

/** Домик друга: здание, вывеска с названием, свет в витринах; касание — карточка. */
function buildShop(scene: StoreScene, f: StreetFriend, x: number, bottom: number): void {
  const level = Math.max(0, Math.min(STORE_LEVELS.length - 1, f.level));
  const w = SHOP_W[level] ?? SHOP_W[0];
  const house = scene.art(x, bottom, `fshop_${level}`).setOrigin(0.5, 1).setDepth(bottom - 6);
  // Тень домика на газоне — вправо, как у соседей.
  scene.add.rectangle(x + w / 2, bottom - house.displayHeight + 6, 5, house.displayHeight - 6, 0x181425, 0.16).setOrigin(0).setDepth(-9.4);
  if (litToday(f)) {
    const lit = scene.art(x, bottom, `fshop_${level}_lit`).setOrigin(0.5, 1).setDepth(bottom - 5.5).setAlpha(0.85);
    // Свет в окнах чуть дышит — живые люди внутри. В лёгкой графике — просто горит.
    if (!scene.lite) scene.tweens.add({ targets: lit, alpha: 0.6, duration: Phaser.Math.Between(2200, 3200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Вечером из витрин на аллею падает тёплый свет.
    lighting.nightGlow(scene, scene.art(x, bottom + 2, 'glow').setDisplaySize(w + 10, 16).setTint(0xffd08a), 0.4);
  }
  // Вывеска: премиальная доска друга или своя по помещению; название — его магазина или «У Маши».
  const deco = f.sign ? decorItem(f.sign) : undefined;
  const signY = bottom - FACADE - 6;
  const plate = scene.art(x, signY, deco?.texture ?? 'sign').setDisplaySize(w - 6, 9).setDepth(bottom - 5);
  if (!deco) plate.setTint(SIGN_TINT[level] ?? SIGN_TINT[0]);
  const label = scene.add
    .text(x, signY, f.shop || t('street.sign', { name: f.name }), { fontFamily: UI_FONT, fontSize: '5px', color: `#${(deco?.textColor ?? 0xfee761).toString(16).padStart(6, '0')}` })
    .setOrigin(0.5)
    .setResolution(scene.textRes(5))
    .setDepth(bottom - 4.9);
  // Длинное название сжимается, чтобы не вылезти за доску.
  if (label.width > w - 10) label.setScale((w - 10) / label.width);
  onShortTap(scene, house, () => {
    haptic.tap();
    track('street_card', scene.state.day, level);
    showStreetCard(f, scene.state, () => planVisit(scene, f));
  });
}

/** Нет друзей: пустой участок со щитом «Сдаётся — пригласи друга»; касание — приглашение (Telegram «Поделиться»). */
function buildLot(scene: StoreScene, x: number, bottom: number): void {
  const lot = scene.art(x, bottom, 'fshop_lot').setOrigin(0.5, 1).setDepth(bottom - 6);
  // Щит нарисован в верхней части участка (art/friend_street.py): середина — на 25 выше низа.
  const text = (y: number, s: string, size: string, color: string) => {
    const label = scene.add.text(x, y, s, { fontFamily: UI_FONT, fontSize: size, color, fontStyle: 'bold' }).setOrigin(0.5).setResolution(scene.textRes(6)).setDepth(bottom - 5);
    if (label.width > 33) label.setScale(33 / label.width);
  };
  text(bottom - 28.5, t('street.lot.title'), '5px', '#a22633');
  text(bottom - 22, t('street.lot.text'), '3.5px', '#3b2a35');
  onShortTap(scene, lot, () => {
    haptic.tap();
    track('street_invite', scene.state.day);
    void inviteFriends(t('social.share'));
  });
}

/** Короткое касание без сдвига камеры: щипок и перетаскивание квартала работают как раньше. */
function onShortTap(scene: StoreScene, obj: Phaser.GameObjects.Image, action: () => void): void {
  obj.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
    if (scene.arranging || p.upTime - p.downTime > STREET_TAP_MS) return;
    camera.tap(scene, action);
  });
}

/**
 * «Зайти в гости» с улицы. Гости смотрят чужой магазин вместо своего (rivals.visitFriend), а свой в это
 * время стоит — поэтому идём утром, до открытия: утреннее окно предложит зайти первым делом.
 */
function planVisit(scene: StoreScene, f: StreetFriend): void {
  scene.pendingVisit = { id: f.id, name: f.name };
  toast('assets/ico_gift.png', t('street.visit.title'), t('street.visit.later', { name: f.name }));
}
