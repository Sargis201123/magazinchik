// Воришка по повадкам — в зале (правила — game/thiefTells.ts). Вор одет как все; его выдаёт поведение:
// оглядывается у полки, подолгу стоит у дорогого, прячет товар в карман, идёт к выходу мимо кассы (runThief в
// shoppers.ts). Бобик рычит на него у входа, камеры на миг берут его в рамку. Касание покупателя в зале —
// подозрение: вор пойман (товар на полку, награда), честный обижен и уходит без покупки.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { returnToShelf, type ProductId } from '../game/economy';
import { noThieves } from '../game/firstday';
import { camTells, offend, OFFENDED_LINES } from '../game/thiefTells';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import type { Customer } from './common';
import type { Facing } from './stride';
import * as persons from './persons';
import * as effects from './effects';
import * as pets from './pets';
import * as camera from './camera';
import * as shoppers from './shoppers';

type ShelfSpot = { x: number; y: number; texture: string; scale: number };

/** Сколько мс смотрит в одну сторону, когда оглядывается: быстро, нервно (очередь оглядывается вдвое медленнее). */
const GLANCE_MS = 260;
/** Бобик чует вора, если тот прошёл у входа не дальше стольких точек от него. */
const GROWL_REACH = 70;

/**
 * Покупателя в зале можно заподозрить касанием: пока он ходит по полкам (browsing) — а вор, пока он в зале.
 * В очереди, у кассы, у кофе и в туалете касание проходит насквозь — к кассе, полке, мусору под ним. Ловится
 * верх фигуры (голова и плечи): мусор и пятна у ног нажимаются, как раньше.
 */
export function suspectable(scene: StoreScene, c: Customer): void {
  const body = new Phaser.Geom.Rectangle(1, 0, 14, 15);
  c.sprite
    .setSize(16, 22)
    .setInteractive({
      hitArea: body,
      hitAreaCallback: (area: Phaser.Geom.Rectangle, x: number, y: number) => area.contains(x, y) && canSuspect(scene, c),
      useHandCursor: true,
    })
    .on('pointerup', () => camera.tap(scene, () => suspect(scene, c)));
}

function canSuspect(scene: StoreScene, c: Customer): boolean {
  const { sprite } = c;
  // В тихие дни новичка воров нет — некого и подозревать (касание честного там было бы наказанием ни за что).
  if (!scene.running || c.gone || !sprite.visible || noThieves(scene.state)) return false;
  // Постоянных и друзей игрок знает в лицо (их встречают по имени) — вором их не считают, касание проходит мимо.
  if (c.regular || c.friend || c.hello) return false;
  return (c.thief || Boolean(c.browsing)) && sprite.y > scene.layout.wallH && sprite.y < scene.layout.h - 2;
}

/** Касание подозреваемого: вор — пойман хозяином; честный — обижается и уходит. */
export function suspect(scene: StoreScene, c: Customer): void {
  if (!canSuspect(scene, c)) return;
  if (c.thief) {
    shoppers.catchThief(scene, c, 'owner');
    return;
  }
  // Честный: кладёт взятое обратно на полку, говорит, что думает, и уходит без покупки.
  c.browsing = false;
  scene.state = returnToShelf(scene.state, c.items);
  c.items = [];
  scene.refreshShelves();
  offend(scene.stats);
  haptic.error();
  sound.bad();
  persons.setMood(scene, c.sprite, 'frown');
  effects.emote(scene, c.sprite, 'emo_angry');
  scene.speak(c.sprite, 16, t(`thief.offended.${Phaser.Math.Between(0, OFFENDED_LINES - 1)}` as TextKey));
  void shoppers.leave(scene, c);
}

/** Оглядывается: голова туда-сюда, times раз, потом снова лицом к полке. Пошёл (или ушёл) — бросает. */
export async function glance(scene: StoreScene, c: Customer, times: number): Promise<void> {
  const p = c.sprite;
  const back = (p.getData('facing') as Facing | undefined) ?? 'up';
  const still = () => p.active && !c.gone && !p.getData('walking');
  for (let i = 0; i < times * 2; i++) {
    if (!still()) return;
    persons.setFacing(p, i % 2 ? 'right' : 'left');
    await scene.wait(GLANCE_MS);
  }
  if (still()) persons.setFacing(p, back);
}

/**
 * Прячет товар в карман: боком к залу, товар с полки — коротко и низко к бедру (а не дугой в руки, как у
 * честных), пропадает; вор похлопывает по карману (два мелких приседания). Ни улыбки, ни цены над полкой.
 * В лёгком режиме — без полёта товара: только поворот и приседания.
 */
export function pocket(scene: StoreScene, c: Customer, from: ShelfSpot | undefined): void {
  const p = c.sprite;
  if (!p.active) return;
  const side = p.x < scene.layout.w / 2 ? 'left' : 'right';
  persons.setFacing(p, side);
  const base = (p.getData('baseScale') as number | undefined) ?? 1;
  scene.tweens.add({ targets: p, scaleY: base * 0.94, duration: 90, yoyo: true, repeat: 1, delay: 180, onComplete: () => p.active && p.setScale(base) });
  if (!scene.lite && from) {
    const item = scene.art(from.x, from.y, from.texture).setScale(from.scale).setDepth(p.y + 1);
    const hip = { x: p.x + (side === 'left' ? -2 : 2), y: p.y + 1 };
    scene.tweens.add({
      targets: item,
      x: hip.x,
      y: hip.y,
      scale: 0,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => item.destroy(),
    });
  }
  camFlash(scene, c, 1);
}

/**
 * Камеры заметили: вокруг вора на миг мигает рамка видоискателя с точкой записи, над головой — значок камеры.
 * level — с каких камер видно: 1 — любые (вор прячет товар), 2 — только лучшие (оглядывается, стоит у дорогого).
 * В лёгком режиме — только значок, без рамки и мигания.
 */
export function camFlash(scene: StoreScene, c: Customer, level: number): void {
  const p = c.sprite;
  if (!p.active || c.gone || camTells(scene.state) < level) return;
  const old = p.getData('camTell') as Phaser.GameObjects.Image[] | undefined;
  old?.forEach((o) => o.destroy());
  const icon = scene.art(0, -15, 'tell_cam');
  const parts = scene.lite ? [icon] : [scene.art(0, -1, 'tell_frame'), icon];
  p.add(parts);
  p.setData('camTell', parts);
  if (scene.lite) {
    scene.time.delayedCall(900, () => icon.destroy());
    return;
  }
  // Мигает тремя вспышками и гаснет — как индикатор записи.
  scene.tweens.add({ targets: parts, alpha: 0, duration: 140, yoyo: true, repeat: 2, hold: 120, onComplete: () => parts.forEach((o) => o.destroy()) });
}

/**
 * Бобик у входа чует воришку: встаёт, рычит и лает в его сторону — «!» над псом и «Р-р-р!». Только если пёс
 * дома (лежит или сидит у будки), а вор прошёл рядом; на прогулке Бобик занят своим.
 */
export function growl(scene: StoreScene, c: Customer): void {
  const dog = scene.bobik;
  if (!dog?.active || scene.closed || !/^bobik_(lie|sit)/.test(dog.texture.key)) return;
  if (Phaser.Math.Distance.Between(dog.x, dog.y, c.sprite.x, c.sprite.y) > GROWL_REACH) return;
  pets.bobikBark(scene);
  // Кадры Бобика смотрят влево: вор правее — разворачиваем.
  dog.setFlipX(c.sprite.x > dog.x);
  scene.time.delayedCall(1400, () => dog.active && dog.setFlipX(false));
  scene.popup(dog.x, dog.y - 16, t('thief.growl'), '#ffd0d0');
}

/** Учебный воришка (thiefTells.trainingThief): подсказка над ним, как только он вошёл (надпись, не его реплика). */
export function teach(scene: StoreScene, c: Customer): void {
  if (c.sprite.active) scene.popup(c.sprite.x, c.sprite.y - 20, t('thief.first'), '#ffd0d0');
}

/** Где на полке лежит то, что сейчас возьмут (до refreshShelves): оттуда товар и полетит в карман. */
export function spotOnShelf(scene: StoreScene, index: number, id: ProductId): ShelfSpot | undefined {
  const img = scene.shelfViews[index]?.items.filter((i) => i.visible && (i.getData('stock') as string | null | undefined)?.startsWith(`${id}:`)).pop();
  return img ? { x: img.x, y: img.y, texture: img.texture.key, scale: img.scaleX } : undefined;
}

/**
 * Вор, о котором стоит сказать подсказкой (и показать весь зал): уже взялся за своё у полки. Не с порога — иначе
 * подсказка выдавала бы его: «кто сейчас вошёл, тот и вор».
 */
export const sneakingThief = (scene: StoreScene): Customer | undefined => [...scene.customers].find((c) => c.thief && c.browsing && !c.gone);

