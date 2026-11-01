import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStarsCache, resetStartClip, starsInvoice, starsOwned, starsRefund, starsSetup, telegramWebhook } from '../api/_lib/handlers';
import { startCaption, SUPPORT, WELCOME_COINS } from '../api/_lib/botProfile';
import { payloadFor, STARS_CATALOG, type Env } from '../api/_lib/telegram';

// Серверная часть оплаты звёздами: подпись Telegram, проверка цены перед оплатой,
// счёт, список купленного и вебхук бота. Сам Telegram — понарошку (fetch подменён).

const TOKEN = '123456:TEST-token';
const SECRET = 'hook_secret-1';
const env: Env = { BOT_TOKEN: TOKEN, WEBHOOK_SECRET: SECRET };
const enc = new TextEncoder();
const hmac = async (key: BufferSource, data: string) =>
  crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
async function initData(id: number, lang = 'ru'): Promise<string> {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Тест', language_code: lang }) };
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), TOKEN);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://shop.example/api/x', { method: 'POST', body: JSON.stringify(body), headers });

/** Вызовы Bot API: метод и тело; ответы — по методу. */
let calls: { method: string; body: Record<string, unknown> }[] = [];
let replies: Record<string, unknown[]> = {};
/** Методы, на которые Telegram отвечает ошибкой. */
let failing = new Set<string>();
beforeEach(() => {
  resetStarsCache();
  resetStartClip();
  calls = [];
  replies = {};
  failing = new Set();
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const method = url.split('/').pop()!;
    calls.push({ method, body: JSON.parse(init.body) });
    if (failing.has(method)) return new Response(JSON.stringify({ ok: false, description: 'Bad Request: failed to get HTTP URL content' }));
    const queue = replies[method];
    const result = queue?.length ? queue.shift() : true;
    return new Response(JSON.stringify({ ok: true, result }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const [ITEM, { stars: PRICE }] = Object.entries(STARS_CATALOG)[0];

describe('оплата звёздами (сервер)', () => {
  it('без токена — сервис не настроен; чужая подпись — 401; чужой товар — 400', async () => {
    expect((await starsInvoice(post({}), {})).status).toBe(503);
    expect((await starsInvoice(post({ initData: 'user=%7B%22id%22%3A1%7D&hash=00', item: ITEM }), env)).status).toBe(401);
    expect((await starsInvoice(post({ initData: await initData(1), item: 'ghost' }), env)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('счёт: цена из каталога, язык игрока, payload с id вещи', async () => {
    replies.createInvoiceLink = ['https://t.me/$invoice'];
    const res = await starsInvoice(post({ initData: await initData(7, 'en'), item: ITEM }), env);
    expect(await res.json()).toEqual({ link: 'https://t.me/$invoice' });
    const body = calls[0].body as { currency: string; prices: { amount: number }[]; payload: string; title: string };
    expect(calls[0].method).toBe('createInvoiceLink');
    expect(body.currency).toBe('XTR');
    expect(body.prices[0].amount).toBe(PRICE);
    expect(body.payload).toBe(payloadFor(ITEM));
    expect(body.title).toBe(STARS_CATALOG[ITEM].en);
  });

  it('купленное: только свои платежи, без возвратов, по всем страницам', async () => {
    const pay = (id: string, user: number, payload: string, amount = PRICE) => ({ id, amount, source: { type: 'user', user: { id: user }, invoice_payload: payload } });
    const full = Array.from({ length: 100 }, (_, i) => pay(`x${i}`, 99, payloadFor(ITEM)));
    replies.getStarTransactions = [
      { transactions: full },
      { transactions: [pay('a', 7, payloadFor(ITEM)), pay('b', 7, 'junk'), pay('c', 7, payloadFor(ITEM), PRICE - 1)] },
    ];
    const res = await starsOwned(post({ initData: await initData(7) }), env);
    expect(await res.json()).toEqual({ items: [ITEM] });
    expect(calls.map((c) => c.method)).toEqual(['getStarTransactions', 'getStarTransactions']);
  });

  it('вебхук без секрета — 403', async () => {
    expect((await telegramWebhook(post({}), env)).status).toBe(403);
    expect((await telegramWebhook(post({}, { 'x-telegram-bot-api-secret-token': 'wrong' }), env)).status).toBe(403);
  });

  it('перед оплатой: верная цена — ок, подделанная — отказ', async () => {
    const hook = (amount: number, payload = payloadFor(ITEM)) =>
      telegramWebhook(
        post({ pre_checkout_query: { id: 'q', currency: 'XTR', total_amount: amount, invoice_payload: payload } }, { 'x-telegram-bot-api-secret-token': SECRET }),
        env,
      );
    await hook(PRICE);
    await hook(1);
    await hook(PRICE, 'junk');
    expect(calls.map((c) => c.body.ok)).toEqual([true, false, false]);
    expect(calls.every((c) => c.method === 'answerPreCheckoutQuery')).toBe(true);
  });

  it('/start отвечает роликом и кнопкой «Играть» на этот же сайт; после оплаты — спасибо', async () => {
    const msg = (message: unknown) => telegramWebhook(post({ message }, { 'x-telegram-bot-api-secret-token': SECRET }), env);
    await msg({ chat: { id: 5 }, text: '/start', from: { id: 5, language_code: 'ru' } });
    expect(calls[0].method).toBe('sendAnimation');
    const start = calls[0].body as { animation: string; caption: string; reply_markup: { inline_keyboard: { web_app: { url: string } }[][] } };
    expect(start.animation).toBe('https://shop.example/promo/start.mp4');
    expect(start.caption).toBe(startCaption(true, {}));
    expect(start.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://shop.example/');
    await msg({ chat: { id: 5 }, from: { id: 5, language_code: 'en' }, successful_payment: { invoice_payload: payloadFor(ITEM) } });
    expect(String(calls[1].body.text)).toContain(STARS_CATALOG[ITEM].en);
  });

  it('/start: ролик Telegram скачал один раз — дальше по file_id; не скачал — приветствие текстом', async () => {
    const msg = (message: unknown) => telegramWebhook(post({ message }, { 'x-telegram-bot-api-secret-token': SECRET }), env);
    replies.sendAnimation = [{ animation: { file_id: 'CLIP1' } }];
    await msg({ chat: { id: 5 }, text: '/start', from: { id: 5, language_code: 'ru' } });
    await msg({ chat: { id: 6 }, text: '/start', from: { id: 6, language_code: 'en' } });
    expect(calls[1].body.animation).toBe('CLIP1');
    expect(calls[1].body.caption).toBe(startCaption(false, {}));
    failing.add('sendAnimation');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await msg({ chat: { id: 7 }, text: '/start', from: { id: 7, language_code: 'ru' } });
    expect(calls.slice(2).map((c) => c.method)).toEqual(['sendAnimation', 'sendMessage']);
    expect(calls[3].body).toMatchObject({ chat_id: 7, text: startCaption(true, {}) });
  });

  it('подпись на /start: играющему — его день и Соня, приглашённому — от кого подарок, новичку — бабушкин магазин', () => {
    expect(startCaption(true, { day: 14 })).toMatch(/^День 14\. .*Соня ждёт тебя/s);
    expect(startCaption(false, { day: 14 })).toMatch(/^Day 14\. .*Sonya/s);
    // Разные дни — разные строки, но всегда с днём.
    expect(new Set([14, 15, 16].map((day) => startCaption(true, { day }))).size).toBe(3);
    expect(startCaption(true, { friend: 'Аня' })).toContain(`Аня зовёт тебя`);
    expect(startCaption(true, { friend: 'Аня' })).toContain(String(WELCOME_COINS));
    expect(startCaption(true, { day: 1, friend: 'Аня' })).toContain('Аня');
    expect(startCaption(true, {})).toContain('Бабушка оставила тебе магазинчик');
  });

  it('установка вебхука — только с ключом; заодно описание, команды и кнопка «Играть»', async () => {
    expect((await starsSetup(new Request('https://shop.example/api/stars-setup?key=nope'), env)).status).toBe(403);
    replies.getWebhookInfo = [{ url: 'https://shop.example/api/telegram', pending_update_count: 0 }];
    const res = await starsSetup(new Request(`https://shop.example/api/stars-setup?key=${SECRET}`), env);
    expect(await res.json()).toEqual({ ok: true, webhook: 'https://shop.example/api/telegram', profile: 'ok' });
    expect(calls[0].body).toMatchObject({ url: 'https://shop.example/api/telegram', secret_token: SECRET });
    const methods = calls.map((c) => c.method);
    // ru, en (по умолчанию), tr, es.
    for (const m of ['setMyDescription', 'setMyShortDescription', 'setMyCommands']) expect(methods.filter((x) => x === m)).toHaveLength(4);
    expect(calls.filter((c) => c.method === 'setMyCommands').map((c) => c.body.language_code ?? '')).toEqual(['ru', '', 'tr', 'es']);
    const commands = calls.find((c) => c.method === 'setMyCommands' && c.body.language_code === 'ru')!.body.commands as { command: string }[];
    expect(commands.map((c) => c.command)).toEqual(['start', 'paysupport', 'terms']);
    for (const c of calls.filter((c) => c.method === 'setMyDescription')) expect(String(c.body.description).length).toBeLessThanOrEqual(512);
    for (const c of calls.filter((c) => c.method === 'setMyShortDescription')) expect(String(c.body.short_description).length).toBeLessThanOrEqual(120);
    expect(calls.find((c) => c.method === 'setChatMenuButton')!.body).toMatchObject({ menu_button: { type: 'web_app', web_app: { url: 'https://shop.example/' } } });
  });

  it('профиль не заполнился — вебхук всё равно подключён, ошибка видна', async () => {
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      const method = url.split('/').pop()!;
      calls.push({ method, body: JSON.parse(init.body) });
      if (method === 'setMyDescription') return new Response(JSON.stringify({ ok: false, description: 'Too Many Requests' }));
      return new Response(JSON.stringify({ ok: true, result: method === 'getWebhookInfo' ? { url: 'u' } : true }));
    });
    const res = await starsSetup(new Request(`https://shop.example/api/stars-setup?key=${SECRET}`), env);
    const body = (await res.json()) as { ok: boolean; profile: string[] };
    expect(body.ok).toBe(true);
    expect(body.profile).toHaveLength(4);
    expect(body.profile[0]).toContain('setMyDescription');
  });

  it('/paysupport и /terms: ответ с контактом поддержки и номером покупателя (Telegram требует для оплаты звёздами)', async () => {
    const msg = (text: string, lang = 'ru') => telegramWebhook(post({ message: { chat: { id: 5 }, text, from: { id: 5, language_code: lang } } }, { 'x-telegram-bot-api-secret-token': SECRET }), env);
    await msg('/paysupport');
    await msg('/terms@magazinchik_bot');
    await msg('/paysupport', 'en');
    expect(calls.map((c) => c.method)).toEqual(['sendMessage', 'sendMessage', 'sendMessage']);
    const [support, terms, en] = calls.map((c) => String(c.body.text));
    expect(support).toContain(SUPPORT);
    expect(support).toContain('5');
    expect(terms).toContain('30 дней');
    expect(en).toContain('Help with Stars payments');
    // Обычный текст — без ответа.
    await msg('привет');
    expect(calls).toHaveLength(3);
  });

  it('возврат звёзд: только с ключом; список платежей игрока, затем возврат по номеру платежа', async () => {
    const get = (q: string) => starsRefund(new Request(`https://shop.example/api/stars-refund?${q}`), env);
    expect((await get('key=nope&user=7')).status).toBe(403);
    expect((await get(`key=${SECRET}`)).status).toBe(400);
    expect(calls).toHaveLength(0);
    const pay = (id: string, user: number) => ({ id, amount: PRICE, date: 1_700_000_000, source: { type: 'user', user: { id: user }, invoice_payload: payloadFor(ITEM) } });
    replies.getStarTransactions = [{ transactions: [pay('a', 7), pay('b', 8), { id: 'a', amount: PRICE, receiver: { type: 'user', user: { id: 7 } } }, pay('c', 7)] }];
    const list = (await (await get(`key=${SECRET}&user=7`)).json()) as { payments: { charge: string; item: string; refunded: boolean }[] };
    expect(list.payments).toEqual([
      { charge: 'a', item: ITEM, stars: PRICE, date: new Date(1_700_000_000_000).toISOString(), refunded: true },
      { charge: 'c', item: ITEM, stars: PRICE, date: new Date(1_700_000_000_000).toISOString(), refunded: false },
    ]);
    calls = [];
    expect(await (await get(`key=${SECRET}&user=7&charge=c`)).json()).toEqual({ ok: true, refunded: 'c' });
    expect(calls[0]).toEqual({ method: 'refundStarPayment', body: { user_id: 7, telegram_payment_charge_id: 'c' } });
  });
});
