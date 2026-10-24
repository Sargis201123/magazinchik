// Лицо бота в Telegram: описание, команды, кнопка меню и ответы на /paysupport и /terms.
// Telegram требует от ботов, которые продают за звёзды, команды поддержки по оплате (/paysupport)
// и условия (/terms). Профиль заполняется сам при разовой настройке (/api/stars-setup).

import { bot } from './telegram.js';

/** Кому писать по оплатам и возвратам. */
export const SUPPORT = '@s4rgis';

type Lang = 'ru' | 'en';

const DESCRIPTION: Record<Lang, string> = {
  ru: [
    '🛒 Магазинчик — уютный пиксельный симулятор магазина прямо в Telegram.',
    '',
    'Бабушка оставила тебе маленький ларёк. Закупай товар, ставь цены, нанимай продавцов, расширяйся до универмага и выстой против гипермаркета «Гигант».',
    '',
    'А дома ждёт дочка Соня. У вас своя история — она раскроется не сразу…',
    '',
    'Жми «Играть» 👇',
  ].join('\n'),
  en: [
    '🛒 Magazinchik — a cozy pixel-art shop simulator right inside Telegram.',
    '',
    'Grandma left you a tiny kiosk. Stock the shelves, set prices, hire staff, grow it into a department store and stand up to the «Giant» hypermarket.',
    '',
    'And at home your daughter Sonya is waiting. Your story will unfold slowly…',
    '',
    'Tap «Play» 👇',
  ].join('\n'),
};

const SHORT: Record<Lang, string> = {
  ru: 'Пиксельный симулятор магазина с трогательной историей. Играй прямо в Telegram 🛒',
  en: 'A pixel-art shop simulator with a touching story. Play right in Telegram 🛒',
};

const COMMANDS: Record<Lang, { command: string; description: string }[]> = {
  ru: [
    { command: 'start', description: 'Открыть игру' },
    { command: 'paysupport', description: 'Помощь с оплатой звёздами' },
    { command: 'terms', description: 'Условия и возврат звёзд' },
  ],
  en: [
    { command: 'start', description: 'Open the game' },
    { command: 'paysupport', description: 'Help with Stars payments' },
    { command: 'terms', description: 'Terms and Stars refunds' },
  ],
};

/** Подарок новичку от друга — как WELCOME_GIFT в src/platform/social.ts (проверяет тест). */
export const WELCOME_COINS = 300;

/** Что бот знает об игроке для приветствия на /start: его день в игре и кто позвал. */
export interface StartInfo {
  /** День магазина из последнего отчёта игры (progress); нет — ещё не играл. */
  day?: number;
  /** Имя друга, по чьей ссылке пришёл (ref_/help_), если друг уже играет. */
  friend?: string;
}

/**
 * Подпись к ролику на /start: играющему — его день и Соня, приглашённому — от кого подарок,
 * новичку — приглашение открыть бабушкин магазин. Вариант зависит от дня, чтобы не повторяться.
 */
export function startCaption(ru: boolean, info: StartInfo): string {
  const day = info.day ?? 0;
  if (day > 1) {
    const lines = ru
      ? [
          `День ${day}. Соня ждёт тебя вечером 🌙\nА у дверей магазинчика уже собираются покупатели.`,
          `День ${day}. За окном темнеет, зажигаются фонари 🏮\nЗагляни в магазинчик — а вечером Соня ждёт тебя дома.`,
          `День ${day}. Очередь у кассы растёт 🛒\nОткрывай смену — Соня ждёт тебя вечером.`,
        ]
      : [
          `Day ${day}. Sonya is waiting for you tonight 🌙\nCustomers are already gathering at the shop door.`,
          `Day ${day}. It's getting dark, the street lamps are on 🏮\nDrop by the shop — Sonya is waiting for you at home tonight.`,
          `Day ${day}. The queue at the till keeps growing 🛒\nOpen up — Sonya is waiting for you tonight.`,
        ];
    return lines[day % lines.length];
  }
  if (info.friend)
    return ru
      ? `${info.friend} зовёт тебя в «Магазинчик» 🎁\nТебе подарок на старт — ${WELCOME_COINS} монет. Бабушкин магазин ждёт!`
      : `${info.friend} invites you to Magazinchik 🎁\nA starter gift of ${WELCOME_COINS} coins is waiting. Grandma's shop is yours!`;
  return ru
    ? 'Бабушка оставила тебе магазинчик 🛒\nОткрывай двери — первые покупатели уже ждут!'
    : "Grandma left you her little shop 🛒\nOpen the doors — the first customers are already waiting!";
}

/** Ответ на /paysupport и /terms (null — это не наша команда). userId — чтобы поддержка нашла платёж. */
export function commandReply(text: string, ru: boolean, userId?: number): string | null {
  const command = text.trim().split(/[\s@]/)[0].toLowerCase();
  const id = userId ? (ru ? `\n\nВаш номер покупателя: ${userId} — укажите его в сообщении.` : `\n\nYour buyer number: ${userId} — please include it.`) : '';
  if (command === '/paysupport')
    return ru
      ? `💬 Помощь с оплатой звёздами\n\nЕсли звёзды списались, а покупка не появилась, или вы купили не то — напишите ${SUPPORT}: что купили и когда. Ответим в течение 1–2 дней и при необходимости вернём звёзды.\n\nКупленное подтягивается из Telegram само — сначала попробуйте перезапустить игру.${id}`
      : `💬 Help with Stars payments\n\nIf Stars were charged but the item didn't appear, or you bought the wrong thing — message ${SUPPORT}: what you bought and when. We reply within 1–2 days and refund Stars when needed.\n\nPurchases are restored from Telegram automatically — try restarting the game first.${id}`;
  if (command === '/terms')
    return ru
      ? `📄 Условия «Магазинчика»\n\n• Игра бесплатная. За звёзды Telegram продаются только украшения магазина — на прохождение они не влияют.\n• Каждую вещь можно бесплатно примерить на день до покупки.\n• Покупка остаётся навсегда и возвращается на любом телефоне с этим аккаунтом Telegram.\n• Возврат звёзд: если покупка не появилась или сделана по ошибке — напишите в течение 30 дней через /paysupport.\n• Мы храним только ваш номер в Telegram — для покупок, приглашений друзей и редких напоминаний от бота. Чтобы напоминания не приходили, остановите бота.\n\nВопросы: ${SUPPORT}`
      : `📄 Magazinchik terms\n\n• The game is free. Telegram Stars buy only shop decorations — they don't affect progress.\n• Every item can be tried on for free for a day before buying.\n• Purchases are yours forever and restore on any phone with this Telegram account.\n• Stars refunds: if a purchase didn't appear or was a mistake — contact us within 30 days via /paysupport.\n• We store only your Telegram ID — for purchases, friend invites and rare reminders from the bot. To stop reminders, stop the bot.\n\nQuestions: ${SUPPORT}`;
  return null;
}

/**
 * Заполнить профиль бота: описание, короткое описание, команды (ru и для остальных — en)
 * и кнопку меню «Играть». Возвращает, что не получилось (пусто — всё хорошо).
 */
export async function setupProfile(token: string, appUrl: string): Promise<string[]> {
  const failed: string[] = [];
  const call = (method: string, body: Record<string, unknown>) => bot(token, method, body).catch((e: Error) => failed.push(e.message));
  for (const lang of ['ru', 'en'] as const) {
    // Для «en» задаём язык по умолчанию (без language_code) — его видят все, кроме русскоязычных.
    const scope = lang === 'ru' ? { language_code: 'ru' } : {};
    await call('setMyDescription', { description: DESCRIPTION[lang], ...scope });
    await call('setMyShortDescription', { short_description: SHORT[lang], ...scope });
    await call('setMyCommands', { commands: COMMANDS[lang], ...scope });
  }
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Играть', web_app: { url: appUrl } } });
  return failed;
}
