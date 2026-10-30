import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, warehouseCapacity, warehouseCount, type StoreState } from '../src/game/economy';
import { MORNING_TABS, openTabs, startCohort, tabOpen } from '../src/game/onboarding';
import {
  migrateTut,
  REPLAY_STEPS,
  seeWeek,
  TUT_STEPS,
  tutAt,
  tutDayEnd,
  tutIndex,
  tutMorning,
  tutNext,
  tutPass,
  tutPatient,
  tutReplay,
  tutSkip,
  tutStep,
  tutTell,
  WEEK_DAYS,
  WEEK_GIFT,
  weekNote,
} from '../src/game/tutorial';
import { restartGame } from '../src/game/restart';

const fresh = (): StoreState => startCohort(newGame(), 'play');
const day = (s: StoreState, n: number): StoreState => openTabs({ ...s, day: n }).state;

describe('бабушкино обучение: шаги первых дней', () => {
  it('каждый новичок начинает с первого шага; прежнее начало и старые сохранения — без обучения', () => {
    expect(tutStep(fresh())).toBe('serve');
    expect(tutIndex(fresh())).toBe(1);
    expect(tutStep(startCohort(newGame(), 'tour'))).toBeNull();
    expect(tutStep({ ...newGame(), tourDone: true })).toBeNull();
    expect(tutStep(restartGame(fresh()))).toBeNull();
  });

  it('шаг идёт дальше, только когда сделали именно его дело', () => {
    let s = fresh();
    expect(tutPass(s, 'restock')).toBe(s);
    s = tutPass(s, 'serve');
    expect(tutStep(s)).toBe('restock');
    s = tutPass(s, 'restock');
    expect(tutStep(s)).toBe('summary');
    expect(tutAt(s, 'hall')).toBeNull();
    expect(tutAt(s, 'summary')).toBe('summary');
  });

  it('весь путь новичка: касса → полка → итог → закупка → открыть → «Зал» на 3-й день', () => {
    let s = fresh();
    expect(tutAt(s, 'hall')).toBe('serve');
    s = tutPass(tutPass(s, 'serve'), 'restock');
    s = tutPass(s, 'summary');
    s = day(s, 2);
    expect(tutAt(s, 'morning')).toBe('reorder');
    s = tutPass(tutPass(s, 'reorder'), 'open');
    // Во втором утре «Зала» ещё нет — шаг ждёт третьего.
    expect(tutStep(s)).toBe('hall');
    expect(tutAt(s, 'morning')).toBeNull();
    s = day(s, 3);
    expect(tabOpen(s, 'hall')).toBe(true);
    expect(tutAt(s, 'morning')).toBe('hall');
    s = tutPass(s, 'hall');
    expect(tutStep(s)).toBeNull();
    expect(s.tut).toEqual({ step: 'done' });
  });

  it('в первый день не было продажи и пустой полки — шаги зала закрываются вместе с днём', () => {
    const s = tutDayEnd(fresh());
    expect(tutStep(s)).toBe('summary');
    // Игру закрыли на итогах — утром шаг о них пропускается.
    expect(tutStep(tutMorning(s))).toBe('reorder');
    // Шаги утра день не трогает.
    const morning = tutMorning(s);
    expect(tutDayEnd(morning)).toBe(morning);
  });

  it('полка не опустела в первый день — шаг о ней переносится на второй, после «Открыть магазин»', () => {
    // Продажа была, а полки так и не пустели. К итогам номер дня уже следующий — это не мешает.
    expect(tutDayEnd({ ...tutPass(fresh(), 'serve'), day: 2 }).tut).toMatchObject({ step: 'summary', late: true });
    let s = tutDayEnd(tutPass(fresh(), 'serve'));
    expect(s.tut).toMatchObject({ step: 'summary', late: true });
    s = day(tutPass(s, 'summary'), 2);
    s = tutPass(tutPass(s, 'reorder'), 'open');
    expect(tutAt(s, 'hall')).toBe('restock');
    s = tutPass(s, 'restock');
    expect(s.tut).toEqual({ step: 'hall' });
    // И на второй день не дошло — вечером закрывается, дальше «Зал».
    let t = tutPass(tutPass(day(tutPass(tutDayEnd(fresh()), 'summary'), 2), 'reorder'), 'open');
    expect(tutStep(t)).toBe('restock');
    t = tutDayEnd(t);
    expect(t.tut).toEqual({ step: 'hall' });
  });

  it('первый день терпелив к кассе и полке; повтор из профиля — нет', () => {
    expect(tutPatient(fresh(), 'serve')).toBe(true);
    expect(tutPatient(fresh(), 'restock')).toBe(true);
    expect(tutPatient(day(fresh(), 2), 'serve')).toBe(false);
    expect(tutPatient(day(fresh(), 2), 'restock')).toBe(true);
    expect(tutPatient(day(fresh(), 3), 'restock')).toBe(false);
    expect(tutPatient(tutReplay({ ...newGame(), day: 1 }), 'serve')).toBe(false);
  });

  it('шаг уходит в аналитику один раз, и после перезапуска тоже', () => {
    const told = tutTell(fresh())!;
    expect(told.tut?.told).toBe('serve');
    expect(tutTell(told)).toBeNull();
    expect(tutTell(tutPass(told, 'serve'))?.tut?.told).toBe('restock');
    expect(tutTell(tutSkip(fresh()))).toBeNull();
  });

  it('«Пропустить обучение» — конец шагов и все вкладки утра открыты', () => {
    const s = tutSkip(fresh());
    expect(tutStep(s)).toBeNull();
    expect(s.tut).toMatchObject({ step: 'done', skipped: true });
    expect(MORNING_TABS.every((tab) => s.onb?.tabs?.[tab] === true)).toBe(true);
    expect(tutSkip(s)).toBe(s);
  });

  it('повтор из профиля: с утренней закупки, свой порядок, и у старых сохранений тоже', () => {
    const old = { ...newGame(), day: 30, tourDone: true };
    let s = tutReplay(old);
    expect(tutAt(s, 'morning')).toBe('reorder');
    for (const step of REPLAY_STEPS) {
      expect(tutStep(s)).toBe(step);
      s = tutNext(s);
    }
    expect(tutStep(s)).toBeNull();
    // Шаги зала в повторе тоже закрываются вечером, а «Зал» у старого игрока открыт сразу.
    s = tutDayEnd(tutPass(tutPass(tutReplay(old), 'reorder'), 'open'));
    expect(tutAt(s, 'morning')).toBe('hall');
  });

  it('сохранение без поля: новичок посреди первых дней получает обучение с нужного шага', () => {
    const play = fresh();
    const { tut: _, ...noTut } = play;
    expect(tutStep(migrateTut(noTut))).toBe('serve');
    expect(tutStep(migrateTut({ ...noTut, onb: { done: ['sale'] } }))).toBe('restock');
    expect(tutStep(migrateTut({ ...noTut, day: 2 }))).toBe('reorder');
    expect(migrateTut({ ...noTut, day: 5 }).tut).toBeUndefined();
    const old = { ...newGame(), day: 1 };
    expect(migrateTut(old)).toBe(old);
    // Шаг, которого нет в списке (будущая версия, испорченный файл), — обучение окончено.
    expect(migrateTut({ ...play, tut: { step: 'oops' as never } }).tut).toEqual({ step: 'done' });
    expect(migrateTut(play)).toBe(play);
    expect(TUT_STEPS).toContain(play.tut?.step);
  });
});

describe('первая неделя: что ни день — что-то новое', () => {
  it('с 3-го по 7-й день — по новости, каждая один раз; у старых сохранений — ничего', () => {
    let s = fresh();
    expect(weekNote(s)).toBeNull();
    expect(weekNote(day(s, 2))).toBeNull();
    const keys: string[] = [];
    for (const d of WEEK_DAYS) {
      s = day(s, d);
      const note = weekNote(s);
      expect(note?.day).toBe(d);
      keys.push(note!.key);
      s = seeWeek(s, note!);
      expect(weekNote(s)).toBeNull();
    }
    expect(keys).toEqual([expect.stringMatching(/^tut\.week\.(product|price)$/), 'tut.week.event', 'tut.week.staff', 'tut.week.grow', 'tut.week.gift']);
    expect(weekNote(day(s, 8))).toBeNull();
    expect(weekNote({ ...newGame(), day: 4 })).toBeNull();
  });

  it('3-й день — товар, которого в магазине ещё нет; 6-й — цена первого помещения', () => {
    const third = weekNote(day(fresh(), 3));
    if (third?.product) expect(warehouseCount(day(fresh(), 3))).toBeGreaterThan(0);
    const sixth = weekNote(day(fresh(), 6));
    expect(sixth?.cost).toBeGreaterThan(0);
  });

  it('7-й день — гостинец с дачи на склад, бесплатно; новость не стирает открытые вкладки', () => {
    const s = { ...day(fresh(), 7), warehouse: {} };
    const note = weekNote(s)!;
    const after = seeWeek(s, note);
    const extra = Object.values(WEEK_GIFT).reduce((a, b) => a + (b ?? 0), 0);
    expect(warehouseCount(after)).toBe(warehouseCount(s) + extra);
    expect(after.money).toBe(s.money);
    expect(after.onb?.tabs).toEqual(s.onb?.tabs);
    expect(after.onb?.week).toBe(7);
    // Склад полон — сколько влезет, не больше.
    const full = day(fresh(), 7);
    expect(warehouseCount(seeWeek(full, weekNote(full)!))).toBeLessThanOrEqual(Math.max(warehouseCapacity(full), warehouseCount(full)));
    // А открытие вкладок не стирает отметку недели.
    expect(openTabs({ ...after, day: 8 }).state.onb?.week).toBe(7);
  });
});

// Сохранение: шаг обучения переживает перезапуск; старое сохранение без поля грузится как раньше.
let local: Record<string, string> = {};
beforeEach(() => {
  vi.resetModules();
  local = {};
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => local[k] ?? null,
      setItem: (k: string, v: string) => {
        local[k] = v;
      },
      removeItem: (k: string) => delete local[k],
    },
  });
});
afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

describe('обучение в сохранении', () => {
  it('шаг посреди обучения — тот же после перезапуска; старое сохранение — без обучения', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const mid = tutPass(tutPass(fresh(), 'serve'), 'restock');
    saveGame(mid);
    expect(tutStep(loadGame()!)).toBe('summary');
    local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...newGame(), day: 12, tourDone: true } });
    const old = loadGame()!;
    expect(old.tut).toBeUndefined();
    expect(old.day).toBe(12);
  });
});
