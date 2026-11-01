// Обработчики серверных функций. Не зависят от хостинга: секреты приходят параметром env,
// а тонкие обёртки лежат в api/ (Vercel) и worker/index.ts (Cloudflare Workers).

import { commandReply, setupProfile, startCaption, type StartInfo } from './botProfile.js';
import { ready, recordReferral, recordSource } from './social.js';
import { recordGuildInvite } from './guild.js';
import { addSupporter, syncSupporter } from './supporters.js';
import { langOf, type Lang } from './lang.js';
import { bot, canBuy, isSupport, itemFromPayload, json, catalogItem, ownedFrom, payloadFor, verifyInitData, type D1, type Env, type StarTransaction } from './telegram.js';

/** Описание в счёте за звёзды: поддержка автора, сезонный пропуск или вещь для магазина. */
const INVOICE: Record<Lang, { support: (title: string) => string; pass: (title: string) => string; item: (title: string) => string }> = {
  ru: {
    support: (title) => `${title}: спасибо, что поддерживаешь «Магазинчик»! Только украшения и благодарность — без преимуществ в игре.`,
    pass: (title) => `${title}: открывает премиальные награды сезона — звёздный декор и двойные монеты.`,
    item: (title) => `${title} — для твоего магазина. Остаётся навсегда.`,
  },
  en: {
    support: (title) => `${title}: thank you for supporting the game! Cosmetics and thanks only — no gameplay advantage.`,
    pass: (title) => `${title}: unlocks the season's premium rewards — star decor and double coins.`,
    item: (title) => `${title} for your store. Yours forever.`,
  },
  tr: {
    support: (title) => `${title}: Magazinchik’i desteklediğin için teşekkürler! Yalnızca süs ve teşekkür — oyunda avantaj yok.`,
    pass: (title) => `${title}: sezonun premium ödüllerini açar — yıldızlı süsler ve iki kat para.`,
    item: (title) => `${title} — dükkânın için. Sonsuza kadar senin.`,
  },
  es: {
    support: (title) => `${title}: ¡gracias por apoyar Magazinchik! Solo decoración y agradecimiento, sin ventajas en el juego.`,
    pass: (title) => `${title}: desbloquea las recompensas premium de la temporada: decoración estelar y monedas dobles.`,
    item: (title) => `${title} para tu tienda. Es tuyo para siempre.`,
  },
};

/** Бот в чате: спасибо после оплаты (name — название вещи на языке игрока) и кнопка «Играть» под приветствием. */
const PAID: Record<Lang, { support: (name: string) => string; item: (name: string) => string; play: string }> = {
  ru: {
    support: (name) => `Огромное спасибо за поддержку! 💛 «${name}» — табличка «Спасибо!» уже стоит у твоей кассы.`,
    item: (name) => `Спасибо! ${name} — уже в твоём магазине ✨`,
    play: '▶ Играть',
  },
  en: {
    support: (name) => `Thank you so much for your support! 💛 "${name}" — the «Thank you!» plaque is already by your register.`,
    item: (name) => `Thank you! ${name} is already in your store ✨`,
    play: '▶ Play',
  },
  tr: {
    support: (name) => `Desteğin için çok teşekkürler! 💛 “${name}” — “Teşekkürler!” tabelası şimdiden kasanın yanında.`,
    item: (name) => `Teşekkürler! ${name} artık dükkânında ✨`,
    play: '▶ Oyna',
  },
  es: {
    support: (name) => `¡Muchísimas gracias por tu apoyo! 💛 “${name}”: el letrero «¡Gracias!» ya está junto a tu caja.`,
    item: (name) => `¡Gracias! ${name} ya está en tu tienda ✨`,
    play: '▶ Jugar',
  },
};

/** POST /api/stars-invoice { initData, item } → { link }: счёт в звёздах на одну вещь оформления. */
export async function starsInvoice(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token) return json({ error: 'not_configured' }, 503);
  const body = (await request.json().catch(() => ({}))) as { initData?: string; item?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const item = body.item && canBuy(body.item) ? catalogItem(body.item) : undefined;
  if (!item) return json({ error: 'unknown_item' }, 400);
  // Язык Telegram игрока; не прислан — ru, как раньше.
  const lang = langOf(user.language_code);
  const title = item[lang];
  const invoice = INVOICE[lang];
  const link = await bot<string>(token, 'createInvoiceLink', {
    title,
    description: isSupport(body.item!) ? invoice.support(title) : body.item!.startsWith('pass_') ? invoice.pass(title) : invoice.item(title),
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
  const items = ownedFrom(await allTransactions(token), user.id);
  // Золотая табличка в рейтинге — по тем же платежам (supporters.ts); база недоступна — не беда.
  await syncSupporter(env.DB, user.id, items).catch((e) => console.error(e));
  return json({ items });
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
async function greet(token: string, env: Env, chat: number, from: { id: number } | undefined, payload: string, lang: Lang, origin: string): Promise<void> {
  const info = from ? await startInfo(env.DB, from.id, payload).catch((e) => (console.error(e), {})) : {};
  const caption = startCaption(lang, info);
  const reply_markup = { inline_keyboard: [[{ text: PAID[lang].play, web_app: { url: `${origin}/` } }]] };
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
    const lang = langOf(message.from?.language_code);
    const origin = `https://${new URL(request.url).host}`;
    if (message.successful_payment) {
      // Новая покупка: при следующем восстановлении перечитать платежи.
      resetStarsCache();
      const id = itemFromPayload(message.successful_payment.invoice_payload);
      const name = id ? catalogItem(id)![lang] : '';
      if (id && isSupport(id) && message.from) await addSupporter(env.DB, message.from.id, catalogItem(id)!.stars).catch((e) => console.error(e));
      await bot(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: id && isSupport(id) ? PAID[lang].support(name) : PAID[lang].item(name),
      });
    } else if (message.text && commandReply(message.text, lang)) {
      // /paysupport и /terms — Telegram требует их от ботов, которые продают за звёзды.
      await bot(token, 'sendMessage', { chat_id: message.chat.id, text: commandReply(message.text, lang, message.from?.id) });
    } else if (message.text?.startsWith('/start')) {
      // «/start ref_123» — друга пригласили по ссылке: записать, кто пригласил (social.ts).
      const payload = message.text.slice('/start'.length).trim();
      if (payload && message.from) await recordReferral(env, message.from.id, payload).catch((e) => console.error(e));
      // «/start src_tgads» — пришёл по рекламной ссылке: запомнить канал (social.ts).
      if (payload && message.from) await recordSource(env, message.from.id, payload).catch((e) => console.error(e));
      // «/start guild_ABC123» — приглашение в гильдию района (guild.ts).
      if (payload && message.from) await recordGuildInvite(env, message.from.id, payload).catch((e) => console.error(e));
      await greet(token, env, message.chat.id, message.from, payload, lang, origin);
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
    // Вернули звёзды за поддержку — золотая табличка в рейтинге снимается (supporters.ts).
    resetStarsCache();
    if (env.DB) await syncSupporter(env.DB, user, ownedFrom(await allTransactions(token), user), true).catch((e) => console.error(e));
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
