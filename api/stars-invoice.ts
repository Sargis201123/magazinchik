// POST /api/stars-invoice — счёт в звёздах (Vercel). Логика — в _lib/handlers.ts.
import { starsInvoice } from './_lib/handlers.js';
import { processEnv } from './_lib/telegram.js';

export const POST = (request: Request): Promise<Response> => starsInvoice(request, processEnv());
