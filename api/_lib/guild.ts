// Торговая неделя с другом и гильдии района. Нужна база D1 (как social.ts); без неё — выключено.
//
// Неделя — с понедельника (UTC). Выручка за неделю = выручка за всё время сейчас минус та, что
// была при первом прогрессе этой недели (week_start, пишет progress() в stats.ts).
//
// Торговая неделя: соперник — друг по приглашениям (stats.ts → «свои»), с которым ближе всего
// по выручке; выбирается раз в неделю. Кто больше заработал за неделю — победил.
// Гильдия: до GUILD_MAX игроков с общей целью недели (выручка вместе); цель — по прошлой неделе
// участников с запасом. Вступают по коду или по ссылке t.me/<бот>?start=guild_<код>.
// Награды выдаёт игра (один раз за неделю) — сервер говорит только, кто победил и выполнена ли цель.

import { ready } from './social.js';
import { json, verifyInitData, type D1, type Env } from './telegram.js';

const DAY = 24 * 3600_000;
export const GUILD_MAX = 20;
/** Цель гильдии: прошлая неделя участников × GUILD_STRETCH, но не меньше GUILD_MIN на человека. */
export const GUILD_STRETCH = 1.1;
export const GUILD_MIN = 5000;
const CODE_RE = /^[A-Z0-9]{6}$/;

/** Номер недели (с понедельника, UTC). */
export const weekOf = (now: number): number => Math.floor((now / DAY + 3) / 7);
/** Сколько дней осталось до конца недели (включая сегодня). */
export const daysLeft = (now: number): number => 7 - (Math.floor(now / DAY + 3) % 7);

/** Записать выручку на начало недели (зовёт progress() при каждом прогрессе). */
export async function markWeek(db: D1, id: number, revenue: number, now: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO week_start (id, week, revenue) VALUES (?, ?, ?)').bind(id, weekOf(now), revenue).run();
}

/** Выручка игрока за неделю: от начала этой недели до начала следующей (или до сейчас). */
async function weekRevenue(db: D1, id: number, week: number): Promise<number> {
  const start = await db.prepare('SELECT revenue FROM week_start WHERE id = ? AND week = ?').bind(id, week).first<{ revenue: number }>();
  if (!start) return 0;
  const next = await db.prepare('SELECT revenue FROM week_start WHERE id = ? AND week = ?').bind(id, week + 1).first<{ revenue: number }>();
  const end = next ?? (await db.prepare('SELECT revenue FROM progress WHERE id = ?').bind(id).first<{ revenue: number }>());
  return Math.max(0, (end?.revenue ?? start.revenue) - start.revenue);
}

const nameOf = async (db: D1, id: number): Promise<string> =>
  (await db.prepare('SELECT name FROM progress WHERE id = ?').bind(id).first<{ name: string }>())?.name ?? '—';

async function auth(request: Request, env: Env): Promise<{ db: D1; user: number; body: Record<string, unknown> } | Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await verifyInitData(String(body.initData ?? ''), token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  return { db, user: user.id, body };
}

/** Соперник на неделю: друг по приглашениям, ближе всех по выручке за всё время. */
async function pickRival(db: D1, me: number, week: number): Promise<number | null> {
  const fixed = await db.prepare('SELECT rival FROM duels WHERE id = ? AND week = ?').bind(me, week).first<{ rival: number }>();
  if (fixed) return fixed.rival;
  const mine = (await db.prepare('SELECT revenue FROM progress WHERE id = ?').bind(me).first<{ revenue: number }>())?.revenue ?? 0;
  const rival = await db
    .prepare(
      `SELECT id FROM progress WHERE id != ?1 AND (
           id IN (SELECT invitee FROM referrals WHERE inviter = ?1)
        OR id IN (SELECT inviter FROM referrals WHERE invitee = ?1)
        OR id IN (SELECT invitee FROM referrals WHERE inviter IN (SELECT inviter FROM referrals WHERE invitee = ?1)))
       ORDER BY ABS(revenue - ?2) LIMIT 1`,
    )
    .bind(me, mine)
    .first<{ id: number }>();
  if (!rival) return null;
  await db.prepare('INSERT OR IGNORE INTO duels (id, week, rival) VALUES (?, ?, ?)').bind(me, week, rival.id).run();
  return rival.id;
}

/**
 * POST /api/duel { initData } → { enabled, week, daysLeft, rival?: { name, mine, theirs }, last?: { week, won, mine, theirs, name } }:
 * торговая неделя с другом — сейчас и итог прошлой.
 */
export async function duel(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  const { db, user } = a;
  const week = weekOf(now);
  const rivalId = await pickRival(db, user, week);
  const rival = rivalId ? { name: await nameOf(db, rivalId), mine: await weekRevenue(db, user, week), theirs: await weekRevenue(db, rivalId, week) } : undefined;
  const prev = await db.prepare('SELECT rival FROM duels WHERE id = ? AND week = ?').bind(user, week - 1).first<{ rival: number }>();
  let last;
  if (prev) {
    const mine = await weekRevenue(db, user, week - 1);
    const theirs = await weekRevenue(db, prev.rival, week - 1);
    last = { week: week - 1, won: mine > theirs, mine, theirs, name: await nameOf(db, prev.rival) };
  }
  return json({ enabled: true, week, daysLeft: daysLeft(now), rival, last });
}

async function guildOf(db: D1, user: number): Promise<{ id: number; code: string; name: string; owner: number } | null> {
  return db
    .prepare('SELECT g.id, g.code, g.name, g.owner FROM guild_members m JOIN guilds g ON g.id = m.guild WHERE m.player = ?')
    .bind(user)
    .first<{ id: number; code: string; name: string; owner: number }>();
}

const membersOf = async (db: D1, guild: number): Promise<number[]> =>
  (await db.prepare('SELECT player FROM guild_members WHERE guild = ? ORDER BY joined').bind(guild).all<{ player: number }>()).results.map((r) => r.player);

/**
 * Цель недели: прошлая неделя участников с запасом. Кто вступил посреди недели, добавляет свою
 * долю; ушедшие цель не снижают (иначе — создать гильдию одному с целью 5000 и позвать всех).
 */
async function targetOf(db: D1, guild: number, week: number, members: number[]): Promise<number> {
  const fixed = await db.prepare('SELECT target FROM guild_weeks WHERE guild = ? AND week = ?').bind(guild, week).first<{ target: number }>();
  let target = 0;
  for (const id of members) target += Math.max(GUILD_MIN, Math.round((await weekRevenue(db, id, week - 1)) * GUILD_STRETCH));
  target = Math.max(fixed?.target ?? 0, Math.round(target / 1000) * 1000);
  if (target !== fixed?.target) await db.prepare('INSERT OR REPLACE INTO guild_weeks (guild, week, target) VALUES (?, ?, ?)').bind(guild, week, target).run();
  return target;
}

/** Начало недели (мс). */
const weekStart = (week: number): number => (week * 7 - 3) * DAY;

/**
 * Выполнена ли цель прошлой недели: считается один раз и запоминается. Считаются только те,
 * кто был в гильдии до конца той недели, — новички в понедельник прошлую неделю не «доделают».
 */
async function lastResult(db: D1, guild: number, week: number): Promise<boolean | null> {
  const saved = await db.prepare('SELECT reached FROM guild_results WHERE guild = ? AND week = ?').bind(guild, week).first<{ reached: number }>();
  if (saved) return saved.reached === 1;
  const target = await db.prepare('SELECT target FROM guild_weeks WHERE guild = ? AND week = ?').bind(guild, week).first<{ target: number }>();
  if (!target) return null;
  const ids = (await db.prepare('SELECT player FROM guild_members WHERE guild = ? AND joined < ?').bind(guild, weekStart(week + 1)).all<{ player: number }>()).results;
  let sum = 0;
  for (const { player } of ids) sum += await weekRevenue(db, player, week);
  const reached = sum >= target.target;
  await db.prepare('INSERT OR IGNORE INTO guild_results (guild, week, reached) VALUES (?, ?, ?)').bind(guild, week, reached ? 1 : 0).run();
  return reached;
}

/** Вступить по приглашению из ссылки (вебхук записал его при /start guild_<код>). */
async function acceptInvite(db: D1, user: number, now: number): Promise<void> {
  const invite = await db.prepare('SELECT guild FROM guild_invites WHERE player = ?').bind(user).first<{ guild: number }>();
  if (!invite) return;
  await db.prepare('DELETE FROM guild_invites WHERE player = ?').bind(user).run();
  if ((await membersOf(db, invite.guild)).length >= GUILD_MAX) return;
  await db.prepare('INSERT OR IGNORE INTO guild_members (player, guild, joined) VALUES (?, ?, ?)').bind(user, invite.guild, now).run();
}

/** Ссылка /start guild_<код>: запомнить приглашение до первого открытия игры. */
export async function recordGuildInvite(env: Env, player: number, payload: string): Promise<void> {
  const db = env.DB;
  const match = /^guild_([A-Z0-9]{6})$/.exec(payload.trim());
  if (!db || !match) return;
  await ready(db);
  const guild = await db.prepare('SELECT id FROM guilds WHERE code = ?').bind(match[1]).first<{ id: number }>();
  if (guild) await db.prepare('INSERT OR REPLACE INTO guild_invites (player, guild, at) VALUES (?, ?, ?)').bind(player, guild.id, Date.now()).run();
}

const newCode = (): string => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

/**
 * POST /api/guild { initData, action: 'status' | 'create' | 'join' | 'leave', name?, code? } →
 * { enabled, guild?: { name, code, owner, members: [{ name, week, me }], target, total, daysLeft, week, last?: { week, reached } }, error? }
 */
export async function guild(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const a = await auth(request, env);
  if (a instanceof Response) return a;
  const { db, user, body } = a;
  const action = String(body.action ?? 'status');
  let error: string | undefined;
  if (action === 'create' && !(await guildOf(db, user))) {
    const name = String(body.name ?? '').trim().slice(0, 24);
    if (!name) error = 'name';
    else {
      let code = newCode();
      for (let i = 0; i < 5 && (await db.prepare('SELECT id FROM guilds WHERE code = ?').bind(code).first()); i++) code = newCode();
      await db.prepare('INSERT INTO guilds (code, name, owner, created) VALUES (?, ?, ?, ?)').bind(code, name, user, now).run();
      const g = await db.prepare('SELECT id FROM guilds WHERE code = ?').bind(code).first<{ id: number }>();
      await db.prepare('INSERT OR REPLACE INTO guild_members (player, guild, joined) VALUES (?, ?, ?)').bind(user, g!.id, now).run();
    }
  } else if (action === 'join' && !(await guildOf(db, user))) {
    const code = String(body.code ?? '').trim().toUpperCase();
    const g = CODE_RE.test(code) ? await db.prepare('SELECT id FROM guilds WHERE code = ?').bind(code).first<{ id: number }>() : null;
    if (!g) error = 'code';
    else if ((await membersOf(db, g.id)).length >= GUILD_MAX) error = 'full';
    else await db.prepare('INSERT OR REPLACE INTO guild_members (player, guild, joined) VALUES (?, ?, ?)').bind(user, g.id, now).run();
  } else if (action === 'leave') {
    await db.prepare('DELETE FROM guild_members WHERE player = ?').bind(user).run();
  } else if (action === 'status') {
    await acceptInvite(db, user, now);
  }
  const g = await guildOf(db, user);
  if (!g) return json({ enabled: true, error });
  const week = weekOf(now);
  const ids = await membersOf(db, g.id);
  const members = [];
  let total = 0;
  for (const id of ids) {
    const w = await weekRevenue(db, id, week);
    total += w;
    members.push({ name: await nameOf(db, id), week: w, ...(id === user ? { me: true } : {}) });
  }
  members.sort((x, y) => y.week - x.week);
  const target = await targetOf(db, g.id, week, ids);
  const reached = await lastResult(db, g.id, week - 1);
  const last = reached === null ? undefined : { week: week - 1, reached };
  return json({ enabled: true, error, guild: { name: g.name, code: g.code, owner: g.owner === user, members, target, total, daysLeft: daysLeft(now), week, last } });
}
