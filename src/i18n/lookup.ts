import type { Lang } from './langs';

/** Шаблон строки по цепочке: язык игрока → английский → русский (русский есть всегда и целиком). */
export function lookup<K extends string>(dicts: Partial<Record<Lang, Partial<Record<K, string>>>>, lang: Lang, key: K, ru: Record<K, string>): string {
  return dicts[lang]?.[key] ?? dicts.en?.[key] ?? ru[key];
}
