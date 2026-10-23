import { describe, expect, it } from 'vitest';
import { FAST_SCREEN_MS, Pacer } from '../src/platform/pacing';

/** Сколько кадров игры за секунду при частоте экрана hz и шаге interval (с дрожанием меток rAF). */
function run(hz: number, interval: number | ((p: Pacer) => number), jitter = 0.6): number {
  const pacer = new Pacer();
  const period = 1000 / hz;
  let steps = 0;
  // Две секунды: первая — на замер частоты экрана, считаем вторую.
  for (let i = 0; i < hz * 2; i++) {
    const t = i * period + (i % 2 ? jitter : -jitter);
    const ok = pacer.step(t, typeof interval === 'number' ? interval : interval(pacer));
    if (ok && i >= hz) steps++;
  }
  return steps;
}

const cap60 = (p: Pacer) => (p.screenMs < FAST_SCREEN_MS ? 1000 / 60 : 0);

describe('ритм кадров', () => {
  it('без ограничения — каждый кадр экрана', () => {
    expect(run(60, 0)).toBe(60);
    expect(run(120, 0)).toBe(120);
  });

  it('экран 120, 90 и 144 Гц — около 60 кадров игры', () => {
    expect(run(120, cap60)).toBe(60);
    // На 90 и 144 Гц кадры игры не совпадают с кадрами экрана: за секунду ±1–2 на краях отрезка.
    expect(Math.abs(run(90, cap60) - 60)).toBeLessThanOrEqual(2);
    expect(Math.abs(run(144, cap60) - 60)).toBeLessThanOrEqual(2);
  });

  it('экран 60 Гц ограничение не трогает: ни одного пропущенного кадра', () => {
    expect(run(60, cap60, 1.5)).toBe(60);
  });

  it('окно поверх зала — 30 кадров на любом экране', () => {
    for (const hz of [60, 90, 120]) expect(run(hz, 1000 / 30)).toBe(30);
  });

  it('после долгой паузы не догоняет пачкой кадров', () => {
    const pacer = new Pacer();
    expect(pacer.step(0, 1000 / 30)).toBe(true);
    expect(pacer.step(500, 1000 / 30)).toBe(true);
    expect(pacer.step(508, 1000 / 30)).toBe(false);
    expect(pacer.step(516, 1000 / 30)).toBe(false);
  });
});
