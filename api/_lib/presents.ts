// «Магазин друга — живой»: в гостях у друга можно оставить один подарок в день — цветы, пирог или
// открытку с готовой доброй фразой — и, по желанию, «отзыв» звёздами. Своего текста нет: всё из
// готовых списков (src/game/social.ts), поэтому модерация не нужна. Друг увидит подарок утром,
// откроет его — и дарителю придёт «спасибо» (маленькая награда при следующем запуске).
//
// Клиенту не доверяем: кто дарит — из подписанных данных Telegram; кому — только другу из своей
// сети (visits.ts); лимиты в день — одним запросом, чтобы два касания разом их не обошли.
// Бот может написать другу «тебе подарок» — не чаще раза в день и только днём по его времени.

import { PHRASES, PRESENT_KINDS, type PresentKind } from '../../src/game/social.js';
import { ready } from './social.js';
import { network } from './visits.js';
import { daytime, DEFAULT_TZ } from './remind.js';
import { bot, json, verifyInitData, type D1, type Env } from './telegram.js';
import { langOf, type Lang } from './lang.js';

const DAY = 24 * 3600_000;
const today = (now: number): number => Math.floor(now / DAY);
/** Друзья, игравшие за столько дней, — им можно дарить (как гости в visits.ts). */
const ACTIVE_DAYS = 7;

/** Подарков в день от одного игрока и одному игроку от всех вместе. */
export const GIVE_DAY = 10;
export const GET_DAY = 20;
/** Сколько подарков отдаём за раз (остальные — в следующий раз). */
const BATCH = 20;
/** Открытые подарки чистим через столько дней. */
const KEEP_DAYS = 30;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS presents (sender INTEGER, receiver INTEGER, day INTEGER, kind TEXT, phrase INTEGER, stars INTEGER, at INTEGER, opened INTEGER DEFAULT 0, thanked INTEGER DEFAULT 0, PRIMARY KEY (sender, receiver, day))',
  'CREATE INDEX IF NOT EXISTS presents_receiver ON presents (receiver, opened)',
  'CREATE INDEX IF NOT EXISTS presents_sender ON presents (sender, opened, thanked)',
  // Когда бот последний раз писал игроку про подарок (не чаще раза в день).
  'CREATE TABLE IF NOT EXISTS present_pings (id INTEGER PRIMARY KEY, day INTEGER)',
];

const schemaReady = new WeakSet<D1>();
async function presentsReady(db: D1): Promise<void> {
  await ready(db);
  if (schemaReady.has(db)) return;
  // Таблицы уже есть (база живёт дольше воркера) — не тратить запросы: у D1 предел на один вызов.
  const known = await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('presents', 'present_pings')").first<{ n: number }>();
  if ((known?.n ?? 0) < 2) for (const sql of SCHEMA) await db.prepare(sql).run();
  schemaReady.add(db);
}

/** Письмо бота другу: кто оставил подарок, и кнопка в игру. */
const NOTIFY: Record<Lang, { text: (from: string) => string; open: string }> = {
  ru: { text: (from) => `🎁 ${from} заглядывает к тебе в магазин и оставляет подарок. Открой его утром!`, open: '▶ Открыть' },
  en: { text: (from) => `🎁 ${from} dropped by your store and left a present. Open it in the morning!`, open: '▶ Open' },
  tr: { text: (from) => `🎁 ${from} dükkânına uğradı ve sana bir hediye bıraktı. Sabah aç!`, open: '▶ Aç' },
  es: { text: (from) => `🎁 ${from} pasó por tu tienda y te dejó un regalo. ¡Ábrelo por la mañana!`, open: '▶ Abrir' },
  uz: { text: (from) => `🎁 ${from} doʻkoningga kirib, senga sovgʻa qoldirdi. Ertalab och!`, open: '▶ Ochish' },
};

const nameOf = async (db: D1, id: number): Promise<string> => (await db.prepare('SELECT name FROM progress WHERE id = ?').bind(id).first<{ name: string }>())?.name || '—';

/**
 * Бот пишет другу про подарок: раз в день, днём по его времени, только тем, кто открывал игру
 * (знаем язык) и не заблокировал бота. Ошибка Telegram подарку не мешает.
 */
async function notify(env: Env, db: D1, to: number, from: string, now: number): Promise<boolean> {
  const p = await db
    .prepare('SELECT pl.lang AS lang, h.tz AS tz FROM players pl LEFT JOIN hooks h ON h.id = pl.id WHERE pl.id = ?')
    .bind(to)
    .first<{ lang: string; tz: number | null }>();
  if (!p || !daytime(now, p.tz ?? DEFAULT_TZ)) return false;
  const res = await db
    .prepare('INSERT INTO present_pings (id, day) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET day = excluded.day WHERE present_pings.day < excluded.day')
    .bind(to, today(now))
    .run();
  if ((res.meta?.changes ?? 0) === 0) return false;
  const t = NOTIFY[langOf(p.lang)];
  const text = t.text(from);
  const url = env.APP_URL;
  try {
    await bot(env.BOT_TOKEN ?? '', 'sendMessage', {
      chat_id: to,
      text,
      ...(url ? { reply_markup: { inline_keyboard: [[{ text: t.open, web_app: { url } }]] } } : {}),
    });
    return true;
  } catch (error) {
    console.error('present notify', error instanceof Error ? error.message : 'failed');
    return false;
  }
}

/**
 * POST /api/presents { initData, action, to?, kind?, phrase?, stars? } →
 * list: { enabled, given: [id] — кому уже дарил сегодня, waiting — сколько подарков ждёт, thanks — сколько «спасибо» ждёт };
 * give: { ok } | { ok: false, error: friend | bad | already | limit | full };
 * open: { presents: [{ name, kind, phrase, stars }], thanks: [name] } — подарки мне и «спасибо» за мои (забираются один раз).
 */
export async function presents(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; action?: string; to?: unknown; kind?: unknown; phrase?: unknown; stars?: unknown };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await presentsReady(db);
  const day = today(now);
  if (body.action === 'give') {
    const to = Number(body.to);
    const kind = body.kind as PresentKind;
    const phrase = Number(body.phrase);
    const stars = body.stars === undefined || body.stars === null ? 0 : Number(body.stars);
    if (!PRESENT_KINDS.includes(kind) || !Number.isInteger(phrase) || phrase < 0 || phrase >= PHRASES || !Number.isInteger(stars) || stars < 0 || stars > 5) return json({ ok: false, error: 'bad' }, 400);
    const friends = await network(db, user.id, now - ACTIVE_DAYS * DAY);
    if (!friends.some((f) => f.id === to)) return json({ ok: false, error: 'friend' });
    // Все проверки и запись — одним запросом.
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO presents (sender, receiver, day, kind, phrase, stars, at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
         WHERE (SELECT COUNT(*) FROM presents WHERE sender = ?1 AND day = ?3) < ?8
           AND (SELECT COUNT(*) FROM presents WHERE receiver = ?2 AND day = ?3) < ?9`,
      )
      .bind(user.id, to, day, kind, phrase, stars, now, GIVE_DAY, GET_DAY)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      const again = await db.prepare('SELECT 1 AS n FROM presents WHERE sender = ? AND receiver = ? AND day = ?').bind(user.id, to, day).first<{ n: number }>();
      if (again) return json({ ok: false, error: 'already' });
      const mine = (await db.prepare('SELECT COUNT(*) AS n FROM presents WHERE sender = ? AND day = ?').bind(user.id, day).first<{ n: number }>())?.n ?? 0;
      return json({ ok: false, error: mine >= GIVE_DAY ? 'limit' : 'full' });
    }
    await notify(env, db, to, await nameOf(db, user.id), now).catch(() => false);
    return json({ ok: true });
  }
  if (body.action === 'open') {
    // Одним запросом: два одновременных запуска не откроют один подарок дважды.
    const rows = (
      await db
        .prepare(
          `UPDATE presents SET opened = 1 WHERE rowid IN (SELECT rowid FROM presents WHERE receiver = ? AND opened = 0 ORDER BY at LIMIT ${BATCH})
           RETURNING sender, kind, phrase, stars`,
        )
        .bind(user.id)
        .all<{ sender: number; kind: string; phrase: number; stars: number }>()
    ).results;
    const thanks = (
      await db
        .prepare(`UPDATE presents SET thanked = 1 WHERE rowid IN (SELECT rowid FROM presents WHERE sender = ? AND opened = 1 AND thanked = 0 LIMIT ${BATCH}) RETURNING receiver`)
        .bind(user.id)
        .all<{ receiver: number }>()
    ).results;
    // Старые подарки (и неоткрытые, и без «спасибо») — прочь, чтобы таблица не росла.
    await db.prepare('DELETE FROM presents WHERE (receiver = ?1 OR sender = ?1) AND day < ?2').bind(user.id, day - KEEP_DAYS).run();
    // Имена — одним запросом, сколько бы ни было друзей.
    const ids = [...new Set([...rows.map((r) => r.sender), ...thanks.map((r) => r.receiver)])];
    const names = new Map<number, string>(
      ids.length
        ? (await db.prepare('SELECT id, name FROM progress WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all<{ id: number; name: string }>()).results.map((r) => [r.id, r.name || '—'])
        : [],
    );
    return json({
      presents: rows
        .filter((r) => PRESENT_KINDS.includes(r.kind as PresentKind))
        .map((r) => ({ name: names.get(r.sender) ?? '—', kind: r.kind, phrase: Math.max(0, Math.min(PHRASES - 1, r.phrase)), stars: Math.max(0, Math.min(5, r.stars)) })),
      thanks: thanks.map((r) => names.get(r.receiver) ?? '—'),
    });
  }
  if (body.action && body.action !== 'list') return json({ error: 'bad_action' }, 400);
  const given = (await db.prepare('SELECT receiver FROM presents WHERE sender = ? AND day = ?').bind(user.id, day).all<{ receiver: number }>()).results.map((r) => r.receiver);
  const waiting = (await db.prepare('SELECT COUNT(*) AS n FROM presents WHERE receiver = ? AND opened = 0').bind(user.id).first<{ n: number }>())?.n ?? 0;
  const thanks = (await db.prepare('SELECT COUNT(*) AS n FROM presents WHERE sender = ? AND opened = 1 AND thanked = 0').bind(user.id).first<{ n: number }>())?.n ?? 0;
  return json({ enabled: true, given, waiting, thanks });
}
