import { detectLang, type Lang } from './detect';
import { ru, ruNames, type TextKey } from './ru';
import { telegramLanguage } from '../platform/telegram';
import { storedLang } from './stored';

export type { Lang, TextKey };

// Английский словарь грузится отдельным файлом, только если он нужен (loadLang): русским
// игрокам — а их большинство — не качать лишние ~30 КБ. Пока не загружен — текст по-русски.
const dictionaries: Partial<Record<Lang, Record<TextKey, string>>> = { ru };

let lang: Lang = detectLang(
  new URLSearchParams(location.search).get('lang'),
  storedLang(),
  telegramLanguage(),
  navigator.language,
);

export const getLang = (): Lang => lang;
export const setLang = (next: Lang): void => {
  lang = next;
};

export function t(key: TextKey, params: Record<string, string | number> = {}): string {
  const template = dictionaries[lang]?.[key] ?? ru[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

const names: Partial<Record<Lang, string[]>> = { ru: ruNames };
export const staffName = (index: number): string => {
  const list = names[lang] ?? ruNames;
  return list[index % list.length];
};

/** Имя сотрудника: у друга из Telegram — его имя. */
export const memberName = (m: { name: number; friend?: { name: string } }): string => (m.friend ? `👋 ${m.friend.name}` : staffName(m.name));

/** Загрузить словарь текущего языка (до запуска игры, main.ts). */
export async function loadLang(): Promise<void> {
  if (lang !== 'en' || dictionaries.en) return;
  const { en, enNames } = await import('./en');
  dictionaries.en = en;
  names.en = enNames;
}
