import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState, type Unit } from '../src/game/economy';
import {
  answerGrey,
  GREY_CHANCE,
  GREY_FROM_DAY,
  GREY_GAP,
  GREY_GOODWILL,
  GREY_KINDS,
  GREY_RISK_BASE,
  GREY_RISK_MAX,
  GREY_RISK_STEP,
  GREY_SEALED_GUESTS,
  greyCaught,
  greyCover,
  greyCovered,
  greyFine,
  greyGuests,
  greyNight,
  greyOf,
  greyOffer,
  greyRate,
  greyRisk,
  greySealed,
  seeGreyCaught,
  type GreyKind,
  type GreyOffer,
} from '../src/game/grey';
import { echoesOf, answerEcho, ECHOES } from '../src/game/echoes';
import { licenseNight } from '../src/game/license';
import { guestFactor, nightCycle } from '../src/game/day';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { pickNews } from '../src/game/headlines';
import { reviewsFor } from '../src/game/reviews';
import { simulate } from '../src/game/simulate';

// Серая схема (13.11, задача #53): Жора приходит с предложением мимо закона — товар без накладных, «договориться»
// с проверяющим, перебить даты на просрочке. Согласился — выгода сразу и скрытый риск попасться; отказал — обида
// или спасибо от полиции. Всё — от зерна магазина и дня.

const stale = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0, markdown: true }));
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: GREY_FROM_DAY, level: 1, money: 20000, seed: 7, ...over });

/** Первое утро (день ≥ from), когда Жора приходит именно с этим. */
function find(kind: GreyKind, base: StoreState = shop(), from = GREY_FROM_DAY): { state: StoreState; offer: GreyOffer } {
  for (let seed = 1; seed < 40; seed++)
    for (let day = from; day < from + 200; day++) {
      const state = { ...base, seed, day };
      const offer = greyOffer(state);
      if (offer?.kind === kind) return { state, offer };
    }
  throw new Error(`нет предложения ${kind}`);
}

describe('серая схема: когда приходит', () => {
  it('не раньше середины игры, не в ларьке и не в Заречье', () => {
    const days = (base: StoreState) => Array.from({ length: 200 }, (_, i) => greyOffer({ ...base, day: base.day + i })).filter(Boolean).length;
    expect(days(shop({ day: 1 }))).toBeGreaterThan(0);
    for (let day = 1; day < GREY_FROM_DAY; day++) expect(greyOffer(shop({ day }))).toBeNull();
    expect(days(shop({ level: 0 }))).toBe(0);
    expect(days(shop({ zar: { at: 'zar' } as StoreState['zar'] }))).toBe(0);
  });

  it('детерминированно: тот же магазин в тот же день — то же предложение; заходит примерно в треть утр', () => {
    const s = find('goods').state;
    expect(greyOffer(s)).toEqual(greyOffer({ ...s }));
    const hits = Array.from({ length: 1000 }, (_, i) => greyOffer(shop({ day: GREY_FROM_DAY + i, warehouse: { apples: stale(6) } }))).filter(Boolean).length;
    expect(hits / 1000).toBeGreaterThan(GREY_CHANCE - 0.07);
    expect(hits / 1000).toBeLessThan(GREY_CHANCE + 0.07);
  });

  it('после ответа — пауза GREY_GAP дней; ответить дважды нельзя', () => {
    const { state } = find('bribe');
    const after = answerGrey(state, false)!;
    expect(answerGrey(after, true)).toBeNull();
    for (let d = 0; d < GREY_GAP; d++) expect(greyOffer({ ...after, day: state.day + d })).toBeNull();
    expect(greyOf(after).next).toBe(state.day + GREY_GAP);
  });

  it('бывает всех трёх видов', () => {
    const base = shop({ warehouse: { apples: stale(8) } });
    for (const kind of GREY_KINDS) expect(find(kind, base).offer.kind).toBe(kind);
  });
});

describe('серая схема: согласился', () => {
  it('товар без накладных: партия на склад за полцены, деньги — сразу', () => {
    const { state, offer } = find('goods');
    expect(offer.product).toBeDefined();
    const id = offer.product!;
    const s = answerGrey(state, true)!;
    expect(s.money).toBe(state.money - offer.price);
    expect(s.warehouse[id]!.length).toBe((state.warehouse[id]?.length ?? 0) + offer.qty);
    expect(offer.gain).toBeGreaterThan(0);
    expect(greyOf(s).deals).toBe(1);
  });

  it('просрочка под новой этикеткой: уценка уходит по полной цене, с полок и склада — нет её больше', () => {
    const { state, offer } = find('relabel', shop({ warehouse: { apples: stale(5) }, bargain: { potatoes: stale(2) } }));
    expect(offer.qty).toBe(7);
    expect(offer.gain).toBe(5 * state.prices.apples + 2 * state.prices.potatoes);
    const s = answerGrey(state, true)!;
    expect(s.money).toBe(state.money + offer.gain);
    expect(s.warehouse.apples).toEqual([]);
    expect(s.bargain!.potatoes).toEqual([]);
  });

  it('взятка: следующий штраф санинспекции не выпишут — один раз', () => {
    const { state, offer } = find('bribe');
    const s = answerGrey(state, true)!;
    expect(s.money).toBe(state.money - offer.price);
    expect(greyCovered(s)).toBe(true);
    const failed = { passed: false, problems: ['inspection.trash'], fine: 350 };
    const c = greyCover(s, failed);
    expect(c.covered).toBe(true);
    expect(c.result).toMatchObject({ passed: true, fine: 0, problems: [] });
    expect(greyCovered(c.state)).toBe(false);
    // Второй раз уже не прикрывает.
    expect(greyCover(c.state, failed).result.fine).toBe(350);
    // Чистую проверку «договорённость» не тратит.
    expect(greyCover(s, { passed: true, problems: [], fine: 0 }).covered).toBe(false);
  });

  it('взятка прикрывает и проверку лицензии: продажа подростку без штрафа', () => {
    const { state } = find('bribe', shop({ license: { since: 1, strikes: 2, fined: 0 } }));
    const s = answerGrey(state, true)!;
    // Ищем вечер проверки лицензии.
    let night: StoreState | null = null;
    for (let day = s.day; day < s.day + 400 && !night; day++) {
      const probe = { ...s, day };
      const after = licenseNight(probe);
      if (after.license?.last?.day === day) night = after;
    }
    expect(night).not.toBeNull();
    expect(night!.money).toBe(s.money);
    expect(night!.license!.strikes).toBe(0);
    expect(night!.license!.fined).toBe(0);
    expect(greyCovered(night!)).toBe(false);
  });

  it('риск копится с каждой сделкой и не выше потолка', () => {
    expect(greyRisk(0)).toBe(GREY_RISK_BASE);
    expect(greyRisk(2)).toBeCloseTo(GREY_RISK_BASE + 2 * GREY_RISK_STEP);
    expect(greyRisk(100)).toBe(GREY_RISK_MAX);
    // На многих магазинах: после пяти сделок попадаются заметно чаще, чем на первой.
    const share = (deals: number) => {
      let caught = 0;
      let n = 0;
      for (let seed = 1; seed < 300; seed++) {
        const st = shop({ seed, day: 60, grey: { deals } });
        if (!greyOffer(st)) continue;
        n++;
        if (greyOf(answerGrey(st, true)!).busts?.length) caught++;
      }
      return caught / n;
    };
    expect(share(5)).toBeGreaterThan(share(0) + 0.3);
  });

  it('ответ детерминирован: тот же день — тот же «хвост» сделки', () => {
    const { state } = find('goods');
    expect(answerGrey(state, true)).toEqual(answerGrey({ ...state }, true));
  });

  it('продал просрочку и не попался — через неделю–две отравление (эхо)', () => {
    for (let seed = 1; seed < 200; seed++) {
      const st = shop({ seed, day: 50, warehouse: { apples: stale(6) } });
      const offer = greyOffer(st);
      if (offer?.kind !== 'relabel') continue;
      const s = answerGrey(st, true)!;
      const poisoned = echoesOf(s).list.some((e) => e.id === 'greyPoison');
      expect(poisoned).toBe(!greyOf(s).busts?.length);
      if (poisoned) {
        const e = echoesOf(s).list.find((x) => x.id === 'greyPoison')!;
        expect(e.due - st.day).toBeGreaterThanOrEqual(7);
        expect(e.due - st.day).toBeLessThanOrEqual(14);
      }
    }
  });
});

describe('серая схема: попался', () => {
  const busted = (over: Partial<StoreState> = {}) => shop({ day: 60, money: 5000, grey: { deals: 2, busts: [{ kind: 'relabel', due: 60, fine: 3000 }], cover: true }, ...over });

  it('ночью: штраф, рейтинг и доброе имя вниз, наутро опечатан до обеда', () => {
    const s = busted();
    const n = greyNight(s);
    expect(n.money).toBe(2000);
    expect(n.debt).toBe(s.debt);
    expect(n.goodwill).toBe(GREY_GOODWILL);
    expect(n.rating).toBeLessThan(s.rating);
    expect(greyOf(n).busts).toBeUndefined();
    expect(greyOf(n).sealed).toBe(61);
    expect(greyCaught(n)).toMatchObject({ kind: 'relabel', fine: 3000 });
    expect(greyCaught(seeGreyCaught(n))).toBeNull();
    // Не взятка — «договорённость» с проверяющим цела.
    expect(greyCovered(n)).toBe(true);
    // День хвоста ещё не пришёл — ничего.
    expect(greyNight(busted({ day: 59 }))).toEqual(busted({ day: 59 }));
  });

  it('штрафа больше, чем в кассе, — остаток в долг; взятка сгорает вместе с проверяющим', () => {
    const s = busted({ money: 1000, grey: { busts: [{ kind: 'bribe', due: 60, fine: 3000 }], cover: true } });
    const n = greyNight(s);
    expect(n.money).toBe(0);
    expect(n.debt).toBe(s.debt + 2000);
    expect(greyCovered(n)).toBe(false);
  });

  it('за ночь — не больше одного хвоста', () => {
    const n = greyNight(busted({ grey: { busts: [{ kind: 'goods', due: 58, fine: 1000 }, { kind: 'bribe', due: 59, fine: 1000 }] } }));
    expect(greyOf(n).busts).toEqual([{ kind: 'bribe', due: 59, fine: 1000 }]);
  });

  it('опечатанный день: гостей вдвое меньше; в зале до обеда никого, потом — обычный поток', () => {
    const s = { ...greyNight(busted()), day: 61 };
    expect(greySealed(s)).toBe(true);
    expect(greyGuests(s)).toBe(GREY_SEALED_GUESTS);
    expect(guestFactor(s) / guestFactor({ ...s, grey: {} })).toBeCloseTo(GREY_SEALED_GUESTS);
    expect(greyRate(s, 0.2)).toBe(0);
    expect(greyRate(s, 0.7) * GREY_SEALED_GUESTS).toBe(1);
    expect(greySealed({ ...s, day: 62 })).toBe(false);
    expect(greyRate({ ...s, day: 62 }, 0.2)).toBe(1);
  });

  it('штраф — втрое больше выгоды, но не меньше порога по помещению', () => {
    const s = shop({ level: 2 });
    expect(greyFine(s, 100)).toBe(2000);
    expect(greyFine(s, 1000)).toBe(3000);
  });

  it('в смене дня (nightCycle) хвост срабатывает до счетов, наутро — опечатано', () => {
    const night = nightCycle(busted(), emptyDayStats(), () => 0.5);
    expect(greySealed(night.state)).toBe(true);
    expect(greyCaught(night.state)?.fine).toBe(3000);
  });

  it('опечатанный день — разгромный отзыв первым', () => {
    const r = reviewsFor(emptyDayStats(), 61, 0, true);
    expect(r[0].topic).toBe('grey');
    expect(r[0].stars).toBeLessThanOrEqual(2);
    expect(reviewsFor(emptyDayStats(), 61, 0, false).some((x) => x.topic === 'grey')).toBe(false);
  });
});

describe('серая схема: отказал', () => {
  it('ничего не платит; партия иногда оказывается краденой (спасибо полиции), иначе Жора бывает мстит', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 300; seed++) {
      const st = shop({ seed, day: 60, warehouse: { apples: stale(6) } });
      if (!greyOffer(st)) continue;
      const s = answerGrey(st, false)!;
      expect(s.money).toBe(st.money);
      expect(greyOf(s).refused).toBe(1);
      expect(greyOf(s).busts).toBeUndefined();
      for (const e of echoesOf(s).list) {
        seen.add(e.id);
        if (e.id === 'greyRevenge') expect(e.due - st.day).toBeLessThanOrEqual(5);
      }
    }
    expect(seen).toEqual(new Set(['greyStolen', 'greyRevenge']));
  });

  it('эхо серой схемы: месть стоит денег, спасибо полиции — рейтинг', () => {
    expect(ECHOES.greyRevenge.choices[0].effect.money).toBeLessThan(0);
    const s = shop({ day: 70, echoes: { list: [{ id: 'greyRevenge', due: 70 }, { id: 'greyStolen', due: 70 }] } });
    expect(answerEcho(s, 'greyRevenge')!.money).toBe(s.money + ECHOES.greyRevenge.choices[0].effect.money!);
    expect(answerEcho(s, 'greyStolen')!.rating).toBeGreaterThan(s.rating);
  });
});

describe('серая схема: утро и подсказка', () => {
  it('новость утра — в общей очереди', () => {
    const { state } = find('bribe');
    expect(pickNews(state, ['grey']).id).toBe('grey');
  });

  it('первая подсказка — в утро первого предложения (список прочих — из TIP_ICONS)', () => {
    const { state } = find('bribe');
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'grey');
    expect(pendingTip({ ...state, seenTips: others })).toBe('grey');
    expect(pendingTip({ ...state, day: state.day + 1, seenTips: others, grey: { next: state.day + 99 } })).toBeNull();
    expect(TIP_ICONS.grey).toBe('🦊');
  });
});

describe('серая схема: сохранения и симулятор', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение без поля grey грузится как было; сделки и хвосты переживают сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = shop({ day: 45 });
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const loaded = loadGame()!;
    expect(loaded.grey).toBeUndefined();
    expect(greyOf(loaded)).toEqual({});
    expect(greySealed(loaded)).toBe(false);
    expect(greyGuests(loaded)).toBe(1);
    const { state } = find('goods', loaded);
    const dealt = answerGrey(state, true)!;
    saveGame(dealt);
    expect(loadGame()!.grey).toEqual(dealt.grey);
  });

  it('симулятор, который соглашается на всё, доживает до конца', () => {
    const { days } = simulate({ days: 90, seed: 3, features: { grey: true } });
    expect(days.length).toBe(90);
  });
});
