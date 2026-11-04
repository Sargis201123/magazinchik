// Случайность оформления — своя, не общий Math.random. Им живёт день: кто зайдёт, что купит, какое событие
// случится (его же фиксирует e2e). Если искра, облачко пара или подёргивание в очереди берут числа оттуда,
// лишняя искра меняет, кто зайдёт в магазин, а сдвиг анимации на миг — весь день. Сюда — только то, что
// игрок видит и что не меняет хода игры: разброс искр, пар, пыль, кто в очереди переминается.
// (Своя случайность и у звука — platform/sound.ts, и у эффектов pixelfx — pixelFx.ts.)

import Phaser from 'phaser';

const rnd = new Phaser.Math.RandomDataGenerator([String(Date.now())]);

export const look = {
  /** Целое от a до b включительно. */
  between: (a: number, b: number): number => rnd.between(a, b),
  /** Дробное от a до b. */
  float: (a: number, b: number): number => rnd.realInRange(a, b),
  /** Случайный элемент (как Phaser.Utils.Array.GetRandom: у пустого списка — undefined). */
  pick: <T>(list: readonly T[]): T => list[rnd.between(0, Math.max(0, list.length - 1))] as T,
  /** С вероятностью p. */
  chance: (p: number): boolean => rnd.frac() < p,
  /** От 0 до 1. */
  frac: (): number => rnd.frac(),
};
