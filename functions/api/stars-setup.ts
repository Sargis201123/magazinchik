// GET /api/stars-setup?key=… — подключить вебхук (Cloudflare Pages). Логика — в api/_lib/handlers.ts.
import { starsSetup } from '../../api/_lib/handlers.js';
import type { Env } from '../../api/_lib/telegram.js';

export const onRequestGet = ({ request, env }: { request: Request; env: Env }): Promise<Response> => starsSetup(request, env);
