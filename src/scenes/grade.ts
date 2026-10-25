// Цветокоррекция по времени суток и погоде — как фильтры в Instagram, только сменяют друг друга плавно:
// персиковое утро, чистый полдень, золотой час, синие сумерки, ночь; дождь приглушает и холодит, снег —
// светлый и голубой. Раньше было два прохода по всему экрану (тёплый тон ColorMatrix и виньетка), а больше
// половины дня картинка не менялась вовсе. Теперь — один проход: одна матрица цвета, которая плавно
// переходит между ключевыми «фильтрами». Виньетка — в высокой графике, не отдельным проходом, а картинкой
// поверх мира. В лёгкой графике прохода нет совсем: оттенок часа ложится в карту освещения (scenes/light.ts).
//
// Сами фильтры и матрица — чистые функции (scenes/daylight.ts); с Phaser говорит только ColorGrade, и только
// через встроенный ColorMatrix камеры — переезд на Phaser 4 затронет лишь его.

import Phaser from 'phaser';
import type { Weather } from '../game/weather';
import { gradeAt, gradeMatrix, gradeTint } from './daylight';

export type GradeTier = 'lite' | 'normal' | 'high';

/** Виньетка: мягкое затемнение к краям кадра, к вечеру гуще (только в высокой графике). */
const VIGNETTE_KEY = 'vignette';

/**
 * Цветокоррекция камеры: один проход ColorMatrix (не в лёгкой графике) и виньетка-картинка (в высокой).
 * attach() — при каждой постройке мира (старая виньетка уничтожена вместе с миром), apply() — когда сдвинулся
 * час (матрица меняется, только когда фильтр заметно сдвинулся), update() — каждый кадр: виньетка под кадр.
 */
export class ColorGrade {
  private fx?: Phaser.FX.ColorMatrix;
  private vignette?: Phaser.GameObjects.Image;
  private applied = '';
  /** Под какой кадр (масштаб и размер камеры) виньетка растянута. */
  private placed = '';
  /** Насколько вечер: виньетка к вечеру гуще. */
  private evening = 0;

  constructor(
    private scene: Phaser.Scene,
    private tier: GradeTier,
  ) {}

  /** Проход на камеру и виньетка поверх мира (depth — её слой). */
  attach(depth: number): void {
    const cam = this.scene.cameras.main;
    cam.postFX?.clear();
    this.fx = this.tier === 'lite' ? undefined : (cam.postFX?.addColorMatrix() ?? undefined);
    this.applied = '';
    this.vignette = undefined;
    this.placed = '';
    if (this.tier !== 'high') return;
    this.vignetteTexture();
    this.vignette = this.scene.add.image(0, 0, VIGNETTE_KEY).setScrollFactor(0).setDepth(depth).setAlpha(0);
  }

  /** Игра сама понизила графику: в обычной нет виньетки, в лёгкой — и прохода. */
  setTier(tier: GradeTier): void {
    this.tier = tier;
    if (tier !== 'high') {
      this.vignette?.destroy();
      this.vignette = undefined;
    }
    if (tier === 'lite' && this.fx) {
      this.scene.cameras.main.postFX?.remove(this.fx as unknown as Phaser.FX.Controller);
      this.fx = undefined;
    }
  }

  /**
   * Оттенок часа для карты освещения: в лёгкой графике прохода нет, и баланс белого фильтра ложится в карту
   * (умножением); в обычной и высокой — белый, цвет делает сам проход.
   */
  tint(p: number, weather: Weather): number {
    return this.tier === 'lite' ? gradeTint(gradeAt(p, weather)) : 0xffffff;
  }

  /** Фильтр часа и погоды; evening (0…1) — насколько вечер: виньетка гуще. */
  apply(p: number, weather: Weather, evening: number): void {
    this.evening = evening;
    if (!this.fx) return;
    const grade = gradeAt(p, weather);
    const matrix = gradeMatrix(grade);
    // Матрицу трогаем, только если она сдвинулась на заметную долю (1/400 в каждом числе).
    const key = matrix.map((v, i) => Math.round((i % 5 === 4 ? v / 255 : v) * 400)).join(',');
    if (key === this.applied) return;
    this.applied = key;
    this.fx.set(matrix);
  }

  /** Каждый кадр: виньетка — по кадру камеры (её приближают пальцами, на титуле она дальше). */
  update(): void {
    const img = this.vignette;
    if (!img?.active) return;
    const cam = this.scene.cameras.main;
    // Картинка не едет за камерой (scrollFactor 0), но масштаб камеры её растягивает — делим на него.
    const key = `${cam.zoom}/${cam.width}/${cam.height}`;
    if (key !== this.placed) {
      this.placed = key;
      img.setPosition(cam.width / 2, cam.height / 2).setDisplaySize(cam.width / cam.zoom + 2, cam.height / cam.zoom + 2);
    }
    img.setAlpha(0.35 + 0.5 * this.evening);
  }

  /** Текстура виньетки: прозрачная середина, к углам — тёмная; рисуется один раз на всю игру. */
  private vignetteTexture(): void {
    const textures = this.scene.textures;
    if (textures.exists(VIGNETTE_KEY)) return;
    const size = 64;
    const tex = textures.createCanvas(VIGNETTE_KEY, size, size);
    const ctx = tex?.getContext();
    if (!tex || !ctx) return;
    const data = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // 0 в середине, 1 в углу.
        const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) / Math.SQRT1_2;
        const a = Math.min(1, Math.max(0, (d - 0.55) / 0.45));
        const i = (y * size + x) * 4;
        data.data[i] = 0x18;
        data.data[i + 1] = 0x14;
        data.data[i + 2] = 0x25;
        data.data[i + 3] = Math.round(255 * 0.45 * a * a);
      }
    }
    ctx.putImageData(data, 0, 0);
    tex.refresh();
    // Виньетка — плавная: растягиваем сглаженно.
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
