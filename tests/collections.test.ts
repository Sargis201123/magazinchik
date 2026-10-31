import { afterEach, describe, expect, it } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import {
  albumGolden,
  collect,
  COLLECTION_SETS,
  earned,
  freshCount,
  gotIn,
  HOLIDAY_DAY,
  migrateCollections,
  seeAlbum,
  setCoins,
  setDone,
  setsDone,
  SET_IDS,
  syncCollections,
  takeParty,
  trophyKey,
  type SetId,
} from '../src/game/collections';
import { RARE_GUESTS } from '../src/game/endless';
import { restartGame } from '../src/game/restart';
import { ACHIEVEMENTS, liveProgress } from '../src/game/achievements';
import { SPRITES } from '../src/scenes/textures';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

const fill = (state: StoreState, set: SetId): StoreState =>
  COLLECTION_SETS.find((s) => s.id === set)!.items.reduce((s, i) => collect(s, set, i.id), state);

describe('альбом коллекций', () => {
  it('наборов 7, в каждом 5–10 предметов (кроме прежнего альбома гостей), id не повторяются', () => {
    expect(COLLECTION_SETS).toHaveLength(7);
    for (const set of COLLECTION_SETS) {
      const ids = set.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      if (set.id === 'guests') expect(ids).toEqual(RARE_GUESTS.map((g) => g.id));
      else {
        expect(ids.length).toBeGreaterThanOrEqual(5);
        expect(ids.length).toBeLessThanOrEqual(10);
      }
    }
  });

  it('у каждого предмета, набора и трофея есть тексты на обоих языках и картинка', () => {
    const keys = new Set<string>();
    for (const set of COLLECTION_SETS) {
      keys.add(`col.set.${set.id}`).add(`col.hint.${set.id}`).add(`col.trophy.${set.id}`);
      for (const item of set.items) {
        keys.add(item.nameKey);
        if (item.hintKey) keys.add(item.hintKey);
      }
      expect(SPRITES).toContain(trophyKey(set.id));
    }
    for (const k of keys) {
      expect(ru, k).toHaveProperty([k]);
      expect(en, k).toHaveProperty([k]);
    }
    expect(SPRITES).toContain('trophy_case');
    expect(SPRITES).toContain('trophy_case_gold');
  });

  it('новый предмет — в альбом с меткой «новое»; повтор и чужой id ничего не меняют', () => {
    const s0 = newGame();
    const s1 = collect(s0, 'recipes', 'borscht');
    expect(gotIn(s1, 'recipes')).toEqual(['borscht']);
    expect(freshCount(s1)).toBe(1);
    expect(collect(s1, 'recipes', 'borscht')).toBe(s1);
    expect(collect(s1, 'recipes', 'pizza')).toBe(s1);
    expect(seeAlbum(s1, 'recipes').collections!.fresh).toEqual([]);
    expect(seeAlbum(s1, 'moments')).toBe(s1);
  });

  it('собрал набор — монеты сразу, один раз, и праздник в очередь', () => {
    const s0 = { ...newGame(), level: 2, money: 1000 };
    const s1 = fill(s0, 'moments');
    expect(setDone(s1, 'moments')).toBe(true);
    expect(s1.money).toBe(1000 + setCoins(2));
    const party = takeParty(s1);
    expect(party.sets).toEqual(['moments']);
    expect(takeParty(party.state).sets).toEqual([]);
    // Уже собранный набор второй раз не платит.
    expect(fill(party.state, 'moments').money).toBe(s1.money);
  });

  it('у гостей своя награда за альбом — набор монет не добавляет', () => {
    const s = fill({ ...newGame(), money: 0 }, 'guests');
    expect(setDone(s, 'guests')).toBe(true);
    expect(s.money).toBe(0);
  });

  it('награда за набор — меньше дня прибыли на любом помещении', () => {
    // Прибыль дня (docs/BALANCE.md): ~250 в ларьке, ~3000 в универмаге и больше в гипермаркете.
    expect(setCoins(0)).toBeLessThanOrEqual(250);
    expect(setCoins(STORE_LEVELS.length - 1)).toBeLessThanOrEqual(1500);
    const all = SET_IDS.reduce((s, id) => s + (COLLECTION_SETS.find((x) => x.id === id)!.coins ? setCoins(4) : 0), 0);
    expect(all).toBeLessThan(10_000);
  });

  it('все наборы — золотая обложка и достижение', () => {
    let s = newGame();
    for (const id of SET_IDS) s = fill(s, id);
    expect(setsDone(s)).toBe(SET_IDS.length);
    expect(albumGolden(s)).toBe(true);
    const ach = ACHIEVEMENTS.find((a) => a.id === 'collections')!;
    expect(ach.progress(liveProgress(s))).toEqual([SET_IDS.length, SET_IDS.length]);
    expect(ach.progress(liveProgress(newGame()))[0]).toBe(0);
  });

  it('альбом сам добирает то, что видно по магазину', () => {
    const s: StoreState = {
      ...newGame(),
      day: HOLIDAY_DAY.bbq,
      level: 3,
      album: ['mayor', 'pirate'],
      regulars: { petr: { loyalty: 3, awayUntil: 0 }, sveta: { loyalty: 4, awayUntil: 0 } },
      kitchen: { olivier: 3, ukha: 0 },
      live: { cards: { 'newyear:2025': ['2025-12-01'], 'march8:2026': ['2026-03-06'] } },
    };
    const got = syncCollections(s);
    expect(gotIn(got, 'guests')).toEqual(['mayor', 'pirate']);
    expect(gotIn(got, 'shops')).toEqual(['l0', 'l1', 'l2', 'l3']);
    expect(gotIn(got, 'friends')).toEqual(['petr', 'sveta']);
    expect(gotIn(got, 'recipes')).toEqual(['olivier']);
    expect(gotIn(got, 'holidays')).toEqual(expect.arrayContaining(['newyear', 'march8', 'bbq', 'live_newyear', 'live_march8']));
    expect(gotIn(got, 'holidays')).not.toContain('harvest');
    // Второй раз — ничего нового, то же состояние.
    expect(syncCollections(got)).toBe(got);
  });

  it('ларёк есть у всех с начала — без метки «новое»', () => {
    const s = syncCollections(newGame());
    expect(gotIn(s, 'shops')).toEqual(['l0']);
    expect(freshCount(s)).toBe(0);
  });

  it('праздники игрового года — в первый год, по порядку', () => {
    const days = Object.values(HOLIDAY_DAY);
    for (const d of days) expect(Number.isFinite(d)).toBe(true);
    expect(HOLIDAY_DAY.newyear).toBeLessThan(HOLIDAY_DAY.march8);
    expect(HOLIDAY_DAY.halloween).toBeLessThan(HOLIDAY_DAY.harvest);
  });

  it('филиал, кот и Бобик попадают в альбом', () => {
    const base = newGame();
    const s = { ...base, branch: {} as StoreState['branch'], cat: { name: 'Мурка', since: 3, fedDay: 3, beds: [] }, security: { dog: { since: 5 } } as StoreState['security'] };
    const items = earned(s).map(([set, id]) => `${set}:${id}`);
    expect(items).toEqual(expect.arrayContaining(['shops:branch', 'friends:cat', 'friends:bobik']));
  });

  it('после «Начать заново» альбом и трофеи остаются', () => {
    const s = fill(newGame(), 'recipes');
    const again = restartGame(s);
    expect(setDone(again, 'recipes')).toBe(true);
    expect(gotIn(again, 'recipes')).toHaveLength(6);
  });
});

describe('старые сохранения', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('миграция добирает заработанное и платит за собранный набор', () => {
    const old: StoreState = { ...newGame(), level: 4, money: 500, album: RARE_GUESTS.map((g) => g.id) };
    delete old.collections;
    const s = migrateCollections(old);
    expect(setDone(s, 'guests')).toBe(true);
    expect(gotIn(s, 'shops')).toHaveLength(5);
    // Набор гостей своих монет не даёт (их уже выдал прежний альбом).
    expect(s.money).toBe(500);
    expect(takeParty(s).sets).toEqual(['guests']);
  });

  it('сохранение без поля collections загружается и получает альбом', async () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => local[k] ?? null,
        setItem: (k: string, v: string) => (local[k] = v),
        removeItem: (k: string) => delete local[k],
      },
    });
    const state: StoreState = { ...newGame(), day: 30, level: 2, album: ['blogger'] };
    delete state.collections;
    local['magazinchik.save'] = JSON.stringify({ version: 10, state });
    const { loadGame } = await import('../src/game/save');
    const loaded = loadGame()!;
    expect(gotIn(loaded, 'guests')).toEqual(['blogger']);
    expect(gotIn(loaded, 'shops')).toEqual(['l0', 'l1', 'l2']);
    expect(loaded.day).toBe(30);
  });
});
