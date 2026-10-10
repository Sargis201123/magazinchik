// POST /api/stars-owned { initData } → { items }: что игрок уже купил за звёзды.
// Источник правды — платежи самого бота в Telegram, поэтому покупки возвращаются на любом телефоне.
import { bot, botToken, json, ownedFrom, verifyInitData, type StarTransaction } from './_lib/telegram.js';

const PAGE = 100;
const MAX_PAGES = 50;

export async function POST(request: Request): Promise<Response> {
  const token = botToken();
  if (!token) return json({ error: 'not_configured' }, 503);
  const body = (await request.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', token);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const all: StarTransaction[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { transactions } = await bot<{ transactions: StarTransaction[] }>(token, 'getStarTransactions', {
      offset: page * PAGE,
      limit: PAGE,
    });
    all.push(...transactions);
    if (transactions.length < PAGE) break;
  }
  return json({ items: ownedFrom(all, user.id) });
}
