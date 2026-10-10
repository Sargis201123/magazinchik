// Cloudflare Worker: отдаёт игру (папка dist) и обслуживает серверную часть оплаты звёздами.
// Статические файлы Cloudflare раздаёт сам; сюда попадают только запросы, для которых файла нет, —
// то есть /api/*. Логика — в api/_lib/handlers.ts (та же, что на Vercel).

import { starsInvoice, starsOwned, starsSetup, telegramWebhook } from '../api/_lib/handlers.js';
import type { Env } from '../api/_lib/telegram.js';

interface WorkerEnv extends Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const ROUTES: Record<string, { method: string; handler: (request: Request, env: Env) => Promise<Response> }> = {
  '/api/stars-invoice': { method: 'POST', handler: starsInvoice },
  '/api/stars-owned': { method: 'POST', handler: starsOwned },
  '/api/telegram': { method: 'POST', handler: telegramWebhook },
  '/api/stars-setup': { method: 'GET', handler: starsSetup },
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
};
