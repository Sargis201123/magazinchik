import { isLang, isShipped, UNSHIPPED_TO, type Lang } from './langs';

export type { Lang };

// Русский показываем всем, у кого язык из «русскоязычной» группы (а казахский — пока его словарь не готов),
// остальным, чей язык игра не знает, — английский.
const RU_LIKE = ['ru', 'uk', 'be', 'ky', 'hy', 'az', 'tg'];

/** Код из Telegram / браузера («es-MX», «pt_BR», «TR») → язык игры, или null, если такого языка в игре нет. */
function known(code: string): Lang | null {
  const base = code.toLowerCase().split(/[-_]/)[0];
  if (isLang(base)) return isShipped(base) ? base : UNSHIPPED_TO[base];
  if (RU_LIKE.includes(base)) return 'ru';
  return null;
}

/**
 * Язык игры. Первый аргумент — ?lang= из адреса: им можно открыть и неготовый язык (для переводчика),
 * остальные (выбор игрока, Telegram, браузер) дают только готовые.
 */
export function detectLang(query?: string | null, ...candidates: (string | null | undefined)[]): Lang {
  const q = query?.toLowerCase().trim();
  if (q && isLang(q)) return q;
  for (const c of [query, ...candidates]) {
    if (!c) continue;
    return known(c) ?? 'en';
  }
  return 'ru';
}
