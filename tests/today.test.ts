import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import type { Quest } from '../src/game/endless';
import { stepReward, weekFor, weekGoal, weekStart } from '../src/game/weeks';
import { weeklyFor } from '../src/game/weekly';
import { allTasks, stepTask, todayCount, weeklyTasks } from '../src/game/tasks';

const QUESTS: Quest[] = [
  { kind: 'serve', target: 10, reward: 40 },
  { kind: 'revenue', target: 500, reward: 40 },
];

describe('единый список заданий в зале: день, шаг сезонной недели и испытания недели', () => {
  it('обычный день без испытаний: в списке только задания дня', () => {
    const s: StoreState = { ...newGame(), day: 3 };
    const rows = allTasks(s, QUESTS, emptyDayStats());
    expect(rows).toHaveLength(QUESTS.length);
    expect(rows.every((r) => r.kind === 'quest')).toBe(true);
    expect(stepTask(s, emptyDayStats())).toBeNull();
    expect(weeklyTasks(s, emptyDayStats())).toEqual([]);
    expect(todayCount(rows)).toEqual({ done: 0, total: QUESTS.length });
  });

  it('испытания недели — отдельным разделом с заголовком, с прогрессом вместе с сегодняшним днём', () => {
    const base: StoreState = { ...newGame(), day: 8 };
    const s: StoreState = { ...base, weekly: weeklyFor(base, 20) };
    const stats = { ...emptyDayStats(), served: 7, revenue: 300 };
    const rows = weeklyTasks(s, stats);
    expect(rows).toHaveLength(s.weekly!.challenges.length);
    expect(rows.every((r) => r.kind === 'weekly')).toBe(true);
    // Сегодняшние покупатели уже в счёте, хотя запишутся в сохранение только вечером.
    const serve = s.weekly!.challenges.findIndex((c) => c.kind === 'serve');
    if (serve >= 0) expect(rows[serve].progress).toBe(Math.min(7, s.weekly!.challenges[serve].target));
    expect(s.weekly!.challenges.every((c) => c.progress === 0)).toBe(true);
    // В общем списке испытания идут после заданий дня.
    const all = allTasks(s, QUESTS, stats);
    expect(all.slice(0, QUESTS.length).every((r) => r.kind === 'quest')).toBe(true);
    expect(all.slice(QUESTS.length).every((r) => r.kind === 'weekly')).toBe(true);
    // Фишка «🎯» считает только сегодняшнее: испытания недели в её счёт не идут.
    expect(todayCount(all).total).toBe(QUESTS.length);
  });

  it('шаг сезонной недели — ещё одно задание на сегодня, с наградой шага', () => {
    const day = weekStart('harvest');
    expect(weekFor(day)?.id).toBe('harvest');
    const base: StoreState = { ...newGame(), day, level: 2 };
    const goal = weekGoal(base, 30)!;
    const s: StoreState = { ...base, plan: { day, decided: true, inspection: false, quests: QUESTS, week: goal } as StoreState['plan'] };
    const row = stepTask(s, emptyDayStats())!;
    expect(row.kind).toBe('step');
    expect(row.goal).toBe(goal.target);
    expect(row.reward).toBe(stepReward(2, goal.step));
    expect(row.done).toBe(false);
    // Стоит сразу после заданий дня и идёт в счёт фишки.
    const all = allTasks(s, QUESTS, emptyDayStats());
    expect(all[QUESTS.length]).toEqual(row);
    expect(todayCount(all)).toEqual({ done: 0, total: QUESTS.length + 1 });
    // План вчерашнего дня сегодняшним шагом не считается.
    expect(stepTask({ ...s, day: day + 1 }, emptyDayStats())).toBeNull();
  });
});
