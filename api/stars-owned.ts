// POST /api/stars-owned — что игрок купил за звёзды (Vercel). Логика — в _lib/handlers.ts.
import { starsOwned } from './_lib/handlers.js';
import { processEnv } from './_lib/telegram.js';

export const POST = (request: Request): Promise<Response> => starsOwned(request, processEnv());
