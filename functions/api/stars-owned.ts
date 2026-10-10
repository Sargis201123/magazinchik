// POST /api/stars-owned — что игрок купил за звёзды (Cloudflare Pages). Логика — в api/_lib/handlers.ts.
import { starsOwned } from '../../api/_lib/handlers.js';
import type { Env } from '../../api/_lib/telegram.js';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }): Promise<Response> => starsOwned(request, env);
