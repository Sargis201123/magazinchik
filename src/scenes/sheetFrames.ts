// Кадры листов атласа под старыми именами картинок (BootScene — мир, pixelFx.loadSheets — эффекты).

import Phaser from 'phaser';

/**
 * Текстура-кадр общего листа атласа под старым именем ('shelf', 'p_legs1_s'…). Своей картинки
 * у неё нет: источник — лист, поэтому и в видеокарте это одна текстура на всех, и соседние спрайты
 * рисуются одной пачкой, а this.art(), setTexture() и texture.key работают как с отдельной картинкой.
 */
export class SheetFrame extends Phaser.Textures.Texture {
  constructor(manager: Phaser.Textures.TextureManager, key: string, sheet: Phaser.Textures.Texture, frame: Phaser.Textures.Frame) {
    super(manager, key, []);
    this.source.push(sheet.source[0]);
    const base = this.add('__BASE', 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
    // Кадр со срезанными пустыми краями (кадры эффектов fx_*, scripts/atlas.ts): полный размер и место
    // вырезки — те же, что в листе, иначе спрайт сместится и сменит размер.
    if (frame.trimmed && base) base.setTrim(frame.realWidth, frame.realHeight, frame.x, frame.y, frame.cutWidth, frame.cutHeight);
  }

  /** Лист общий: убрать одну текстуру — не повод освобождать его в видеокарте. */
  destroy(): void {
    this.source = [];
    super.destroy();
  }
}

/** Разложить лист атласа обратно по именам: каждая картинка мира — текстура со своим ключом. */
export function spreadSheet(textures: Phaser.Textures.TextureManager, name: string): void {
  const sheet = textures.get(name);
  const list = textures.list as Record<string, Phaser.Textures.Texture>;
  for (const key of sheet.getFrameNames()) {
    if (!textures.exists(key)) list[key] = new SheetFrame(textures, key, sheet, sheet.get(key));
  }
}
