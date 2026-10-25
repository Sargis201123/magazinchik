// Календарь праздников с сервера (/api/events, api/_lib/live.ts) и «сегодня» по часам игрока.
// Календарь берём при запуске и держим копию в памяти телефона: без сети и сервера игра
// празднует по последней копии, а если её нет — по встроенной (DEFAULT_EVENTS, game/live.ts).

import { localDate } from '../game/gift';
import { DEFAULT_EVENTS, parseEvents, type LiveEvent } from '../game/live';
import { trustedNow } from './telegram';

const KEY = 'magazinchik.liveEvents';
/** Свежий календарь спрашиваем не чаще раза в столько миллисекунд (копия в памяти телефона). */
const FRESH_MS = 3 * 3600_000;
const TIMEOUT_MS = 8000;

let events: LiveEvent[] | null = null;

function readCopy(): { at: number; events: LiveEvent[] } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at?: number; events?: unknown } | null;
    if (!raw) return null;
    return { at: Number(raw.at) || 0, events: parseEvents(raw.events).events };
  } catch {
    return null;
  }
}

/** Праздники календаря: свежие с сервера, иначе копия в телефоне, иначе встроенные. */
export function liveEvents(): LiveEvent[] {
  events ??= readCopy()?.events ?? DEFAULT_EVENTS;
  return events;
}

/** Спросить у сервера свежий календарь (при запуске). Ответил — запомнить; нет — остаётся прежний. */
export async function loadLiveEvents(): Promise<LiveEvent[]> {
  const copy = readCopy();
  if (copy && Date.now() - copy.at < FRESH_MS && copy.at <= Date.now()) {
    events = copy.events;
    return events;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/events', { signal: ctrl.signal });
    if (!res.ok) return liveEvents();
    const body = (await res.json()) as { events?: unknown };
    if (!Array.isArray(body.events)) return liveEvents();
    events = parseEvents(body.events).events;
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), events }));
    } catch {
      // Без хранилища — до перезапуска в памяти.
    }
    return events;
  } catch {
    return liveEvents();
  } finally {
    clearTimeout(timer);
  }
}

/** Сегодняшняя дата игрока («ГГГГ-ММ-ДД», местное время) — по часам, которые не подкрутить (trustedNow). */
export const todayLocal = (): string => localDate(new Date(trustedNow()));

/** Часовой пояс игрока: минуты к востоку от Гринвича (Москва — 180). Сервер шлёт напоминания днём по местному времени. */
export const tzOffset = (): number => -new Date().getTimezoneOffset();
