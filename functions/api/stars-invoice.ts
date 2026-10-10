// POST /api/stars-invoice — счёт в звёздах (Cloudflare Pages). Логика — в api/_lib/handlers.ts.
import { starsInvoice } from '../../api/_lib/handlers.js';
import type { Env } from '../../api/_lib/telegram.js';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }): Promise<Response> => starsInvoice(request, env);
