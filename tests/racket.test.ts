import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  answerRaise,
  chooseRacket,
  JAILED_GOODWILL,
  RACKET_CHANCE,
  RACKET_FROM,
  RACKET_MIN,
  RACKET_RAISE,
  RACKET_RATE,
  RACKET_RATE_MAX,
  racketAsk,
  racketGuests,
  racketHit,
  racketMorning,
  racketNews,
  racketShare,
  racketStarts,
  seeRacketNews,
  TRASH_GUESTS,
  troubleCost,
  TROUBLE_DAYS,
  type RacketState,
} from '../src/game/racket';
import { caseMorning, openCase, openCaseOf } from '../src/game/cases';
import { accuse, CASES, extraClues } from '../src/game/caseBoard';
import { echoesOf, echoNews } from '../src/game/echoes';
import { goodwillOf } from '../src/game/goodwill';
import { guestFactor } from '../src/game/day';
import { pickNews } from '../src/game/headlines';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import { ru, type TextKey } from '../src/i18n/ru';

// «Крыша» (racket.ts): когда приходят, что стоит каждый ответ, пакости после отказа, дело в полиции,
// эхо «поднимаем ставку» и благодарность соседей; старые сохранения — без изменений.

const WEEK = [700, 800, 900, 1000, 1100, 1200, 1300];
const shop = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  tourDone: true,
  level: 2,
  money: 5000,
  seed: 4242,
  day: 50,
  rating: 3,
  history: [...WEEK],
  ...over,
});
/** Ребята пришли этим утром (ещё не ответили). */
const visited = (over: Partial<StoreState> = {}): StoreState => shop({ racket: { from: 50 }, ...over });
/** Утро следующего дня, как в day.ts: сначала дела недели, потом «крыша». */
const next = (s: StoreState): StoreState => racketMorning(caseMorning({ ...s, day: s.day + 1 }));
const days = (s: StoreState, n: number): StoreState => {
  let out = s;
  for (let i = 0; i < n; i++) out = next(out);
  return out;
};
/** Дни, когда в этом магазине пришли бы ребята. */
const startDays = (s: StoreState, from: number, to: number): number[] => {
  const out: number[] = [];
  for (let day = from; day < to; day++) if (racketStarts({ ...s, day })) out.push(day);
  return out;
};

describe('когда приходят', () => {
  it('только от зерна и дня: тот же магазин — те же дни; другой — другие; шанс — около RACKET_CHANCE', () => {
    const a = startDays(shop(), RACKET_FROM, RACKET_FROM + 1000);
    expect(startDays(shop(), RACKET_FROM, RACKET_FROM + 1000)).toEqual(a);
    expect(startDays(shop({ seed: 777 }), RACKET_FROM, RACKET_FROM + 1000)).not.toEqual(a);
    expect(a.length / 1000).toBeGreaterThan(RACKET_CHANCE * 0.6);
    expect(a.length / 1000).toBeLessThan(RACKET_CHANCE * 1.4);
  });

  it('не раньше середины игры, не в обучении, не в Заречье, не в беду района и только один раз', () => {
    const day = startDays(shop(), RACKET_FROM, 400)[0];
    expect(racketStarts(shop({ day }))).toBe(true);
    expect(startDays(shop(), 1, RACKET_FROM)).toEqual([]);
    expect(racketStarts(shop({ day, level: 1 }))).toBe(false);
    expect(racketStarts(shop({ day, tut: { step: 'serve' } as StoreState['tut'] }))).toBe(false);
    expect(racketStarts(shop({ day, zar: { at: 'zar' } as StoreState['zar'] }))).toBe(false);
    expect(racketStarts(shop({ day, crisis: { kind: 'heat', from: day, days: 3 } }))).toBe(false);
    expect(racketStarts(shop({ day, bankrupt: true }))).toBe(false);
    expect(racketStarts(shop({ day, racket: { from: 40, end: 'quit' } }))).toBe(false);
  });

  it('утром пришли — ждут ответа; новость «main» в очереди утра', () => {
    const day = startDays(shop(), RACKET_FROM, 400)[0];
    const s = racketMorning(shop({ day }));
    expect(s.racket).toEqual({ from: day });
    expect(racketAsk(s)).toBe(true);
    expect(pickNews(s, ['tale', 'racketAsk', 'pawn']).id).toBe('racketAsk');
    // Не ответили — ничего не берут и не пакостят, ждут.
    const later = racketMorning({ ...s, day: day + 1 });
    expect(later.money).toBe(s.money);
    expect(racketAsk(later)).toBe(true);
  });
});

describe('платить', () => {
  it('доля — процент выручки недели, не меньше минимума и не больше кассы; первая — сразу', () => {
    expect(racketShare(shop())).toBe(Math.round((WEEK.reduce((a, b) => a + b) * RACKET_RATE) / 100));
    expect(racketShare(shop({ history: [] }))).toBe(RACKET_MIN);
    const s = chooseRacket(visited(), 'pay')!;
    const share = racketShare(shop());
    expect(s.money).toBe(5000 - share);
    expect(s.racket).toMatchObject({ mode: 'pay', since: 50, rate: RACKET_RATE, paid: share });
    expect(racketHit(s)).toEqual({ day: 50, kind: 'pay', cost: share });
    expect(chooseRacket(visited({ money: 100 }), 'pay')!.money).toBe(0);
    // Второй ответ на тот же визит — нельзя.
    expect(chooseRacket(s, 'refuse')).toBeNull();
  });

  it('дальше — раз в неделю от дня решения; в остальные дни спокойно', () => {
    let s = chooseRacket(visited(), 'pay')!;
    const money: number[] = [];
    for (let i = 1; i <= 14; i++) {
      s = next(s);
      money.push(s.money);
    }
    const paid = money.map((m, i) => (i ? money[i - 1] - m : 0));
    // Дни 57 и 64 — через неделю и две после решения (50-й).
    expect(paid.map((p, i) => (p > 0 ? 51 + i : 0)).filter(Boolean)).toEqual([57, 64]);
    expect(s.racket?.paid).toBe(racketShare(shop()) * 3);
    expect(racketHit(s)?.kind).toBe('pay');
    // Пакостей нет.
    expect(s.racket?.until).toBeUndefined();
  });

  it('эхо «поднимаем ставку» через недели: платить больше, хватит или в полицию', () => {
    const s = chooseRacket(visited(), 'pay')!;
    const echo = echoesOf(s).list.find((e) => e.id === 'racketRaise')!;
    expect(echo.due).toBeGreaterThanOrEqual(64);
    expect(echo.data).toEqual({ n: RACKET_RATE + RACKET_RAISE });
    const due = { ...s, day: echo.due };
    expect(echoNews(due)?.id).toBe('racketRaise');
    const more = answerRaise(due, 'racketRaise', 0)!;
    expect(more.racket?.rate).toBe(RACKET_RATE + RACKET_RAISE);
    expect(echoesOf(more).list.filter((e) => e.id === 'racketRaise')).toHaveLength(1);
    const stop = answerRaise(due, 'racketRaise', 1)!;
    expect(stop.racket).toMatchObject({ mode: 'refuse', since: echo.due, until: echo.due + TROUBLE_DAYS });
    expect(stop.racket?.rate).toBeUndefined();
    const cops = answerRaise(due, 'racketRaise', 2)!;
    expect(cops.racket?.mode).toBe('police');
    expect(openCaseOf(cops)).toMatchObject({ id: 'racket', origin: 'racket' });
  });

  it('ставка не растёт выше потолка, и тогда новых поднятий нет', () => {
    const top: RacketState = { from: 40, mode: 'pay', since: 40, rate: RACKET_RATE_MAX - 1 };
    const s = shop({ racket: top, echoes: { list: [{ id: 'racketRaise', due: 50, data: { n: RACKET_RATE_MAX } }] } });
    const out = answerRaise(s, 'racketRaise', 0)!;
    expect(out.racket?.rate).toBe(RACKET_RATE_MAX);
    expect(echoesOf(out).list).toEqual([]);
  });
});

describe('отказать', () => {
  it('наутро — разбитая витрина; пакости — только TROUBLE_DAYS, деньги уходят на ремонт', () => {
    let s = chooseRacket(visited(), 'refuse')!;
    expect(s.money).toBe(5000);
    expect(s.racket).toMatchObject({ mode: 'refuse', since: 50, until: 50 + TROUBLE_DAYS });
    s = next(s);
    expect(racketHit(s)).toEqual({ day: 51, kind: 'glass', cost: troubleCost('glass', 2) });
    expect(s.money).toBe(5000 - troubleCost('glass', 2));
    const hits: string[] = ['glass'];
    let spent = troubleCost('glass', 2);
    for (let i = 0; i < TROUBLE_DAYS - 1; i++) {
      const before = s.money;
      s = next(s);
      const hit = racketHit(s);
      if (hit) hits.push(hit.kind);
      expect(before - s.money).toBe(hit?.cost ?? 0);
      spent += hit?.cost ?? 0;
    }
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.length).toBeLessThanOrEqual(TROUBLE_DAYS);
    expect(spent).toBeLessThan(1500);
    // Две недели прошли — отстали: новость, больше ничего.
    s = next(next(s));
    expect(s.racket?.end).toBe('quit');
    expect(racketNews(s)?.kind).toBe('quit');
    expect(racketNews(seeRacketNews(s))).toBeNull();
    const quiet = days(s, 30);
    expect(quiet.money).toBe(s.money);
    expect(racketStarts({ ...quiet, racket: quiet.racket })).toBe(false);
  });

  it('тот же день — та же пакость (перезапуск ничего не перекатывает)', () => {
    const s = days(chooseRacket(visited(), 'refuse')!, 6);
    const again = days(chooseRacket(visited(), 'refuse')!, 6);
    expect(again).toEqual(s);
  });

  it('мусор у входа — гостей меньше в тот день; в Заречье пакостей нет', () => {
    const r: RacketState = { from: 40, mode: 'refuse', since: 40, until: 60, hit: { day: 50, kind: 'trash', cost: 0 } };
    const trash = shop({ racket: r });
    expect(racketGuests(trash)).toBe(TRASH_GUESTS);
    expect(guestFactor(trash) / guestFactor(shop({ racket: { ...r, hit: undefined } }))).toBeCloseTo(TRASH_GUESTS, 5);
    expect(racketGuests({ ...trash, day: 51 })).toBe(1);
    let zar = shop({ racket: { from: 40, mode: 'refuse', since: 40, until: 70 }, zar: { at: 'zar' } as StoreState['zar'] });
    for (let i = 0; i < 10; i++) zar = racketMorning({ ...zar, day: zar.day + 1 });
    expect(zar.money).toBe(5000);
  });
});

describe('в полицию', () => {
  it('открывается дело о рэкете; назвали Бориса — банды нет навсегда, доброе имя и спасибо соседей', () => {
    let s = chooseRacket(visited(), 'police')!;
    const open = openCaseOf(s)!;
    expect(open).toMatchObject({ id: 'racket', origin: 'racket', from: 50 });
    expect(s.money).toBe(5000);
    while (s.day < open.due) s = next(s);
    // Пока идёт дело — ни доли, ни пакостей.
    expect(s.money).toBe(5000);
    const charged = accuse(s, CASES.racket.culprit)!;
    expect(charged.tone).toBe('good');
    s = next(charged.state);
    expect(s.racket?.end).toBe('jailed');
    expect(goodwillOf(s)).toBe(JAILED_GOODWILL);
    expect(racketNews(s)?.kind).toBe('jailed');
    expect(echoesOf(s).list.some((e) => e.id === 'racketThanks')).toBe(true);
    const later = days(s, 40);
    expect(later.racket?.end).toBe('jailed');
    expect(later.money).toBeGreaterThanOrEqual(s.money);
  });

  it('не того назвали или дело ушло в архив — ребята на свободе: пакости, как при отказе', () => {
    let s = chooseRacket(visited(), 'police')!;
    const due = openCaseOf(s)!.due;
    while (s.day < due) s = next(s);
    const wrong = next(accuse(s, 'eduard')!.state);
    expect(wrong.racket).toMatchObject({ mode: 'refuse', since: due + 1, until: due + 1 + TROUBLE_DAYS });
    expect(racketNews(wrong)?.kind).toBe('free');
    expect(racketHit(next(wrong))?.kind).toBe('glass');
    // Не обвинили вовсе: в субботу дело в архиве — то же самое.
    const archived = next(s);
    expect(archived.racket?.mode).toBe('refuse');
    expect(goodwillOf(archived)).toBe(0);
  });

  it('идёт другое дело — заявление ждёт: дело о рэкете открывается, как только то закроют', () => {
    const busy = openCase(visited(), 'dog', 'week')!;
    let s = chooseRacket(busy, 'police')!;
    expect(openCaseOf(s)?.id).toBe('dog');
    expect(s.racket?.mode).toBe('police');
    for (let i = 0; i < 12 && openCaseOf(s)?.id !== 'racket'; i++) s = next(s);
    expect(openCaseOf(s)).toMatchObject({ id: 'racket', origin: 'racket' });
    expect(s.money).toBe(5000);
  });

  it('краденое из ломбарда — улика о той же банде (и давнее тоже)', () => {
    const seized = [
      { item: 'watch' as const, lent: 100, took: 20, day: 30 },
      { item: 'ring' as const, lent: 100, took: 40, day: 45 },
    ];
    const s = chooseRacket(visited({ pawn: { seized } as StoreState['pawn'] }), 'police')!;
    const clues = extraClues(s);
    expect(clues.map((c) => c.key)).toEqual(['case.racket.pawn', 'case.racket.pawn']);
    expect(clues[1].vars).toEqual({ item: 'pawn.item.ring' });
    // В обычном деле давнее краденое не в счёт.
    const dog = openCase(shop({ pawn: { seized } as StoreState['pawn'] }), 'dog', 'week')!;
    expect(extraClues(dog)).toEqual([]);
  });
});

describe('тексты, подсказка, сохранения, симулятор', () => {
  it('подсказка «Новое!» — сразу после ответа, своя иконка', () => {
    const all = Object.keys(TIP_ICONS) as TipId[];
    const seen = all.filter((id) => id !== 'racket');
    expect(pendingTip(visited({ seenTips: seen }))).toBeNull();
    expect(pendingTip(chooseRacket(visited({ seenTips: seen }), 'refuse')!)).toBe('racket');
    expect(new Set(Object.values(TIP_ICONS)).size).toBe(all.length);
    expect(ru['tip.racket.title'] && ru['tip.racket.text']).toBeTruthy();
  });

  it('у ответов, пакостей и новостей есть тексты', () => {
    const keys = ['racket.title', 'racket.text', 'racket.who', 'racket.news.title', 'racket.ok', 'racket.van', 'racket.collect', 'racket.trash'];
    for (const m of ['pay', 'refuse', 'police']) keys.push(`racket.mode.${m}`, `racket.mode.${m}.hint`, `racket.line.${m}`);
    for (const h of ['pay', 'glass', 'tires', 'trash']) keys.push(`racket.hit.${h}`);
    for (const n of ['jailed', 'free', 'quit']) keys.push(`racket.news.${n}`);
    for (const k of keys) expect(ru[k as TextKey], k).toBeTruthy();
  });

  it('старое сохранение без «крыши»: до середины игры ничего не меняется (тот же объект)', () => {
    const old = shop({ day: 20 });
    delete (old as Partial<StoreState>).racket;
    expect(racketMorning(old)).toBe(old);
    expect(racketAsk(old)).toBe(false);
    expect(racketGuests(old)).toBe(1);
    expect(racketHit(old)).toBeNull();
    // Через сохранение (JSON) — то же.
    const loaded = JSON.parse(JSON.stringify(chooseRacket(visited(), 'refuse'))) as StoreState;
    expect(next(loaded).racket?.hit?.kind).toBe('glass');
  });

  it('симулятор: ребята приходят в середине игры, любой ответ не ломает баланс', () => {
    const runs = (racket: 'pay' | 'refuse' | 'police') => simulate({ days: 90, seed: 3, racket });
    const refuse = runs('refuse');
    const r = refuse.final.racket;
    expect(r?.from).toBeGreaterThanOrEqual(RACKET_FROM);
    expect(r?.mode).toBe('refuse');
    const base = refuse.days.at(-1)!.money;
    for (const mode of ['pay', 'police'] as const) {
      const other = runs(mode);
      expect(other.final.racket?.mode ?? 'refuse').toBeTruthy();
      expect(Math.abs(other.days.at(-1)!.money - base) / Math.max(1, base)).toBeLessThan(0.25);
    }
  });
});
