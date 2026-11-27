import { afterEach, describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type StoreState, type Unit } from '../src/game/economy';
import { nightCycle, otherIncome, type NightSummary } from '../src/game/day';
import { rentRoom, tenantIncome, tenantRent, tenantsNight } from '../src/game/tenants';
import { buyVan, vanEvents } from '../src/game/van';
import { yardIncome } from '../src/game/garden';
import { ru } from '../src/i18n/ru';

// «Прочие доходы» в итогах дня (day.ts otherIncome, 21.11): только отчёт о том, что nightCycle уже положил в кассу
// мимо кассы зала, — ничего не начисляет второй раз. Аренда флигеля пишется в tenantLog для карточки «Арендаторы».

const units = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));

/** Универмаг с товаром: флигель на 3–4 комнаты, фургон по карману. */
const shop = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 25,
  level: 4,
  money: 100_000,
  debt: 0,
  rating: 4,
  seed: 7,
  shelves: [
    { kind: 'drinks', level: 0, items: { water: units(4), juice: units(2) } },
    { kind: 'icebox', level: 0, items: { icecream: units(3) } },
  ],
  warehouse: { water: units(10), juice: units(6), icecream: units(6) },
  ...over,
});

/** Ближайший день с матчем (фургон едет) — от него всё детерминировано. */
const matchDay = (): number => {
  for (let day = 20; day < 200; day++) if (vanEvents(shop({ day })).includes('match')) return day;
  throw new Error('нет матча');
};

/** Тот же магазин с арендаторами, бабушкиным двором на две грядки, прокатом у входа и фургоном (в день матча он сам едет, 27.11). */
const busy = (day: number): StoreState => {
  let s = shop({ day, rental: {}, garden: { beds: 2 } });
  s = rentRoom(s, 'pickup')!;
  s = rentRoom(s, 'pharmacy')!;
  return buyVan(s)!;
};

const wealth = (s: StoreState): number => s.money - s.debt;

describe('прочие доходы вечера', () => {
  it('сумма строк — ровно та разница в кассе, что дали аренда, двор, прокат и фургон (без двойного счёта)', () => {
    const day = matchDay();
    const plain = shop({ day });
    const full = busy(day);
    const nPlain = nightCycle(plain, emptyDayStats(), () => 0.5);
    const nFull = nightCycle(full, emptyDayStats(), () => 0.5);
    const rows = otherIncome(nFull);
    expect(rows.map((r) => r.id).sort()).toEqual(['rent', 'rental', 'van', 'yard']);
    const sum = rows.reduce((s, r) => s + r.n, 0);
    // Вечер с доходами против того же вечера без них: разница в кассе — только эти деньги.
    const gained = wealth(nFull.state) - wealth(full) - (wealth(nPlain.state) - wealth(plain));
    expect(gained).toBe(sum);
    // По строкам — те же суммы, что в сводке ночи.
    expect(rows.find((r) => r.id === 'rent')!.n).toBe(tenantRent(full));
    expect(rows.find((r) => r.id === 'van')!.n).toBe(nFull.van!.net);
    expect(rows.find((r) => r.id === 'rental')!.n).toBe(nFull.rental!.income);
    expect(rows.find((r) => r.id === 'yard')!.n).toBe(yardIncome(full));
  });

  it('детерминировано: тот же магазин и день — те же строки', () => {
    const day = matchDay();
    expect(otherIncome(nightCycle(busy(day), emptyDayStats(), () => 0.5))).toEqual(otherIncome(nightCycle(busy(day), emptyDayStats(), () => 0.9)));
  });

  it('простой магазин без доходов мимо кассы — блока нет', () => {
    expect(otherIncome(nightCycle(shop(), emptyDayStats(), () => 0.5))).toEqual([]);
  });

  it('облава в подвале и плата продавцу этажа — с минусом, нули не показываются', () => {
    const base = nightCycle(shop(), emptyDayStats(), () => 0.5);
    const night: NightSummary = {
      ...base,
      slots: { players: 10, income: 0, share: 0, raid: { fine: 900, n: 3 } },
      clothes: { coll: 'summer', buyers: 0, sold: 0, sale: 0, income: 0, wage: 120 },
      food: { eaters: 0, income: 0 },
      cart: 40,
    };
    expect(otherIncome(night)).toEqual([
      { id: 'slots', n: -900 },
      { id: 'clothes', n: -120 },
      { id: 'cart', n: 40 },
    ]);
    const calm: NightSummary = { ...base, slots: { players: 10, income: 500, share: 100 }, clothes: { coll: 'summer', buyers: 5, sold: 5, sale: 0, income: 400, wage: 120 } };
    expect(otherIncome(calm)).toEqual([
      { id: 'slots', n: 400 },
      { id: 'clothes', n: 280 },
    ]);
  });
});

describe('аренда флигеля: вчера и всего', () => {
  it('каждый вечер пишет, сколько пришло, и копит всего; утром карточка видит «вчера»', () => {
    const s = rentRoom(rentRoom(shop({ day: 30 }), 'pickup')!, 'pharmacy')!;
    const rent = tenantRent(s);
    const first = tenantsNight(s).state;
    expect(first.money).toBe(s.money + rent);
    expect(first.tenantLog).toEqual({ day: 30, last: rent, total: rent });
    const second = tenantsNight({ ...first, day: 31 }).state;
    expect(second.tenantLog).toEqual({ day: 31, last: rent, total: rent * 2 });
    expect(tenantIncome({ ...second, day: 32 })).toEqual({ last: rent, total: rent * 2 });
    // Вчера не платили (пропуск дня) или ещё не было вечера — строки нет.
    expect(tenantIncome({ ...second, day: 34 })).toBeNull();
    expect(tenantIncome(s)).toBeNull();
  });

  it('nightCycle пишет лог за прошедший день — наутро он «вчера»', () => {
    const s = rentRoom(shop({ day: 30 }), 'pickup')!;
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.state.day).toBe(31);
    expect(tenantIncome(night.state)).toEqual({ last: night.rent, total: night.rent });
  });

  it('без арендаторов поле не появляется', () => {
    const s = shop();
    expect(tenantsNight(s).state).toBe(s);
    expect(nightCycle(s, emptyDayStats(), () => 0.5).state.tenantLog).toBeUndefined();
  });

  it('тексты: подписи с плюсом и итог дня', () => {
    expect(ru['income.title']).toContain('{n}');
    expect(ru['tenant.income']).toContain('{last}');
    expect(ru['tenant.income']).toContain('{total}');
  });
});

describe('старые сохранения', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('сохранение без tenantLog грузится как было, а с ним — переживает сохранение', async () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = rentRoom(shop({ day: 30 }), 'pickup')!;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const loaded = loadGame()!;
    expect(loaded.tenantLog).toBeUndefined();
    expect(tenantIncome(loaded)).toBeNull();
    // Первый же вечер после обновления начинает счёт с нуля.
    expect(tenantsNight(loaded).state.tenantLog).toEqual({ day: 30, last: tenantRent(loaded), total: tenantRent(loaded) });
    saveGame({ ...old, tenantLog: { day: 29, last: 300, total: 4200 } });
    expect(loadGame()!.tenantLog).toEqual({ day: 29, last: 300, total: 4200 });
  });
});
