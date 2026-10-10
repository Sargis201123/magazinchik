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

describe('редкие гости и образы', () => {
  it('у редких гостей только нарисованные вещи', async () => {
    const { RARE_GUESTS } = await import('../src/game/endless');
    const { HATS, OUTFITS, PROPS, FACES, BACKS } = await import('../src/scenes/wardrobe');
    const known: Record<string, readonly string[]> = { hat: HATS, outfit: OUTFITS, prop: PROPS, face: FACES, back: BACKS };
    for (const guest of RARE_GUESTS) {
      for (const kind of Object.keys(known)) {
        const item = (guest.look as unknown as Record<string, string | undefined>)[kind];
        if (item) expect(known[kind], `${guest.id}: ${kind} ${item}`).toContain(item);
      }
    }
    expect(new Set(RARE_GUESTS.map((g) => g.id)).size).toBe(18);
  });

  it('образы покупателей: зимние — только в холода, летние — только в тепло', async () => {
    const { ARCHETYPES, pickWear, wearSeason } = await import('../src/scenes/archetypes');
    expect(ARCHETYPES.length).toBeGreaterThanOrEqual(30);
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const winterDay = Array.from({ length: 200 }, (_, i) => i + 1).find((d) => wearSeason(d) === 'cold')!;
    const springDay = Array.from({ length: 200 }, (_, i) => i + 1).find((d) => wearSeason(d) === null)!;
    const seen = (day: number) => new Set(Array.from({ length: 600 }, () => pickWear(day, random).id));
    expect(seen(winterDay).has('fur_lady')).toBe(true);
    expect(seen(winterDay).has('beach')).toBe(false);
    expect(seen(springDay).has('fur_lady')).toBe(false);
    expect(seen(springDay).size).toBeGreaterThan(25);
  });
});
