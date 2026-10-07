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
    // Касса стоит боком: длинная стойка с лентой, терминал в конце — как в супермаркете.
    make('counter', 16, 52, () => {
      g.fillStyle(0x4a3b52).fillRect(0, 0, 16, 52);
      g.fillStyle(0x7d6a8a).fillRect(0, 0, 16, 2).fillRect(0, 0, 2, 52);
      g.fillStyle(0x2b2233).fillRect(3, 3, 10, 30);
      g.fillStyle(0x3f3a48);
      for (let y = 5; y < 33; y += 4) g.fillRect(3, y, 10, 1);
      g.fillStyle(0x2b2233).fillRect(5, 37, 9, 11);
      g.fillStyle(0x8fd16a).fillRect(7, 39, 5, 4);
    });
    make('wc', 16, 24, () => {
      g.fillStyle(0x4a3b52).fillRect(0, 0, 16, 24);
      g.fillStyle(0x9badb7).fillRect(2, 2, 12, 22);
      g.fillStyle(0x2b2233).fillRect(11, 13, 2, 2);
      g.fillStyle(0xffffff).fillRect(4, 5, 8, 5);
      g.fillStyle(0x5b6ee1).fillRect(5, 6, 2, 3);
      g.fillStyle(0xd95763).fillRect(9, 6, 2, 3);
    });
    make('trash', 6, 5, () => {
      g.fillStyle(0xffffff).fillRect(0, 1, 5, 3).fillRect(2, 0, 4, 2);
      g.fillStyle(0x2b2233).fillRect(1, 2, 1, 1);
    });
    make('bar', 1, 1, () => {
      g.fillStyle(0xffffff).fillRect(0, 0, 1, 1);
    });
    make('door', 32, 6, () => {
      g.fillStyle(0x8a6240).fillRect(0, 0, 32, 6);
      g.fillStyle(0xa47a52).fillRect(2, 1, 28, 4);
    });
    make('stand', 40, 26, () => {
      g.fillStyle(0x4b692f).fillRect(0, 0, 40, 26);
      g.fillStyle(0x8a6240).fillRect(2, 2, 36, 10).fillRect(2, 14, 36, 10);
      g.fillStyle(0x6b4a2f);
      for (let x = 2; x < 38; x += 6) g.fillRect(x, 2, 1, 22);
    });
    // Холодильник: нейтральный, цвет задаём тинтом (молочный — голубой, мясной — розовый).
    make('fridge', 40, 26, () => {
      g.fillStyle(0xe6eef2).fillRect(0, 0, 40, 26);
      g.fillStyle(0x9badb7).fillRect(2, 2, 36, 10).fillRect(2, 14, 36, 10);
      g.fillStyle(0xffffff).fillRect(2, 2, 36, 1).fillRect(2, 14, 36, 1);
    });
    make('box', 8, 7, () => {
      g.fillStyle(0xc8a878).fillRect(0, 0, 8, 7);
      g.fillStyle(0xffffff).fillRect(1, 1, 6, 2);
      g.fillStyle(0x8a6240).fillRect(0, 3, 8, 1);
    });
    make('pip', 2, 2, () => {
      g.fillStyle(0xf2c14e).fillRect(0, 0, 2, 2);
    });
    make('item', 3, 4, () => {
      g.fillStyle(0xffffff).fillRect(0, 0, 3, 4);
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
