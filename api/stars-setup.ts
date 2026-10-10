// GET /api/stars-setup?key=WEBHOOK_SECRET — один раз после деплоя: подключает вебхук бота к /api/telegram.
import { bot, botToken, json, webhookSecret } from './_lib/telegram.js';

export async function GET(request: Request): Promise<Response> {
  const token = botToken();
  const secret = webhookSecret();
  if (!token || !secret) return json({ error: 'Set BOT_TOKEN and WEBHOOK_SECRET in Vercel → Settings → Environment Variables' }, 503);
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== secret) return json({ error: 'forbidden' }, 403);
  const hook = `https://${request.headers.get('host')}/api/telegram`;
  await bot(token, 'setWebhook', { url: hook, secret_token: secret, allowed_updates: ['message', 'pre_checkout_query'] });
  const info = await bot<{ url: string; pending_update_count: number }>(token, 'getWebhookInfo', {});
  return json({ ok: true, webhook: info.url });
}
