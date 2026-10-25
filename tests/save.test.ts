import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/game/economy';
import { decodeWear, encodeWear, wearGrid } from '../src/game/wear';

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

  it('потёртость пола переживает сохранение; без неё (старое сохранение) или испорченная — чистый пол', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const grid = wearGrid(176, 224 - 26);
    const cells = new Float32Array(grid.cols * grid.rows);
    cells[40] = 0.5;
    cells[41] = 1;
    saveGame({ ...newGame(), level: 1, floorWear: encodeWear(cells, 1, grid) });
    const back = decodeWear(loadGame()!.floorWear, 1, grid);
    expect(back[41]).toBe(1);
    expect(back[40]).toBeCloseTo(0.5, 1);
    // Сохранение версии 10 — поля ещё не было.
    const old = { ...newGame(), level: 1 } as Record<string, unknown>;
    delete old.floorWear;
    local[KEY] = JSON.stringify({ version: 10, state: old });
    expect(decodeWear(loadGame()!.floorWear, 1, grid).every((v) => v === 0)).toBe(true);
    // Облако вернуло что-то странное — игра грузится, пол чистый.
    for (const junk of [null, 5, 'x', { level: 1, cols: grid.cols, rows: grid.rows, data: 7 }, { level: 1, cols: grid.cols, rows: grid.rows, data: '!!' }]) {
      local[KEY] = JSON.stringify({ version: 11, state: { ...newGame(), level: 1, floorWear: junk } });
      const state = loadGame()!;
      expect(decodeWear(state.floorWear, 1, grid).every((v) => v === 0)).toBe(true);
    }
  });
});
