// Дуэль с другом, гильдия района и «Чёрная пятница района» закрыты (решено автором 01.11): друзья
// соревнуются только в недельном турнире (league.ts), а выходные стали его бонусом.
//
// Старые игры ещё зовут /api/duel, /api/guild и /api/weekend — им спокойный пустой ответ
// { enabled: false } (старая игра так и понимает «выключено»), а не 500.
// Таблицы duels, guild*, weekend в базе НЕ удаляем (social.ts их по-прежнему объявляет) и больше не
// пишем. Один раз читаем — прощальный расчёт: награда за последнюю неделю, которую игрок ещё не
// забрал, приходит вместе с турниром (league.ts → farewell) и выдаётся игрой следующим утром.
// После FAREWELL_UNTIL не читаем и их.

import { weekOf, weekRevenue } from './week.js';
import { json, type D1 } from './telegram.js';

/** До этого момента (UTC) сервер ещё отдаёт прощальный расчёт; потом — ничего. */
export const FAREWELL_UNTIL = Date.UTC(2026, 11, 1);

/** Старые адреса /api/duel, /api/guild, /api/weekend: «выключено». */
export const gone = async (): Promise<Response> => json({ enabled: false });

export interface Farewell {
  duel?: { week: number; won: boolean };
  guild?: { week: number; name: string };
  rush?: { week: number; rank: number; players: number };
}

/** Начало недели (мс). */
const weekStart = (week: number): number => (week * 7 - 3) * 24 * 3600_000;

/** Выполнила ли гильдия цель недели: сохранённый итог или посчитать по тем, кто был в ней до конца недели. */
async function guildReached(db: D1, guild: number, week: number): Promise<boolean> {
  const saved = await db.prepare('SELECT reached FROM guild_results WHERE guild = ? AND week = ?').bind(guild, week).first<{ reached: number }>();
  if (saved) return saved.reached === 1;
  const target = await db.prepare('SELECT target FROM guild_weeks WHERE guild = ? AND week = ?').bind(guild, week).first<{ target: number }>();
  if (!target) return false;
  const ids = (await db.prepare('SELECT player FROM guild_members WHERE guild = ? AND joined < ?').bind(guild, weekStart(week + 1)).all<{ player: number }>()).results;
  let sum = 0;
  for (const { player } of ids) sum += await weekRevenue(db, player, week);
  return sum >= target.target;
}

/**
 * Прощальный расчёт за прошлую неделю: дуэль (победа или нет), цель гильдии (только выполненная —
 * за невыполненную награды и раньше не было), место в выходных. Пусто — undefined.
 * Ошибка базы — тоже undefined: турнир от этого не ломается.
 */
export async function farewell(db: D1, id: number, now: number): Promise<Farewell | undefined> {
  if (now >= FAREWELL_UNTIL) return undefined;
  try {
    const week = weekOf(now) - 1;
    const out: Farewell = {};
    const duel = await db.prepare('SELECT rival FROM duels WHERE id = ? AND week = ?').bind(id, week).first<{ rival: number }>();
    if (duel) out.duel = { week, won: (await weekRevenue(db, id, week)) > (await weekRevenue(db, duel.rival, week)) };
    const g = await db
      .prepare('SELECT g.id AS id, g.name AS name FROM guild_members m JOIN guilds g ON g.id = m.guild WHERE m.player = ?')
      .bind(id)
      .first<{ id: number; name: string }>();
    if (g && (await guildReached(db, g.id, week))) out.guild = { week, name: String(g.name ?? '').slice(0, 24) };
    const me = await db.prepare('SELECT last - start AS revenue FROM weekend WHERE id = ? AND week = ?').bind(id, week).first<{ revenue: number }>();
    if (me && me.revenue > 0) {
      const above = await db.prepare('SELECT COUNT(*) AS n FROM weekend WHERE week = ? AND last - start > ?').bind(week, me.revenue).first<{ n: number }>();
      const all = await db.prepare('SELECT COUNT(*) AS n FROM weekend WHERE week = ? AND last > start').bind(week).first<{ n: number }>();
      out.rush = { week, rank: (above?.n ?? 0) + 1, players: Math.max(1, all?.n ?? 1) };
    }
    return out.duel || out.guild || out.rush ? out : undefined;
  } catch (error) {
    console.error('farewell', error instanceof Error ? error.message : 'failed');
    return undefined;
  }
}

