// POST /api/telegram — вебхук бота. Подтверждает оплату звёздами (pre_checkout_query: у Telegram
// на ответ 10 секунд), благодарит после покупки и отвечает на /start кнопкой «Играть».
import { bot, botToken, itemFromPayload, STARS_CATALOG, webhookSecret } from './_lib/telegram.js';

interface Update {
  pre_checkout_query?: { id: string; currency: string; total_amount: number; invoice_payload: string };
  message?: {
    chat: { id: number };
    text?: string;
    from?: { language_code?: string };
    successful_payment?: { invoice_payload: string };
  };
}

export async function POST(request: Request): Promise<Response> {
  const token = botToken();
  if (!token || request.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) return new Response('forbidden', { status: 403 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const query = update.pre_checkout_query;
  if (query) {
    const id = itemFromPayload(query.invoice_payload);
    const ok = Boolean(id) && query.currency === 'XTR' && query.total_amount === STARS_CATALOG[id!].stars;
    await bot(token, 'answerPreCheckoutQuery', ok ? { pre_checkout_query_id: query.id, ok: true } : { pre_checkout_query_id: query.id, ok: false, error_message: 'Item is not available' });
    return new Response('ok');
  }
  const message = update.message;
  if (message) {
    const ru = (message.from?.language_code ?? 'ru').startsWith('ru');
    const app = `https://${request.headers.get('host')}/`;
    if (message.successful_payment) {
      const id = itemFromPayload(message.successful_payment.invoice_payload);
      const name = id ? STARS_CATALOG[id][ru ? 'ru' : 'en'] : '';
      await bot(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: ru ? `Спасибо! ${name} — уже в твоём магазине ✨` : `Thank you! ${name} is already in your store ✨`,
      });
    } else if (message.text?.startsWith('/start')) {
      await bot(token, 'sendMessage', {
        chat_id: message.chat.id,
        text: ru ? 'Бабушкин магазинчик ждёт тебя! 🛒' : "Grandma's little shop is waiting for you! 🛒",
        reply_markup: { inline_keyboard: [[{ text: ru ? '▶ Играть' : '▶ Play', web_app: { url: app } }]] },
      });
    }
  }
  return new Response('ok');
}
