// Лёгкая графика для слабых телефонов: холст не плотнее 720 точек по ширине (вдвое меньше пикселей
// на экранах с плотностью 3), без виньетки и облаков. Включается сама, если игра заметно тормозит,
// или вручную в профиле. Хранится в браузере; холст меняется со следующего запуска.

const KEY = 'magazinchik.lite';

export function liteMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setLiteMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Без хранилища режим действует до перезапуска.
  }
}

/** Ниже скольких кадров в секунду (медиана за день) включаем лёгкий режим сами. */
export const LITE_FPS = 40;

/** Медиана и «просадка» (10-й процентиль) по посекундным замерам FPS. */
export function fpsSummary(samples: number[]): { median: number; low: number } | null {
  if (samples.length < 10) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], low: sorted[Math.floor(sorted.length * 0.1)] };
}
