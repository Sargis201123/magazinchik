// Какие языки знает игра. Словарь каждого — свой файл (ru.ts, en.ts, tr.ts…) и свой кусок сборки.
// Как добавить язык — docs/I18N.md.

/** Все языки, под которые есть место. Порядок — порядок в выборе языка. */
export const LANGS = ['ru', 'en', 'tr', 'es', 'kk', 'uz', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

/**
 * Языки, которые видит игрок: словарь переведён целиком (это проверяет tests/i18n.test.ts).
 * Остальные — заготовки: их можно открыть только через ?lang=uz (для переводчика),
 * а недостающие строки берутся из английского, потом из русского.
 */
export const SHIPPED: readonly Lang[] = ['ru', 'en', 'tr', 'es', 'kk', 'uz', 'pt'];

/** Название языка на нём самом — так его ищут в списке. */
export const NATIVE: Record<Lang, string> = {
  ru: 'Русский',
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  kk: 'Қазақша',
  uz: 'Oʻzbekcha',
  pt: 'Português',
};

/**
 * Куда идёт игрок, чей язык ещё не готов. Сейчас готовы все: строчка нужна для будущих языков
 * (тому, чей язык ещё в заготовке, — ближайший готовый).
 */
export const UNSHIPPED_TO: Record<Lang, Lang> = { ru: 'ru', en: 'en', tr: 'tr', es: 'es', kk: 'kk', uz: 'uz', pt: 'pt' };

export const isLang = (s: string): s is Lang => (LANGS as readonly string[]).includes(s);
export const isShipped = (lang: Lang): boolean => SHIPPED.includes(lang);

/**
 * Буквы языка, которых нет в основном (латинском) куске шрифта Nunito: по ним браузер догружает нужный кусок
 * (latin-ext, cyrillic, cyrillic-ext) до того, как сцена нарисует надписи на холсте (BootScene): надписи на
 * холсте рисуются один раз, и без этого остались бы системным шрифтом. Английскому хватает латиницы.
 */
export const FONT_SAMPLE: Record<Lang, string> = { ru: 'Жж', en: '', tr: 'ğşİı', es: 'ñá¿', kk: 'Жжәғқңөұүһі', uz: 'ʻʼ', pt: 'ãõç' };
