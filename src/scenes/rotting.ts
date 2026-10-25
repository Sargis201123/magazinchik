// Гниющий мусор в зале (правила — src/game/rot.ts): тёмная картинка «_rot», мухи кружат над ним,
// зелёная вонь колышется. Мухи двигаются по синусу от времени сцены — без твинов, поэтому их не
// жалко и перестройке зала (декор умирает вместе с мусором). На слабом телефоне (lite) — одна
// неподвижная муха и неподвижная вонь.

import Phaser from 'phaser';
import type { RotStage } from '../game/rot';

/** Во сколько раз пиксели спрайта мельче точек мира (как ART в StoreScene). */
const ART = 2;
/** Цвет лужи, которая прокисла. */
const SOUR = 0x9aa860;

interface Decor {
  flies: Phaser.GameObjects.Image[];
  stink?: Phaser.GameObjects.Image;
  /** Сдвиг фазы, чтобы мухи над разным мусором летали вразнобой. */
  phase: number;
  /** Откуда мухи и вонь поднимаются. */
  x: number;
  y: number;
  /** Насколько широко кружат. */
  r: number;
}

export class Rotting {
  private decor = new Map<Phaser.GameObjects.Image, Decor>();
  /** Мухи над переполненным ведром. */
  private binFlies: Decor | null = null;

  constructor(
    private scene: Phaser.Scene,
    private lite: () => boolean,
  ) {}

  /**
   * Мусор дошёл до стадии гниения: подменить картинку и добавить мух и вонь (на второй стадии —
   * больше мух и вонь гуще). Лужа (картинка без «_rot») прокисает тинтом.
   */
  apply(piece: Phaser.GameObjects.Image, stage: RotStage, depth: number): void {
    if (!stage || !piece.active) return;
    const base = piece.getData('base') as string | undefined;
    if (base && this.scene.textures.exists(`${base}_rot`)) piece.setTexture(`${base}_rot`);
    else piece.setTint(SOUR);
    const old = this.decor.get(piece);
    old?.flies.forEach((f) => f.destroy());
    old?.stink?.destroy();
    const lite = this.lite();
    const count = lite ? 1 : stage + 1;
    const flies = Array.from({ length: count }, () => this.scene.add.image(piece.x, piece.y - 6, 'fly').setScale(1 / ART).setDepth(depth + 2));
    const stink = this.scene.add
      .image(piece.x, piece.y - 7, 'rot_stink')
      .setScale((stage === 2 ? 1.1 : 0.8) / ART)
      .setAlpha(stage === 2 ? 0.85 : 0.6)
      .setDepth(depth + 1);
    const d: Decor = { flies, stink, phase: Math.random() * Math.PI * 2, x: piece.x, y: piece.y - 5, r: piece.displayWidth / 2 + 2 };
    this.decor.set(piece, d);
    if (!piece.getData('rotHooked')) {
      piece.setData('rotHooked', true);
      piece.once('destroy', () => this.drop(piece));
    }
    this.tick(this.scene.time.now);
  }

  /** Мухи над переполненным ведром (null — ведро вынесли, мухи улетают). */
  bin(at: { x: number; y: number } | null, depth: number): void {
    if (!at) {
      this.binFlies?.flies.forEach((f) => f.destroy());
      this.binFlies = null;
      return;
    }
    if (this.binFlies) return;
    const count = this.lite() ? 1 : 2;
    const flies = Array.from({ length: count }, () => this.scene.add.image(at.x, at.y, 'fly').setScale(1 / ART).setDepth(depth));
    this.binFlies = { flies, phase: Math.random() * Math.PI * 2, x: at.x, y: at.y, r: 7 };
  }

  /** Каждый кадр: мухи выписывают восьмёрки, вонь колышется. */
  tick(now: number): void {
    const lite = this.lite();
    for (const d of this.binFlies ? [...this.decor.values(), this.binFlies] : this.decor.values()) {
      d.flies.forEach((f, i) => {
        if (lite) {
          f.setPosition(d.x + 2, d.y - 3);
          return;
        }
        const a = now / (260 + i * 70) + d.phase + i * 2.1;
        // Мелкое дрожание — как будто машет крылышками.
        const buzz = Math.sin(now / 23 + i) * 0.4;
        f.setPosition(d.x + Math.sin(a) * d.r, d.y - 4 + Math.sin(a * 2) * 2.5 + buzz).setFlipX(Math.cos(a) < 0);
      });
      if (d.stink && !lite) d.stink.setY(d.y - 3 + Math.sin(now / 420 + d.phase) * 1.2);
    }
  }

  /** Всё стёрто (перестройка зала, конец дня). */
  clear(): void {
    for (const piece of [...this.decor.keys()]) this.drop(piece);
    this.bin(null, 0);
  }

  private drop(piece: Phaser.GameObjects.Image): void {
    const d = this.decor.get(piece);
    if (!d) return;
    d.flies.forEach((f) => f.destroy());
    d.stink?.destroy();
    this.decor.delete(piece);
  }
}
