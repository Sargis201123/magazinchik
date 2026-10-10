import { describe, expect, it } from 'vitest';
import { WARDROBE_TEXTURES } from '../src/scenes/wardrobe';

// Картинки гардероба, что лежат в public/assets (vite находит их сам, без node:fs).
const files = Object.keys(import.meta.glob('../public/assets/w_*.png'));

describe('гардероб', () => {
  it('у каждой вещи нарисованы три вида', () => {
    const missing = WARDROBE_TEXTURES.filter((key) => !files.includes(`../public/assets/${key}.png`));
    expect(missing).toEqual([]);
    expect(WARDROBE_TEXTURES.length % 3).toBe(0);
  });
});
