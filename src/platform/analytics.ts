// Аналитика и рейтинг (api/_lib/stats.ts): игра шлёт прогресс магазина и короткие события —
// на каком дне бросают, кто прошёл обучение, кто начал заново. Только в Telegram и только
// когда у сервера есть база; иначе события просто копятся (не больше MAX_QUEUE) и не мешают.
// Обычно события уходят при запуске и в конце дня; шаги первых минут — сразу (flushSoon) и когда
// Telegram сворачивают: новичок, бросивший игру в первый же день, иначе не прислал бы ничего.

import type { StoreState } from '../game/economy';
import { lifetimeRevenue } from '../game/legacy';
import { shopSnapshot } from '../game/friendShop';
import { comebackHooks } from '../game/comeback';
import { telegramInitData } from './telegram';
import { tzOffset } from './live';
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

/** Отправка уже идёт — вторая не шлёт те же события ещё раз. */
let sending = false;
/** Когда отправляли в последний раз (мс): сервер пишет события не чаще раза в 3 с (MIN_REPORT_GAP). */
let lastSent = 0;

/** Отправить прогресс магазина и накопленные события (после дня и при запуске). */
export async function reportProgress(state: StoreState, keepalive = false): Promise<void> {
  const initData = telegramInitData();
  if (!initData) return;
  // Прошлая отправка ещё идёт: эти события уйдут следом, чуть погодя (сервер чаще раза в 3 с не пишет).
  if (sending) {
    flushSoon();
    return;
  }
  const events = load().slice(0, 20);
  sending = true;
  lastSent = Date.now();
  try {
    const res = await post<{ ok?: boolean }>(
      '/api/progress',
      {
        initData,
        day: state.day,
        level: state.level,
        rating: state.rating,
        revenue: lifetimeRevenue(state),
        money: state.money,
        chapter: state.story.chapter,
        // Как выглядит магазин — для друзей, которые зайдут в гости.
        shop: shopSnapshot(state),
        // Часовой пояс и поводы для напоминания бота от лица героев (game/comeback.ts, api/_lib/remind.ts).
        tz: tzOffset(),
        hooks: comebackHooks(state),
        events,
      },
      keepalive,
    );
    if (res?.ok) store(load().slice(events.length));
  } finally {
    sending = false;
  }
}

/** Чьё состояние отправлять, когда события уходят не по концу дня (задаёт сцена). */
let source: (() => StoreState | undefined) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Шаги первых минут копятся FLUSH_DELAY и уходят пачкой, но не чаще раза в FLUSH_GAP. */
const FLUSH_DELAY = 3000;
const FLUSH_GAP = 10000;

export function setProgressSource(get: () => StoreState | undefined): void {
  source = get;
}

/** Отправить накопленные события поскорее (шаги обучения, первая продажа). */
export function flushSoon(): void {
  if (!source || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const state = source?.();
    if (state) void reportProgress(state);
  }, Math.max(FLUSH_DELAY, lastSent + FLUSH_GAP - Date.now()));
}

// Свернули Telegram — недоотправленное уходит сразу: запрос с keepalive доживёт, даже если игру закроют.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !load().length) return;
    const state = source?.();
    if (!state || Date.now() - lastSent < 3000) return;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    void reportProgress(state, true);
  });
}

export interface BoardRow {
  name: string;
  day: number;
  level: number;
  rating: number;
  revenue: number;
  me?: boolean;
  /** Ключ для «Заглянуть к конкуренту» (api/_lib/rival.ts). */
  key?: string;
  /** Золотая табличка: поддержал автора (game/support.ts, api/_lib/supporters.ts). */
  gold?: boolean;
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
