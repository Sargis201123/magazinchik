// Обработчики серверных функций. Не зависят от хостинга: секреты приходят параметром env,
// а тонкие обёртки лежат в api/ (Vercel) и worker/index.ts (Cloudflare Workers).

import { commandReply, setupProfile, startCaption, type StartInfo } from './botProfile.js';
import { ready, recordReferral, recordSource } from './social.js';
import { recordGuildInvite } from './guild.js';
import { bot, canBuy, itemFromPayload, json, catalogItem, ownedFrom, payloadFor, verifyInitData, type D1, type Env, type StarTransaction } from './telegram.js';

/** POST /api/stars-invoice { initData, item } → { link }: счёт в звёздах на одну вещь оформления. */
export async function starsInvoice(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token) return json({ error: 'not_configured' }, 503);
  const body = (await request.json().catch(() => ({}))) as { initData?: string; item?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const item = body.item && canBuy(body.item) ? catalogItem(body.item) : undefined;
  if (!item) return json({ error: 'unknown_item' }, 400);
  const ru = (user.language_code ?? 'ru').startsWith('ru') || !user.language_code;
  const title = ru ? item.ru : item.en;
  const link = await bot<string>(token, 'createInvoiceLink', {
    title,
    description: body.item!.startsWith('pass_')
      ? ru
        ? `${title}: открывает премиальные награды сезона — звёздный декор и двойные монеты.`
        : `${title}: unlocks the season's premium rewards — star decor and double coins.`
      : ru
        ? `${title} — для твоего магазина. Остаётся навсегда.`
        : `${title} for your store. Yours forever.`,
    payload: payloadFor(body.item!),
    currency: 'XTR',
    prices: [{ label: title, amount: item.stars }],
  });
  return json({ link });
}

const PAGE = 100;
const MAX_PAGES = 50;

/** Список платежей держим в памяти воркера минуту: игра спрашивает его при каждом запуске. */
const CACHE_MS = 60_000;
let cache: { at: number; list: StarTransaction[] } | null = null;
export const resetStarsCache = (): void => {
  cache = null;
};

/** Все платежи бота в звёздах (постранично, с кэшем на минуту). */
async function allTransactions(token: string): Promise<StarTransaction[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
  const all: StarTransaction[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { transactions } = await bot<{ transactions: StarTransaction[] }>(token, 'getStarTransactions', {
      offset: page * PAGE,
      limit: PAGE,
    });
    all.push(...transactions);
    if (transactions.length < PAGE) break;
  }
  cache = { at: Date.now(), list: all };
  return all;
}

/**
 * POST /api/stars-owned { initData } → { items }: что игрок уже купил за звёзды.
 * Источник правды — платежи самого бота в Telegram, поэтому покупки возвращаются на любом телефоне.
 */
export async function starsOwned(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token) return json({ error: 'not_configured' }, 503);
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  return json({ items: ownedFrom(await allTransactions(token), user.id) });
}

interface Update {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string };
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; language_code?: string };
    successful_payment?: { invoice_payload: string };
  };
}

/**
 * Ролик к /start (public/promo/start.mp4, без звука — Telegram крутит его по кругу). Первый раз
 * Telegram скачивает его по ссылке, потом шлём по file_id — быстро и без лишних загрузок.
 */
let startClip: string | null = null;
export const resetStartClip = (): void => {
  startClip = null;
};

/** Что известно об игроке для приветствия: его день (если уже играл) и имя пригласившего друга. */
async function startInfo(db: D1 | undefined, id: number, payload: string): Promise<StartInfo> {
  if (!db) return {};
  await ready(db);
  const me = await db.prepare('SELECT day FROM progress WHERE id = ?').bind(id).first<{ day: number }>();
  const inviter = /^(?:ref|help)_(\d+)$/.exec(payload)?.[1];
  const friend = inviter ? await db.prepare('SELECT name FROM progress WHERE id = ?').bind(Number(inviter)).first<{ name: string }>() : null;
  return { day: me?.day, friend: friend?.name && friend.name !== '—' ? friend.name : undefined };
}

/** Приветствие на /start: короткий ролик с личной подписью и кнопкой «Играть»; ролика нет — просто текст. */
async function greet(token: string, env: Env, chat: number, from: { id: number } | undefined, payload: string, ru: boolean, origin: string): Promise<void> {
  const info = from ? await startInfo(env.DB, from.id, payload).catch((e) => (console.error(e), {})) : {};
  const caption = startCaption(ru, info);
  const reply_markup = { inline_keyboard: [[{ text: ru ? '▶ Играть' : '▶ Play', web_app: { url: `${origin}/` } }]] };
  try {
    const sent = await bot<{ animation?: { file_id: string }; document?: { file_id: string }; video?: { file_id: string } }>(token, 'sendAnimation', {
      chat_id: chat,
      animation: startClip ?? `${origin}/promo/start.mp4`,
      caption,
      reply_markup,
    });
    startClip = sent?.animation?.file_id ?? sent?.document?.file_id ?? sent?.video?.file_id ?? startClip;
  } catch (error) {
    // Ролик не дошёл (нет файла на этом хостинге, Telegram не скачал) — приветствие текстом.
    console.error(error);
    startClip = null;
    await bot(token, 'sendMessage', { chat_id: chat, text: caption, reply_markup });
  }
}

/**
 * POST /api/telegram — вебхук бота. Подтверждает оплату звёздами (pre_checkout_query: у Telegram
 * на ответ 10 секунд), благодарит после покупки и отвечает на /start роликом и кнопкой «Играть».
 */
export async function telegramWebhook(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token || request.headers.get('x-telegram-bot-api-secret-token') !== (env.WEBHOOK_SECRET ?? '')) return new Response('forbidden', { status: 403 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const query = update.pre_checkout_query;
  if (query) {
    const id = itemFromPayload(query.invoice_payload);
    const ok = Boolean(id) && query.currency === 'XTR' && query.total_amount === catalogItem(id!)!.stars;
    await bot(token, 'answerPreCheckoutQuery', ok ? { pre_checkout_query_id: query.id, ok: true } : { pre_checkout_query_id: query.id, ok: false, error_message: 'Item is not available' });
    return new Response('ok');
  }
  const message = update.message;
  if (message) {
    const ru = (message.from?.language_code ?? 'ru').startsWith('ru');
    const origin = `https://${new URL(request.url).host}`;
    if (message.successful_payment) {
      // Новая покупка: при следующем восстановлении перечитать платежи.
      resetStarsCache();
      const id = itemFromPayload(message.successful_payment.invoice_payload);
      const name = id ? catalogItem(id)![ru ? 'ru' : 'en'] : '';
      await bot(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: ru ? `Спасибо! ${name} — уже в твоём магазине ✨` : `Thank you! ${name} is already in your store ✨`,
      });
    } else if (message.text && commandReply(message.text, ru)) {
      // /paysupport и /terms — Telegram требует их от ботов, которые продают за звёзды.
      await bot(token, 'sendMessage', { chat_id: message.chat.id, text: commandReply(message.text, ru, message.from?.id) });
    } else if (message.text?.startsWith('/start')) {
      // «/start ref_123» — друга пригласили по ссылке: записать, кто пригласил (social.ts).
      const payload = message.text.slice('/start'.length).trim();
      if (payload && message.from) await recordReferral(env, message.from.id, payload).catch((e) => console.error(e));
      // «/start src_tgads» — пришёл по рекламной ссылке: запомнить канал (social.ts).
      if (payload && message.from) await recordSource(env, message.from.id, payload).catch((e) => console.error(e));
      // «/start guild_ABC123» — приглашение в гильдию района (guild.ts).
      if (payload && message.from) await recordGuildInvite(env, message.from.id, payload).catch((e) => console.error(e));
      await greet(token, env, message.chat.id, message.from, payload, ru, origin);
    }
  }
  return new Response('ok');
}

/** GET /api/stars-setup?key=WEBHOOK_SECRET — один раз после деплоя: подключает вебхук бота к /api/telegram этого сайта. */
export async function starsSetup(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const secret = env.WEBHOOK_SECRET ?? '';
  if (!token || !secret) return json({ error: 'Set BOT_TOKEN and WEBHOOK_SECRET in the hosting environment variables' }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== secret) return json({ error: 'forbidden' }, 403);
  const hook = `https://${url.host}/api/telegram`;
  await bot(token, 'setWebhook', { url: hook, secret_token: secret, allowed_updates: ['message', 'pre_checkout_query'] });
  const info = await bot<{ url: string; pending_update_count: number }>(token, 'getWebhookInfo', {});
  // Заодно — описание бота, команды и кнопка «Играть» в меню (не получилось — вебхук всё равно подключён).
  const failed = await setupProfile(token, `https://${url.host}/`);
  return json({ ok: true, webhook: info.url, profile: failed.length ? failed : 'ok' });
}

/**
 * GET /api/stars-refund?key=WEBHOOK_SECRET&user=ID — платежи игрока (номер он видит в /paysupport);
 * с &charge=ID — вернуть звёзды за этот платёж. Только для владельца: ключ — секрет вебхука.
 */
export async function starsRefund(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  const secret = env.WEBHOOK_SECRET ?? '';
  if (!token || !secret) return json({ error: 'not_configured' }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== secret) return json({ error: 'forbidden' }, 403);
  const user = Number(url.searchParams.get('user'));
  if (!Number.isSafeInteger(user) || user <= 0) return json({ error: 'user_required' }, 400);
  const charge = url.searchParams.get('charge');
  if (charge) {
    await bot(token, 'refundStarPayment', { user_id: user, telegram_payment_charge_id: charge });
    return json({ ok: true, refunded: charge });
  }
  const all = await allTransactions(token);
  const refunded = new Set(all.filter((tx) => tx.receiver?.type === 'user').map((tx) => tx.id));
  const payments = all
    .filter((tx) => tx.source?.type === 'user' && tx.source.user?.id === user)
    .map((tx) => ({
      charge: tx.id,
      item: itemFromPayload(tx.source?.invoice_payload) ?? null,
      stars: tx.amount,
      date: tx.date ? new Date(tx.date * 1000).toISOString() : null,
      refunded: refunded.has(tx.id),
    }));
  return json({ user, payments });
}

/**
 * POST /api/client-error — ошибка из игры у игрока. Пишем в лог (Cloudflare → Observability),
 * ничего не храним. Тело ограничено, лишние поля отбрасываются.
 */
export async function clientError(request: Request): Promise<Response> {
  const text = (await request.text().catch(() => '')).slice(0, 4000);
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const pick = (k: string, n = 300) => (typeof data[k] === 'string' ? (data[k] as string).slice(0, n) : typeof data[k] === 'number' || typeof data[k] === 'boolean' ? data[k] : undefined);
  console.error('client-error', JSON.stringify({ where: pick('where', 40), message: pick('message'), stack: pick('stack', 1500), day: pick('day'), level: pick('level'), running: pick('running'), ua: pick('ua', 120) }));
  return new Response(null, { status: 204 });
}
