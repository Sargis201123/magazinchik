// Все задания игрока одним списком: задания дня (endless.ts), шаг сезонной недели (weeks.ts) и испытания
// недели (weekly.ts). До 10.11 это были три разных места на экране — и три дорожки в голове у игрока.
// Правила и награды у каждой прежние; здесь — только общий счёт для одного списка (ui/today.ts).

import type { DayStats, StoreState } from './economy';
import { questDone, questGoal, questProgress, type Quest } from './endless';
import { progressWeekly, type Challenge } from './weekly';
import { goalProgress, stepReward, type WeekGoalToday } from './weeks';

interface TaskBase {
  progress: number;
  goal: number;
  reward: number;
  done: boolean;
}

/** quest — задание дня; step — шаг сезонной недели (тоже на сегодня); weekly — испытание недели (копится днями). */
export type Task = (TaskBase & { kind: 'quest'; quest: Quest }) | (TaskBase & { kind: 'step'; step: WeekGoalToday }) | (TaskBase & { kind: 'weekly'; challenge: Challenge });

/** Шаг сезонной недели на сегодня: null — не неделя, шаг уже сделан или план не сегодняшний. */
export function stepTask(state: StoreState, stats: DayStats): Task | null {
  const step = state.plan?.day === state.day ? state.plan.week : null;
  if (!step) return null;
  const progress = Math.min(step.target, goalProgress(step, stats));
  return { kind: 'step', step, progress, goal: step.target, reward: stepReward(state.level, step.step), done: progress >= step.target };
}

/** Испытания недели с прогрессом вместе с сегодняшним днём (в сохранение он запишется вечером — progressWeekly). */
export function weeklyTasks(state: StoreState, stats: DayStats): Task[] {
  if (!state.weekly) return [];
  const live = (progressWeekly(state, stats).state.weekly?.challenges ?? []) as Challenge[];
  return live.map((challenge) => ({ kind: 'weekly', challenge, progress: challenge.progress, goal: challenge.target, reward: challenge.reward, done: Boolean(challenge.done) }));
}

/** Весь список: сначала то, что на сегодня (задания дня и шаг сезонной недели), ниже — испытания недели. */
export function allTasks(state: StoreState, quests: Quest[], stats: DayStats): Task[] {
  const today: Task[] = quests.map((quest) => {
    const goal = questGoal(quest);
    const done = Boolean(quest.paid) || questDone(quest, stats);
    return { kind: 'quest', quest, progress: done ? goal : Math.min(goal, questProgress(quest, stats)), goal, reward: quest.reward, done };
  });
  const step = stepTask(state, stats);
  return [...today, ...(step ? [step] : []), ...weeklyTasks(state, stats)];
}

/** Счёт фишки «🎯 1/3» — только сегодняшнее: испытания недели в него не идут. */
export function todayCount(tasks: Task[]): { done: number; total: number } {
  const today = tasks.filter((task) => task.kind !== 'weekly');
  return { done: today.filter((task) => task.done).length, total: today.length };
}
