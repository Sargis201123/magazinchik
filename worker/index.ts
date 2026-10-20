// Cloudflare Worker: отдаёт игру (папка dist) и обслуживает серверную часть оплаты звёздами.
// Статические файлы Cloudflare раздаёт сам; сюда попадают только запросы, для которых файла нет, —
// то есть /api/*. Логика — в api/_lib/handlers.ts (та же, что на Vercel). Раз в час cron шлёт
// напоминания от бота (api/_lib/social.ts, нужна база D1).

import { clientError, starsInvoice, starsOwned, starsRefund, starsSetup, telegramWebhook } from '../api/_lib/handlers.js';
import { sendReminders, socialClaim, socialPing } from '../api/_lib/social.js';
import { leaderboard, progress, stats } from '../api/_lib/stats.js';
import { duel, guild } from '../api/_lib/guild.js';
import { weekend } from '../api/_lib/weekend.js';
import { visits } from '../api/_lib/visits.js';
import type { Env } from '../api/_lib/telegram.js';

interface WorkerEnv extends Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const ROUTES: Record<string, { method: string; handler: (request: Request, env: Env) => Promise<Response> }> = {
  '/api/stars-invoice': { method: 'POST', handler: starsInvoice },
  '/api/stars-owned': { method: 'POST', handler: starsOwned },
  '/api/telegram': { method: 'POST', handler: telegramWebhook },
  '/api/stars-setup': { method: 'GET', handler: starsSetup },
  '/api/stars-refund': { method: 'GET', handler: starsRefund },
  '/api/client-error': { method: 'POST', handler: clientError },
  '/api/social-ping': { method: 'POST', handler: socialPing },
  '/api/social-claim': { method: 'POST', handler: socialClaim },
  '/api/progress': { method: 'POST', handler: progress },
  '/api/leaderboard': { method: 'POST', handler: leaderboard },
  '/api/stats': { method: 'GET', handler: stats },
  '/api/duel': { method: 'POST', handler: duel },
  '/api/guild': { method: 'POST', handler: guild },
  '/api/weekend': { method: 'POST', handler: weekend },
  '/api/visits': { method: 'POST', handler: visits },
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const route = ROUTES[new URL(request.url).pathname];
    if (!route) return env.ASSETS.fetch(request);
    if (request.method !== route.method) return new Response('method not allowed', { status: 405 });
    try {
      return await route.handler(request, env);
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
  /** Cron (wrangler.jsonc → triggers): раз в час — напоминания тем, кто давно не заходил. */
  async scheduled(_event: unknown, env: WorkerEnv): Promise<void> {
    await sendReminders(env);
  },
};
