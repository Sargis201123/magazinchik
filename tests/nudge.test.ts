import { describe, expect, it } from 'vitest';
import { newGame, START_DEBT, STORE_LEVELS, type StoreState } from '../src/game/economy';
import {
  canNudge,
  freshMemo,
  hallNudge,
  mainGoal,
  morningNudge,
  NUDGE_GAP_MS,
  NUDGE_IDLE_MS,
  NUDGE_LAST_DAY,
  NUDGE_PER_DAY,
  noteNudge,
  tomorrowTeaser,
  formatText,
} from '../src/game/nudge';

/** Русский переводчик без браузера (как t() в игре). */
const tr = (key: keyof typeof ru, params: Record<string, number | string>) => ru[key].replace(/\{(\w+)\}/g, (_, n: string) => String(params[n] ?? `{${n}}`));
import { isFairDay } from '../src/game/fair';
import { weatherFor } from '../src/game/weather';
import { badBatch, CLEAN_BATCH_DAYS } from '../src/game/suppliers';
import { CAT_FROM_DAY, catOffer } from '../src/game/cat';
import { DEAL_FROM_DAY, planDay } from '../src/game/events';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

const game = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), ...patch });
const story = (chapter: number, extra: Partial<StoreState['story']> = {}) => ({ chapter, introSeen: true, ordersDone: 0, inspectionsPassed: 0, ...extra });

describe('главная цель', () => {
  it('первая глава — долг: полоска растёт, когда долг гасится', () => {
    const start = mainGoal(game({ story: story(0) }))!;
    expect(start.id).toBe('debt');
    expect(start.progress).toBe(0);
    const half = mainGoal(game({ story: story(0), debt: START_DEBT / 2 }))!;
    expect(half.progress).toBeCloseTo(0.5);
    // Долг вырос сверх стартового (пени) — полоска не уходит в минус.
    expect(mainGoal(game({ story: story(0), debt: START_DEBT * 2 }))!.progress).toBe(0);
  });

  it('вторая глава — заказы и первый сотрудник; без сотрудника подсказка ведёт в «Персонал»', () => {
    const g = mainGoal(game({ story: story(1, { ordersDone: 1 }), debt: 0 }))!;
    expect(g.id).toBe('orders');
    expect(g.progress).toBeCloseTo(1 / 3);
    expect(g.next).toBe('goal.next.hire');
  });

  it('третья глава: сначала копим на минимаркет, потом рейтинг', () => {
    const s = game({ story: story(2), debt: 0, level: 1, money: STORE_LEVELS[2].cost / 4 });
    const g = mainGoal(s)!;
    expect(g.id).toBe('level');
    expect(g.progress).toBeCloseTo(0.25);
    expect(g.params.name).toBe(STORE_LEVELS[2].nameKey);
    expect(mainGoal({ ...s, level: 2, rating: 3 })!.id).toBe('rating');
  });

  it('копим на помещение с долгом — полоска пустая, подсказка «сначала долг»', () => {
    const g = mainGoal(game({ story: story(4), debt: 100, level: 3, money: 99999 }))!;
    expect(g.progress).toBe(0);
    expect(g.next).toBe('goal.next.debtFirst');
    expect(mainGoal(game({ story: story(4), debt: 0, level: 3, money: 99999 }))!.next).toBe('goal.next.levelReady');
  });

  it('после сюжета на последнем помещении — испытания недели', () => {
    const weekly = { month: 1, challenges: [{ kind: 'serve', target: 10, progress: 5, reward: 100 }, { kind: 'clean', target: 4, progress: 4, reward: 100, done: true }] };
    const g = mainGoal(game({ story: story(5), level: STORE_LEVELS.length - 1, weekly }))!;
    expect(g.id).toBe('weekly');
    expect(g.params).toEqual({ n: 1, total: 2 });
    expect(g.progress).toBeCloseTo(0.75);
    expect(mainGoal(game({ story: story(5), level: STORE_LEVELS.length - 1 }))).toBeNull();
  });
});

describe('подсказка «что дальше»', () => {
  it('утром: закупка важнее переезда, переезд — когда хватает денег и нет долга, иначе «открывай»', () => {
    const rich = game({ debt: 0, money: STORE_LEVELS[1].cost });
    expect(morningNudge(rich, { restock: true })).toBe('restock');
    expect(morningNudge(rich, { restock: false })).toBe('grow');
    expect(morningNudge({ ...rich, debt: 10 }, { restock: false })).toBe('open');
  });

  it('в зале: покупатель у кассы важнее пустой полки', () => {
    expect(hallNudge({ waiting: true, emptyShelf: true })).toBe('serve');
    expect(hallNudge({ waiting: false, emptyShelf: true })).toBe('shelf');
    expect(hallNudge({ waiting: false, emptyShelf: false })).toBeNull();
  });

  it('только когда игрок застыл, каждая раз в день, с перерывом и не больше лимита', () => {
    let memo = freshMemo();
    expect(canNudge(memo, 2, 'restock', 0, NUDGE_IDLE_MS - 1)).toBe(false);
    expect(canNudge(memo, 2, 'restock', 0, NUDGE_IDLE_MS)).toBe(true);
    memo = noteNudge(memo, 2, 'restock', 0);
    expect(canNudge(memo, 2, 'restock', NUDGE_GAP_MS * 10, NUDGE_IDLE_MS)).toBe(false);
    expect(canNudge(memo, 2, 'open', NUDGE_GAP_MS - 1, NUDGE_IDLE_MS)).toBe(false);
    expect(canNudge(memo, 2, 'open', NUDGE_GAP_MS, NUDGE_IDLE_MS)).toBe(true);
    for (const kind of ['open', 'serve'] as const) memo = noteNudge(memo, 2, kind, NUDGE_GAP_MS);
    expect(memo.shown.length).toBe(NUDGE_PER_DAY);
    expect(canNudge(memo, 2, 'shelf', NUDGE_GAP_MS * 10, NUDGE_IDLE_MS)).toBe(false);
    // Новый день — заново.
    expect(canNudge(memo, 3, 'restock', NUDGE_GAP_MS * 10, NUDGE_IDLE_MS)).toBe(true);
  });

  it('опытным не мешает: после двух недель — никогда', () => {
    expect(canNudge(freshMemo(), NUDGE_LAST_DAY, 'open', 0, NUDGE_IDLE_MS)).toBe(true);
    expect(canNudge(freshMemo(), NUDGE_LAST_DAY + 1, 'open', 0, NUDGE_IDLE_MS)).toBe(false);
  });
});

describe('«Завтра:» в итогах дня', () => {
  it('глава выполнена — обещаем награду', () => {
    expect(tomorrowTeaser(game({ day: 3, story: story(0), debt: 0 })).key).toBe('teaser.chapter');
  });

  it('цель почти взята — «рукой подать»', () => {
    const t = tomorrowTeaser(game({ day: 9, story: story(0), debt: Math.round(START_DEBT * 0.2) }));
    expect(t.key).toBe('teaser.goal');
    expect(t.params.goal).toBe('goal.debt');
  });

  it('почти накопили на помещение — в строке название помещения, а не ключ', () => {
    const s = game({ day: 9, story: story(4), debt: 0, level: 1, money: Math.round(STORE_LEVELS[2].cost * 0.9) });
    const { key, params } = tomorrowTeaser(s);
    const text = formatText(key, params, tr);
    expect(text).toContain(ru['store.l3']);
    expect(text).not.toMatch(/store\.|goal\.|\{/);
  });

  it('хватает на переезд — зовём переезжать', () => {
    const t = tomorrowTeaser(game({ day: 9, story: story(4), debt: 0, level: 3, money: 99999 }));
    expect(t.key).toBe('teaser.levelReady');
  });

  it('ярмарка и погода: строка есть всегда', () => {
    const base = { story: story(4), debt: 0, level: 3, money: 0 };
    let fair = 8;
    while (!isFairDay(fair)) fair++;
    expect(tomorrowTeaser(game({ ...base, day: fair })).key).toBe('teaser.fair');
    for (let day = 20; day < 60; day++) {
      const t = tomorrowTeaser(game({ ...base, day }));
      expect(ru[t.key]).toBeTruthy();
      if (t.key === 'teaser.weather' || t.key === 'teaser.clear') expect(t.params.name).toBe(`weather.name.${weatherFor(day)}`);
    }
  });

  it('новичку нового начала после первого дня — обещание, потом — какая вкладка откроется завтра', () => {
    expect(tomorrowTeaser(game({ day: 2, story: story(0), onboarding: 'play', onb: { done: [], tabs: {} } }))).toEqual({ key: 'teaser.first', params: {} });
    const t = tomorrowTeaser(game({ day: 3, money: 0, story: story(0), onboarding: 'play', onb: { done: [], tabs: { buy: true } } }));
    expect(t).toEqual({ key: 'teaser.tab', params: { tab: 'tab.hall' } });
  });
});

describe('меньше решений в первые дни', () => {
  it('первые три дня брака нет, дальше — как раньше', () => {
    expect(badBatch('dairy', CLEAN_BATCH_DAYS, 0)).toBe(false);
    expect(badBatch('dairy', CLEAN_BATCH_DAYS + 1, 0)).toBe(true);
    expect(badBatch('dairy', CLEAN_BATCH_DAYS + 1, 0.99)).toBe(false);
  });

  it('кот просится не раньше седьмого утра', () => {
    expect(CAT_FROM_DAY).toBe(7);
    expect(catOffer(game({ day: 5, money: 9999 }))).toBe(false);
  });

  it('«выгодной партии» нет в первую неделю', () => {
    for (let day = 4; day < DEAL_FROM_DAY; day++) expect(planDay(game({ day, money: 9999 })).event?.kind).not.toBe('deal');
  });
});

describe('тексты', () => {
  it('у каждого нового ключа есть английский перевод', () => {
    const keys = Object.keys(ru).filter((k) => /^(goal|nudge|teaser)\./.test(k));
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect(en[k as keyof typeof en], k).toBeTruthy();
  });
});
