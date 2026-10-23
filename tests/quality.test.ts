import { describe, expect, it } from 'vitest';
import { deviceQuality, fpsSummary, fpsVerdict, resolveQuality, telegramClass } from '../src/platform/quality';

describe('замер плавности', () => {
  it('меньше 10 секунд замеров — рано судить', () => {
    expect(fpsSummary([60, 60, 60])).toBeNull();
  });

  it('медиана и просадка (10-й процентиль)', () => {
    const samples = [20, 30, ...Array(8).fill(60)];
    expect(fpsSummary(samples)).toEqual({ median: 60, low: 30 });
  });
});

describe('уровень графики по телефону', () => {
  const android = (cls: string) => `Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 Telegram-Android/11.2.3 (Samsung SM-A125F; Android 12; SDK 31; ${cls})`;

  it('класс из user agent Telegram для Android', () => {
    expect(telegramClass(android('LOW'))).toBe('LOW');
    expect(telegramClass(android('AVERAGE'))).toBe('AVERAGE');
    expect(telegramClass(android('HIGH'))).toBe('HIGH');
    expect(telegramClass('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')).toBeNull();
    expect(telegramClass('Telegram-Android/9.0.0 (Xiaomi Redmi 9; Android 10; SDK 29)')).toBeNull();
  });

  it('класс Telegram важнее памяти', () => {
    expect(deviceQuality(android('LOW'), 8)).toBe('lite');
    expect(deviceQuality(android('AVERAGE'), 8)).toBe('normal');
    expect(deviceQuality(android('HIGH'), 2)).toBe('high');
  });

  it('без класса — по памяти, без памяти (iPhone, компьютер) — высокий', () => {
    expect(deviceQuality('Chrome', 2)).toBe('lite');
    expect(deviceQuality('Chrome', 4)).toBe('normal');
    expect(deviceQuality('Chrome', 8)).toBe('high');
    expect(deviceQuality('iPhone')).toBe('high');
  });

  it('выбор игрока важнее всего, временное понижение — только вниз', () => {
    expect(resolveQuality('high', 'lite', null)).toBe('lite');
    expect(resolveQuality('lite', 'full', null)).toBe('normal');
    expect(resolveQuality('high', 'full', 'lite')).toBe('high');
    expect(resolveQuality('high', null, 'normal')).toBe('normal');
    expect(resolveQuality('normal', null, 'high')).toBe('normal');
    expect(resolveQuality('lite', null, null)).toBe('lite');
  });
});

describe('понижение графики по FPS', () => {
  const steady = (fps: number) => Array.from({ length: 30 }, (_, i) => fps + (i % 3) * 0.3);

  it('плавно — ничего не меняем', () => {
    expect(fpsVerdict(steady(59), 'high')).toBeNull();
  });

  it('ровные 30 кадров — потолок системы (энергосбережение iPhone), а не слабый телефон', () => {
    expect(fpsVerdict(steady(29.5), 'high')).toBeNull();
    expect(fpsVerdict([...steady(30).slice(0, 28), 24, 26], 'normal')).toBeNull();
  });

  it('ровные 15–25 — не потолок, а слабый телефон: лёгкая графика', () => {
    expect(fpsVerdict(steady(20), 'high')).toBe('lite');
    expect(fpsVerdict(steady(15), 'normal')).toBe('lite');
    expect(fpsVerdict(steady(25), 'high')).toBe('lite');
    expect(fpsVerdict(steady(20), 'lite')).toBeNull();
  });

  it('рваные 30 — тормоза: лёгкая графика', () => {
    const jerky = Array.from({ length: 30 }, (_, i) => [18, 26, 31, 34, 22][i % 5]);
    expect(fpsVerdict(jerky, 'high')).toBe('lite');
    expect(fpsVerdict(jerky, 'normal')).toBe('lite');
    expect(fpsVerdict(jerky, 'lite')).toBeNull();
  });

  it('подтормаживает (40–50) — с высокой на обычную', () => {
    const meh = Array.from({ length: 30 }, (_, i) => [42, 47, 51, 45][i % 4]);
    expect(fpsVerdict(meh, 'high')).toBe('normal');
    expect(fpsVerdict(meh, 'normal')).toBeNull();
  });
});
