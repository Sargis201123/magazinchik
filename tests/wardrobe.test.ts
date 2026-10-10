import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WARDROBE_TEXTURES } from '../src/scenes/wardrobe';

describe('гардероб', () => {
  it('у каждой вещи нарисованы три вида', () => {
    const missing = WARDROBE_TEXTURES.filter((key) => !existsSync(`public/assets/${key}.png`));
    expect(missing).toEqual([]);
    expect(WARDROBE_TEXTURES.length % 3).toBe(0);
  });
});
