// Cloudflare Worker: отдаёт игру (папка dist) и обслуживает серверную часть оплаты звёздами.
// Статические файлы Cloudflare раздаёт сам; сюда попадают только запросы, для которых файла нет, —
// то есть /api/*. Логика — в api/_lib/handlers.ts (та же, что на Vercel). Раз в час cron шлёт
// напоминания от бота (api/_lib/remind.ts, нужна база D1).

import { clientError, starsInvoice, starsOwned, starsRefund, starsSetup, telegramWebhook } from '../api/_lib/handlers.js';
import { socialClaim, socialPing } from '../api/_lib/social.js';
import { sendReminders } from '../api/_lib/remind.js';
import { events, eventsEdit } from '../api/_lib/live.js';
import { leaderboard, progress, stats } from '../api/_lib/stats.js';
import { duel, guild } from '../api/_lib/guild.js';
import { weekend } from '../api/_lib/weekend.js';
import { visits } from '../api/_lib/visits.js';
import { rival } from '../api/_lib/rival.js';
import { presents } from '../api/_lib/presents.js';
import { league } from '../api/_lib/league.js';
import { sendNewspapers } from '../api/_lib/newspaper.js';
import { card, cardImage, cleanCards } from '../api/_lib/card.js';
import { help, share } from '../api/_lib/share.js';
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
  '/api/rival': { method: 'POST', handler: rival },
  // Подарки друзьям в гостях и недельный турнир района (presents.ts, league.ts).
  '/api/presents': { method: 'POST', handler: presents },
  '/api/league': { method: 'POST', handler: league },
  '/api/card': { method: 'POST', handler: card },
  '/api/share': { method: 'POST', handler: share },
  '/api/help': { method: 'POST', handler: help },
  // Календарь праздников по настоящим датам: игре — GET, автору — правка с ключом (docs/EVENTS.md).
  '/api/events': { method: 'GET', handler: events },
  '/api/events-edit': { method: 'POST', handler: eventsEdit },
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    // Картинка карточки для сторис: /api/card/<id>.jpg (card.ts).
    const cardPath = /^\/api\/card\/([a-z0-9]+)\.jpg$/.exec(path);
    if (cardPath && request.method === 'GET') return cardImage(env, cardPath[1]);
    const route = ROUTES[path];
    if (!route) return env.ASSETS.fetch(request);
    if (request.method !== route.method) return new Response('method not allowed', { status: 405 });
    try {
      return await route.handler(request, env);
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
  /** Cron (wrangler.jsonc → triggers): раз в час — напоминания и, по понедельникам, газета района. */
  async scheduled(_event: unknown, env: WorkerEnv): Promise<void> {
    await sendReminders(env);
    await sendNewspapers(env);
    await cleanCards(env.DB);
  },
};
