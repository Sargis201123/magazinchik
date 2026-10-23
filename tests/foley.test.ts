import { describe, expect, it } from 'vitest';
import manifestJson from '../art/sfx/manifest.json';
import { SHELF_KINDS } from '../src/game/economy';
import { clipSpan, markerShift, MATERIAL, NOTES_FROM, payWith, placeRate, PRE_ROLL } from '../src/platform/foley';
import { ONSETS, SFX, SFX_BANK, SYLLABLES, VOICE_BANK, VOWELS, type SfxId } from '../src/platform/sfxData';

// Записанные звуки действий: таблица кусков совпадает с манифестом и файлами, у каждого звука есть
// варианты, отдел → материал, монетки или купюры, сдвиг кодека по метке.

const manifest = manifestJson as unknown as {
  sfx: { path: string; marker: number; duration: number; sounds: Record<string, number[][]> };
  voice: { path: string; marker: number; duration: number; onsets: string[]; vowels: string[]; voices: Record<string, number[][]> };
};
const FILES = new Set(Object.keys(import.meta.glob('../public/audio/sfx/*.{ogg,m4a}')).map((f) => f.replace('../public/', '')));

describe('ленты звуков', () => {
  it('файлы на месте в обоих форматах (Opus и AAC)', () => {
    for (const bank of [SFX_BANK, VOICE_BANK]) {
      expect(FILES.has(`${bank.path}.ogg`)).toBe(true);
      expect(FILES.has(`${bank.path}.m4a`)).toBe(true);
    }
  });

  it('таблица в игре — та же, что в манифесте сборки', () => {
    expect(SFX_BANK).toEqual({ path: manifest.sfx.path, marker: manifest.sfx.marker, duration: manifest.sfx.duration });
    expect(VOICE_BANK).toEqual({ path: manifest.voice.path, marker: manifest.voice.marker, duration: manifest.voice.duration });
    expect(SFX).toEqual(manifest.sfx.sounds);
    expect(SYLLABLES).toEqual(manifest.voice.voices);
    expect([...ONSETS]).toEqual(manifest.voice.onsets);
    expect([...VOWELS]).toEqual(manifest.voice.vowels);
  });

  it('у каждого звука несколько вариантов — подряд не звучит «пулемётом»', () => {
    for (const [id, segs] of Object.entries(SFX)) expect(segs.length, id).toBeGreaterThanOrEqual(3);
  });

  it('куски не налезают друг на друга и на метку (с тишиной спереди), лежат внутри ленты, громкость разумная', () => {
    const check = (segs: readonly (readonly [number, number, number])[], marker: number, duration: number) => {
      const sorted = [...segs].sort((a, b) => a[0] - b[0]);
      let end = marker + 0.01;
      for (const [at, dur, gain] of sorted) {
        expect(at - PRE_ROLL).toBeGreaterThan(end + 0.03);
        expect(dur).toBeGreaterThan(0.02);
        expect(gain).toBeGreaterThan(0);
        expect(gain).toBeLessThan(0.5);
        end = at + dur;
      }
      expect(end).toBeLessThan(duration);
    };
    check(Object.values(SFX).flat(), SFX_BANK.marker, SFX_BANK.duration);
    check([...SYLLABLES.low, ...SYLLABLES.high], VOICE_BANK.marker, VOICE_BANK.duration);
  });

  it('слоги: оба голоса, все начала × все гласные', () => {
    expect(SYLLABLES.low).toHaveLength(ONSETS.length * VOWELS.length);
    expect(SYLLABLES.high).toHaveLength(ONSETS.length * VOWELS.length);
  });
});

describe('полки по отделам', () => {
  it('у каждого отдела есть свой звук, и он есть в ленте', () => {
    for (const kind of Object.keys(SHELF_KINDS) as (keyof typeof SHELF_KINDS)[]) expect(SFX[MATERIAL[kind] as SfxId], kind).toBeDefined();
  });

  it('бутылки звенят, банки стучат, хлеб мягкий, заморозка в коробках', () => {
    expect(MATERIAL.drinks).toBe('glass');
    expect(MATERIAL.household).toBe('tin');
    expect(MATERIAL.bakery).toBe('soft');
    expect(MATERIAL.frozen).toBe('box');
  });

  it('каждый следующий товар выше, но не выше кварты', () => {
    expect(placeRate(0)).toBe(1);
    expect(placeRate(2)).toBeGreaterThan(placeRate(1));
    expect(placeRate(50)).toBeCloseTo(2 ** (5 / 12), 6);
    expect(placeRate(-3)).toBe(1);
  });
});

describe('касса', () => {
  it('мелкая покупка — монетки, крупная — купюры', () => {
    expect(payWith(40)).toBe('coin');
    expect(payWith(NOTES_FROM - 1)).toBe('coin');
    expect(payWith(NOTES_FROM)).toBe('notes');
  });
});

describe('сдвиг кодека по метке', () => {
  const rate = 32000;
  const withMarker = (at: number) => {
    const data = new Float32Array(rate);
    const start = Math.round(at * rate);
    for (let i = 0; i < 160; i++) data[start + i] = 0.5 * Math.sin((2 * Math.PI * 2000 * i) / rate) * Math.sin((Math.PI * i) / 160);
    return data;
  };

  it('метка на месте — сдвига нет; позже на 21 мс (разгон AAC) — сдвиг 21 мс', () => {
    const exact = withMarker(0.05);
    const base = markerShift(exact, rate, 0.05);
    expect(Math.abs(base)).toBeLessThan(0.004);
    expect(markerShift(withMarker(0.071), rate, 0.05) - base).toBeCloseTo(0.021, 3);
  });

  it('громкий первый кусок за меткой не сбивает её фронт (порог — от пика самой метки, как в render.py)', () => {
    // Фронт метки по половине её пика — как first_cross в art/sfx/render.py.
    const marker = withMarker(0.05);
    let front = 0;
    while (Math.abs(marker[front]) <= 0.25) front++;
    const loud = withMarker(0.05);
    const at = Math.round(0.135 * rate);
    for (let i = 0; i < 0.1 * rate; i++) loud[at + i] = 0.84 * Math.sin((2 * Math.PI * 440 * i) / rate);
    expect(markerShift(loud, rate, front / rate)).toBeCloseTo(0, 4);
    expect(markerShift(marker, rate, front / rate)).toBeCloseTo(0, 4);
  });

  it('метки нет или она за краем разумного — считаем, что сдвига нет', () => {
    expect(markerShift(new Float32Array(rate), rate, 0.05)).toBe(0);
    expect(markerShift(withMarker(0.27), rate, 0.05)).toBe(0);
  });
});

describe('кусок ленты', () => {
  it('начинается чуть раньше, в тишине перед ним, а кончается там же', () => {
    const span = clipSpan(10, 0.3, 0.002, 60);
    expect(span.offset).toBeCloseTo(10 + 0.002 - PRE_ROLL, 9);
    expect(span.offset + span.dur).toBeCloseTo(10.302, 9);
  });

  it('не уходит за начало и за конец ленты', () => {
    expect(clipSpan(0.001, 0.3, 0, 60)).toEqual({ offset: 0, dur: 0.301 });
    const tail = clipSpan(59.9, 0.3, 0, 60);
    expect(tail.offset + tail.dur).toBeCloseTo(60, 9);
  });
});
