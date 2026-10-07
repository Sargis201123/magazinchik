import { detectLang, type Lang } from './detect';
import { en, enNames } from './en';
import { ru, ruNames, type TextKey } from './ru';
import { telegramLanguage } from '../platform/telegram';
import { storedLang } from './stored';

export type { Lang, TextKey };

const dictionaries: Record<Lang, Record<TextKey, string>> = { ru, en };

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
  const template = dictionaries[lang][key] ?? ru[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

const names: Record<Lang, string[]> = { ru: ruNames, en: enNames };
export const staffName = (index: number): string => names[lang][index % names[lang].length];
