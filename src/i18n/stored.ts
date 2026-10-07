// Язык, который игрок выбрал сам, — важнее языка Telegram и браузера.

import type { Lang } from './detect';

const KEY = 'magazinchik.lang';

export function storedLang(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Без хранилища выбор живёт до перезапуска.
  }
}
