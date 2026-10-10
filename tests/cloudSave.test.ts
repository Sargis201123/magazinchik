import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/game/economy';

// Поддельные Telegram и localStorage: облако — просто словарь.
function fakeEnv(user = 7) {
  const cloud: Record<string, string> = {};
  const local: Record<string, string> = {};
  const CloudStorage = {
    setItem: (k: string, v: string, cb?: (e: string | null, ok?: boolean) => void) => {
      if (v.length > 4096) return cb?.('VALUE_TOO_LONG');
      cloud[k] = v;
      cb?.(null, true);
    },
    getItem: (k: string, cb: (e: string | null, v?: string) => void) => cb(null, cloud[k] ?? ''),
    getItems: (ks: string[], cb: (e: string | null, v?: Record<string, string>) => void) =>
      cb(null, Object.fromEntries(ks.map((k) => [k, cloud[k]]))),
    removeItems: () => {},
  };
  Object.assign(globalThis, {
    window: { Telegram: { WebApp: { initData: 'x', initDataUnsafe: { user: { id: user } }, isVersionAtLeast: () => true, CloudStorage } } },
    localStorage: {
      getItem: (k: string) => local[k] ?? null,
      setItem: (k: string, v: string) => (local[k] = v),
      removeItem: (k: string) => delete local[k],
    },
  });
  return { cloud, local };
}

describe('облачное сохранение', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('сохранение уходит в облако кусками и читается обратно', async () => {
    const env = fakeEnv();
    const save = await import('../src/game/save');
    const big = { ...newGame(), day: 42, history: Array.from({ length: 3000 }, (_, i) => i) };
    save.saveGame(big);
    await save.flushCloud();
    const meta = JSON.parse(env.cloud.save_meta);
    expect(meta.n).toBeGreaterThan(1);
    // Телефон очистили — при запуске магазин вернётся из облака.
    delete env.local['magazinchik.save'];
    await save.syncSave();
    expect(save.loadGame()?.day).toBe(42);
  });

  it('берётся более свежее сохранение; второе сохранение пишет в другой слот', async () => {
    const env = fakeEnv();
    const save = await import('../src/game/save');
    save.saveGame({ ...newGame(), day: 5 });
    await save.flushCloud();
    const first = JSON.parse(env.cloud.save_meta).slot;
    save.saveGame({ ...newGame(), day: 6 });
    await save.flushCloud();
    expect(JSON.parse(env.cloud.save_meta).slot).not.toBe(first);
    // В телефоне более старое — победит облако.
    env.local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...newGame(), day: 3 }, savedAt: 1, user: 7 });
    await save.syncSave();
    expect(save.loadGame()?.day).toBe(6);
  });

  it('в телефоне свежее — уходит в облако; чужое сохранение не подхватываем', async () => {
    const env = fakeEnv(7);
    const save = await import('../src/game/save');
    env.local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...newGame(), day: 9 }, savedAt: Date.now(), user: 7 });
    await save.syncSave();
    expect(env.cloud.save_meta).toBeDefined();
    // Другой игрок Telegram на этом же телефоне, облако у него пустое.
    const other = fakeEnv(8);
    other.local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...newGame(), day: 9 }, savedAt: Date.now(), user: 7 });
    vi.resetModules();
    const save2 = await import('../src/game/save');
    await save2.syncSave();
    expect(save2.loadGame()).toBeNull();
  });
});
