import Phaser from 'phaser';

// Временная графика рисуется кодом, чтобы не зависеть от файлов.
// Когда подключим бесплатный пиксельный набор, здесь будет обычная загрузка спрайтов.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const g = this.add.graphics();
    const make = (key: string, w: number, h: number, draw: () => void) => {
      g.clear();
      draw();
      g.generateTexture(key, w, h);
    };

    make('floor', 16, 16, () => {
      g.fillStyle(0xcbb89d).fillRect(0, 0, 16, 16);
      g.fillStyle(0xbba88c).fillRect(0, 0, 8, 8).fillRect(8, 8, 8, 8);
    });
    make('wall', 16, 16, () => {
      g.fillStyle(0x6d8a9c).fillRect(0, 0, 16, 16);
      g.fillStyle(0x5a7486).fillRect(0, 12, 16, 4);
      g.fillStyle(0x7f9cae).fillRect(0, 0, 16, 2);
    });
    make('shelf', 40, 26, () => {
      g.fillStyle(0x6b4a2f).fillRect(0, 0, 40, 26);
      g.fillStyle(0x8a6240).fillRect(2, 2, 36, 10).fillRect(2, 14, 36, 10);
    });
    make('register', 28, 22, () => {
      g.fillStyle(0x4a3b52).fillRect(0, 8, 28, 14);
      g.fillStyle(0x7d6a8a).fillRect(0, 8, 28, 3);
      g.fillStyle(0x2b2233).fillRect(14, 0, 12, 9);
      g.fillStyle(0x8fd16a).fillRect(16, 2, 8, 4);
    });
    make('door', 32, 6, () => {
      g.fillStyle(0x8a6240).fillRect(0, 0, 32, 6);
      g.fillStyle(0xa47a52).fillRect(2, 1, 28, 4);
    });
    make('item', 4, 5, () => {
      g.fillStyle(0xffffff).fillRect(0, 0, 4, 5);
    });
    make('cust_body', 10, 10, () => {
      g.fillStyle(0xffffff).fillRect(1, 0, 8, 7);
      g.fillStyle(0x3a3247).fillRect(1, 7, 3, 3).fillRect(6, 7, 3, 3);
    });
    make('cust_head', 8, 8, () => {
      g.fillStyle(0xffffff).fillRect(0, 0, 8, 8);
      g.fillStyle(0x2b2233).fillRect(2, 3, 1, 2).fillRect(5, 3, 1, 2);
    });
    make('bubble', 7, 7, () => {
      g.fillStyle(0xffffff).fillCircle(3.5, 3.5, 3.5);
    });

    g.destroy();
    this.scene.start('store');
  }
}
