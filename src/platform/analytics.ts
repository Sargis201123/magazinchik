// Аналитика и рейтинг (api/_lib/stats.ts): игра шлёт прогресс магазина и короткие события —
// на каком дне бросают, кто прошёл обучение, кто начал заново. Только в Telegram и только
// когда у сервера есть база; иначе события просто копятся (не больше MAX_QUEUE) и не мешают.

import type { StoreState } from '../game/economy';
import { lifetimeRevenue } from '../game/legacy';
import { shopSnapshot } from '../game/friendShop';
import { telegramInitData } from './telegram';
import { post } from './social';

export interface GameEvent {
  kind: string;
  day: number;
  value?: number;
}

const KEY = 'magazinchik.events';
const MAX_QUEUE = 40;

function load(): GameEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as GameEvent[];
  } catch {
    return [];
  }
}

function store(queue: GameEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Нет хранилища — событие потеряется, это не страшно.
  }
}

/** Запомнить событие; уйдёт на сервер вместе со следующим прогрессом. */
export function track(kind: string, day: number, value?: number): void {
  store([...load(), { kind, day, ...(value !== undefined ? { value: Math.round(value) } : {}) }]);
}

/** Отправить прогресс магазина и накопленные события (после дня и при запуске). */
export async function reportProgress(state: StoreState): Promise<void> {
  const initData = telegramInitData();
  if (!initData) return;
  const events = load().slice(0, 20);
  const res = await post<{ ok?: boolean }>('/api/progress', {
    initData,
    day: state.day,
    level: state.level,
    rating: state.rating,
    revenue: lifetimeRevenue(state),
    money: state.money,
    chapter: state.story.chapter,
    // Как выглядит магазин — для друзей, которые зайдут в гости.
    shop: shopSnapshot(state),
    events,
  });
  if (res?.ok) store(load().slice(events.length));
}

export interface BoardRow {
  name: string;
  day: number;
  level: number;
  rating: number;
  revenue: number;
  me?: boolean;
}

export interface Board {
  top: BoardRow[];
  friends: BoardRow[];
  rank: number | null;
  total: number;
}

/** Рейтинг магазинов: лучшие в Telegram и свои (друзья по приглашениям). null — недоступно. */
export async function fetchLeaderboard(): Promise<Board | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<Board & { enabled?: boolean }>('/api/leaderboard', { initData });
  return res?.enabled ? res : null;
}
