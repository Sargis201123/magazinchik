import { detectLang } from './detect';
import { isShipped, type Lang } from './langs';
import { ru, ruNames, type TextKey } from './ru';
import { telegramLanguage } from '../platform/telegram';
import { storedLang } from './stored';
import { lookup } from './lookup';

export type { Lang, TextKey };
export { LANGS, NATIVE, SHIPPED } from './langs';

/** Словарь языка: у готовых языков — все ключи, у заготовок (kk, pt) — сколько успели перевести. */
type Dictionary = Partial<Record<TextKey, string>>;

// Словари, кроме русского, грузятся отдельными файлами, только если нужны (loadLang): русским
// игрокам — а их большинство — не качать лишние ~30 КБ на язык. Пока не загружен — текст по-русски.
const loaders: Record<Exclude<Lang, 'ru'>, () => Promise<{ dict: Dictionary; names: string[] }>> = {
  en: () => import('./en').then((m) => ({ dict: m.en, names: m.enNames })),
  tr: () => import('./tr').then((m) => ({ dict: m.tr, names: m.trNames })),
  es: () => import('./es').then((m) => ({ dict: m.es, names: m.esNames })),
  kk: () => import('./kk').then((m) => ({ dict: m.kk, names: m.kkNames })),
  uz: () => import('./uz').then((m) => ({ dict: m.uz, names: m.uzNames })),
  pt: () => import('./pt').then((m) => ({ dict: m.pt, names: m.ptNames })),
};

const dictionaries: Partial<Record<Lang, Dictionary>> = { ru };

let lang: Lang = detectLang(
  new URLSearchParams(location.search).get('lang'),
  storedLang(),
  telegramLanguage(),
  navigator.language,
);

// Язык страницы — для переносов слов и экранного диктора.
document.documentElement.lang = lang;

/**
 * Язык площадки, который стал известен уже после запуска (Яндекс Игры: ysdk.environment.i18n.lang, main.ts).
 * Выбор игрока в настройках и ?lang= в адресе важнее.
 */
export function usePlatformLang(code: string | undefined): void {
  if (!code) return;
  lang = detectLang(new URLSearchParams(location.search).get('lang'), storedLang(), code);
  document.documentElement.lang = lang;
}

export const getLang = (): Lang => lang;
export const setLang = (next: Lang): void => {
  lang = next;
};

/** Строка на языке игрока; чего нет в его словаре — по-английски, а нет и там — по-русски. */
export function t(key: TextKey, params: Record<string, string | number> = {}): string {
  const template = lookup(dictionaries, lang, key, ru);
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

const names: Partial<Record<Lang, string[]>> = { ru: ruNames };
export const staffName = (index: number): string => {
  const list = names[lang]?.length ? names[lang]! : names.en?.length ? names.en : ruNames;
  return list[index % list.length];
};

/** Имя сотрудника: у друга из Telegram — его имя, у героя сценки (echoes.ts) — его имя из сценки. */
export const memberName = (m: { name: number; friend?: { name: string }; alias?: string }): string =>
  m.friend ? `👋 ${m.friend.name}` : m.alias ? t(m.alias as TextKey) : staffName(m.name);

async function load(which: Exclude<Lang, 'ru'>): Promise<void> {
  if (dictionaries[which]) return;
  const { dict, names: list } = await loaders[which]();
  dictionaries[which] = dict;
  names[which] = list;
}

/** Загрузить словарь текущего языка (до запуска игры, main.ts); у неготового языка — ещё и английский про запас. */
export async function loadLang(): Promise<void> {
  if (lang === 'ru') return;
  if (lang === 'en') return load('en');
  // Словарь не скачался (сеть, старая страница после выкладки) — пусть лучше английский, чем русский.
  await Promise.all([load(lang).catch(() => load('en')), ...(isShipped(lang) ? [] : [load('en')])]);
}
