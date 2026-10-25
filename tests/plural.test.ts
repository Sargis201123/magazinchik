import { describe, expect, it } from 'vitest';
import { pluralForm } from '../src/i18n/plural';
import { ru } from '../src/i18n/ru';

describe('форма слова после числа', () => {
  it('по-русски: 1 открытку, 2–4 открытки, 5–20 открыток, 21 открытку, 111 открыток', () => {
    const cards = (n: number) => `${n} ${ru[`live.box.cards.${pluralForm(n, 'ru')}`]}`;
    expect([1, 2, 3, 4, 5, 11, 12, 14, 20, 21, 22, 25, 31, 111, 112].map(cards)).toEqual([
      '1 открытку', '2 открытки', '3 открытки', '4 открытки', '5 открыток', '11 открыток', '12 открыток', '14 открыток',
      '20 открыток', '21 открытку', '22 открытки', '25 открыток', '31 открытку', '111 открыток', '112 открыток',
    ]);
  });

  it('приз за 2 открытки (23 Февраля, 8 Марта) звучит по-русски', () => {
    const line = ru['live.box.prize'].replace('{need}', '2').replace('{cards}', ru[`live.box.cards.${pluralForm(2, 'ru')}`]);
    expect(line).toContain('За 2 открытки —');
  });

  it('по-английски: 1 card, остальные — cards', () => {
    expect([1, 2, 5, 21].map((n) => pluralForm(n, 'en'))).toEqual(['one', 'many', 'many', 'many']);
  });
});
