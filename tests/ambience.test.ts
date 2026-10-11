import { describe, expect, it } from 'vitest';
import { brownNoise, pinkNoise, rainTexture, seeded } from '../src/platform/ambienceSynth';

// Синтез фоновых звуков: дождь из отдельных капель, розовый и бурый шум.
const RATE = 8000;

describe('синтез дождя и шума', () => {
  it('одинаковое зерно — одинаковый звук; разные — разный', () => {
    const a = rainTexture(RATE, 1, { drops: 150, wash: 0.4, plops: 0.05 }, seeded(1));
    const b = rainTexture(RATE, 1, { drops: 150, wash: 0.4, plops: 0.05 }, seeded(1));
    const c = rainTexture(RATE, 1, { drops: 150, wash: 0.4, plops: 0.05 }, seeded(2));
    expect(a.left).toEqual(b.left);
    expect(a.left).not.toEqual(c.left);
  });

  it('без перегруза: пик ровно 0.9, левый и правый каналы разные (капли по сторонам)', () => {
    const r = rainTexture(RATE, 2, { drops: 300, wash: 0.5, plops: 0.05 }, seeded(3));
    const peak = Math.max(...r.left.map(Math.abs), ...r.right.map(Math.abs));
    expect(peak).toBeCloseTo(0.9, 5);
    expect(r.left).not.toEqual(r.right);
    expect(r.left.every(Number.isFinite)).toBe(true);
  });

  it('ливень громче мороси в среднем (больше капель)', () => {
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    // Без нормировки сравнить нельзя — сравниваем долю «пустых» участков: в мороси тише чаще.
    const quiet = (x: Float32Array) => x.filter((v) => Math.abs(v) < 0.02).length / x.length;
    const drizzle = rainTexture(RATE, 2, { drops: 40, wash: 0.1, plops: 0 }, seeded(4));
    const pour = rainTexture(RATE, 2, { drops: 600, wash: 0.1, plops: 0 }, seeded(4));
    expect(quiet(drizzle.left)).toBeGreaterThan(quiet(pour.left));
    expect(rms(pour.left)).toBeGreaterThan(0);
  });

  it('петля шума без щелчка: конец плавно переходит в начало', () => {
    for (const make of [pinkNoise, brownNoise]) {
      const x = make(RATE * 2, seeded(5), Math.floor(RATE * 0.08));
      const jump = Math.abs(x[x.length - 1] - x[0]);
      const typical = x.slice(1).reduce((s, v, i) => s + Math.abs(v - x[i]), 0) / (x.length - 1);
      expect(jump).toBeLessThan(typical * 8);
    }
  });
});
