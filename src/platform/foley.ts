// Записанные звуки действий без WebAudio: из чего сделан товар на полке, чем расплатился покупатель
// и на сколько кодек сдвинул ленту звуков. Чистые функции — их проверяют тесты (tests/foley.test.ts),
// а samples.ts и sound.ts только играют то, что решено здесь.

import type { Category } from '../game/economy';

/** Чем звучит товар, встающий на полку. */
export type Material = 'glass' | 'tin' | 'bump' | 'soft' | 'box' | 'paper';

/**
 * Отдел → материал: бутылки звенят, банки и флаконы стучат, хлеб ложится мягко, коробки шуршат картоном,
 * фрукты и картошка глухо стукают, мясо и цветы шуршат бумагой (молоко — в стеклянных бутылках, как раньше).
 */
export const MATERIAL: Record<Category, Material> = {
  bakery: 'soft',
  produce: 'bump',
  dairy: 'glass',
  meat: 'paper',
  drinks: 'glass',
  frozen: 'box',
  household: 'tin',
  icebox: 'paper',
  florist: 'paper',
};

/** С такой покупки платят бумажками — касса шуршит купюрами, а не звенит мелочью. */
export const NOTES_FROM = 300;

export const payWith = (total: number): 'notes' | 'coin' => (total >= NOTES_FROM ? 'notes' : 'coin');

/** Каждый следующий товар на полке — на полтона выше, но не выше чем на кварту. */
export const placeRate = (n: number): number => 2 ** (Math.min(Math.max(n, 0), 10) * 0.5 / 12);

/**
 * Сдвиг кодека: в начале ленты стоит метка (короткий тон), в исходнике она начинается в expected секунд.
 * Ищем, где она в разобранном звуке, — разница и есть сдвиг (у Opus и AAC он свой, а браузеры по-разному
 * учитывают «разгон» кодека). Метки нет или она странная — считаем, что сдвига нет.
 */
export function markerShift(data: ArrayLike<number>, rate: number, expected: number): number {
  const end = Math.min(data.length, Math.ceil((expected + 0.25) * rate));
  let peak = 0;
  for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak < 0.05) return 0;
  for (let i = 0; i < end; i++) {
    if (Math.abs(data[i]) > peak * 0.5) {
      const shift = i / rate - expected;
      return Math.abs(shift) <= 0.15 ? shift : 0;
    }
  }
  return 0;
}
