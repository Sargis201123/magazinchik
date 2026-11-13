import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  PAWN_FROM_LEVEL,
  PAWN_MARKUP,
  PAWN_POLICE_RATING,
  PAWN_SEIZED_KEEP,
  PAWN_SHARE,
  pawnMet,
  pawnMorning,
  pawnNews,
  pawnOf,
  pawnOffer,
  pawnOpen,
  pawnSlots,
  refusePawn,
  seePawnNews,
  takePawn,
  type PawnLoan,
  type PawnState,
} from '../src/game/pawnshop';
import { nightCycle } from '../src/game/day';
import { pendingTip } from '../src/game/tips';
import { pickNews } from '../src/game/headlines';
import { rng } from '../src/game/random';

// Ломбард в подсобке (pawnshop.ts): гость с вещью утром, выкуп с процентом, невыкупленное — на полку «Разное»,
// краденое забирает полиция. Всё — от зерна магазина и дня.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, seed: 7, level: PAWN_FROM_LEVEL, money: 20000, history: Array(7).fill(4000), ...over });
/** Ломбард уже работал (state.pawn есть): гость приходит не каждое утро. */
const used = (over: Partial<StoreState> = {}): StoreState => shop({ pawn: { loans: [], shelf: [], earned: 0, lost: 0 }, ...over });
const loan = (over: Partial<PawnLoan> = {}): PawnLoan => ({ item: 'watch', lent: 1000, back: 1150, day: 38, due: 41, fate: 'repay', ...over });
const withLoans = (loans: PawnLoan[], over: Partial<PawnState> = {}): StoreState => used({ pawn: { loans, shelf: [], earned: 0, lost: 0, ...over } });

/** Первое утро, начиная с from, когда к ломбарду пришёл гость. */
const firstOffer = (base: (day: number) => StoreState, from = 40) => {
  for (let day = from; day < from + 60; day++) {
    const offer = pawnOffer(base(day));
    if (offer) return { day, offer };
  }
  throw new Error('за 60 дней никто не пришёл');
};

describe('когда открыт ломбард', () => {
  it('с «Минимаркета» и только в Центре', () => {
    expect(pawnOpen(shop({ level: PAWN_FROM_LEVEL - 1 }))).toBe(false);
    expect(pawnOffer(shop({ level: PAWN_FROM_LEVEL - 1 }))).toBeNull();
    expect(pawnOpen(shop())).toBe(true);
    const zar = shop({ zar: { at: 'zar' } as StoreState['zar'] });
    expect(pawnOpen(zar)).toBe(false);
    expect(pawnOffer(zar)).toBeNull();
  });

  it('мест: два, в большом магазине — три', () => {
    expect(pawnSlots(shop())).toBe(2);
    expect(pawnSlots(shop({ level: 4 }))).toBe(3);
  });

  it('первая подсказка — когда ломбард открылся', () => {
    const seen = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'rhythm'];
    expect(pendingTip(shop({ level: 1, seenTips: seen }))).toBeNull();
    expect(pendingTip(shop({ seenTips: seen }))).toBe('pawn');
    expect(pendingTip(shop({ seenTips: [...seen, 'pawn'] }))).toBeNull();
  });
});

describe('гость с вещью', () => {
  it('в первое утро ломбарда приходит наверняка, и вещь честная', () => {
    for (let day = 30; day < 90; day++) {
      const offer = pawnOffer(shop({ day }));
      expect(offer).not.toBeNull();
      expect(offer!.fate).not.toBe('stolen');
    }
  });

  it('первого гостя ждут только до первого показа: без ответа он не приходит каждое утро', () => {
    const met = pawnMet(shop({ day: 40 }));
    expect(met.pawn?.first).toBe(40);
    // В утро показа гость остаётся тем же (перерисовка утра его не прогоняет) и его можно взять.
    expect(pawnOffer(met)).toEqual(pawnOffer(shop({ day: 40 })));
    expect(takePawn(met)?.pawn?.loans).toHaveLength(1);
    expect(pawnMet(met)).toBe(met);
    // Ответа не было, магазин открыли: дальше — как у всех, в треть утр.
    const came = Array.from({ length: 100 }, (_, i) => pawnOffer({ ...met, day: 41 + i })).filter(Boolean).length;
    expect(came).toBeGreaterThan(20);
    expect(came).toBeLessThan(55);
  });

  it('гость — одна из новостей утра: событие дня и главные повороты — раньше, истории для души — позже', () => {
    const s = shop();
    expect(pickNews(s, ['event', 'pawn']).id).toBe('event');
    expect(pickNews(s, ['drama', 'pawn']).id).toBe('drama');
    expect(pickNews(s, ['pawn', 'cat', 'tale']).id).toBe('pawn');
  });

  it('потом — не каждое утро; одно и то же утро даёт одного и того же гостя', () => {
    const days = Array.from({ length: 100 }, (_, i) => pawnOffer(used({ day: 40 + i })));
    const came = days.filter(Boolean).length;
    expect(came).toBeGreaterThan(20);
    expect(came).toBeLessThan(55);
    const { day, offer } = firstOffer((d) => used({ day: d }));
    expect(pawnOffer(used({ day }))).toEqual(offer);
    // Другое зерно магазина — другие утра.
    const other = Array.from({ length: 100 }, (_, i) => Boolean(pawnOffer(used({ day: 40 + i, seed: 99 }))));
    expect(other).not.toEqual(days.map(Boolean));
  });

  it('суммы — от средней выручки: около четверти дня, процент растёт со сроком', () => {
    for (let day = 40; day < 140; day++) {
      const offer = pawnOffer(used({ day }));
      if (!offer) continue;
      expect(offer.lent).toBeGreaterThanOrEqual(4000 * PAWN_SHARE * 0.6 * 0.8 - 10);
      expect(offer.lent).toBeLessThanOrEqual(4000 * PAWN_SHARE * 1.2 * 1.2 + 10);
      expect(offer.back).toBeGreaterThan(offer.lent);
      expect([3, 4, 5]).toContain(offer.days);
      expect(offer.rate).toBeCloseTo([0.1, 0.15, 0.2][offer.days - 3]);
      if (offer.fate === 'stolen') {
        expect(offer.police).toBeGreaterThanOrEqual(2);
        expect(offer.police).toBeLessThanOrEqual(offer.days);
      } else expect(offer.police).toBeUndefined();
    }
    // Выручка вдвое больше — и просят примерно вдвое больше.
    const { day, offer } = firstOffer((d) => used({ day: d }));
    expect(pawnOffer(used({ day, history: Array(7).fill(8000) }))!.lent).toBeCloseTo(offer.lent * 2, -1);
  });

  it('краденое чаще несут суетливые: примета подсказывает, но не наверняка', () => {
    const offers = Array.from({ length: 2000 }, (_, i) => pawnOffer(used({ day: 40 + i }))).filter((o) => o !== null);
    const stolen = offers.filter((o) => o.fate === 'stolen');
    const clean = offers.filter((o) => o.fate !== 'stolen');
    const shady = (list: typeof offers) => list.filter((o) => o.tell === 'shady').length / list.length;
    expect(stolen.length).toBeGreaterThan(0);
    expect(shady(stolen)).toBeGreaterThan(0.5);
    expect(shady(clean)).toBeLessThan(0.3);
    expect(new Set(offers.map((o) => o.fate))).toEqual(new Set(['repay', 'forfeit', 'stolen']));
  });

  it('все места заняты или уже ответили — сегодня никого', () => {
    const { day } = firstOffer((d) => used({ day: d }));
    expect(pawnOffer({ ...withLoans([loan(), loan({ item: 'ring' })]), day })).toBeNull();
    expect(pawnOffer({ ...withLoans([loan()]), day })).not.toBeNull();
    const answered = refusePawn(used({ day }));
    expect(answered.pawn?.answered).toBe(day);
    expect(pawnOffer(answered)).toBeNull();
    expect(answered.money).toBe(20000);
  });
});

describe('взять вещь', () => {
  it('деньги из кассы — гостю, вещь — в залог со сроком и судьбой', () => {
    const { day, offer } = firstOffer((d) => used({ day: d }));
    const s = takePawn(used({ day }))!;
    expect(s.money).toBe(20000 - offer.lent);
    expect(s.pawn!.answered).toBe(day);
    const [l] = s.pawn!.loans;
    expect(l).toMatchObject({ item: offer.item, lent: offer.lent, back: offer.back, day, due: day + offer.days, fate: offer.fate });
    if (offer.police) expect(l.police).toBe(day + offer.police);
    expect(pawnOffer(s)).toBeNull();
    expect(takePawn(s)).toBeNull();
  });

  it('не хватает денег — нельзя', () => {
    const { day, offer } = firstOffer((d) => used({ day: d }));
    expect(takePawn(used({ day, money: offer.lent - 1 }))).toBeNull();
    expect(takePawn(used({ day, money: offer.lent }))!.money).toBe(0);
  });

  it('первый раз: состояние ломбарда заводится при ответе', () => {
    const s = shop();
    expect(s.pawn).toBeUndefined();
    expect(refusePawn(s).pawn).toEqual({ loans: [], shelf: [], earned: 0, lost: 0, answered: 40 });
  });
});

describe('утро после срока', () => {
  it('выкупили: деньги с процентом в кассу, новость утра', () => {
    const s = pawnMorning({ ...withLoans([loan()]), day: 41 });
    expect(s.money).toBe(20000 + 1150);
    expect(s.pawn!.loans).toEqual([]);
    expect(s.pawn!.earned).toBe(150);
    expect(pawnNews(s)).toEqual([{ kind: 'back', item: 'watch', n: 1150 }]);
  });

  it('до срока ничего не происходит', () => {
    const before = { ...withLoans([loan()]), day: 40 };
    const s = pawnMorning(before);
    expect(s.money).toBe(before.money);
    expect(s.pawn!.loans).toHaveLength(1);
    expect(pawnNews(s)).toEqual([]);
  });

  it('не пришли: вещь на полке «Разное» дороже, чем отдали; потом её покупают', () => {
    let s = pawnMorning({ ...withLoans([loan({ fate: 'forfeit' })]), day: 41 });
    expect(s.money).toBe(20000);
    expect(s.pawn!.shelf).toEqual([{ item: 'watch', price: 1000 * PAWN_MARKUP, lent: 1000, day: 41 }]);
    expect(pawnNews(s)).toEqual([{ kind: 'kept', item: 'watch', n: 1600 }]);
    let day = 41;
    while (s.pawn!.shelf.length && day < 80) s = pawnMorning({ ...s, day: ++day });
    expect(s.pawn!.shelf).toEqual([]);
    expect(s.money).toBe(20000 + 1600);
    expect(s.pawn!.earned).toBe(600);
    expect(pawnNews(s)).toEqual([{ kind: 'sold', item: 'watch', n: 1600 }]);
  });

  it('краденое: полиция забирает вещь, деньги пропали, рейтинг чуть ниже, изъятое записано', () => {
    const start = { ...withLoans([loan({ fate: 'stolen', police: 40, due: 41 })]), rating: 4.5 };
    const s = pawnMorning({ ...start, day: 40 });
    expect(s.money).toBe(20000);
    expect(s.pawn!.loans).toEqual([]);
    expect(s.pawn!.shelf).toEqual([]);
    expect(s.pawn!.lost).toBe(1000);
    expect(s.rating).toBeCloseTo(4.5 - PAWN_POLICE_RATING);
    expect(s.pawn!.seized).toEqual([{ item: 'watch', lent: 1000, took: 38, day: 40 }]);
    expect(pawnNews(s)).toEqual([{ kind: 'police', item: 'watch', n: 1000 }]);
    // Краденое на полку не попадает, даже если полиция «опоздала» к сроку.
    const late = pawnMorning({ ...withLoans([loan({ fate: 'stolen', police: undefined })]), day: 41 });
    expect(late.pawn!.shelf).toEqual([]);
    expect(late.pawn!.seized).toHaveLength(1);
  });

  it('изъятых помним не больше PAWN_SEIZED_KEEP', () => {
    const old = Array.from({ length: PAWN_SEIZED_KEEP }, (_, i) => ({ item: 'ring' as const, lent: 100, took: i, day: i + 2 }));
    const s = pawnMorning({ ...withLoans([loan({ fate: 'stolen', police: 40 })], { seized: old }), day: 40 });
    expect(s.pawn!.seized).toHaveLength(PAWN_SEIZED_KEEP);
    expect(s.pawn!.seized!.at(-1)!.item).toBe('watch');
  });

  it('новости закрываются; на следующее утро без событий их нет', () => {
    const s = pawnMorning({ ...withLoans([loan()]), day: 41 });
    expect(pawnNews(seePawnNews(s))).toEqual([]);
    const next = pawnMorning({ ...s, day: 42 });
    expect(next.pawn!.news).toBeUndefined();
  });

  it('утро повторить нельзя «перекатом»: тот же день — тот же итог', () => {
    const base = { ...withLoans([], { shelf: [{ item: 'bike', price: 1600, lent: 1000, day: 30 }, { item: 'ring', price: 3200, lent: 2000, day: 31 }] }), day: 45 };
    expect(pawnMorning(base)).toEqual(pawnMorning(base));
  });
});

describe('старые сохранения и смена дня', () => {
  it('без ломбарда утро ничего не меняет', () => {
    const s = shop();
    expect(pawnMorning(s)).toBe(s);
    expect(pawnOf(s)).toEqual({ loans: [], shelf: [], earned: 0, lost: 0 });
  });

  it('неизвестная вещь из кривого сохранения отбрасывается', () => {
    const s = used({ pawn: { loans: [loan(), { ...loan(), item: 'tv' as 'watch' }], shelf: [{ item: 'yacht' as 'bike', price: 1, lent: 1, day: 1 }], earned: 0, lost: 0 } });
    expect(pawnOf(s).loans).toHaveLength(1);
    expect(pawnOf(s).shelf).toEqual([]);
  });

  it('смена дня (day.ts) выкупает залог: деньги приходят утром', () => {
    const s = { ...withLoans([loan({ due: 41 })]), day: 40, reports: [] };
    const night = nightCycle(s, emptyDayStats(), rng(3));
    expect(night.state.day).toBe(41);
    expect(night.state.pawn!.loans).toEqual([]);
    expect(night.state.pawn!.news?.events).toEqual([{ kind: 'back', item: 'watch', n: 1150 }]);
    const without = nightCycle({ ...s, pawn: { loans: [], shelf: [], earned: 0, lost: 0 } }, emptyDayStats(), rng(3));
    expect(night.state.money - without.state.money).toBe(1150);
  });
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

  it('старое сохранение без ломбарда грузится как было; ломбард переживает сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 50, level: 3 } as Record<string, unknown>;
    delete old.pawn;
    local['magazinchik.save'] = JSON.stringify({ version: 9, state: old });
    const s = loadGame()!;
    expect(s.pawn).toBeUndefined();
    const taken = { ...s, pawn: { loans: [loan()], shelf: [{ item: 'guitar' as const, price: 900, lent: 560, day: 49 }], earned: 120, lost: 0, answered: 50 } };
    saveGame(taken);
    expect(loadGame()!.pawn).toEqual(taken.pawn);
  });
});
