import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CANVAS_H, CANVAS_W, StoreScene } from './scenes/StoreScene';
import { initTelegram } from './platform/telegram';

const BG = '#1d1a26';

initTelegram(BG);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: BG,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: CANVAS_W,
    height: CANVAS_H,
  },
  scene: [BootScene, StoreScene],
});

// Отладка: ?debug открывает доступ к игре из консоли браузера.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { game });
