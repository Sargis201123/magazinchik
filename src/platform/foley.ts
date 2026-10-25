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

/** Большая покупка — после кассы тихое «спасибо» (sound.thanks): столько товаров или на такую сумму. */
export const BIG_BASKET = { items: 4, total: 2 * NOTES_FROM };

export const bigBasket = (items: number, total: number): boolean => items >= BIG_BASKET.items || total >= BIG_BASKET.total;

/** Каждый следующий товар на полке — на полтона выше, но не выше чем на кварту. */
export const placeRate = (n: number): number => 2 ** (Math.min(Math.max(n, 0), 10) * 0.5 / 12);

/**
 * Сдвиг кодека: в начале ленты стоит метка (короткий тон), в исходнике её фронт (половина пика) — в expected
 * секунд. Ищем, где он в разобранном звуке, — разница и есть сдвиг (у Opus и AAC он свой, а браузеры
 * по-разному учитывают «разгон» кодека). Пик — только у самой метки (10 мс с того места, где стало громко),
 * как в render.py: первый кусок ленты громче метки, и порог от его пика находил фронт на полмиллисекунды
 * позже — каждый кусок начинался чуть внутри звука. Метки нет или она странная — считаем, что сдвига нет.
 */
export function markerShift(data: ArrayLike<number>, rate: number, expected: number): number {
  const end = Math.min(data.length, Math.ceil((expected + 0.25) * rate));
  let from = 0;
  while (from < end && Math.abs(data[from]) < 0.05) from++;
  if (from >= end) return 0;
  const to = Math.min(end, from + Math.ceil(0.01 * rate));
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(data[i]));
  for (let i = from; i < to; i++) {
    if (Math.abs(data[i]) > peak * 0.5) {
      const shift = i / rate - expected;
      return Math.abs(shift) <= 0.15 ? shift : 0;
    }
  }
  return 0;
}

/**
 * Сколько тишины захватить перед куском, секунды. Сдвиг кодека известен с точностью до отсчёта, а кодек
 * чуть размазывает фронт: начни ровно с куска — играешь с середины волны, и у «дзинь» и щелчков в начале
 * щелчок. Перед каждым куском в ленте пауза в 50–80 мс (art/sfx/render.py, GAP) — запаса хватает.
 */
export const PRE_ROLL = 0.004;

/** Откуда и сколько играть кусок [at, dur] ленты длиной total со сдвигом shift: с тишиной спереди, конец — тот же. */
export function clipSpan(at: number, dur: number, shift: number, total: number): { offset: number; dur: number } {
  const start = at + shift;
  const offset = Math.max(0, start - PRE_ROLL);
  return { offset, dur: Math.max(0, Math.min(dur + start - offset, total - offset)) };
}
