// Язык сервера: на нём бот пишет игроку (напоминания, газета, подарки, ответы на команды), подписывает
// карточки «Поделиться» и называет вещи в счёте за звёзды. Игра присылает свой язык (getLang());
// бот видит language_code из Telegram. Здесь — семь языков: остальные сводим к ближайшему.

export type Lang = 'ru' | 'en' | 'tr' | 'es' | 'kk' | 'uz' | 'pt';
export const LANGS: readonly Lang[] = ['ru', 'en', 'tr', 'es', 'kk', 'uz', 'pt'];

/** Кто скорее поймёт русский, чем английский: игра для них тоже по-русски. */
const RU_LIKE = new Set(['ru', 'uk', 'be', 'ky', 'hy', 'az', 'tg']);

/**
 * Язык из того, что прислали: «es-MX», «pt_BR», «TR» — по первой части, без учёта регистра.
 * Русскоязычные соседи — ru, турецкий, испанский, казахский, узбекский и португальский — свои, всё прочее — en.
 * Ничего не прислали — ru: так было до остальных языков (старые записи в players, старая игра).
 */
export const langOf = (x: unknown): Lang => {
  const code = typeof x === 'string' ? x.trim().toLowerCase().split(/[-_]/)[0] : '';
  if (!code) return 'ru';
  if (RU_LIKE.has(code)) return 'ru';
  if (code === 'tr' || code === 'es' || code === 'kk' || code === 'uz' || code === 'pt') return code;
  return 'en';
};
