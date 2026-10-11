import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { starsInvoice, starsOwned, starsSetup, telegramWebhook } from '../api/_lib/handlers';
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
beforeEach(() => {
  calls = [];
  replies = {};
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const method = url.split('/').pop()!;
    calls.push({ method, body: JSON.parse(init.body) });
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

  it('/start отвечает кнопкой «Играть» на этот же сайт; после оплаты — спасибо', async () => {
    const msg = (message: unknown) => telegramWebhook(post({ message }, { 'x-telegram-bot-api-secret-token': SECRET }), env);
    await msg({ chat: { id: 5 }, text: '/start', from: { id: 5, language_code: 'ru' } });
    const start = calls[0].body as { reply_markup: { inline_keyboard: { web_app: { url: string } }[][] } };
    expect(start.reply_markup.inline_keyboard[0][0].web_app.url).toBe('https://shop.example/');
    await msg({ chat: { id: 5 }, from: { id: 5, language_code: 'en' }, successful_payment: { invoice_payload: payloadFor(ITEM) } });
    expect(String(calls[1].body.text)).toContain(STARS_CATALOG[ITEM].en);
  });

  it('установка вебхука — только с ключом', async () => {
    expect((await starsSetup(new Request('https://shop.example/api/stars-setup?key=nope'), env)).status).toBe(403);
    replies.getWebhookInfo = [{ url: 'https://shop.example/api/telegram', pending_update_count: 0 }];
    const res = await starsSetup(new Request(`https://shop.example/api/stars-setup?key=${SECRET}`), env);
    expect(await res.json()).toEqual({ ok: true, webhook: 'https://shop.example/api/telegram' });
    expect(calls[0].body).toMatchObject({ url: 'https://shop.example/api/telegram', secret_token: SECRET });
  });
});
