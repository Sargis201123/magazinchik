// POST /api/telegram — вебхук бота (Cloudflare Pages). Логика — в api/_lib/handlers.ts.
import { telegramWebhook } from '../../api/_lib/handlers.js';
import type { Env } from '../../api/_lib/telegram.js';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }): Promise<Response> => telegramWebhook(request, env);
