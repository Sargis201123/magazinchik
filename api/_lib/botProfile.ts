// Лицо бота в Telegram: описание, команды, кнопка меню и ответы на /paysupport и /terms.
// Telegram требует от ботов, которые продают за звёзды, команды поддержки по оплате (/paysupport)
// и условия (/terms). Профиль заполняется сам при разовой настройке (/api/stars-setup).

import { bot } from './telegram.js';
import { LANGS, type Lang } from './lang.js';

/** Кому писать по оплатам и возвратам. */
export const SUPPORT = '@s4rgis';

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
  tr: [
    '🛒 Magazinchik — doğrudan Telegram’da oynanan, sıcacık bir piksel dükkân simülatörü.',
    '',
    'Nine sana küçük bir büfe bıraktı. Mal al, fiyatları belirle, satıcı işe al, büfeyi büyük bir mağazaya dönüştür ve «Dev» hipermarketine karşı ayakta kal.',
    '',
    'Evde de kızın Sonya seni bekliyor. İkinizin de bir hikâyesi var — o hemen açılmayacak…',
    '',
    '«Oyna»ya dokun 👇',
  ].join('\n'),
  es: [
    '🛒 Magazinchik: un acogedor simulador de tienda en pixel art, dentro de Telegram.',
    '',
    'La abuela te dejó un pequeño puesto. Compra mercancía, pon precios, contrata vendedores, conviértelo en una gran tienda departamental y hazle frente al hipermercado «Gigante».',
    '',
    'Y en casa te espera tu hija Sonia. Tienen su propia historia, que se irá revelando poco a poco…',
    '',
    'Toca «Jugar» 👇',
  ].join('\n'),
  kk: [
    '🛒 Магазинчик — Telegram ішіндегі жып-жылы пиксель дүкен симуляторы.',
    '',
    'Әже саған кішкентай дүңгіршек қалдырды. Тауар сатып ал, баға қой, сатушы жалда, әмбебап дүкенге дейін өс және «Гигант» гипермаркетіне төтеп бер.',
    '',
    'Ал үйде қызың Соня күтіп отыр. Екеуіңнің өз оқиғаларың бар — ол бірден ашылмайды…',
    '',
    '«Ойнау» батырмасын бас 👇',
  ].join('\n'),
};

const SHORT: Record<Lang, string> = {
  ru: 'Пиксельный симулятор магазина с трогательной историей. Играй прямо в Telegram 🛒',
  en: 'A pixel-art shop simulator with a touching story. Play right in Telegram 🛒',
  tr: 'Dokunaklı bir hikâyesi olan piksel dükkân simülatörü. Doğrudan Telegram’da oyna 🛒',
  es: 'Un simulador de tienda en pixel art con una historia conmovedora. Juega directo en Telegram 🛒',
  kk: 'Жүрек жылытар оқиғасы бар пиксель дүкен симуляторы. Telegram-да бірден ойна 🛒',
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
  tr: [
    { command: 'start', description: 'Oyunu aç' },
    { command: 'paysupport', description: 'Yıldızla ödeme yardımı' },
    { command: 'terms', description: 'Koşullar ve yıldız iadesi' },
  ],
  es: [
    { command: 'start', description: 'Abrir el juego' },
    { command: 'paysupport', description: 'Ayuda con pagos en Stars' },
    { command: 'terms', description: 'Condiciones y reembolsos de Stars' },
  ],
  kk: [
    { command: 'start', description: 'Ойынды ашу' },
    { command: 'paysupport', description: 'Жұлдызбен төлеу бойынша көмек' },
    { command: 'terms', description: 'Шарттар және жұлдызды қайтару' },
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

/** Тексты бота в чате: подпись к ролику на /start и ответы на /paysupport и /terms. */
interface ChatTexts {
  /** Играющему: варианты по дню, чтобы не повторяться. */
  days: (day: number) => string[];
  friend: (friend: string) => string;
  newcomer: string;
  buyer: (id: number) => string;
  paysupport: (id: string) => string;
  terms: string;
}
const CHAT: Record<Lang, ChatTexts> = {
  ru: {
    days: (day) => [
      `День ${day}. Соня ждёт тебя вечером 🌙\nА у дверей магазинчика уже собираются покупатели.`,
      `День ${day}. За окном темнеет, зажигаются фонари 🏮\nЗагляни в магазинчик — а вечером Соня ждёт тебя дома.`,
      `День ${day}. Очередь у кассы растёт 🛒\nОткрывай смену — Соня ждёт тебя вечером.`,
    ],
    friend: (friend) => `${friend} зовёт тебя в «Магазинчик» 🎁\nТебе подарок на старт — ${WELCOME_COINS} монет. Бабушкин магазин ждёт!`,
    newcomer: 'Бабушка оставила тебе магазинчик 🛒\nОткрывай двери — первые покупатели уже ждут!',
    buyer: (userId) => `\n\nВаш номер покупателя: ${userId} — укажите его в сообщении.`,
    paysupport: (id) =>
      `💬 Помощь с оплатой звёздами\n\nЕсли звёзды списались, а покупка не появилась, или вы купили не то — напишите ${SUPPORT}: что купили и когда. Ответим в течение 1–2 дней и при необходимости вернём звёзды.\n\nКупленное подтягивается из Telegram само — сначала попробуйте перезапустить игру.${id}`,
    terms: `📄 Условия «Магазинчика»\n\n• Игра бесплатная. За звёзды Telegram продаются только украшения магазина — на прохождение они не влияют.\n• Каждую вещь можно бесплатно примерить на день до покупки.\n• Покупка остаётся навсегда и возвращается на любом телефоне с этим аккаунтом Telegram.\n• Возврат звёзд: если покупка не появилась или сделана по ошибке — напишите в течение 30 дней через /paysupport.\n• Мы храним только ваш номер в Telegram — для покупок, приглашений друзей и редких напоминаний от бота. Чтобы напоминания не приходили, остановите бота.\n\nВопросы: ${SUPPORT}`,
  },
  en: {
    days: (day) => [
      `Day ${day}. Sonya is waiting for you tonight 🌙\nCustomers are already gathering at the shop door.`,
      `Day ${day}. It's getting dark, the street lamps are on 🏮\nDrop by the shop — Sonya is waiting for you at home tonight.`,
      `Day ${day}. The queue at the till keeps growing 🛒\nOpen up — Sonya is waiting for you tonight.`,
    ],
    friend: (friend) => `${friend} invites you to Magazinchik 🎁\nA starter gift of ${WELCOME_COINS} coins is waiting. Grandma's shop is yours!`,
    newcomer: "Grandma left you her little shop 🛒\nOpen the doors — the first customers are already waiting!",
    buyer: (userId) => `\n\nYour buyer number: ${userId} — please include it.`,
    paysupport: (id) =>
      `💬 Help with Stars payments\n\nIf Stars were charged but the item didn't appear, or you bought the wrong thing — message ${SUPPORT}: what you bought and when. We reply within 1–2 days and refund Stars when needed.\n\nPurchases are restored from Telegram automatically — try restarting the game first.${id}`,
    terms: `📄 Magazinchik terms\n\n• The game is free. Telegram Stars buy only shop decorations — they don't affect progress.\n• Every item can be tried on for free for a day before buying.\n• Purchases are yours forever and restore on any phone with this Telegram account.\n• Stars refunds: if a purchase didn't appear or was a mistake — contact us within 30 days via /paysupport.\n• We store only your Telegram ID — for purchases, friend invites and rare reminders from the bot. To stop reminders, stop the bot.\n\nQuestions: ${SUPPORT}`,
  },
  tr: {
    days: (day) => [
      `${day}. gün. Sonya akşam seni bekliyor 🌙\nDükkânın kapısında müşteriler toplanmaya başladı bile.`,
      `${day}. gün. Hava kararıyor, sokak lambaları yanıyor 🏮\nDükkâna bir uğra — akşam da Sonya seni evde bekliyor.`,
      `${day}. gün. Kasadaki kuyruk uzuyor 🛒\nDükkânı aç — Sonya akşam seni bekliyor.`,
    ],
    friend: (friend) => `${friend} seni Magazinchik’e çağırıyor 🎁\nBaşlangıç hediyen hazır: ${WELCOME_COINS} para. Ninenin dükkânı seni bekliyor!`,
    newcomer: 'Nine sana küçük dükkânını bıraktı 🛒\nKapıları aç — ilk müşteriler bekliyor bile!',
    buyer: (userId) => `\n\nAlıcı numaran: ${userId} — mesajına bunu da ekle.`,
    paysupport: (id) =>
      `💬 Yıldızla ödeme yardımı\n\nYıldızlar çekildi ama satın aldığın şey görünmüyorsa ya da yanlış bir şey aldıysan — ${SUPPORT} hesabına yaz: ne aldın ve ne zaman. 1–2 gün içinde cevap veririz, gerekirse yıldızlarını iade ederiz.\n\nSatın aldıkların Telegram’dan kendiliğinden geri yüklenir — önce oyunu yeniden başlatmayı dene.${id}`,
    terms: `📄 Magazinchik koşulları\n\n• Oyun ücretsiz. Telegram yıldızlarıyla yalnızca dükkân süsleri satılır — oyunun ilerleyişini etkilemezler.\n• Her eşyayı satın almadan önce bir gün ücretsiz deneyebilirsin.\n• Satın aldığın şey sonsuza kadar senin ve bu Telegram hesabının olduğu her telefonda geri gelir.\n• Yıldız iadesi: satın aldığın şey görünmediyse ya da yanlışlıkla aldıysan — 30 gün içinde /paysupport ile yaz.\n• Yalnızca Telegram numaranı saklıyoruz — satın alımlar, arkadaş davetleri ve bottan ara sıra gelen hatırlatmalar için. Hatırlatma istemiyorsan botu durdur.\n\nSorular: ${SUPPORT}`,
  },
  es: {
    days: (day) => [
      `Día ${day}. Sonia te espera esta noche 🌙\nY en la puerta de la tienda ya se juntan los clientes.`,
      `Día ${day}. Está oscureciendo y se encienden los faroles 🏮\nPásate por la tienda; en la noche Sonia te espera en casa.`,
      `Día ${day}. La fila en la caja no deja de crecer 🛒\nAbre la tienda: Sonia te espera esta noche.`,
    ],
    friend: (friend) => `${friend} te invita a Magazinchik 🎁\nTe espera un regalo de bienvenida: ${WELCOME_COINS} monedas. ¡La tienda de la abuela es tuya!`,
    newcomer: 'La abuela te dejó su tiendita 🛒\nAbre las puertas: ¡los primeros clientes ya están esperando!',
    buyer: (userId) => `\n\nTu número de comprador: ${userId}. Inclúyelo en tu mensaje.`,
    paysupport: (id) =>
      `💬 Ayuda con pagos en Stars\n\nSi se cobraron Stars pero la compra no apareció, o compraste algo por error, escribe a ${SUPPORT}: qué compraste y cuándo. Respondemos en 1–2 días y, si hace falta, te devolvemos las Stars.\n\nLas compras se recuperan solas desde Telegram: primero intenta reiniciar el juego.${id}`,
    terms: `📄 Condiciones de Magazinchik\n\n• El juego es gratis. Con las Stars de Telegram solo se compran decoraciones para la tienda: no afectan el progreso.\n• Puedes probar gratis cada objeto durante un día antes de comprarlo.\n• Lo que compras es tuyo para siempre y se recupera en cualquier teléfono con esta cuenta de Telegram.\n• Reembolso de Stars: si una compra no apareció o fue un error, escríbenos dentro de 30 días por /paysupport.\n• Solo guardamos tu ID de Telegram: para compras, invitaciones de amigos y algún recordatorio del bot. Para no recibir recordatorios, detén el bot.\n\nPreguntas: ${SUPPORT}`,
  },
  kk: {
    days: (day) => [
      `${day}-күн. Кешке Соня сені күтеді 🌙\nАл дүкен есігінің алдында сатып алушылар жинала бастады.`,
      `${day}-күн. Терезе сырты қараңғыланып, шамдар жанды 🏮\nДүкенге соқ — ал кешке Соня сені үйде күтеді.`,
      `${day}-күн. Кассадағы кезек ұзарып барады 🛒\nАуысымды аш — Соня кешке сені күтеді.`,
    ],
    friend: (friend) => `${friend} сені «Магазинчикке» шақырады 🎁\nБастауға сыйлық — ${WELCOME_COINS} ақша. Әженің дүкені күтіп тұр!`,
    newcomer: 'Әже саған шағын дүкенін қалдырды 🛒\nЕсікті аш — алғашқы сатып алушылар күтіп тұр!',
    buyer: (userId) => `\n\nСатып алушы нөмірің: ${userId} — хатыңа осыны қос.`,
    paysupport: (id) =>
      `💬 Жұлдызбен төлеу бойынша көмек\n\nЖұлдыз есептен шығып, бірақ сатып алған зат шықпаса немесе қате нәрсе алсаң — ${SUPPORT} жаз: не алдың және қашан. 1–2 күнде жауап береміз, қажет болса жұлдызды қайтарамыз.\n\nСатып алғандарың Telegram-нан өзі қалпына келеді — алдымен ойынды қайта ашып көр.${id}`,
    terms: `📄 «Магазинчик» шарттары\n\n• Ойын тегін. Telegram жұлдыздарына тек дүкен әшекейлері сатылады — ойынның өтуіне әсер етпейді.\n• Әр затты сатып алмас бұрын бір күн тегін байқап көруге болады.\n• Сатып алған зат мәңгі сенікі және осы Telegram аккаунты бар кез келген телефонда қайтып келеді.\n• Жұлдызды қайтару: сатып алған зат шықпаса немесе қателесіп алсаң — 30 күн ішінде /paysupport арқылы жаз.\n• Біз тек Telegram нөміріңді сақтаймыз — сатып алу, достарды шақыру және боттың сирек еске салулары үшін. Еске салу келмесін десең, ботты тоқтат.\n\nСұрақтар: ${SUPPORT}`,
  },
};

/** Язык чата: true/false — по-старому (ru или en). */
const chatLang = (lang: Lang | boolean): Lang => (typeof lang === 'boolean' ? (lang ? 'ru' : 'en') : lang);

/**
 * Подпись к ролику на /start: играющему — его день и Соня, приглашённому — от кого подарок,
 * новичку — приглашение открыть бабушкин магазин. Вариант зависит от дня, чтобы не повторяться.
 */
export function startCaption(lang: Lang | boolean, info: StartInfo): string {
  const t = CHAT[chatLang(lang)];
  const day = info.day ?? 0;
  if (day > 1) {
    const lines = t.days(day);
    return lines[day % lines.length];
  }
  if (info.friend) return t.friend(info.friend);
  return t.newcomer;
}

/** Ответ на /paysupport и /terms (null — это не наша команда). userId — чтобы поддержка нашла платёж. */
export function commandReply(text: string, lang: Lang | boolean, userId?: number): string | null {
  const t = CHAT[chatLang(lang)];
  const command = text.trim().split(/[\s@]/)[0].toLowerCase();
  const id = userId ? t.buyer(userId) : '';
  if (command === '/paysupport') return t.paysupport(id);
  if (command === '/terms') return t.terms;
  return null;
}

/**
 * Заполнить профиль бота: описание, короткое описание, команды (ru, tr, es, kk и для остальных — en)
 * и кнопку меню «Играть». Возвращает, что не получилось (пусто — всё хорошо).
 */
export async function setupProfile(token: string, appUrl: string): Promise<string[]> {
  const failed: string[] = [];
  const call = (method: string, body: Record<string, unknown>) => bot(token, method, body).catch((e: Error) => failed.push(e.message));
  for (const lang of LANGS) {
    // Для «en» задаём язык по умолчанию (без language_code) — его видят все, у кого Telegram не на ru, tr, es или kk.
    const scope = lang === 'en' ? {} : { language_code: lang };
    await call('setMyDescription', { description: DESCRIPTION[lang], ...scope });
    await call('setMyShortDescription', { short_description: SHORT[lang], ...scope });
    await call('setMyCommands', { commands: COMMANDS[lang], ...scope });
  }
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Играть', web_app: { url: appUrl } } });
  return failed;
}
