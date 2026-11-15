// Момент этажа на виду (правила — game/floorLife.ts, расписание — floors/life.ts; 15.11). Модуль этажа ставит сценку
// (кто и где: покупатель машет из примерочной, автомат заело, буян у стойки), здесь — общее для всех: значок над
// ним с золотым кольцом-таймером (сжимается, пока момент ждёт), касание — награда, строка и развязка сценки;
// не успел или ушёл с этажа — сценка тихо убирается. Как моменты зала (scenes/moments.ts), только на этаже.
// В лёгкой графике значок не прыгает. Без тряски. Грузится вместе с видом этажа.

import Phaser from 'phaser';
import { t, type TextKey } from '../../i18n';
import { sound } from '../../platform/sound';
import { haptic } from '../../platform/telegram';
import type { FloorMomentKind, LifeFloor } from '../../game/floorLife';
import { floorLeft, floorWaiting, onFloorLife, takeFloorMoment } from './life';
import type { FloorKit } from './kit';

/** Поверх людей, мебели и света этажа, под всплывающими строками. */
const DEPTH = 1900;
const GOLD = 0xfee761;
/** Зона касания вокруг значка (точки мира): палец, а не мышь. */
const HIT = 26;

/** Что модуль этажа делает для момента. */
export interface MomentStage {
  /** Поставить сценку; вернуть, над кем (чем) висит значок, какой значок и на сколько выше точки. null — некому. */
  start(kind: FloorMomentKind): { target: { x: number; y: number; active: boolean }; icon: string; dy: number } | null;
  /** Поймали: развязка сценки (награда уже в кассе). */
  caught(kind: FloorMomentKind): void;
  /** Не поймали — окно прошло, пока игрок на этаже: сценка расходится. */
  missed(kind: FloorMomentKind): void;
}

export function floorMoments(kit: FloorKit, floor: LifeFloor, stage: MomentStage): void {
  const { scene, store } = kit;
  let active: { kind: FloorMomentKind; target: { x: number; y: number; active: boolean }; dy: number; icon: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics } | null = null;
  let taken = false;

  const clear = (): void => {
    if (!active) return;
    active.icon.destroy();
    active.ring.destroy();
    active = null;
  };

  const begin = (): void => {
    const m = floorWaiting();
    if (active || !m || m.floor !== floor || kit.leaving()) return;
    const set = stage.start(m.kind);
    // Некому сейчас (примерочные заняты) — попробовать чуть позже, пока момент ждёт.
    if (!set) return void scene.time.delayedCall(1000, begin);
    taken = false;
    // Значок крупнее эмоций людей (их рисуют в половину): его ищут глазами среди толпы.
    const icon = kit.art(set.target.x, set.target.y - set.dy, set.icon).setScale(0.75).setDepth(DEPTH + 1);
    // Касание — по значку с запасом HIT точек мира (в пикселях рисунка: значок — 0,75 точки на пиксель).
    const half = HIT / 2 / 0.75;
    icon.setInteractive(new Phaser.Geom.Rectangle(icon.width / 2 - half, icon.height / 2 - half, half * 2, half * 2), Phaser.Geom.Rectangle.Contains);
    icon.input!.cursor = 'pointer';
    icon.on('pointerup', () => {
      if (!active) return;
      const kind = active.kind;
      const at = { x: active.icon.x, y: active.icon.y };
      // Сначала — «наше касание»: награда тут же оповещает подписчиков (change), и сценка не должна уйти как пропущенная.
      taken = true;
      const gain = takeFloorMoment(store);
      if (!gain) return;
      clear();
      if (gain.money > 0) sound.coin();
      else sound.good();
      haptic.tap();
      kit.popup(at.x, at.y - 4, t(`flm.${kind}.got` as TextKey, { n: gain.money }), { color: '#fee761', depth: DEPTH + 10, hold: 2200 });
      stage.caught(kind);
    });
    const ring = scene.add.graphics().setDepth(DEPTH);
    active = { kind: m.kind, target: set.target, dy: set.dy, icon, ring };
    if (!kit.lite) scene.tweens.add({ targets: icon, scale: icon.scale * 1.18, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  };

  /** Каждый кадр: значок следует за героем сценки, кольцо сжимается. */
  const follow = (): void => {
    if (!active) return;
    const a = active;
    if (!a.target.active) return;
    a.icon.setPosition(a.target.x, a.target.y - a.dy);
    a.ring.clear();
    a.ring.fillStyle(0x181425, 0.55);
    a.ring.fillCircle(a.icon.x, a.icon.y, 6.5);
    a.ring.lineStyle(1, GOLD, 0.95);
    a.ring.beginPath();
    a.ring.arc(a.icon.x, a.icon.y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * floorLeft(store), false);
    a.ring.strokePath();
  };

  const change = (): void => {
    const m = floorWaiting();
    if (active && (!m || m.floor !== floor)) {
      // Момент кончился не нашим касанием — окно прошло: сценка уходит.
      const kind = active.kind;
      clear();
      if (!taken) stage.missed(kind);
      return;
    }
    begin();
  };

  const off = onFloorLife(change);
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    off();
    scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
    // Ушли с этажа — момент ещё ждёт (кнопка этажа засветится); сценка гаснет вместе со сценой (её картинки уже
    // разбираются — развязку не играем).
    active = null;
  });
  // Пришли, когда момент уже ждёт, — ставим сразу (чуть погодя: пусть кадр этажа сначала проявится).
  scene.time.delayedCall(500, begin);
}
