import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/game/economy';

// Сохранение в телефоне: битые и чужие версии не ломают игру, недоступное хранилище — тоже,
// а новые поля (охрана, конкурс, сюжет) переживают сохранение и загрузку.
let local: Record<string, string> = {};
let broken = false;
beforeEach(() => {
  vi.resetModules();
  local = {};
  broken = false;
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => {
        if (broken) throw new Error('SecurityError');
        return local[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (broken) throw new Error('QuotaExceeded');
        local[k] = v;
      },
      removeItem: (k: string) => delete local[k],
    },
  });
});
afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

const KEY = 'magazinchik.save';

describe('сохранение в телефоне', () => {
  it('битый файл, слишком старая или будущая версия — начинаем заново, без ошибки', async () => {
    const { loadGame } = await import('../src/game/save');
    local[KEY] = '{oops';
    expect(loadGame()).toBeNull();
    local[KEY] = JSON.stringify({ version: 8, state: newGame() });
    expect(loadGame()).toBeNull();
    local[KEY] = JSON.stringify({ version: 99, state: newGame() });
    expect(loadGame()).toBeNull();
  });

  it('старое сохранение без новых полей: цены новых товаров берутся по умолчанию', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 30, money: 777 } as Record<string, unknown>;
    old.prices = { bread: 55 };
    delete old.security;
    delete old.contest;
    delete old.drama;
    local[KEY] = JSON.stringify({ version: 9, state: old });
    const s = loadGame()!;
    expect(s.day).toBe(30);
    expect(s.money).toBe(777);
    expect(s.prices.bread).toBe(55);
    expect(s.prices.milk).toBe(newGame().prices.milk);
    expect(s.security).toBeUndefined();
  });

  it('охрана, конкурс и сюжет сохраняются и загружаются', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const state = {
      ...newGame(),
      day: 120,
      security: { dog: { since: 9 }, watchman: true, caught: 2 },
      contest: { tier: 1, phase: 'wait' as const, since: 110, target: 7000, revenue: 0, served: 0, unhappy: 0, empty: 0, wins: 1 },
      drama: { upTo: 91, last: 100 },
    };
    saveGame(state);
    const s = loadGame()!;
    expect(s.security).toEqual(state.security);
    expect(s.contest).toEqual(state.contest);
    expect(s.drama).toEqual(state.drama);
  });

  it('хранилище недоступно (приватный режим) — игра идёт без сохранения, не падает', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    broken = true;
    expect(loadGame()).toBeNull();
    expect(() => saveGame(newGame())).not.toThrow();
  });
});
