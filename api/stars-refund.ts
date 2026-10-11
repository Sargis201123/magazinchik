// GET /api/stars-refund?key=…&user=…[&charge=…] — платежи игрока и возврат звёзд (Vercel). Логика — в _lib/handlers.ts.
import { starsRefund } from './_lib/handlers.js';
import { processEnv } from './_lib/telegram.js';

export const GET = (request: Request): Promise<Response> => starsRefund(request, processEnv());
