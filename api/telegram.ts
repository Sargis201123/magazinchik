// POST /api/telegram — вебхук бота (Vercel). Логика — в _lib/handlers.ts.
import { telegramWebhook } from './_lib/handlers.js';
import { processEnv } from './_lib/telegram.js';

export const POST = (request: Request): Promise<Response> => telegramWebhook(request, processEnv());
