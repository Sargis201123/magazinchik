// Карточка итогов для сторис. Игра рисует картинку (src/platform/shareCard.ts) и присылает сюда:
// сервер хранит её пару дней по ссылке /api/card/<id>.jpg — Telegram берёт её оттуда для
// истории (shareToStory) или бот присылает её игроку в чат, чтобы переслать друзьям.

import { ready, username } from './social.js';
import { appLink, langOf, prepareMessage } from './share.js';
import { bot, json, verifyInitData, type D1, type Env } from './telegram.js';
import type { Lang } from './lang.js';

/** Картинка в base64 не больше этого (≈ 700 КБ JPEG). */
export const CARD_MAX = 950_000;
/** Не чаще раза в столько миллисекунд от одного игрока. */
export const CARD_GAP = 20_000;
/** Сколько хранить: Telegram забирает картинку сразу, дольше не нужно. */
export const CARD_TTL = 3 * 24 * 3600_000;
const ID_RE = /^[a-z0-9]{16}$/;
const B64_RE = /^[A-Za-z0-9+/]+=*$/;

/** Кнопка под карточкой в чате: название игры (по-турецки, по-испански и по-португальски — латиницей). */
const PLAY: Record<Lang, string> = { ru: '▶ Магазинчик', en: '▶ Магазинчик', tr: '▶ Magazinchik', es: '▶ Magazinchik', pt: '▶ Magazinchik' };

const newId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

/**
 * POST /api/card { initData, image (base64 JPEG), send?, caption?, share?, lang? } → { url, sent?, prepared? }:
 * сохранить карточку; share — подготовить её для окна «Поделиться» Telegram (prepared — номер
 * сообщения для WebApp.shareMessage); send — прислать игроку в чат с ботом (если окна не вышло).
 */
export async function card(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; image?: string; send?: boolean; caption?: string; share?: boolean; lang?: string };
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
  if (body.share) {
    try {
      return json({ url, prepared: await prepareMessage(token, user, 'card', url, langOf(body.lang), now) });
    } catch (error) {
      // Окно «Поделиться» не вышло (например, у бота выключен инлайн-режим) — пришлём карточку в чат.
      console.error(error);
    }
  }
  if (!body.send) return json({ url });
  try {
    // Карточку пересылают друзьям: кнопка мини-приложения после пересылки не работает, а обычная
    // ссылка t.me/<бот>?startapp=ref_<id> работает везде и сразу открывает игру с приглашением.
    const app = env.APP_URL ?? '';
    const name = await username(token).catch(() => '');
    const text = PLAY[langOf(body.lang)];
    const play = name ? { text, url: appLink(name, `ref_${user.id}`) } : app ? { text, web_app: { url: app } } : null;
    await bot(token, 'sendPhoto', {
      chat_id: user.id,
      photo: url,
      caption: String(body.caption ?? '').slice(0, 900),
      ...(play ? { reply_markup: { inline_keyboard: [[play]] } } : {}),
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
