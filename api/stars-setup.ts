// GET /api/stars-setup?key=… — подключить вебхук (Vercel). Логика — в _lib/handlers.ts.
import { starsSetup } from './_lib/handlers.js';
import { processEnv } from './_lib/telegram.js';

export const GET = (request: Request): Promise<Response> => starsSetup(request, processEnv());
