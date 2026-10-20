// Карточка итогов для сторис. Игра рисует картинку (src/platform/shareCard.ts) и присылает сюда:
// сервер хранит её пару дней по ссылке /api/card/<id>.jpg — Telegram берёт её оттуда для
// истории (shareToStory) или бот присылает её игроку в чат, чтобы переслать друзьям.

import { ready } from './social.js';
import { bot, json, verifyInitData, type D1, type Env } from './telegram.js';

/** Картинка в base64 не больше этого (≈ 700 КБ JPEG). */
export const CARD_MAX = 950_000;
/** Не чаще раза в столько миллисекунд от одного игрока. */
export const CARD_GAP = 20_000;
/** Сколько хранить: Telegram забирает картинку сразу, дольше не нужно. */
export const CARD_TTL = 3 * 24 * 3600_000;
const ID_RE = /^[a-z0-9]{16}$/;
const B64_RE = /^[A-Za-z0-9+/]+=*$/;

const newId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

/**
 * POST /api/card { initData, image (base64 JPEG), send?, caption? } → { url, sent? }:
 * сохранить карточку; send — ещё и прислать её игроку в чат с ботом.
 */
export async function card(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; image?: string; send?: boolean; caption?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const image = String(body.image ?? '');
  if (!image || image.length > CARD_MAX || !B64_RE.test(image)) return json({ error: 'bad_image' }, 400);
  await ready(db);
  const last = await db.prepare('SELECT MAX(at) AS at FROM cards WHERE owner = ?').bind(user.id).first<{ at: number | null }>();
  if (last?.at && now - last.at < CARD_GAP) return json({ error: 'too_often' }, 429);
  const id = newId();
  await db.prepare('INSERT INTO cards (id, owner, at, data) VALUES (?, ?, ?, ?)').bind(id, user.id, now, image).run();
  const url = `${new URL(request.url).origin}/api/card/${id}.jpg`;
  if (!body.send) return json({ url });
  try {
    const app = env.APP_URL ?? '';
    await bot(token, 'sendPhoto', {
      chat_id: user.id,
      photo: url,
      caption: String(body.caption ?? '').slice(0, 900),
      ...(app ? { reply_markup: { inline_keyboard: [[{ text: '▶ Магазинчик', web_app: { url: app } }]] } } : {}),
    });
    return json({ url, sent: true });
  } catch {
    return json({ url, sent: false });
  }
}

/** GET /api/card/<id>.jpg → картинка. */
export async function cardImage(env: Env, id: string): Promise<Response> {
  const db = env.DB;
  if (!db || !ID_RE.test(id)) return new Response('not found', { status: 404 });
  await ready(db);
  const row = await db.prepare('SELECT data FROM cards WHERE id = ?').bind(id).first<{ data: string }>();
  if (!row) return new Response('not found', { status: 404 });
  const bytes = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
}

/** Cron: убрать старые карточки. */
export async function cleanCards(db: D1 | undefined, now = Date.now()): Promise<void> {
  if (!db) return;
  await ready(db);
  await db.prepare('DELETE FROM cards WHERE at < ?').bind(now - CARD_TTL).run();
}
