// Режим тестировщика (16.11, автор: «Начисли мне 10 млн монет — чтоб тестировать всё, что возможно»).
// Сохранение живёт у игрока (localStorage и облако Telegram) — сервер его не правит. Поэтому сервер
// только говорит игре «это свой»: подпись initData сходится и номер Telegram есть в TESTER_IDS. Тогда
// в «Развитии» появляется раздел «🧪 Тестер» с кнопками монет (src/ui/tester.ts).
//
// TESTER_IDS задаёт сам автор в панели Cloudflare (Settings → Variables and Secrets), номера через
// запятую или пробел. В коде номеров нет и в логи они не пишутся. Нет переменной — тестеров нет.
//
// Честность: тестер играет с бесконечными деньгами, поэтому его отчёты не попадают туда, где его видят
// другие, — рейтинг, турнир района, магазин дня, общая цель — и в сводку автора (stats.ts, league.ts).

import { json, verifyInitData, type Env } from './telegram.js';

/** Номера Telegram из TESTER_IDS: только целые положительные числа, остальное — мимо. */
export function parseTesterIds(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  for (const part of (raw ?? '').split(/[\s,;]+/)) {
    if (!/^\d{1,16}$/.test(part)) continue;
    const id = Number(part);
    if (Number.isSafeInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}

/** Этот игрок — тестер (номер в TESTER_IDS)? */
export const isTester = (env: Env, id: number): boolean => parseTesterIds(env.TESTER_IDS).has(id);

/**
 * POST /api/tester { initData } → { tester }: true — только если подпись Telegram настоящая и номер
 * в TESTER_IDS. Любая ошибка — просто false: обычному игроку тут нечего видеть.
 */
export async function tester(request: Request, env: Env): Promise<Response> {
  const token = env.BOT_TOKEN ?? '';
  if (!token || !env.TESTER_IDS) return json({ tester: false });
  const body = (await request.json().catch(() => ({}))) as { initData?: unknown };
  const user = await verifyInitData(typeof body.initData === 'string' ? body.initData : '', token);
  return json({ tester: Boolean(user && isTester(env, user.id)) });
}
