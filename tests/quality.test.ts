import { describe, expect, it } from 'vitest';
import { fpsSummary } from '../src/platform/quality';

describe('замер плавности', () => {
  it('меньше 10 секунд замеров — рано судить', () => {
    expect(fpsSummary([60, 60, 60])).toBeNull();
  });

  it('медиана и просадка (10-й процентиль)', () => {
    const samples = [20, 30, ...Array(8).fill(60)];
    expect(fpsSummary(samples)).toEqual({ median: 60, low: 30 });
  });
});
