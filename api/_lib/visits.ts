// Друзья в гостях. Друзья по приглашениям (как «свои» в рейтинге), игравшие за последнюю неделю,
// днём заходят в магазин игрока: их персонаж с именем покупает и оставляет чаевые. Нажал на
// друга — «угостил кофе»: друг получит монеты при следующем запуске (один раз в день каждому).

import { ready } from './social.js';
import { json, verifyInitData, type D1, type Env } from './telegram.js';

const DAY = 24 * 3600_000;
/** Сколько монет получает друг за угощение. */
export const GIFT = 300;
/** Друзья, игравшие за столько дней, приходят в гости. */
const ACTIVE_DAYS = 7;

const today = (now: number): number => Math.floor(now / DAY);

/** Друзья по приглашениям: кого пригласил, кто пригласил, кого пригласил он же. */
async function network(db: D1, me: number, since: number): Promise<{ id: number; name: string; level: number }[]> {
  return (
    await db
      .prepare(
        `SELECT id, name, level FROM progress WHERE id != ?1 AND updated > ?2 AND (
             id IN (SELECT invitee FROM referrals WHERE inviter = ?1)
          OR id IN (SELECT inviter FROM referrals WHERE invitee = ?1)
          OR id IN (SELECT invitee FROM referrals WHERE inviter IN (SELECT inviter FROM referrals WHERE invitee = ?1)))
         ORDER BY updated DESC LIMIT 20`,
      )
      .bind(me, since)
      .all<{ id: number; name: string; level: number }>()
  ).results;
}

/**
 * POST /api/visits { initData, action: 'list' | 'gift' | 'claim', to? } →
 * list: { enabled, friends: [{ id, name, level, treated }], gifts: [{ name, amount }] };
 * gift: { ok }; claim: { amount }.
 */
export async function visits(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; action?: string; to?: number };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  const friends = await network(db, user.id, now - ACTIVE_DAYS * DAY);
  if (body.action === 'gift') {
    const to = Number(body.to);
    if (!friends.some((f) => f.id === to)) return json({ ok: false });
    const res = await db.prepare('INSERT OR IGNORE INTO gifts (sender, receiver, day, amount) VALUES (?, ?, ?, ?)').bind(user.id, to, today(now), GIFT).run();
    return json({ ok: (res.meta?.changes ?? 0) > 0 });
  }
  if (body.action === 'claim') {
    // Одним запросом: два одновременных «забрать» не получат одни и те же подарки дважды.
    const rows = (await db.prepare('UPDATE gifts SET claimed = 1 WHERE receiver = ? AND claimed = 0 RETURNING amount').bind(user.id).all<{ amount: number }>()).results;
    return json({ amount: rows.reduce((sum, r) => sum + r.amount, 0) });
  }
  const treated = new Set(
    (await db.prepare('SELECT receiver FROM gifts WHERE sender = ? AND day = ?').bind(user.id, today(now)).all<{ receiver: number }>()).results.map((r) => r.receiver),
  );
  const gifts = (
    await db
      .prepare('SELECT COALESCE(p.name, \'—\') AS name, g.amount AS amount FROM gifts g LEFT JOIN progress p ON p.id = g.sender WHERE g.receiver = ? AND g.claimed = 0')
      .bind(user.id)
      .all<{ name: string; amount: number }>()
  ).results;
  return json({ enabled: true, friends: friends.map((f) => ({ ...f, treated: treated.has(f.id) })), gifts });
}
