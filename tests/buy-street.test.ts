import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  BAR_FLOOR,
  barNoise,
  buyLock,
  buyLot,
  ESTATE_LEVEL,
  estateDemand,
  estateGuest,
  estateGuests,
  estateLook,
  estateMorning,
  estateNews,
  estateNight,
  estateOpen,
  estateRent,
  lease,
  leaseLock,
  LOT_PRICES,
  LOTS,
  lotOf,
  NAMED_GUESTS,
  OPEN_DAYS,
  openShops,
  opensIn,
  ownedLots,
  seeEstate,
  shopWorks,
  SHOP_KINDS,
  SHOPS,
  streetNamed,
  SWAP_DAYS,
  vacate,
  type EstateState,
} from '../src/game/estate';
import { residents, RES_START } from '../src/game/residents';
import { goodwillOf } from '../src/game/goodwill';
import { guestFactor, nightCycle } from '../src/game/day';
import { dayDemand } from '../src/game/demand';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { pickNews } from '../src/game/headlines';
import { simulate } from '../src/game/simulate';

// Скупать улицу (estate.ts, 13.11): купить помещение, пустить арендатора (с паузой при смене), аренда вечером,
// гости и спрос лавок, семьи района от аптеки, клуба и бара, шум бара — от зерна и дня; вся улица — история и бонус.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: ESTATE_LEVEL, money: 300000, debt: 0, rating: 4.5, seed: 7, ...over });

/** Купить помещение i и пустить kind; прожить до его открытия. */
function opened(state: StoreState, i: number, kind: (typeof SHOP_KINDS)[number]): StoreState {
  const bought = lotOf(state, i) ? state : buyLot(state, i)!;
  const leased = lease(bought, i, kind)!;
  return { ...leased, day: leased.day + opensIn(leased, i) };
}

describe('улица: покупка помещений', () => {
  it('старое сохранение (поля нет) — ничего не куплено, на гостей, спрос и вечер не влияет', () => {
    const s = shop();
    expect(s.estate).toBeUndefined();
    expect(ownedLots(s)).toBe(0);
    expect(estateGuests(s)).toBe(1);
    expect(estateDemand(s, 'beer')).toBe(1);
    expect(estateLook(s)).toBe('');
    const night = estateNight(s);
    expect(night.income).toBe(0);
    expect(night.state).toBe(s);
    expect(estateMorning(s)).toBe(s);
  });

  it('продают с «Супермаркета» и только в Центре', () => {
    expect(estateOpen(shop({ level: ESTATE_LEVEL - 1 }))).toBe(false);
    expect(buyLock(shop({ level: ESTATE_LEVEL - 1 }), 0)).toBe('closed');
    expect(estateOpen(shop())).toBe(true);
    const zar = { ...shop(), zar: { at: 'zar' as const } } as StoreState;
    expect(buyLot(zar, 0)).toBeNull();
  });

  it('покупка списывает цену; второй раз то же не купить; без денег — нельзя', () => {
    const s = shop();
    const b = buyLot(s, 2)!;
    expect(b.money).toBe(s.money - LOT_PRICES[2]);
    expect(lotOf(b, 2)).toEqual({});
    expect(buyLock(b, 2)).toBe('owned');
    expect(buyLot(b, 2)).toBeNull();
    expect(buyLock(shop({ money: LOT_PRICES[0] - 1 }), 0)).toBe('money');
    expect(buyLot(shop({ money: LOT_PRICES[0] }), 0)!.money).toBe(0);
    expect(buyLock(s, LOTS)).toBe('closed');
    expect(LOT_PRICES.every((p, i) => i === 0 || p > LOT_PRICES[i - 1])).toBe(true);
  });

  it('кривое из сохранения не ломает: неизвестный арендатор — как пустое помещение', () => {
    const s = shop({ estate: { lots: [{ kind: 'casino' as never, from: 1 }, null, 5 as never] } });
    expect(lotOf(s, 0)).toEqual({});
    expect(lotOf(s, 1)).toBeNull();
    expect(lotOf(s, 2)).toBeNull();
    expect(openShops(s)).toEqual([]);
  });
});

describe('улица: арендаторы', () => {
  it('в пустое — назавтра; аренды до открытия нет, потом — каждый вечер', () => {
    const b = buyLot(shop(), 0)!;
    expect(leaseLock(shop(), 0, 'pharmacy')).toBe('notOwned');
    const l = lease(b, 0, 'pharmacy')!;
    expect(opensIn(l, 0)).toBe(OPEN_DAYS);
    expect(shopWorks(l, 0)).toBe(false);
    expect(estateNight(l).income).toBe(0);
    const next = { ...l, day: l.day + OPEN_DAYS };
    expect(shopWorks(next, 0)).toBe(true);
    const night = estateNight(next);
    expect(night.income).toBe(SHOPS.pharmacy.rent);
    expect(night.state.money).toBe(next.money + SHOPS.pharmacy.rent);
  });

  it('один вид — одно помещение; тот же — нельзя', () => {
    let s = opened(shop(), 0, 'gym');
    s = buyLot(s, 1)!;
    expect(leaseLock(s, 1, 'gym')).toBe('taken');
    expect(lease(s, 1, 'gym')).toBeNull();
    expect(leaseLock(s, 0, 'gym')).toBe('here');
    expect(lease(s, 1, 'shoes')).not.toBeNull();
  });

  it('смена арендатора — с паузой: прежний съезжает сразу, новый открывается через SWAP_DAYS', () => {
    const s = opened(shop(), 1, 'shoes');
    expect(estateRent(s)).toBe(SHOPS.shoes.rent);
    const swapped = lease(s, 1, 'florist')!;
    expect(opensIn(swapped, 1)).toBe(SWAP_DAYS);
    expect(estateRent(swapped)).toBe(0);
    expect(openShops(swapped)).toEqual([]);
    expect(estateRent({ ...swapped, day: swapped.day + SWAP_DAYS })).toBe(SHOPS.florist.rent);
    // Освободить: помещение остаётся нашим, аренды нет.
    const empty = vacate(s, 1);
    expect(lotOf(empty, 1)).toEqual({ left: s.day });
    expect(estateRent(empty)).toBe(0);
    expect(vacate(empty, 1)).toBe(empty);
  });

  it('«Выселить» и сразу «Пустить» паузу не обходит: срок — от ухода работавшего арендатора', () => {
    const s = opened(shop(), 1, 'shoes');
    const relet = lease(vacate(s, 1), 1, 'florist')!;
    expect(opensIn(relet, 1)).toBe(SWAP_DAYS);
    // Через день после выселения ждать уже меньше, но не меньше OPEN_DAYS.
    const later = { ...vacate(s, 1), day: s.day + 1 };
    expect(opensIn(lease(later, 1, 'florist')!, 1)).toBe(SWAP_DAYS - 1);
    const long = { ...vacate(s, 1), day: s.day + 10 };
    expect(opensIn(lease(long, 1, 'florist')!, 1)).toBe(OPEN_DAYS);
    // Сменить въезжающего (ещё не открылся) — срок прежний, а не новый отсчёт: выселить и пустить третьего — тоже.
    const swapped = lease(s, 1, 'florist')!;
    const again = { ...swapped, day: swapped.day + 1 };
    expect(opensIn(lease(again, 1, 'gym')!, 1)).toBe(SWAP_DAYS - 1);
    expect(opensIn(lease(vacate(again, 1), 1, 'gym')!, 1)).toBe(SWAP_DAYS - 1);
  });

  it('передумал до открытия — ждать как с первым арендатором, а не паузу смены', () => {
    const bought = buyLot(shop(), 2)!;
    const kids = lease(bought, 2, 'kids')!;
    expect(opensIn(kids, 2)).toBe(OPEN_DAYS);
    expect(opensIn(lease(kids, 2, 'gym')!, 2)).toBe(OPEN_DAYS);
    expect(opensIn(lease(vacate(kids, 2), 2, 'gym')!, 2)).toBe(OPEN_DAYS);
    expect(lotOf(vacate(kids, 2), 2)).toEqual({});
  });

  it('лавки дают гостей и свой спрос — в guestFactor и dayDemand тоже', () => {
    const base = shop();
    const s = opened(opened(base, 0, 'kids'), 1, 'florist');
    expect(estateGuests(s)).toBeCloseTo(1 + SHOPS.kids.guests + SHOPS.florist.guests);
    expect(guestFactor(s) / guestFactor({ ...base, day: s.day })).toBeCloseTo(estateGuests(s));
    expect(estateDemand(s, 'icecream')).toBeCloseTo(SHOPS.kids.demand.icecream!);
    // Цветочный уводит часть спроса на наши цветы.
    expect(estateDemand(s, 'flowers')).toBeLessThan(1);
    expect(dayDemand(s, 'juice') / dayDemand({ ...base, day: s.day }, 'juice')).toBeCloseTo(SHOPS.kids.demand.juice!);
  });

  it('гости лавок в зале: свой образ и список; бар — только к вечеру', () => {
    const s = opened(shop(), 0, 'bar');
    expect(estateGuest(s, () => 0, false)).toBeNull();
    const evening = estateGuest(s, () => 0, true)!;
    expect(evening.kind).toBe('bar');
    expect(SHOPS.bar.looks).toContain(evening.look);
    expect(estateGuest(s, () => 0.99, true)).toBeNull();
    const kids = opened(shop(), 0, 'kids');
    expect(estateGuest(kids, () => 0, false)!.look).toBe('stroller');
  });
});

describe('улица: семьи района и шум бара', () => {
  it('аптека и детский клуб привозят по семье, бар — увозит; один раз на вид', () => {
    const s = opened(shop(), 0, 'kids');
    const m = estateMorning(s);
    expect(residents(m)).toBe(RES_START + 1);
    expect(m.estate?.met).toEqual(['kids']);
    // Второй раз то же утро ничего не меняет.
    expect(estateMorning(m)).toBe(m);
    // Сменили на бар и вернули клуб — семья от клуба второй раз не приезжает.
    const bar = estateMorning(opened(m, 0, 'bar'));
    expect(residents(bar)).toBe(RES_START);
    const back = estateMorning(opened(bar, 0, 'kids'));
    expect(residents(back)).toBe(RES_START);
    // Спортзал семей не трогает.
    const gym = estateMorning(opened(shop(), 2, 'gym'));
    expect(residents(gym)).toBe(RES_START);
  });

  it('шум бара — от зерна и дня: тот же день — тот же ответ; доброе имя −1, но не ниже BAR_FLOOR', () => {
    const s = opened(shop(), 0, 'bar');
    const days = Array.from({ length: 40 }, (_, i) => ({ ...s, day: s.day + i }));
    const noisy = days.filter(barNoise);
    expect(noisy.length).toBeGreaterThan(5);
    expect(noisy.length).toBeLessThan(35);
    for (const d of days) expect(barNoise(d)).toBe(barNoise({ ...d }));
    const loud = noisy[0];
    expect(goodwillOf(estateNight(loud).state)).toBe(-1);
    expect(goodwillOf(estateNight({ ...loud, goodwill: BAR_FLOOR }).state)).toBe(BAR_FLOOR);
    const quiet = days.find((d) => !barNoise(d))!;
    expect(goodwillOf(estateNight(quiet).state)).toBe(0);
    // Другое зерно — другие ночи.
    const other = days.map((d) => barNoise({ ...d, seed: 12345 }));
    expect(other).not.toEqual(days.map(barNoise));
  });
});

describe('улица: вся улица наша', () => {
  const all = (): StoreState => {
    let s = shop({ shopName: 'Ромашка' });
    for (let i = 0; i < LOTS; i++) s = buyLot(s, i)!;
    return s;
  };

  it('последнее помещение — история утром, бонус к гостям, табличка в виде улицы', () => {
    const s = all();
    expect(s.money).toBe(300000 - LOT_PRICES.reduce((a, b) => a + b, 0));
    expect(streetNamed(s)).toBe(true);
    expect(s.estate?.named).toBe(s.day);
    expect(estateGuests(s)).toBeCloseTo(1 + NAMED_GUESTS);
    expect(estateLook(s)).toBe('o,o,o,o|Ромашка');
    expect(estateNews(s)).toBe(true);
    expect(pickNews(s, ['estate', 'tale']).id).toBe('estate');
    const seen = seeEstate(s);
    expect(estateNews(seen)).toBe(false);
    expect(seeEstate(seen)).toBe(seen);
    expect(estateNews(shop())).toBe(false);
  });

  it('вид улицы меняется, когда арендатор въезжает и когда открывается', () => {
    const b = buyLot(shop(), 3)!;
    const l = lease(b, 3, 'gym')!;
    expect(estateLook(b)).toBe('-,-,-,o|');
    expect(estateLook(l)).toBe('-,-,-,gym~|');
    expect(estateLook({ ...l, day: l.day + 1 })).toBe('-,-,-,gym|');
  });
});

describe('улица: день целиком, подсказка, сохранение, симулятор', () => {
  it('nightCycle: аренда улицы приходит до счетов и пишется отдельно; утром клуб привозит семью', () => {
    const s = lease(buyLot(shop(), 0)!, 0, 'kids')!;
    const first = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(first.estate).toBe(0);
    expect(residents(first.state)).toBe(RES_START + 1);
    const second = nightCycle(first.state, emptyDayStats(), () => 0.5);
    expect(second.estate).toBe(SHOPS.kids.rent);
  });

  it('первая подсказка — когда улицу начинают продавать, иконка своя', () => {
    const tip: TipId = 'estate';
    const seenAll = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== tip);
    expect(pendingTip({ ...shop({ level: ESTATE_LEVEL - 1 }), seenTips: seenAll })).toBeNull();
    expect(pendingTip({ ...shop(), seenTips: seenAll })).toBe(tip);
    const icons = Object.values(TIP_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
  });

  describe('сохранение', () => {
    let local: Record<string, string> = {};
    beforeEach(() => {
      vi.resetModules();
      local = {};
      Object.assign(globalThis, {
        localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
      });
    });
    afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

    it('старое сохранение грузится без поля; купленная улица переживает сохранение', async () => {
      const { loadGame, saveGame } = await import('../src/game/save');
      const old = { ...newGame(), day: 70 } as Record<string, unknown>;
      delete old.estate;
      local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
      const loaded = loadGame()!;
      expect(loaded.estate).toBeUndefined();
      expect(ownedLots(loaded)).toBe(0);
      const estate: EstateState = { lots: [{ kind: 'bar', from: 65 }, {}, null, null], met: ['bar'] };
      saveGame({ ...loaded, estate });
      expect(loadGame()!.estate).toEqual(estate);
    });
  });

  it('симулятор идёт как раньше: банкротства нет, улицу он не покупает', () => {
    let last: StoreState | null = null;
    const r = simulate({ days: 90, seed: 1, onMorning: (s) => (last = s) });
    expect(r.bankruptDay).toBeNull();
    expect((last as unknown as StoreState).estate).toBeUndefined();
  });
});
