// Холст ровно по пикселям экрана (scenes/pixels.ts). Раньше холст был фиксированного размера и браузер
// растягивал его в дробное число раз (1170 пикселей iPhone из 1080) — пиксели рисунка выходили разной
// ширины. Теперь размер холста считается при запуске и заново, когда окно меняется: Telegram
// развернулся или ушёл в полный экран, повернули планшет, изменили масштаб в браузере.

import Phaser from 'phaser';
import { canvasCap, fitCanvas, type CanvasFit } from '../scenes/pixels';
import { quality } from './quality';
import { onViewportChanged } from './telegram';

/** Сколько окно должно не меняться, чтобы подогнать холст (мс). */
const SETTLE_MS = 120;

/** Предел ширины по уровню графики — на весь запуск: понижение графики меняет холст со следующего (как и раньше). */
let cap = 0;

/** Какой холст нужен сейчас: по области #game (100vw × 100dvh) и плотности экрана. */
export function measureCanvas(): CanvasFit {
  cap ||= canvasCap(quality());
  const box = document.getElementById('game')?.getBoundingClientRect();
  return fitCanvas(box?.width || window.innerWidth, box?.height || window.innerHeight, window.devicePixelRatio || 1, cap);
}

/** Размер холста на странице и отступы; ширина игры — для панелей интерфейса (--game-w в ui/dom.ts). */
function placeCanvas(canvas: HTMLCanvasElement, fit: CanvasFit): void {
  const style = canvas.style;
  style.width = `${fit.cssWidth}px`;
  style.height = `${fit.cssHeight}px`;
  style.marginLeft = `${fit.left}px`;
  style.marginTop = `${fit.top}px`;
  document.documentElement.style.setProperty('--game-w', `${fit.cssWidth}px`);
}

/**
 * Поставить холст на место и следить за окном. Поменялся нужный размер — меняем сам холст
 * (game.scale.resize), сцена по событию resize заново ставит камеру (StoreScene.onResize).
 */
export function watchScreen(game: Phaser.Game): void {
  let timer = 0;
  const check = (): void => {
    timer = 0;
    if (!game.canvas) return;
    const fit = measureCanvas();
    placeCanvas(game.canvas, fit);
    // Phaser пересчитает, куда попадает палец (по положению холста на странице).
    if (fit.width !== game.scale.width || fit.height !== game.scale.height) game.scale.resize(fit.width, fit.height);
    else game.scale.refresh();
  };
  // Пока Telegram разворачивается (или шторку тянут пальцем), размер меняется каждый кадр — холст
  // подгоняем, когда окно затихло: пересоздавать его на каждом кадре дорого.
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(check, SETTLE_MS);
  };
  // Игра обычно уже запущена (страница загружена); если нет — когда все её части готовы.
  if (game.isBooted) check();
  else game.events.once(Phaser.Core.Events.READY, check);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  onViewportChanged(schedule);
}
