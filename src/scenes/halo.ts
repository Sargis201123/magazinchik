// Ореол «нажми сюда» (пустая полка, полное ведро, щиток без света, мусор на полу, готовый хлеб, звонящий
// телефон) и свечение людей (неон кибер-костюма, вор, редкий гость). Раньше каждое такое свечение было
// эффектом Phaser (Glow) на своём предмете — отдельный проход отрисовки через свой буфер на каждый предмет.
// Теперь это нарисованная картинка (halo из art/light.py) за предметом: рисуется в общей пачке со всем миром.
// Девятичастная (NineSlice): растягивается под размер полки или ведра, а ширина свечения одна и та же.
// Наложение обычное, не сложение: жёлтый ореол на светлом полу сложением выгорел бы в белый и пропал.

import Phaser from 'phaser';

/** Край ореола в точках картинки halo, который не растягивается (HALO_EDGE в art/light.py). */
const EDGE = 10;
/** Картинка ореола вдвое детальнее мира (как все спрайты, ART в StoreScene). */
const SCALE = 0.5;
/** На сколько точек мира свечение выходит за край предмета (HALO_FALL в art/light.py — вдвое больше). */
const PAD = 4;

/** Свечение вокруг предмета: сила 0 — не видно (и не рисуется). */
export class Halo {
  readonly img: Phaser.GameObjects.NineSlice;

  constructor(
    scene: Phaser.Scene,
    private target: Phaser.GameObjects.Image,
    color: number,
  ) {
    this.img = scene.add.nineslice(target.x, target.y, 'halo', undefined, 2 * EDGE + 4, 2 * EDGE + 4, EDGE, EDGE, EDGE, EDGE);
    this.img.setScale(SCALE).setTint(color).setVisible(false);
    // Вместе с предметом исчезает и его ореол.
    target.once(Phaser.GameObjects.Events.DESTROY, () => this.img.destroy());
    this.fit();
  }

  /** Встать за предмет и по его размеру (предмет мог переехать, подрасти — скажем, звонящий телефон). */
  fit(): void {
    const t = this.target;
    const w = t.displayWidth + 2 * PAD;
    const h = t.displayHeight + 2 * PAD;
    const cx = t.x + (0.5 - t.originX) * t.displayWidth;
    const cy = t.y + (0.5 - t.originY) * t.displayHeight;
    this.img.setPosition(cx, cy).setDepth(t.depth - 0.01);
    const sw = Math.max(2 * EDGE + 4, w / SCALE);
    const sh = Math.max(2 * EDGE + 4, h / SCALE);
    if (this.img.width !== sw || this.img.height !== sh) this.img.setSize(sw, sh);
  }

  /** Сила как у прежнего эффекта (0…3, пульс 0,3–2,7): 0 — ореола нет. Ярче — гуще. */
  set(strength: number): void {
    const img = this.img;
    if (!img.active) return;
    if (strength <= 0) {
      if (img.visible) img.setVisible(false);
      return;
    }
    this.fit();
    if (!img.visible) img.setVisible(true);
    img.setAlpha(Math.min(0.9, 0.3 + strength * 0.22));
  }
}

/**
 * Свечение человека (контейнер из слоёв одежды): мягкое цветное пятно за фигурой, внутри контейнера — ходит
 * вместе с ним. strength — как у прежнего эффекта (2–3 — заметно).
 */
export function personGlow(scene: Phaser.Scene, person: Phaser.GameObjects.Container, color: number, strength: number): Phaser.GameObjects.Image {
  const glow = scene.add.image(0, -1, 'glow').setDisplaySize(20, 28).setTint(color).setAlpha(Math.min(0.85, 0.25 + strength * 0.18));
  person.addAt(glow, 0);
  return glow;
}
