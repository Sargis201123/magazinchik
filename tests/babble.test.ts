import { describe, expect, it } from 'vitest';
import { Babbler, intonation, MAX_SHIFT, speak, speakerOf, syllableAt, voiceOf } from '../src/platform/babble';
import { ONSETS, VOWELS } from '../src/platform/sfxData';

// Голоса героев: кто как говорит, эмоция портрета, буквы → слог, интонация фразы, ритм бормотания.

const syl = (onset: (typeof ONSETS)[number], vowel: (typeof VOWELS)[number]) => ONSETS.indexOf(onset) * VOWELS.length + VOWELS.indexOf(vowel);

describe('кто говорит', () => {
  it('имя и эмоция — из имени портрета', () => {
    expect(speakerOf('portrait_grandma_sad')).toEqual({ who: 'grandma', mood: 'sad' });
    expect(speakerOf('portrait_sonya')).toEqual({ who: 'sonya', mood: undefined });
    expect(speakerOf('assets/portrait_eduard_happy.png')).toEqual({ who: 'eduard', mood: 'happy' });
  });

  it('бабушка — ниже и медленнее Сони; мужчины — из низкого банка', () => {
    const grandma = voiceOf('portrait_grandma', 620);
    const sonya = voiceOf('portrait_sonya', 760);
    expect(grandma.bank).toBe('high');
    expect(sonya.bank).toBe('high');
    expect(grandma.rate).toBeLessThan(sonya.rate);
    expect(grandma.gap).toBeGreaterThan(sonya.gap);
    for (const who of ['eduard', 'marat', 'father', 'inspector', 'police']) expect(voiceOf(`portrait_${who}`, 300).bank).toBe('low');
  });

  it('эмоция меняет тон: радость выше и звонче, грусть ниже, тише и медленнее, злость резче', () => {
    const calm = voiceOf('portrait_grandma', 620);
    const happy = voiceOf('portrait_grandma_happy', 620);
    const sad = voiceOf('portrait_grandma_sad', 620);
    const angry = voiceOf('portrait_grandma_angry', 620);
    expect(happy.rate).toBeGreaterThan(calm.rate);
    expect(happy.bright).toBeGreaterThan(calm.bright);
    expect(sad.rate).toBeLessThan(calm.rate);
    expect(sad.gain).toBeLessThan(calm.gain);
    expect(sad.gap).toBeGreaterThan(calm.gap);
    expect(sad.lift).toBeLessThan(0);
    expect(angry.bright).toBeGreaterThan(calm.bright);
    expect(angry.clip).toBeLessThan(1);
  });

  it('незнакомец — по высоте прежнего «пика»: высокий — женский голос, низкий — мужской', () => {
    expect(voiceOf('portrait_farmer', 620).bank).toBe('high');
    expect(voiceOf('portrait_farmer', 280).bank).toBe('low');
    const v = voiceOf('portrait_wholesale', 9999);
    expect(v.rate).toBeLessThanOrEqual(1.25);
  });

  it('прежний «пик» на случай, пока банк не скачан, остаётся высотой героя', () => {
    expect(voiceOf('portrait_grandma', 620).pitch).toBe(620);
  });
});

describe('буквы → слог', () => {
  it('последний гласный куска и согласный перед ним', () => {
    expect(syllableAt([...'мама'], 0, 4)).toBe(syl('m', 'a'));
    expect(syllableAt([...'здравствуй'], 0, 10)).toBe(syl('v', 'u'));
    expect(syllableAt([...'Соня'], 0, 2)).toBe(syl('s', 'o'));
    expect(syllableAt([...'Ты'], 0, 2)).toBe(syl('t', 'y'));
  });

  it('гласного в куске нет — берём ближайший следующий; нет и его — «а»; слог с гласного — без согласного', () => {
    expect(syllableAt([...'вздох'], 0, 2)).toBe(syl('d', 'o'));
    expect(syllableAt([...'ммм'], 0, 3)).toBe(syl('', 'a'));
    expect(syllableAt([...'Ой'], 0, 2)).toBe(syl('', 'o'));
  });

  it('латиница (английский текст) тоже бормочет', () => {
    expect(syllableAt([...'Hello'], 0, 5)).toBe(syl('l', 'o'));
    expect(syllableAt([...'big'], 0, 3)).toBe(syl('b', 'i'));
  });

  it('каждый слог — в пределах банка', () => {
    const text = [...'Ну что, внучек, откроем магазинчик? Жёлтые щи и хлеб! Quick brown fox.'];
    for (let i = 1; i <= text.length; i++) {
      const s = syllableAt(text, Math.max(0, i - 3), i);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(ONSETS.length * VOWELS.length);
    }
  });
});

describe('интонация', () => {
  it('к концу предложения голос опускается, перед «?» — поднимается', () => {
    const plain = [...'Сегодня хороший день для торговли.'];
    const ask = [...'Сегодня хороший день для торговли?'];
    expect(intonation(plain, 2, 2)).toBeGreaterThan(intonation(plain, plain.length - 3, 2));
    expect(intonation(ask, ask.length - 3, 2)).toBeGreaterThan(intonation(plain, plain.length - 3, 2) + 2);
  });

  it('«!» — всё предложение выше', () => {
    const plain = [...'Как хорошо.'];
    const loud = [...'Как хорошо!'];
    expect(intonation(loud, 4, 2)).toBeGreaterThan(intonation(plain, 4, 2));
  });

  it('без размаха — почти ровно', () => {
    const text = [...'Проверка документов.'];
    for (let i = 0; i < text.length; i++) expect(Math.abs(intonation(text, i, 0))).toBe(0);
  });
});

describe('ритм бормотания', () => {
  it('слоги не чаще, чем говорит герой, и только на буквах', () => {
    const v = voiceOf('portrait_grandma', 620);
    const text = [...'Здравствуй, внучек! Как дела в магазине?'];
    const talk = new Babbler(v, text);
    let last = -Infinity;
    for (let shown = 1; shown <= text.length; shown++) {
      const now = shown * 0.026;
      const s = talk.next(shown, now);
      if (s) {
        expect(now - last).toBeGreaterThanOrEqual(v.gap - 1e-9);
        expect(text[shown - 1]).toMatch(/\p{L}/u);
        last = now;
      }
    }
    expect(talk.count).toBeGreaterThanOrEqual(4);
  });

  it('Соня тараторит — слогов больше, чем у бабушки на той же фразе', () => {
    const text = 'Папа, смотри, какой большой магазин у нас получился!';
    expect(speak(text, voiceOf('portrait_sonya', 760)).length).toBeGreaterThan(speak(text, voiceOf('portrait_grandma', 620)).length);
  });

  it('грусть — медленнее и ниже к концу фразы', () => {
    const text = 'Ничего мы не продали сегодня, совсем ничего не продали, а покупатели всё шли и шли мимо нашей двери.';
    const calm = speak(text, voiceOf('portrait_grandma', 620));
    const sad = speak(text, voiceOf('portrait_grandma_sad', 620));
    const pace = (steps: { at: number }[]) => (steps[steps.length - 1].at - steps[0].at) / (steps.length - 1);
    expect(pace(sad)).toBeGreaterThan(pace(calm));
    const lastCalm = calm[calm.length - 1].syllable.semitones;
    const lastSad = sad[sad.length - 1].syllable.semitones;
    expect(lastSad).toBeLessThan(lastCalm);
  });

  it('после точки — пауза длиннее обычной', () => {
    const v = voiceOf('portrait_marat', 330);
    const steps = speak('Да. Да да да да', v);
    const gaps = steps.slice(1).map((s, i) => s.at - steps[i].at);
    expect(gaps[0]).toBeGreaterThan(v.gap * 1.5);
    expect(Math.min(...gaps.slice(1))).toBeLessThan(gaps[0]);
  });

  it('интонация не уходит дальше кварты даже у удивлённой Сони перед «?»', () => {
    const steps = speak('Папа, правда? Правда-правда? Мы победили?', voiceOf('portrait_sonya_surprised', 760));
    for (const s of steps) expect(Math.abs(s.syllable.semitones)).toBeLessThanOrEqual(MAX_SHIFT);
  });

  it('напечатанное повторно и пустой текст — без слогов', () => {
    const talk = new Babbler(voiceOf('portrait_grandma', 620), [...'Ой']);
    expect(talk.next(2, 1)).not.toBeNull();
    expect(talk.next(2, 5)).toBeNull();
    expect(new Babbler(voiceOf('portrait_grandma', 620), []).next(1, 1)).toBeNull();
  });
});
