import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { buyHood, hasHood, HOOD, HOOD_FINAL, HOOD_IDS, hoodGuests, hoodLock, hoodLook, hoodOwned, hoodSpent, hoodTips, hoodVisible, nextHood } from '../src/game/hood';
import { guestFactor } from '../src/game/day';
import { ACHIEVEMENTS, liveProgress } from '../src/game/achievements';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';
import { SPRITES } from '../src/scenes/textures';
import { simulate } from '../src/game/simulate';

// Благоустройство района (hood.ts): когда открывается, покупка, польза, памятник последним,
// достижения, тексты, картинки и старые сохранения.

const rich = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 120, level: 4, money: 3_000_000, debt: 0, rating: 4, ...over });
const all = (state: StoreState): StoreState => HOOD_IDS.reduce((s, id) => buyHood(s, id) ?? s, state);

describe('район: список', () => {
  it('8–12 улучшений, цены от 10 тыс. до 300 тыс. и растут, памятник — миллион', () => {
    expect(HOOD_IDS.length).toBeGreaterThanOrEqual(8);
    expect(HOOD_IDS.length).toBeLessThanOrEqual(12);
    const prices = HOOD_IDS.map((id) => HOOD[id].price);
    expect(Math.min(...prices)).toBe(10000);
    expect(Math.max(...prices.slice(0, -1))).toBe(300000);
    expect(HOOD[HOOD_FINAL].price).toBe(1_000_000);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(HOOD_IDS[HOOD_IDS.length - 1]).toBe(HOOD_FINAL);
  });

  it('польза маленькая: гостей +1–3% за каждое, всего меньше +20%', () => {
    for (const id of HOOD_IDS) {
      expect(HOOD[id].guests).toBeGreaterThanOrEqual(0.01);
      expect(HOOD[id].guests).toBeLessThanOrEqual(0.03);
    }
    expect(hoodGuests(all(rich()))).toBeLessThan(1.2);
  });

  it('открываются с третьего помещения, дорогие — позже', () => {
    expect(hoodVisible(rich({ level: 1 }))).toBe(false);
    expect(hoodVisible(rich({ level: 2 }))).toBe(true);
    for (const id of HOOD_IDS) {
      expect(HOOD[id].level).toBeGreaterThanOrEqual(2);
      expect(HOOD[id].level).toBeLessThan(STORE_LEVELS.length);
    }
    expect(hoodLock(rich({ level: 2 }), 'lamps')).toBeNull();
    expect(hoodLock(rich({ level: 2 }), 'fountain')).toBe('level');
  });
});

describe('район: покупка', () => {
  it('забирает деньги, запоминает день и ставит рейтинг', () => {
    const s = buyHood(rich(), 'beds')!;
    expect(s.money).toBe(3_000_000 - HOOD.beds.price);
    expect(s.hood).toEqual({ beds: 120 });
    expect(s.rating).toBe(4.05);
    expect(hasHood(s, 'beds')).toBe(true);
    expect(hoodSpent(s)).toBe(HOOD.beds.price);
  });

  it('второй раз не купить; без денег, в долг и на маленьком магазине — нельзя', () => {
    const s = buyHood(rich(), 'lamps')!;
    expect(buyHood(s, 'lamps')).toBeNull();
    expect(buyHood(rich({ money: 9999 }), 'lamps')).toBeNull();
    expect(buyHood(rich({ debt: 100 }), 'lamps')).toBeNull();
    expect(buyHood(rich({ level: 1 }), 'lamps')).toBeNull();
  });

  it('рейтинг не выше пяти', () => {
    expect(buyHood(rich({ rating: 4.98 }), 'benches')!.rating).toBe(5);
  });

  it('памятник бабушке — только когда весь остальной район готов', () => {
    const without = HOOD_IDS.filter((id) => id !== HOOD_FINAL).slice(1).reduce((s, id) => buyHood(s, id)!, rich());
    expect(hoodLock(without, HOOD_FINAL)).toBe('rest');
    expect(buyHood(without, HOOD_FINAL)).toBeNull();
    const ready = buyHood(without, HOOD_IDS[0])!;
    expect(hoodLock(ready, HOOD_FINAL)).toBeNull();
    expect(hasHood(buyHood(ready, HOOD_FINAL)!, HOOD_FINAL)).toBe(true);
  });

  it('nextHood — самое дешёвое из доступного', () => {
    expect(nextHood(rich({ level: 2 }))).toBe('lamps');
    expect(nextHood(buyHood(rich({ level: 2 }), 'lamps')!)).toBe('beds');
    expect(nextHood(all(rich()))).toBeNull();
  });
});

describe('район: польза', () => {
  it('гостей больше — через общий множитель дня', () => {
    const before = rich();
    const after = buyHood(before, 'bus')!;
    expect(hoodGuests(after)).toBeCloseTo(1.02, 6);
    expect(guestFactor(after) / guestFactor({ ...before, rating: after.rating })).toBeCloseTo(1.02, 6);
  });

  it('чаевые постоянных — с росписью, ярмаркой и памятником', () => {
    expect(hoodTips(rich())).toBe(1);
    expect(hoodTips(all(rich()))).toBeCloseTo(1.25, 6);
  });

  it('ключ улицы меняется с каждой покупкой', () => {
    const a = buyHood(rich(), 'lamps')!;
    const b = buyHood(a, 'fountain')!;
    expect(hoodLook(rich())).toBe('');
    expect(hoodLook(a)).not.toBe(hoodLook(b));
  });
});

describe('район: симулятор', () => {
  // Числа — docs/BALANCE.md «Район» (npm run sim:hood). Без механики «hood» симулятор район не трогает.
  it('обычный игрок к 150-му дню берёт несколько улучшений и не прогорает; без механики — ничего', () => {
    const r = simulate({ days: 150, seed: 1, buyMode: 'restock', features: { hood: true } });
    expect(r.bankruptDay).toBeNull();
    expect(hoodOwned(r.final).length).toBeGreaterThanOrEqual(3);
    expect(hasHood(r.final, HOOD_FINAL)).toBe(false);
    expect(simulate({ days: 60, seed: 1, buyMode: 'restock' }).final.hood).toBeUndefined();
  }, 60000);
});

describe('район: достижения', () => {
  const progress = (id: string, state: StoreState) => ACHIEVEMENTS.find((a) => a.id === id)!.progress(liveProgress(state));
  it('первое, шесть и памятник', () => {
    const one = buyHood(rich(), 'lamps')!;
    expect(progress('hood_first', one)).toEqual([1, 1]);
    expect(progress('hood_half', one)).toEqual([1, 6]);
    expect(progress('hood_all', all(rich()))).toEqual([1, 1]);
  });
});

describe('район: тексты и картинки', () => {
  it('у каждого улучшения есть имя и описание на обоих языках', () => {
    for (const id of HOOD_IDS) {
      for (const dict of [ru, en] as Record<string, string>[]) {
        expect(dict[`hood.${id}`]).toBeTruthy();
        expect(dict[`hood.${id}.desc`]).toBeTruthy();
      }
    }
    for (const key of ['ach.hood_first', 'ach.hood_half', 'ach.hood_all', 'news.hood', 'hood.title']) expect((en as Record<string, string>)[key]).toBeTruthy();
  });

  it('спрайты района — в списке текстур (атлас)', () => {
    for (const key of ['hood_lamp', 'hood_planter', 'hood_planter_winter', 'hood_bikes', 'hood_bus', 'hood_mural', 'hood_fir', 'hood_fir_xmas', 'hood_fountain', 'hood_playground', 'hood_flowerbox', 'hood_stall_R', 'hood_stall_U', 'hood_stall_E', 'hood_statue']) {
      expect(SPRITES).toContain(key);
    }
  });
});

describe('район: сохранения', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => local[k] ?? null,
        setItem: (k: string, v: string) => {
          local[k] = v;
        },
        removeItem: (k: string) => delete local[k],
      },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение без района грузится: ничего не куплено, всё можно купить', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = rich() as unknown as Record<string, unknown>;
    delete old.hood;
    local['magazinchik.save'] = JSON.stringify({ version: 10, state: old });
    const s = loadGame()!;
    expect(s.hood).toBeUndefined();
    expect(hoodOwned(s)).toEqual([]);
    expect(hoodGuests(s)).toBe(1);
    expect(buyHood(s, 'lamps')?.hood).toEqual({ lamps: 120 });
  });

  it('чужие ключи и мусор в поле не ломают игру', async () => {
    const { loadGame } = await import('../src/game/save');
    local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...rich(), hood: { lamps: 5, castle: 7, fountain: 'x' } } });
    const s = loadGame()!;
    expect(hoodOwned(s)).toEqual(['lamps']);
    expect(hoodGuests(s)).toBeCloseTo(1.01, 6);
  });

  it('купленное переживает сохранение и загрузку', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const s = buyHood(buyHood(rich(), 'lamps')!, 'mural')!;
    saveGame(s);
    expect(loadGame()!.hood).toEqual({ lamps: 120, mural: 120 });
  });
});
