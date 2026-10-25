import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Вибрация Telegram понарошку: запоминает, сколько раз телефон дрогнул.
let calls: string[] = [];
const store = new Map<string, string>();

beforeEach(() => {
  calls = [];
  store.clear();
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal('window', {
    Telegram: {
      WebApp: { HapticFeedback: { impactOccurred: (s: string) => calls.push(`impact:${s}`), notificationOccurred: (s: string) => calls.push(`note:${s}`) } },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('вибрация', () => {
  it('по умолчанию включена', async () => {
    const { haptic, hapticsEnabled } = await import('../src/platform/telegram');
    expect(hapticsEnabled()).toBe(true);
    haptic.tap();
    haptic.success();
    expect(calls).toEqual(['impact:light', 'note:success']);
  });

  it('выключили — телефон молчит, и это помнится после перезапуска', async () => {
    const first = await import('../src/platform/telegram');
    first.setHaptics(false);
    first.haptic.tap();
    first.haptic.error();
    expect(calls).toEqual([]);
    expect(store.get('magazinchik.haptics')).toBe('0');
    vi.resetModules();
    const again = await import('../src/platform/telegram');
    expect(again.hapticsEnabled()).toBe(false);
    again.haptic.success();
    expect(calls).toEqual([]);
  });

  it('включили снова — короткий отклик и дальше как обычно', async () => {
    store.set('magazinchik.haptics', '0');
    const { haptic, setHaptics } = await import('../src/platform/telegram');
    setHaptics(true);
    haptic.tap();
    expect(calls).toEqual(['impact:light', 'impact:light']);
  });
});
