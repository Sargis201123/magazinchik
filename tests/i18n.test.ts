import { describe, expect, it } from 'vitest';
import { ru, ruNames, type TextKey } from '../src/i18n/ru';
import { en, enNames } from '../src/i18n/en';
import { tr, trNames } from '../src/i18n/tr';
import { es, esNames } from '../src/i18n/es';
import { kk, kkNames } from '../src/i18n/kk';
import { uz, uzNames } from '../src/i18n/uz';
import { pt, ptNames } from '../src/i18n/pt';
import { FONT_SAMPLE, LANGS, NATIVE, SHIPPED, type Lang } from '../src/i18n/langs';
import { detectLang } from '../src/i18n/detect';
import { pluralForm } from '../src/i18n/plural';
import { lookup } from '../src/i18n/lookup';

const dicts: Record<Lang, Partial<Record<TextKey, string>>> = { ru, en, tr, es, kk, uz, pt };
const names: Record<Lang, string[]> = { ru: ruNames, en: enNames, tr: trNames, es: esNames, kk: kkNames, uz: uzNames, pt: ptNames };
const keys = Object.keys(ru) as TextKey[];
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
const emoji = (s: string) => [...s.matchAll(/\p{Extended_Pictographic}/gu)].map((m) => m[0]).sort().join('');
const complete = (lang: Lang) => keys.every((k) => typeof dicts[lang][k] === 'string' && dicts[lang][k] !== '');

describe('словари языков', () => {
  it('в выборе языка — только языки с полным словарём (заготовки uz/pt не показываются)', () => {
    for (const lang of LANGS) if (!complete(lang)) expect(SHIPPED, `${lang} не переведён целиком`).not.toContain(lang);
    expect(SHIPPED).toEqual(['ru', 'en', 'tr', 'es', 'kk']);
  it('в выборе языка — только языки с полным словарём (заготовки kk/pt не показываются)', () => {
    for (const lang of LANGS) if (!complete(lang)) expect(SHIPPED, `${lang} не переведён целиком`).not.toContain(lang);
    expect(SHIPPED).toEqual(['ru', 'en', 'tr', 'es', 'uz']);
  it('в выборе языка — только языки с полным словарём (заготовки kk/uz не показываются)', () => {
    for (const lang of LANGS) if (!complete(lang)) expect(SHIPPED, `${lang} не переведён целиком`).not.toContain(lang);
    expect(SHIPPED).toEqual(['ru', 'en', 'tr', 'es', 'pt']);
  });

  for (const lang of SHIPPED.filter((l) => l !== 'ru')) {
    describe(lang, () => {
      it('те же ключи, что в русском, без лишних и пустых', () => {
        expect(Object.keys(dicts[lang]).sort()).toEqual([...keys].sort());
        expect(keys.filter((k) => !dicts[lang][k]?.trim())).toEqual([]);
      });
      it('те же подстановки {x} в каждой строке', () => {
        expect(keys.filter((k) => placeholders(dicts[lang][k]!) !== placeholders(ru[k]))).toEqual([]);
      });
      it('те же эмодзи в каждой строке', () => {
        expect(keys.filter((k) => emoji(dicts[lang][k]!) !== emoji(ru[k]))).toEqual([]);
      });
      it('имена сотрудников: столько же, сколько русских (номер имени хранится в сохранении)', () => {
        expect(names[lang]).toHaveLength(ruNames.length);
        expect(new Set(names[lang]).size).toBe(ruNames.length);
      });
    });
  }

  for (const lang of ['tr', 'es', 'uz'] as const) {
  for (const lang of ['tr', 'es', 'pt'] as const) {
    it(`${lang}: ни одной русской буквы`, () => {
      expect(keys.filter((k) => /[а-яё]/i.test(dicts[lang][k]!))).toEqual([]);
    });
  }

  it('kk: казахский, а не русский — казахские буквы в большинстве строк, после числа слово не меняется', () => {
    const withLetters = keys.filter((k) => /[әғқңөұүһі]/i.test(kk[k]!)).length;
    expect(withLetters / keys.length).toBeGreaterThan(0.8);
    expect(new Set([kk['live.box.cards.one'], kk['live.box.cards.few'], kk['live.box.cards.many']]).size).toBe(1);
  });

  it('у заготовок лишних ключей нет и подстановки совпадают', () => {
    for (const lang of ['uz', 'pt'] as const)
    for (const lang of ['kk', 'pt'] as const)
    for (const lang of ['kk', 'uz'] as const)
      for (const [k, v] of Object.entries(dicts[lang])) {
        expect(k in ru, `${lang}: ${k}`).toBe(true);
        expect(placeholders(v!)).toBe(placeholders(ru[k as TextKey]));
      }
  });

  it('у каждого языка есть название на нём самом и буквы для шрифта', () => {
    for (const lang of LANGS) {
      expect(NATIVE[lang]).toBeTruthy();
      expect(typeof FONT_SAMPLE[lang]).toBe('string');
    }
    expect(NATIVE.tr).toBe('Türkçe');
    expect(NATIVE.es).toBe('Español');
  });
});

describe('нет строки — берём английскую, потом русскую', () => {
  const key = 'title.play' as TextKey;
  it('язык игрока, если строка есть', () => {
    expect(lookup({ ru, en, tr }, 'tr', key, ru)).toBe(tr[key]);
  });
  it('заготовка без строки → английский', () => {
    expect(lookup({ ru, en, kk: {} }, 'kk', key, ru)).toBe(en[key]);
  });
  it('английский ещё не загружен → русский', () => {
    expect(lookup({ ru, kk: {} }, 'kk', key, ru)).toBe(ru[key]);
  });
});

describe('язык игрока', () => {
  it('Telegram и браузер: tr, es, es-MX, pt-BR, kk, kk-KZ, uz', () => {
  it('Telegram и браузер: tr, es, es-MX, pt-BR, pt-PT, kk, uz', () => {
    expect(detectLang(null, null, 'tr')).toBe('tr');
    expect(detectLang(null, null, 'TR-tr')).toBe('tr');
    expect(detectLang(null, null, 'es')).toBe('es');
    expect(detectLang(null, null, 'es-MX')).toBe('es');
    expect(detectLang(null, null, 'es_AR')).toBe('es');
    // Португальский ещё не готов — английский; узбекский — русский, как и раньше; казахский — свой.
    expect(detectLang(null, null, 'pt-BR')).toBe('en');
    expect(detectLang(null, null, 'kk')).toBe('kk');
    expect(detectLang(null, null, 'kk-KZ')).toBe('kk');
    expect(detectLang(null, null, 'uz')).toBe('ru');
    // Португальский ещё не готов — английский; казахский — русский, как и раньше. Узбекский готов — свой.
    expect(detectLang(null, null, 'pt-BR')).toBe('en');
    // Португальский готов (и бразильский, и европейский — один словарь); казахский и узбекский — пока русский.
    expect(detectLang(null, null, 'pt-BR')).toBe('pt');
    expect(detectLang(null, null, 'pt_PT')).toBe('pt');
    expect(detectLang(null, null, 'kk')).toBe('ru');
    expect(detectLang(null, null, 'uz')).toBe('uz');
    expect(detectLang(null, null, 'uz-Latn-UZ')).toBe('uz');
    expect(detectLang(null, null, 'de-DE')).toBe('en');
  });
  it('выбор игрока важнее Telegram', () => {
    expect(detectLang(null, 'es', 'ru')).toBe('es');
    expect(detectLang(null, 'tr', 'en')).toBe('tr');
  });
  it('?lang= открывает и заготовку (для переводчика), а сохранённая заготовка — нет', () => {
    expect(detectLang('kk', 'ru')).toBe('kk');
    expect(detectLang('PT')).toBe('pt');
    expect(detectLang(null, 'kk')).toBe('kk');
    expect(detectLang(null, 'uz')).toBe('ru');
    expect(detectLang('es', 'ru')).toBe('es');
  });
});

describe('форма слова после числа в новых языках', () => {
  it('испанский: 1 — one, остальное — many', () => {
    expect([0, 1, 2, 5, 21, 1000000].map((n) => pluralForm(n, 'es'))).toEqual(['many', 'one', 'many', 'many', 'many', 'many']);
  });
  it('турецкий: слово не меняется, ключ любой из трёх — в словаре они одинаковые', () => {
    expect(new Set([tr['live.box.cards.one'], tr['live.box.cards.few'], tr['live.box.cards.many']]).size).toBe(1);
    expect(pluralForm(1, 'tr')).toBe('one');
    expect(pluralForm(5, 'tr')).toBe('many');
  });
  it('испанская строка приза: «2 postales»', () => {
    expect(es[`live.box.cards.${pluralForm(2, 'es')}`]).toBe(es['live.box.cards.many']);
    expect(es['live.box.cards.one']).not.toBe(es['live.box.cards.many']);
  });
  it('узбекский: слово после числа не меняется — три ключа одинаковые', () => {
    for (const k of keys.filter((k) => k.endsWith('.one'))) {
      const base = k.slice(0, -4);
      expect(new Set([uz[k], uz[`${base}.few` as TextKey], uz[`${base}.many` as TextKey]]).size, base).toBe(1);
    }
  });
  it('узбекский: oʻ и gʻ — знаком U+02BB, а не апострофом', () => {
    expect(keys.filter((k) => /[oOgG][\u0027\u2019\u02BC`]/.test(uz[k]))).toEqual([]);
  it('португальский: 0 и 1 — one (так по-бразильски, Intl.PluralRules), остальное — many; в словаре few = many', () => {
    expect([0, 1, 2, 5, 21].map((n) => pluralForm(n, 'pt'))).toEqual(['one', 'one', 'many', 'many', 'many']);
    const plural = keys.filter((k) => k.endsWith('.few'));
    expect(plural.filter((k) => pt[k] !== pt[k.replace(/\.few$/, '.many') as TextKey])).toEqual([]);
    expect(pt[`live.box.cards.${pluralForm(2, 'pt')}`]).toBe(pt['live.box.cards.many']);
  });
});
