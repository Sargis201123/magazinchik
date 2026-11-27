import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  addBed,
  BED_COSTS,
  BEDS_MAX,
  bedCount,
  bedIncome,
  buildGarden,
  GARDEN_FROM_DAY,
  GARDEN_PRICE,
  gardenLook,
  gardenVisible,
  nextBedCost,
  OWN_JAM_DEMAND,
  ownJam,
  YARD_PER_BED,
  yardIncome,
  yardLog,
  yardNight,
  yardStage,
} from '../src/game/garden';
import { lineDemand } from '../src/game/lines';
import { nightCycle, otherIncome } from '../src/game/day';
import { comebackHooks } from '../src/game/comeback';
import { ru } from '../src/i18n/ru';

// «Бабушкин двор» (garden.ts, 27.11): как аренда - каждая грядка каждый вечер приносит 30 × (помещение + 1),
// без сбора, таймеров и прилавка; деньги видны строкой в «Прочих доходах».

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 5, money: 1000, debt: 0, ...over });
const built = (over: Partial<StoreState> = {}): StoreState => buildGarden(shop(over))!;

describe('двор: поставить и вскопать', () => {
  it('теплица - с третьего дня, за деньги, один раз, сразу одна грядка', () => {
    expect(gardenVisible(shop({ day: GARDEN_FROM_DAY - 1 }))).toBe(false);
    expect(buildGarden(shop({ day: GARDEN_FROM_DAY - 1 }))).toBeNull();
    expect(buildGarden(shop({ money: GARDEN_PRICE - 1 }))).toBeNull();
    const state = built();
    expect(state.money).toBe(1000 - GARDEN_PRICE);
    expect(state.garden).toEqual({ beds: 1, since: 0, harvests: 0 });
    expect(bedCount(state)).toBe(1);
    expect(buildGarden(state)).toBeNull();
  });

  it('вторая и третья грядки - за 600 и 1 500, больше трёх нельзя', () => {
    let state = built({ money: 5000 });
    expect(nextBedCost(state)).toBe(BED_COSTS[0]);
    state = addBed(state)!;
    expect(state.money).toBe(5000 - GARDEN_PRICE - BED_COSTS[0]);
    expect(nextBedCost(state)).toBe(BED_COSTS[1]);
    state = addBed(state)!;
    expect(bedCount(state)).toBe(BEDS_MAX);
    expect(nextBedCost(state)).toBeNull();
    expect(addBed(state)).toBeNull();
    expect(addBed(shop())).toBeNull();
    expect(addBed({ ...built(), money: BED_COSTS[0] - 1 })).toBeNull();
  });

  it('в Заречье теплицу не ставят и грядки не копают', () => {
    const zar = { zar: { at: 'zar' } as StoreState['zar'] };
    expect(buildGarden(shop(zar))).toBeNull();
    expect(addBed({ ...built({ money: 5000 }), ...zar })).toBeNull();
  });
});

describe('двор: деньги каждый вечер', () => {
  it('30 × (помещение + 1) за грядку: Универмаг с тремя грядками - 450', () => {
    expect(YARD_PER_BED).toBe(30);
    expect(bedIncome(shop({ level: 0 }))).toBe(30);
    expect(bedIncome(shop({ level: 3 }))).toBe(120);
    expect(bedIncome(shop({ level: 5 }))).toBe(180);
    const three = { ...shop({ level: 4 }), garden: { beds: 3 } };
    expect(yardIncome(three)).toBe(450);
    expect(yardIncome(shop())).toBe(0);
  });

  it('вечер: деньги в кассу, «вчера» и «всего» для карточки', () => {
    const s = { ...built({ level: 2 }), day: 30 };
    const first = yardNight(s);
    expect(first.income).toBe(90);
    expect(first.state.money).toBe(s.money + 90);
    expect(first.state.garden).toEqual({ beds: 1, last: { day: 30, n: 90 }, total: 90, since: 0, harvests: 0 });
    const second = yardNight({ ...first.state, day: 31 }).state;
    expect(second.garden?.total).toBe(180);
    expect(yardLog({ ...second, day: 32 })).toEqual({ last: 90, total: 180 });
    // Вчера двор не платил (пропуск дня) или вечера ещё не было - строки нет.
    expect(yardLog({ ...second, day: 34 })).toBeNull();
    expect(yardLog(s)).toBeNull();
    // Без двора вечер ничего не меняет.
    const plain = shop();
    expect(yardNight(plain)).toEqual({ state: plain, income: 0 });
  });

  it('смена дня (day.ts): двор платит до счетов строкой «Бабушкин двор» в прочих доходах', () => {
    const s = { ...built({ level: 4, money: 5000 }), day: 40 };
    const plain = { ...shop({ level: 4, money: 5000 - GARDEN_PRICE }), day: 40 };
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.yard).toBe(150);
    expect(otherIncome(night)).toContainEqual({ id: 'yard', n: 150 });
    // Разница в кассе с тем же магазином без двора - ровно доход двора.
    const without = nightCycle(plain, emptyDayStats(), () => 0.5);
    expect(night.state.money - night.state.debt - (without.state.money - without.state.debt)).toBe(150);
    expect(otherIncome(without).some((r) => r.id === 'yard')).toBe(false);
    expect(ru['garden.summary']).toContain('🌱');
  });

  it('в Заречье двор в Центре платит, как арендаторы, - по помещению Центра', () => {
    const s = { ...built({ level: 4 }), zar: { at: 'zar', away: { level: 4 } } as unknown as StoreState['zar'], level: 1 };
    expect(yardIncome(s)).toBe(150);
  });
});

describe('двор: варенье из своих яблок', () => {
  it('пока двор стоит и линейка открыта - варенье берут охотнее, без окна в два дня', () => {
    const s = built({ lines: { jam: 1 } });
    expect(ownJam(s)).toBe(true);
    expect(ownJam({ ...s, day: s.day + 30 })).toBe(true);
    expect(ownJam({ ...s, lines: {} })).toBe(false);
    expect(ownJam(shop({ lines: { jam: 1 } }))).toBe(false);
    const noYard = shop({ lines: { jam: 1 } });
    expect(lineDemand(s, 'jam', true) / lineDemand(noYard, 'jam', true)).toBeCloseTo(OWN_JAM_DEMAND);
  });
});

describe('двор: картинка', () => {
  it('грядки растут по ходу дня: утром ростки, к вечеру спело; вид меняется с числом грядок', () => {
    expect(yardStage(0)).toBe(1);
    expect(yardStage(0.4)).toBe(2);
    expect(yardStage(0.8)).toBe(3);
    expect(yardStage(1)).toBe(3);
    expect(yardStage(-1)).toBe(1);
    const s = built({ money: 5000 });
    expect(gardenLook(s, 0)).not.toBe(gardenLook(s, 0.9));
    expect(gardenLook(addBed(s)!, 0)).not.toBe(gardenLook(s, 0));
    expect(gardenLook(shop(), 0.5)).toBe('');
  });
});

describe('двор: старые сохранения (урожай по часам, до 27.11)', () => {
  const old = (garden: unknown): StoreState => ({ ...shop({ level: 4 }), garden: garden as StoreState['garden'] });

  it('грядки считаются по since/more, урожай и таймеры просто не читаются', () => {
    expect(bedCount(old({ since: 1, harvests: 14, own: 99 }))).toBe(1);
    expect(bedCount(old({ since: 1, harvests: 4, crop: 'apples', more: [{ crop: 'apples', since: 1 }, { crop: 'quick', since: 2 }] }))).toBe(3);
    expect(yardIncome(old({ since: 1, harvests: 4, more: [{ crop: 'apples', since: 1 }] }))).toBe(300);
    // Мусор в сохранении: битые грядки не считаем, больше трёх не бывает.
    expect(bedCount(old({ since: 1, harvests: 0, crop: 'cactus', more: [{ crop: 'x', since: 1 }, null, 7] }))).toBe(2);
    expect(bedCount(old({ since: 1, more: [{}, {}, {}, {}, {}] }))).toBe(BEDS_MAX);
    expect(bedCount(old({ beds: 99 }))).toBe(BEDS_MAX);
    expect(bedCount(old({ beds: -4 }))).toBe(1);
  });

  it('первый вечер переводит двор в новый вид, грядок столько же; докопать можно дальше', () => {
    const s = old({ since: 1, harvests: 5, crop: 'mix', own: 200, watered: 2, more: [{ crop: 'apples', since: 1 }] });
    const night = yardNight({ ...s, day: 50 });
    expect(night.state.garden).toEqual({ beds: 2, last: { day: 50, n: 300 }, total: 300, since: 0, harvests: 0, more: [{ crop: 'apples', since: 0 }] });
    const dug = addBed({ ...s, money: 5000 })!;
    expect(dug.garden).toEqual({ beds: 3, since: 0, harvests: 0, more: [{ crop: 'apples', since: 0 }, { crop: 'quick', since: 0 }] });
    expect(dug.money).toBe(5000 - BED_COSTS[1]);
  });

  it('откат на код до 27.11: грядки, купленные и после вечера, он насчитает столько же, таймеры без NaN', () => {
    // Как грядки читает код до 27.11 (bedsOf на 0a5ba02): первая - since, остальные - more с культурой и since.
    const oldBeds = (g: StoreState['garden']): number => {
      const more = (Array.isArray(g?.more) ? g.more : []).filter((b) => {
        const bed = b as { crop?: unknown; since?: unknown } | null;
        return Boolean(bed) && ['quick', 'mix', 'apples'].includes(String(bed!.crop)) && Number.isFinite(bed!.since);
      });
      return Number.isFinite(g?.since) ? 1 + more.slice(0, BEDS_MAX - 1).length : NaN;
    };
    let s = built({ money: 5000, level: 3 });
    for (let beds = 1; beds <= BEDS_MAX; beds++) {
      expect(oldBeds(s.garden)).toBe(beds);
      const evening = yardNight({ ...s, day: 40 + beds }).state;
      expect(oldBeds(evening.garden)).toBe(beds);
      expect(typeof evening.garden?.harvests).toBe('number');
      if (beds < BEDS_MAX) s = addBed(evening)!;
    }
  });

  it('грядку докупили в старом клиенте (он пишет только more, beds не трогает) - новый код её не теряет', () => {
    const s = built({ money: 5000, level: 3 });
    // Старый addBed: ...g и ещё одна запись в more; beds остаётся 1.
    const g = { ...s.garden!, more: [...(s.garden!.more ?? []), { crop: 'mix', since: 0 }] };
    const back = { ...s, garden: g };
    expect(bedCount(back)).toBe(2);
    expect(yardIncome(back)).toBe(2 * bedIncome(back));
    // Вечер переносит грядку в новый вид.
    expect(yardNight({ ...back, day: 50 }).state.garden?.beds).toBe(2);
  });

  it('бот про урожай больше не зовёт: в поводах игры нет поля ripe', () => {
    expect('ripe' in comebackHooks(old({ since: 1, harvests: 0 }))).toBe(false);
  });
});

describe('двор: сохранение в телефоне', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение с урожаем по часам грузится без ошибок, грядки на месте', async () => {
    vi.resetModules();
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
    const { loadGame } = await import('../src/game/save');
    const saved = { ...shop({ level: 3 }), garden: { since: 1_700_000_000_000, harvests: 9, crop: 'quick', more: [{ crop: 'apples', since: 1 }, { crop: 'mix', since: 2 }], own: 12, watered: 1 } };
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: saved });
    const loaded = loadGame()!;
    expect(bedCount(loaded)).toBe(3);
    expect(yardIncome(loaded)).toBe(3 * 120);
    expect(nightCycle(loaded, emptyDayStats(), () => 0.5).yard).toBe(360);
  });
});
