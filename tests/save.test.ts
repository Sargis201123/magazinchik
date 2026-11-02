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
      security: { dog: { since: 9 } },
      contest: { tier: 1, phase: 'wait' as const, since: 110, target: 7000, revenue: 0, served: 0, unhappy: 0, empty: 0, wins: 1 },
      drama: { upTo: 91, last: 100 },
    };
    saveGame(state);
    const s = loadGame()!;
    expect(s.security).toEqual(state.security);
    expect(s.contest).toEqual(state.contest);
    expect(s.drama).toEqual(state.drama);
  });

  it('старое сохранение с убранными 02.11 механиками грузится: поля сняты, Бобик и купленное остаются', async () => {
    const { loadGame } = await import('../src/game/save');
    const fresh = newGame();
    const old = {
      ...fresh,
      day: 50,
      money: 3210,
      skills: { hands: 3, eye: 1 },
      quitNotice: [{ role: 'loader', name: 3, skill: 1, wage: 300, months: 2 }],
      shelves: [{ ...fresh.shelves[0], broken: true }, ...fresh.shelves.slice(1)],
      storedShelves: [{ kind: 'dairy', level: 1, items: {}, broken: true }],
      staff: [
        { role: 'cashier2', name: 1, skill: 2, wage: 520, months: 4, raiseAsk: 560, upset: true, streak: 9, offDay: 51, inspired: 2, career: { hired: 10, xp: 33, miss: 2, askAfter: 60, rank: 'senior' } },
      ],
      plan: { day: 50, decided: false, inspection: false, quests: [], sick: 'cashier2', event: { kind: 'bill', reason: 'tax', amount: 400 } },
      security: { dog: { since: 9 }, watchman: true, caught: 2, scared: 1, lastBurglary: 48, news: { day: 50, outcome: 'stolen', goods: [], cash: 10, repair: 0, bounty: 0 } },
      career: { since: 30, offer: { role: 'cashier2', name: 1, to: 'admin', day: 50 }, ceremony: { role: 'cashier2', name: 1, day: 49, shifts: 9, work: 30, miss: 1 } },
      newsQ: { day: 50, done: 0, shown: 'raise', wait: { burglary: 50, quit: 49, tale: 48 } },
    };
    local[KEY] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()! as unknown as Record<string, unknown> & ReturnType<typeof newGame>;
    expect(s.money).toBe(3210);
    expect(s.skills).toBeUndefined();
    expect(s.quitNotice).toBeUndefined();
    expect(s.shelves.some((sh) => 'broken' in sh)).toBe(false);
    expect((s.storedShelves ?? []).some((sh) => 'broken' in sh)).toBe(false);
    const m = s.staff[0];
    // Прибавку, что уже платили, оставили; просьба, обида, усталость и выходной сняты; звание и воодушевление — на месте.
    expect(m).toMatchObject({ wage: 520, inspired: 2, career: { hired: 10, xp: 33, rank: 'senior' } });
    for (const k of ['raiseAsk', 'upset', 'streak', 'offDay']) expect(k in m).toBe(false);
    expect('miss' in m.career! || 'askAfter' in m.career!).toBe(false);
    expect(s.plan?.event).toBeUndefined();
    expect(s.plan && 'sick' in s.plan).toBe(false);
    expect(s.security).toEqual({ dog: { since: 9 } });
    expect(s.career?.offer).toBeUndefined();
    expect(s.career?.ceremony).toEqual({ role: 'cashier2', name: 1, day: 49, shifts: 9, work: 30 });
    expect(s.newsQ).toEqual({ day: 50, done: 0, wait: { tale: 48 } });
  });

  it('новое сохранение миграция «спокойного персонала» не трогает', async () => {
    const { migrateCalm } = await import('../src/game/calm');
    const s = { ...newGame(), security: { dog: { since: 3 } } };
    expect(migrateCalm(s)).toEqual(s);
    expect(migrateCalm(newGame())).toEqual(newGame());
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
