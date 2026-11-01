import { describe, expect, it } from 'vitest';
import { homemade, newGame, onShelves, ownProductOpen, PRODUCTS, sellableProducts, type StaffMember, type StoreState, type Unit } from '../src/game/economy';
import {
  brandFame,
  buyLineTier,
  LINE_IDS,
  LINE_MAX,
  LINES,
  lineDemand,
  lineInputNeed,
  lineLock,
  lineSeason,
  lineStock,
  lineWants,
  linesSold,
  makeLines,
  nextLineCost,
} from '../src/game/lines';
import { brandDemand } from '../src/game/brand';
import { pickWanted } from '../src/game/endless';
import { restockPlan } from '../src/game/restock';
import { loadGame, saveGame } from '../src/game/save';
import { nightCycle } from '../src/game/day';
import { emptyDayStats } from '../src/game/economy';
import { yearTime } from '../src/game/calendar';
import { MONTH_DAYS } from '../src/game/economy';

const units = (n: number, age = 0): Unit[] => Array.from({ length: n }, () => ({ age }));
const cook: StaffMember = { role: 'cook', name: 0, skill: 2, wage: 400, months: 0 };
/** Магазин третьего помещения: полки овощей, заморозки и напитков, на складе яблоки, мясо и хлеб. */
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 30,
  money: 30000,
  level: 3,
  upgrades: ['kitchen'],
  staff: [cook],
  shelves: [
    { kind: 'produce', level: 1, items: { apples: units(4) } },
    { kind: 'frozen', level: 1, items: {} },
    { kind: 'drinks', level: 1, items: {} },
    { kind: 'bakery', level: 1, items: { bread: units(4) } },
  ],
  warehouse: { apples: units(10, 2), meat: units(6), bread: units(6) },
  ...patch,
});
/** Первый день месяца с этим временем года. */
const dayIn = (time: string): number => {
  for (let d = 1; d < 400; d += MONTH_DAYS) if (yearTime(d) === time && yearTime(d + 1) === time) return d;
  throw new Error(time);
};

describe('своя марка на полках', () => {
  it('ступени по очереди: замки по помещению и кухне, цена растёт, после третьей — всё', () => {
    expect(lineLock(shop({ level: 1 }), 'jam')).toBe('level');
    expect(lineLock(shop({ upgrades: [] }), 'pelmeni')).toBe('kitchen');
    expect(buyLineTier(shop({ level: 1 }), 'jam')).toBeNull();
    let s = shop();
    for (let n = 0; n < LINE_MAX; n++) {
      const cost = nextLineCost(s, 'jam')!;
      const next = buyLineTier(s, 'jam')!;
      expect(next.money).toBe(s.money - cost);
      expect(next.lines?.jam).toBe(n + 1);
      s = next;
    }
    expect(nextLineCost(s, 'jam')).toBeNull();
    expect(buyLineTier(s, 'jam')).toBeNull();
    expect(buyLineTier(shop({ money: 10 }), 'jam')).toBeNull();
    for (const id of LINE_IDS) expect([...LINES[id].costs]).toEqual([...LINES[id].costs].sort((a, b) => a - b));
  });

  it('товар линейки продаётся только открытым и только когда стоит на полке; его нет у поставщиков', () => {
    expect(sellableProducts(shop())).not.toContain('jam');
    expect(ownProductOpen(shop(), 'jam')).toBe(false);
    const s = shop({ lines: { jam: 1 } });
    expect(sellableProducts(s)).toContain('jam');
    expect(homemade('jam')).toBe(true);
    expect(homemade('apples')).toBe(false);
    // На полке пусто — специально за вареньем не идут.
    for (let i = 0; i < 30; i++) expect(pickWanted(s, Math.random, 3)).not.toContain('jam');
    // «Закупить нужное» его не закупает.
    const plan = restockPlan(s, () => 10, 100);
    expect(plan.lines.some((l) => l.pid === 'jam')).toBe(false);
  });

  it('ночью доделывают запас до нормы из сырья (старое — первым) и кладут на полки', () => {
    const s = shop({ lines: { jam: 1 } });
    const { state, night } = makeLines(s);
    const norm = lineStock(s, 'jam');
    expect(night.made).toEqual([{ id: 'jam', made: norm }]);
    expect(onShelves(state, 'jam') + (state.warehouse.jam?.length ?? 0)).toBe(norm);
    // Яблоки ушли — сначала старые со склада (им 2 дня), полка не тронута.
    expect(state.warehouse.apples?.length).toBe(10 - norm * LINES.jam.input!.per);
    expect(onShelves(state, 'apples')).toBe(4);
    expect(state.money).toBe(s.money - norm * LINES.jam.extra);
    expect(night.spent).toBe(norm * LINES.jam.extra);
    // Запас полный — следующей ночью не делают.
    expect(lineWants(state, 'jam')).toBe(0);
    expect(makeLines(state).night.made).toEqual([]);
  });

  it('не хватило сырья — сделали сколько смогли и сказали об этом', () => {
    const s = shop({ lines: { jam: 3 }, warehouse: { apples: units(2) }, shelves: [{ kind: 'produce', level: 3, items: { apples: units(1) } }] });
    const { state, night } = makeLines(s);
    expect(night.made).toEqual([{ id: 'jam', made: 3, short: true }]);
    expect(state.warehouse.apples ?? []).toHaveLength(0);
    expect(onShelves(state, 'apples')).toBe(0);
  });

  it('брак, ждущий решения, и уценку в варенье не пускают', () => {
    const s = shop({ lines: { jam: 1 }, warehouse: { apples: [{ age: 0, bad: true, pending: true }, { age: 0, markdown: true }] }, shelves: [{ kind: 'produce', level: 1, items: {} }] });
    expect(makeLines(s).night.made).toEqual([{ id: 'jam', made: 0, short: true }]);
  });

  it('пельмени лепят только в день повара; квас — только в тепло; без полки отдела — ничего', () => {
    expect(lineWants(shop({ lines: { pelmeni: 1 } }), 'pelmeni')).toBeGreaterThan(0);
    expect(lineWants(shop({ lines: { pelmeni: 1 }, staff: [] }), 'pelmeni')).toBe(0);
    const summer = dayIn('summer');
    const autumn = dayIn('autumn');
    expect(lineSeason('kvass', summer)).toBe(true);
    expect(lineSeason('kvass', autumn)).toBe(false);
    expect(lineWants(shop({ lines: { kvass: 1 }, day: summer }), 'kvass')).toBeGreaterThan(0);
    expect(lineWants(shop({ lines: { kvass: 1 }, day: autumn }), 'kvass')).toBe(0);
    expect(lineWants(shop({ lines: { pickles: 1 }, shelves: [] }), 'pickles')).toBe(0);
  });

  it('квас вне сезона не продают: ни заданий, ни кафе, ни войны цен на него', () => {
    expect(sellableProducts(shop({ lines: { kvass: 1 }, day: dayIn('summer') }))).toContain('kvass');
    expect(sellableProducts(shop({ lines: { kvass: 1 }, day: dayIn('autumn') }))).not.toContain('kvass');
    expect(sellableProducts(shop({ lines: { kvass: 1 }, day: dayIn('winter') }))).not.toContain('kvass');
  });

  it('соленья: осенью солят больше и дешевле; без сырья со склада', () => {
    const autumn = shop({ lines: { pickles: 1 }, day: dayIn('autumn') });
    const spring = shop({ lines: { pickles: 1 }, day: dayIn('spring') });
    expect(lineStock(autumn, 'pickles')).toBeGreaterThan(lineStock(spring, 'pickles'));
    const a = makeLines(autumn).night;
    const b = makeLines(spring).night;
    expect(a.spent / a.made[0].made).toBeLessThan(b.spent / b.made[0].made);
  });

  it('спрос: ступень и «слава марки», слава — и на выпечку «От бабушки»; обычный товар не трогает', () => {
    const one = shop({ lines: { jam: 1 } });
    const three = shop({ lines: { jam: 3, pickles: 2 } });
    expect(brandFame(three)).toBe(5);
    expect(lineDemand(three, 'jam', true)).toBeGreaterThan(lineDemand(one, 'jam', true));
    expect(brandDemand(three, 'pies')).toBeGreaterThan(brandDemand(shop(), 'pies'));
    expect(brandDemand(three, 'apples')).toBe(1);
    // Без линеек выпечка — как раньше.
    expect(brandDemand(shop({ brand: 2 }), 'pies')).toBeCloseTo(1.24);
  });

  it('своё дороже себестоимости хотя бы вдвое — премия марки', () => {
    for (const id of LINE_IDS) {
      const p = PRODUCTS[LINES[id].product];
      expect(p.basePrice).toBeGreaterThan(p.cost * 2);
    }
  });

  it('«Закупить нужное» берёт сверху сырьё на ночь', () => {
    const s = shop({ lines: { jam: 2 }, warehouse: {} });
    expect(lineInputNeed(s, 'apples')).toBeGreaterThan(0);
    expect(lineInputNeed(s, 'meat')).toBe(0);
    expect(lineInputNeed(shop(), 'apples')).toBe(0);
  });

  it('смена дня: линейки работают в nightCycle, итог — в сводке', () => {
    const s = shop({ lines: { jam: 1, pelmeni: 1 } });
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.lines.made.map((m) => m.id)).toEqual(['jam', 'pelmeni']);
    expect(onShelves(night.state, 'pelmeni') + (night.state.warehouse.pelmeni?.length ?? 0)).toBeGreaterThan(0);
    expect(linesSold(s, { jam: 3, pelmeni: 1, apples: 5 })).toEqual({ n: 4, revenue: 3 * s.prices.jam + s.prices.pelmeni });
  });

  it('старое сохранение без линеек грузится, новые цены на месте; ступени переживают сохранение', () => {
    const old = newGame() as StoreState & { lines?: unknown };
    delete old.lines;
    const prices = { ...old.prices } as Record<string, number>;
    for (const id of ['jam', 'pickles', 'pelmeni', 'kvass']) delete prices[id];
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    (globalThis as unknown as { localStorage: typeof ls }).localStorage = ls;
    store.set('magazinchik.save', JSON.stringify({ version: 10, state: { ...old, prices } }));
    const loaded = loadGame()!;
    expect(loaded.prices.jam).toBe(PRODUCTS.jam.basePrice);
    expect(brandFame(loaded)).toBe(0);
    expect(sellableProducts(loaded)).not.toContain('kvass');
    saveGame({ ...loaded, lines: { kvass: 2 } });
    expect(loadGame()!.lines).toEqual({ kvass: 2 });
  });
});
