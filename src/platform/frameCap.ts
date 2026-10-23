// Сколько кадров рисовать. Экран на 90/120 Гц — игра всё равно не быстрее 60 кадров (телефон не
// греется и не садится зря); под окном во весь экран (утро, итоги, закупка) — 30: зал там лишь фон.
// Пока Telegram свёрнут, не рисуем вовсе. Пропускаем целые шаги игры: следующий получит промежуток
// побольше — всё движется с той же скоростью, только реже обновляется.

import Phaser from 'phaser';
import { FAST_SCREEN_MS, Pacer } from './pacing';
import { onAppActive } from './telegram';

const pacer = new Pacer();
/** Окно во весь экран открыто (проверяем 4 раза в секунду, а не каждый кадр). */
let covered = false;
let checkedAt = -Infinity;
/** Telegram свернули. */
let asleep = false;

/** Открыто окно поверх зала (а не спрятано на время сцены, как при расширении). */
function modalOpen(): boolean {
  for (const modal of document.querySelectorAll<HTMLElement>('.ui-modal:not(.closing)')) {
    if (modal.style.visibility !== 'hidden') return true;
  }
  return false;
}

/** Кадры сейчас реже обычного (окно поверх зала, приложение свёрнуто): такие замеры FPS не в счёт. */
export const framesThrottled = (): boolean => covered || asleep;

/** Встроить ограничение в цикл Phaser — до создания игры (main.ts). */
export function installFrameCap(): void {
  const proto = Phaser.Core.TimeStep.prototype;
  const step = proto.step;
  proto.step = function (this: Phaser.Core.TimeStep, time: number): void {
    if (asleep) return;
    if (time - checkedAt > 250) {
      checkedAt = time;
      covered = modalOpen();
    }
    const interval = covered ? 1000 / 30 : pacer.screenMs < FAST_SCREEN_MS ? 1000 / 60 : 0;
    if (pacer.step(time, interval)) step.call(this, time);
  };
  onAppActive((active) => {
    asleep = !active;
  });
  // Если «вернули» не придёт, игра не должна застыть: оживает от касания и когда вкладка снова видна.
  const wake = (): void => {
    asleep = false;
  };
  document.addEventListener('pointerdown', wake, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake();
  });
}
