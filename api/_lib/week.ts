// Неделя района: общие помощники для турнира (league.ts), газеты (newspaper.ts) и отчётов (stats.ts).
// Неделя — с понедельника (UTC). Выручка за неделю = выручка за всё время сейчас минус та, что
// была при первом прогрессе этой недели (week_start, пишет progress() в stats.ts).
// Раньше жили в guild.ts — дуэль и гильдию убрали (решено автором 01.11), помощники остались.

import type { D1 } from './telegram.js';

const DAY = 24 * 3600_000;

/** Номер недели (с понедельника, UTC). */
export const weekOf = (now: number): number => Math.floor((now / DAY + 3) / 7);
/** Сколько дней осталось до конца недели (включая сегодня). */
export const daysLeft = (now: number): number => 7 - (Math.floor(now / DAY + 3) % 7);
/** Выходные сейчас (суббота или воскресенье по UTC) — в турнире очки дня с бонусом (src/game/social.ts). */
export const isWeekend = (now: number): boolean => [0, 6].includes(new Date(now).getUTCDay());

/** Записать выручку на начало недели (зовёт progress() при каждом прогрессе). */
export async function markWeek(db: D1, id: number, revenue: number, now: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO week_start (id, week, revenue) VALUES (?, ?, ?)').bind(id, weekOf(now), revenue).run();
}

/** Выручка игрока за неделю: от начала этой недели до начала следующей (или до сейчас). */
export async function weekRevenue(db: D1, id: number, week: number): Promise<number> {
  const start = await db.prepare('SELECT revenue FROM week_start WHERE id = ? AND week = ?').bind(id, week).first<{ revenue: number }>();
  if (!start) return 0;
  const next = await db.prepare('SELECT revenue FROM week_start WHERE id = ? AND week = ?').bind(id, week + 1).first<{ revenue: number }>();
  const end = next ?? (await db.prepare('SELECT revenue FROM progress WHERE id = ?').bind(id).first<{ revenue: number }>());
  return Math.max(0, (end?.revenue ?? start.revenue) - start.revenue);
}

export const nameOf = async (db: D1, id: number): Promise<string> =>
  (await db.prepare('SELECT name FROM progress WHERE id = ?').bind(id).first<{ name: string }>())?.name ?? '—';
