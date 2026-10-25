// «Заглянуть к конкуренту»: из рейтинга игрок заходит в чужой магазин и может немного похулиганить —
// пролить сок, разбросать мусор, позвать покупателя к себе. Хозяин увидит последствия при следующем
// запуске (немного луж и мусора к открытию, пара ушедших гостей) и сможет ответить визитом или
// поблагодарить. Всё — без текста от игроков, только три готовые проделки.
//
// Клиенту не доверяем: кого можно навестить, сколько раз и как часто, решает сервер. Номеров Telegram
// чужих игроков клиент не видит — вместо них ключ, подписанный токеном бота для этого зрителя.

import { ready } from './social.js';
import { json, verifyInitData, type D1, type Env } from './telegram.js';

const DAY = 24 * 3600_000;
const today = (now: number): number => Math.floor(now / DAY);

export type PrankKind = 'spill' | 'trash' | 'lure';
export const PRANK_KINDS: PrankKind[] = ['spill', 'trash', 'lure'];
/** Проделок за день у одного игрока, у пары «кто — кому» и у одного хозяина от всех вместе. */
export const ACTOR_DAY = 3;
export const PAIR_DAY = 2;
export const VICTIM_DAY = 6;
/** Проделки чаще раза в столько миллисекунд не принимаем. */
export const MIN_GAP = 1500;
/** Ответить визитом или поблагодарить можно столько дней после чужой проделки. */
const ANSWER_DAYS = 7;
/** Старые просмотренные проделки чистим через столько дней. */
const KEEP_DAYS = 14;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS pranks (actor INTEGER, victim INTEGER, day INTEGER, kind TEXT, at INTEGER, seen INTEGER DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS pranks_actor ON pranks (actor, day)',
  'CREATE INDEX IF NOT EXISTS pranks_victim ON pranks (victim, seen)',
  // «Спасибо за визит» — один раз в день от каждого каждому.
  'CREATE TABLE IF NOT EXISTS rival_thanks (sender INTEGER, receiver INTEGER, day INTEGER, claimed INTEGER DEFAULT 0, PRIMARY KEY (sender, receiver, day))',
  'CREATE INDEX IF NOT EXISTS rival_thanks_receiver ON rival_thanks (receiver, claimed)',
];

const schemaReady = new WeakSet<D1>();
async function rivalReady(db: D1): Promise<void> {
  await ready(db);
  if (schemaReady.has(db)) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  schemaReady.add(db);
}

const encoder = new TextEncoder();
const keyCache = new Map<string, CryptoKey>();

/** Ключ игрока для этого зрителя: 16 знаков HMAC — не угадать, не перенести другому, номер не виден. */
export async function rivalKey(viewer: number, id: number, token: string): Promise<string> {
  let key = keyCache.get(token);
  if (!key) {
    key = await crypto.subtle.importKey('raw', encoder.encode(`rival:${token}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    keyCache.clear();
    keyCache.set(token, key);
  }
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${viewer}:${id}`)));
  return [...sig.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Кого игрок может навестить: десять лучших в рейтинге, свои (по приглашениям и коду) и те, кто
 * заходил к нему сам за последнюю неделю (ответить визитом). Себя — нет. Своих бывает много —
 * лучшие и обидчики идут первыми, чтобы их ключи всегда находились.
 */
async function candidates(db: D1, me: number, now: number): Promise<{ id: number; name: string }[]> {
  return (
    await db
      .prepare(
        `SELECT id, name FROM progress WHERE id != ?1 AND (
             id IN (SELECT id FROM progress ORDER BY revenue DESC LIMIT 10)
          OR id IN (SELECT invitee FROM referrals WHERE inviter = ?1)
          OR id IN (SELECT inviter FROM referrals WHERE invitee = ?1)
          OR id IN (SELECT invitee FROM referrals WHERE inviter IN (SELECT inviter FROM referrals WHERE invitee = ?1))
          OR id IN (SELECT b FROM friends WHERE a = ?1)
          OR id IN (SELECT actor FROM pranks WHERE victim = ?1 AND day >= ?2))
         ORDER BY (id IN (SELECT id FROM progress ORDER BY revenue DESC LIMIT 10)) DESC,
                  (id IN (SELECT actor FROM pranks WHERE victim = ?1 AND day >= ?2)) DESC, updated DESC
         LIMIT 120`,
      )
      .bind(me, today(now) - ANSWER_DAYS)
      .all<{ id: number; name: string }>()
  ).results;
}

/** Найти игрока по ключу среди тех, кого можно навестить. */
async function resolve(db: D1, me: number, key: unknown, token: string, now: number): Promise<{ id: number; name: string } | null> {
  if (typeof key !== 'string' || !/^[0-9a-f]{16}$/.test(key)) return null;
  for (const c of await candidates(db, me, now)) if ((await rivalKey(me, c.id, token)) === key) return c;
  return null;
}

const count = async (db: D1, sql: string, ...args: unknown[]): Promise<number> => (await db.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;

/** Сколько проделок у игрока осталось сегодня — и у этой пары. */
async function left(db: D1, me: number, victim: number | null, day: number): Promise<number> {
  const mine = ACTOR_DAY - (await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE actor = ? AND day = ?', me, day));
  if (victim === null) return Math.max(0, mine);
  const pair = PAIR_DAY - (await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE actor = ? AND victim = ? AND day = ?', me, victim, day));
  const theirs = VICTIM_DAY - (await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE victim = ? AND day = ?', victim, day));
  return Math.max(0, Math.min(mine, pair, theirs));
}

/**
 * POST /api/rival { initData, action, key?, kind? } →
 * shop: { shop, name, left } — снимок чужого магазина (shop: null — нельзя или нет снимка);
 * act: { ok, left } | { ok: false, error: limit | pair | victim | too_often | gone | bad_kind };
 * inbox: { pranks: [{ key, name, spill, trash, lure }], thanks: [name] } — что натворили у меня и кто
 *        поблагодарил за визит (забираются один раз);
 * thank: { ok } | { ok: false, error?: already } — поблагодарить того, кто заходил ко мне (раз в день).
 */
export async function rival(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; action?: string; key?: unknown; kind?: unknown };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await rivalReady(db);
  const day = today(now);
  if (body.action === 'shop') {
    const target = await resolve(db, user.id, body.key, token, now);
    if (!target) return json({ shop: null });
    const row = await db.prepare('SELECT data FROM shops WHERE id = ?').bind(target.id).first<{ data: string }>();
    let shop: unknown = null;
    try {
      shop = row ? JSON.parse(row.data) : null;
    } catch {
      shop = null;
    }
    return json({ shop, name: target.name, left: await left(db, user.id, target.id, day) });
  }
  if (body.action === 'act') {
    const kind = body.kind as PrankKind;
    if (!PRANK_KINDS.includes(kind)) return json({ ok: false, error: 'bad_kind' }, 400);
    const target = await resolve(db, user.id, body.key, token, now);
    if (!target) return json({ ok: false, error: 'gone' });
    // Все проверки и запись — одним запросом: два одновременных касания не обойдут лимиты.
    const res = await db
      .prepare(
        `INSERT INTO pranks (actor, victim, day, kind, at) SELECT ?1, ?2, ?3, ?4, ?5
         WHERE (SELECT COUNT(*) FROM pranks WHERE actor = ?1 AND day = ?3) < ?6
           AND (SELECT COUNT(*) FROM pranks WHERE actor = ?1 AND victim = ?2 AND day = ?3) < ?7
           AND (SELECT COUNT(*) FROM pranks WHERE victim = ?2 AND day = ?3) < ?8
           AND NOT EXISTS (SELECT 1 FROM pranks WHERE actor = ?1 AND at > ?5 - ?9)`,
      )
      .bind(user.id, target.id, day, kind, now, ACTOR_DAY, PAIR_DAY, VICTIM_DAY, MIN_GAP)
      .run();
    if ((res.meta?.changes ?? 0) > 0) return json({ ok: true, left: await left(db, user.id, target.id, day) });
    // Не записали — объяснить почему.
    if ((await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE actor = ? AND at > ?', user.id, now - MIN_GAP)) > 0) return json({ ok: false, error: 'too_often' });
    if ((await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE actor = ? AND day = ?', user.id, day)) >= ACTOR_DAY) return json({ ok: false, error: 'limit', left: 0 });
    if ((await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE actor = ? AND victim = ? AND day = ?', user.id, target.id, day)) >= PAIR_DAY) return json({ ok: false, error: 'pair', left: 0 });
    return json({ ok: false, error: 'victim', left: 0 });
  }
  if (body.action === 'thank') {
    // Поблагодарить можно только того, кто правда заходил ко мне на этой неделе.
    const target = await resolve(db, user.id, body.key, token, now);
    if (!target) return json({ ok: false });
    const visited = await count(db, 'SELECT COUNT(*) AS n FROM pranks WHERE actor = ? AND victim = ? AND day >= ?', target.id, user.id, day - ANSWER_DAYS);
    if (!visited) return json({ ok: false });
    const res = await db.prepare('INSERT OR IGNORE INTO rival_thanks (sender, receiver, day) VALUES (?, ?, ?)').bind(user.id, target.id, day).run();
    return (res.meta?.changes ?? 0) > 0 ? json({ ok: true }) : json({ ok: false, error: 'already' });
  }
  if (body.action === 'inbox') {
    // Одним запросом: два одновременных запуска не покажут одно и то же дважды.
    const rows = (await db.prepare('UPDATE pranks SET seen = 1 WHERE victim = ? AND seen = 0 RETURNING actor, kind').bind(user.id).all<{ actor: number; kind: string }>()).results;
    const thanks = (await db.prepare('UPDATE rival_thanks SET claimed = 1 WHERE receiver = ? AND claimed = 0 RETURNING sender').bind(user.id).all<{ sender: number }>()).results;
    await db.prepare('DELETE FROM pranks WHERE victim = ? AND seen = 1 AND day < ?').bind(user.id, day - KEEP_DAYS).run();
    const ids = [...new Set([...rows.map((r) => r.actor), ...thanks.map((r) => r.sender)])].slice(0, 50);
    const names = new Map<number, string>();
    for (const id of ids) names.set(id, (await db.prepare('SELECT name FROM progress WHERE id = ?').bind(id).first<{ name: string }>())?.name || '—');
    const by = new Map<number, { key: string; name: string; spill: number; trash: number; lure: number }>();
    for (const r of rows) {
      if (!PRANK_KINDS.includes(r.kind as PrankKind)) continue;
      let entry = by.get(r.actor);
      if (!entry) {
        entry = { key: await rivalKey(user.id, r.actor, token), name: names.get(r.actor) ?? '—', spill: 0, trash: 0, lure: 0 };
        by.set(r.actor, entry);
      }
      entry[r.kind as PrankKind]++;
    }
    return json({ pranks: [...by.values()].slice(0, 20), thanks: thanks.slice(0, 20).map((r) => names.get(r.sender) ?? '—') });
  }
  return json({ error: 'bad_action' }, 400);
}
