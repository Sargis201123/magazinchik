import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { StoreScene, WORLD_H, WORLD_W } from './scenes/StoreScene';
import { initTelegram } from './platform/telegram';

const BG = '#1d1a26';

initTelegram(BG);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: BG,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_W * 2,
    height: WORLD_H * 2,
  },
  scene: [BootScene, StoreScene],
});
