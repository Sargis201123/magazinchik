import { describe, expect, it } from 'vitest';
import { UI_ITEMS, uiIconKey } from '../src/ui/sheet';
import { atlasKeysFrom } from '../src/scenes/textures';
import { PRODUCTS } from '../src/game/economy';

// Картинки в public/assets — как их видит сборка (без node:fs).
const files = Object.keys(import.meta.glob('../public/assets/*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, ''));

describe('детальные значки товаров в окнах (art/ui_items.py)', () => {
  it('у каждого товара из UI_ITEMS есть картинка uiitem_<товар>, и это настоящий товар', () => {
    for (const pid of UI_ITEMS) {
      expect(files).toContain(`uiitem_${pid}`);
      expect(Object.keys(PRODUCTS)).toContain(pid);
    }
    expect(files.filter((f) => f.startsWith('uiitem_')).sort()).toEqual(UI_ITEMS.map((p) => `uiitem_${p}`).sort());
  });

  it('окна берут детальный значок, остальные товары и мир — как были', () => {
    expect(uiIconKey('item_bread')).toBe('uiitem_bread');
    expect(uiIconKey('item_fish_0')).toBe('uiitem_fish');
    expect(uiIconKey('item_apples')).toBe('item_apples');
    expect(uiIconKey('coin')).toBe('coin');
  });

  it('в атлас мира детальные значки не попадают (это картинки только для окон)', () => {
    expect([...atlasKeysFrom(files)].some((k) => k.startsWith('uiitem_'))).toBe(false);
  });
});
