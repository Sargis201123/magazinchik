import { describe, expect, it } from 'vitest';
import { newGame, warehouseCount, warehouseCapacity, type StoreState } from '../src/game/economy';
import {
  firstWant,
  markOnb,
  MORNING_TABS,
  onbDone,
  openAllTabs,
  openTabs,
  pickCohort,
  PLAY_STOCK,
  playDayOne,
  seeTab,
  startCohort,
  tabNew,
  tabOpen,
  unlockTab,
} from '../src/game/onboarding';
import { restartGame } from '../src/game/restart';
import { dramaScene } from '../src/game/drama';

const day = (s: StoreState, n: number): StoreState => ({ ...s, day: n });

describe('первые минуты новичка: два начала (A/B)', () => {
  it('вариант — по номеру в Telegram, всегда один и тот же; без номера — случайно; доля настраивается', () => {
    expect(pickCohort(1042, Math.random)).toBe('play');
    expect(pickCohort(1042, Math.random)).toBe('play');
    expect(pickCohort(1077, Math.random, 0.5)).toBe('tour');
    // Сравнение закрыто: по умолчанию всем новое начало.
    expect(pickCohort(1077, Math.random)).toBe('play');
    const ids = Array.from({ length: 1000 }, (_, i) => 5_000_000 + i * 7);
    const play = ids.filter((id) => pickCohort(id, Math.random, 0.5) === 'play').length;
    expect(play).toBeGreaterThan(400);
    expect(play).toBeLessThan(600);
    expect(pickCohort(undefined, () => 0.1)).toBe('play');
    expect(pickCohort(undefined, () => 0.9, 0.5)).toBe('tour');
    expect(pickCohort(undefined, () => 0.9)).toBe('play');
    expect(pickCohort(1077, Math.random, 1)).toBe('play');
    expect(pickCohort(1042, Math.random, 0)).toBe('tour');
  });

  it('прежнее начало — как было: обход вкладок, без лишнего запаса; новое — запас на складе и без обхода', () => {
    const tour = startCohort(newGame(), 'tour');
    expect(tour).toMatchObject({ onboarding: 'tour', tourDone: false, onb: { done: [] } });
    expect(tour.warehouse).toEqual(newGame().warehouse);
    const play = startCohort(newGame(), 'play');
    expect(play).toMatchObject({ onboarding: 'play', tourDone: true });
    const extra = Object.values(PLAY_STOCK).reduce((a, b) => a + (b ?? 0), 0);
    expect(warehouseCount(play)).toBe(warehouseCount(newGame()) + extra);
    expect(warehouseCount(play)).toBeLessThanOrEqual(warehouseCapacity(play));
    // Запас — подарок бабушки, а не покупка.
    expect(play.money).toBe(newGame().money);
  });

  it('старые сохранения и «Начать заново» — без варианта: шаги не отмечаются, все вкладки видны', () => {
    const old = { ...newGame(), tourDone: true };
    expect(markOnb(old, 'sale')).toBe(old);
    expect(MORNING_TABS.every((tab) => tabOpen(old, tab))).toBe(true);
    expect(openTabs(old).state).toBe(old);
    const again = restartGame(startCohort(newGame(), 'play'));
    expect(again.onboarding).toBeUndefined();
    expect(playDayOne(again)).toBe(false);
  });

  it('шаги отмечаются один раз', () => {
    let s = startCohort(newGame(), 'play');
    expect(onbDone(s, 'sale')).toBe(false);
    s = markOnb(s, 'sale');
    expect(onbDone(s, 'sale')).toBe(true);
    expect(markOnb(s, 'sale')).toBe(s);
    expect(s.onb?.done).toEqual(['sale']);
  });

  it('новое начало: вкладки утра открываются по одной в день, каждая сначала «новая»', () => {
    let s = startCohort(newGame(), 'play');
    expect(playDayOne(s)).toBe(true);
    expect(MORNING_TABS.some((tab) => tabOpen(s, tab))).toBe(false);
    const seen: string[][] = [];
    for (let n = 2; n <= 6; n++) {
      const r = openTabs(day(s, n));
      seen.push(r.opened);
      s = r.state;
      for (const tab of r.opened) {
        expect(tabNew(s, tab)).toBe(true);
        s = seeTab(s, tab);
        expect(tabNew(s, tab)).toBe(false);
        expect(tabOpen(s, tab)).toBe(true);
      }
    }
    expect(seen).toEqual([['buy'], ['hall'], ['staff'], ['grow'], ['extras']]);
    // Открытая вкладка не прячется, даже если повод пропал.
    expect(openTabs(s).opened).toEqual([]);
  });

  it('вкладка открывается раньше срока, когда она уже нужна', () => {
    const s = day(startCohort(newGame(), 'play'), 2);
    const chapter2 = { ...s, story: { ...s.story, chapter: 1 } };
    expect(openTabs(chapter2).opened).toEqual(['buy', 'staff', 'grow']);
    const grown = { ...s, level: 1 };
    expect(openTabs(grown).opened).toEqual(['buy', 'hall', 'staff', 'grow', 'extras']);
    // Кнопка ведёт в закрытую вкладку — она открывается сразу.
    expect(tabOpen(unlockTab(s, 'staff'), 'staff')).toBe(true);
    // Бабушкин обход из профиля — все вкладки знакомы.
    const all = openAllTabs(s);
    expect(MORNING_TABS.every((tab) => tabOpen(all, tab) && !tabNew(all, tab))).toBe(true);
  });

  it('в новом начале Соня ждёт до третьего дня: во втором утре уже есть вступление главы', () => {
    const play = { ...day(startCohort(newGame(), 'play'), 2), tourDone: true };
    expect(dramaScene(play, '2026-12-01')).toBeNull();
    expect(dramaScene(day(play, 3), '2026-12-01')?.day).toBe(2);
    const tour = { ...day(startCohort(newGame(), 'tour'), 2), tourDone: true };
    expect(dramaScene(tour, '2026-12-01')?.day).toBe(2);
  });

  it('первый покупатель идёт к полке, от которой ближе всего пройти от двери до кассы', () => {
    const s = newGame();
    const stands = [
      { x: 20, y: 48 },
      { x: 60, y: 48 },
      { x: 112, y: 138 },
    ];
    const pick = firstWant(s, (i) => stands[i], { x: 46, y: 168 }, { x: 90, y: 122 });
    expect(['apples', 'potatoes']).toContain(pick);
    // Пустые полки не в счёт.
    const empty = { ...s, shelves: s.shelves.map((sh) => ({ ...sh, items: {} })) };
    expect(firstWant(empty, (i) => stands[i], { x: 46, y: 168 }, { x: 90, y: 122 })).toBeNull();
  });
});
