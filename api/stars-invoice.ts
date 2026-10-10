// POST /api/stars-invoice { initData, item } → { link }: счёт в звёздах на одну вещь оформления.
import { bot, botToken, json, payloadFor, STARS_CATALOG, verifyInitData } from './_lib/telegram.js';

export async function POST(request: Request): Promise<Response> {
  const token = botToken();
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
