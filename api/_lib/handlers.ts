// Обработчики серверных функций. Не зависят от хостинга: секреты приходят параметром env,
// а тонкие обёртки лежат в api/ (Vercel) и functions/api/ (Cloudflare Pages).

import { bot, itemFromPayload, json, ownedFrom, payloadFor, STARS_CATALOG, verifyInitData, type Env, type StarTransaction } from './telegram.js';

/** POST /api/stars-invoice { initData, item } → { link }: счёт в звёздах на одну вещь оформления. */
export async function starsInvoice(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token) return json({ error: 'not_configured' }, 503);
  const body = (await request.json().catch(() => ({}))) as { initData?: string; item?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const item = body.item ? STARS_CATALOG[body.item] : undefined;
  if (!item) return json({ error: 'unknown_item' }, 400);
  const ru = (user.language_code ?? 'ru').startsWith('ru') || !user.language_code;
  const title = ru ? item.ru : item.en;
  const link = await bot<string>(token, 'createInvoiceLink', {
    title,
    description: ru ? `${title} — для твоего магазина. Остаётся навсегда.` : `${title} for your store. Yours forever.`,
    payload: payloadFor(body.item!),
    currency: 'XTR',
    prices: [{ label: title, amount: item.stars }],
  });
  return json({ link });
}

const PAGE = 100;
const MAX_PAGES = 50;

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
  const all: StarTransaction[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { transactions } = await bot<{ transactions: StarTransaction[] }>(token, 'getStarTransactions', {
      offset: page * PAGE,
      limit: PAGE,
    });
    all.push(...transactions);
    if (transactions.length < PAGE) break;
  }
  return json({ items: ownedFrom(all, user.id) });
}

interface Update {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string };
  message?: {
    chat: { id: number };
    text?: string;
    from?: { language_code?: string };
    successful_payment?: { invoice_payload: string };
  };
}

/**
 * POST /api/telegram — вебхук бота. Подтверждает оплату звёздами (pre_checkout_query: у Telegram
 * на ответ 10 секунд), благодарит после покупки и отвечает на /start кнопкой «Играть».
 */
export async function telegramWebhook(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token || request.headers.get('x-telegram-bot-api-secret-token') !== (env.WEBHOOK_SECRET ?? '')) return new Response('forbidden', { status: 403 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const query = update.pre_checkout_query;
  if (query) {
    const id = itemFromPayload(query.invoice_payload);
    const ok = Boolean(id) && query.currency === 'XTR' && query.total_amount === STARS_CATALOG[id!].stars;
    await bot(token, 'answerPreCheckoutQuery', ok ? { pre_checkout_query_id: query.id, ok: true } : { pre_checkout_query_id: query.id, ok: false, error_message: 'Item is not available' });
    return new Response('ok');
  }
  const message = update.message;
  if (message) {
    const ru = (message.from?.language_code ?? 'ru').startsWith('ru');
    const app = `https://${new URL(request.url).host}/`;
    if (message.successful_payment) {
      const id = itemFromPayload(message.successful_payment.invoice_payload);
      const name = id ? STARS_CATALOG[id][ru ? 'ru' : 'en'] : '';
      await bot(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: ru ? `Спасибо! ${name} — уже в твоём магазине ✨` : `Thank you! ${name} is already in your store ✨`,
      });
    } else if (message.text?.startsWith('/start')) {
      await bot(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: ru ? 'Бабушкин магазинчик ждёт тебя! 🛒' : "Grandma's little shop is waiting for you! 🛒",
        reply_markup: { inline_keyboard: [[{ text: ru ? '▶ Играть' : '▶ Play', web_app: { url: app } }]] },
      });
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
  return json({ ok: true, webhook: info.url });
}
