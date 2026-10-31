import { afterEach, describe, expect, it, vi } from 'vitest';
import { newGame, SHELF_KINDS, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { markOnb, startCohort } from '../src/game/onboarding';
import {
  cleanHall,
  dreamGoal,
  dreamShelf,
  FIRST_GIFT,
  firstDayGift,
  firstDayRating,
  GRANNY_LATE_MS,
  GRANNY_SERVE_BUSY_MS,
  GRANNY_SERVE_MS,
  grannyServesAfter,
  grannyStays,
  grannyStocksNow,
  praiseAt,
  QUIET_DAYS,
  quietDays,
  warmKey,
} from '../src/game/firstday';
import { mainGoal } from '../src/game/nudge';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

const fresh = (patch: Partial<StoreState> = {}): StoreState => ({ ...startCohort(newGame(), 'play'), ...patch });
const old = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), tourDone: true, ...patch });

describe('начало игры: только новичку нового начала', () => {
  it('тихие дни, чистый зал и бабушка — у новичка; у старых сохранений и прежнего начала — нет', () => {
    expect(quietDays(fresh())).toBe(true);
    expect(quietDays(fresh({ day: QUIET_DAYS }))).toBe(true);
    expect(quietDays(fresh({ day: QUIET_DAYS + 1 }))).toBe(false);
    expect(cleanHall(fresh({ day: 7 }))).toBe(true);
    expect(cleanHall(fresh({ day: 8 }))).toBe(false);
    // Магазин уже подрос — пристройки и «Сдаётся» нужны.
    expect(cleanHall(fresh({ level: 1 }))).toBe(false);
    for (const s of [old(), startCohort(newGame(), 'tour')]) {
      expect(quietDays(s)).toBe(false);
      expect(cleanHall(s)).toBe(false);
      expect(grannyStays(s)).toBe(false);
      expect(dreamGoal(s)).toBeNull();
      expect(firstDayRating(s, 3, 2.6)).toBe(2.6);
    }
  });

  it('бабушка за прилавком весь первый день, если ещё не уехала (сохранение прежней версии)', () => {
    expect(grannyStays(fresh())).toBe(true);
    expect(grannyStays(fresh({ day: 2 }))).toBe(false);
    expect(grannyStays(markOnb(fresh(), 'bye'))).toBe(false);
  });

  it('полку в первый раз бабушка раскладывает сразу, потом — если новичок не нажал её сам', () => {
    const s = fresh();
    expect(grannyStocksNow(s, 0, false)).toBe(true);
    expect(grannyStocksNow(s, 0, true)).toBe(false);
    expect(grannyStocksNow(s, GRANNY_LATE_MS, true)).toBe(true);
    expect(grannyStocksNow(fresh({ day: 2 }), GRANNY_LATE_MS, false)).toBe(false);
  });

  it('пробивать за новичка бабушка начинает только после его первой продажи', () => {
    expect(grannyServesAfter(fresh(), false)).toBeNull();
    const sold = markOnb(fresh(), 'sale');
    expect(grannyServesAfter(sold, false)).toBe(GRANNY_SERVE_MS);
    expect(grannyServesAfter(sold, true)).toBe(GRANNY_SERVE_BUSY_MS);
    expect(GRANNY_SERVE_BUSY_MS).toBeLessThan(GRANNY_SERVE_MS);
  });

  it('хвалит на сериях и на счёте своих покупок', () => {
    expect(praiseAt(fresh(), 3, 0)).toBe(true);
    expect(praiseAt(fresh(), 2, 4)).toBe(true);
    expect(praiseAt(fresh(), 2, 5)).toBe(false);
    expect(praiseAt(fresh({ day: 2 }), 3, 4)).toBe(false);
  });

  it('рейтинг первого дня не падает, но растёт', () => {
    expect(firstDayRating(fresh(), 3, 2.7)).toBe(3);
    expect(firstDayRating(fresh(), 3, 3.2)).toBe(3.2);
    expect(firstDayRating(fresh({ day: 2 }), 3, 2.7)).toBe(2.7);
  });
});

describe('первая цель — мечта', () => {
  it('в первые дни — новая полка на свободное место, с полоской', () => {
    const s = fresh({ money: 150 });
    const kind = dreamShelf(s)!;
    expect(kind).toBe('dairy');
    const goal = mainGoal(s)!;
    expect(goal.id).toBe('dream');
    expect(goal.key).toBe('goal.dream.shelf');
    expect(goal.params).toMatchObject({ name: SHELF_KINDS[kind].nameKey, n: 150, cost: SHELF_KINDS[kind].price });
    expect(goal.progress).toBeCloseTo(150 / SHELF_KINDS[kind].price);
    expect(mainGoal(fresh({ money: 1000 }))!.next).toBe('goal.next.dreamReady');
  });

  it('места под полку нет — мечта о расширении; после тихих дней — снова глава (долг)', () => {
    const full = fresh();
    full.shelves = [...full.shelves, { kind: 'dairy', level: 0, items: {} }];
    const goal = mainGoal(full)!;
    expect(goal.key).toBe('goal.dream.level');
    expect(goal.params.cost).toBe(STORE_LEVELS[1].cost);
    expect(mainGoal(fresh({ day: QUIET_DAYS + 1 }))!.id).toBe('debt');
    expect(mainGoal(old())!.id).toBe('debt');
  });

  it('долг бабушки новичку — тёплой историей, остальным — как раньше', () => {
    expect(warmKey(fresh({ day: 2 }), 'story.ch1.intro2')).toBe('story.ch1.intro2warm');
    expect(warmKey(fresh({ day: 2 }), 'story.ch1.goal')).toBe('story.ch1.goalWarm');
    expect(warmKey(fresh({ day: 2 }), 'story.ch1.intro1')).toBe('story.ch1.intro1');
    expect(warmKey(old({ day: 2 }), 'story.ch1.intro2')).toBe('story.ch1.intro2');
  });
});

describe('подарок после первого дня', () => {
  it('ваза на прилавок — один раз, только новичку утром второго дня', () => {
    const s = fresh({ day: 2 });
    const gifted = firstDayGift(s)!;
    expect(gifted.decor.owned).toContain(FIRST_GIFT);
    expect(gifted.decor.active.counter).toBe(FIRST_GIFT);
    expect(firstDayGift(gifted)).toBeNull();
    expect(firstDayGift(fresh())).toBeNull();
    expect(firstDayGift(old({ day: 2 }))).toBeNull();
  });

  it('на прилавке уже что-то стоит — ваза только в оформление', () => {
    const s = fresh({ day: 2 });
    s.decor = { owned: ['counter_piggy'], active: { counter: 'counter_piggy' } };
    const gifted = firstDayGift(s)!;
    expect(gifted.decor.active.counter).toBe('counter_piggy');
    expect(gifted.decor.owned).toEqual(['counter_piggy', FIRST_GIFT]);
  });

  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);
  it('сохранение с подарком и новыми шагами загружается', async () => {
    vi.resetModules();
    const local: Record<string, string> = {};
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
    const { loadGame } = await import('../src/game/save');
    const s = markOnb(firstDayGift(fresh({ day: 2 }))!, 'stock');
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: s });
    const loaded = loadGame();
    expect(loaded?.onb?.done).toEqual(expect.arrayContaining(['gift', 'stock']));
    expect(loaded?.decor.active.counter).toBe(FIRST_GIFT);
  });
});

describe('тексты начала игры', () => {
  it('есть на обоих языках, без «продавца» в подсказках новичку', () => {
    const keys = Object.keys(ru).filter((k) => k.startsWith('first.') || k.startsWith('goal.dream') || k.startsWith('goal.next.dream') || k === 'teaser.first' || k.endsWith('Warm') || k.endsWith('warm'));
    expect(keys.length).toBeGreaterThan(15);
    for (const k of keys) expect(en[k as keyof typeof en]).toBeTruthy();
    for (const k of ['hint.restock', 'hint.bin', 'hint.clean', 'hint.recall', 'tut.restock'] as const) expect(ru[k]).not.toMatch(/продав/);
  });
});
