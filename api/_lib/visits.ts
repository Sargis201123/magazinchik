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
/** Больше стольких друзей по коду не добавить. */
const MAX_FRIENDS = 50;
/** Код игрока для друзей: его номер в Telegram в 36-ричной записи. */
export const friendCode = (id: number): string => id.toString(36).toUpperCase();
const fromCode = (code: string): number => (/^[0-9A-Z]{1,12}$/i.test(code) ? parseInt(code, 36) : 0);

/** Друзья: по приглашениям (кого пригласил, кто пригласил, кого пригласил он же) и добавленные по коду. */
async function network(db: D1, me: number, since: number): Promise<{ id: number; name: string; level: number }[]> {
  return (
    await db
      .prepare(
        `SELECT id, name, level FROM progress WHERE id != ?1 AND updated > ?2 AND (
             id IN (SELECT invitee FROM referrals WHERE inviter = ?1)
          OR id IN (SELECT inviter FROM referrals WHERE invitee = ?1)
          OR id IN (SELECT invitee FROM referrals WHERE inviter IN (SELECT inviter FROM referrals WHERE invitee = ?1))
          OR id IN (SELECT b FROM friends WHERE a = ?1))
         ORDER BY updated DESC LIMIT 20`,
      )
      .bind(me, since)
      .all<{ id: number; name: string; level: number }>()
  ).results;
}

/**
 * POST /api/visits { initData, action: 'list' | 'gift' | 'claim' | 'shop' | 'add', to?, code? } →
 * list: { enabled, code, friends: [{ id, name, level, treated }], gifts: [{ name, amount }] };
 * add: { ok, name? | error } — добавить друга по его коду;
 * gift: { ok }; claim: { amount }; shop: { shop, name } — снимок магазина друга (null — нет).
 */
export async function visits(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; action?: string; to?: number; code?: string };
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
  if (body.action === 'add') {
    // Добавить друга по коду: он должен уже открывать игру; связь — в обе стороны.
    const to = fromCode(String(body.code ?? '').trim());
    if (!to || to === user.id) return json({ ok: false, error: 'bad_code' });
    const known = await db.prepare('SELECT name FROM progress WHERE id = ?').bind(to).first<{ name: string }>();
    if (!known) return json({ ok: false, error: 'not_found' });
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM friends WHERE a = ?').bind(user.id).first<{ n: number }>())?.n ?? 0;
    if (count >= MAX_FRIENDS) return json({ ok: false, error: 'too_many' });
    await db.prepare('INSERT OR IGNORE INTO friends (a, b, at) VALUES (?, ?, ?)').bind(user.id, to, now).run();
    await db.prepare('INSERT OR IGNORE INTO friends (a, b, at) VALUES (?, ?, ?)').bind(to, user.id, now).run();
    return json({ ok: true, name: known.name });
  }
  if (body.action === 'shop') {
    // Магазин друга — только из своей сети друзей.
    const to = Number(body.to);
    const friend = friends.find((f) => f.id === to);
    if (!friend) return json({ shop: null });
    const row = await db.prepare('SELECT data FROM shops WHERE id = ?').bind(to).first<{ data: string }>();
    let shop: unknown = null;
    try {
      shop = row ? JSON.parse(row.data) : null;
    } catch {
      shop = null;
    }
    return json({ shop, name: friend.name });
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
  return json({ enabled: true, code: friendCode(user.id), friends: friends.map((f) => ({ ...f, treated: treated.has(f.id) })), gifts });
}
