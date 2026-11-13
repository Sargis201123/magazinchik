// Улика «Дела недели» в зале (правила — game/cases.ts, доска — ui/cases.ts). В день улики посреди смены — короткий
// момент со значком: покупатель обронил чек (у ног гостя), камера над входом что-то сняла, Бобик принёс находку
// (нет Бобика — она лежит у порога), постоянный проговорился у кассы (значок над первым в очереди). Голубое
// кольцо-таймер — не золотое, как у моментов: это не чаевые, а дело. Нажал — улика чёткая; не успел — тает без
// штрафа, а утром улика всё равно придёт, только размытая. Улика — одна из просьб бюджета внимания дня
// (game/attention.ts): в этот день на звонок или момент меньше. Ждёт, пока зал свободен (окно, звонок, сценка,
// момент); на слабом телефоне (lite) — без покачивания и искр. Без тряски камеры.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { t, type TextKey } from '../i18n';
import { CASES, clueToday, openCaseOf, takeClue, type ClueSrc } from '../game/cases';
import { DAY_SECONDS } from '../game/economy';
import { inZar } from '../game/zarechye';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import * as camera from './camera';
import * as effects from './effects';
import * as liveFx from './liveFx';

/** Сколько улика ждёт нажатия, мс настоящего времени (чуть дольше момента: её надо заметить и понять). */
const WINDOW_MS = 6000;
/** Зал занят дольше стольких секунд дня — улика сегодня не покажется (придёт утром, размытая). */
const PATIENCE = 20;
const DEPTH = 899;
const CYAN = 0x2ce8f5;
const HIT = 30;
const ICON: Record<ClueSrc, string> = { receipt: 'clue_receipt', camera: 'clue_camera', find: 'clue_find', talk: 'clue_talk' };

export interface ClueRun {
  n: number;
  /** На какой секунде дня. */
  at: number;
  phase: 'wait' | 'shown' | 'done';
  left: number;
  objs: Phaser.GameObjects.GameObject[];
  icon?: Phaser.GameObjects.Image;
  ring?: Phaser.GameObjects.Graphics;
  follow?: Phaser.GameObjects.Container;
  pos: { x: number; y: number };
  size: number;
}

/** Утро: ждёт ли сегодня улика в зале (для бюджета внимания). В Заречье — нет: дело — в своём районе. */
export const clueWanted = (scene: StoreScene): boolean => !inZar(scene.state) && clueToday(scene.state) !== null;

/** Утро: улика на сегодня, если бюджет внимания дал ей место. Время — для сцены, игре всё равно. */
export function armClue(scene: StoreScene, allowed: boolean): void {
  endClue(scene);
  const n = allowed ? clueToday(scene.state) : null;
  scene.clue = n === null ? null : { n, at: DAY_SECONDS * Phaser.Math.FloatBetween(0.25, 0.45), phase: 'wait', left: WINDOW_MS, objs: [], pos: { x: 0, y: 0 }, size: 1 };
}

/** Каждый кадр дня: пора — показать (если зал свободен), показанная — отсчитать и вести за гостем. */
export function tickClue(scene: StoreScene, elapsed: number, realMs: number): void {
  const c = scene.clue;
  if (!c || c.phase === 'done') return;
  const busy = liveFx.momentBlocked(scene) || scene.moments.showing || scene.skit?.phase === 'here' || scene.timeLeft <= 0;
  if (c.phase === 'wait') {
    if (elapsed < c.at) return;
    if (elapsed > c.at + PATIENCE) c.phase = 'done';
    else if (!busy) show(scene, c);
    return;
  }
  if (c.follow) {
    if (!c.follow.active || !c.follow.visible) c.left = 0;
    else c.pos = { x: c.follow.x, y: c.follow.y - 24 };
    c.icon?.setPosition(c.pos.x, c.pos.y);
  }
  if (!busy) c.left -= realMs;
  drawRing(scene, c);
  if (c.left <= 0) fade(scene, c);
}

/** Конец дня или перестройка зала: показанная улика тает (утром придёт размытой). */
export function endClue(scene: StoreScene): void {
  const c = scene.clue;
  if (c?.phase === 'shown') fade(scene, c);
}

function show(scene: StoreScene, c: ClueRun): void {
  const open = openCaseOf(scene.state);
  if (!open) {
    c.phase = 'done';
    return;
  }
  const src = CASES[open.id].clues[c.n].src;
  const { door } = scene.layout;
  const guest = liveFx.momentGuest(scene);
  const first = scene.queue.find((q) => !q.gone && !q.thief && q.sprite.active)?.sprite ?? null;
  let label: TextKey = `case.hall.${src}`;
  c.follow = undefined;
  if (src === 'receipt') {
    const p = guest ?? liveFx.freeFloorPoint(scene);
    c.pos = { x: p.x + Phaser.Math.Between(-8, 8), y: p.y + 10 };
  } else if (src === 'camera') c.pos = { x: door.x + 18, y: door.y - 28 };
  else if (src === 'find') {
    // Бобик принёс находку — значок над ним; нет Бобика — находка лежит у порога.
    const dog = scene.bobik?.active && scene.bobik.visible ? scene.bobik : null;
    c.pos = dog ? { x: dog.x, y: dog.y - 16 } : { x: door.x - 16, y: door.y - 14 };
    if (!dog) label = 'case.hall.door';
  } else {
    c.follow = first ?? guest ?? undefined;
    c.pos = c.follow ? { x: c.follow.x, y: c.follow.y - 24 } : { x: door.x, y: door.y - 30 };
  }
  // На дальнем плане (большой магазин целиком) значок крупнее — палец попадает всегда (как у моментов).
  const cam = scene.cameras.main;
  const canvas = scene.game.canvas;
  const css = (cam.zoom * (canvas.clientWidth || canvas.width)) / canvas.width;
  c.size = Phaser.Math.Clamp(1.8 / css, 1, 3);
  const scale = c.size / 2;
  const icon = scene.add.image(c.pos.x, c.pos.y, ICON[src]).setScale(scale * 0.3).setDepth(DEPTH);
  const ring = scene.add.graphics().setDepth(DEPTH - 1);
  const local = Math.max(HIT, 52 / css) / scale;
  icon.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(icon.width / 2 - local / 2, icon.height / 2 - local / 2, local, local),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });
  icon.on('pointerup', () => camera.tap(scene, () => take(scene, c)));
  scene.tweens.add({ targets: icon, scale, duration: 240, ease: 'Back.easeOut' });
  if (!scene.lite) scene.tweens.add({ targets: icon, angle: { from: -7, to: 7 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 });
  if (c.follow) effects.emote(scene, c.follow, 'emo_alert');
  c.phase = 'shown';
  c.icon = icon;
  c.ring = ring;
  c.objs = [icon, ring];
  c.left = WINDOW_MS;
  scene.popup(c.pos.x, c.pos.y - 14 * c.size, t(label), '#c8f0ff');
  sound.tap();
  drawRing(scene, c);
}

function drawRing(scene: StoreScene, c: ClueRun): void {
  if (!c.ring?.active) return;
  const share = Math.max(0, c.left / WINDOW_MS);
  const r = (10 + (scene.lite ? 0 : Math.sin(scene.time.now / 170) * 0.8)) * c.size;
  c.ring.clear();
  c.ring.lineStyle(2.5 * c.size, 0x181425, 0.55).strokeCircle(c.pos.x, c.pos.y, r);
  c.ring.lineStyle(1.5 * c.size, CYAN, 1).beginPath();
  c.ring.arc(c.pos.x, c.pos.y, r, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2, false).strokePath();
}

function take(scene: StoreScene, c: ClueRun): void {
  if (c.phase !== 'shown' || !c.icon) return;
  c.phase = 'done';
  scene.state = takeClue(scene.state, c.n);
  const icon = c.icon;
  icon.disableInteractive();
  c.ring?.destroy();
  haptic.success();
  sound.good();
  scene.popup(c.pos.x, c.pos.y - 16 * c.size, t('case.hall.got'), '#c8f0ff');
  if (!scene.lite) {
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      const dot = scene.add.rectangle(c.pos.x, c.pos.y, 2 * c.size, 2 * c.size, CYAN).setDepth(DEPTH + 2);
      scene.tweens.add({ targets: dot, x: c.pos.x + Math.cos(a) * 12 * c.size, y: c.pos.y + Math.sin(a) * 12 * c.size, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => dot.destroy() });
    }
  }
  scene.tweens.killTweensOf(icon);
  scene.tweens.add({ targets: icon, y: c.pos.y - 12 * c.size, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => icon.destroy() });
}

function fade(scene: StoreScene, c: ClueRun): void {
  c.phase = 'done';
  c.ring?.destroy();
  const icon = c.icon;
  if (!icon?.active) return;
  icon.disableInteractive();
  scene.tweens.killTweensOf(icon);
  scene.tweens.add({ targets: icon, alpha: 0, duration: 400, onComplete: () => icon.destroy() });
}
