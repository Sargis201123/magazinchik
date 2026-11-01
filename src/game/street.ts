// «Улица друзей»: магазины настоящих друзей (сеть друзей visits.ts — пригласил ты, пригласили тебя
// или добавили по коду) стоят домиками вдоль аллеи за дорогой. Список приходит с сервера одним
// запросом (api/_lib/visits.ts, action 'street'); он от других игроков, поэтому здесь всё проверяем
// и обрезаем, прежде чем рисовать. Картинки и касания — src/scenes/friendStreet.ts, карточка — ui/street.ts.

import { STORE_LEVELS } from './economy';
import { decorItem, isDecorId, type DecorId } from './decor';

/** Сколько домиков друзей помещается на улице. */
export const STREET_SIZE = 5;
/** Имя друга и название магазина на вывеске — не длиннее (как название своего магазина). */
export const STREET_NAME = 16;

/** Друг на улице: как выглядит его магазин и когда он заходил в игру. */
export interface StreetFriend {
  id: number;
  name: string;
  /** Помещение — индекс в STORE_LEVELS. */
  level: number;
  day: number;
  rating: number;
  /** Сколько дней назад заходил (0 — сегодня). Сервер считает по дням, без часов. */
  ago: number;
  /** Своё название магазина, если друг его дал. */
  shop?: string;
  /** Премиальная вывеска из «Оформления». */
  sign?: DecorId;
}

const num = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

/**
 * Имя от другого игрока: только печатные знаки (без управляющих и переворачивающих строку),
 * пробелы схлопнуты, не длиннее STREET_NAME. Пустое — пусто.
 */
export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  const plain = v.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '').replace(/\s+/g, ' ').trim();
  // По знакам, не по половинкам эмодзи: обрезка не оставит битый символ.
  return [...plain].slice(0, STREET_NAME).join('').trim();
}

/**
 * Список с сервера → домики улицы: негодные строки отбрасываем, числа ограничиваем, одного друга —
 * один раз; сначала те, кто заходил недавно, не больше STREET_SIZE.
 */
export function streetFriends(raw: unknown): StreetFriend[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: StreetFriend[] = [];
  for (const row of raw.slice(0, 40)) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    const name = cleanName(r.name);
    if (!name) continue;
    seen.add(id);
    const shop = cleanName(r.shop);
    const sign = typeof r.sign === 'string' && isDecorId(r.sign) ? decorItem(r.sign) : undefined;
    out.push({
      id,
      name,
      level: Math.round(num(r.level, 0, STORE_LEVELS.length - 1, 0)),
      day: Math.round(num(r.day, 1, 100000, 1)),
      rating: Math.round(num(r.rating, 0, 5, 3) * 10) / 10,
      ago: Math.round(num(r.ago, 0, 365, 365)),
      ...(shop ? { shop } : {}),
      ...(sign?.kind === 'sign' ? { sign: sign.id } : {}),
    });
  }
  // Сортировка устойчивая: при равных днях — как прислал сервер (он сортирует по времени).
  return out.sort((a, b) => a.ago - b.ago).slice(0, STREET_SIZE);
}

/** В окне свет — друг играл сегодня. */
export const litToday = (f: StreetFriend): boolean => f.ago === 0;

/** «Заходил»: сегодня, вчера или N дней назад — ключ перевода и число. */
export function lastSeen(f: StreetFriend): { key: 'street.seen.today' | 'street.seen.yesterday' | 'street.seen.days'; n: number } {
  if (f.ago <= 0) return { key: 'street.seen.today', n: 0 };
  if (f.ago === 1) return { key: 'street.seen.yesterday', n: 1 };
  return { key: 'street.seen.days', n: f.ago };
}

/**
 * Что сейчас нарисовано на улице — сцена перестраивает мир, когда это меняется. null — улица
 * выключена (нет Telegram или базы): ни домиков, ни участка «Сдаётся».
 */
export function streetKey(list: StreetFriend[] | null): string {
  if (!list) return '';
  if (!list.length) return 'lot';
  return list.map((f) => [f.id, f.level, f.name, f.shop ?? '', f.sign ?? '', litToday(f) ? 1 : 0].join(':')).join('|');
}
