import type { Lang } from './detect';

/** Форма слова после числа: по-русски 1 открытку / 2–4 открытки / 5 открыток (и 11–14 — «много»); по-английски 1 card / 2 cards. */
export type PluralForm = 'one' | 'few' | 'many';

export function pluralForm(n: number, lang: Lang): PluralForm {
  const abs = Math.abs(Math.trunc(n));
  if (lang !== 'ru') return abs === 1 ? 'one' : 'many';
  const ten = abs % 10;
  const hundred = abs % 100;
  if (hundred >= 11 && hundred <= 14) return 'many';
  if (ten === 1) return 'one';
  if (ten >= 2 && ten <= 4) return 'few';
  return 'many';
}
