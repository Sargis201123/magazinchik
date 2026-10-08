// Испытания недели: три цели на игровой месяц (7 дней) — копятся по дням, за каждую награда.
// В отличие от заданий дня, их можно растянуть: плохой день не ломает всю неделю.

import { monthOf, MONTH_DAYS, sellableProducts, type DayStats, type ProductId, type StoreState } from './economy';
import { rng } from './random';
import { hasUpgrade } from './upgrades';
import type { TextKey } from '../i18n/ru';

export type ChallengeKind = 'serve' | 'revenue' | 'sell' | 'catch' | 'clean' | 'noQueue' | 'coffee' | 'delivery';

export interface Challenge {
  kind: ChallengeKind;
  target: number;
  product?: ProductId;
  progress: number;
  reward: number;
  done?: boolean;
}

export const WEEKLY_FROM_DAY = 4;
export const WEEKLY_TEXT: Record<ChallengeKind, TextKey> = {
  serve: 'weekly.serve',
  revenue: 'weekly.revenue',
  sell: 'weekly.sell',
  catch: 'weekly.catch',
  clean: 'weekly.clean',
  noQueue: 'weekly.noQueue',
  coffee: 'weekly.coffee',
  delivery: 'weekly.delivery',
};

export const weeklyReward = (level: number): number => 120 + 80 * level;

/** Три испытания на месяц: цели — от потока гостей, за пять удачных дней из семи. */
export function weeklyFor(state: StoreState, guests: number): NonNullable<StoreState['weekly']> {
  const month = monthOf(state.day);
  const random = rng(month * 48271 + 17);
  const reward = weeklyReward(state.level);
  const days = 5;
  const sellable = sellableProducts(state);
  const pool: Challenge[] = [
    { kind: 'serve', target: Math.max(30, Math.round(guests * 0.55 * days)), progress: 0, reward },
    { kind: 'revenue', target: Math.max(800, Math.round((guests * 22 * days) / 50) * 50), progress: 0, reward },
    { kind: 'catch', target: 2 + Math.floor(state.level / 2), progress: 0, reward },
    { kind: 'clean', target: (2 + state.level) * 4, progress: 0, reward },
    { kind: 'noQueue', target: 3, progress: 0, reward },
  ];
  if (sellable.length) {
    const product = sellable[Math.floor(random() * sellable.length)];
    pool.push({ kind: 'sell', product, target: Math.max(10, Math.round((guests * 0.9 * days) / sellable.length)), progress: 0, reward });
  }
  if (hasUpgrade(state, 'coffee')) pool.push({ kind: 'coffee', target: 12 + 3 * state.level, progress: 0, reward });
  if (hasUpgrade(state, 'delivery')) pool.push({ kind: 'delivery', target: 6 + 2 * state.level, progress: 0, reward });
  const challenges: Challenge[] = [];
  while (challenges.length < 3 && pool.length) challenges.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return { month, challenges };
}

/** Последний день месяца — до него можно успеть. */
export const weeklyUntil = (state: StoreState): number => monthOf(state.day) * MONTH_DAYS;

function gain(c: Challenge, stats: DayStats): number {
  switch (c.kind) {
    case 'serve':
      return stats.served;
    case 'revenue':
      return stats.revenue;
    case 'sell':
      return stats.sold[c.product!] ?? 0;
    case 'catch':
      return stats.caught;
    case 'clean':
      return stats.trashCleaned;
    case 'noQueue':
      return stats.served >= 10 && !(stats.lostWhy?.queue ?? 0) ? 1 : 0;
    case 'coffee':
      return stats.coffees ?? 0;
    case 'delivery':
      return stats.deliveries ?? 0;
  }
}

/** Вечер: прогресс за день; выполненные — награда сразу. */
export function progressWeekly(state: StoreState, stats: DayStats): { state: StoreState; completed: Challenge[]; earned: number } {
  const weekly = state.weekly;
  if (!weekly || weekly.month !== monthOf(state.day)) return { state, completed: [], earned: 0 };
  const completed: Challenge[] = [];
  const challenges = (weekly.challenges as Challenge[]).map((c) => {
    if (c.done) return c;
    const progress = Math.min(c.target, c.progress + gain(c, stats));
    const next = { ...c, progress, done: progress >= c.target };
    if (next.done) completed.push(next);
    return next;
  });
  const earned = completed.reduce((sum, c) => sum + c.reward, 0);
  return { state: { ...state, money: state.money + earned, weekly: { ...weekly, challenges } }, completed, earned };
}

/** Новый месяц — новые испытания. */
export function ensureWeekly(state: StoreState, guests: number): StoreState {
  if (state.day < WEEKLY_FROM_DAY || state.weekly?.month === monthOf(state.day)) return state;
  return { ...state, weekly: weeklyFor(state, guests) };
}
