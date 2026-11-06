import { describe, expect, it } from 'vitest';
import { FX_SHEETS, FX_TEXTURES, fxFrames, type FxKey } from '../src/scenes/fxSheets';

// Кадры pixelfx (scripts/fx-bake.mjs; что каждая точка — из палитры игры, проверяет сам скрипт при запекании).
// Картинки, что лежат в public/assets (vite находит их сам, без node:fs).
const files = new Set(Object.keys(import.meta.glob('../public/assets/fx_*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, '')));

describe('пиксельные эффекты pixelfx', () => {
  it('кадры всех эффектов на месте, лишних нет', () => {
    expect([...files].sort()).toEqual([...FX_TEXTURES].sort());
  });

  it('у каждого эффекта есть кадры, частота и точка отсчёта в кадре', () => {
    for (const key of Object.keys(FX_SHEETS) as FxKey[]) {
      const s = FX_SHEETS[key];
      expect(fxFrames(key).length, key).toBeGreaterThan(1);
      expect(s.fps, key).toBeGreaterThan(0);
      expect(s.ox >= 0 && s.ox <= 1 && s.oy >= 0 && s.oy <= 1.5, key).toBe(true);
      expect(Number.isInteger(s.down), key).toBe(true);
    }
  });
});
