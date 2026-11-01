import type { Lang } from './langs';

/**
 * Форма слова после числа: по-русски 1 открытку / 2–4 открытки / 5 открыток (и 11–14 — «много»);
 * в остальных языках — по правилам Intl (en/es: 1 card / 2 cards; по-турецки слово после числа не меняется,
 * но ключ всё равно выбирается — в словаре у всех трёх форм одно слово).
 */
export type PluralForm = 'one' | 'few' | 'many';

const rules = new Map<Lang, Intl.PluralRules | null>();

function intl(lang: Lang): Intl.PluralRules | null {
  if (!rules.has(lang)) {
    try {
      rules.set(lang, new Intl.PluralRules(lang));
    } catch {
      rules.set(lang, null);
    }
  }
  return rules.get(lang) ?? null;
}

export function pluralForm(n: number, lang: Lang): PluralForm {
  const abs = Math.abs(Math.trunc(n));
  if (lang === 'ru') {
    const ten = abs % 10;
    const hundred = abs % 100;
    if (hundred >= 11 && hundred <= 14) return 'many';
    if (ten === 1) return 'one';
    if (ten >= 2 && ten <= 4) return 'few';
    return 'many';
  }
  // Казахский, узбекский, турецкий: Intl говорит «one» для 1 — слово то же, что и для «many», вреда нет.
  const cat = intl(lang)?.select(abs) ?? (abs === 1 ? 'one' : 'other');
  if (cat === 'one') return 'one';
  if (cat === 'few') return 'few';
  return 'many';
}
