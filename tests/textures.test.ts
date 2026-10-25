import { describe, expect, it } from 'vitest';
import { atlasKeysFrom, FAMILIES } from '../src/scenes/textures';
import { TEXTURES } from '../src/scenes/worldTextures';

// Картинки, что лежат в public/assets (vite находит их сам, без node:fs) — как их видит сборка атласа.
const files = Object.keys(import.meta.glob('../public/assets/*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, ''));

describe('список картинок атласа', () => {
  it('сборка (по именам файлов) кладёт в атлас ровно то, что ждёт игра (по своим данным)', () => {
    expect([...atlasKeysFrom(files)].sort()).toEqual([...TEXTURES].sort());
  });

  it('семейства по началу имени не задевают обычные спрайты', () => {
    const families = TEXTURES.filter((key) => FAMILIES.some((re) => re.test(key)));
    expect(families.every((key) => /^(item_|crate_|w_)/.test(key))).toBe(true);
    expect(families.length).toBeGreaterThan(300);
  });
});
