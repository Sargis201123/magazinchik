import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  BOAT_GUESTS,
  BREAD_CUT,
  breadCut,
  CART_SHARE,
  cartHere,
  cartIncome,
  DREAM_ASK_AGAIN,
  DREAM_GAP,
  DREAM_IDS,
  DREAM_WAIT,
  dreamDue,
  dreamGift,
  dreamGuests,
  dreamNews,
  dreamOffer,
  DREAMS,
  dreamsNight,
  dreamSum,
  dreamWorks,
  GIFT_SHARE,
  investDream,
  LEVEL_SCALE,
  PAYBACK,
  seeDream,
  skipDream,
  waitOf,
  type DreamId,
  type DreamInvest,
} from '../src/game/dreams';
import { MAX_LOYALTY, regularState } from '../src/game/regulars';
import { priceFor } from '../src/game/suppliers';
import { guestFactor, nightCycle } from '../src/game/day';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { pickNews } from '../src/game/headlines';
import { simulate } from '../src/game/simulate';

// Мечты соседей (dreams.ts, 13.11): кто и когда приходит с мечтой, деньги туда и обратно, исход от зерна и дня,
// что даёт сбывшаяся мечта, старые сохранения и симулятор.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 30, level: 2, money: 20_000, debt: 0, rating: 4, seed: 7, ...over });

/** Вложиться в мечту id в день day и дождаться новости. */
function investAndWait(id: DreamId, seed: number, day = 90): { state: StoreState; inv: DreamInvest } {
  const before = { ...shop({ day, seed }), dreams: { later: {}, gone: DREAM_IDS.filter((x) => x !== id) } };
  const invested = investDream(before, id)!;
  const inv = invested.dreams!.inv![0];
  return { state: { ...invested, day: day + waitOf(invested, inv) }, inv };
}

/** Зерно, на котором мечта сбывается (ok) или прогорает. */
function seedWhere(id: DreamId, ok: boolean, gift?: boolean): number {
  for (let seed = 1; seed < 500; seed++) {
    const s = shop({ day: 90, seed });
    const v = { id, day: 90, sum: dreamSum(s, id) };
    if (dreamWorks(s, v) === ok && (gift === undefined || (dreamGift(s, v) > 0) === gift)) return seed;
  }
  throw new Error('нет такого зерна');
}

describe('мечты: кто и когда приходит', () => {
  it('до 30-го дня — никого, на 30-й — Костя со своей тележкой', () => {
    expect(dreamOffer(shop({ day: 29 }))).toBeNull();
    expect(dreamNews(shop({ day: 29 }))).toBeNull();
    expect(dreamOffer(shop())).toBe('kostya');
    expect(dreamNews(shop())).toEqual({ kind: 'ask', id: 'kostya', sum: 800 });
  });

  it('по порядку и по своим дням: Аня с 45-го, Пётр Ильич с 60-го, Ахмед с 80-го', () => {
    const after = (ids: DreamId[], day: number) => dreamOffer({ ...shop({ day }), dreams: { gone: ids } });
    expect(after(['kostya'], 44)).toBeNull();
    expect(after(['kostya'], 45)).toBe('anya');
    expect(after(['kostya', 'anya'], 59)).toBeNull();
    expect(after(['kostya', 'anya'], 60)).toBe('petr');
    expect(after(['kostya', 'anya', 'petr'], 80)).toBe('akhmed');
    expect(after([...DREAM_IDS], 200)).toBeNull();
  });

  it('обиженный постоянный с мечтой не приходит, пока не вернётся', () => {
    const angry = shop({ regulars: { kostya: { loyalty: 1, awayUntil: 35 } } });
    expect(dreamOffer(angry)).toBeNull();
    expect(dreamOffer({ ...angry, day: 36 })).toBe('kostya');
  });

  it('в Заречье мечт и новостей нет — это наш район', () => {
    const zar = { ...shop(), zar: { at: 'zar', away: { level: 2 } } } as unknown as StoreState;
    expect(dreamNews(zar)).toBeNull();
  });

  it('сумма растёт с помещением в Центре', () => {
    expect(LEVEL_SCALE).toHaveLength(7);
    for (let i = 1; i < LEVEL_SCALE.length; i++) expect(LEVEL_SCALE[i]).toBeGreaterThan(LEVEL_SCALE[i - 1]);
    expect(dreamSum(shop({ level: 2 }), 'kostya')).toBe(800);
    expect(dreamSum(shop({ level: 4 }), 'kostya')).toBe(1600);
    expect(dreamSum(shop({ level: 0 }), 'anya')).toBe(600);
    for (const id of DREAM_IDS) expect(dreamSum(shop({ level: 5 }), id) % 50).toBe(0);
  });
});

describe('мечты: вложиться или «Не сейчас»', () => {
  it('вложиться: деньги уходят, вложение записано, карточек сегодня больше нет', () => {
    const s = shop();
    const next = investDream(s, 'kostya')!;
    expect(next.money).toBe(s.money - 800);
    expect(next.dreams?.inv).toEqual([{ id: 'kostya', day: 30, sum: 800 }]);
    expect(dreamNews(next)).toBeNull();
  });

  it('не хватает денег или мечта не та — нельзя', () => {
    expect(investDream(shop({ money: 799 }), 'kostya')).toBeNull();
    expect(investDream(shop(), 'anya')).toBeNull();
  });

  it('после карточки — передышка, потом следующая мечта', () => {
    const s = investDream(shop({ day: 50 }), 'kostya')!;
    expect(dreamOffer({ ...s, day: 50 + DREAM_GAP - 1 })).toBeNull();
    expect(dreamOffer({ ...s, day: 50 + DREAM_GAP })).toBe('anya');
  });

  it('«Не сейчас»: вернётся через три недели, второй отказ — больше не просит', () => {
    const once = skipDream(shop(), 'kostya');
    expect(once.money).toBe(shop().money);
    // Пока Костя «копит сам», может прийти следующий — Аня с 45-го.
    expect(dreamOffer({ ...once, day: 30 + DREAM_ASK_AGAIN - 1 })).not.toBe('kostya');
    const back = { ...once, day: 30 + DREAM_ASK_AGAIN };
    expect(dreamOffer(back)).toBe('kostya');
    const twice = skipDream(back, 'kostya');
    expect(twice.dreams?.gone).toEqual(['kostya']);
    expect(dreamOffer({ ...twice, day: 200 })).not.toBe('kostya');
  });

  it('первое вложение — карточка «Новое» о том, когда ждать новостей и где список', () => {
    // Все прочие подсказки уже видены (список — из TIP_ICONS, чтобы новые подсказки main не ломали тест).
    const s = { ...shop(), seenTips: (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'dreams') };
    expect(pendingTip(s)).toBeNull();
    expect(pendingTip(investDream(s, 'kostya')!)).toBe('dreams');
  });

  it('новость стоит в общей очереди утра — одна за утро', () => {
    const s = shop();
    const picked = pickNews(s, ['dream', 'life']);
    expect(picked.id).toBe('life');
    expect(pickNews(s, ['dream']).id).toBe('dream');
  });
});

describe('мечты: исход — от зерна магазина и дня вложения', () => {
  it('срок и исход одни и те же при тех же зерне и дне', () => {
    const s = shop({ day: 90, seed: 42 });
    const v: DreamInvest = { id: 'petr', day: 90, sum: 1000 };
    expect(waitOf(s, v)).toBe(waitOf({ ...s, money: 1 }, v));
    expect(dreamWorks(s, v)).toBe(dreamWorks({ ...s, day: 120, money: 5 }, v));
    expect(dreamGift(s, v)).toBe(dreamGift({ ...s, rating: 1 }, v));
  });

  it('новость — через две-три недели', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const w = waitOf(shop({ seed }), { id: 'anya', day: 45, sum: 1200 });
      expect(w).toBeGreaterThanOrEqual(DREAM_WAIT[0]);
      expect(w).toBeLessThanOrEqual(DREAM_WAIT[1]);
    }
  });

  it('сбывается примерно с заданным шансом, бывает и провал', () => {
    for (const id of DREAM_IDS) {
      let ok = 0;
      const runs = 2000;
      for (let seed = 1; seed <= runs; seed++) if (dreamWorks(shop({ seed }), { id, day: 70, sum: 1000 })) ok++;
      expect(ok / runs).toBeGreaterThan(DREAMS[id].chance - 0.05);
      expect(ok / runs).toBeLessThan(DREAMS[id].chance + 0.05);
    }
  });

  it('до срока новости нет, в срок — есть; исход не меняется от того, когда прочитали', () => {
    const { state, inv } = investAndWait('kostya', 3);
    expect(dreamDue({ ...state, day: state.day - 1 })).toBeNull();
    expect(dreamDue(state)).toEqual(inv);
    const news = dreamNews(state)!;
    expect(news.kind).toBe('result');
    const later = dreamNews({ ...state, day: state.day + 5 })!;
    expect(later.kind === 'result' && news.kind === 'result' && later.ok === news.ok).toBe(true);
  });
});

describe('мечты: что даёт сбывшаяся', () => {
  it('Костя: тележка у входа и доля каждый вечер — до счетов', () => {
    const { state } = investAndWait('kostya', seedWhere('kostya', true));
    expect(cartIncome(state)).toBe(0);
    const seen = seeDream(state)!;
    expect(seen.dreams!.inv![0].end).toBe('ok');
    expect(cartHere(seen)).toBe(true);
    const income = Math.round(dreamSum(shop({ day: 90 }), 'kostya') * CART_SHARE);
    expect(cartIncome(seen)).toBe(income);
    expect(dreamsNight(seen).state.money).toBe(seen.money + income);
    const night = nightCycle(seen, emptyDayStats(), () => 0.5);
    expect(night.cart).toBe(income);
    expect(regularState(seen, 'kostya').loyalty).toBe(MAX_LOYALTY);
  });

  it('Аня: хлеб у поставщиков дешевле — и руками, и автозаказом; другое — как было', () => {
    const { state } = investAndWait('anya', seedWhere('anya', true));
    const seen = seeDream(state)!;
    expect(breadCut(seen)).toBe(BREAD_CUT);
    const was = priceFor(state)('farmer', 'bread')!;
    expect(priceFor(seen)('farmer', 'bread')).toBe(Math.max(1, Math.round(was * (1 - BREAD_CUT))));
    expect(priceFor(seen)('farmer', 'apples')).toBe(priceFor(state)('farmer', 'apples'));
    // В Заречье Аня хлеб не возит.
    expect(breadCut({ ...seen, zar: { at: 'zar', away: { level: 2 } } } as unknown as StoreState)).toBe(0);
  });

  it('Пётр Ильич: по выходным гостей больше, в будни — как было', () => {
    const { state } = investAndWait('petr', seedWhere('petr', true));
    const seen = seeDream(state)!;
    expect(dreamGuests(seen)).toBe(1);
    expect(dreamGuests({ ...seen, rush: true })).toBe(1 + BOAT_GUESTS);
    expect(guestFactor({ ...seen, rush: true }) / guestFactor({ ...state, rush: true })).toBeCloseTo(1 + BOAT_GUESTS, 5);
  });

  it('Ахмед: возвращает вдвое', () => {
    const { state, inv } = investAndWait('akhmed', seedWhere('akhmed', true));
    const seen = seeDream(state)!;
    expect(seen.money).toBe(state.money + inv.sum * PAYBACK);
    expect(dreamNews(seen)).toBeNull();
  });

  it('прогорело: деньги пропали, но доверие — до предела, иногда гостинец', () => {
    const plain = investAndWait('kostya', seedWhere('kostya', false, false));
    const seen = seeDream(plain.state)!;
    expect(seen.money).toBe(plain.state.money);
    expect(seen.dreams!.inv![0].end).toBe('fail');
    expect(cartIncome(seen)).toBe(0);
    expect(regularState(seen, 'kostya').loyalty).toBe(MAX_LOYALTY);
    const gifted = investAndWait('petr', seedWhere('petr', false, true));
    const thanks = seeDream(gifted.state)!;
    expect(thanks.money - gifted.state.money).toBe(Math.round((gifted.inv.sum * GIFT_SHARE) / 10) * 10);
    expect(dreamGuests({ ...thanks, rush: true })).toBe(1);
  });

  it('прочитать новость можно только в срок и один раз', () => {
    expect(seeDream(shop())).toBeNull();
    const { state } = investAndWait('anya', 5);
    const seen = seeDream(state)!;
    expect(seeDream(seen)).toBeNull();
    expect(seeDream({ ...seen, day: seen.day + 1 })).toBeNull();
  });
});

describe('мечты: старые сохранения', () => {
  it('без поля dreams всё работает как раньше', () => {
    const old = shop({ day: 10 });
    delete old.dreams;
    expect(dreamNews(old)).toBeNull();
    expect(cartIncome(old)).toBe(0);
    expect(breadCut(old)).toBe(0);
    expect(dreamGuests({ ...old, rush: true })).toBe(1);
    expect(dreamsNight(old).state).toBe(old);
    expect(priceFor(old)('farmer', 'bread')).toBe(priceFor({ ...old, dreams: {} })('farmer', 'bread'));
  });

  it('неизвестная мечта в сохранении не ломает игру', () => {
    const odd = { ...shop(), dreams: { inv: [{ id: 'zzz', day: 1, sum: 5 }] } } as unknown as StoreState;
    expect(dreamDue(odd)).toBeNull();
    expect(dreamOffer(odd)).toBe('kostya');
  });
});

describe('мечты: сохранение', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение грузится без поля, вложения переживают сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = { ...newGame(), day: 40 } as Record<string, unknown>;
    delete old.dreams;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const loaded = loadGame()!;
    expect(loaded.dreams).toBeUndefined();
    expect(dreamNews(loaded)).not.toBeNull();
    const dreams = { inv: [{ id: 'kostya' as const, day: 30, sum: 800, end: 'ok' as const }], later: { anya: 70 }, last: 46 };
    saveGame({ ...loaded, dreams });
    expect(loadGame()!.dreams).toEqual(dreams);
  });
});

describe('мечты: симулятор', () => {
  it('разумный игрок вкладывается и узнаёт исход; игра идёт дальше', () => {
    let last: StoreState | null = null;
    const r = simulate({ days: 120, seed: 1, onMorning: (s) => (last = s) });
    expect(r.bankruptDay).toBeNull();
    const inv = (last as StoreState | null)?.dreams?.inv ?? [];
    expect(inv.length).toBeGreaterThan(0);
    expect(inv.some((v) => v.end)).toBe(true);
  });
});
