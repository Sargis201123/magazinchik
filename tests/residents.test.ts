import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, PRODUCTS, type StoreState } from '../src/game/economy';
import {
  addResidents,
  MAY_LEAVE,
  movingFlat,
  movingToday,
  NADYA_FROM,
  RES_EVERY,
  RES_FLATS,
  RES_FROM,
  RES_GUESTS,
  RES_MAX,
  RES_MIN,
  RES_NEWS_DAYS,
  RES_START,
  residents,
  residentsDay,
  residentsGuests,
  residentsLook,
  residentsMood,
  residentsMorning,
  residentsNews,
  residentsTrend,
  seeResidents,
} from '../src/game/residents';
import { met, regularById, regularsToday, regularState, START_LOYALTY } from '../src/game/regulars';
import { guestFactor, nightCycle } from '../src/game/day';
import { emptyDayStats } from '../src/game/economy';
import { lifeNews } from '../src/game/life';
import { pickNews } from '../src/game/headlines';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import { letterSenders } from '../src/game/returns';
import { COLLECTION_SETS } from '../src/game/collections';

// Жители района (residents.ts, 13.11): сколько семей, кто въезжает и уезжает, от чего; исход — от зерна и дня;
// гости, постоянные (Надя въезжает, обиженный уезжает и может вернуться), новость, старые сохранения, симулятор.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, level: 2, money: 5000, debt: 0, rating: 4, seed: 7, ...over });
/** Району у нас хорошо: доброе имя, 5★ — настроение +4. */
const good = (over: Partial<StoreState> = {}) => shop({ goodwill: 60, rating: 5, ...over });
/** Району у нас плохо: нажились в беду, 3★ (рейтинг тут не в счёт) — настроение −3. */
const bad = (over: Partial<StoreState> = {}) => shop({ goodwill: -60, rating: 3, ...over });

/** Прожить утра с day по day+days (только решение района), не меняя остального. */
function mornings(state: StoreState, days: number): StoreState[] {
  const out: StoreState[] = [];
  let s = state;
  for (let i = 0; i < days; i++) {
    s = residentsMorning({ ...s, day: s.day + 1 });
    out.push(s);
  }
  return out;
}

describe('жители: число семей и гости', () => {
  it('старое сохранение (поля нет) — 12 семей, гости как раньше', () => {
    const s = shop();
    expect(s.residents).toBeUndefined();
    expect(residents(s)).toBe(RES_START);
    expect(residentsGuests(s)).toBe(1);
  });

  it('каждая семья сверх начальных — +0,75% гостей, в guestFactor тоже', () => {
    const full = { ...shop(), residents: { n: RES_MAX } };
    const few = { ...shop(), residents: { n: RES_MIN } };
    expect(residentsGuests(full)).toBeCloseTo(1 + (RES_MAX - RES_START) * RES_GUESTS);
    expect(residentsGuests(few)).toBeCloseTo(1 - (RES_START - RES_MIN) * RES_GUESTS);
    expect(guestFactor(full) / guestFactor(shop())).toBeCloseTo(residentsGuests(full));
  });

  it('в Заречье жители Центра на гостей не влияют', () => {
    const s = { ...shop(), residents: { n: RES_MAX } };
    const zar = { ...s, zar: { at: 'zar' as const } } as StoreState;
    const base = { ...shop(), zar: { at: 'zar' as const } } as StoreState;
    expect(guestFactor(zar)).toBeCloseTo(guestFactor(base));
  });

  it('addResidents: ±, в пределах 0…квартир, без изменений — тот же объект', () => {
    const s = shop();
    expect(residents(addResidents(s, 3))).toBe(RES_START + 3);
    expect(residents(addResidents(s, 100))).toBe(RES_FLATS);
    expect(residents(addResidents(s, -100))).toBe(0);
    expect(addResidents(s, 0)).toBe(s);
    const full = addResidents(s, 100);
    expect(addResidents(full, 1)).toBe(full);
  });
});

describe('жители: настроение района', () => {
  it('обычный магазин (цены как есть, 4★, имя ноль) — никто не едет', () => {
    const s = shop();
    expect(residentsMood(s).mood).toBeCloseTo(0);
    expect(residentsTrend(s)).toBe(0);
    for (const x of mornings(s, 60)) expect(x.residents).toBeUndefined();
  });

  it('новая игра (3★, имя ноль) и чуть дороже обычного — район спокоен (ревью 13.11)', () => {
    const s = { ...newGame(), day: RES_FROM + 10 };
    expect(residentsMood(s).mood).toBeCloseTo(0);
    expect(residentsTrend(s)).toBe(0);
    for (const x of mornings(s, 80)) expect(x.residents).toBeUndefined();
    const pricier = { ...s, prices: Object.fromEntries(Object.entries(s.prices).map(([k, v]) => [k, Math.round(v * 1.1)])) } as StoreState;
    expect(residentsTrend(pricier)).toBe(0);
    // А вот 2★ — уже беда: рейтинг ниже 3★ тянет вниз.
    expect(residentsMood({ ...s, rating: 2 }).mood).toBeCloseTo(-1);
  });

  it('доброе имя и рейтинг тянут вверх, нажива — вниз; причина — самая весомая', () => {
    expect(residentsTrend(good())).toBe(1);
    expect(residentsTrend(bad())).toBe(-1);
    expect(residentsMood(good()).why).toBe('goodwill');
    expect(residentsMood(bad()).why).toBe('goodwill');
  });

  it('дорогие цены выгоняют, дешёвые зовут', () => {
    const s = shop();
    const pricey = { ...s, prices: Object.fromEntries(Object.entries(s.prices).map(([k, v]) => [k, Math.round(v * 1.25)])) } as StoreState;
    const cheap = { ...s, prices: Object.fromEntries(Object.entries(s.prices).map(([k]) => [k, Math.round(PRODUCTS[k as keyof typeof PRODUCTS].basePrice * 0.85)])) } as StoreState;
    expect(residentsTrend(pricey)).toBe(-1);
    expect(residentsMood(pricey).why).toBe('price');
    expect(residentsTrend(cheap)).toBe(1);
  });

  it('сбывшиеся мечты соседей — плюс', () => {
    const s = shop({ rating: 4.5, dreams: { inv: [{ id: 'kostya', day: 30, sum: 800, end: 'ok' }, { id: 'anya', day: 30, sum: 900, end: 'ok' }] } });
    expect(residentsMood(s).mood).toBeCloseTo(1.5);
    expect(residentsTrend(s)).toBe(1);
  });

  it('у краёв тренда нет: полный район не растёт, пустой не пустеет', () => {
    expect(residentsTrend({ ...good(), residents: { n: RES_MAX } })).toBe(0);
    expect(residentsTrend({ ...bad(), residents: { n: RES_MIN } })).toBe(0);
  });
});

describe('жители: утро района', () => {
  it('раз в несколько дней, не больше одной семьи за раз, в пределах', () => {
    const days = mornings(good(), 200);
    let prev = RES_START;
    for (const s of days) {
      const n = residents(s);
      expect(Math.abs(n - prev)).toBeLessThanOrEqual(1);
      if (n !== prev) expect(residentsDay(s)).toBe(true);
      expect(n).toBeLessThanOrEqual(RES_MAX);
      prev = n;
    }
    expect(prev).toBe(RES_MAX);
    const down = mornings(bad(), 200);
    expect(residents(down[down.length - 1])).toBe(RES_MIN);
  });

  it('переезды не чаще раза в RES_EVERY дней', () => {
    const days = mornings(good(), 120).filter((s, i, all) => residents(s) !== residents(all[i - 1] ?? good()));
    for (let i = 1; i < days.length; i++) expect(days[i].day - days[i - 1].day).toBeGreaterThanOrEqual(RES_EVERY);
  });

  it('детерминированно: то же зерно и день — тот же исход; другое зерно — другие дни', () => {
    const a = mornings(good(), 80).map(residents);
    const b = mornings(good(), 80).map(residents);
    expect(a).toEqual(b);
    const c = mornings(good({ seed: 12345 }), 80).map(residents);
    expect(c).not.toEqual(a);
  });

  it('до RES_FROM и в Заречье район не меняется', () => {
    for (const s of mornings(good({ day: 0 }), RES_FROM - 1)) expect(s.residents).toBeUndefined();
    const zar = { ...good(), zar: { at: 'zar' as const } } as StoreState;
    for (const s of mornings(zar, 40)) expect(s.residents).toBeUndefined();
  });

  it('деньги переезд не трогает — только гости', () => {
    for (const s of mornings(good(), 60)) expect(s.money).toBe(5000);
  });

  it('утро в nightCycle: тот же день и зерно — тот же район', () => {
    let s = good({ day: 43 });
    while (!residentsDay({ ...s, day: s.day + 1 })) s = { ...s, day: s.day + 1 };
    const r1 = nightCycle(s, emptyDayStats(), () => 0.5).state.residents;
    const r2 = nightCycle(s, emptyDayStats(), () => 0.9).state.residents;
    expect(r1).toEqual(r2);
  });
});

describe('жители: постоянные', () => {
  it('Надя въезжает с переездом после NADYA_FROM: тогда знакома и ходит', () => {
    const nadya = regularById('nadya');
    expect(met(good({ day: 100 }), nadya)).toBe(false);
    const days = mornings(good({ day: NADYA_FROM }), 200);
    const arrived = days.find((s) => s.residents?.move?.who === 'nadya');
    expect(arrived).toBeDefined();
    expect(arrived!.residents!.came).toContain('nadya');
    expect(met(arrived!, nadya)).toBe(true);
    // Пишет письма, как все знакомые постоянные (returns.ts); до переезда — нет.
    expect(letterSenders(arrived!)).toContain('nadya');
    expect(letterSenders(good({ day: 100 }))).not.toContain('nadya');
    // До NADYA_FROM — только безымянные семьи.
    for (const s of mornings(good({ day: RES_FROM }), NADYA_FROM - RES_FROM - 1)) expect(s.residents?.move?.who).toBeUndefined();
  });

  it('Надя — не обязательный предмет альбома: «Друзья» и «Открытки» собираются и без неё (ревью 13.11)', () => {
    for (const set of COLLECTION_SETS.filter((x) => x.id === 'friends' || x.id === 'cards')) expect(set.items.some((i) => i.id === 'nadya')).toBe(false);
  });

  it('обиженный постоянный уезжает при плохом районе: больше не заходит, его новостей нет', () => {
    const angry = bad({ day: 30, regulars: { petr: { loyalty: 1, awayUntil: 0 } } });
    const left = mornings(angry, 200).find((s) => s.residents?.move?.who === 'petr');
    expect(left).toBeDefined();
    expect(left!.residents!.move!.dir).toBe(-1);
    expect(left!.residents!.gone).toContain('petr');
    expect(met(left!, regularById('petr'))).toBe(false);
    expect(regularsToday(left!).some((r) => r.id === 'petr')).toBe(false);
    // Новость «Пётр Ильич и Ольга» (день 40) про уехавшего не приходит.
    expect(lifeNews({ ...left!, day: 41 })?.who ?? []).not.toContain('petr');
  });

  it('довольные постоянные не уезжают; ждущие новостей о своей мечте — тоже; Света с Мишей — никогда', () => {
    const loyal = bad({ day: 30, regulars: { petr: { loyalty: 5, awayUntil: 0 } } });
    for (const s of mornings(loyal, 200)) expect(s.residents?.gone ?? []).not.toContain('petr');
    const dreaming = bad({ day: 30, regulars: { kostya: { loyalty: 1, awayUntil: 0 } }, dreams: { inv: [{ id: 'kostya', day: 29, sum: 800 }] } });
    for (const s of mornings(dreaming, 200)) expect(s.residents?.gone ?? []).not.toContain('kostya');
    expect(MAY_LEAVE).not.toContain('sveta');
    expect(MAY_LEAVE).not.toContain('misha');
  });

  it('уехавший возвращается, когда району снова хорошо: доверие с начала', () => {
    const s = good({ day: 60, residents: { n: 10, gone: ['petr'], came: ['nadya'] }, regulars: { petr: { loyalty: 1, awayUntil: 0 } } });
    const back = mornings(s, 200).find((x) => x.residents?.move?.back);
    expect(back).toBeDefined();
    expect(back!.residents!.move!.who).toBe('petr');
    expect(back!.residents!.gone).toBeUndefined();
    expect(regularState(back!, 'petr').loyalty).toBe(START_LOYALTY);
    expect(met(back!, regularById('petr'))).toBe(true);
  });
});

describe('жители: новость, улица, подсказка', () => {
  const moved = (): StoreState => mornings(good(), 60).find((s) => s.residents?.move && s.residents.move.day === s.day)!;

  it('новость ждёт несколько дней, прочитали — уходит', () => {
    const s = moved();
    expect(residentsNews(s)).not.toBeNull();
    expect(residentsNews({ ...s, day: s.day + RES_NEWS_DAYS })).not.toBeNull();
    expect(residentsNews({ ...s, day: s.day + RES_NEWS_DAYS + 1 })).toBeNull();
    const seen = seeResidents(s);
    expect(residentsNews(seen)).toBeNull();
    expect(seeResidents(seen)).toBe(seen);
  });

  it('новость — в очереди утра (headlines)', () => {
    const s = moved();
    expect(pickNews(s, ['residents']).id).toBe('residents');
  });

  it('фургон — только в день переезда; квартира переезда — граница заселённых', () => {
    const s = moved();
    expect(movingToday(s)).not.toBeNull();
    expect(movingFlat(s)).toBe(residents(s) - 1);
    expect(residentsLook(s)).toBe(`${residents(s)}+`);
    const next = { ...s, day: s.day + 1 };
    expect(movingToday(next)).toBeNull();
    expect(residentsLook(next)).toBe(String(residents(s)));
  });

  it('первая подсказка — после первого переезда, иконка своя', () => {
    const tip: TipId = 'residents';
    const seenAll = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== tip);
    expect(pendingTip({ ...good(), seenTips: seenAll })).toBeNull();
    expect(pendingTip({ ...moved(), seenTips: seenAll })).toBe(tip);
    const icons = Object.values(TIP_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('жители: сохранение и симулятор', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение грузится без поля; жители переживают сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 40 } as Record<string, unknown>;
    delete old.residents;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const loaded = loadGame()!;
    expect(loaded.residents).toBeUndefined();
    expect(residents(loaded)).toBe(RES_START);
    const res = { n: 15, gone: ['akhmed' as const], came: ['nadya' as const], move: { day: 39, dir: 1 as const, who: 'nadya' as const, seen: true } };
    saveGame({ ...loaded, residents: res });
    expect(loadGame()!.residents).toEqual(res);
  });

  it('симулятор идёт: банкротства нет, район меняется в пределах', () => {
    let last: StoreState | null = null;
    const r = simulate({ days: 120, seed: 1, onMorning: (s) => (last = s) });
    expect(r.bankruptDay).toBeNull();
    const n = residents(last as unknown as StoreState);
    expect(n).toBeGreaterThanOrEqual(RES_MIN);
    expect(n).toBeLessThanOrEqual(RES_MAX);
  });
});
