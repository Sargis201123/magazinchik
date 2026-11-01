// Поделиться через окно Telegram и «Позвать на помощь». Нужна база D1 (как приглашениям, social.ts).
//
// Окно «Поделиться» (WebApp.shareMessage, Telegram 8.0+) отправляет сообщение, которое заранее
// подготовил сервер: savePreparedInlineMessage требует токен бота, поэтому только здесь. Сообщение —
// картинка с подписью и кнопкой-ссылкой t.me/<бот>?startapp=… Это обычная ссылка, а не кнопка
// мини-приложения: она работает в группах и после пересылки и открывает игру сразу, без чата с ботом.
// Старый Telegram окна не знает — игра тогда открывает прежнее «Поделиться ссылкой» (platform/social.ts).
//
// «Позвать на помощь»: в час пик игрок зовёт друзей. Друг открывает игру по ссылке help_<id>, и
// подмога уходит сама — одно касание. Хозяину при следующем запуске — монеты и быстрая касса на
// день, другу — немного монет (суммы — в src/game/help.ts). От накрутки: помочь можно только тому,
// кто сам звал в последние сутки, каждому другу — раз в день, одному игроку — не больше HELPS_GIVEN
// подмог в день, а принять — не больше HELPS_TAKEN.

import { ready, username } from './social.js';
import { MAX_FRIENDS } from './visits.js';
import { bot, json, verifyInitData, type Env, type TgUser } from './telegram.js';
import { langOf, type Lang } from './lang.js';

const DAY = 24 * 3600_000;
/** Просьба о помощи действует сутки. */
export const ASK_TTL = DAY;
/** Сколько раз в день можно помочь (разным друзьям) и сколько подмог в день примет один магазин. */
export const HELPS_GIVEN = 3; // текст help.err.limit в игре: «помог троим»
export const HELPS_TAKEN = 5;
/** Сообщение для «Поделиться» — не чаще раза в столько миллисекунд от одного игрока. */
export const SHARE_GAP = 4000;

const today = (now: number): number => Math.floor(now / DAY);

export type ShareKind = 'invite' | 'help' | 'card';

/** Подписи к карточкам: имя — того, кто делится (из подписанных данных Telegram); итоги дня — от первого лица. */
const CAPTIONS: Record<Lang, Record<ShareKind, (name: string) => string>> = {
  ru: {
    invite: (name) => `🛒 ${name} зовёт тебя в «Магазинчик» — уютную пиксельную игру прямо в Telegram.\nБабушка оставила магазин: очередь, касса, кот у двери и дождь за окном. Тебе — подарок на старт 🎁`,
    help: (name) => `🆘 ${name}: «Помогите! В магазине час пик, очередь до самой двери!»\nНажми «Помочь» — подмога придёт в магазин, а тебе достанется подарок 🎁`,
    card: () => '🏪 Мой магазин в «Магазинчике» — итоги дня. Сыграй и обгони меня!',
  },
  en: {
    invite: (name) => `🛒 ${name} invites you to Magazinchik — a cozy pixel-art game right inside Telegram.\nGrandma left you a little shop: a queue, a till, a cat by the door and rain outside. A starter gift is waiting 🎁`,
    help: (name) => `🆘 ${name}: "Help! It's rush hour, the queue goes all the way to the door!"\nTap "Help" — your help goes to the shop, and you get a gift too 🎁`,
    card: () => "🏪 My shop in Magazinchik — today's results. Play and beat me!",
  },
  tr: {
    invite: (name) => `🛒 ${name} seni Magazinchik’e çağırıyor — doğrudan Telegram’da oynanan sıcacık bir piksel oyunu.\nNine sana küçük bir dükkân bıraktı: kuyruk, kasa, kapıda bir kedi ve camda yağmur. Başlangıç hediyen hazır 🎁`,
    help: (name) => `🆘 ${name}: “İmdat! Dükkânda yoğun saat, kuyruk kapıya kadar!”\n“Yardım et”e dokun — yardımın dükkâna gitsin, sana da bir hediye çıksın 🎁`,
    card: () => '🏪 Magazinchik’teki dükkânım — günün sonuçları. Oyna ve beni geç!',
  },
  es: {
    invite: (name) => `🛒 ${name} te invita a Magazinchik, un acogedor juego pixel art dentro de Telegram.\nLa abuela te dejó una tiendita: una fila, una caja, un gato en la puerta y lluvia afuera. Te espera un regalo de bienvenida 🎁`,
    help: (name) => `🆘 ${name}: “¡Ayuda! Es hora pico y la fila llega hasta la puerta”\nToca “Ayudar”: tu ayuda llegará a la tienda y tú también recibirás un regalo 🎁`,
    card: () => '🏪 Mi tienda en Magazinchik: los resultados del día. ¡Juega y supérame!',
  },
};

const BUTTONS: Record<Lang, { play: string; help: string }> = {
  ru: { play: '▶ Играть', help: '🤝 Помочь' },
  en: { play: '▶ Play', help: '🤝 Help' },
  tr: { play: '▶ Oyna', help: '🤝 Yardım et' },
  es: { play: '▶ Jugar', help: '🤝 Ayudar' },
};
/** Имя, если Telegram его не прислал. */
const SOMEONE: Record<Lang, string> = { ru: 'Друг', en: 'A friend', tr: 'Bir arkadaş', es: 'Un amigo' };
/** Картинки карточек (public/promo/<kind>_<lang>.jpg) есть только ru и en: остальным — английская. */
const PROMO: Record<Lang, 'ru' | 'en'> = { ru: 'ru', en: 'en', tr: 'en', es: 'en' };

/** Ссылка, которая сразу открывает игру с меткой (главное мини-приложение бота). */
export const appLink = (botName: string, payload: string): string => `https://t.me/${botName}?startapp=${payload}`;

/**
 * Подготовить сообщение для окна «Поделиться» игрока: картинка, подпись и кнопка-ссылка в игру
 * (help — «Помочь» с меткой help_<id>, остальное — «Играть» с приглашением ref_<id>). Возвращает
 * номер сообщения для WebApp.shareMessage; не вышло (например, у бота выключен инлайн-режим) — ошибка.
 */
export async function prepareMessage(token: string, user: TgUser, kind: ShareKind, photo: string, lang: Lang, now = Date.now()): Promise<string> {
  const name = (user.first_name ?? '').trim().slice(0, 30) || SOMEONE[lang];
  const link = appLink(await username(token), `${kind === 'help' ? 'help' : 'ref'}_${user.id}`);
  const prepared = await bot<{ id: string }>(token, 'savePreparedInlineMessage', {
    user_id: user.id,
    result: {
      type: 'photo',
      id: `${kind}${now.toString(36)}`,
      photo_url: photo,
      thumbnail_url: photo,
      caption: CAPTIONS[lang][kind](name),
      reply_markup: { inline_keyboard: [[{ text: BUTTONS[lang][kind === 'help' ? 'help' : 'play'], url: link }]] },
    },
    allow_user_chats: true,
    allow_group_chats: true,
    allow_channel_chats: false,
    allow_bot_chats: false,
  });
  return prepared.id;
}

/** Язык из запроса игры (card.ts берёт его отсюда). */
export { langOf };

/**
 * POST /api/share { initData, kind: 'invite' | 'help', lang? } → { id } — номер подготовленного
 * сообщения для WebApp.shareMessage; { error: 'too_often' } — делился только что (второе касание):
 * игра его пропускает; другая { error } — пусть игра поделится по-старому, ссылкой.
 * Картинки карточек — public/promo/<kind>_<lang>.jpg (карточка итогов дня готовится в card.ts).
 */
export async function share(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; kind?: string; lang?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const kind = body.kind === 'help' || body.kind === 'invite' ? body.kind : null;
  if (!kind) return json({ error: 'bad_kind' }, 400);
  await ready(db);
  const last = await db.prepare('SELECT at FROM shares WHERE id = ?').bind(user.id).first<{ at: number }>();
  // Без 429: игра отличает «только что делился» от сбоя и не открывает вдобавок старое окно со ссылкой.
  if (last && now - last.at < SHARE_GAP) return json({ error: 'too_often' });
  await db.prepare('INSERT OR REPLACE INTO shares (id, at) VALUES (?, ?)').bind(user.id, now).run();
  const lang = langOf(body.lang);
  try {
    const id = await prepareMessage(token, user, kind, `${new URL(request.url).origin}/promo/${kind}_${PROMO[lang]}.jpg`, lang, now);
    // Позвал на помощь — сутки друзья могут откликнуться.
    if (kind === 'help') await db.prepare('INSERT OR REPLACE INTO help_asks (id, at) VALUES (?, ?)').bind(user.id, now).run();
    return json({ id });
  } catch (error) {
    // Например, у бота выключен инлайн-режим: игра поделится обычной ссылкой.
    console.error(error);
    return json({ error: 'not_prepared' });
  }
}

/**
 * POST /api/help { initData, action: 'send' | 'ask' | 'claim' } →
 * send: { ok, name? | error } — игру открыли по ссылке help_<id> (метка — из подписанных данных
 * запуска): прислать подмогу тому, кто звал; ошибки: self, expired, limit, full, already;
 * ask: { ok } — позвал на помощь без окна «Поделиться» (старый Telegram, обычная ссылка);
 * claim: { names } — забрать подмогу друзей (их имена; монеты и быструю кассу начисляет игра).
 */
export async function help(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const db = env.DB;
  if (!token || !db) return json({ enabled: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: string; action?: string };
  const initData = body.initData ?? '';
  const user = await verifyInitData(initData, token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  await ready(db);
  if (body.action === 'claim') {
    // Одним запросом: два одновременных «забрать» не получат одну подмогу дважды.
    const rows = (await db.prepare('UPDATE helps SET claimed = 1 WHERE receiver = ? AND claimed = 0 RETURNING helper').bind(user.id).all<{ helper: number }>()).results;
    const names: string[] = [];
    for (const r of rows) {
      const p = await db.prepare('SELECT name FROM progress WHERE id = ?').bind(r.helper).first<{ name: string }>();
      names.push(p?.name ?? '—');
    }
    return json({ names });
  }
  if (body.action === 'ask') {
    await db.prepare('INSERT OR REPLACE INTO help_asks (id, at) VALUES (?, ?)').bind(user.id, now).run();
    return json({ ok: true });
  }
  if (body.action !== 'send') return json({ error: 'bad_action' }, 400);
  const match = /^help_(\d+)$/.exec(new URLSearchParams(initData).get('start_param') ?? '');
  const to = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(to) || to <= 0) return json({ ok: false, error: 'no_request' });
  if (to === user.id) return json({ ok: false, error: 'self' });
  const ask = await db.prepare('SELECT at FROM help_asks WHERE id = ?').bind(to).first<{ at: number }>();
  if (!ask || now - ask.at > ASK_TTL) return json({ ok: false, error: 'expired' });
  const day = today(now);
  const given = await db.prepare('SELECT COUNT(*) AS n FROM helps WHERE helper = ? AND day = ?').bind(user.id, day).first<{ n: number }>();
  const already = await db.prepare('SELECT 1 AS x FROM helps WHERE helper = ? AND receiver = ? AND day = ?').bind(user.id, to, day).first<{ x: number }>();
  if (already) return json({ ok: false, error: 'already' });
  if ((given?.n ?? 0) >= HELPS_GIVEN) return json({ ok: false, error: 'limit' });
  const taken = await db.prepare('SELECT COUNT(*) AS n FROM helps WHERE receiver = ? AND day = ?').bind(to, day).first<{ n: number }>();
  if ((taken?.n ?? 0) >= HELPS_TAKEN) return json({ ok: false, error: 'full' });
  const res = await db.prepare('INSERT OR IGNORE INTO helps (helper, receiver, day, at, claimed) VALUES (?, ?, ?, ?, 0)').bind(user.id, to, day, now).run();
  if (!(res.meta?.changes ?? 0)) return json({ ok: false, error: 'already' });
  // Помог — теперь друзья: заходят друг к другу в гости (visits.ts), если список не переполнен.
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM friends WHERE a = ?').bind(user.id).first<{ n: number }>())?.n ?? 0;
  if (count < MAX_FRIENDS) {
    await db.prepare('INSERT OR IGNORE INTO friends (a, b, at) VALUES (?, ?, ?)').bind(user.id, to, now).run();
    await db.prepare('INSERT OR IGNORE INTO friends (a, b, at) VALUES (?, ?, ?)').bind(to, user.id, now).run();
  }
  const receiver = await db.prepare('SELECT name FROM progress WHERE id = ?').bind(to).first<{ name: string }>();
  return json({ ok: true, name: receiver?.name ?? '' });
}
